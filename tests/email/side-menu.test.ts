// Menu ☰ de l'accueil : le profil du client avec ses points, puis les catégories une à une (src/lib/sideMenu.ts).
import { MENU_TEXT, menuActive, menuCategories, menuHighlight, menuProfile, menuSubs, pointsLabel } from '../../src/lib/sideMenu.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

// --- le profil ---------------------------------------------------------------------------------------------------------------------------------
check('visiteur sans compte : pas de profil', menuProfile(null) === null && menuProfile(undefined) === null);
const base = { full_name: 'Abdelmoumine hissein', email: 'a@b.td', avatar_url: null, client_number: 883, loyalty_points: 27 };
const p = menuProfile(base)!;
check('nom, initiale et numéro client (AS-000883)', p.name === 'Abdelmoumine hissein' && p.initial === 'A' && p.clientNumber === 'AS-000883', p);
check('27 points : palier Argent 🥈, 27 pts', p.points === 27 && p.tierLabel === 'Argent' && p.tierIcon === '🥈' && pointsLabel(p.points) === '27 pts');
check('barre vers le prochain palier (Or à 50) : (27-25)/(50-25)', Math.abs(p.progress - 2 / 25) < 1e-9, p.progress);
check('« 23 pts avant le palier 🥇 Or »', p.hint === '23 pts avant le palier 🥇 Or', p.hint);
const zero = menuProfile({ ...base, loyalty_points: 0 })!;
check('0 point : Bronze 🥉, « 0 pt » au singulier (0 et 1), barre vide', zero.tierLabel === 'Bronze' && pointsLabel(0) === '0 pt' && pointsLabel(1) === '1 pt' && zero.progress === 0 && zero.hint === '25 pts avant le palier 🥈 Argent', zero);
const top = menuProfile({ ...base, loyalty_points: 120 })!;
check('120 points : Diamond 👑, plus de palier suivant, barre pleine', top.tierLabel === 'Diamond' && top.progress === 1 && /plus haut/.test(top.hint) && top.points === 120, top);
check('points absents ou invalides : 0, jamais « NaN »', menuProfile({ ...base, loyalty_points: undefined as unknown as number })!.points === 0 && menuProfile({ ...base, loyalty_points: -4 })!.points === 0 && menuProfile({ ...base, loyalty_points: 'x' as unknown as number })!.points === 0);
const anon = menuProfile({ ...base, full_name: '  ', client_number: undefined })!;
check('sans nom : « Client Albasse » ; sans numéro client : aucun numéro inventé', anon.name === 'Client Albasse' && anon.initial === 'C' && anon.clientNumber === null, anon);
check('photo du compte reprise telle quelle', menuProfile({ ...base, avatar_url: 'https://x/y.jpg' })!.avatarUrl === 'https://x/y.jpg');

// --- les catégories -----------------------------------------------------------------------------------------------------------------------------
const cat = (id: string, name: string, sort: number, parent?: string) => ({ id, slug: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, image_url: null, affiliate_commission_rate: null, sort_order: sort, parent_id: parent ?? null }) as never;
const cats = [cat('3', 'Parfum', 3), cat('1', 'Vêtements', 1), cat('4', 'Chemises', 1, '1'), cat('2', 'Montre', 2), cat('5', '  ', 9)];
const list = menuCategories(cats);
check('une catégorie par ligne, dans l\'ordre choisi (Vêtements, Montre, Parfum)', list.map((c) => c.name).join('|') === 'Vêtements|Montre|Parfum', list.map((c) => c.name));
check('les sous-catégories (Chemises) et les catégories sans nom ne sont pas dans le menu', !list.some((c) => c.name === 'Chemises') && list.length === 3);
check('aucune catégorie : liste vide (le menu le dit)', menuCategories([]).length === 0 && /Aucune catégorie/.test(MENU_TEXT.noCategories));
check('la liste d\'origine n\'est pas modifiée', cats.length === 5 && (cats[0] as { name: string }).name === 'Parfum');

// --- textes ------------------------------------------------------------------------------------------------------------------------------------
check('titres : « Profil client » puis « Catégories »', /Profil client/.test(MENU_TEXT.profileTitle) && /Catégories/.test(MENU_TEXT.categories));
check('visiteur : « Se connecter » et « Créer un compte »', MENU_TEXT.login === 'Se connecter' && MENU_TEXT.register === 'Créer un compte');

// --- menu « verre courbé » (16 novembre 2026) : sous-catégories, catégorie de la page, carte « À la une » ------------------------------------------
const tree = [cat('1', 'Vêtements', 1), cat('4', 'Chemises', 2, '1'), cat('6', 'Tissus', 1, '1'), cat('7', ' ', 3, '1'), cat('2', 'Montre', 2), cat('3', 'Parfum', 3)];
check('sous-catégories d\'une catégorie : dans l\'ordre choisi (Tissus puis Chemises), sans nom écartée', menuSubs(tree, '1').map((c) => c.name).join('|') === 'Tissus|Chemises', menuSubs(tree, '1').map((c) => c.name));
check('catégorie sans sous-catégorie : aucune (pas de flèche)', menuSubs(tree, '2').length === 0 && menuSubs(tree, 'inconnue').length === 0);
check('page d\'une sous-catégorie (chemises) : sa catégorie (Vêtements) s\'ouvre et Chemises est mise en avant', JSON.stringify(menuActive(tree, 'chemises')) === JSON.stringify({ mainId: '1', activeId: '4' }), menuActive(tree, 'chemises'));
check('page d\'une catégorie principale (montre) : elle-même', JSON.stringify(menuActive(tree, 'montre')) === JSON.stringify({ mainId: '2', activeId: '2' }));
check('autre page (accueil) ou adresse inconnue : rien de mis en avant', menuActive(tree, null) === null && menuActive(tree, undefined) === null && menuActive(tree, 'nimporte-quoi') === null);
const bf = menuHighlight(Date.parse('2026-11-16T10:00:00Z'));
check('16 novembre 2026 : carte « BLACK FRIDAY », « Le 27 novembre », NOV.', !!bf && bf.key === 'blackFriday' && bf.title === 'BLACK FRIDAY' && bf.when === 'Le 27 novembre' && bf.monthTag === 'NOV.' && bf.emoji === '🖤', bf);
check('le jour même (27 novembre) : toujours « Le 27 novembre »', menuHighlight(Date.parse('2026-11-27T15:00:00Z'))?.when === 'Le 27 novembre');
check('après le Black Friday (15 décembre) : pas de carte (rien d\'inventé)', menuHighlight(Date.parse('2026-12-15T10:00:00Z')) === null);
check('avant la période (1er novembre, plus de 21 jours avant) : pas de carte', menuHighlight(Date.parse('2026-11-01T10:00:00Z')) === null);
const ram = menuHighlight(Date.parse('2027-02-20T10:00:00Z'));
check('Ramadan 2027 commencé le 8 février : « Depuis le 8 février », FÉVR.', !!ram && ram.key === 'ramadan' && ram.when === 'Depuis le 8 février' && ram.monthTag === 'FÉVR.', ram);
check('textes : CATÉGORIES, Tout voir, Mon compte, Se déconnecter, À LA UNE', MENU_TEXT.categoriesLabel === 'CATÉGORIES' && MENU_TEXT.seeAll === 'Tout voir' && MENU_TEXT.account === 'Mon compte' && MENU_TEXT.signOut === 'Se déconnecter' && MENU_TEXT.highlightTag === 'À LA UNE');
check('flèche des sous-catégories : une phrase claire pour les lecteurs d\'écran', MENU_TEXT.openSubs('Montre') === 'Voir les sous-catégories de Montre' && MENU_TEXT.closeSubs('Montre') === 'Cacher les sous-catégories de Montre');

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
