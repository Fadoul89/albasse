// Sous-catégories : arbre, articles d'une catégorie, parents possibles, adresses, ordre. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/sub-categories.test.ts
import {
  canBeSub,
  canSetParent,
  categoryPath,
  familyIds,
  flattenTree,
  hasParentColumn,
  inFamily,
  isSub,
  mainCategories,
  moveInGroup,
  parentChoices,
  parentOf,
  productsInCategory,
  rootIdOf,
  rootOf,
  subCategoriesOf,
  uniqueSlug,
  type CatNode,
} from '../../src/lib/subCategories.ts';
import { buildHomeSections } from '../../src/lib/homeSections.ts';
import { slugify } from '../../src/lib/slugify.ts';
import { buildProduct, searchCatalog } from '../../src/lib/assistantBrain.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// Vêtements › Chemises et Costumes ; puis Chaussures, Montres, et Parfum (sans numéro d'ordre)
const cats: CatNode[] = [
  { id: 'vet', slug: 'vetements', name: 'Vêtements', sort_order: 1, parent_id: null },
  { id: 'chem', slug: 'chemises', name: 'Chemises', sort_order: 2, parent_id: 'vet' },
  { id: 'cost', slug: 'costumes', name: 'Costumes', sort_order: 3, parent_id: 'vet' },
  { id: 'chau', slug: 'chaussures', name: 'Chaussures', sort_order: 4, parent_id: null },
  { id: 'mont', slug: 'montres', name: 'Montres', sort_order: 5, parent_id: null },
  { id: 'parf', slug: 'parfum', name: 'Parfum', parent_id: null },
];
const ids = (list: { id: string }[]) => list.map((c) => c.id).join(',');

// --- l'arbre --------------------------------------------------------------------------------------------------------------------------------
check('catégories principales : Vêtements, Chaussures, Montres, Parfum (les sous-catégories n\'y sont pas)', ids(mainCategories(cats)) === 'vet,chau,mont,parf', ids(mainCategories(cats)));
check('sous-catégories de « Vêtements » : Chemises puis Costumes', ids(subCategoriesOf(cats, 'vet')) === 'chem,cost', ids(subCategoriesOf(cats, 'vet')));
check('« Chaussures » n\'a pas de sous-catégorie', subCategoriesOf(cats, 'chau').length === 0);
check('« Chemises » est une sous-catégorie, « Vêtements » non', isSub(cats, cats[1]) && !isSub(cats, cats[0]));
check('le parent de « Chemises » est « Vêtements »', parentOf(cats, cats[1])?.id === 'vet' && parentOf(cats, cats[0]) === null);
check('arbre à plat : chaque principale suivie de ses sous-catégories, avec leur niveau', flattenTree(cats).map((r) => `${r.category.id}${r.depth}`).join(',') === 'vet0,chem1,cost1,chau0,mont0,parf0', flattenTree(cats).map((r) => `${r.category.id}${r.depth}`).join(','));
check('chemin : « Vêtements › Chemises » et « Montres »', categoryPath(cats, 'chem') === 'Vêtements › Chemises' && categoryPath(cats, 'mont') === 'Montres' && categoryPath(cats, null) === '' && categoryPath(cats, 'zzz') === '');

// --- les sous-catégories comptent pour leur catégorie principale ---------------------------------------------------------------------------------
check('catégorie principale d\'une sous-catégorie = son parent', rootOf(cats, 'chem')?.id === 'vet' && rootIdOf(cats, 'cost') === 'vet');
check('catégorie principale d\'une catégorie principale = elle-même', rootIdOf(cats, 'mont') === 'mont');
check('identifiant inconnu ou vide : rien', rootOf(cats, 'zzz') === null && rootOf(cats, null) === null && rootOf(cats, undefined) === null && rootIdOf(cats, '') === null);
check('famille de « Vêtements » : elle et ses 2 sous-catégories ; famille de « Chemises » : seulement elle', familyIds(cats, 'vet').join() === 'vet,chem,cost' && familyIds(cats, 'chem').join() === 'chem' && familyIds(cats, 'mont').join() === 'mont');
check('un article rangé dans « Chemises » appartient à « Vêtements » et à « Chemises », pas à « Costumes »', inFamily(cats, 'chem', 'vet') && inFamily(cats, 'chem', 'chem') && !inFamily(cats, 'chem', 'cost') && !inFamily(cats, 'chem', 'mont'));
check('article sans catégorie : nulle part', !inFamily(cats, null, 'vet') && !inFamily(cats, undefined, 'vet'));

const prods = [
  { id: 'p1', category_id: 'vet' },
  { id: 'p2', category_id: 'chem' },
  { id: 'p3', category_id: 'cost' },
  { id: 'p4', category_id: 'chau' },
  { id: 'p5', category_id: null },
];
check('articles de « Vêtements » : les siens + ceux de ses sous-catégories', ids(productsInCategory(cats, prods, 'vet')) === 'p1,p2,p3');
check('articles de « Chemises » : seulement les siens', ids(productsInCategory(cats, prods, 'chem')) === 'p2');
check('articles de « Chaussures » : seulement les siens', ids(productsInCategory(cats, prods, 'chau')) === 'p4');

// --- avant le script SQL / cas tordus -----------------------------------------------------------------------------------------------------------
const flat = cats.map(({ parent_id: _p, ...c }) => c); // la base sans la colonne : aucune clé parent_id
check('sans la colonne parent_id : toutes les catégories sont principales (rien ne casse)', mainCategories(flat).length === 6 && flattenTree(flat).every((r) => r.depth === 0) && rootIdOf(flat, 'chem') === 'chem');
check('la colonne est reconnue seulement quand les lignes ont la clé parent_id (même vide)', hasParentColumn(cats) && !hasParentColumn(flat) && hasParentColumn([{ parent_id: null }]) && !hasParentColumn([]));
const orphan: CatNode[] = [...cats, { id: 'orph', slug: 'orph', name: 'Orpheline', parent_id: 'disparue' }];
check('parent introuvable : la catégorie reste principale', mainCategories(orphan).some((c) => c.id === 'orph') && rootIdOf(orphan, 'orph') === 'orph');
const deep: CatNode[] = [...cats, { id: 'deep', slug: 'deep', name: 'Trop profonde', parent_id: 'chem' }];
check('un seul niveau : l\'enfant d\'une sous-catégorie est traité comme principal', mainCategories(deep).some((c) => c.id === 'deep') && rootIdOf(deep, 'deep') === 'deep');
const self: CatNode[] = [{ id: 's', slug: 's', name: 'Elle-même', parent_id: 's' }];
check('une catégorie qui est son propre parent reste principale', mainCategories(self).length === 1 && rootIdOf(self, 's') === 's');

// --- qui peut avoir quel parent ---------------------------------------------------------------------------------------------------------------
check('parents possibles d\'une nouvelle catégorie : toutes les principales', ids(parentChoices(cats)) === 'vet,chau,mont,parf');
check('parents possibles de « Chaussures » : les autres principales (pas elle-même)', ids(parentChoices(cats, 'chau')) === 'vet,mont,parf');
check('« Vêtements » a des sous-catégories : elle reste principale (aucun parent possible)', ids(parentChoices(cats, 'vet')) === '' && !canBeSub(cats, 'vet'));
check('« Chaussures » peut devenir une sous-catégorie ; « Chemises » peut changer de parent', canBeSub(cats, 'chau') && ids(parentChoices(cats, 'chem')).includes('mont') && !ids(parentChoices(cats, 'chem')).includes('chem'));
check('parent accepté : une principale ; refusé : une sous-catégorie, elle-même, une catégorie qui a des sous-catégories', canSetParent(cats, 'chau', 'vet') && canSetParent(cats, 'chau', null) && !canSetParent(cats, 'chau', 'chem') && !canSetParent(cats, 'chau', 'chau') && !canSetParent(cats, 'vet', 'mont') && !canSetParent(cats, 'chau', 'inconnue'));

// --- adresses (slug) ---------------------------------------------------------------------------------------------------------------------------
check('adresse : accents et espaces', slugify('Vêtements pour Hommes !') === 'vetements-pour-hommes' && slugify('  Café  ') === 'cafe');
check('adresse libre : le nom seul', uniqueSlug('Ceintures', cats, null) === 'ceintures');
check('adresse déjà prise sous un autre parent : le parent est ajouté', uniqueSlug('Chemises', cats, cats[3]) === 'chaussures-chemises', uniqueSlug('Chemises', cats, cats[3]));
check('adresse prise aussi avec le parent : un numéro', uniqueSlug('Chemises', [...cats, { id: 'x', slug: 'chaussures-chemises', name: 'x' }], cats[3]) === 'chaussures-chemises-2');
check('renommer une catégorie en gardant son nom : son adresse reste la sienne', uniqueSlug('Chemises', cats, cats[0], 'chem') === 'chemises');
check('nom sans lettre : une adresse quand même', uniqueSlug('!!!', cats, null) === 'categorie');

// --- ordre : les flèches déplacent parmi les « frères » ---------------------------------------------------------------------------------------
const down = moveInGroup(cats, 'vet', 1);
check('▼ sur « Vêtements » : elle passe après « Chaussures », ses sous-catégories la suivent', ids(flattenTree(down).map((r) => r.category)) === 'chau,vet,chem,cost,mont,parf', ids(flattenTree(down).map((r) => r.category)));
check('numéros 1 à 6 dans l\'ordre de l\'arbre', down.map((c) => c.sort_order).join() === '1,2,3,4,5,6', down.map((c) => `${c.id}:${c.sort_order}`).join());
const subDown = moveInGroup(cats, 'chem', 1);
check('▼ sur « Chemises » : après « Costumes », toujours sous « Vêtements »', ids(flattenTree(subDown).map((r) => r.category)) === 'vet,cost,chem,chau,mont,parf' && parentOf(subDown, subDown.find((c) => c.id === 'chem') as CatNode)?.id === 'vet', ids(flattenTree(subDown).map((r) => r.category)));
check('▲ sur la première, ▼ sur la dernière : rien ne bouge (même liste)', moveInGroup(cats, 'vet', -1).every((c, i) => c === cats[i]) && moveInGroup(cats, 'parf', 1).every((c, i) => c === cats[i]) && moveInGroup(cats, 'chem', -1).every((c, i) => c === cats[i]) && moveInGroup(cats, 'cost', 1).every((c, i) => c === cats[i]));
check('identifiant inconnu : rien ne bouge', moveInGroup(cats, 'zzz', 1).every((c, i) => c === cats[i]));
check('une sous-catégorie ne saute pas chez un autre parent (« Costumes » ▲ puis ▲ reste sous « Vêtements »)', parentOf(moveInGroup(cats, 'cost', -1), moveInGroup(cats, 'cost', -1).find((c) => c.id === 'cost') as CatNode)?.id === 'vet');

// --- accueil : les articles des sous-catégories comptent dans la section de leur catégorie principale ----------------------------------------
type P = { id: string; category_id: string | null; is_active?: boolean; stock?: number | null };
const items: P[] = [
  { id: 'a', category_id: 'vet', stock: 3 },
  { id: 'b', category_id: 'chem', stock: 3 },
  { id: 'c', category_id: 'cost', stock: 0 },
  { id: 'd', category_id: 'chau', stock: 3 },
];
const rootFn = (id: string) => rootIdOf(cats, id);
const sections = buildHomeSections(mainCategories(cats), items, 4, rootFn);
check('accueil : 2 sections seulement (Vêtements, Chaussures) — les sous-catégories n\'ont pas leur section', sections.map((s) => s.category.id).join() === 'vet,chau', sections.map((s) => s.category.id).join());
check('section « Vêtements » : ses 3 articles (les siens + sous-catégories), l\'épuisé en dernier', sections[0].total === 3 && sections[0].items.map((p) => p.id).join() === 'a,b,c', sections[0].items.map((p) => p.id).join());
check('sans la fonction rootOf, l\'accueil marche comme avant (par catégorie exacte)', buildHomeSections(cats, items).map((s) => s.category.id).join() === 'vet,chem,cost,chau');

// --- Zara : l'article est rangé dans sa catégorie PRINCIPALE, la sous-catégorie sert à le retrouver ---------------------------------------------------
const raw = (id: string, name: string, sub: string | null) => ({ id, name, slug: id, price: 15000, compare_at_price: null, stock: 4, category: 'Vêtements', category_slug: 'vetements', sub_category: sub, colors: [], description: null, image: null, created_at: '2026-10-01T00:00:00Z' });
const zPlain = buildProduct(raw('z1', 'Veste noire', null));
const zSub = buildProduct(raw('z2', 'Veste bleue', 'Chemises'));
check('Zara : un article d\'une sous-catégorie garde la catégorie principale (« Vêtements », adresse « vetements »)', zSub.category === 'Vêtements' && zSub.categorySlug === 'vetements');
check('Zara : le nom de la sous-catégorie sert à le trouver, pas pour un article sans sous-catégorie', zSub.catTokens.some((t) => t.startsWith('chemise')) && !zPlain.catTokens.some((t) => t.startsWith('chemise')), [zSub.catTokens, zPlain.catTokens]);
check('Zara : la recherche « chemises » trouve l\'article rangé dans la sous-catégorie « Chemises »', searchCatalog([zPlain, zSub], 'chemises').some((p) => p.id === 'z2'));

console.log(`\n${ok} contrôles réussis`);
