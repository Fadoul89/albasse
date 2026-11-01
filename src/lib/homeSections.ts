// Accueil : 4 articles par catégorie, le reste reste dans la catégorie (demande du patron).
// Avant, l'accueil affichait TOUS les articles dans une seule grille (« Toute la collection »). Maintenant : une section par catégorie,
// dans l'ordre choisi par l'administrateur, avec ses 4 premiers articles et un bouton « Voir les N autres articles ».
// Des fonctions pures, sans réseau : testées dans tests/email/home-sections.test.ts.

export const HOME_PER_CATEGORY = 4;

interface WithId {
  id: string;
}
interface WithCategory {
  category_id: string | null;
  is_active?: boolean;
  stock?: number | null;
}

export interface HomeSection<C, P> {
  category: C;
  items: P[]; // les articles montrés sur l'accueil (4 au plus)
  total: number; // tous les articles en vente de la catégorie
  rest: number; // ceux qui restent dans la catégorie (total - montrés)
}

// Les articles en stock passent avant ceux qui sont épuisés (sinon un « épuisé » prend une des 4 places de l'accueil) ;
// à l'intérieur, l'ordre reçu est gardé (le plus récent d'abord, comme le site les lit).
const inStock = (p: WithCategory): boolean => p.stock === undefined || p.stock === null || p.stock > 0;

// Une section par catégorie qui a au moins un article en vente, dans l'ordre reçu (celui de l'admin). Les articles retirés de la vente
// (is_active = false) ne comptent pas ; une catégorie vide n'a pas de section.
export function buildHomeSections<C extends WithId, P extends WithCategory>(categories: C[], products: P[], perCategory: number = HOME_PER_CATEGORY): HomeSection<C, P>[] {
  const limit = Math.max(0, Math.floor(perCategory));
  const byCategory = new Map<string, P[]>();
  for (const p of products) {
    if (p.is_active === false || !p.category_id) continue;
    const list = byCategory.get(p.category_id);
    if (list) list.push(p);
    else byCategory.set(p.category_id, [p]);
  }
  const sections: HomeSection<C, P>[] = [];
  for (const category of categories) {
    const all = byCategory.get(category.id);
    if (!all || all.length === 0) continue;
    const ordered = [...all.filter(inStock), ...all.filter((p) => !inStock(p))];
    const items = ordered.slice(0, limit);
    sections.push({ category, items, total: all.length, rest: all.length - items.length });
  }
  return sections;
}

// « 1 article », « 12 articles »
export const articleCount = (n: number): string => `${n} article${n > 1 ? 's' : ''}`;

// Le bouton sous les 4 articles : « Voir l’autre article » (il en reste 1), « Voir les 8 autres articles »
export const moreLabel = (rest: number): string => (rest === 1 ? 'Voir l’autre article' : `Voir les ${rest} autres articles`);
