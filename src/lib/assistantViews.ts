// Zara + psychologie de la vente (demande du patron, 16 novembre 2026) : les VRAIES visites des 30 derniers jours.
//   Effet de mode : « 👀 Les plus regardés » (les articles en stock que le plus de personnes ont regardés).
//   Preuve sociale : « 👀 Vu par 1 843 personnes (30 j) » sur la fiche de l'article dans le chat.
// Les chiffres viennent de la fonction de la base `assistant_product_views` (add-zara-most-viewed.sql) : des totaux, jamais un client.
// Rien n'est inventé : en dessous de MIN_VIEWS_PROOF personnes, ou sans la fonction de la base, Zara ne dit AUCUN chiffre.
// Zara dit « regardé », jamais « acheté » (au 16 novembre 2026, il y a très peu de commandes : les achats ne prouvent encore rien).

export const VIEWS_WINDOW_DAYS = 30;
// En dessous de 50 personnes, un chiffre ne rassure pas : Zara ne le dit pas.
export const MIN_VIEWS_PROOF = 50;
// « Les plus regardés » : 4 articles au plus (comme les autres listes de Zara : trop de choix fait hésiter).
export const MOST_VIEWED_MAX = 4;

export type ViewsMap = Map<string, number>;

// La réponse de la base : une ligne par article { product_id, visitors }. Tout ce qui est douteux est ignoré.
export function buildViewsMap(rows: unknown): ViewsMap {
  const map: ViewsMap = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const id = row && typeof (row as { product_id?: unknown }).product_id === 'string' ? (row as { product_id: string }).product_id : null;
    const n = Number((row as { visitors?: unknown } | null)?.visitors);
    if (id && Number.isInteger(n) && n > 0) map.set(id, n);
  }
  return map;
}

// Le nombre de personnes à annoncer pour cet article, ou 0 s'il n'y a rien de solide à dire.
export function provenViews(map: ViewsMap | null | undefined, productId: string | null | undefined): number {
  if (!productId || !(map instanceof Map)) return 0;
  const n = map.get(productId) ?? 0;
  return n >= MIN_VIEWS_PROOF ? n : 0;
}

// Les articles les plus regardés, seulement ceux qu'on peut vraiment vendre (en stock, avec un prix) et avec un chiffre solide.
export function mostViewed<T extends { id: string; stock: number; price: number }>(catalog: T[], map: ViewsMap | null | undefined, limit = MOST_VIEWED_MAX): T[] {
  return catalog
    .filter((p) => p.stock > 0 && p.price > 0 && provenViews(map, p.id) > 0)
    .sort((a, b) => provenViews(map, b.id) - provenViews(map, a.id))
    .slice(0, Math.max(0, limit));
}

// Aversion à la perte : ce que le client économise vraiment (l'ancien prix écrit par l'équipe moins le prix d'aujourd'hui), sinon 0.
export function savedAmount(price: number, oldPrice: number | null | undefined): number {
  if (!Number.isFinite(price) || price <= 0 || typeof oldPrice !== 'number' || !Number.isFinite(oldPrice) || oldPrice <= price) return 0;
  return Math.round(oldPrice - price);
}
