// Zara vendeuse : des preuves VRAIES (ventes réelles, stock réel) et l'article qui complète un choix.
// Rien n'est inventé : sans chiffre fiable, Zara ne dit rien (jamais de faux « X personnes regardent cet article »).
import type { CatalogProduct } from './assistantBrain';
import { crossSellTarget } from './assistantMarketing';

// En dessous de 3 commandes, un chiffre ne rassure pas : Zara ne l'annonce pas.
export const MIN_SALES_PROOF = 3;
export const SALES_WINDOW_DAYS = 7;
// Au-dessus de ce stock, pas de « plus que N » (c'est de la rareté vraie seulement).
export const LOW_STOCK_MAX = 5;

export type SalesMap = Map<string, number>;

// La réponse de la base : une ligne par article { product_id, orders_count }. Tout ce qui est douteux est ignoré.
export function buildSalesMap(rows: unknown): SalesMap {
  const map: SalesMap = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const id = row && typeof (row as { product_id?: unknown }).product_id === 'string' ? (row as { product_id: string }).product_id : null;
    const n = Number((row as { orders_count?: unknown } | null)?.orders_count);
    if (id && Number.isInteger(n) && n > 0) map.set(id, n);
  }
  return map;
}

// Le nombre de commandes à annoncer pour cet article, ou 0 s'il n'y a rien de solide à dire.
export function provenSales(map: SalesMap | null | undefined, productId: string): number {
  const n = map?.get(productId) ?? 0;
  return n >= MIN_SALES_PROOF ? n : 0;
}

// L'article le plus commandé parmi ceux-ci (si au moins un a un chiffre solide), sinon null.
export function bestSeller<T extends { id: string }>(products: T[], map: SalesMap | null | undefined): T | null {
  let best: T | null = null;
  let bestN = 0;
  for (const p of products) {
    const n = provenSales(map, p.id);
    if (n > bestN) {
      best = p;
      bestN = n;
    }
  }
  return best;
}

// Ce qui complète l'article qu'on vient d'ajouter : un article en stock d'une catégorie qui va avec, jamais celui qui est déjà
// dans le panier. Le plus commandé d'abord (chiffres vrais), sinon le premier en stock. Aucune remise n'est annoncée.
export function pickComplement(
  catalog: CatalogProduct[],
  product: { id: string; categorySlug: string; price: number },
  inCartIds: string[],
  sales: SalesMap | null | undefined,
  lang: 'fr' | 'ar' = 'fr'
): CatalogProduct | null {
  const target = crossSellTarget(catalog, product.categorySlug, lang);
  if (!target) return null;
  const pool = catalog.filter((p) => p.categorySlug === target.slug && p.stock > 0 && p.price > 0 && !!p.image && !inCartIds.includes(p.id));
  if (pool.length === 0) return null;
  return bestSeller(pool, sales) ?? pool[0];
}

// Ce que l'équipe voit dans l'admin : les articles que le client regardait (court, pour tenir dans la fiche).
export function callbackNote(names: string[], max = 280): string {
  const clean = Array.from(new Set(names.map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean)));
  if (clean.length === 0) return '';
  let note = '';
  let used = 0;
  for (const name of clean) {
    const next = note ? `${note}, ${name}` : name;
    if (next.length > max) break;
    note = next;
    used += 1;
  }
  if (!note) note = clean[0].slice(0, max);
  const rest = clean.length - Math.max(used, 1);
  return rest > 0 ? `${note} (+${rest})` : note;
}

// ---------------------------------------------------------------------------------------------
// Le jour du rappel WhatsApp : le client choisit un jour précis parmi les prochains jours ouvrables (du lundi au samedi), à l'heure
// du Tchad (UTC+1 toute l'année, sans heure d'été). Aujourd'hui n'est proposé que s'il reste du temps à l'équipe.
// ---------------------------------------------------------------------------------------------

export interface CallbackDay {
  iso: string; // 2026-10-20
  label: string; // « Demain (mardi 20 oct.) »
  offset: number; // 0 = aujourd'hui, 1 = demain...
  weekday: number; // 0 = dimanche
  dom: number; // jour du mois
}

const CHAD_OFFSET_MS = 3600000;
// Après cette heure (heure du Tchad), « aujourd'hui » n'est plus proposé (la boutique ferme à 16 h).
export const CALLBACK_TODAY_UNTIL_HOUR = 15;
export const CALLBACK_DAY_CHOICES = 5;

const DAYS: Record<'fr' | 'ar', string[]> = {
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const MONTHS: Record<'fr' | 'ar', string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

// La date du jour au Tchad (AAAA-MM-JJ).
export function chadDayIso(now: Date = new Date()): string {
  return isoOf(new Date(now.getTime() + CHAD_OFFSET_MS));
}

// « mardi 20 oct. » d'une date AAAA-MM-JJ (sans dépendre du fuseau de l'appareil).
export function dayLabelOf(iso: string, lang: 'fr' | 'ar' = 'fr'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return `${DAYS[lang][d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[lang][d.getUTCMonth()]}`;
}

export function callbackDays(now: Date = new Date(), lang: 'fr' | 'ar' = 'fr', count = CALLBACK_DAY_CHOICES): CallbackDay[] {
  const chad = new Date(now.getTime() + CHAD_OFFSET_MS);
  const hour = chad.getUTCHours();
  const startOffset = hour < CALLBACK_TODAY_UNTIL_HOUR ? 0 : 1;
  const out: CallbackDay[] = [];
  for (let offset = startOffset; out.length < count && offset < 14; offset++) {
    const d = new Date(Date.UTC(chad.getUTCFullYear(), chad.getUTCMonth(), chad.getUTCDate() + offset, 12));
    const weekday = d.getUTCDay();
    if (weekday === 0) continue; // dimanche : l'équipe n'écrit pas
    const plain = `${DAYS[lang][weekday]} ${d.getUTCDate()} ${MONTHS[lang][d.getUTCMonth()]}`;
    const word = offset === 0 ? (lang === 'ar' ? 'اليوم' : 'Aujourd’hui') : offset === 1 ? (lang === 'ar' ? 'غدا' : 'Demain') : null;
    const label = word ? `${word} (${plain})` : lang === 'ar' ? plain : plain.charAt(0).toUpperCase() + plain.slice(1);
    out.push({ iso: isoOf(d), label, offset, weekday, dom: d.getUTCDate() });
  }
  return out;
}

const DAY_WORDS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  الاحد: 0, الاثنين: 1, الثلاثاء: 2, الاربعاء: 3, الخميس: 4, الجمعه: 5, السبت: 6,
};

// Le jour écrit par le client (« demain », « lundi », « le 23 », « اليوم ») parmi ceux proposés ; null si rien n'est clair.
// `normalized` est le texte déjà passé par normalize().
export function dayFromText(normalized: string, days: CallbackDay[]): CallbackDay | null {
  const text = ` ${normalized} `;
  if (/ (aujourd hui|aujourdhui|ajourdhui|today|اليوم) /.test(text)) return days.find((d) => d.offset === 0) ?? null;
  if (/ (demain|tomorrow|غدا|بكره) /.test(text)) return days.find((d) => d.offset === 1) ?? null;
  for (const word of normalized.split(' ')) {
    const wd = DAY_WORDS[word];
    if (wd !== undefined) return days.find((d) => d.weekday === wd) ?? null;
  }
  const n = /(?:^|\D)(\d{1,2})(?:\D|$)/.exec(normalized);
  if (n) {
    const dom = Number(n[1]);
    return days.find((d) => d.dom === dom) ?? null;
  }
  return null;
}
