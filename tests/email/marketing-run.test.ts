// Zara Marketing Intelligence : le déroulement (supabase/functions/brevo-email/marketingRun.ts) et l'envoi des campagnes (drain.ts),
// avec une fausse base en mémoire (qui imite aussi le verrou « live » de la vraie base) et un faux Brevo.
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing-run.test.ts
import { approveRun, getSettings, runCheck, sendTestEmail, setMode, simulate, summarizeEvents, syncEvents, tick } from '../../supabase/functions/brevo-email/marketingRun.ts';
import { PROMO_BATCH, drain, type Deps } from '../../supabase/functions/brevo-email/drain.ts';
import { fakeDb, liveGuard, type Row } from './fakeSupabase.ts';

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
const quiet = console.error;
console.error = () => {}; // les refus de Brevo sont voulus dans ces essais

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KEY = 'xkeysib-' + 'f0e1d2c3b4a59687f0e1d2c3b4a59687f0e1d2c3b4a59687' + '-TopSecret99';
let NOW = Date.UTC(2026, 9, 25, 12, 0, 0); // 25 octobre 2026, 13 h à N'Djamena
const iso = (ms: number) => new Date(ms).toISOString();
const ago = (d: number) => iso(NOW - d * DAY);

interface Call { method: string; url: string; headers: Record<string, string>; body: any }
interface BrevoOpts { messageId?: boolean; sendStatus?: number; checkStatus?: number; limitedKey?: boolean; events?: Record<string, unknown[]>; eventsStatus?: number }

function world(o: { missing?: string[]; mode?: string; requireApproval?: boolean; runHour?: number; brevo?: BrevoOpts; dailyLimit?: number; noProducts?: boolean } = {}) {
  const b: BrevoOpts = { messageId: true, sendStatus: 201, checkStatus: 200, ...o.brevo };
  const prod = (id: string, cat: string, over: Row = {}): Row => ({ id, name: `Article ${id}`, slug: `article-${id}`, price: 20000, compare_at_price: null, images: [`https://img.example.com/${id}.jpg`], is_flash_sale: false, flash_sale_ends_at: null, created_at: ago(40), category_id: cat, stock: 10, is_active: true, ...over });
  const profile = (id: string, over: Row = {}): Row => ({ id, email: `${id}@gmail.com`, full_name: `Client ${id}`, created_at: ago(100), last_login_at: ago(10), banned: false, is_admin: false, notify_promotions: true, notify_new_products: false, notify_flash_sale: false, ...over });
  const tables: Record<string, Row[]> = {
    marketing_ai_settings: [{ id: 1, mode: o.mode ?? 'off', run_hour: o.runHour ?? 13, daily_limit: o.dailyLimit ?? 50, min_days_between: 7, max_per_30_days: 3, require_approval: o.requireApproval ?? true, brevo_ok: null, brevo_checked_at: null, brevo_detail: null, last_simulation_at: null, last_simulation_blocking: null, test_email_at: null, test_email_message_id: null, validated_at: null, validated_by: null, last_run_date: null }],
    marketing_runs: [],
    marketing_campaigns: [],
    store_settings: [{ id: 1, order_emails_enabled: true, inactive_emails_enabled: false }],
    products: o.noProducts ? [] : [prod('a1', 'montres'), prod('a2', 'montres'), prod('a3', 'montres', { price: 17500, compare_at_price: 25000 }), prod('b1', 'chaussures'), prod('b2', 'chaussures'), prod('b3', 'chaussures'), prod('b4', 'chaussures'), prod('c1', 'parfums'), prod('c2', 'parfums')],
    profiles: [
      profile('admin', { is_admin: true, email: 'patron@gmail.com', full_name: 'Le Patron' }),
      profile('c1'), profile('c2'), profile('c3'), profile('c4'), profile('c5'),
      profile('unsub'), profile('suppressed'), profile('fake', { email: '23566000000@tel.albasseshopping.com' }),
    ],
    email_prefs: [
      { user_id: 'unsub', token: '11111111-1111-4111-8111-111111111111', unsubscribed_at: ago(1), suppressed_at: null, lang: null },
      { user_id: 'suppressed', token: '22222222-2222-4222-8222-222222222222', unsubscribed_at: null, suppressed_at: ago(1), lang: null },
    ],
    visitor_sessions: [],
    orders: [],
    favorites: [],
    email_outbox: [],
  };
  const db = fakeDb(tables, { now: () => NOW, missing: o.missing, unique: { email_prefs: ['user_id'] }, guard: liveGuard(() => NOW) });
  const calls: Call[] = [];
  let n = 0;
  const fetchFn = (async (url: string, init: any) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, headers: init?.headers ?? {}, body: init?.body ? JSON.parse(init.body) : null });
    const path = url.replace('https://api.brevo.com/v3', '');
    if (method === 'POST' && path === '/smtp/email') {
      const s = b.sendStatus ?? 201;
      return new Response(s < 300 ? (b.messageId ? JSON.stringify({ messageId: `<msg-${++n}@smtp-relay.mailin.fr>` }) : '{}') : JSON.stringify({ code: 'invalid_parameter', message: 'refus de test' }), { status: s });
    }
    if (path.startsWith('/smtp/statistics/events?messageId=')) {
      const id = decodeURIComponent(path.split('messageId=')[1].split('&')[0]);
      if ((b.eventsStatus ?? 200) !== 200) return new Response('{}', { status: b.eventsStatus });
      return new Response(JSON.stringify({ events: b.events?.[id] ?? [] }), { status: 200 });
    }
    if (b.checkStatus !== 200) return new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: b.checkStatus });
    if (path === '/account') return new Response(JSON.stringify(b.limitedKey ? { code: 'permission_denied', message: 'api key is not authorized for resource "account"' } : { email: 'x@y.z', plan: [{ type: 'free', credits: 300, creditsType: 'sendLimit' }] }), { status: b.limitedKey ? 403 : 200 });
    if (path === '/senders') return new Response(JSON.stringify(b.limitedKey ? { code: 'permission_denied', message: 'nope' } : { senders: [{ email: 'contact@albasseshopping.com', active: true }] }), { status: b.limitedKey ? 403 : 200 });
    if (path.startsWith('/senders/domains')) return new Response(JSON.stringify(b.limitedKey ? { code: 'permission_denied' } : { authenticated: true, verified: true }), { status: b.limitedKey ? 403 : 200 });
    if (path.startsWith('/smtp/statistics/events')) return new Response(JSON.stringify({ events: [] }), { status: 200 });
    if (path.startsWith('/smtp/statistics/aggregatedReport')) return new Response(JSON.stringify({ requests: 58, delivered: 53 }), { status: 200 });
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  const env: Record<string, string | undefined> = { BREVO_API_KEY: KEY, EMAIL_SENDER: 'contact@albasseshopping.com', SUPABASE_URL: 'https://projet.supabase.co' };
  const deps: Deps = { service: db.service, env: (k) => env[k], fetchFn, now: () => NOW };
  const settings = () => tables.marketing_ai_settings[0];
  const sends = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/smtp/email'));
  return { tables, deps, calls, settings, sends, db };
}
const admin = { email: 'patron@gmail.com', fullName: 'Le Patron' };
async function satisfyGate(w: ReturnType<typeof world>) {
  await runCheck(w.deps);
  await simulate(w.deps);
  await sendTestEmail(w.deps, admin);
}
async function goLive(w: ReturnType<typeof world>) {
  await satisfyGate(w);
  return setMode(w.deps, 'live', 'ACTIVER', 'admin');
}

// ---------- 0. script SQL pas encore lancé ----------
{
  const w = world({ missing: ['marketing_ai_settings', 'marketing_runs', 'marketing_campaigns'] });
  check('SQL pas lancé : lecture des réglages = null, simulation / approbation / mode refusés (« sql_missing »), le passage horaire ne fait rien', (await getSettings(w.deps.service)) === null && (await simulate(w.deps) as any).reason === 'sql_missing' && (await approveRun(w.deps, '00000000-0000-4000-8000-000000000001', 'admin') as any).reason === 'sql_missing' && (await setMode(w.deps, 'simulation', null, 'admin') as any).reason === 'sql_missing' && (await tick(w.deps) as any).skipped === 'off' && w.calls.length === 0);
}

// ---------- 1. simulation : aucune écriture d'envoi ----------
{
  const w = world();
  const r: any = await simulate(w.deps);
  check('simulation : ok, 5 destinataires (c1 à c5), segment « absents »', r.ok && r.plan.recipientCount === 5 && r.plan.segments.find((s: any) => s.key === 'inactive').planned === 5, r.plan?.segments);
  check('simulation : désinscrit, adresse en suppression et fausse adresse exclus', r.plan.clients.excluded.desinscrit === 1 && r.plan.clients.excluded.adresse_en_suppression === 1 && r.plan.clients.excluded.sans_adresse_reelle === 1 && r.plan.clients.excluded.administrateur === 1, r.plan.clients.excluded);
  check('simulation : AUCUNE ligne dans la file d’envoi, AUCUN code de désinscription créé, AUCUNE campagne', w.tables.email_outbox.length === 0 && w.tables.email_prefs.length === 2 && w.tables.marketing_campaigns.length === 0);
  check('simulation : aucun appel à Brevo, aucun e-mail', w.calls.length === 0);
  const run = w.tables.marketing_runs[0];
  check('simulation : le passage est écrit au journal (simulated / simulation), avec les identifiants des clients retenus', w.tables.marketing_runs.length === 1 && run.status === 'simulated' && run.mode === 'simulation' && run.recipients.length === 5 && !!run.recipients[0].userId && run.summary.blocking === 0);
  check('simulation : le résultat montré à l’administrateur n’a ni identifiant de client ni adresse complète', !/userId/.test(JSON.stringify(r.plan)) && !/@gmail\.com/.test(JSON.stringify(r.plan).replace(/[a-z0-9]{2}\*\*\*@gmail\.com/g, '')), JSON.stringify(r.plan.sample[0]));
  check('simulation : date et chiffres de la simulation gardés pour le verrou (0 blocage)', !!w.settings().last_simulation_at && w.settings().last_simulation_blocking === 0);
  check('simulation : aperçus fournis (segment « absents », avec désinscription et suivi)', r.plan.previews.length === 1 && /desinscription\?t=exemple/.test(r.plan.previews[0].html) && /utm_campaign=zmi-20261025-inactive/.test(r.plan.previews[0].html));
}
// catalogue vide : blocage
{
  const w = world({ noProducts: true });
  const r: any = await simulate(w.deps);
  check('catalogue vide : la simulation signale un BLOCAGE (1)', r.ok && r.blocking === 1 && w.settings().last_simulation_blocking === 1);
}

// ---------- 2. le verrou ----------
{
  const w = world();
  check('mode inconnu : refusé', (await setMode(w.deps, 'turbo', 'ACTIVER', 'admin') as any).reason === 'bad_request');
  check('« live » sans la confirmation tapée : refusé', (await setMode(w.deps, 'live', null, 'admin') as any).reason === 'confirmation' && w.settings().mode === 'off');
  const r: any = await setMode(w.deps, 'live', 'ACTIVER', 'admin');
  check('« live » sans aucun contrôle : refusé, les 3 contrôles manquants sont listés', !r.ok && r.reason === 'gate' && r.missing.join() === 'controle_brevo,simulation,email_de_test_confirme' && w.settings().mode === 'off', r);
  check('« simulation » et « off » : toujours permis', (await setMode(w.deps, 'simulation', null, 'admin') as any).ok && w.settings().mode === 'simulation' && (await setMode(w.deps, 'off', null, 'admin') as any).ok);

  // contrôle Brevo : le résultat gardé ne contient jamais la clé
  const c: any = await runCheck(w.deps);
  check('contrôle Brevo réussi : gardé en base (ok, date), jamais la clé', c.ok && w.settings().brevo_ok === true && !!w.settings().brevo_checked_at && !JSON.stringify(w.settings()).includes(KEY) && !JSON.stringify(c).includes(KEY) && !JSON.stringify(c).includes('TopSecret'));
  check('contrôle Brevo : seulement des lectures (aucun e-mail envoyé)', w.calls.every((x) => x.method === 'GET') && w.sends().length === 0);
  check('verrou : il manque encore la simulation et l’e-mail de test', (await setMode(w.deps, 'live', 'ACTIVER', 'admin') as any).missing.join() === 'simulation,email_de_test_confirme');
  await simulate(w.deps);

  // e-mail de test
  const w2 = world({ brevo: { messageId: false } });
  await runCheck(w2.deps);
  await simulate(w2.deps);
  const t0: any = await sendTestEmail(w2.deps, admin);
  check('e-mail de test accepté par Brevo SANS identifiant : « confirmed: false », rien n’est compté pour le verrou', t0.ok && t0.confirmed === false && w2.settings().test_email_message_id === null && (await setMode(w2.deps, 'live', 'ACTIVER', 'admin') as any).missing.join() === 'email_de_test_confirme');
  const t: any = await sendTestEmail(w.deps, admin);
  const mail = w.sends()[0];
  check('e-mail de test avec identifiant Brevo : confirmé, adresse masquée, identifiant gardé', t.ok && t.confirmed && /^pa\*\*\*@gmail\.com$/.test(t.to) && /^<msg-1@/.test(w.settings().test_email_message_id), t);
  check('e-mail de test : envoyé SEULEMENT à l’administrateur, objet « [Test Zara Marketing] », désinscription (en-tête et lien), clé en en-tête seulement', w.sends().length === 1 && mail.body.to.length === 1 && mail.body.to[0].email === 'patron@gmail.com' && /^\[Test Zara Marketing\]/.test(mail.body.subject) && /List-Unsubscribe/.test(JSON.stringify(mail.body.headers)) && /Me désinscrire/.test(mail.body.htmlContent) && mail.headers['api-key'] === KEY && !JSON.stringify(mail.body).includes(KEY));
  check('e-mail de test refusé par Brevo : « brevo », rien gardé', await (async () => { const w3 = world({ brevo: { sendStatus: 400 } }); const r3: any = await sendTestEmail(w3.deps, admin); return !r3.ok && r3.reason === 'brevo' && w3.settings().test_email_message_id === null; })());
  check('e-mail de test sans clé ou vers une fausse adresse : refusé', await (async () => { const w4 = world(); w4.deps.env = () => undefined; return (await sendTestEmail(w4.deps, admin) as any).reason === 'no_key' && (await sendTestEmail(world().deps, { email: '2356@tel.albasseshopping.com', fullName: 'x' }) as any).reason === 'no_email'; })());

  const live: any = await setMode(w.deps, 'live', 'ACTIVER', 'admin');
  check('les 3 contrôles faits + confirmation tapée : « live » accepté, validation datée', live.ok && w.settings().mode === 'live' && !!w.settings().validated_at && w.settings().validated_by === 'admin', live);
  check('repasser en « simulation » efface la validation (il faudra revalider)', (await setMode(w.deps, 'simulation', null, 'admin') as any).ok && w.settings().validated_at === null);

  // contrôle Brevo trop vieux
  NOW += 25 * HOUR;
  check('contrôle Brevo de plus de 24 h : « live » refusé de nouveau', (await setMode(w.deps, 'live', 'ACTIVER', 'admin') as any).missing.includes('controle_brevo'));
  NOW -= 25 * HOUR;
}
// Brevo refuse la clé
{
  const w = world({ brevo: { checkStatus: 401 } });
  const c: any = await runCheck(w.deps);
  check('clé refusée par Brevo : contrôle raté, « brevo_ok » = false, « live » impossible', !c.ok && w.settings().brevo_ok === false && (await setMode(w.deps, 'live', 'ACTIVER', 'admin') as any).missing.includes('controle_brevo'));
  const lk = world({ brevo: { limitedKey: true } });
  const c2: any = await runCheck(lk.deps);
  check('clé LIMITÉE (compte, expéditeurs, domaine refusés) mais reconnue : contrôle ok, marqué « limited_key »', c2.ok && c2.limited_key && lk.settings().brevo_ok === true);
}

// ---------- 3. le passage horaire ----------
{
  const off = world();
  check('mode éteint : le passage horaire ne fait rien', (await tick(off.deps) as any).skipped === 'off' && off.calls.length === 0 && off.tables.marketing_runs.length === 0);

  const sim = world({ mode: 'simulation', runHour: 9 });
  check('simulation, mais ce n’est pas l’heure (13 h, réglée à 9 h) : rien', (await tick(sim.deps) as any).skipped === 'hour' && sim.tables.marketing_runs.length === 0);
  const sim2 = world({ mode: 'simulation', runHour: 13 });
  const t1: any = await tick(sim2.deps);
  check('simulation à l’heure : un passage « simulated », 5 prévus, rien en file, aucun appel Brevo, jour noté', t1.mode === 'simulation' && t1.planned === 5 && sim2.tables.marketing_runs.length === 1 && sim2.tables.email_outbox.length === 0 && sim2.sends().length === 0 && sim2.settings().last_run_date === '2026-10-25');
  check('deuxième passage le même jour : « already_ran », pas de doublon', (await tick(sim2.deps) as any).skipped === 'already_ran' && sim2.tables.marketing_runs.length === 1);
  NOW += DAY;
  check('le lendemain : un nouveau passage', (await tick(sim2.deps) as any).mode === 'simulation' && sim2.tables.marketing_runs.length === 2);
  NOW -= DAY;

  // live avec approbation
  const lv = world({ runHour: 13 });
  await goLive(lv);
  const t2: any = await tick(lv.deps);
  const run = lv.tables.marketing_runs.find((r) => r.mode === 'live')!;
  check('live avec approbation : le passage attend (« pending_approval »), RIEN en file, aucun e-mail', t2.pending_approval && run.status === 'pending_approval' && lv.tables.email_outbox.length === 0 && lv.sends().length === 1 /* le seul envoi est l’e-mail de test */, [t2, lv.sends().length]);
  const a: any = await approveRun(lv.deps, run.id, 'admin');
  const rows = lv.tables.email_outbox;
  check('approbation : 5 e-mails mis en file (« marketing », en attente), une campagne par segment', a.ok && a.queued === 5 && rows.length === 5 && rows.every((r) => r.kind === 'marketing' && r.status === 'pending' && r.segment === 'inactive' && !!r.campaign_id && ['A', 'B', 'C'].includes(r.variant) && Array.isArray(r.product_ids) && r.product_ids.length >= 2) && lv.tables.marketing_campaigns.length === 1 && lv.tables.marketing_campaigns[0].tag === 'zmi-20261025-inactive', a);
  check('approbation : le journal passe à « queued » (qui, quand) ; les codes de désinscription manquants sont créés', run.status === 'queued' && run.approved_by === 'admin' && !!run.approved_at && lv.tables.email_prefs.length === 7 && lv.tables.email_prefs.every((p) => !!p.token));
  check('approbation : toujours aucun e-mail envoyé par la mise en file (l’envoi se fait goutte à goutte, plus tard)', lv.sends().length === 1);
  check('approuver deux fois : refusé (« not_pending »), pas de doublon', (await approveRun(lv.deps, run.id, 'admin') as any).reason === 'not_pending' && lv.tables.email_outbox.length === 5);
  check('identifiant de passage invalide : refusé', (await approveRun(lv.deps, 'pas-un-id', 'admin') as any).reason === 'bad_request');

  // approbation le lendemain : expirée
  const ex = world({ runHour: 13 });
  await goLive(ex);
  await tick(ex.deps);
  const pend = ex.tables.marketing_runs.find((r) => r.mode === 'live')!;
  NOW += DAY;
  check('approbation le lendemain : expirée, rien en file', (await approveRun(ex.deps, pend.id, 'admin') as any).reason === 'expired' && pend.status === 'expired' && ex.tables.email_outbox.length === 0);
  NOW -= DAY;

  // approbation alors que le mode n'est plus « live »
  const lk = world({ runHour: 13 });
  await goLive(lk);
  await tick(lk.deps);
  const pend2 = lk.tables.marketing_runs.find((r) => r.mode === 'live')!;
  await setMode(lk.deps, 'simulation', null, 'admin');
  check('approbation après retour en simulation : refusée (« locked »), rien en file', (await approveRun(lk.deps, pend2.id, 'admin') as any).reason === 'locked' && lk.tables.email_outbox.length === 0);

  // live sans approbation
  const auto = world({ runHour: 13, requireApproval: false });
  await goLive(auto);
  const t3: any = await tick(auto.deps);
  check('live sans approbation (réglage explicite) : mis en file directement, journal « queued »', t3.queued === 5 && auto.tables.email_outbox.length === 5 && auto.tables.marketing_runs.find((r) => r.mode === 'live')!.status === 'queued');
  check('une fois en file, le même jour : le plan suivant ne reprend aucun de ces clients (fréquence), les autres jours non plus', ((await simulate(auto.deps)) as any).plan.recipientCount === 0);

  // live : Brevo ne répond plus au moment du passage -> blocage et retour en simulation
  const bad = world({ runHour: 13 });
  await goLive(bad);
  bad.deps.fetchFn = (async () => new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 })) as unknown as typeof fetch;
  const t4: any = await tick(bad.deps);
  check('live mais Brevo refuse la clé au moment du passage : « blocked », rien en file, retour automatique en « simulation »', t4.blocked && bad.tables.email_outbox.length === 0 && bad.settings().mode === 'simulation' && bad.settings().validated_at === null && bad.tables.marketing_runs.find((r) => r.mode === 'live')!.status === 'blocked');
  // live : e-mail de test trop vieux
  const old = world({ runHour: 13 });
  await goLive(old);
  NOW += 31 * DAY;
  const t5: any = await tick(old.deps);
  NOW -= 31 * DAY;
  check('live mais e-mail de test vieux de 31 jours : « blocked » (email_de_test_confirme), retour en simulation, rien en file', t5.blocked && t5.missing.includes('email_de_test_confirme') && old.settings().mode === 'simulation' && old.tables.email_outbox.length === 0);
  // live : la simulation du jour montre un blocage (plus d'articles)
  const none = world({ runHour: 13 });
  await goLive(none);
  none.tables.products.length = 0;
  const t6: any = await tick(none.deps);
  check('live mais plus aucun article vérifié : « blocked », retour en simulation', t6.blocked && none.settings().mode === 'simulation' && none.tables.email_outbox.length === 0);
  // live : la simulation manuelle avec blocage démote aussi
  const demo = world();
  await goLive(demo);
  demo.tables.products.length = 0;
  const s2: any = await simulate(demo.deps);
  check('simulation manuelle avec un blocage pendant « live » : retour en « simulation » sans erreur du verrou', s2.ok && s2.demoted && demo.settings().mode === 'simulation');
}

// ---------- 4. limite du jour ----------
{
  const w = world({ runHour: 13, requireApproval: false, dailyLimit: 3 });
  await goLive(w);
  const t: any = await tick(w.deps);
  check('limite du jour de 3 : 3 mis en file, 2 reportés', t.queued === 3 && w.tables.email_outbox.length === 3);
}

// ---------- 5. résultats confirmés par Brevo ----------
{
  check('événements Brevo : livré + 2 clics', JSON.stringify(summarizeEvents([{ event: 'requests' }, { event: 'delivered', date: '2026-10-25T12:00:05Z' }, { event: 'clicks' }, { event: 'clicks' }])) === JSON.stringify({ delivered_at: '2026-10-25T12:00:05Z', click_count: 2, bounce_type: null, complaint: false }));
  check('événements Brevo : rebond dur, rebond mou, bloqué, plainte', summarizeEvents([{ event: 'hardBounces' }]).bounce_type === 'hard' && summarizeEvents([{ event: 'softBounces' }]).bounce_type === 'soft' && summarizeEvents([{ event: 'blocked' }]).bounce_type === 'blocked' && summarizeEvents([{ event: 'spam' }]).complaint === true && summarizeEvents(null).click_count === 0);

  const w = world({
    brevo: {
      events: {
        '<ok@x>': [{ event: 'delivered', date: '2026-10-25T10:00:00Z' }, { event: 'clicks' }, { event: 'clicks' }],
        '<hard@x>': [{ event: 'hardBounces' }],
        '<spam@x>': [{ event: 'delivered', date: '2026-10-25T10:00:00Z' }, { event: 'spam' }],
        '<soft@x>': [{ event: 'softBounces' }],
      },
    },
  });
  const row = (id: string, user: string, mid: string | null, extra: Row = {}): Row => ({ id, kind: 'marketing', user_id: user, status: 'sent', sent_at: iso(NOW - HOUR), provider_message_id: mid, events_synced_at: null, delivered_at: null, click_count: 0, bounce_type: null, complaint_at: null, ...extra });
  w.tables.email_prefs.push({ user_id: 'c1', token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', unsubscribed_at: null, suppressed_at: null }, { user_id: 'c2', token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', unsubscribed_at: null, suppressed_at: null }, { user_id: 'c3', token: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', unsubscribed_at: null, suppressed_at: null }, { user_id: 'c4', token: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', unsubscribed_at: null, suppressed_at: null });
  w.tables.email_outbox.push(row('r1', 'c1', '<ok@x>'), row('r2', 'c2', '<hard@x>'), row('r3', 'c3', '<spam@x>'), row('r4', 'c4', '<soft@x>'), row('r5', 'c5', null), row('r6', 'c1', '<ok@x>', { id: 'r6', events_synced_at: iso(NOW - 10 * 60_000) }));
  const r: any = await syncEvents(w.deps);
  const get = (id: string) => w.tables.email_outbox.find((x) => x.id === id)!;
  check('résultats : 4 messages relus (le message sans identifiant et celui relu il y a 10 minutes sont laissés)', r.ok && r.synced === 4 && w.calls.length === 4, r);
  check('résultats : livraison et 2 clics confirmés par Brevo', get('r1').delivered_at === '2026-10-25T10:00:00Z' && get('r1').click_count === 2 && get('r1').events_synced_at === iso(NOW));
  check('résultats : rebond dur -> adresse mise en SUPPRESSION (rebond_dur) ; plainte -> suppression (plainte) ; rebond mou -> pas de suppression', get('r2').bounce_type === 'hard' && w.tables.email_prefs.find((p) => p.user_id === 'c2')!.suppressed_reason === 'rebond_dur' && get('r3').complaint_at === iso(NOW) && w.tables.email_prefs.find((p) => p.user_id === 'c3')!.suppressed_reason === 'plainte' && get('r4').bounce_type === 'soft' && !w.tables.email_prefs.find((p) => p.user_id === 'c4')!.suppressed_at && r.suppressed === 2);
  check('résultats : un message sans identifiant Brevo n’est jamais présenté comme confirmé (rien lu, rien changé)', get('r5').events_synced_at === null && get('r5').delivered_at === null);
  check('résultats : seulement des lectures (GET), l’identifiant du message encodé dans l’adresse', w.calls.every((c) => c.method === 'GET' && /messageId=%3C/.test(c.url)));
  // les adresses en suppression sortent des plans suivants
  const plan: any = await simulate(w.deps);
  check('adresses en suppression : exclues du plan suivant', plan.plan.clients.excluded.adresse_en_suppression >= 3, plan.plan.clients.excluded);

  const down = world({ brevo: { eventsStatus: 403, events: {} } });
  down.tables.email_outbox.push(row('r1', 'c1', '<ok@x>'));
  const d: any = await syncEvents(down.deps);
  check('Brevo refuse la lecture des événements (403) : arrêt propre, rien de faux enregistré', d.ok && d.synced === 0 && d.stopped === 'brevo_403' && down.tables.email_outbox[0].delivered_at === null);
}

// ---------- 6. l'envoi (drain) des e-mails de campagne ----------
const mkRow = (id: string, user: string, over: Row = {}): Row => ({ id, kind: 'marketing', user_id: user, status: 'pending', attempts: 0, created_at: iso(NOW - 3600_000), updated_at: iso(NOW - 3600_000), sent_at: null, error: null, segment: 'inactive', variant: 'A', lang: 'fr', product_ids: ['a1', 'a2'], campaign_id: 'camp1', ...over });
function sendWorld(o: Parameters<typeof world>[0] = {}) {
  const w = world(o);
  // le mode « live » validé (le verrou), posé directement : ici on teste l'envoi, pas la validation
  Object.assign(w.settings(), { mode: 'live', validated_at: iso(NOW - HOUR) });
  for (const id of ['c1', 'c2', 'c3', 'c4', 'c5']) w.tables.email_prefs.push({ user_id: id, token: `00000000-0000-4000-8000-00000000000${id[1]}`, unsubscribed_at: null, suppressed_at: null, lang: null });
  return w;
}
{
  const off = sendWorld();
  Object.assign(off.settings(), { mode: 'simulation', validated_at: null });
  off.tables.email_outbox.push(mkRow('m1', 'c1'));
  const r: any = await drain(off.deps);
  check('envoi : mode pas « live » -> la campagne en attente est ANNULÉE (« verrou »), aucun appel à Brevo', off.sends().length === 0 && off.tables.email_outbox[0].status === 'skipped' && /verrou/.test(off.tables.email_outbox[0].error) && r.ok);
  const noVal = sendWorld();
  Object.assign(noVal.settings(), { validated_at: null });
  noVal.tables.email_outbox.push(mkRow('m1', 'c1'));
  await drain(noVal.deps);
  check('envoi : « live » sans validation de l’administrateur -> annulée, aucun appel à Brevo', noVal.sends().length === 0 && noVal.tables.email_outbox[0].status === 'skipped');

  const w = sendWorld();
  w.tables.email_outbox.push(mkRow('m1', 'c1'));
  const g: any = await drain(w.deps);
  const sent = w.sends()[0];
  const m1 = w.tables.email_outbox[0];
  check('envoi : un e-mail part, une seule fois, vers le client lui-même', g.sent === 1 && w.sends().length === 1 && sent.body.to.length === 1 && sent.body.to[0].email === 'c1@gmail.com');
  check('envoi : désinscription en un geste (en-tête List-Unsubscribe + lien dans le texte) et suivi des commandes', /List-Unsubscribe/.test(JSON.stringify(sent.body.headers)) && /One-Click/.test(JSON.stringify(sent.body.headers)) && /Me désinscrire/.test(sent.body.htmlContent) && /utm_campaign=zmi-20261025-inactive/.test(sent.body.htmlContent));
  check('envoi : la ligne passe à « sent » avec l’identifiant du message donné par Brevo (la confirmation)', m1.status === 'sent' && /^<msg-1@/.test(m1.provider_message_id) && !!m1.sent_at);
  check('envoi : un deuxième passage ne renvoie rien (pas de doublon)', (await drain(w.deps) as any).sent === 0 && w.sends().length === 1);

  const nm = sendWorld({ brevo: { messageId: false } });
  nm.tables.email_outbox.push(mkRow('m1', 'c1'));
  await drain(nm.deps);
  check('Brevo répond OK sans identifiant : la ligne est « sent » mais SANS identifiant (non confirmée, comptée à part dans le tableau de bord)', nm.tables.email_outbox[0].status === 'sent' && nm.tables.email_outbox[0].provider_message_id === null);

  // relecture au moment de l'envoi
  const cases: [string, (w: ReturnType<typeof sendWorld>) => void, RegExp][] = [
    ['désinscrit entre-temps', (x) => (x.tables.email_prefs.find((p) => p.user_id === 'c1')!.unsubscribed_at = ago(0)), /desinscrit/],
    ['adresse mise en suppression entre-temps', (x) => (x.tables.email_prefs.find((p) => p.user_id === 'c1')!.suppressed_at = ago(0)), /suppression/],
    ['accord promotions retiré entre-temps', (x) => (x.tables.profiles.find((p) => p.id === 'c1')!.notify_promotions = false), /autorisation_retiree/],
    ['compte bloqué entre-temps', (x) => (x.tables.profiles.find((p) => p.id === 'c1')!.banned = true), /compte_bloque/],
    ['articles épuisés entre-temps', (x) => x.tables.products.filter((p) => ['a1', 'a2'].includes(p.id)).forEach((p) => (p.stock = 0)), /articles_plus_valides/],
    ['un article sur deux seulement encore valable', (x) => (x.tables.products.find((p) => p.id === 'a1')!.is_active = false), /articles_plus_valides/],
  ];
  for (const [label, mutate, why] of cases) {
    const x = sendWorld();
    x.tables.email_outbox.push(mkRow('m1', 'c1'));
    mutate(x);
    await drain(x.deps);
    check(`envoi refusé, ${label} : rien n’est envoyé, la ligne est « skipped » avec la raison`, x.sends().length === 0 && x.tables.email_outbox[0].status === 'skipped' && why.test(x.tables.email_outbox[0].error), x.tables.email_outbox[0]);
  }
  const px = sendWorld();
  px.tables.products.find((p) => p.id === 'a1')!.price = 12345;
  px.tables.email_outbox.push(mkRow('m1', 'c1'));
  await drain(px.deps);
  check('prix changé entre la mise en file et l’envoi : l’e-mail montre le prix du moment', /12[\s  ]345[\s  ]FCFA/.test(px.sends()[0].body.htmlContent));

  // segment inconnu ou illisible
  const bad = sendWorld();
  bad.tables.email_outbox.push(mkRow('m1', 'c1', { segment: 'pirate' }), mkRow('m2', 'c2', { variant: 'Z' }), mkRow('m3', 'ghost'));
  await drain(bad.deps);
  check('ligne illisible (segment ou variante inconnus, client absent) : annulée, rien n’est envoyé', bad.sends().length === 0 && bad.tables.email_outbox.every((r) => r.status === 'skipped'));

  // le goutte-à-goutte
  const drip = sendWorld();
  for (let i = 1; i <= 8; i++) drip.tables.email_outbox.push(mkRow(`d${i}`, `c${(i % 5) + 1}`, { campaign_id: `camp${i}` }));
  const d: any = await drain(drip.deps);
  check(`goutte-à-goutte : au plus ${PROMO_BATCH} e-mails de campagne par passage`, d.sent === PROMO_BATCH && drip.tables.email_outbox.filter((r) => r.status === 'sent').length === PROMO_BATCH, d);
  // une commande passe avant la campagne
  const prio = sendWorld();
  prio.tables.orders.push({ id: 'o1', order_number: 7, user_id: 'c1', items: [{ product_name: 'Soulier', unit_price: 20000, quantity: 1 }], total: 20000, status: 'pending', payment_method: 'cash_on_delivery', shipping_city: "N'Djamena", gift_wrap: false, loyalty_discount: 0, is_flagged_fake: false });
  prio.tables.email_outbox.push(mkRow('m1', 'c2'), { id: 'e1', kind: 'order_received', order_id: 'o1', user_id: 'c1', status: 'pending', attempts: 0, created_at: iso(NOW - 60_000), updated_at: iso(NOW - 60_000) });
  await drain(prio.deps);
  check('un e-mail de commande part avec la campagne dans le même passage, la commande en premier', prio.sends().length === 2 && /Commande reçue/.test(prio.sends()[0].body.subject));

  // la publicité automatique « absents » respecte aussi la suppression
  const promo = sendWorld();
  promo.tables.store_settings[0].inactive_emails_enabled = true;
  promo.tables.email_prefs.find((p) => p.user_id === 'c1')!.suppressed_at = ago(0);
  promo.tables.email_outbox.push({ id: 'p1', kind: 'promo_inactive', user_id: 'c1', status: 'pending', attempts: 0, created_at: iso(NOW - 60_000), updated_at: iso(NOW - 60_000) }, { id: 'p2', kind: 'promo_inactive', user_id: 'c2', status: 'pending', attempts: 0, created_at: iso(NOW - 60_000), updated_at: iso(NOW - 60_000) });
  await drain(promo.deps);
  check('publicité « absents » existante : une adresse en suppression est écartée, les autres partent comme avant', promo.tables.email_outbox.find((r) => r.id === 'p1')!.status === 'skipped' && /suppression/.test(promo.tables.email_outbox.find((r) => r.id === 'p1')!.error) && promo.tables.email_outbox.find((r) => r.id === 'p2')!.status === 'sent' && promo.sends().length === 1);

  // refus de Brevo
  const fail = sendWorld({ brevo: { sendStatus: 400 } });
  fail.tables.email_outbox.push(mkRow('m1', 'c1'));
  await drain(fail.deps);
  check('Brevo refuse l’envoi (400) : « failed », jamais « sent », aucun identifiant', fail.tables.email_outbox[0].status === 'failed' && !fail.tables.email_outbox[0].provider_message_id);
}

console.error = quiet;
console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
