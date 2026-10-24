// Ordre des catégories choisi par l'admin (colonne sort_order, flèches ▲ ▼ sur la page « Catégories ») : 1 = la première.
// Sans numéro (nouvelle catégorie, ou script add-category-order.sql pas encore lancé) : après, par ordre alphabétique.
// Le tri se fait ici et non dans la requête, pour que le site marche aussi avant le script.
type Sortable = { name: string; sort_order?: number | null };

const rank = (c: Sortable) => (typeof c.sort_order === 'number' ? c.sort_order : Number.POSITIVE_INFINITY);

export function sortCategories<T extends Sortable>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });
}

// Monte (-1) ou descend (+1) une catégorie ; tout le monde reçoit son numéro 1, 2, 3… Même liste si rien ne bouge.
export function moveCategory<T extends Sortable>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((c, i) => (c.sort_order === i + 1 ? c : { ...c, sort_order: i + 1 }));
}

// Les numéros à écrire dans la base : seulement ceux qui ont changé.
export function orderUpdates<T extends Sortable & { id: string }>(before: T[], after: T[]): { id: string; sort_order: number }[] {
  const old = new Map(before.map((c) => [c.id, c.sort_order ?? null]));
  return after
    .filter((c) => typeof c.sort_order === 'number' && old.get(c.id) !== c.sort_order)
    .map((c) => ({ id: c.id, sort_order: c.sort_order as number }));
}
