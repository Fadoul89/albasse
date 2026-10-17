import { discount, newest, normalize, promotions, searchCatalog, tokenize, type CatalogProduct } from './assistantBrain';
import { arabicToFrench, CATEGORY_WORDS, GENDERED_SLUGS, hasArabic, WHO_WORDS, type Lang, type Who } from './assistantLang';
import { categoryLabel, fcfa, texts, type Range } from './assistantText';

// Conseil de Zara : fonctions simples (sans IA) pour comprendre le besoin du client, poser UNE question à la fois
// (pour qui, quel article, quel budget), recommander avec des raisons vérifiées, proposer ce qui se complète,
// rassurer. Tout vient du catalogue réel : aucune fausse rareté, aucun faux chiffre.

export type { Range };

// ---------------------------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------------------------

export const BUDGET_RANGES: Range[] = [
  { min: 0, max: 10000 },
  { min: 10000, max: 30000 },
  { min: 30000, max: 100000 },
  { min: 100000, max: Infinity },
];
export const ANY_BUDGET: Range = { min: 0, max: Infinity };

// Les 4 tranches avec leur texte dans la langue de Zara.
export const budgetOptions = (lang: Lang = 'fr'): { label: string; range: Range }[] =>
  BUDGET_RANGES.map((range, i) => ({ label: texts(lang).chip.budgets[i], range }));
export const BUDGETS = budgetOptions('fr');

export const encodeRange = (r: Range) => `${r.min}-${Number.isFinite(r.max) ? r.max : ''}`;

export function decodeRange(payload: string | undefined): Range | null {
  const m = /^(\d+)-(\d*)$/.exec(payload ?? '');
  if (!m) return null;
  return { min: Number(m[1]), max: m[2] === '' ? Infinity : Number(m[2]) };
}

export const describeRange = (r: Range, lang: Lang = 'fr') => texts(lang).rangeText(r);

// « 20 000 », « moins de 15000 », « entre 10 000 et 30 000 », « 20k », « plus de 50 mille », « أقل من 15000 ».
// Un seul montant = le budget maximum. Les petits nombres (quantités) sont ignorés.
export function parseBudget(text: string): Range | null {
  const t = normalize(text).replace(/(\d) (?=\d{3}(?:\D|$))/g, '$1');
  const nums: number[] = [];
  const re = /(\d+)\s*(k|mille|الف|الاف)?(?![a-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) nums.push(Number(m[1]) * (m[2] ? 1000 : 1));
  const big = nums.filter((n) => n >= 500);
  if (big.length === 0) return null;
  if (big.length >= 2 && /entre|\bde\b.*\ba\b|بين|من .* الي/.test(t)) {
    return { min: Math.min(big[0], big[1]), max: Math.max(big[0], big[1]) };
  }
  if (/plus de|au dessus|minimum|a partir|اكثر من|فوق|ابتداء من|اعلي من/.test(t)) return { min: big[0], max: Infinity };
  return { min: 0, max: big[0] };
}

// Le texte sans le budget : « chaussures homme moins de 20000 » -> « chaussures homme ».
export function stripBudget(text: string): string {
  return text
    .replace(/[\d٠-٩۰-۹][\d٠-٩۰-۹\s.,]*\s*(k|mille|ألف|الف|آلاف|fcfa|cfa|francs?)?(?![\p{L}\d])/giu, ' ')
    .replace(/(?<![\p{L}])(moins d[eu']?|plus d[eu']?|entre|au[- ]dessus d[eu']?|(?:à|a) partir d[eu']?|jusqu['’]?(?:à|a)|maximum|minimum|max|min|budget|environ)(?![\p{L}])/giu, ' ')
    .replace(/(?<![\p{L}])((?:أقل|اقل)\s+من|(?:أكثر|اكثر)\s+من|ابتداء\s+من|بين|فوق|حتى|ميزانيتي|ميزانية|بالفرنك|فرنك)(?![\p{L}])/gu, ' ')
    .replace(/\s+(et|de|du|à|a|pour|d['’]|و)\s*$/iu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Comprendre le besoin : cadeau ? pour qui ? quel article ? demande précise ou large ?
// ---------------------------------------------------------------------------------------------

export type GiftTarget = Who;

const GIFT_WORDS = new Set(['cadeau', 'cadeaux', 'offrir', 'anniversaire', 'mariage', 'tabaski', 'ramadan', 'eid', 'fete']);
// Mots qui disent « je veux quelque chose » sans dire quoi.
const NEED_WORDS = new Set([
  'faire', 'fais', 'fait', 'offrir', 'offre', 'besoin', 'quelque', 'chose', 'truc', 'article', 'articl', 'voir', 'trouver', 'donner',
  'envie', 'aimerais', 'souhaite', 'idee', 'surprise', 'conseil', 'conseille', 'conseiller', 'recommande', 'recommandez', 'suggere',
  'choisir', 'aide', 'aider',
]);

const stemWord = (w: string) => tokenize(w)[0] ?? w;
const CATEGORY_STEMS = CATEGORY_WORDS.map((c) => ({ slug: c.slug, words: new Set(c.words.map(stemWord)) }));
const WHO_STEMS = (Object.keys(WHO_WORDS) as Who[]).map((who) => ({ who, words: new Set(WHO_WORDS[who].map((w) => stemWord(w))) }));

export interface Parsed {
  lang: Lang;
  gift: boolean;
  who?: Who;
  slug?: string;
  rest: string[]; // mots précis (marque, couleur, taille...) : si il y en a, la demande est précise
  query: string; // texte à chercher (l'arabe est ramené au français, sans le budget)
}

export function parseNeed(text: string): Parsed {
  const arabic = hasArabic(text);
  const cleaned = stripBudget(text);
  const fr = arabic ? arabicToFrench(cleaned) : cleaned;
  const n = normalize(fr);
  const raw = n.split(' ').filter(Boolean);
  const stems = tokenize(fr);
  const gift = raw.some((t) => GIFT_WORDS.has(t));
  let who: Who | undefined;
  if (/\bmon marie\b/.test(n)) who = 'lui';
  for (const t of raw) {
    if (who) break;
    for (const w of WHO_STEMS) if (w.words.has(stemWord(t))) who = w.who;
  }
  let slug: string | undefined;
  for (const t of stems) {
    if (slug) break;
    for (const c of CATEGORY_STEMS) if (c.words.has(t)) slug = c.slug;
  }
  const known = (t: string) => CATEGORY_STEMS.some((c) => c.words.has(t)) || WHO_STEMS.some((w) => w.words.has(t));
  const rest = stems.filter((t) => !known(t) && !GIFT_WORDS.has(t) && !NEED_WORDS.has(t) && !/^\d+$/.test(t) && !hasArabicStopLike(t));
  return { lang: arabic ? 'ar' : 'fr', gift, who, slug, rest, query: fr.replace(/\s+/g, ' ').trim() };
}

// Mots arabes ou très courts qui ne disent rien de précis.
const hasArabicStopLike = (t: string) => t.length < 2;

// Demande large (« chaussures », « un cadeau pour mon mari », « pour homme ») : Zara pose ses questions avant de montrer.
// Demande précise (« rolex », « chaussures noires 42 ») : Zara montre tout de suite.
export const isBroad = (p: Parsed) => p.rest.length === 0 && (!!p.slug || p.gift || !!p.who);

// ---------------------------------------------------------------------------------------------
// Questions, une à la fois
// ---------------------------------------------------------------------------------------------

export interface Need {
  gift: boolean;
  who?: Who;
  slug?: string;
  typeAsked?: boolean; // « quel article ? » déjà posée (réponse « je ne sais pas » comprise)
  budget?: { min: number; max: number | null } | null;
}

export type Question = 'who' | 'type' | 'budget' | 'done';

export function nextQuestion(n: Need): Question {
  if (n.gift) {
    if (!n.who) return 'who';
    if (!n.slug && !n.typeAsked) return 'type';
  } else {
    if (!n.slug && !n.who && !n.typeAsked) return 'type';
    if (n.slug && GENDERED_SLUGS.includes(n.slug) && !n.who) return 'who';
    if (!n.slug && n.who && !n.typeAsked) return 'type';
  }
  if (!n.budget) return 'budget';
  return 'done';
}

export const rangeOfNeed = (n: Need): Range => (n.budget ? { min: n.budget.min, max: n.budget.max ?? Infinity } : ANY_BUDGET);
export const budgetOfRange = (r: Range) => ({ min: r.min, max: Number.isFinite(r.max) ? r.max : null });

// ---------------------------------------------------------------------------------------------
// Sélections de produits
// ---------------------------------------------------------------------------------------------

export type Context =
  | { kind: 'query'; query: string }
  | { kind: 'category'; slug: string; who?: Who }
  | { kind: 'gift'; who: Who; slug?: string }
  | { kind: 'who'; who: Who } // « pour homme » sans article précis : un peu de tout pour lui / elle / un enfant
  | { kind: 'promo' }
  | { kind: 'new' };

const sellable = (p: CatalogProduct) => p.price > 0 && p.stock > 0 && !!p.image;
const byDiscount = (list: CatalogProduct[]) => [...list].sort((a, b) => discount(b) - discount(a));

// Les catégories proposées quand on demande « quel genre d'article ? » (pour un cadeau, ce sont aussi celles d'où viennent les idées cadeaux).
const TYPE_SLUGS: Record<'gift' | 'shop', Record<Who, string[]>> = {
  gift: {
    lui: ['montre', 'parfum', 'chaussures', 'lunettes'],
    elle: ['parfum', 'sacs-et-bagages', 'vetements-pour-femmes', 'cosmetique'],
    enfant: ['velos-pour-enfants-jouets-et-jeux', 'bebe-et-maternite'],
  },
  shop: {
    lui: ['chaussures', 'montre', 'parfum', 'vetements', 'lunettes'],
    elle: ['parfum', 'chaussures', 'vetements-pour-femmes', 'sacs-et-bagages', 'montre', 'cosmetique'],
    enfant: ['velos-pour-enfants-jouets-et-jeux', 'bebe-et-maternite', 'chaussures'],
  },
};

const WHO_PRODUCT_WORDS: Record<Who, string[]> = {
  lui: ['homme', 'men', 'man', 'messieur'],
  elle: ['femme', 'women', 'woman', 'dame', 'lady'],
  enfant: ['enfant', 'kid', 'bebe', 'junior'],
};

const whoMatches = (p: CatalogProduct, who: Who) =>
  WHO_PRODUCT_WORDS[who].some((w) => p.nameTokens.includes(w) || p.descTokens.includes(w) || p.colorTokens.includes(w));

// Produits faits pour lui / elle / un enfant d'abord, puis ceux qui ne sont faits pour personne en particulier
// (rien n'est écrit sur le public visé) ; jamais ceux qui disent clairement être pour quelqu'un d'autre.
function forWho(list: CatalogProduct[], who: Who | undefined): CatalogProduct[] {
  if (!who) return list;
  const others = (Object.keys(WHO_PRODUCT_WORDS) as Who[]).filter((w) => w !== who);
  const mine = list.filter((p) => whoMatches(p, who));
  const neutral = list.filter((p) => !whoMatches(p, who) && !others.some((o) => whoMatches(p, o)));
  return [...mine, ...neutral];
}

// Les produits d'une catégorie pour quelqu'un : plus fortes remises d'abord.
const inCategoryFor = (catalog: CatalogProduct[], slug: string, who: Who | undefined) =>
  forWho(byDiscount(catalog.filter((p) => p.categorySlug === slug && sellable(p))), who);

// Un cadeau varié : un produit de chaque catégorie à tour de rôle (ou seulement la catégorie choisie).
export function giftPicks(catalog: CatalogProduct[], who: Who, range: Range = ANY_BUDGET, limit = 4, slug?: string): CatalogProduct[] {
  const slugs = slug ? [slug] : TYPE_SLUGS.gift[who];
  const lists = slugs.map((s) => inCategoryFor(catalog, s, who).filter((p) => p.price >= range.min && p.price <= range.max));
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();
  for (let round = 0; out.length < limit && round < 60; round++) {
    for (const list of lists) {
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
      return inCategoryFor(catalog, ctx.slug, ctx.who);
    case 'gift':
      return giftPicks(catalog, ctx.who, ANY_BUDGET, 60, ctx.slug);
    case 'who':
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

// « C'est cher » : des produits de la même sélection, au moins 10 % moins chers que le moins cher de ceux montrés.
export function cheaperOptions(catalog: CatalogProduct[], ctx: Context | null, shownPrices: number[], limit = 3): CatalogProduct[] {
  if (shownPrices.length === 0) return [];
  const ceiling = Math.min(...shownPrices) * 0.9;
  const pool = ctx ? candidatesFor(catalog, ctx) : promotions(catalog, 300);
  return pool.filter((p) => p.price < ceiling).slice(0, limit);
}

// Articles proches (même catégorie, en stock, prix voisin) quand un produit n'est plus disponible.
export function alternativesFor(catalog: CatalogProduct[], slug: string, limit = 3): CatalogProduct[] {
  const base = catalog.find((p) => p.slug === slug);
  if (!base) return [];
  return catalog
    .filter((p) => p.slug !== slug && p.categorySlug === base.categorySlug && sellable(p))
    .sort((a, b) => Math.abs(a.price - base.price) - Math.abs(b.price - base.price))
    .slice(0, limit);
}

// Les catégories à proposer à la question « quel genre d'article ? », avec leur nom dans la langue de Zara.
export function typeChoices(catalog: CatalogProduct[], who: Who | undefined, gift: boolean, lang: Lang = 'fr'): { slug: string; name: string }[] {
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const p of catalog) {
    if (!sellable(p) || !p.categorySlug) continue;
    names.set(p.categorySlug, p.category);
    counts.set(p.categorySlug, (counts.get(p.categorySlug) ?? 0) + 1);
  }
  const wanted = who ? TYPE_SLUGS[gift ? 'gift' : 'shop'][who] : ADVICE_ORDER;
  const slugs = wanted.filter((s) => counts.has(s));
  const fill = who ? [] : [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s).filter((s) => !slugs.includes(s));
  return [...slugs, ...fill].slice(0, 6).map((slug) => ({ slug, name: categoryLabel(lang, slug, names.get(slug) as string) }));
}

// ---------------------------------------------------------------------------------------------
// Produits qui se complètent
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

// Catégorie la plus présente parmi des produits.
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

export function crossSellTarget(catalog: CatalogProduct[], slug: string, lang: Lang = 'fr'): { slug: string; name: string } | null {
  for (const s of CROSS_SELL[slug] ?? []) {
    const hit = catalog.find((p) => p.categorySlug === s && sellable(p));
    if (hit) return { slug: s, name: categoryLabel(lang, s, hit.category) };
  }
  return null;
}

// Catégories proposées quand le visiteur demande conseil : les plus demandées d'abord.
const ADVICE_ORDER = ['parfum', 'chaussures', 'montre', 'vetements', 'vetements-pour-femmes', 'sacs-et-bagages', 'electrique'];

export function adviceCategories(catalog: CatalogProduct[], max = 6, lang: Lang = 'fr'): { slug: string; name: string }[] {
  return typeChoices(catalog, undefined, false, lang).slice(0, max);
}

// ---------------------------------------------------------------------------------------------
// Raisons vérifiées, rareté vraie et textes de vente
// ---------------------------------------------------------------------------------------------

const short = (text: string, n = 38) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

// Seulement si le stock est vraiment bas (1 à 5) : jamais de fausse rareté.
export function lowStockLine(products: CatalogProduct[], lang: Lang = 'fr'): string | null {
  const low = products.filter((p) => p.stock >= 1 && p.stock <= 5).sort((a, b) => a.stock - b.stock)[0];
  return low ? texts(lang).lowStock(short(low.name), low.stock) : null;
}

export function maxDiscountPct(catalog: CatalogProduct[]): number | null {
  const ds = catalog.filter(sellable).map(discount).filter((d) => d >= 0.05 && d <= 0.9);
  if (ds.length === 0) return null;
  return Math.round(Math.max(...ds) * 100);
}

// Pourquoi ce produit : au plus 3 raisons, toutes tirées du catalogue (remise, stock, budget, couleurs, tailles).
export function whyReasons(p: CatalogProduct, range: Range, lang: Lang = 'fr', cheapest = false): string[] {
  const w = texts(lang).why;
  const out: string[] = [];
  const pct = p.compareAt ? Math.round(discount(p) * 100) : 0;
  if (p.compareAt && pct >= 10) out.push(w.discount(pct, p.price, p.compareAt));
  if (p.stock >= 1 && p.stock <= 5) out.push(w.lowStock(p.stock));
  if ((range.min > 0 || Number.isFinite(range.max)) && p.price >= range.min && p.price <= range.max) out.push(w.budget);
  if (cheapest) out.push(w.cheapest);
  if (p.colors.length >= 2) out.push(w.colors(p.colors.slice(0, 3).join(', ')));
  if (p.sizes.length >= 2) out.push(w.sizes(p.sizes.slice(0, 5).join(', ')));
  if (out.length === 0) out.push(w.inStock);
  return out.slice(0, 3);
}

export const whyAdvice = (p: CatalogProduct, range: Range, lang: Lang = 'fr', cheapest = false) =>
  texts(lang).whyAdvice(short(p.name, 44), whyReasons(p, range, lang, cheapest));

// Quand le visiteur ouvre le chat sur la fiche d'un produit.
export function productPitch(p: CatalogProduct, lang: Lang = 'fr'): string {
  const pct = p.compareAt ? Math.round(discount(p) * 100) : 0;
  const price = p.compareAt && pct >= 5 ? (lang === 'ar' ? `${fcfa(p.price)} بدل ${fcfa(p.compareAt)} (-${pct} %)` : `${fcfa(p.price)} au lieu de ${fcfa(p.compareAt)} (-${pct} %)`) : fcfa(p.price);
  return texts(lang).pitch(short(p.name, 48), price, p.stock >= 1 && p.stock <= 5 ? p.stock : null);
}

export const cartReminder = (count: number, total: number, lang: Lang = 'fr') => texts(lang).cartReminder(count, total);
export const priceReply = (maxPct: number | null, lang: Lang = 'fr') => texts(lang).priceReply(maxPct);

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

export function trustReply(info: TrustInfo, lang: Lang = 'fr'): string {
  const where = [info.address, info.city].filter(Boolean).join(', ');
  return texts(lang).trust(where, formatPhone(info.phone));
}

export const laterReply = (lang: Lang = 'fr') => texts(lang).later;
export const aboutReply = (lang: Lang = 'fr') => texts(lang).about;
export const returnsReply = (lang: Lang = 'fr') => texts(lang).returns;

// Service emballage cadeau (2 000 FCFA par commande).
export const giftWrapReply = (lang: Lang = 'fr') => texts(lang).wrapReply;
export const giftWrapPitch = (lang: Lang = 'fr') => texts(lang).wrapPitch;
