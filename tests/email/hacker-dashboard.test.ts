// Tableau de bord « couleur hacker » : règles d'affichage (src/lib/hackerDashboard.ts). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/hacker-dashboard.test.ts
import {
  PERIODS,
  change,
  compact,
  fcfa,
  litTicks,
  nb,
  orderRateText,
  parseOverview,
  periodTitle,
  shareOf,
  signupRate,
  sourceIcon,
  sourceLabel,
  terminalLine,
  weekBars,
} from '../../src/lib/hackerDashboard.ts';

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
const sp = (s: string) => s.replace(/[  ]/g, ' ');

// --- la réponse de la base (vrais chiffres du 16 novembre 2026, 30 jours)
const REAL = {
  period: '30d',
  since: '2026-10-17T10:00:00+00:00',
  visitors: 24180,
  visitors_prev: 7101,
  new_customers: 541,
  new_customers_prev: 9,
  orders: 1,
  orders_prev: 0,
  revenue: 0,
  products: 623,
  categories: 18,
  weeks: [
    { week: '2026-08-31', visitors: 412 },
    { week: '2026-09-07', visitors: 108 },
    { week: '2026-11-16', visitors: 120 },
  ],
  sources: [
    { source: 'TikTok', visitors: 13887 },
    { source: 'Publicité / campagne', visitors: 5685 },
    { source: '  ', visitors: 3 },
  ],
  top: [{ product_id: 'p1', name: 'COTTON SWISS\n  100 % coton', visitors: 1844 }, { product_id: 'p2', visitors: 4 }],
};
const o = parseOverview(REAL);
check('la réponse est lue', !!o);
check('chiffres principaux', o?.visitors === 24180 && o.visitorsPrev === 7101 && o.newCustomers === 541 && o.newCustomersPrev === 9 && o.orders === 1 && o.ordersPrev === 0 && o.revenue === 0 && o.products === 623 && o.categories === 18, o);
check('12 semaines gardées dans l\'ordre (ici 3)', o?.weeks.map((w) => w.week).join(',') === '2026-08-31,2026-09-07,2026-11-16');
check('source vide ignorée', o?.sources.length === 2 && o.sources[1].source === 'Publicité / campagne');
check('article sans nom ignoré, nom sur une ligne', o?.top.length === 1 && o.top[0].name === 'COTTON SWISS 100 % coton' && o.top[0].productId === 'p1');

// --- réponses illisibles : rien n'est inventé
check('null -> null', parseOverview(null) === null);
check('tableau -> null', parseOverview([1, 2]) === null);
check('texte -> null', parseOverview('ok') === null);
const bad = parseOverview({ visitors: -5, visitors_prev: 'abc', new_customers: 'x', weeks: [{ week: '16/11/2026', visitors: 3 }, null, { week: '2026-11-16', visitors: 'NaN' }], sources: 'non', top: null, period: 'hier' });
check('chiffre négatif ou illisible -> 0', bad?.visitors === 0 && bad.newCustomers === 0, bad);
check('chiffre d\'avant illisible -> pas de comparaison', bad?.visitorsPrev === null && bad.newCustomersPrev === null && bad.ordersPrev === null);
check('semaine au mauvais format ignorée', bad?.weeks.length === 1 && bad.weeks[0].visitors === 0, bad?.weeks);
check('listes absentes -> vides', bad?.sources.length === 0 && bad.top.length === 0);
check('période inconnue -> 30 jours', bad?.period === '30d');
check('période "Tout" : pas de chiffre d\'avant', parseOverview({ period: 'all', visitors: 9, visitors_prev: null })?.visitorsPrev === null);

// --- les périodes et la ligne de commande
check('4 périodes dans l\'ordre', PERIODS.map((p) => p.label).join('|') === "Aujourd'hui|7 jours|30 jours|Tout");
check('ligne de commande', terminalLine('7d') === 'root@albasse:~$ ./tableau_de_bord --7j' && terminalLine('all').endsWith('--tout'));
check('titres en français', periodTitle('today') === "aujourd'hui" && periodTitle('all') === 'depuis le début' && periodTitle('30d') === 'ces 30 derniers jours');

// --- les chiffres écrits
check('24 180 avec espace', sp(nb(24180)) === '24 180');
check('10,7k au-dessus des barres', compact(10738) === '10,7k' && compact(485) === '485' && compact(1000) === '1k');
check('FCFA', sp(fcfa(150000)) === '150 000 FCFA');

// --- l'évolution
const v = change(24180, 7101, '30d');
check('visiteurs : +241 % en vert', v?.text === "▲ +241 % vs 30 j d'avant" && v.trend === 'up', v);
const c = change(541, 9, '30d');
check('peu de chiffres avant : en nombre, pas en %', sp(c?.text ?? '') === "▲ +532 vs 30 j d'avant" && c?.trend === 'up', c);
const d = change(80, 100, '7d');
check('baisse : -20 % en rouge', d?.text === "▼ -20 % vs 7 j d'avant" && d.trend === 'down', d);
check('baisse en nombre', change(3, 5, 'today')?.text === '▼ -2 vs hier à la même heure');
check('égalité', change(5, 5, '7d')?.text === "= comme avant (7 j d'avant)" && change(5, 5, '7d')?.trend === 'flat');
check('"Tout" : pas de comparaison', change(100, 50, 'all') === null);
check('chiffre d\'avant inconnu : pas de comparaison', change(100, null, '30d') === null);
check('de 0 à 1 : +1, pas un % infini', change(1, 0, '30d')?.text === "▲ +1 vs 30 j d'avant");

// --- les barres
const bars = weekBars([
  { week: '2026-11-02', visitors: 1000 },
  { week: '2026-11-09', visitors: 5 },
  { week: '2026-11-16', visitors: 0 },
]);
check('hauteurs en % du plus haut', bars[0].height === 100 && bars[1].height === 2 && bars[2].height === 0, bars);
check('étiquettes JJ/MM', bars.map((b) => b.label).join(',') === '02/11,09/11,16/11');
check('seule la dernière est la semaine en cours', bars.map((b) => b.current).join(',') === 'false,false,true');
check('aucune visite : aucune barre', weekBars([{ week: '2026-11-16', visitors: 0 }])[0].height === 0 && weekBars([]).length === 0);

// --- la jauge
const r = signupRate(541, 24180);
check('2,2 % de comptes créés', r?.text === '2,2 %' && Math.abs((r?.pct ?? 0) - 2.237) < 0.01, r);
check('aucun visiteur : pas de jauge', signupRate(3, 0) === null);
check('jamais plus de 100 %', signupRate(50, 10)?.pct === 100);
check('traits allumés : 1 sur 36 pour 2,2 %', litTicks(2.237, 36) === 1);
check('au moins 1 trait dès qu\'il y a un compte', litTicks(0.01, 36) === 1 && litTicks(0, 36) === 0);
check('jamais plus que le total', litTicks(100, 36) === 36 && litTicks(150, 36) === 36);
check('commandes : moins de 0,1 %', sp(orderRateText(1, 24180)) === 'Commandes : 1 sur 24 180 (moins de 0,1 %)');
check('commandes : 0 %', orderRateText(0, 50) === 'Commandes : 0 sur 50 (0 %)');
check('commandes : 2,5 %', orderRateText(5, 200) === 'Commandes : 5 sur 200 (2,5 %)');
check('commandes sans visiteur', orderRateText(2, 0) === '2 commandes' && orderRateText(1, 0) === '1 commande');

// --- les sources et classements
check('icônes des sources', sourceIcon('TikTok') === '🎵' && sourceIcon('Publicité / campagne') === '📣' && sourceIcon('Accès direct') === '🔗' && sourceIcon('Facebook') === '📘' && sourceIcon('Google') === '🔎' && sourceIcon('Autre') === '·');
check('« Publicité / campagne » raccourci', sourceLabel('Publicité / campagne') === 'Publicité' && sourceLabel('TikTok') === 'TikTok');
check('largeur des barres de classement', shareOf(13887, 13887) === 100 && shareOf(41, 13887) === 1 && shareOf(0, 13887) === 0 && shareOf(5, 0) === 0);

console.log(`\n${ok} vérifications réussies${process.exitCode ? ', AU MOINS UNE ÉCHOUE' : ''}`);
