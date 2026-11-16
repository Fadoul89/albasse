// Zara + psychologie de la vente : « 👀 Les plus regardés », « Vu par N personnes (30 j) », « vous économisez ». Aucun réseau.
// Chaque chiffre n'est dit que s'il est vrai (assez de personnes, vrai ancien prix). Zara dit « regardé », jamais « acheté ».
// Lancer : node --import ./tests/zara/register.mjs tests/email/zara-views.test.ts
import { MIN_VIEWS_PROOF, MOST_VIEWED_MAX, VIEWS_WINDOW_DAYS, buildViewsMap, mostViewed, provenViews, savedAmount } from '../../src/lib/assistantViews.ts';
import { texts } from '../../src/lib/assistantText.ts';
import { candidatesFor, productPitch, whyAdvice, whyReasons, ANY_BUDGET } from '../../src/lib/assistantMarketing.ts';
import { detectIntent, type CatalogProduct } from '../../src/lib/assistantBrain.ts';

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

const prod = (id: string, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id, name: `Article ${id}`, slug: `article-${id}`, price: 10000, compareAt: null, stock: 10, category: 'Mode', categorySlug: 'mode', colors: [], sizes: [],
  image: `https://exemple.test/${id}.jpg`, createdAt: 0, nameTokens: [], catTokens: [], colorTokens: [], descTokens: [], ...over,
});

// --- les chiffres de la base
check('réglages : 30 jours, preuve à partir de 50 personnes, 4 articles au plus', VIEWS_WINDOW_DAYS === 30 && MIN_VIEWS_PROOF === 50 && MOST_VIEWED_MAX === 4);
const map = buildViewsMap([
  { product_id: 'A', visitors: 1843 },
  { product_id: 'B', visitors: 50 },
  { product_id: 'C', visitors: 49 },
  { product_id: 'D', visitors: '120' }, // chiffre écrit en texte : accepté s'il est entier
  { product_id: 'E', visitors: 12.5 }, // pas un nombre entier : ignoré
  { product_id: 'F', visitors: -3 },
  { product_id: 7, visitors: 300 }, // identifiant douteux : ignoré
  null,
  { visitors: 999 },
]);
check('les lignes douteuses de la base sont ignorées', map.size === 4 && map.get('A') === 1843 && map.get('D') === 120 && !map.has('E') && !map.has('F'), [...map]);
check('réponse illisible : aucune visite (Zara ne dit aucun chiffre)', buildViewsMap(null).size === 0 && buildViewsMap({ rows: [] }).size === 0);
check('chiffre solide : 1 843 et 50 sont dits', provenViews(map, 'A') === 1843 && provenViews(map, 'B') === 50);
check('en dessous de 50 personnes : rien (pas de petit chiffre qui ne rassure pas)', provenViews(map, 'C') === 0);
check('article inconnu, pas de visites, ou index de tableau pris par erreur pour les visites : rien', provenViews(map, 'Z') === 0 && provenViews(null, 'A') === 0 && provenViews(undefined, 'A') === 0 && provenViews(3 as unknown as Map<string, number>, 'A') === 0 && provenViews(map, null) === 0);

// --- « Les plus regardés »
const catalog = [prod('A'), prod('B'), prod('C'), prod('D'), prod('G', { stock: 0 }), prod('H', { price: 0 })];
const viewsAll = buildViewsMap([
  { product_id: 'A', visitors: 1843 }, { product_id: 'B', visitors: 60 }, { product_id: 'C', visitors: 49 }, { product_id: 'D', visitors: 700 },
  { product_id: 'G', visitors: 5000 }, { product_id: 'H', visitors: 4000 },
]);
const top = mostViewed(catalog, viewsAll);
check('rangés du plus regardé au moins regardé : A (1 843), D (700), B (60)', top.map((p) => p.id).join() === 'A,D,B', top.map((p) => p.id));
check('jamais un article épuisé ou sans prix, même très regardé ; jamais un article sous 50 personnes', !top.some((p) => ['G', 'H', 'C'].includes(p.id)));
const many = Array.from({ length: 9 }, (_, i) => prod(`M${i}`));
const manyViews = buildViewsMap(many.map((p, i) => ({ product_id: p.id, visitors: 100 + i })));
check('4 articles au plus (trop de choix fait hésiter)', mostViewed(many, manyViews).length === 4 && mostViewed(many, manyViews)[0].id === 'M8');
check('sans visites (fonction de la base pas lancée) : aucun article', mostViewed(catalog, new Map()).length === 0);

// --- la suite de la conversation garde l'ordre des plus regardés (bouton « Mon budget »…)
const ctxList = candidatesFor([prod('A'), prod('B'), prod('D'), prod('X', { image: null })], { kind: 'popular', ids: ['D', 'A', 'inconnu', 'X', 'B'] });
check('« plus regardés » puis budget : même ordre, sans article inconnu ni article sans photo', ctxList.map((p) => p.id).join() === 'D,A,B', ctxList.map((p) => p.id));
check('contexte abîmé (sans liste) : aucun article, pas de plantage', candidatesFor([prod('A')], { kind: 'popular' } as unknown as { kind: 'popular'; ids: string[] }).length === 0);

// --- aversion à la perte : « vous économisez »
check('économie = ancien prix - prix', savedAmount(40000, 50000) === 10000 && savedAmount(12500, 25000) === 12500);
check('pas d\'ancien prix, ancien prix plus bas ou égal, prix faux : 0 (rien n\'est dit)', savedAmount(40000, null) === 0 && savedAmount(40000, undefined) === 0 && savedAmount(40000, 40000) === 0 && savedAmount(40000, 30000) === 0 && savedAmount(0, 50000) === 0 && savedAmount(Number.NaN, 50000) === 0);
const promo = prod('P', { name: 'COTTON SWISS 100 % COTON', price: 40000, compareAt: 50000, stock: 500 });
const r = whyReasons(promo, ANY_BUDGET, 'fr');
check('conseil : « 20 % de remise : 40 000 FCFA au lieu de 50 000 FCFA · vous économisez 10 000 FCFA »', /^20 % de remise : 40\s000 FCFA au lieu de 50\s000 FCFA · vous économisez 10\s000 FCFA$/.test(r[0]), r);
check('le conseil complet se lit comme sur l\'image exemple', /« COTTON SWISS 100 % COTON » — 20 % de remise : 40\s000 FCFA au lieu de 50\s000 FCFA · vous économisez 10\s000 FCFA\.$/.test(whyAdvice(promo, ANY_BUDGET, 'fr')), whyAdvice(promo, ANY_BUDGET, 'fr'));
check('arabe : « توفّر 10 000 FCFA »', /توفّر 10\s000 FCFA/.test(whyReasons(promo, ANY_BUDGET, 'ar')[0]), whyReasons(promo, ANY_BUDGET, 'ar'));
check('sans remise : pas d\'économie dite', !whyReasons(prod('N', { compareAt: null }), ANY_BUDGET, 'fr').join(' ').includes('économisez'));
check('petite remise (moins de 10 %) : ni remise ni économie dans le conseil', !whyReasons(prod('S', { price: 9500, compareAt: 10000 }), ANY_BUDGET, 'fr').join(' ').includes('économisez'));

// --- preuve sociale : les textes
const fr = texts('fr');
const ar = texts('ar');
check('fiche : « 👀 Vu par 1 843 personnes (30 j) »', /^👀 Vu par 1\s843 personnes \(30 j\)$/.test(fr.card.views(1843)), fr.card.views(1843));
check('arabe : « 👀 شاهده 1843 شخصا في 30 يوما » (sans parenthèses : elles s\'affichent mal en arabe)', ar.card.views(1843) === '👀 شاهده 1843 شخصا في 30 يوما', ar.card.views(1843));
check('bouton : « 👀 Les plus regardés » / « 👀 الأكثر مشاهدة »', fr.chip.popular === '👀 Les plus regardés' && ar.chip.popular === '👀 الأكثر مشاهدة');
check('présentation : « les plus regardés ces 30 derniers jours », avec le prénom', /les plus regardés ces 30 derniers jours/.test(fr.mostViewedIntro) && fr.mostViewedIntro.includes('{nom}') && /آخر 30 يوما/.test(ar.mostViewedIntro) && ar.mostViewedIntro.includes('{nom}'));
const viewTexts = [fr.card.views(60), fr.mostViewedIntro, fr.noMostViewed, fr.viewsLine(60), fr.chip.popular];
check('jamais « acheté », « vendu » ni « commandé » dans les textes des visites', !/achet|vendu|commandé/i.test(viewTexts.join(' ')), viewTexts);
check('jamais « en ce moment » ni « regardent » (pas de faux « X personnes regardent maintenant »)', !/en ce moment|regardent|maintenant/i.test(viewTexts.join(' ')));

// --- la fiche du produit regardé (le client ouvre Zara sur la page d'un article)
const pitch = productPitch(promo, 'fr', 1843);
const lines = pitch.split('\n');
check('fiche regardée : économie + visites, puis « Pour le commander… » en dernier', /\(-20 % : vous économisez 10\s000 FCFA\)/.test(lines[0]) && /^👀 1\s843 personnes ont regardé cet article ces 30 derniers jours\.$/.test(lines[lines.length - 2]) && /Pour le commander/.test(lines[lines.length - 1]), lines);
check('sans chiffre solide (0) : la fiche reste comme avant, sans ligne de visites', !productPitch(promo, 'fr', 0).includes('👀') && !productPitch(promo, 'fr').includes('👀'));
check('arabe : la ligne des visites aussi', productPitch(promo, 'ar', 1843).includes('👀 شاهد 1843 شخصا هذا المنتج خلال آخر 30 يوما.'));

// --- Zara comprend la demande
const asks = ['les plus regardés', 'Les plus regardés', 'les articles les plus vus', 'montre-moi les plus populaires', 'الأكثر مشاهدة', 'المنتجات الاكثر مشاهدة'];
check('« les plus regardés », « les plus vus », « les plus populaires », arabe : compris', asks.every((t) => detectIntent(t) === 'popular'), asks.map((t) => [t, detectIntent(t)]));
const notAsks = ['promotions', 'nouveautés', "qu'est-ce que j'ai regardé", 'mes derniers articles vus', 'suivre ma commande', 'parfum pour homme', 'plus tard', 'ماذا شاهدت'];
check('promotions, nouveautés, historique du client, commande… : jamais pris pour « les plus regardés »', notAsks.every((t) => detectIntent(t) !== 'popular'), notAsks.map((t) => [t, detectIntent(t)]));
check('le bouton envoie bien un texte compris (fr et ar)', detectIntent('les plus regardés') === 'popular' && detectIntent('الأكثر مشاهدة') === 'popular');

console.log(`\n${ok} contrôles réussis`);
