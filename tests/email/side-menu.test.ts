// Menu ☰ de l'accueil : le profil du client avec ses points, puis les catégories une à une (src/lib/sideMenu.ts).
import { MENU_TEXT, menuCategories, menuProfile, pointsLabel } from '../../src/lib/sideMenu.ts';

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

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
