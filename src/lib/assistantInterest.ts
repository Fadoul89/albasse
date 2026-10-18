// Suggestions discrètes de Zara d'après les articles regardés : quoi dire, quels boutons, quels produits montrer.
// Tout vient du catalogue RÉEL (prix, stock, tailles, couleurs) : Zara n'invente ni produit, ni famille de parfum, ni stock.
// Aucun écran, aucun réseau : tout est testable.

import type { CatalogProduct } from './assistantBrain';
import type { Lang } from './assistantLang';
import { texts } from './assistantText';
import { productTypeOf, type ProductRecord, type Suggestion } from './browsingInsights';

export type FragranceFamily = 'fresh' | 'woody' | 'sweet' | 'intense';
export const FAMILIES: FragranceFamily[] = ['fresh', 'woody', 'sweet', 'intense'];

// Un parfum n'est rangé dans une famille que si sa fiche (nom ou description) le DIT avec ces mots. Aucune déduction.
// Les mots sont écrits comme dans le catalogue : sans accent, sans « s » final (c'est ce que fait la découpe en mots).
const FAMILY_WORDS: Record<FragranceFamily, string[]> = {
  fresh: ['frais', 'fraiche', 'fraicheur', 'agrume', 'citron', 'bergamote', 'marin', 'aquatique', 'menthe', 'fresh', 'aqua', 'ocean', 'glace'],
  woody: ['bois', 'boise', 'boisee', 'cedre', 'santal', 'vetiver', 'oud', 'agar', 'wood', 'woody'],
  sweet: ['sucre', 'sucree', 'vanille', 'caramel', 'gourmand', 'miel', 'chocolat', 'praline', 'sweet'],
  intense: ['intense', 'intens', 'puissant', 'puissante', 'absolu', 'absolue', 'elixir', 'extreme', 'concentre', 'concentree'],
};

export const isFamily = (value: string | undefined | null): value is FragranceFamily => !!value && (FAMILIES as string[]).includes(value);

export function matchesFamily(p: CatalogProduct, family: FragranceFamily): boolean {
  const tokens = [...p.nameTokens, ...p.descTokens];
  return FAMILY_WORDS[family].some((w) => tokens.includes(w));
}

const sellable = (p: CatalogProduct) => p.price > 0 && p.stock > 0;
const typeOf = (p: CatalogProduct) => productTypeOf(p.name, p.categorySlug, p.category);

export function perfumesInStock(catalog: CatalogProduct[]): CatalogProduct[] {
  return catalog.filter((p) => sellable(p) && typeOf(p) === 'perfume').sort((a, b) => b.createdAt - a.createdAt);
}

// Les parfums dont la fiche annonce cette famille (vide si aucune fiche ne le dit : Zara le dit honnêtement).
export function familyPicks(catalog: CatalogProduct[], family: FragranceFamily, limit = 4): CatalogProduct[] {
  return perfumesInStock(catalog).filter((p) => matchesFamily(p, family)).slice(0, limit);
}

// Des articles de la même catégorie, en stock, les plus proches en prix d'abord.
export function similarProducts(catalog: CatalogProduct[], base: CatalogProduct, limit = 4): CatalogProduct[] {
  return catalog
    .filter((p) => sellable(p) && p.id !== base.id && p.categorySlug === base.categorySlug)
    .sort((a, b) => Math.abs(a.price - base.price) - Math.abs(b.price - base.price) || b.createdAt - a.createdAt)
    .slice(0, limit);
}

// D'autres articles de la catégorie, en stock, que le client n'a pas encore regardés.
export function moreInCategory(catalog: CatalogProduct[], categoryKey: string, seenIds: string[], limit = 4): CatalogProduct[] {
  const seen = new Set(seenIds);
  return catalog
    .filter((p) => sellable(p) && p.categorySlug === categoryKey && !seen.has(p.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// Ce que la boutique peut vraiment proposer : sert à choisir une suggestion qui a un sens aujourd'hui.
export function availability(catalog: CatalogProduct[]) {
  return {
    available: (productId: string) => catalog.some((p) => p.id === productId && sellable(p)),
    categoryHasMore: (categoryKey: string, seenIds: string[]) => moreInCategory(catalog, categoryKey, seenIds, 1).length > 0,
  };
}

// --- le message et ses boutons -----------------------------------------------------------------

export type InterestOp = 'sizes' | 'colors' | 'similar' | 'family' | 'more' | 'no';

export interface PlannedChip {
  label: string;
  op: InterestOp;
  arg: string; // identifiant du produit, de la catégorie, ou famille de parfum
}

export interface SuggestionPlan {
  text: string;
  chips: PlannedChip[];
}

// Un seul message, et seulement si la boutique peut y donner suite (article en stock, d'autres articles à montrer).
export function planSuggestion(s: Suggestion, catalog: CatalogProduct[], lang: Lang): SuggestionPlan | null {
  const t = texts(lang).interest;
  const no: PlannedChip = { label: t.chip.noThanks, op: 'no', arg: '' };
  if (s.kind === 'perfume_browse') {
    if (perfumesInStock(catalog).length === 0) return null;
    return { text: t.perfumeBrowse, chips: [...FAMILIES.map((f): PlannedChip => ({ label: t.chip.family[f], op: 'family', arg: f })), no] };
  }
  if (s.kind === 'category_browse') {
    if (!s.categoryKey) return null;
    return { text: t.category, chips: [{ label: t.chip.more, op: 'more', arg: s.categoryKey }, no] };
  }
  const product = catalog.find((p) => p.id === s.productId);
  if (!product || !sellable(product)) return null;
  const similar: PlannedChip = { label: s.type === 'perfume' ? t.chip.similarPerfume : t.chip.similar, op: 'similar', arg: product.id };
  if (s.type === 'perfume') return { text: t.perfumeOne, chips: [similar, no] };
  const hasSizes = product.sizes.length > 0;
  const hasColors = product.colors.length > 0;
  if (s.type === 'shoes') return { text: t.shoes, chips: [...(hasSizes ? [{ label: t.chip.sizes, op: 'sizes' as const, arg: product.id }] : []), similar, no] };
  const details: PlannedChip[] = hasSizes || hasColors ? [{ label: t.chip.colors, op: 'colors', arg: product.id }] : [];
  if (s.type === 'clothing') return { text: t.clothing, chips: [...details, similar, no] };
  return { text: t.other, chips: [...details, similar, no] };
}

// --- « qu'est-ce que j'ai regardé ? » -----------------------------------------------------------

// Les produits du profil qui existent encore dans le catalogue (un article supprimé n'est pas montré).
export function inCatalog(records: ProductRecord[], catalog: CatalogProduct[]): { record: ProductRecord; product: CatalogProduct }[] {
  const out: { record: ProductRecord; product: CatalogProduct }[] = [];
  for (const record of records) {
    const product = catalog.find((p) => p.id === record.id);
    if (product) out.push({ record, product });
  }
  return out;
}
