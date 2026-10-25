// Marketing « saison fraîche » (src/lib/coldSeason.ts) : blousons et manteaux jusqu'à fin décembre, sans rien inventer.
// Lancer : node --import ./tests/zara/register.mjs tests/email/cold-season.test.ts
import { coldSeasonActive, coldSeasonFacts, coldSeasonPicks, isColdSeasonName, realDiscountPct, wantsColdSeason, type ColdView } from '../../src/lib/coldSeason.ts';

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

// --- la période : du 1er octobre au 31 décembre 2026 inclus, à l'heure de N'Djamena (UTC+1) ---
check('25 octobre 2026 : en cours', coldSeasonActive(Date.UTC(2026, 9, 25, 12)));
check('1er octobre 00h00 à N’Djamena (30/09 23:00 UTC) : commence', coldSeasonActive(Date.UTC(2026, 8, 30, 23, 0)) && !coldSeasonActive(Date.UTC(2026, 8, 30, 22, 59)));
check('30 septembre : pas encore', !coldSeasonActive(Date.UTC(2026, 8, 30, 12)));
check('31 décembre 23h59 à N’Djamena (22:59 UTC) : encore en cours', coldSeasonActive(Date.UTC(2026, 11, 31, 22, 59, 59)));
check('1er janvier 00h00 à N’Djamena (31/12 23:00 UTC) : terminé', !coldSeasonActive(Date.UTC(2026, 11, 31, 23, 0, 0)));
check('janvier 2027 : terminé', !coldSeasonActive(Date.UTC(2027, 0, 15)));

// --- les noms : les vrais articles de la boutique ---
const REAL = ['Blouson AIRBORNE Homme ', 'MANTEAU FOURRÉ À CAPUCHE 🧥', 'MANTEAU HOMME ORIGINAL', 'Manteaux '];
check('les 4 vrais articles de la boutique sont reconnus', REAL.every(isColdSeasonName), REAL.filter((n) => !isColdSeasonName(n)));
check('autres vêtements chauds : veste, doudoune, parka, coupe-vent, perfecto', ['Veste en cuir', 'Doudoune noire', 'Parka kaki', 'Coupe-vent léger', 'Perfecto homme'].every(isColdSeasonName));
check('en arabe : جاكيت, معطف, معاطف, بالطو, سترة', ['جاكيت رجالي', 'معطف شتوي', 'معاطف', 'بالطو', 'سترة جلد'].every(isColdSeasonName));
check('« porte-manteau » (le meuble) n’est PAS un manteau, sous toutes ses écritures', !['Porte-manteau', 'portemanteau', 'PORTE MANTEAU mural', 'Porte-manteaux', 'Cintre manteau'].some(isColdSeasonName));
check('un article sans rapport : pas reconnu', !['Parfum Oud', 'Montre Naviforce', 'Chaussures de sport', 'Sac à main', 'Investigation'].some(isColdSeasonName));

// --- ce que le client écrit ---
check('« manteau », « blouson », « je cherche un manteau », « blousons et manteaux »', ['manteau', 'blouson', 'je cherche un manteau pour homme', 'blousons et manteaux', 'Manteau'].every(wantsColdSeason));
check('le froid : « il fait froid », « pour l’hiver », « harmattan »', ['il fait froid', 'quelque chose pour l’hiver', 'harmattan'].every(wantsColdSeason));
check('en arabe : جاكيتات ومعاطف, معطف, الشتاء, برد', ['جاكيتات ومعاطف', 'اريد معطف', 'ملابس الشتاء', 'عندي برد'].every(wantsColdSeason));
check('un porte-manteau demandé : autre recherche, pas la saison fraîche', !wantsColdSeason('porte-manteau') && !wantsColdSeason('je cherche un porte manteau'));
check('sans rapport : parfum, montre, bonjour', !['parfum', 'montre', 'bonjour', 'chaussures'].some(wantsColdSeason));
check('« frais de livraison », « les frais », « fraîche » : une autre question, pas la saison fraîche', !['frais de livraison', 'c’est quoi les frais', 'une eau fraîche', 'combien pour la livraison'].some(wantsColdSeason));

// --- les articles montrés ---
interface P { name: string; price: number; compareAt: number | null; stock: number; image: boolean }
const view = (p: P): ColdView => ({ name: p.name, price: p.price, compareAt: p.compareAt, stock: p.stock, hasImage: p.image });
const catalog: P[] = [
  { name: 'Blouson AIRBORNE Homme ', price: 22500, compareAt: 30000, stock: 200, image: true }, // −25 %
  { name: 'MANTEAU FOURRÉ À CAPUCHE 🧥', price: 25000, compareAt: 30000, stock: 25, image: true }, // −17 %
  { name: 'MANTEAU HOMME ORIGINAL', price: 75000, compareAt: 80000, stock: 6, image: true }, // −6 %
  { name: 'Manteaux ', price: 25000, compareAt: 35000, stock: 55, image: true }, // −29 %
  { name: 'Porte-manteau', price: 12500, compareAt: 15000, stock: 12, image: true },
  { name: 'portemanteau', price: 40000, compareAt: 50000, stock: 12, image: true },
  { name: 'Parfum Oud', price: 15000, compareAt: 20000, stock: 50, image: true },
];
const picks = coldSeasonPicks(catalog, view);
check('les 4 vrais articles, jamais les porte-manteaux ni le parfum', picks.length === 4 && picks.every((p) => REAL.includes(p.name)), picks.map((p) => p.name));
check('ordre : la plus grande remise réelle d’abord (−29 %, −25 %, −17 %, −6 %)', picks.map((p) => realDiscountPct(view(p))).join(',') === '29,25,17,6', picks.map((p) => realDiscountPct(view(p))));
check('limite : 2 articles seulement si on en demande 2', coldSeasonPicks(catalog, view, 2).length === 2 && coldSeasonPicks(catalog, view, 2)[0].name === 'Manteaux ');
check('un article épuisé, sans photo ou sans prix est écarté', coldSeasonPicks([{ ...catalog[0], stock: 0 }, { ...catalog[1], image: false }, { ...catalog[2], price: 0 }, catalog[3]], view).map((p) => p.name).join('|') === 'Manteaux ');
check('sans remise : placé après ceux qui en ont, le plus gros stock d’abord', coldSeasonPicks([{ name: 'Veste A', price: 10000, compareAt: null, stock: 3, image: true }, { name: 'Veste B', price: 10000, compareAt: null, stock: 30, image: true }, catalog[3]], view).map((p) => p.name).join('|') === 'Manteaux |Veste B|Veste A');
check('un « ancien prix » plus bas que le prix n’est pas une remise', realDiscountPct({ price: 10000, compareAt: 8000 }) === 0 && realDiscountPct({ price: 10000, compareAt: 10000 }) === 0 && realDiscountPct({ price: 10000, compareAt: null }) === 0);
check('aucun article : liste vide, jamais d’invention', coldSeasonPicks([], view).length === 0 && coldSeasonPicks([catalog[6]], view).length === 0);

// --- les chiffres que Zara dit (calculés sur les articles montrés) ---
const facts = coldSeasonFacts(picks, view);
check('faits : 4 modèles, à partir de 22 500 FCFA, jusqu’à −29 %', facts.count === 4 && facts.minPrice === 22500 && facts.maxPct === 29, facts);
const noPromo = coldSeasonFacts([{ name: 'Veste A', price: 10000, compareAt: null, stock: 3, image: true }], view);
check('sans remise : pas de pourcentage annoncé', noPromo.maxPct === null && noPromo.minPrice === 10000, noPromo);
check('remise de 4 % : trop petite pour être annoncée', coldSeasonFacts([{ name: 'Veste A', price: 9600, compareAt: 10000, stock: 3, image: true }], view).maxPct === null);

console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
