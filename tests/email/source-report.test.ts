// Page « Performance par source » : lecture du rapport exact de la base (admin_source_report), classement automatique. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/source-report.test.ts
import { buildLeaderboard, conversionRate, parseSourceReport } from '../../src/lib/sourceReport.ts';

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

// la liste de la page (même ordre que TRAFFIC_SOURCES)
const SOURCES = ['TikTok', 'Facebook', 'Instagram', 'Google', 'WhatsApp', 'Accès direct', 'Publicité / campagne', 'Autre'] as const;

const raw = {
  totals: { sessions: 1863, visitors: 1638, real_sessions: 51, real_visitors: 5 },
  sources: [
    { source: 'Publicité / campagne', sessions: 1693, visitors: 1524, new_visitors: 1500, avg_time_seconds: 0, pages_viewed: 1693, product_views: 1607, cart_adds: 8, orders: 0, revenue: 0, real_sessions: 1, real_visitors: 1 },
    { source: 'TikTok', sessions: 8339, visitors: '7125', new_visitors: 5000, avg_time_seconds: 31, pages_viewed: 20000, product_views: 3765, cart_adds: 110, orders: 12, revenue: '300500.5', real_sessions: 1559, real_visitors: 1469 },
    { source: 'Source inconnue de la page', sessions: 3, visitors: 3 }, // pas dans la liste : ignorée
    { source: '', sessions: 4 }, // sans nom : ignorée
    { source: 'Google', sessions: 'x' }, // nombre illisible : ignorée
    'pas un objet',
  ],
  campaigns: [
    { campaign: '120253099938360325', medium: 'paid', source: 'Publicité / campagne', sessions: 415, visitors: 386, real_sessions: 1, real_visitors: 1, orders: 0, revenue: 0 },
    { campaign: 'c-tik', medium: null, source: 'TikTok', sessions: 10, visitors: 8, real_sessions: 6, real_visitors: 5, orders: 2, revenue: 50000 },
    { campaign: 'c-bizarre', medium: 'paid', source: 'Une source hors liste', sessions: 2, visitors: 2 },
    { campaign: '', visitors: 4 },
    { campaign: 'c-sans-nombre', visitors: 'x' },
  ],
};
const r = parseSourceReport(raw, SOURCES);
check('rapport lu : 1 863 visites, 1 638 visiteurs, 51 vraies visites, 5 vrais visiteurs', !!r && r.totals.sessions === 1863 && r.totals.visitors === 1638 && r.totals.realSessions === 51 && r.totals.realVisitors === 5, r?.totals);
check('une ligne par source de la page, dans son ordre (8), même celles sans visite', !!r && r.rows.length === 8 && r.rows.map((x) => x.source).join('|') === SOURCES.join('|'));
const tik = r?.rows.find((x) => x.source === 'TikTok');
check('TikTok : visiteurs écrits en texte lus (7 125), 5 000 nouveaux, 2 125 revenants, 31 s, 20 000 pages', !!tik && tik.visitors === 7125 && tik.newVisitors === 5000 && tik.returningVisitors === 2125 && tik.avgTimeSeconds === 31 && tik.pagesViewed === 20000, tik);
check('TikTok : 3 765 articles vus, 110 paniers, 12 commandes, 300 500,50 FCFA, 1 469 vrais visiteurs', !!tik && tik.productViews === 3765 && tik.cartAdds === 110 && tik.orders === 12 && tik.revenue === 300500.5 && tik.realVisitors === 1469, tik);
check('TikTok : conversion = 12 / 7 125 = 0,17 %', !!tik && Math.abs(tik.conversionRate - (12 / 7125) * 100) < 1e-9, tik?.conversionRate);
const ads = r?.rows.find((x) => x.source === 'Publicité / campagne');
check('Publicité : 1 524 visiteurs, 1 vrai visiteur, 0 commande, conversion 0', !!ads && ads.visitors === 1524 && ads.realVisitors === 1 && ads.orders === 0 && ads.conversionRate === 0, ads);
const wa = r?.rows.find((x) => x.source === 'WhatsApp');
check('une source sans visite (WhatsApp) : tout à zéro, 0 vrai visiteur (pas « absent »)', !!wa && wa.visitors === 0 && wa.orders === 0 && wa.revenue === 0 && wa.conversionRate === 0 && wa.realVisitors === 0, wa);
check('la source qui n\'est pas dans la liste de la page est ignorée (elle n\'ajoute pas de ligne)', !!r && !r.rows.some((x) => (x.source as string) === 'Source inconnue de la page'));
check('campagnes : 3 valides (sans nom et sans nombre : ignorées), dans l\'ordre reçu', !!r && r.campaigns.length === 3 && r.campaigns[0].campaign === '120253099938360325' && r.campaigns[1].campaign === 'c-tik' && r.campaigns[2].campaign === 'c-bizarre', r?.campaigns.map((c) => c.campaign));
check('campagne Meta : média paid, 386 visiteurs, 1 vrai, conversion 0', !!r && r.campaigns[0].medium === 'paid' && r.campaigns[0].visitors === 386 && r.campaigns[0].realVisitors === 1 && r.campaigns[0].conversionRate === 0);
check('campagne c-tik : sans média (null), 8 visiteurs, 2 commandes, 50 000 FCFA, conversion 25 %', !!r && r.campaigns[1].medium === null && r.campaigns[1].orders === 2 && r.campaigns[1].revenue === 50000 && r.campaigns[1].conversionRate === 25);
check('campagne d\'une source hors liste : rangée dans « Autre »', !!r && r.campaigns[2].source === 'Autre');
check('résultat vide mais correct (période sans visite) : 8 lignes à zéro, aucune campagne',
  (() => {
    const e = parseSourceReport({ totals: { sessions: 0, visitors: 0, real_sessions: 0, real_visitors: 0 }, sources: [], campaigns: [] }, SOURCES);
    return !!e && e.rows.length === 8 && e.rows.every((x) => x.visitors === 0 && x.realVisitors === 0) && e.campaigns.length === 0 && e.totals.sessions === 0;
  })());
check('script SQL pas lancé / refus / texte / liste : null (l\'ancien calcul de la page reste)',
  parseSourceReport(null, SOURCES) === null && parseSourceReport(undefined, SOURCES) === null && parseSourceReport('x', SOURCES) === null && parseSourceReport([], SOURCES) === null
  && parseSourceReport({}, SOURCES) === null && parseSourceReport({ totals: { sessions: 1 }, sources: [], campaigns: [] }, SOURCES) === null
  && parseSourceReport({ totals: { sessions: 1, visitors: 1, real_sessions: 0, real_visitors: 0 } }, SOURCES) === null);
check('nouveaux > visiteurs (donnée incohérente) : jamais de revenants négatifs', (() => {
  const e = parseSourceReport({ totals: { sessions: 1, visitors: 1, real_sessions: 0, real_visitors: 0 }, sources: [{ source: 'TikTok', sessions: 1, visitors: 1, new_visitors: 3 }], campaigns: [] }, SOURCES);
  return !!e && e.rows[0].returningVisitors === 0;
})());

// ---- conversion et classement automatique
check('conversion : 12 sur 7 125 ; sans visiteur = 0', conversionRate(0, 0) === 0 && conversionRate(5, 0) === 0 && conversionRate(1, 4) === 25);
const lb = buildLeaderboard(r!.rows);
check('classement : meilleure vente TikTok, meilleure conversion TikTok, plus de visiteurs TikTok, plus long temps TikTok', lb.bestSales === 'TikTok' && lb.bestConversion === 'TikTok' && lb.mostVisitors === 'TikTok' && lb.longestAvgTime === 'TikTok', lb);
const none = buildLeaderboard(parseSourceReport({ totals: { sessions: 0, visitors: 0, real_sessions: 0, real_visitors: 0 }, sources: [], campaigns: [] }, SOURCES)!.rows);
check('classement sans aucune donnée : « — » partout (null), jamais une source à zéro', none.bestSales === null && none.bestConversion === null && none.mostVisitors === null && none.longestAvgTime === null, none);
const mixed = parseSourceReport({
  totals: { sessions: 30, visitors: 30, real_sessions: 0, real_visitors: 0 },
  sources: [
    { source: 'Facebook', sessions: 10, visitors: 10, avg_time_seconds: 90, orders: 0, revenue: 0 },
    { source: 'Google', sessions: 20, visitors: 20, avg_time_seconds: 10, orders: 4, revenue: 80000 },
  ],
  campaigns: [],
}, SOURCES)!;
const lb2 = buildLeaderboard(mixed.rows);
check('classement : Google gagne en ventes, conversion (20 %) et visiteurs ; Facebook a le plus long temps (90 s)', lb2.bestSales === 'Google' && lb2.bestConversion === 'Google' && lb2.mostVisitors === 'Google' && lb2.longestAvgTime === 'Facebook', lb2);

console.log(`\n${ok} contrôles réussis`);
