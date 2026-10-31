// Relance WhatsApp d'un client « Intérêt élevé » (Admin › Clients) : quel article il a regardé, et le message prêt à envoyer.
// L'administrateur touche « WhatsApp », le message s'ouvre déjà écrit (il peut le modifier) : rien ne part tout seul.
// Tout vient de la base : article réellement regardé, prix du jour, stock réel. Rien n'est inventé : pas de remise imaginaire,
// pas de fausse urgence ; « il n'en reste que N » seulement quand le stock est vraiment bas.
// Fonctions pures, sans écran ni réseau : testées dans tests/relance/relance.test.ts.

import { HOME_CITY } from '../constants/shopRules';

export const SITE_URL = 'https://www.albasseshopping.com';
// En dessous de ce stock, on dit au client combien il en reste (c'est vrai, donc honnête)
export const LOW_STOCK_MAX = 10;

export interface RelanceProduct {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
}

// Un article regardé de près (« Intérêt élevé ») par un client connecté : une ligne de la table visitor_product_interest
export interface InterestRow {
  userId: string;
  productId: string;
  cartStatus: 'none' | 'in_cart' | 'removed' | 'purchased';
  lastViewedAt: string | null;
  activeSeconds: number;
}

// Une commande du client (juste ce qu'il faut : qui, quel statut, quels articles)
export interface OrderLite {
  user_id: string | null;
  status: string | null;
  items: unknown;
}

export interface RelancePick {
  product: RelanceProduct;
  row: InterestRow;
}

// « N'Djamena », « N’Djamena  », « Ndjamena », « N'Djaména » → « ndjamena » (la ville est tapée à la main par les clients)
export const cityKey = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

export const isHomeCity = (region: unknown): boolean => cityKey(region) === cityKey(HOME_CITY);

const lastSeen = (r: InterestRow) => {
  const t = Date.parse(r.lastViewedAt ?? '');
  return Number.isFinite(t) ? t : 0;
};
const hadCartGesture = (r: InterestRow) => r.cartStatus === 'in_cart' || r.cartStatus === 'removed';

// Pour chaque client : les articles qu'il a déjà commandés (commandes annulées ignorées : il peut vouloir les reprendre).
export function orderedByUser(orders: OrderLite[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const o of orders) {
    if (!o?.user_id || o.status === 'cancelled' || !Array.isArray(o.items)) continue;
    const set = out.get(o.user_id) ?? new Set<string>();
    for (const it of o.items) {
      const id = it && typeof it === 'object' ? (it as { product_id?: unknown }).product_id : null;
      if (typeof id === 'string' && id) set.add(id);
    }
    out.set(o.user_id, set);
  }
  return out;
}

// Les articles « Intérêt élevé » de ce client, du plus prometteur au moins prometteur :
//  1. ceux où le client a commencé une commande ou mis au panier (geste d'achat) ;
//  2. puis le plus récemment regardé ;
//  3. puis celui sur lequel il est resté le plus longtemps.
// On écarte ce qu'il a déjà acheté ou commandé : lui parler d'un article déjà commandé serait maladroit.
export function relanceCandidates(rows: InterestRow[], userId: string, ordered: ReadonlyMap<string, ReadonlySet<string>> = new Map()): InterestRow[] {
  const already = ordered.get(userId);
  return rows
    .filter((r) => r.userId === userId && !!r.productId && r.cartStatus !== 'purchased' && !already?.has(r.productId))
    .sort((a, b) => Number(hadCartGesture(b)) - Number(hadCartGesture(a)) || lastSeen(b) - lastSeen(a) || b.activeSeconds - a.activeSeconds);
}

const sellable = (p: RelanceProduct | undefined): p is RelanceProduct => !!p && p.is_active && p.stock > 0 && Number(p.price) > 0 && !!p.name?.trim();

// Le premier article de la liste qu'on peut encore vendre (en vente, en stock, avec un prix) ; null s'il n'y en a aucun.
export function pickRelance(
  rows: InterestRow[],
  userId: string,
  products: ReadonlyMap<string, RelanceProduct>,
  ordered: ReadonlyMap<string, ReadonlySet<string>> = new Map()
): RelancePick | null {
  for (const row of relanceCandidates(rows, userId, ordered)) {
    const product = products.get(row.productId);
    if (sellable(product)) return { product, row };
  }
  return null;
}

const fmt = (n: number) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
const cleanName = (s: string) => String(s).replace(/\s+/g, ' ').trim();

export const firstNameOf = (fullName: unknown): string => String(fullName ?? '').trim().split(/\s+/)[0] ?? '';

export const productLink = (p: Pick<RelanceProduct, 'slug'>): string => (p.slug ? `${SITE_URL}/produit/${encodeURIComponent(p.slug)}` : SITE_URL);

// La ligne sur la livraison : exacte selon la ville du client (livraison sans frais et paiement à la livraison seulement à N'Djamena).
export function deliveryLine(region: unknown): string {
  if (isHomeCity(region)) return `🚚 Livraison à ${HOME_CITY} sans frais, et paiement à la livraison.`;
  if (cityKey(region)) return '🚚 Livraison partout au Tchad, paiement à l’avance par Airtel Money ou Moov Money.';
  // ville inconnue (13 comptes sur 30 n'ont pas rempli la leur) : on ne promet rien qui ne soit pas sûr
  return `🚚 Livraison partout au Tchad. À ${HOME_CITY} : sans frais et paiement à la livraison.`;
}

export function relanceMessage(input: { firstName: string; product: RelanceProduct | null; region?: string | null }): string {
  const hello = `Bonjour${input.firstName ? ` ${input.firstName}` : ''}, ici l'équipe Albasse Shopping 😊`;
  const p = input.product;
  if (!p) return hello;
  const reduced = Number(p.compare_at_price) > Number(p.price);
  const price = reduced ? `${fmt(p.price)} (au lieu de ${fmt(Number(p.compare_at_price))})` : fmt(p.price);
  const stock = p.stock <= LOW_STOCK_MAX ? ` Il n'en reste que ${p.stock}.` : '';
  return [
    hello,
    `Vous avez regardé « ${cleanName(p.name)} » sur notre site : ${price}. Il est toujours disponible.${stock}`,
    deliveryLine(input.region),
    `Souhaitez-vous le commander ? 👉 ${productLink(p)}`,
  ].join('\n\n');
}

export const whatsappLink = (digits: string, text: string): string => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;

// Une adresse de produit n'est utile que si elle ressemble à un identifiant : évite d'envoyer n'importe quoi à la base
export const isUuid = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
