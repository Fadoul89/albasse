// Accueil : 4 articles par catégorie, le reste dans la catégorie. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/home-sections.test.ts
import { HOME_PER_CATEGORY, articleCount, buildHomeSections, moreLabel } from '../../src/lib/homeSections.ts';

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

const cats = [
  { id: 'c1', slug: 'costumes' },
  { id: 'c2', slug: 'chemises' },
  { id: 'c3', slug: 'montres' },
  { id: 'c4', slug: 'vide' },
];
type P = { id: string; category_id: string | null; is_active?: boolean; stock?: number | null };
const mk = (n: number, category_id: string | null, extra: Partial<P> = {}): P => ({ id: `p${n}`, category_id, stock: 5, is_active: true, ...extra });
const ids = (list: P[]) => list.map((p) => p.id).join(',');

check('le patron veut 4 articles par catégorie', HOME_PER_CATEGORY === 4);

// 10 costumes, 3 chemises, 4 montres
const costumes = Array.from({ length: 10 }, (_, i) => mk(i + 1, 'c1'));
const chemises = Array.from({ length: 3 }, (_, i) => mk(20 + i, 'c2'));
const montres = Array.from({ length: 4 }, (_, i) => mk(30 + i, 'c3'));
const all = [...chemises, ...costumes, ...montres]; // mélangés : seul l'ordre des catégories compte
const s = buildHomeSections(cats, all);

check('une section par catégorie qui a des articles, dans l\'ordre des catégories (celui de l\'admin) ; la catégorie vide n\'a pas de section', s.map((x) => x.category.slug).join() === 'costumes,chemises,montres', s.map((x) => x.category.slug));
const [sc, sh, sm] = s;
check('10 costumes : 4 montrés (les 4 premiers reçus), total 10, il en reste 6', ids(sc.items) === 'p1,p2,p3,p4' && sc.total === 10 && sc.rest === 6, sc);
check('3 chemises : les 3 sont montrées, il n\'en reste aucun', ids(sh.items) === 'p20,p21,p22' && sh.total === 3 && sh.rest === 0, sh);
check('4 montres : exactement 4 montrées, il n\'en reste aucun (pas de bouton inutile)', ids(sm.items) === 'p30,p31,p32,p33' && sm.rest === 0, sm);
check('jamais plus de 4 articles par section', s.every((x) => x.items.length <= 4));
check('aucun article en double sur l\'accueil', new Set(s.flatMap((x) => x.items.map((p) => p.id))).size === s.reduce((n, x) => n + x.items.length, 0));
check('chaque article montré est bien de sa catégorie', s.every((x) => x.items.every((p) => p.category_id === x.category.id)));
check('montrés + restants = tous les articles de la catégorie', s.every((x) => x.items.length + x.rest === x.total));

// articles retirés de la vente
const hidden = buildHomeSections(cats, [mk(1, 'c1', { is_active: false }), mk(2, 'c1'), mk(3, 'c2', { is_active: false })]);
check('un article retiré de la vente ne compte pas et ne s\'affiche pas ; une catégorie où tout est retiré n\'a plus de section', hidden.length === 1 && hidden[0].category.slug === 'costumes' && ids(hidden[0].items) === 'p2' && hidden[0].total === 1, hidden);

// stock : les épuisés ne prennent pas les places de l'accueil
const mixed = [mk(1, 'c1', { stock: 0 }), mk(2, 'c1', { stock: 0 }), mk(3, 'c1'), mk(4, 'c1'), mk(5, 'c1'), mk(6, 'c1'), mk(7, 'c1'), mk(8, 'c1', { stock: 0 })];
const m = buildHomeSections(cats, mixed)[0];
check('les articles en stock passent d\'abord, dans l\'ordre reçu : p3 p4 p5 p6 (les épuisés p1 p2 ne prennent pas les places)', ids(m.items) === 'p3,p4,p5,p6' && m.total === 8 && m.rest === 4, m);
const few = buildHomeSections(cats, [mk(1, 'c1', { stock: 0 }), mk(2, 'c1'), mk(3, 'c1', { stock: 0 })])[0];
check('quand il y a peu d\'articles, les épuisés suivent les articles en stock (rien n\'est caché)', ids(few.items) === 'p2,p1,p3' && few.rest === 0, few);
const noStock = buildHomeSections(cats, [{ id: 'a', category_id: 'c1' }, { id: 'b', category_id: 'c1', stock: null }])[0];
check('stock inconnu = en stock', ids(noStock.items) === 'a,b', noStock);

// cas limites
check('aucun article : aucune section', buildHomeSections(cats, []).length === 0);
check('aucune catégorie : aucune section', buildHomeSections([], all).length === 0);
const orphan = buildHomeSections(cats, [mk(1, 'inconnue'), mk(2, null), mk(3, 'c2')]);
check('un article d\'une catégorie inconnue ou sans catégorie n\'est pas montré par section (le bouton « Voir tous les articles » le garde accessible)', orphan.length === 1 && ids(orphan[0].items) === 'p3', orphan);
const before = JSON.stringify(all);
buildHomeSections(cats, all);
check('la liste reçue n\'est pas modifiée', JSON.stringify(all) === before);
check('autre nombre par catégorie possible (2)', buildHomeSections(cats, costumes, 2)[0].items.length === 2 && buildHomeSections(cats, costumes, 2)[0].rest === 8);
check('un nombre absurde (0, négatif) ne casse rien', buildHomeSections(cats, costumes, 0)[0].items.length === 0 && buildHomeSections(cats, costumes, -3)[0].rest === 10);

// textes
check('« 1 article », « 2 articles », « 12 articles »', articleCount(1) === '1 article' && articleCount(2) === '2 articles' && articleCount(12) === '12 articles');
check('bouton : « Voir l’autre article » quand il en reste 1', moreLabel(1) === 'Voir l’autre article');
check('bouton : « Voir les 6 autres articles » quand il en reste 6', moreLabel(6) === 'Voir les 6 autres articles');

console.log(`\n${ok} contrôles réussis`);
