// Envoi automatique des e-mails de commande (supabase/functions/brevo-email/drain.ts), avec une fausse base en mémoire et un faux Brevo.
// Lancer : node --import ./tests/zara/register.mjs tests/email/drain.test.ts
import { drain, BATCH, MAX_ATTEMPTS, type Deps } from '../../supabase/functions/brevo-email/drain.ts';

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

type Row = Record<string, any>;
// fausse base : seulement ce que drain.ts utilise (select, update, eq, neq, gt, gte, lt, order, limit, maybeSingle, count)
function fakeService(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    const st: any = { op: 'select', filters: [] as ((r: Row) => boolean)[], payload: null, opts: null, orderBy: null, lim: null, single: false, afterUpdateSelect: false };
    const add = (f: (r: Row) => boolean) => (st.filters.push(f), api);
    const api: any = {
      select: (_c?: string, opts?: any) => ((st.op === 'update' ? (st.afterUpdateSelect = true) : (st.opts = opts ?? null)), api),
      update: (payload: Row) => ((st.op = 'update'), (st.payload = payload), api),
      eq: (k: string, v: unknown) => add((r) => r[k] === v),
      neq: (k: string, v: unknown) => add((r) => r[k] != null && r[k] !== v),
      gt: (k: string, v: any) => add((r) => r[k] != null && r[k] > v),
      gte: (k: string, v: any) => add((r) => r[k] != null && r[k] >= v),
      lt: (k: string, v: any) => add((r) => r[k] != null && r[k] < v),
      order: (k: string) => ((st.orderBy = k), api),
      limit: (n: number) => ((st.lim = n), api),
      maybeSingle: () => ((st.single = true), api),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    const run = () => {
      let rows = (tables[table] ?? []).filter((r) => st.filters.every((f: (r: Row) => boolean) => f(r)));
      if (st.orderBy) rows = [...rows].sort((a, b) => String(a[st.orderBy]).localeCompare(String(b[st.orderBy])));
      if (st.lim != null) rows = rows.slice(0, st.lim);
      if (st.op === 'update') {
        for (const r of rows) Object.assign(r, st.payload);
        if (st.single) return { data: rows[0] ? { id: rows[0].id } : null, error: null };
        return { data: st.afterUpdateSelect ? rows.map((r) => ({ id: r.id })) : null, error: null };
      }
      if (st.opts?.count) return { count: rows.length, data: null, error: null };
      // des copies, comme la vraie base : modifier la ligne lue ne modifie pas la table
      const copies = rows.map((r) => ({ ...r }));
      return st.single ? { data: copies[0] ?? null, error: null } : { data: copies, error: null };
    };
    return api;
  };
  return { from };
}

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0); // 25 octobre 2026, 13 h à N'Djamena
const DAY_START = Date.UTC(2026, 9, 24, 23, 0, 0); // minuit à N'Djamena
const iso = (ms: number) => new Date(ms).toISOString();

function world({ on = true, key = 'xkeysib-test', cap, fetchStatus = [201], extra = {} as Record<string, Row[]> } = {}) {
  const tables: Record<string, Row[]> = {
    store_settings: [{ id: 1, order_emails_enabled: on }],
    profiles: [
      { id: 'u1', full_name: 'Ali Mahamat', email: 'ali@gmail.com' },
      { id: 'u2', full_name: 'Awa', email: '23566123456@tel.albasseshopping.com' },
    ],
    orders: [
      { id: 'o1', user_id: 'u1', items: [{ product_name: 'Soulier', unit_price: 20000, quantity: 1 }], total: 20000, status: 'pending', payment_method: 'cash_on_delivery', shipping_city: "N'Djamena", gift_wrap: false, loyalty_discount: 0, is_flagged_fake: false },
      { id: 'o2', user_id: 'u2', items: [{ product_name: 'Capuche', unit_price: 22500, quantity: 1 }], total: 22500, status: 'pending', payment_method: 'cash_on_delivery', shipping_city: "N'Djamena", gift_wrap: false, loyalty_discount: 0, is_flagged_fake: false },
    ],
    email_outbox: [{ id: 'e1', kind: 'order_received', order_id: 'o1', user_id: 'u1', status: 'pending', attempts: 0, created_at: '2026-10-25T11:00:00Z', updated_at: '2026-10-25T11:00:00Z', sent_at: null, error: null }],
    ...extra,
  };
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  let n = 0;
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const status = fetchStatus[Math.min(n++, fetchStatus.length - 1)];
    return new Response(status < 300 ? '{"messageId":"x"}' : JSON.stringify({ message: 'refus de test' }), { status });
  }) as unknown as typeof fetch;
  const env: Record<string, string | undefined> = { BREVO_API_KEY: key || undefined, EMAIL_SENDER: 'contact@albasseshopping.com', EMAIL_DAILY_CAP: cap ? String(cap) : undefined };
  const deps: Deps = { service: fakeService(tables), env: (k) => env[k], fetchFn, now: () => NOW };
  return { tables, calls, deps };
}
const row = (t: Record<string, Row[]>, id: string) => t.email_outbox.find((r) => r.id === id)!;
const quiet = console.error;
console.error = () => {}; // les refus de Brevo sont voulus dans ces essais

// interrupteur éteint : rien ne part, l'attente est annulée
{
  const w = world({ on: false });
  const r = await drain(w.deps);
  check('interrupteur éteint : aucun appel à Brevo, la ligne en attente est annulée', w.calls.length === 0 && r.ok && (r as any).off && row(w.tables, 'e1').status === 'skipped' && row(w.tables, 'e1').error === 'interrupteur éteint', row(w.tables, 'e1'));
}
// clé absente
{
  const w = world({ key: '' });
  const r = await drain(w.deps);
  check('clé Brevo absente : réponse « no_key », rien ne bouge', !r.ok && (r as any).reason === 'no_key' && w.calls.length === 0 && row(w.tables, 'e1').status === 'pending');
}
// envoi normal
{
  const w = world();
  const r = await drain(w.deps);
  const c = w.calls[0];
  check('envoi : un seul appel à Brevo avec la clé en en-tête et l’adresse du client', w.calls.length === 1 && c.url === 'https://api.brevo.com/v3/smtp/email' && c.headers['api-key'] === 'xkeysib-test' && c.body.to[0].email === 'ali@gmail.com', c);
  check('envoi : expéditeur configuré, objet avec la référence, contenu de la commande', c.body.sender.email === 'contact@albasseshopping.com' && /Commande reçue n° O1/.test(c.body.subject) && /Soulier/.test(c.body.htmlContent) && /Bonjour Ali,/.test(c.body.htmlContent), c.body.subject);
  check('envoi : la ligne passe à « sent » avec l’heure, une seule tentative', row(w.tables, 'e1').status === 'sent' && row(w.tables, 'e1').sent_at === iso(NOW) && row(w.tables, 'e1').attempts === 1 && (r as any).sent === 1, row(w.tables, 'e1'));
  const again = await drain(w.deps);
  check('un deuxième passage ne renvoie rien (pas de doublon)', w.calls.length === 1 && (again as any).sent === 0);
}
// fausse adresse, commande signalée ou annulée
{
  const w = world({ extra: { email_outbox: [
    { id: 'e2', kind: 'order_received', order_id: 'o2', user_id: 'u2', status: 'pending', attempts: 0, created_at: '2026-10-25T11:00:00Z', updated_at: '' },
    { id: 'e3', kind: 'order_received', order_id: 'o3', user_id: 'u1', status: 'pending', attempts: 0, created_at: '2026-10-25T11:01:00Z', updated_at: '' },
    { id: 'e4', kind: 'order_received', order_id: 'o4', user_id: 'u1', status: 'pending', attempts: 0, created_at: '2026-10-25T11:02:00Z', updated_at: '' },
    { id: 'e5', kind: 'order_received', order_id: 'inconnue', user_id: 'u1', status: 'pending', attempts: 0, created_at: '2026-10-25T11:03:00Z', updated_at: '' },
  ] } });
  w.tables.orders.push({ id: 'o3', user_id: 'u1', items: [], total: 1, status: 'cancelled', payment_method: 'cash_on_delivery', is_flagged_fake: false }, { id: 'o4', user_id: 'u1', items: [], total: 1, status: 'pending', payment_method: 'cash_on_delivery', is_flagged_fake: true });
  const r = await drain(w.deps);
  check('fausse adresse (compte par téléphone) : jamais d’envoi', row(w.tables, 'e2').status === 'skipped' && /adresse/.test(row(w.tables, 'e2').error));
  check('commande annulée, signalée comme fausse ou introuvable : jamais d’envoi', ['e3', 'e4', 'e5'].every((id) => row(w.tables, id).status === 'skipped') && w.calls.length === 0 && (r as any).skipped === 4, r);
}
// commande livrée et remise fidélité
{
  const delivered = [1, 2, 3].map((i) => ({ id: `d${i}`, user_id: 'u1', items: [], total: 1, status: 'delivered', payment_method: 'cash_on_delivery', is_flagged_fake: false, loyalty_discount: 0 }));
  const w = world({ extra: { email_outbox: [{ id: 'e6', kind: 'order_delivered', order_id: 'd3', user_id: 'u1', status: 'pending', attempts: 0, created_at: '2026-10-25T11:00:00Z', updated_at: '' }] } });
  w.tables.orders.push(...delivered);
  await drain(w.deps);
  const html = w.calls[0]?.body.htmlContent ?? '';
  check('commande livrée : le texte de fidélité compte les commandes livrées (3 → encore 3)', /Commande livrée/.test(html) && /Encore 3 commandes livrées/.test(html), html.slice(0, 120));
  const w2 = world({ extra: { email_outbox: [{ id: 'e7', kind: 'order_delivered', order_id: 'd3', user_id: 'u1', status: 'pending', attempts: 0, created_at: '2026-10-25T11:00:00Z', updated_at: '' }] } });
  w2.tables.orders.push(...delivered.map((d, i) => (i === 0 ? { ...d, loyalty_discount: 2000 } : d)));
  await drain(w2.deps);
  check('remise déjà utilisée : pas de phrase de fidélité', !/Encore|Bonne nouvelle/.test(w2.calls[0]?.body.htmlContent ?? ''));
}
// refus et pannes de Brevo
{
  const w = world({ fetchStatus: [401] });
  await drain(w.deps);
  check('Brevo refuse (401) : la ligne est « failed » tout de suite, avec la raison', row(w.tables, 'e1').status === 'failed' && /401 refus de test/.test(row(w.tables, 'e1').error), row(w.tables, 'e1'));
  const p = world({ fetchStatus: [500] });
  await drain(p.deps);
  check('panne de Brevo (500) : la ligne reste en attente pour un nouvel essai', row(p.tables, 'e1').status === 'pending' && row(p.tables, 'e1').attempts === 1);
  for (let i = 0; i < MAX_ATTEMPTS; i++) await drain(p.deps);
  check(`après ${MAX_ATTEMPTS} essais : « failed », pas d’essai sans fin`, row(p.tables, 'e1').status === 'failed' && row(p.tables, 'e1').attempts === MAX_ATTEMPTS && p.calls.length === MAX_ATTEMPTS, { attempts: row(p.tables, 'e1').attempts, calls: p.calls.length });
  const t = world({ fetchStatus: [429, 201] });
  await drain(t.deps);
  check('trop de demandes (429) : réessayé à la minute suivante, puis envoyé', row(t.tables, 'e1').status === 'pending');
  await drain(t.deps);
  check('...et envoyé au deuxième passage', row(t.tables, 'e1').status === 'sent');
}
// plafond du jour
{
  const mk = (id: string, status: string, sent_at: string | null) => ({ id, kind: 'order_received', order_id: 'o1', user_id: 'u1', status, attempts: 1, created_at: '2026-10-25T10:00:00Z', updated_at: '', sent_at });
  const pending = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, kind: 'order_received', order_id: 'o1', user_id: 'u1', status: 'pending', attempts: 0, created_at: `2026-10-25T11:0${i}:00Z`, updated_at: '' }));
  const w = world({ cap: 2, extra: { email_outbox: [mk('s1', 'sent', iso(NOW - 3600_000)), ...pending(3)] } });
  await drain(w.deps);
  check('plafond : 2 par jour, 1 déjà envoyé aujourd’hui → un seul de plus', w.calls.length === 1 && w.tables.email_outbox.filter((r) => r.status === 'pending').length === 2, w.calls.length);
  const w2 = world({ cap: 1, extra: { email_outbox: [mk('s2', 'sent', iso(DAY_START - 1800_000)), ...pending(2)] } });
  await drain(w2.deps);
  check('un envoi d’hier soir (avant minuit à N’Djamena) ne compte pas dans le plafond d’aujourd’hui', w2.calls.length === 1);
  const w3 = world({ cap: 1, extra: { email_outbox: [mk('s3', 'sent', iso(NOW - 60_000)), ...pending(2)] } });
  const r3 = await drain(w3.deps);
  check('plafond atteint : rien ne part, les messages attendent demain', w3.calls.length === 0 && (r3 as any).capped && w3.tables.email_outbox.filter((r) => r.status === 'pending').length === 2);
  const w4 = world({ extra: { email_outbox: pending(9).concat(Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, kind: 'order_received', order_id: 'o1', user_id: 'u1', status: 'pending', attempts: 0, created_at: `2026-10-25T11:${String(10 + i).padStart(2, '0')}:00Z`, updated_at: '' }))) } });
  await drain(w4.deps);
  check(`un passage envoie au plus ${BATCH} e-mails`, w4.calls.length === BATCH, w4.calls.length);
}
// deux passages en même temps, ou panne en plein envoi
{
  const w = world({ extra: { email_outbox: [{ id: 'x1', kind: 'order_received', order_id: 'o1', user_id: 'u1', status: 'sending', attempts: 1, created_at: '2026-10-25T11:00:00Z', updated_at: iso(NOW - 60_000), sent_at: null }] } });
  await drain(w.deps);
  check('une ligne « en cours » depuis 1 minute (un autre passage) n’est pas envoyée en double', w.calls.length === 0 && row(w.tables, 'x1').status === 'sending');
  const s = world({ extra: { email_outbox: [{ id: 'x2', kind: 'order_received', order_id: 'o1', user_id: 'u1', status: 'sending', attempts: 1, created_at: '2026-10-25T11:00:00Z', updated_at: iso(NOW - 20 * 60_000), sent_at: null }] } });
  await drain(s.deps);
  check('une ligne « en cours » depuis 20 minutes (panne) est reprise et envoyée', s.calls.length === 1 && row(s.tables, 'x2').status === 'sent');
}
// e-mail de bienvenue : pas de commande, profil du client, attend que le nom soit enregistré
{
  const mk = (id: string, userId: string, ageMs: number) => ({ id, kind: 'welcome', order_id: null, user_id: userId, status: 'pending', attempts: 0, created_at: iso(NOW - ageMs), updated_at: '', sent_at: null });
  const w = world({ extra: { email_outbox: [mk('w1', 'u1', 5 * 60_000)] } });
  const r = await drain(w.deps);
  const c = w.calls[0];
  check('bienvenue : un e-mail part vers l’adresse du client, avec son prénom et le texte du patron', w.calls.length === 1 && c.body.to[0].email === 'ali@gmail.com' && /Bonjour Ali et bienvenue/.test(c.body.htmlContent) && /Livraison partout au Tchad/.test(c.body.htmlContent) && /rejoindre notre grande famille/.test(c.body.htmlContent) && /Bienvenue chez Albasse Shopping/.test(c.body.subject), c);
  check('bienvenue : le client a déjà son compte, donc plus de « Créez votre compte »', !/Créez votre compte/.test(c.body.htmlContent) && /Votre compte est créé/.test(c.body.htmlContent));
  check('bienvenue : le pied de page ne parle pas de commande', !/concerne votre commande/.test(c.body.htmlContent) && /créer un compte/.test(c.body.htmlContent));
  check('bienvenue : la ligne passe à « sent »', row(w.tables, 'w1').status === 'sent' && (r as any).sent === 1, row(w.tables, 'w1'));

  const fresh = world({ extra: { email_outbox: [mk('w2', 'u1', 10_000)] } });
  await drain(fresh.deps);
  check('bienvenue : un compte créé il y a 10 secondes attend (le nom n’est pas encore enregistré)', fresh.calls.length === 0 && row(fresh.tables, 'w2').status === 'pending' && row(fresh.tables, 'w2').attempts === 0);

  const fake = world({ extra: { email_outbox: [mk('w3', 'u2', 5 * 60_000), mk('w4', 'u9', 5 * 60_000)] } });
  const rf = await drain(fake.deps);
  check('bienvenue : jamais vers une fausse adresse (compte par téléphone) ni un compte introuvable', fake.calls.length === 0 && row(fake.tables, 'w3').status === 'skipped' && row(fake.tables, 'w4').status === 'skipped' && (rf as any).skipped === 2, rf);

  const banned = world({ extra: { email_outbox: [mk('w5', 'u1', 5 * 60_000)] } });
  banned.tables.profiles[0].banned = true;
  await drain(banned.deps);
  check('bienvenue : jamais vers un compte bloqué', banned.calls.length === 0 && row(banned.tables, 'w5').status === 'skipped');

  const off = world({ on: false, extra: { email_outbox: [mk('w6', 'u1', 5 * 60_000)] } });
  await drain(off.deps);
  check('bienvenue : interrupteur éteint, rien ne part', off.calls.length === 0 && row(off.tables, 'w6').status === 'skipped');

  const refus = world({ fetchStatus: [401], extra: { email_outbox: [mk('w7', 'u1', 5 * 60_000)] } });
  await drain(refus.deps);
  check('bienvenue : refus de Brevo (401) = « failed » avec la raison', row(refus.tables, 'w7').status === 'failed' && /401/.test(row(refus.tables, 'w7').error));
}
console.error = quiet;
console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
