import { GIFT_WRAP_FEE, HOME_CITY } from '../constants/shopRules';
import { discount, fcfa, newest, promotions, searchCatalog, type CatalogProduct } from './assistantBrain';

// Marketing de Zara : fonctions simples (sans IA) pour conseiller, qualifier le budget, proposer des cadeaux,
// des produits qui se completent, et rassurer. Tout vient du catalogue reel : aucune fausse rarete,
// aucun faux chiffre.

// ---------------------------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------------------------

export interface Range {
  min: number;
  max: number; // Infinity : pas de plafond
}

export const BUDGETS: { label: string; range: Range }[] = [
  { label: '💰 Moins de 10 000 FCFA', range: { min: 0, max: 10000 } },
  { label: '💰 10 000 à 30 000 FCFA', range: { min: 10000, max: 30000 } },
  { label: '💰 30 000 à 100 000 FCFA', range: { min: 30000, max: 100000 } },
  { label: '💰 Plus de 100 000 FCFA', range: { min: 100000, max: Infinity } },
];
export const ANY_BUDGET: Range = { min: 0, max: Infinity };

export const encodeRange = (r: Range) => `${r.min}-${Number.isFinite(r.max) ? r.max : ''}`;

export function decodeRange(payload: string | undefined): Range | null {
  const m = /^(\d+)-(\d*)$/.exec(payload ?? '');
  if (!m) return null;
  return { min: Number(m[1]), max: m[2] === '' ? Infinity : Number(m[2]) };
}

export function describeRange(r: Range): string {
  if (!Number.isFinite(r.max)) return r.min > 0 ? `à partir de ${fcfa(r.min)}` : 'sans limite de budget';
  if (r.min <= 0) return `à moins de ${fcfa(r.max)}`;
  return `entre ${fcfa(r.min)} et ${fcfa(r.max)}`;
}

const plain = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// « 20 000 », « moins de 15000 », « entre 10 000 et 30 000 », « 20k », « plus de 50 mille ».
// Un seul montant = le budget maximum. Les petits nombres (quantites) sont ignores.
export function parseBudget(text: string): Range | null {
  const t = plain(text).replace(/(\d) (?=\d{3}(?:\D|$))/g, '$1');
  const nums: number[] = [];
  const re = /(\d+)\s*(k|mille)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) nums.push(Number(m[1]) * (m[2] ? 1000 : 1));
  const big = nums.filter((n) => n >= 500);
  if (big.length === 0) return null;
  if (big.length >= 2 && /entre|\bde\b.*\ba\b/.test(t)) {
    return { min: Math.min(big[0], big[1]), max: Math.max(big[0], big[1]) };
  }
  if (/plus de|au dessus|minimum|a partir/.test(t)) return { min: big[0], max: Infinity };
  return { min: 0, max: big[0] };
}

// Le texte sans le budget : « chaussures homme moins de 20000 » -> « chaussures homme ».
export function stripBudget(text: string): string {
  return text
    .replace(/\d[\d\s.,]*\s*(k|mille|fcfa|cfa|francs?)?(?![\p{L}\d])/giu, ' ')
    .replace(/(?<![\p{L}])(moins d[eu']?|plus d[eu']?|entre|au[- ]dessus d[eu']?|(?:à|a) partir d[eu']?|jusqu['’]?(?:à|a)|maximum|minimum|max|min|budget|environ)(?![\p{L}])/giu, ' ')
    .replace(/\s+(et|de|du|à|a|pour|d['’])\s*$/iu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Selections de produits
// ---------------------------------------------------------------------------------------------

export type GiftTarget = 'elle' | 'lui' | 'enfant';

export type Context =
  | { kind: 'query'; query: string }
  | { kind: 'category'; slug: string }
  | { kind: 'gift'; who: GiftTarget }
  | { kind: 'promo' }
  | { kind: 'new' };

const sellable = (p: CatalogProduct) => p.price > 0 && p.stock > 0 && !!p.image;
const byDiscount = (list: CatalogProduct[]) => [...list].sort((a, b) => discount(b) - discount(a));

const GIFT_SLOTS: Record<GiftTarget, { slug: string; query?: string }[]> = {
  elle: [{ slug: 'parfum', query: 'parfum femme' }, { slug: 'sacs-et-bagages' }, { slug: 'vetements-pour-femmes' }, { slug: 'cosmetique' }],
  lui: [{ slug: 'montre', query: 'montre homme' }, { slug: 'parfum', query: 'parfum homme' }, { slug: 'chaussures', query: 'chaussures homme' }, { slug: 'lunettes' }],
  enfant: [{ slug: 'velos-pour-enfants-jouets-et-jeux' }, { slug: 'bebe-et-maternite' }],
};

export const GIFT_LABELS: Record<GiftTarget, string> = { elle: 'elle', lui: 'lui', enfant: 'un enfant' };

function slotCandidates(catalog: CatalogProduct[], slot: { slug: string; query?: string }): CatalogProduct[] {
  const inCategory = catalog.filter((p) => p.categorySlug === slot.slug && sellable(p));
  if (!slot.query) return byDiscount(inCategory);
  // le plus proche de « parfum femme » d'abord, puis les meilleures remises parmi eux
  const relevant = searchCatalog(inCategory, slot.query, 8);
  return relevant.length ? byDiscount(relevant) : byDiscount(inCategory);
}

// Un cadeau varie : un produit de chaque categorie a tour de role.
export function giftPicks(catalog: CatalogProduct[], who: GiftTarget, range: Range = ANY_BUDGET, limit = 4): CatalogProduct[] {
  const slots = GIFT_SLOTS[who].map((slot) => slotCandidates(catalog, slot).filter((p) => p.price >= range.min && p.price <= range.max));
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();
  for (let round = 0; out.length < limit && round < 12; round++) {
    for (const list of slots) {
      const p = list[round];
      if (p && !seen.has(p.id) && out.length < limit) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}

export function candidatesFor(catalog: CatalogProduct[], ctx: Context | null): CatalogProduct[] {
  const base = catalog.filter(sellable);
  if (!ctx) return byDiscount(base);
  switch (ctx.kind) {
    case 'query':
      return searchCatalog(catalog, ctx.query, 300);
    case 'category':
      return byDiscount(base.filter((p) => p.categorySlug === ctx.slug));
    case 'gift':
      return giftPicks(catalog, ctx.who, ANY_BUDGET, 60);
    case 'promo':
      return promotions(catalog, 300);
    case 'new':
      return newest(catalog, 300);
  }
}

// Les meilleurs choix dans un budget. Si rien n'entre dans le budget : ce qui s'en approche le plus (fallback).
export function pickInBudget(catalog: CatalogProduct[], ctx: Context | null, range: Range, limit = 4): { items: CatalogProduct[]; fallback: boolean } {
  const all = candidatesFor(catalog, ctx);
  const inside = all.filter((p) => p.price >= range.min && p.price <= range.max);
  if (inside.length > 0) return { items: inside.slice(0, limit), fallback: false };
  const sorted = [...all].sort((a, b) => (range.min > 0 ? b.price - a.price : a.price - b.price));
  return { items: sorted.slice(0, limit), fallback: true };
}

// ---------------------------------------------------------------------------------------------
// Produits qui se completent
// ---------------------------------------------------------------------------------------------

const CROSS_SELL: Record<string, string[]> = {
  vetements: ['chaussures', 'montre'],
  'vetements-pour-femmes': ['sacs-et-bagages', 'parfum'],
  chaussures: ['sacs-et-bagages', 'montre'],
  montre: ['parfum', 'lunettes'],
  parfum: ['montre', 'cosmetique'],
  lunettes: ['montre', 'parfum'],
  cosmetique: ['parfum'],
  'sacs-et-bagages': ['chaussures', 'parfum'],
  'bebe-et-maternite': ['velos-pour-enfants-jouets-et-jeux'],
  'velos-pour-enfants-jouets-et-jeux': ['bebe-et-maternite'],
  'maison-mobilier': ['electrique'],
  electrique: ['maison-mobilier'],
};

// Categorie la plus presente parmi des produits.
export function dominantSlug(products: CatalogProduct[]): string {
  const counts = new Map<string, number>();
  for (const p of products) if (p.categorySlug) counts.set(p.categorySlug, (counts.get(p.categorySlug) ?? 0) + 1);
  let best = '';
  let n = 0;
  counts.forEach((c, slug) => {
    if (c > n) {
      best = slug;
      n = c;
    }
  });
  return best;
}

export function crossSellTarget(catalog: CatalogProduct[], slug: string): { slug: string; name: string } | null {
  for (const s of CROSS_SELL[slug] ?? []) {
    const hit = catalog.find((p) => p.categorySlug === s && sellable(p));
    if (hit) return { slug: s, name: hit.category };
  }
  return null;
}

// Categories proposees quand le visiteur demande conseil : les plus demandees d'abord.
const ADVICE_ORDER = ['parfum', 'chaussures', 'montre', 'vetements', 'vetements-pour-femmes', 'sacs-et-bagages', 'electrique'];

export function adviceCategories(catalog: CatalogProduct[], max = 6): { slug: string; name: string }[] {
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const p of catalog) {
    if (!sellable(p) || !p.categorySlug) continue;
    names.set(p.categorySlug, p.category);
    counts.set(p.categorySlug, (counts.get(p.categorySlug) ?? 0) + 1);
  }
  const first = ADVICE_ORDER.filter((s) => counts.has(s));
  const rest = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s).filter((s) => !first.includes(s));
  return [...first, ...rest].slice(0, max).map((slug) => ({ slug, name: names.get(slug) as string }));
}

// ---------------------------------------------------------------------------------------------
// Urgence vraie et textes de vente
// ---------------------------------------------------------------------------------------------

const short = (text: string, n = 38) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

// Seulement si le stock est vraiment bas (1 a 5) : jamais de fausse rarete.
export function lowStockLine(products: CatalogProduct[]): string | null {
  const low = products.filter((p) => p.stock >= 1 && p.stock <= 5).sort((a, b) => a.stock - b.stock)[0];
  if (!low) return null;
  return low.stock === 1 ? `⚠️ « ${short(low.name)} » : il n’en reste qu’un en stock !` : `⚠️ « ${short(low.name)} » : plus que ${low.stock} en stock !`;
}

export function maxDiscountPct(catalog: CatalogProduct[]): number | null {
  const ds = catalog.filter(sellable).map(discount).filter((d) => d >= 0.05 && d <= 0.9);
  if (ds.length === 0) return null;
  return Math.round(Math.max(...ds) * 100);
}

// Quand le visiteur ouvre le chat sur la fiche d'un produit.
export function productPitch(p: CatalogProduct): string {
  const pct = p.compareAt ? Math.round(discount(p) * 100) : 0;
  const price = p.compareAt && pct >= 5 ? `${fcfa(p.price)} au lieu de ${fcfa(p.compareAt)} (-${pct} %)` : fcfa(p.price);
  const stock = p.stock >= 1 && p.stock <= 5 ? `\n${p.stock === 1 ? 'Il n’en reste qu’un en stock' : `Plus que ${p.stock} en stock`} : ne tardez pas !` : '';
  return `Vous regardez « ${short(p.name, 48)} » ? Excellent choix ! ${price}.${stock}\nPour le commander, touchez « Acheter » en bas de l’écran 👇`;
}

export function cartReminder(count: number, total: number): string {
  return `🛒 Votre panier vous attend : ${count} article${count > 1 ? 's' : ''} pour ${fcfa(total)}. Terminez votre commande en quelques secondes !`;
}

export function priceReply(maxPct: number | null): string {
  return [
    'Je comprends 😊 Un bon achat, c’est la qualité au bon prix. Voici comment payer moins :',
    `🔥 profitez de nos promotions${maxPct ? ` (jusqu’à -${maxPct} %)` : ''}`,
    '💰 dites-moi votre budget : je vous montre mes meilleurs choix',
    `🚚 à ${HOME_CITY}, la livraison est gratuite`,
  ].join('\n');
}

export interface TrustInfo {
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

export function formatPhone(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  const m = /^(235)?(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(d);
  return m ? `+235 ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : phone ? phone : null;
}

export function trustReply(info: TrustInfo): string {
  const where = [info.address, info.city].filter(Boolean).join(', ');
  const phone = formatPhone(info.phone);
  return [
    'Votre confiance compte pour nous 🤝 Albasse Shopping, c’est Service, Qualité, Garantie.',
    `💵 À ${HOME_CITY}, vous ne payez qu’en recevant votre commande.`,
    where ? `📍 Boutique : ${where}` : null,
    phone ? `📞 ${phone}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export const laterReply = () =>
  'Pas de souci{nom} 😊 Prenez votre temps. Touchez le cœur ❤️ sur un produit pour le retrouver dans vos favoris (avec un compte gratuit). Je reste là si vous avez une question !';

// Service emballage cadeau (2 000 FCFA par commande).
export const giftWrapReply = () =>
  `🎁 Emballage cadeau : pour ${fcfa(GIFT_WRAP_FEE)} par commande, votre colis arrive joliment emballé. Touchez l’image cadeau au moment de commander, ou dans « Mes commandes » tant que votre commande est en attente.`;

export const giftWrapPitch = () =>
  `🎁 Offrez-le joliment emballé : emballage cadeau à ${fcfa(GIFT_WRAP_FEE)} par commande (touchez l’image cadeau en commandant).`;
