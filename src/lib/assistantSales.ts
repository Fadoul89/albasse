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
