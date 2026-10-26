// Publicités de Zara (src/lib/zaraAds.ts) : des faits VRAIS seulement (vraies commandes, vrai petit stock), jamais de phrase inventée.
// Lancer : node --import ./tests/zara/register.mjs tests/email/zara-ads.test.ts
import { MANY_SALES, adFacts, adLine, isSeniorProfession, pickAds, productAdLine, type AdView } from '../../src/lib/zaraAds.ts';
import { FORBIDDEN_CLAIMS } from '../../src/lib/assistantPersona.ts';
import { buildSalesMap } from '../../src/lib/assistantSales.ts';

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

// --- le métier « haut placé » (champ libre du compte) ---
const SENIOR = ['Directeur', 'directrice générale', 'ingénieur', 'Ingenieure', 'médecin', 'docteur', 'avocat', 'juriste', 'banquier', 'entrepreneur', 'businessman', "homme d'affaires", 'comptable', 'gestionnaire', 'PDG', 'ministre', 'مدير', 'مهندس', 'طبيب', 'رجل أعمال', 'professeur d’université'];
check('métiers haut placés reconnus : directeur, ingénieur, médecin, avocat, banquier, entrepreneur…', SENIOR.every(isSeniorProfession), SENIOR.filter((p) => !isSeniorProfession(p)));
const NOT_SENIOR = ['étudiant', 'élève', 'étudiante', 'chauffeur', 'tiktokeur', 'vendeur', 'ménagère', 'chômeur', 'militaire', 'mahamat', '1234', 'masculin', 'tchadien', 'commerçant', '', '   '];
check('étudiant, élève, chauffeur, vendeur, prénoms, chiffres, champ vide : pas haut placé', !NOT_SENIOR.some(isSeniorProfession), NOT_SENIOR.filter(isSeniorProfession));
check('rien (null / undefined) : pas haut placé', !isSeniorProfession(null) && !isSeniorProfession(undefined));
check('un mot dans un autre mot ne compte pas (« directement », « ingénierie », « cadrage »)', !isSeniorProfession('directement') && !isSeniorProfession('cadrage') && !isSeniorProfession('juger'));
check('un long texte n’est pas un métier', !isSeniorProfession('je suis directeur de rien du tout et je vends des choses partout dans la ville toute la semaine'));

// --- les faits : les commandes (au moins 3) et le stock (5 au plus) ---
const sales = (n: number) => buildSalesMap([{ product_id: 'p', orders_count: n }]);
check('2 commandes : rien de solide à dire (0)', adFacts({ id: 'p', stock: 50 }, sales(2)).sales === 0);
check('3 commandes : on dit 3', adFacts({ id: 'p', stock: 50 }, sales(3)).sales === 3);
check('sans chiffre de ventes (liste vide, base absente, null) : 0 commande', adFacts({ id: 'p', stock: 50 }, new Map()).sales === 0 && adFacts({ id: 'p', stock: 50 }, null).sales === 0 && adFacts({ id: 'p', stock: 50 }, undefined).sales === 0);
check('stock de 6 ou plus : pas de rareté', adFacts({ id: 'p', stock: 6 }, null).stock === 0 && adFacts({ id: 'p', stock: 200 }, null).stock === 0);
check('stock de 1 à 5 : rareté vraie (le vrai stock)', [1, 2, 3, 4, 5].every((s) => adFacts({ id: 'p', stock: s }, null).stock === s));
check('stock de 0, négatif ou invalide : pas de rareté', adFacts({ id: 'p', stock: 0 }, null).stock === 0 && adFacts({ id: 'p', stock: -2 }, null).stock === 0 && adFacts({ id: 'p', stock: NaN }, null).stock === 0);

// --- les phrases ---
check('aucun fait : aucun message (null), pour tout le monde', adLine({ sales: 0, stock: 0 }, false) === null && adLine({ sales: 0, stock: 0 }, true) === null);
check('3 commandes : « 3 clients ont commandé… » (pas « beaucoup »)', adLine({ sales: 3, stock: 0 }, false) === '3 clients ont commandé cet article ces 7 derniers jours.', adLine({ sales: 3, stock: 0 }, false));
check(`${MANY_SALES} commandes : « Beaucoup de clients ont acheté cet article » avec le vrai chiffre`, adLine({ sales: MANY_SALES, stock: 0 }, false) === `Beaucoup de clients ont acheté cet article : ${MANY_SALES} commandes ces 7 derniers jours.`);
check('4 commandes : pas « beaucoup »', !/Beaucoup/.test(adLine({ sales: 4, stock: 0 }, false) ?? ''));
check('client ordinaire, stock 3 : « Plus que 3 en stock. » (jamais « article rare »)', adLine({ sales: 0, stock: 3 }, false) === 'Plus que 3 en stock.');
check('client haut placé, stock 3 : « Article rare : il n’en reste que 3. »', adLine({ sales: 0, stock: 3 }, true) === "Article rare : il n'en reste que 3.");
check('stock 1 : « qu’un seul » (singulier)', adLine({ sales: 0, stock: 1 }, true) === "Article rare : il n'en reste qu'un seul." && adLine({ sales: 0, stock: 1 }, false) === "Plus qu'un seul en stock.");
check('haut placé avec commandes ET petit stock : la rareté d’abord, puis les commandes', /^Article rare : il n'en reste que 2\. Beaucoup de clients/.test(adLine({ sales: 8, stock: 2 }, true) ?? ''), adLine({ sales: 8, stock: 2 }, true));
check('client ordinaire avec commandes ET petit stock : les commandes d’abord, puis le stock', /^Beaucoup de clients ont acheté cet article : 8 commandes ces 7 derniers jours\. Plus que 2 en stock\.$/.test(adLine({ sales: 8, stock: 2 }, false) ?? ''), adLine({ sales: 8, stock: 2 }, false));
check('haut placé sans petit stock (article abondant) : JAMAIS « article rare »', !/rare/i.test(adLine({ sales: 6, stock: 0 }, true) ?? ''));
check('haut placé sans aucun fait : rien (pas de fausse rareté)', productAdLine({ id: 'x', stock: 40 }, new Map(), true) === null);
const allLines = [adLine({ sales: 3, stock: 0 }, false), adLine({ sales: 9, stock: 0 }, true), adLine({ sales: 0, stock: 1 }, true), adLine({ sales: 0, stock: 5 }, false), adLine({ sales: 12, stock: 4 }, true), adLine({ sales: 12, stock: 4 }, false)];
check('aucune phrase interdite par Zara (exclusif, élite, urgent, dernière chance, vite…)', allLines.every((l) => l && !FORBIDDEN_CLAIMS.test(l)), allLines.filter((l) => l && FORBIDDEN_CLAIMS.test(l)));

// --- le choix des articles ---
const catalog: AdView[] = [
  { id: 'a', name: 'Rolex', price: 90000, stock: 2, hasImage: true }, // rare + cher
  { id: 'b', name: 'Parfum Oud', price: 15000, stock: 4, hasImage: true }, // rare
  { id: 'c', name: 'Chaussures', price: 30000, stock: 60, hasImage: true }, // abondant (les commandes diront)
  { id: 'd', name: 'Sac', price: 25000, stock: 3, hasImage: false }, // sans photo
  { id: 'e', name: 'Casquette', price: 5000, stock: 0, hasImage: true }, // épuisé
  { id: 'f', name: 'Ceinture', price: 8000, stock: 80, hasImage: true }, // abondant, sans commande : aucun fait
  { id: 'g', name: 'Montre Naviforce', price: 45000, stock: 5, hasImage: true }, // rare
];
const view = (p: AdView) => p;
const noSales = new Map<string, number>();
const orderedMap = buildSalesMap([{ product_id: 'c', orders_count: 7 }, { product_id: 'f', orders_count: 1 }]);

const todayOrdinary = pickAds(catalog, view, noSales, { senior: false, limit: 9 });
check('aujourd’hui (aucune commande) : seuls les articles à vrai petit stock, avec photo et en stock', todayOrdinary.map((a) => a.item.id).sort().join('') === 'abg', todayOrdinary.map((a) => a.item.id));
check('client ordinaire : le plus petit stock d’abord (Rolex 2, Parfum 4, Montre 5)', todayOrdinary.map((a) => a.item.id).join('') === 'abg', todayOrdinary.map((a) => a.item.id));
check('client ordinaire : « Plus que N en stock », jamais « Article rare »', todayOrdinary.every((a) => /^Plus que \d en stock\.$/.test(a.line)), todayOrdinary.map((a) => a.line));
const todaySenior = pickAds(catalog, view, noSales, { senior: true, limit: 9 });
check('client haut placé : le plus haut de gamme d’abord (Rolex, Montre, Parfum)', todaySenior.map((a) => a.item.id).join('') === 'agb', todaySenior.map((a) => a.item.id));
check('client haut placé : « Article rare : il n’en reste que N »', todaySenior.every((a) => /^Article rare : il n'en reste que \d\.$/.test(a.line)), todaySenior.map((a) => a.line));
check('les faits sont les mêmes pour tous (mêmes articles, mêmes chiffres de stock)', todayOrdinary.map((a) => a.item.id).sort().join('') === todaySenior.map((a) => a.item.id).sort().join(''));
const withOrders = pickAds(catalog, view, orderedMap, { senior: false, limit: 9 });
check('avec de vraies commandes (7 pour Chaussures) : l’article le plus commandé passe en premier', withOrders[0].item.id === 'c' && /^Beaucoup de clients ont acheté cet article : 7 commandes/.test(withOrders[0].line), withOrders[0]);
check('le plus commandé reste en tête quelle que soit la graine (0 à 11)', Array.from({ length: 12 }, (_, i) => pickAds(catalog, view, orderedMap, { senior: false, limit: 3, seed: i })[0].item.id).every((id) => id === 'c'));
check('client haut placé : les articles rares tournent (pas toujours les mêmes) mais restent rares', pickAds(catalog, view, noSales, { senior: true, limit: 2, seed: 0 }).map((a) => a.item.id).join('') !== pickAds(catalog, view, noSales, { senior: true, limit: 2, seed: 1 }).map((a) => a.item.id).join('') && pickAds(catalog, view, noSales, { senior: true, limit: 3, seed: 2 }).every((a) => /^Article rare/.test(a.line)));
check('1 seule commande (Ceinture) : pas de message pour cet article', !withOrders.some((a) => a.item.id === 'f'));
check('limite : 2 articles seulement si on en demande 2', pickAds(catalog, view, noSales, { limit: 2 }).length === 2);
check('catalogue vide ou sans fait : liste vide (jamais d’invention)', pickAds([], view, noSales).length === 0 && pickAds([catalog[5]], view, noSales).length === 0);
const s0 = pickAds(catalog, view, noSales, { senior: false, limit: 3, seed: 0 }).map((a) => a.item.id).join('');
const s1 = pickAds(catalog, view, noSales, { senior: false, limit: 3, seed: 1 }).map((a) => a.item.id).join('');
check('la graine fait tourner les choix (autre ordre) sans jamais sortir des articles vrais', s0 !== s1 && [...s1].every((id) => 'abg'.includes(id)), { s0, s1 });
check('même graine : même résultat (stable)', pickAds(catalog, view, noSales, { limit: 3, seed: 5 }).map((a) => a.item.id).join('') === pickAds(catalog, view, noSales, { limit: 3, seed: 5 }).map((a) => a.item.id).join(''));
check('graine négative ou énorme : pas d’erreur', pickAds(catalog, view, noSales, { limit: 3, seed: -7 }).length === 3 && pickAds(catalog, view, noSales, { limit: 3, seed: 10 ** 12 }).length === 3);

console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
