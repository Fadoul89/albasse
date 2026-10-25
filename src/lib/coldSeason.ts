// Marketing « saison fraîche » : blousons et manteaux mis en avant jusqu'à la fin décembre (accueil du site, menu et réponses de Zara).
// Des fonctions pures, sans réseau ni base : testées dans tests/email/cold-season.test.ts.
// Règles d'honnêteté : seuls les VRAIS articles de la boutique sont montrés (actifs, en stock, avec photo) ; aucune remise, aucune urgence ni
// aucune date limite d'offre n'est annoncée (la période est celle de la mise en avant, pas celle des prix) ; un « porte-manteau » n'est pas un manteau.

// Dernier jour de la mise en avant, heure de N'Djamena (UTC+1, sans heure d'été). Pour la prolonger, changer ces deux dates.
export const COLD_SEASON_START = '2026-10-01';
export const COLD_SEASON_END = '2026-12-31';

const NDJAMENA_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

// vrai du premier jour (00h00 à N'Djamena) au dernier jour (23h59) inclus
export function coldSeasonActive(now: number = Date.now()): boolean {
  const start = Date.parse(`${COLD_SEASON_START}T00:00:00Z`) - NDJAMENA_OFFSET_MS;
  const end = Date.parse(`${COLD_SEASON_END}T00:00:00Z`) + DAY_MS - NDJAMENA_OFFSET_MS;
  return now >= start && now < end;
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f]/g, '') // accents français et voyelles brèves arabes
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .toLowerCase();

// ce qui désigne un vêtement chaud (français et arabe)
const COAT = /\b(blousons?|manteaux?|vestes?|doudounes?|parkas?|perfectos?|coupe[- ]?vents?|pardessus|trenchs?)\b|جاكيت|معطف|معاطف|بالطو|ستره|سترات/; // (le texte est « plié » avant : ة devient ه)
// ce qui y ressemble mais n'en est pas un : le meuble ou l'accessoire (« porte-manteau », « cintre »)
const NOT_COAT = /porte[- ]?manteaux?|cintres?|housses?|علاقه|شماعه/;
// un mot du froid (le client ne cite pas l'article mais dit ce qu'il cherche)
// (pas « frais » : « frais de livraison » est une autre question)
const COLD_WORD = /\b(froid|hiver|harmattan)\b|برد|شتاء|الشتاء|دفء/;

// le nom d'un article est-il un blouson ou un manteau ?
export function isColdSeasonName(name: string): boolean {
  const f = fold(name);
  return COAT.test(f) && !NOT_COAT.test(f);
}

// le client demande-t-il des blousons ou des manteaux (ou parle-t-il du froid) ? Un porte-manteau demandé est une autre recherche.
export function wantsColdSeason(text: string): boolean {
  const f = fold(text);
  if (NOT_COAT.test(f)) return false;
  return COAT.test(f) || COLD_WORD.test(f);
}

export interface ColdView {
  name: string;
  price: number;
  compareAt: number | null;
  stock: number;
  hasImage: boolean;
}

// remise réelle (ancien prix barré supérieur au prix) en pourcentage entier ; 0 s'il n'y en a pas
export function realDiscountPct(v: Pick<ColdView, 'price' | 'compareAt'>): number {
  return v.compareAt !== null && v.compareAt > v.price && v.price > 0 ? Math.round((1 - v.price / v.compareAt) * 100) : 0;
}

// Les blousons et manteaux à montrer : en vente, en stock, avec une photo ; ceux qui ont la plus grande remise réelle d'abord, puis le plus de stock.
export function coldSeasonPicks<T>(items: T[], view: (item: T) => ColdView, limit = 4): T[] {
  return items
    .map((item) => ({ item, v: view(item) }))
    .filter(({ v }) => v.price > 0 && v.stock > 0 && v.hasImage && isColdSeasonName(v.name))
    .sort((a, b) => realDiscountPct(b.v) - realDiscountPct(a.v) || b.v.stock - a.v.stock || a.v.name.localeCompare(b.v.name))
    .slice(0, limit)
    .map(({ item }) => item);
}

// ce que Zara peut dire des articles montrés, calculé sur eux : combien, à partir de quel prix, jusqu'à quelle remise réelle (5 % au moins)
export function coldSeasonFacts<T>(picks: T[], view: (item: T) => ColdView): { count: number; minPrice: number; maxPct: number | null } {
  const views = picks.map(view);
  const pct = Math.max(0, ...views.map(realDiscountPct));
  return { count: views.length, minPrice: Math.min(...views.map((v) => v.price)), maxPct: pct >= 5 ? pct : null };
}
