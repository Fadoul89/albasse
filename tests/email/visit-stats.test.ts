// Vrais chiffres des visites : lecture du résultat de la base, « vraie visite », libellés, lecture page par page. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/visit-stats.test.ts
import {
  MAX_PAGES,
  PAGE_SIZE,
  REAL_VISIT_SECONDS,
  campaignLabel,
  fetchAllPages,
  isRealVisit,
  parseCustomerActivity,
  parseVisitOverview,
  realVisitsLabel,
  sharePercent,
} from '../../src/lib/visitStats.ts';

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

// ---- « vraie visite » : 20 secondes, 2 pages ou connecté (même règle que le script SQL)
check('le seuil est de 20 secondes', REAL_VISIT_SECONDS === 20);
check('0 s, 1 page, pas connecté : pas une vraie visite', !isRealVisit({ duration_seconds: 0, page_views: 1, user_id: null }));
check('19 s : pas encore', !isRealVisit({ duration_seconds: 19, page_views: 1 }));
check('20 s : vraie visite', isRealVisit({ duration_seconds: 20, page_views: 1 }));
check('2 pages : vraie visite', isRealVisit({ duration_seconds: 0, page_views: 2 }));
check('connecté : vraie visite', isRealVisit({ duration_seconds: 0, page_views: 1, user_id: 'u1' }));
check('champs absents : pas une vraie visite (1 page par défaut)', !isRealVisit({}) && !isRealVisit({ duration_seconds: null, page_views: null, user_id: null }));

// ---- résultat de admin_visit_overview
const raw = {
  sessions: 1839,
  visitors: 1618,
  real_sessions: 12,
  real_visitors: 11,
  by_source: [
    { source: 'Publicité / campagne', sessions: 1671, visitors: 1503, real_sessions: 0, real_visitors: 0, product_views: 3, cart_adds: 0, orders: 0, revenue: 0 },
    { source: 'Accès direct', sessions: 117, visitors: 88, real_sessions: 21, real_visitors: '18', product_views: 400, cart_adds: 20, orders: 2, revenue: '30000.50' },
    { source: '', sessions: 5 }, // sans nom : ignorée
    { source: 'Mauvaise', sessions: 'x' }, // nombre illisible : ignorée
    'pas un objet',
  ],
  by_campaign: [
    { source: 'Publicité / campagne', medium: 'paid', campaign: '120253099938360325', sessions: 415, real_sessions: 0 },
    { source: 'Publicité / campagne', medium: '-', campaign: 'sans-medium', sessions: 3, real_sessions: 1 },
    { campaign: null, sessions: 4 },
  ],
  top_viewed: [{ product_id: 'p1', views: 300 }, { product_id: null, views: 5 }, { product_id: 'p2', views: '120' }],
};
const o = parseVisitOverview(raw);
check('résultat lu : 1 839 visites, 1 618 visiteurs, 12 vraies visites, 11 vrais visiteurs', !!o && o.sessions === 1839 && o.visitors === 1618 && o.realSessions === 12 && o.realVisitors === 11, o);
check('2 sources valides (la sans-nom, l\'illisible et le texte sont ignorés)', !!o && o.bySource.length === 2 && o.bySource[0].source === 'Publicité / campagne' && o.bySource[1].source === 'Accès direct', o?.bySource);
check('un nombre écrit en texte est lu (18 vrais visiteurs, 30 000,5 FCFA)', !!o && o.bySource[1].realVisitors === 18 && o.bySource[1].revenue === 30000.5 && o.bySource[1].orders === 2 && o.bySource[1].productViews === 400);
check('2 campagnes valides (celle sans numéro est ignorée)', !!o && o.byCampaign.length === 2 && o.byCampaign[0].campaign === '120253099938360325' && o.byCampaign[0].medium === 'paid' && o.byCampaign[0].realSessions === 0, o?.byCampaign);
check('articles les plus vus : 2 valides (sans identifiant : ignoré), nombre en texte lu', !!o && o.topViewed.length === 2 && o.topViewed[1].productId === 'p2' && o.topViewed[1].views === 120, o?.topViewed);
check('résultat vide mais correct : des zéros et des listes vides', JSON.stringify(parseVisitOverview({ sessions: 0, visitors: 0, real_sessions: 0, real_visitors: 0 })) === JSON.stringify({ sessions: 0, visitors: 0, realSessions: 0, realVisitors: 0, bySource: [], byCampaign: [], topViewed: [] }));
check('script SQL pas lancé / refus / texte : null (l\'ancien calcul reste)',
  parseVisitOverview(null) === null && parseVisitOverview(undefined) === null && parseVisitOverview('x') === null && parseVisitOverview([]) === null && parseVisitOverview({}) === null && parseVisitOverview({ sessions: 5 }) === null);

// ---- résultat de admin_customer_activity
const act = parseCustomerActivity([
  { user_id: 'u1', sessions: 4, duration_seconds: 160, last_seen_at: '2026-10-31T10:00:00Z', top_source: 'Facebook', views: 2, cart_adds: 1 },
  { user_id: 'u2', sessions: 0, duration_seconds: 0, last_seen_at: null, top_source: null, views: 2, cart_adds: 0 },
  { user_id: '', sessions: 9 },
  'x',
]);
check('activité : 2 clients lus (identifiant vide et texte ignorés)', !!act && act.size === 2);
check('client 1 : 4 visites, 160 s, Facebook, 2 vus, 1 ajout', !!act && act.get('u1')?.sessions === 4 && act.get('u1')?.durationSeconds === 160 && act.get('u1')?.topSource === 'Facebook' && act.get('u1')?.views === 2 && act.get('u1')?.cartAdds === 1);
check('client 2 : aucune visite mais 2 articles vus, dates vides = null', !!act && act.get('u2')?.sessions === 0 && act.get('u2')?.lastSeenAt === null && act.get('u2')?.topSource === null && act.get('u2')?.views === 2);
check('client absent de la liste : rien (0 partout côté écran)', !!act && act.get('inconnu') === undefined);
check('liste vide : une table vide (pas null)', parseCustomerActivity([])?.size === 0);
check('pas une liste : null (secours)', parseCustomerActivity(null) === null && parseCustomerActivity({}) === null && parseCustomerActivity('x') === null);

// ---- libellés
check('part de vraies visites : 68 %, 4 %, « <1 % » (1 sur 1 524), « 0 % » (aucune), « — » (sans visite)',
  sharePercent(60, 88) === '68 %' && sharePercent(4, 89) === '4 %' && sharePercent(1, 1524) === '<1 %' && sharePercent(0, 1524) === '0 %' && sharePercent(0, 0) === '—' && sharePercent(2, 3) === '67 %' && sharePercent(1, 100) === '1 %');
check('« 5 sur 1638 (<1 %) » ; « 120 sur 1618 (7 %) » ; sans visite « 0 sur 0 (—) »',
  realVisitsLabel(5, 1638) === '5 sur 1638 (<1 %)' && realVisitsLabel(120, 1618) === '120 sur 1618 (7 %)' && realVisitsLabel(0, 0) === '0 sur 0 (—)', [realVisitsLabel(5, 1638), realVisitsLabel(120, 1618), realVisitsLabel(0, 0)]);
check('campagne : le numéro seul pour « paid » (celui du Gestionnaire Meta) ; un autre média est ajouté ; sans média : le numéro',
  campaignLabel({ medium: 'paid', campaign: 'c1' }) === 'c1' && campaignLabel({ medium: 'email', campaign: 'c4' }) === 'email · c4' && campaignLabel({ medium: '-', campaign: 'c2' }) === 'c2' && campaignLabel({ medium: '', campaign: 'c3' }) === 'c3');

// ---- lecture page par page (la base renvoie au plus 1 000 lignes par demande)
const fake = (total: number, calls: [number, number][] = []) => (from: number, to: number) => {
  calls.push([from, to]);
  const rows: number[] = [];
  for (let i = from; i <= to && i < total; i++) rows.push(i);
  return Promise.resolve({ data: rows, error: null });
};
{
  const calls: [number, number][] = [];
  const all = await fetchAllPages<number>(fake(2500, calls));
  check('2 500 lignes : 3 demandes (0-999, 1000-1999, 2000-2999), rien de perdu', PAGE_SIZE === 1000 && all.length === 2500 && calls.length === 3 && calls[1][0] === 1000 && calls[2][1] === 2999 && all[2499] === 2499, calls);
}
{
  const calls: [number, number][] = [];
  const all = await fetchAllPages<number>(fake(543, calls));
  check('543 lignes : une seule demande', all.length === 543 && calls.length === 1);
}
{
  const calls: [number, number][] = [];
  const all = await fetchAllPages<number>(fake(2000, calls));
  check('exactement 2 000 lignes : 3 demandes (la dernière est vide), 2 000 lignes', all.length === 2000 && calls.length === 3, calls.length);
}
check('aucune ligne : liste vide', (await fetchAllPages<number>(fake(0))).length === 0);
{
  const all = await fetchAllPages<number>(() => Promise.resolve({ data: null, error: { message: 'refus' } }));
  check('erreur à la première page : liste vide, sans planter', all.length === 0);
}
{
  let n = 0;
  const all = await fetchAllPages<number>((from) => {
    n++;
    return n === 2 ? Promise.resolve({ data: null, error: { message: 'réseau' } }) : Promise.resolve({ data: Array.from({ length: PAGE_SIZE }, (_, i) => from + i), error: null });
  });
  check('erreur à la 2e page : on garde la première (1 000 lignes)', all.length === 1000);
}
{
  // une base qui ignorerait « range » et renverrait toujours 1 000 lignes ne doit pas faire tourner la boucle sans fin
  let n = 0;
  const all = await fetchAllPages<number>(() => {
    n++;
    return Promise.resolve({ data: Array.from({ length: PAGE_SIZE }, (_, i) => i), error: null });
  });
  check(`garde-fou : au plus ${MAX_PAGES} pages`, n === MAX_PAGES && all.length === MAX_PAGES * PAGE_SIZE, n);
}

console.log(`\n${ok} contrôles réussis`);
