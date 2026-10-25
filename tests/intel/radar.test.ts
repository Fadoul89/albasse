// Zara Intelligence 360 : le Business Radar (supabase/functions/zara-intel/radar.ts), sans réseau ni base.
// Lancer : node --import ./tests/zara/register.mjs tests/intel/radar.test.ts
import {
  MAX_PER_TYPE,
  MIN_BASE,
  analyze,
  buildCatalogIndex,
  buildKpis,
  confidence,
  foldText,
  hasCatalogMatch,
  tokens,
  type Finding,
  type Pair,
  type RadarInput,
  type RadarProduct,
} from '../../supabase/functions/zara-intel/radar.ts';
import { PERMISSIONS, decide, specOf, validateParams, type IntelState } from '../../supabase/functions/zara-intel/actions.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600));
    process.exitCode = 1;
  }
};

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P = (cur: number, prev = 0): Pair => [cur, prev];

let pid = 0;
const prod = (over: Partial<RadarProduct> = {}): RadarProduct => ({
  id: uid(++pid),
  name: `Article ${pid}`,
  categoryId: uid(900),
  active: true,
  stock: 10,
  price: 20000,
  likes: 0,
  createdAt: NOW - 60 * DAY,
  views: P(0),
  intents: P(0),
  orders: P(0),
  favorites: P(0),
  ...over,
});
const CAT_A = uid(901);
const CAT_B = uid(902);
const CAT_C = uid(903);
const categories = [{ id: CAT_A, name: 'Montre' }, { id: CAT_B, name: 'Parfum' }, { id: CAT_C, name: 'Chaussures' }];
const base = (over: Partial<RadarInput> = {}): RadarInput => ({
  now: NOW,
  windowDays: 30,
  traffic: { sessions: P(1000, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) },
  ordersEver: 0,
  products: [],
  categories,
  searchTerms: [],
  ...over,
});
const find = (r: ReturnType<typeof analyze>, prefix: string) => r.findings.filter((f) => f.key.startsWith(prefix));

// ---------- 1. les indicateurs comparés ----------
{
  const k = buildKpis(base({ traffic: { sessions: P(800, 1000), views: P(1500, 100), intents: P(30, 10), orders: P(2, 4), searches: P(10, 0) } }));
  const by = Object.fromEntries(k.map((x) => [x.key, x]));
  check('indicateurs : variation en % quand la période précédente est assez grande (visites 800 contre 1 000 = −20 %)', by.sessions.deltaPct === -20 && by.sessions.enough);
  check('indicateurs : période précédente trop petite -> PAS de pourcentage (null), jamais un chiffre trompeur', by.views.deltaPct === null && !by.views.enough && by.intents.deltaPct === null && by.orders.deltaPct === null && by.searches.deltaPct === null);
  check('minimums de comparaison fixés pour chaque indicateur', MIN_BASE.sessions === 100 && MIN_BASE.orders === 5);
  check('confiance : croît avec l’échantillon, toujours entre 0 et 1', confidence(0, 50) === 0 && confidence(50, 50) === 0.5 && confidence(1000, 50) > 0.9 && confidence(10, 50) < confidence(100, 50) && confidence(-5, 50) === 0);
}

// ---------- 2. variations de trafic : faits, jamais de cause ----------
{
  const r = analyze(base({ traffic: { sessions: P(800, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } }));
  const f = find(r, 'traffic:sessions')[0];
  check('visites −20 % : un constat avec les deux chiffres, la variation et leur source', !!f && f.title === 'Visites : −20 % sur 30 jours' && f.facts.length === 3 && f.facts.every((x) => x.source.length > 2) && f.facts[2].value === '−20 %', f);
  check('cause : JAMAIS affirmée — « Hypothèse : aucune cause n’est établie… » et des pistes à vérifier', f.causeEstablished === false && f.hypotheses.length === 1 && /^Hypothèse : aucune cause n'est établie/.test(f.hypotheses[0]) && /à vérifier/.test(f.hypotheses[0]));
  check('aucun mot de causalité affirmée dans tout le rapport (« à cause de », « parce que », « causé par », « en raison de »)', !/à cause de|parce que|causé par|en raison de|c'est dû/i.test(JSON.stringify(r.findings)));
  check('−10 % : sous le seuil de 15 %, rien n’est signalé', find(analyze(base({ traffic: { sessions: P(900, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } })), 'traffic:').length === 0);
  check('−50 % mais sur une période précédente trop petite (50 visites) : rien n’est signalé', find(analyze(base({ traffic: { sessions: P(25, 50), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } })), 'traffic:').length === 0);
  const up = find(analyze(base({ traffic: { sessions: P(1400, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } })), 'traffic:sessions')[0];
  check('hausse de 40 % : signalée, mais plafonnée plus bas qu’une baisse (c’est une occasion, pas une urgence)', !!up && up.impact <= 60 && up.title.includes('+40 %'));
  const dropOrders = find(analyze(base({ ordersEver: 50, traffic: { sessions: P(1000, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(6, 10), searches: P(100, 100) } })), 'traffic:orders')[0];
  const dropSessions = find(analyze(base({ traffic: { sessions: P(600, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } })), 'traffic:sessions')[0];
  check('une baisse de commandes (−40 %) pèse plus qu’une baisse de visites (−40 %) : pondération par importance', dropOrders.impact > dropSessions.impact, [dropOrders.impact, dropSessions.impact]);
  const small = find(analyze(base({ traffic: { sessions: P(80, 100), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } })), 'traffic:sessions')[0];
  const large = find(analyze(base({ traffic: { sessions: P(8000, 10000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } })), 'traffic:sessions')[0];
  check('même baisse de 20 % : plus de confiance sur 18 000 visites que sur 180', large.confidence > small.confidence, [large.confidence, small.confidence]);
  check('la clé est stable d’un jour à l’autre (indicateur + durée de période), pour ne pas répéter l’alerte', dropSessions.key === 'traffic:sessions:w30');
}

// ---------- 3. qualité des données ----------
{
  const none = find(analyze(base({ ordersEver: 0 })), 'dq:');
  check('AUCUNE commande enregistrée : le radar le dit au lieu d’annoncer un taux de conversion', none.length === 1 && none[0].key === 'dq:no_orders:w30' && none[0].facts[0].value === '0' && none[0].facts[0].source === 'orders', none);
  check('…avec deux hypothèses clairement étiquetées (commandes hors site, tests effacés), aucune affirmée', none[0].hypotheses.length === 2 && none[0].hypotheses.every((h) => h.startsWith('Hypothèse')) && /WhatsApp/.test(none[0].hypotheses[0]));
  check('…et une confiance de 1 : c’est un fait de la base, pas une estimation', none[0].confidence === 1);
  const few = find(analyze(base({ ordersEver: 40, traffic: { sessions: P(900, 900), views: P(2000, 2000), intents: P(100, 100), orders: P(2, 3), searches: P(100, 100) } })), 'dq:');
  check('2 commandes pour 900 visites : « comparaisons de ventes peu fiables »', few.length === 1 && few[0].key === 'dq:few_orders:w30');
  check('assez de commandes (8) : aucune alerte de qualité', find(analyze(base({ ordersEver: 40, traffic: { sessions: P(900, 900), views: P(2000, 2000), intents: P(100, 100), orders: P(8, 6), searches: P(100, 100) } })), 'dq:').length === 0);
}

// ---------- 4. recherches sans résultat ----------
{
  const products = [prod({ name: 'Montre Homme Acier' }), prod({ name: 'Parfum Oud Royal' }), prod({ name: 'Chaussures de sport' }), prod({ name: 'عطر ملكي' }), prod({ name: 'Robe élégante', active: false })];
  const index = buildCatalogIndex(products, categories);
  check('pliage du texte : majuscules, accents et voyelles arabes ignorés', foldText('Élégante') === 'elegante' && foldText('MONTRE') === 'montre' && foldText('عَطْر') === 'عطر');
  check('mots utiles : mots vides et mots trop courts retirés', JSON.stringify(tokens('une montre pour les hommes')) === JSON.stringify(['montre', 'hommes']) && tokens('de la').length === 0);
  check('arabe : l’article « ال » est retiré (« العطر » = « عطر »)', JSON.stringify(tokens('العطر')) === JSON.stringify(['عطر']));
  const m = (t: string) => hasCatalogMatch(t, index);
  check('correspondance : mot commun avec un nom d’article actif ou de catégorie (parfum, montres au pluriel, mot arabe)', m('parfum') === true && m('montres') === true && m('Parfum Oud') === true && m('العطر') === true && m('chaussure') === true);
  check('pas de correspondance : article absent', m('iphone 15') === false && m('ceinture') === false);
  check('un article DÉSACTIVÉ ne compte pas dans le catalogue (« robe ») ; une recherche trop courte ne peut pas être évaluée (null)', m('robe') === false && m('ab') === null && m('de la') === null);

  const searchTerms = [{ q: 'iPhone 15', count: 5 }, { q: 'iphone 15', count: 2 }, { q: 'ceinture', count: 1 }, { q: 'montre', count: 40 }, { q: 'مكياج', count: 3 }, { q: 'lunettes', count: 2 }, { q: 'x', count: 9 }, { q: 'a\nb\u0000 cravate', count: 4 }];
  const r = analyze(base({ products, searchTerms }));
  const s = find(r, 'search:');
  check('recherches sans résultat : "iPhone 15" et "iphone 15" fusionnés (7 fois), arabe, lunettes, cravate ; « montre » (trouvée), « ceinture » (1 fois) et « x » (trop court) exclus', s.length === 4 && s.map((x) => x.title).join('|').includes('iPhone 15') && !s.some((x) => /montre|ceinture/i.test(x.title)), s.map((x) => x.title));
  const iphone = s.find((x) => /iPhone/.test(x.title))!;
  check('constat : « cherché 7 fois », source browsing_searches, ET l’estimation est dite (règle simplifiée)', /7 fois/.test(iphone.title) && iphone.facts[0].source === 'browsing_searches' && /estimation/.test(iphone.facts[1].value));
  check('hypothèse étiquetée : des clients cherchent un article absent ou l’écrivent autrement', iphone.hypotheses.length === 1 && /^Hypothèse : des clients cherchent/.test(iphone.hypotheses[0]));
  check('classées : la plus cherchée d’abord ; mot nettoyé (retours à la ligne et caractères de contrôle retirés)', s[0].title.includes('iPhone 15') && s.some((x) => x.title.includes('a b cravate')), s.map((x) => x.title));
  check('proposition : « catalog.suggest_item » avec le mot cherché', iphone.proposed.length === 1 && iphone.proposed[0].type === 'catalog.suggest_item' && iphone.proposed[0].params.term === 'iPhone 15');
  const many = analyze(base({ products, searchTerms: Array.from({ length: 12 }, (_, i) => ({ q: `produit${i}xyz`, count: 3 + i }) ) }));
  check(`au plus ${MAX_PER_TYPE} recherches signalées`, find(many, 'search:').length === MAX_PER_TYPE);
  const strong = find(analyze(base({ products, searchTerms: [{ q: 'cravate', count: 20 }, { q: 'parapluie', count: 2 }] })), 'search:');
  check('plus une recherche est fréquente, plus l’impact et la confiance sont forts', strong[0].title.includes('cravate') && strong[0].impact > strong[1].impact && strong[0].confidence > strong[1].confidence);
}

// ---------- 5. catégories très regardées, peu converties ----------
{
  const withCats = (over: { a?: Partial<RadarProduct>; b?: Partial<RadarProduct>; c?: Partial<RadarProduct> } = {}) => [
    prod({ categoryId: CAT_A, name: 'Montre A', views: P(400, 380), intents: P(40, 38), ...over.a }),
    prod({ categoryId: CAT_B, name: 'Parfum B', views: P(300, 310), intents: P(30, 31), ...over.b }),
    prod({ categoryId: CAT_C, name: 'Chaussure C', views: P(500, 480), intents: P(5, 40), ...over.c }),
  ];
  const f = find(analyze(base({ products: withCats() })), 'category:');
  check('catégorie très regardée (500 consultations) mais 1 % d’intentions contre 6,25 % ailleurs : signalée, les deux autres non', f.length === 1 && f[0].key === `category:${CAT_C}:w30` && /Chaussures/.test(f[0].title), f.map((x) => x.title));
  check('constat : consultations, intentions, taux, moyenne des autres, nombre d’articles — chacun avec sa source', f[0].facts.length >= 4 && f[0].facts.every((x) => x.source.length > 2) && f[0].facts.some((x) => /1,0 %/.test(x.value)));
  check('hypothèses étiquetées, jamais « le prix est trop élevé » affirmé', f[0].hypotheses.length === 2 && f[0].hypotheses.every((h) => h.startsWith('Hypothèse')) && !/est trop|sont trop/.test(f[0].hypotheses.join(' ')));
  check('sans commandes enregistrées, aucun taux de commande n’est inventé : seules les intentions servent', !f[0].facts.some((x) => x.source === 'orders'));
  const withOrders = find(analyze(base({ ordersEver: 80, traffic: { sessions: P(1000, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(12, 10), searches: P(100, 100) }, products: withCats({ c: { orders: P(0) } }) })), 'category:');
  check('avec assez de commandes (12), le nombre de commandes de la catégorie s’ajoute aux constats', withOrders[0].facts.some((x) => x.source === 'orders'));
  check('proposition : « catalog.review_category » avec l’identifiant de la catégorie', f[0].proposed[0].type === 'catalog.review_category' && f[0].proposed[0].params.category_id === CAT_C);
  check('catégorie peu regardée (moins de 100 consultations) : jamais signalée, même à 0 % d’intentions', find(analyze(base({ products: withCats({ c: { views: P(80, 70), intents: P(0, 0) } }) })), 'category:').length === 0);
  check('une seule catégorie assez regardée : rien à comparer', find(analyze(base({ products: [prod({ categoryId: CAT_A, views: P(500), intents: P(1) })] })), 'category:').length === 0);
  check('moins de 10 intentions au total : trop peu pour conclure', find(analyze(base({ products: withCats({ a: { intents: P(3) }, b: { intents: P(3) }, c: { intents: P(1) } }) })), 'category:').length === 0);
  check('période de 7 jours : seuil de consultations réduit à 30 (proportionnel)', find(analyze(base({ windowDays: 7, products: [prod({ categoryId: CAT_A, views: P(40), intents: P(8) }), prod({ categoryId: CAT_B, views: P(40), intents: P(8) }), prod({ categoryId: CAT_C, views: P(60), intents: P(1) })] })), 'category:').length === 1);
}

// ---------- 6. articles populaires et en hausse ----------
{
  const products = [
    prod({ name: 'Star', views: P(300, 100), favorites: P(20, 5), stock: 12 }),
    prod({ name: 'Deuxième', views: P(120, 110), stock: 4 }),
    prod({ name: 'Épuisé', views: P(900, 10), stock: 0 }),
    prod({ name: 'Désactivé', views: P(800, 10), active: false }),
    prod({ name: 'Calme', views: P(5, 5) }),
  ];
  const r = analyze(base({ products, traffic: { sessions: P(1000, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } }));
  const pop = find(r, 'popular:')[0];
  check('populaires : un seul constat, les articles ACTIFS et EN STOCK les plus regardés, dans l’ordre', !!pop && pop.facts.length === 2 && pop.facts[0].label === 'Star' && pop.facts[1].label === 'Deuxième', pop?.facts);
  check('populaires : ni l’épuisé, ni le désactivé, ni l’article trop peu regardé', !JSON.stringify(pop.facts).match(/Épuisé|Désactivé|Calme/));
  check('populaires : chaque ligne donne consultations, période d’avant, favoris et stock, avec sa source', /300 consultations \(avant : 100\), 20 favoris, stock 12/.test(pop.facts[0].value) && pop.facts[0].source.includes('product_views'));
  check('populaires : proposition = préparer la campagne du jour en SIMULATION (rien n’est envoyé)', pop.proposed.length === 1 && pop.proposed[0].type === 'marketing.prepare_campaign' && pop.proposed[0].params.date === '2026-10-25' && /simulation/.test(pop.proposed[0].label));
  const rising = find(r, 'rising:')[0];
  check('en hausse : seul « Star » (×3), pas « Deuxième » (+9 %)', !!rising && rising.facts.length === 1 && rising.facts[0].label === 'Star' && /\+200 %/.test(rising.facts[0].value), rising?.facts);
  check('en hausse : aucun article sans base de comparaison (moins de 5 consultations avant) n’est dit « en hausse »', find(analyze(base({ products: [prod({ name: 'Nouveau', views: P(200, 2) })] })), 'rising:').length === 0);
}

// ---------- 7. stock ----------
{
  const products = [
    prod({ name: 'Rare et demandé', stock: 2, views: P(60, 20), intents: P(7) }),
    prod({ name: 'Rare peu vu', stock: 2, views: P(3, 2) }),
    prod({ name: 'Stock correct', stock: 4, views: P(100, 90) }),
    prod({ name: 'Épuisé demandé', stock: 0, views: P(80, 30) }),
    prod({ name: 'Désactivé demandé', active: false, stock: 5, views: P(50, 10) }),
    prod({ name: 'Épuisé oublié', stock: 0, views: P(1, 0) }),
  ];
  const r = analyze(base({ products }));
  const low = find(r, 'stock:low:');
  const gone = find(r, 'unavailable:');
  check('stock : « Rare et demandé » (2 en stock, 60 consultations) signalé ; pas le rare peu vu, pas le stock de 4', low.length === 1 && /Rare et demandé/.test(low[0].title) && /plus que 2/.test(low[0].title));
  check('stock : faits (stock, consultations avant/après, intentions) + hypothèse étiquetée', low[0].facts.length === 3 && low[0].hypotheses.length === 1 && low[0].hypotheses[0].startsWith('Hypothèse'));
  check('indisponible mais regardé : l’épuisé et le désactivé signalés, pas celui à 1 consultation', gone.length === 2 && gone.some((g) => /Épuisé demandé/.test(g.title)) && gone.some((g) => /Désactivé demandé/.test(g.title)));
  check('indisponible : le radar dit qu’il ignore QUAND l’article a disparu (consultations possiblement antérieures) et baisse sa confiance', gone.every((g) => g.hypotheses.some((h) => /ont pu avoir lieu avant/.test(h)) && g.confidence <= 0.7));
  check('stock : propositions = recommandations de réapprovisionnement (jamais une modification de prix ni de stock)', [...low, ...gone].every((f) => f.proposed.length === 1 && f.proposed[0].type === 'catalog.suggest_restock'));
}

// ---------- 8. campagne possible ----------
{
  const m = (over = {}) => ({ accounts: 500, consentPromotions: 450, flashActive: 0, newArrivals14d: 0, ...over });
  check('campagne : ni vente flash ni nouveautés -> aucune occasion signalée', find(analyze(base({ marketing: m() })), 'marketing:').length === 0);
  check('campagne : personne n’a donné son accord -> rien (jamais de suggestion sans personne à qui écrire)', find(analyze(base({ marketing: m({ consentPromotions: 0, flashActive: 3 }) })), 'marketing:').length === 0);
  const f = find(analyze(base({ marketing: m({ flashActive: 2, newArrivals14d: 5 }) })), 'marketing:')[0];
  check('campagne : vente flash + nouveautés -> signalée avec les chiffres de la base et sa source', !!f && /vente flash est en cours et 5 nouveautés/.test(f.title) && f.facts.length === 3 && f.facts[0].value === '450 sur 500');
  check('campagne : hypothèse = effet NON mesuré tant que rien n’a été envoyé', f.hypotheses.length === 1 && /non mesuré/.test(f.hypotheses[0]) && f.confidence === 0.6);
  check('campagne : proposition = préparer en simulation seulement', f.proposed[0].type === 'marketing.prepare_campaign');
  check('campagne : une vente flash pèse plus qu’une simple nouveauté', f.impact > find(analyze(base({ marketing: m({ newArrivals14d: 5 }) })), 'marketing:')[0].impact);
}

// ---------- 9. classement ----------
{
  const products = [prod({ name: 'Rare et demandé', stock: 1, views: P(70, 20) }), prod({ name: 'Star', views: P(300, 100) })];
  const r = analyze(base({ products, searchTerms: [{ q: 'cravate', count: 6 }], traffic: { sessions: P(500, 1000), views: P(2000, 2000), intents: P(100, 100), orders: P(0, 0), searches: P(100, 100) } }));
  const ps = r.findings.map((f) => f.priority);
  check('classement : par priorité décroissante, à égalité par clé (toujours le même ordre)', ps.every((p, i) => i === 0 || ps[i - 1] >= p) && r.findings.length >= 4, r.findings.map((f) => [f.key, f.priority]));
  const f = r.findings.find((x) => x.key.startsWith('search:'))!;
  const expected = Math.round(((f.impact * f.confidence * 1) / 1.2) * 10) / 10;
  check('priorité = impact × confiance × facteur de risque ÷ facteur de coût (risque faible = 1, coût faible = 1,2)', f.priority === expected, [f.priority, expected]);
  const costly = r.findings.find((x) => x.cost === 'medium');
  check('à impact et confiance égaux, un coût moyen (÷ 1,8) classe moins haut qu’un coût nul', !!costly && costly.priority <= Math.round(costly.impact * costly.confidence * 10) / 10);
}

// ---------- 10. invariants sur un scénario complet ----------
{
  const products = [
    ...[0, 1, 2].map((i) => prod({ categoryId: [CAT_A, CAT_B, CAT_C][i], name: ['Montre Alpha', 'Parfum Beta', 'Chaussure Gamma'][i], views: P([400, 300, 500][i], 300), intents: P([40, 30, 5][i], 30), favorites: P(9, 4), stock: [3, 9, 0][i] })),
    prod({ categoryId: CAT_A, name: 'Montre Delta', views: P(90, 20), intents: P(10), stock: 2 }),
  ];
  const input = base({ ordersEver: 0, products, searchTerms: [{ q: 'cravate', count: 8 }, { q: 'parapluie', count: 3 }], marketing: { accounts: 514, consentPromotions: 498, flashActive: 1, newArrivals14d: 4 }, traffic: { sessions: P(700, 1000), views: P(2000, 2000), intents: P(100, 60), orders: P(0, 0), searches: P(100, 100) } });
  const r = analyze(input);
  check('scénario complet : plusieurs constats de types différents', new Set(r.findings.map((f) => f.type)).size >= 5, r.findings.map((f) => f.type));
  check('chaque constat a au moins UN fait avec sa source', r.findings.every((f) => f.facts.length >= 1 && f.facts.every((x) => x.label && x.value && x.source)));
  check('chaque hypothèse commence par « Hypothèse » ; la cause n’est établie nulle part', r.findings.every((f) => f.hypotheses.every((h) => h.startsWith('Hypothèse')) && f.causeEstablished === false));
  check('impact entre 0 et 100, confiance entre 0 et 1, priorité positive', r.findings.every((f) => f.impact >= 0 && f.impact <= 100 && f.confidence >= 0 && f.confidence <= 1 && f.priority >= 0));
  check('clés uniques', new Set(r.findings.map((f) => f.key)).size === r.findings.length);
  check('chaque constat explique son impact', r.findings.every((f) => f.impactNote.length > 20));
  const all = JSON.stringify(r);
  check('aucune donnée personnelle dans le rapport (pas d’adresse e-mail, pas de numéro de téléphone)', !/@|\+?235\d{8}/.test(all.replace(/@gmail/g, '')) && !/@/.test(all));

  // le radar propose ; le moteur d'actions décide — chaque proposition doit être valide pour lui
  const proposals = r.findings.flatMap((f: Finding) => f.proposed);
  check('le scénario produit des propositions de plusieurs sortes', new Set(proposals.map((p) => p.type)).size >= 3, proposals.map((p) => p.type));
  check('toutes les propositions du radar sont connues du registre et leurs paramètres passent le schéma strict', proposals.every((p) => { const s = specOf(p.type); return !!s && (validateParams(s.schema, p.params) as { ok: boolean }).ok; }), proposals);
  const live: IntelState = { mode: 'live', killSwitch: false, grants: PERMISSIONS, preapproved: [], limitOverrides: {} };
  const verdicts = proposals.map((p) => decide({ type: p.type, params: p.params, source: 'rule' }, live, { now: NOW, history: [], approvals: [], plannedInRun: {} }).kind);
  check('toutes les propositions du radar sont à faible risque : le moteur les accepte sans approbation (recommandations ou simulations)', verdicts.every((v) => v === 'allow'), verdicts);
  check('le radar ne propose JAMAIS d’action sensible ni interdite (prix, remise, remboursement, budget, règles)', proposals.every((p) => !['catalog.price_change', 'promo.exceptional_discount', 'order.refund', 'ads.budget_change', 'loyalty.rules_change', 'permissions.change', 'code.modify'].includes(p.type)));
  check('le radar ne propose jamais d’envoyer quoi que ce soit : seulement préparer', proposals.every((p) => p.type !== 'marketing.send_campaign' && p.type !== 'loyalty.send_message'));
}

// ---------- 11. pureté ----------
{
  const deepFreeze = <T>(o: T): T => {
    if (o && typeof o === 'object') {
      Object.freeze(o);
      for (const v of Object.values(o as object)) deepFreeze(v);
    }
    return o;
  };
  const input = deepFreeze(base({ products: [prod({ name: 'Star', views: P(300, 100) })], searchTerms: [{ q: 'cravate', count: 5 }] }));
  let threw = false;
  let a: unknown;
  let b: unknown;
  try {
    a = analyze(input);
    b = analyze(input);
  } catch {
    threw = true;
  }
  check('analyser ne modifie rien (entrées gelées) et donne le même résultat à chaque fois', !threw && JSON.stringify(a) === JSON.stringify(b));
  const empty = analyze(base({ ordersEver: 10, traffic: { sessions: P(0, 0), views: P(0, 0), intents: P(0, 0), orders: P(0, 0), searches: P(0, 0) } }));
  check('aucune donnée : aucun constat inventé', empty.findings.length === 0 && empty.kpis.length === 5 && empty.kpis.every((k) => k.deltaPct === null));
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
