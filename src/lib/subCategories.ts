// Sous-catégories (demande du patron, 5 novembre 2026) : une sous-catégorie est une catégorie qui a un « parent » (colonne parent_id, script
// add-subcategories.sql). UN SEUL niveau : « Vêtements » › « Chemises » ; une sous-catégorie n'a pas de sous-catégorie.
// Les articles gardent UNE catégorie (category_id), qui peut être une catégorie principale ou une sous-catégorie.
// Règle de base : tout ce qui regarde « la catégorie » d'un article en dehors de la page administrateur et de la page de la catégorie
// (accueil, Zara, annonces, suivi de navigation) se compte avec la catégorie PRINCIPALE : rootOf(). Les articles d'une sous-catégorie
// comptent donc aussi pour sa catégorie principale, et rien ne casse avant le script SQL (sans parent_id, toutes les catégories sont principales).
// Des fonctions pures, sans réseau : testées dans tests/email/sub-categories.test.ts.
import { sortCategories } from './categoryOrder';
import { slugify } from './slugify';

export interface CatNode {
  id: string;
  slug: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number | null;
}

// La colonne existe dans la base seulement quand le script SQL a été lancé : les catégories lues portent alors la clé « parent_id » (vide ou non).
export const hasParentColumn = (categories: readonly object[]): boolean => categories.some((c) => 'parent_id' in c);

const byId = <T extends CatNode>(categories: readonly T[]): Map<string, T> => new Map(categories.map((c) => [c.id, c]));

// Le parent d'une catégorie : seulement s'il existe ET s'il est lui-même principal (un seul niveau ; un parent introuvable = catégorie principale).
export function parentOf<T extends CatNode>(categories: readonly T[], category: T): T | null {
  if (!category.parent_id || category.parent_id === category.id) return null;
  const parent = byId(categories).get(category.parent_id);
  if (!parent || parent.parent_id) return null;
  return parent;
}

export const isSub = <T extends CatNode>(categories: readonly T[], category: T): boolean => parentOf(categories, category) !== null;

// Les catégories principales, dans l'ordre choisi par l'administrateur
export function mainCategories<T extends CatNode>(categories: readonly T[]): T[] {
  return sortCategories(categories.filter((c) => !isSub(categories, c)));
}

// Les sous-catégories d'une catégorie principale, dans l'ordre choisi
export function subCategoriesOf<T extends CatNode>(categories: readonly T[], id: string): T[] {
  return sortCategories(categories.filter((c) => c.id !== id && parentOf(categories, c)?.id === id));
}

export interface CategoryRow<T> {
  category: T;
  depth: 0 | 1;
}

// La liste en arbre : chaque catégorie principale suivie de ses sous-catégories (l'ordre de la page administrateur)
export function flattenTree<T extends CatNode>(categories: readonly T[]): CategoryRow<T>[] {
  const rows: CategoryRow<T>[] = [];
  for (const main of mainCategories(categories)) {
    rows.push({ category: main, depth: 0 });
    for (const sub of subCategoriesOf(categories, main.id)) rows.push({ category: sub, depth: 1 });
  }
  return rows;
}

// La catégorie principale d'une catégorie : elle-même, ou son parent. null si l'identifiant n'existe pas.
export function rootOf<T extends CatNode>(categories: readonly T[], id: string | null | undefined): T | null {
  if (!id) return null;
  const category = byId(categories).get(id);
  if (!category) return null;
  return parentOf(categories, category) ?? category;
}

export const rootIdOf = <T extends CatNode>(categories: readonly T[], id: string | null | undefined): string | null => rootOf(categories, id)?.id ?? null;

// Les identifiants d'une catégorie et de ses sous-catégories (une sous-catégorie : seulement elle)
export function familyIds<T extends CatNode>(categories: readonly T[], id: string): string[] {
  const category = byId(categories).get(id);
  if (!category) return [id];
  if (isSub(categories, category)) return [id];
  return [id, ...subCategoriesOf(categories, id).map((c) => c.id)];
}

// L'article (rangé dans productCategoryId) appartient-il à cette catégorie, sous-catégories comprises ?
export function inFamily<T extends CatNode>(categories: readonly T[], productCategoryId: string | null | undefined, categoryId: string): boolean {
  if (!productCategoryId) return false;
  return familyIds(categories, categoryId).includes(productCategoryId);
}

// Les articles d'une catégorie : les siens et ceux de ses sous-catégories
export function productsInCategory<T extends CatNode, P extends { category_id: string | null }>(categories: readonly T[], products: readonly P[], categoryId: string): P[] {
  const ids = new Set(familyIds(categories, categoryId));
  return products.filter((p) => !!p.category_id && ids.has(p.category_id));
}

// « Vêtements › Chemises » (ou « Vêtements » pour une catégorie principale)
export function categoryPath<T extends CatNode>(categories: readonly T[], id: string | null | undefined): string {
  if (!id) return '';
  const category = byId(categories).get(id);
  if (!category) return '';
  const parent = parentOf(categories, category);
  return parent ? `${parent.name} › ${category.name}` : category.name;
}

// ---------------------------------------------------------------------------------------------
// Page administrateur : qui peut avoir quel parent
// ---------------------------------------------------------------------------------------------

// Une catégorie qui a déjà des sous-catégories reste principale (un seul niveau)
export const canBeSub = <T extends CatNode>(categories: readonly T[], id: string): boolean => subCategoriesOf(categories, id).length === 0;

// Les parents possibles pour une catégorie (en création : id absent) : les catégories principales, sauf elle-même ; aucun si elle a des sous-catégories
export function parentChoices<T extends CatNode>(categories: readonly T[], editingId?: string | null): T[] {
  if (editingId && !canBeSub(categories, editingId)) return [];
  return mainCategories(categories).filter((c) => c.id !== editingId);
}

export function canSetParent<T extends CatNode>(categories: readonly T[], id: string | null, parentId: string | null): boolean {
  if (!parentId) return true;
  return parentChoices(categories, id).some((c) => c.id === parentId);
}

// ---------------------------------------------------------------------------------------------
// Adresse (slug) : unique, même quand deux catégories principales ont une sous-catégorie du même nom (« Chemises »)
// ---------------------------------------------------------------------------------------------

export function uniqueSlug<T extends CatNode>(name: string, categories: readonly T[], parent: T | null, ignoreId?: string | null): string {
  const taken = new Set(categories.filter((c) => c.id !== ignoreId).map((c) => c.slug));
  const base = slugify(name) || 'categorie';
  if (!taken.has(base)) return base;
  const withParent = parent ? `${parent.slug}-${base}` : base;
  if (!taken.has(withParent)) return withParent;
  for (let n = 2; n < 1000; n++) if (!taken.has(`${withParent}-${n}`)) return `${withParent}-${n}`;
  return `${withParent}-${Date.now()}`;
}

// ---------------------------------------------------------------------------------------------
// Ordre : les flèches ▲ ▼ déplacent une catégorie parmi ses « frères » (même parent) ; tout le monde reçoit son numéro 1, 2, 3… dans l'ordre de l'arbre
// ---------------------------------------------------------------------------------------------

export function moveInGroup<T extends CatNode>(categories: readonly T[], id: string, delta: -1 | 1): T[] {
  const list = [...categories];
  const category = byId(list).get(id);
  if (!category) return list;
  const parent = parentOf(list, category);
  const siblings = parent ? subCategoriesOf(list, parent.id) : mainCategories(list);
  const index = siblings.findIndex((c) => c.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= siblings.length) return list;
  const order = siblings.map((c) => c.id);
  [order[index], order[target]] = [order[target], order[index]];
  const rank = new Map(order.map((cid, i) => [cid, i]));
  const byRank = (a: T, b: T) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
  const mains = parent ? mainCategories(list) : mainCategories(list).sort(byRank);
  const flat: T[] = [];
  for (const main of mains) {
    flat.push(main);
    const subs = subCategoriesOf(list, main.id);
    flat.push(...(parent && main.id === parent.id ? [...subs].sort(byRank) : subs));
  }
  return flat.map((c, i) => (c.sort_order === i + 1 ? c : { ...c, sort_order: i + 1 }));
}
