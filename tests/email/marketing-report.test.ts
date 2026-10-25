// Zara Marketing Intelligence : le rapport (supabase/functions/brevo-email/marketingReport.ts), avec une fausse base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing-report.test.ts
import { computeReport, loadReport, type ReportRow } from '../../supabase/functions/brevo-email/marketingReport.ts';
import { fakeDb } from './fakeSupabase.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 500));
    process.exitCode = 1;
  }
};
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

const row = (over: Partial<ReportRow> = {}): ReportRow => ({ user_id: 'u1', segment: 'inactive', variant: 'A', status: 'sent', sent_at: iso(NOW - 2 * DAY), provider_message_id: '<m@x>', delivered_at: null, click_count: 0, bounce_type: null, complaint_at: null, events_synced_at: null, error: null, ...over });
const synced = (over: Partial<ReportRow> = {}) => row({ events_synced_at: iso(NOW - 3600_000), delivered_at: iso(NOW - 2 * DAY + 5000), ...over });

{
  const r = computeReport({
    now: NOW,
    days: 30,
    rows: [
      synced({ user_id: 'u1', click_count: 2 }),
      synced({ user_id: 'u2', variant: 'B' }),
      synced({ user_id: 'u3', delivered_at: null, bounce_type: 'hard' }),
      synced({ user_id: 'u4', complaint_at: iso(NOW - DAY) }),
      row({ user_id: 'u5' }), // acceptée, événements pas encore lus
      row({ user_id: 'u6', provider_message_id: null }), // acceptée sans identifiant Brevo
      row({ user_id: 'u7', status: 'failed', error: '400 Sender not valid', sent_at: null, provider_message_id: null }),
      row({ user_id: 'u8', status: 'skipped', error: 'desinscrit', sent_at: null, provider_message_id: null }),
      row({ user_id: 'u9', status: 'skipped', error: 'desinscrit', sent_at: null, provider_message_id: null }),
      row({ user_id: 'u10', status: 'pending', sent_at: null, provider_message_id: null }),
      synced({ user_id: 'u11', segment: 'flash', variant: 'C', click_count: 1 }),
    ],
    unsubscribes: [
      { user_id: 'u2', unsubscribed_at: iso(NOW - 2 * DAY + 3600_000) }, // dans les 7 jours : compté
      { user_id: 'u1', unsubscribed_at: iso(NOW - 40 * DAY) }, // avant l'e-mail : pas compté
      { user_id: 'inconnu', unsubscribed_at: iso(NOW) }, // jamais reçu d'e-mail de campagne : pas compté
    ],
    orders: [
      { session_id: 's1', status: 'delivered', total: 30000, is_flagged_fake: false },
      { session_id: 's1', status: 'pending', total: 99999, is_flagged_fake: false },
      { session_id: 's2', status: 'delivered', total: 15000, is_flagged_fake: false },
      { session_id: 's2', status: 'delivered', total: 50000, is_flagged_fake: true }, // fausse : jamais comptée
      { session_id: 's2', status: 'cancelled', total: 70000, is_flagged_fake: false }, // annulée : jamais comptée
      { session_id: 's3', status: 'delivered', total: 40000, is_flagged_fake: false }, // session sans suivi e-mail
      { session_id: null, status: 'delivered', total: 12345, is_flagged_fake: false },
    ],
    sessions: [
      { id: 's1', utm_medium: 'email', utm_campaign: 'zmi-20261023-inactive' },
      { id: 's2', utm_medium: 'email', utm_campaign: 'zmi-20261024-new_arrivals' },
      { id: 's3', utm_medium: 'cpc', utm_campaign: 'zmi-20261024-inactive' }, // pas un e-mail
    ],
  });
  const t = r.totals;
  check('e-mails mis en file : 11 ; acceptés par Brevo : 7 ; confirmés (identifiant) : 6 ; en attente 1 ; refusés 1 ; annulés 2', t.queued === 11 && t.sent === 7 && t.confirmed === 6 && t.pending === 1 && t.failed === 1 && t.skipped === 2, t);
  check('seuls les e-mails dont les événements ont été lus chez Brevo sont « mesurés » (5, dont 4 livrés) ; 1 e-mail confirmé attend encore, 1 e-mail sans identifiant n’est jamais compté comme confirmé', t.measured === 5 && r.eventsAwaiting === 1 && t.delivered === 4 && t.confirmed - t.measured === 1, [t.measured, r.eventsAwaiting, t.delivered]);
  check('clics : 2 e-mails cliqués, 3 clics ; rebond dur 1 ; plainte 1', t.clicked === 2 && t.clicks === 3 && t.bounced === 1 && t.hardBounced === 1 && t.complaints === 1, t);
  check('désinscription comptée seulement dans les 7 jours après un e-mail de campagne reçu (1)', t.unsubscribed === 1 && r.bySegment.inactive.unsubscribed === 1 && r.byVariant.B.unsubscribed === 1, [t.unsubscribed, r.byVariant]);
  check('commandes attribuées : seulement celles dont la session porte le suivi e-mail, ni fausses, ni annulées, ni d’une autre source (3)', t.orders === 3 && r.attribution.orders === 3, t.orders);
  check('revenu attribué : seulement les commandes LIVRÉES (30 000 + 15 000), jamais la commande en attente', t.revenue === 45000 && r.attribution.revenue === 45000 && r.bySegment.inactive.revenue === 30000 && r.bySegment.new_arrivals.revenue === 15000, [t.revenue, r.bySegment.inactive.revenue]);
  check('comparaison des segments : tous les 7 segments présents, même ceux sans e-mail', Object.keys(r.bySegment).length >= 7 && r.bySegment.nurture.queued === 0 && r.bySegment.flash.queued === 1 && r.bySegment.flash.clicked === 1);
  check('comparaison des variantes A, B, C', r.byVariant.A.queued === 9 && r.byVariant.B.queued === 1 && r.byVariant.C.queued === 1, r.byVariant);
  check('raisons des échecs et des annulations, les plus fréquentes d’abord', r.errors[0].reason === 'desinscrit' && r.errors[0].count === 2 && r.errors.some((e) => /Sender not valid/.test(e.reason)), r.errors);
  check('note d’honnêteté sur l’attribution (dernier clic de la visite)', /autre visite/.test(r.attribution.note));
}
{
  const r = computeReport({ now: NOW, days: 30, rows: [], unsubscribes: [], orders: [], sessions: [] });
  check('aucun e-mail : tout à zéro, sans erreur', r.totals.queued === 0 && r.totals.revenue === 0 && r.errors.length === 0 && r.eventsAwaiting === 0);
}
// lecture dans la base (fausse) : les 4 tables, seulement ce qui est de la période
{
  const db = fakeDb(
    {
      email_outbox: [
        { id: 'a', kind: 'marketing', user_id: 'u1', segment: 'flash', variant: 'A', status: 'sent', sent_at: iso(NOW - DAY), provider_message_id: '<a@x>', delivered_at: iso(NOW - DAY), click_count: 1, bounce_type: null, complaint_at: null, events_synced_at: iso(NOW - 3600_000), error: null, created_at: iso(NOW - DAY) },
        { id: 'b', kind: 'welcome', user_id: 'u1', status: 'sent', created_at: iso(NOW - DAY) }, // pas une campagne
        { id: 'c', kind: 'marketing', user_id: 'u2', segment: 'flash', variant: 'B', status: 'sent', sent_at: iso(NOW - 90 * DAY), provider_message_id: '<c@x>', created_at: iso(NOW - 90 * DAY) }, // trop ancienne
      ],
      email_prefs: [{ user_id: 'u1', unsubscribed_at: iso(NOW - DAY + 3600_000) }],
      orders: [{ id: 'o1', session_id: 's1', status: 'delivered', total: 20000, is_flagged_fake: false, created_at: iso(NOW - DAY) }],
      visitor_sessions: [{ id: 's1', utm_medium: 'email', utm_campaign: 'zmi-20261024-flash', created_at: iso(NOW - DAY) }, { id: 's9', utm_medium: 'email', utm_campaign: 'autre', created_at: iso(NOW - DAY) }],
    },
    { now: () => NOW }
  );
  const r = await loadReport({ service: db.service, env: () => undefined, fetchFn: fetch, now: () => NOW }, 30);
  check('lecture : 1 e-mail de campagne de la période, 1 désinscription, 1 commande attribuée de 20 000', r.totals.queued === 1 && r.totals.unsubscribed === 1 && r.totals.orders === 1 && r.totals.revenue === 20000 && r.bySegment.flash.clicked === 1, r.totals);
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
