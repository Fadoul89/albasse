// Gestion de compte côté équipe : règles (supabase/functions/admin-client-account/rules.ts) et étapes (logic.ts) avec de FAUX accès. Aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/account/admin-client-account.test.ts
import * as rules from '../../supabase/functions/admin-client-account/rules.ts';
import { run, type Deps, type Target } from '../../supabase/functions/admin-client-account/logic.ts';

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

// ---------------- règles
check('numéros : « 66 12 34 56 », « +235 66 12 34 56 », « 00235 66123456 » → 23566123456', ['66 12 34 56', '+235 66 12 34 56', '00235 66123456', '66123456'].every((t) => rules.phoneDigits(t) === '23566123456'));
check('numéros : lettres, trop court, vide → null', ['abc', '1234', '', '66 12 34 5x', '+'].every((t) => rules.phoneDigits(t) === null));
check('numéro joli : +235 66 12 34 56', rules.prettyPhone('23566123456') === '+235 66 12 34 56' && rules.prettyPhone('33612345678') === '+33612345678');
check('adresse de connexion tirée du numéro', rules.phoneLoginEmail('23566123456') === '23566123456@tel.albasseshopping.com');
check('type de connexion : numéro, e-mail, fermé', rules.loginKindOf('23566123456@tel.albasseshopping.com') === 'phone' && rules.loginKindOf('Amina@Gmail.com') === 'email' && rules.loginKindOf('closed-000123@closed.albasseshopping.com') === 'closed' && rules.loginKindOf(null) === 'email');
check('numéro client écrit AS-000123, sinon les 8 premiers caractères de l\'identifiant', rules.confirmWord(123, 'aaaaaaaa-0000-4000-8000-000000000001') === 'AS-000123' && rules.confirmWord(null, 'aaaaaaaa-0000-4000-8000-000000000001') === 'aaaaaaaa');
check('adresse d\'un compte fermé : libère le numéro, ne peut recevoir aucun vrai e-mail', rules.closedEmail(123, 'x') === 'closed-000123@closed.albasseshopping.com' && rules.closedEmail(null, 'aaaaaaaa-0000') === 'closed-aaaaaaaa@closed.albasseshopping.com' && rules.loginKindOf(rules.closedEmail(7, 'x')) === 'closed');
const secrets = new Set(Array.from({ length: 50 }, () => rules.randomSecret()));
check('mot de passe au hasard d\'un compte fermé : 32 caractères, tous différents', secrets.size === 50 && [...secrets].every((s) => /^[A-Za-z0-9]{32}$/.test(s)));
check('adresse déjà prise : reconnue', ['A user with this email address has already been registered', 'duplicate key value violates unique constraint', 'Email already exists'].every(rules.isLoginTaken) && !rules.isLoginTaken('Database error'));

const goodId = 'aaaaaaaa-0000-4000-8000-000000000001';
check('demande : bonne forme', (rules.parseRequest({ action: 'close', userId: goodId, reason: ' perdu ', confirm: 'FERMER' }) as any).req.reason === 'perdu');
check('demande : action inconnue, identifiant faux, rien → refusée', ['delete_all', 'drop', undefined].every((a) => !rules.parseRequest({ action: a, userId: goodId }).ok) && !rules.parseRequest({ action: 'close', userId: 'pas-un-uuid' }).ok && !rules.parseRequest(null).ok && !rules.parseRequest('x').ok && !rules.parseRequest({ action: 'close', userId: 123 }).ok);
check('demande : les textes trop longs sont coupés', (rules.parseRequest({ action: 'close', userId: goodId, reason: 'x'.repeat(500), value: 'y'.repeat(500), confirm: 'z'.repeat(500) }) as any).req.reason.length === 200);

check('nouveau numéro valable', JSON.stringify(rules.checkNewLogin('phone', '+235 66 99 88 77', '23566123456@tel.albasseshopping.com')) === JSON.stringify({ ok: true, login: '23566998877@tel.albasseshopping.com', digits: '23566998877' }));
check('nouveau numéro : le même → refusé ; faux → refusé', (rules.checkNewLogin('phone', '66 12 34 56', '23566123456@tel.albasseshopping.com') as any).reason === 'same_login' && (rules.checkNewLogin('phone', 'abc', '23566123456@tel.albasseshopping.com') as any).reason === 'bad_phone');
check('nouvel e-mail (ancien compte) : valable en minuscules ; faux, technique ou le même → refusé',
  (rules.checkNewLogin('email', ' Amina.New@Gmail.com ', 'amina@gmail.com') as any).login === 'amina.new@gmail.com' && (rules.checkNewLogin('email', 'pas un mail', 'amina@gmail.com') as any).reason === 'bad_email'
  && (rules.checkNewLogin('email', 'x@tel.albasseshopping.com', 'amina@gmail.com') as any).reason === 'bad_email' && (rules.checkNewLogin('email', 'x@closed.albasseshopping.com', 'amina@gmail.com') as any).reason === 'bad_email'
  && (rules.checkNewLogin('email', 'AMINA@gmail.com', 'amina@gmail.com') as any).reason === 'same_login');
check('compte fermé : la connexion ne se change pas', (rules.checkNewLogin('closed', '66 12 34 56', 'closed-000001@closed.albasseshopping.com') as any).reason === 'closed');

// ---------------- étapes avec de faux accès
const ADMIN = '99999999-0000-4000-8000-000000000009';
type World = { targets: Record<string, Target>; logins: Record<string, string>; orders: Record<string, number>; authErrors?: Record<string, string>; profileError?: string };
function makeDeps(w: World) {
  const calls = { auth: [] as any[], profile: [] as any[], sanctions: [] as any[], logs: [] as any[], deleted: [] as string[] };
  const deps: Deps = {
    async getTarget(id) { return w.targets[id] ?? null; },
    async getLoginEmail(id) { return w.logins[id] ?? null; },
    async ordersCount(id) { return w.orders[id] ?? 0; },
    async updateAuth(id, attrs) {
      if (w.authErrors?.update) return { message: w.authErrors.update };
      calls.auth.push({ id, attrs });
      if (typeof attrs.email === 'string') w.logins[id] = attrs.email;
      return null;
    },
    async deleteAuth(id) {
      if (w.authErrors?.delete) return { message: w.authErrors.delete };
      calls.deleted.push(id);
      return null;
    },
    async updateProfile(id, patch) {
      if (w.profileError) return { message: w.profileError };
      calls.profile.push({ id, patch });
      return null;
    },
    async addSanction(userId, reason, adminId) { calls.sanctions.push({ userId, reason, adminId }); },
    async log(entry) { calls.logs.push(entry); },
  };
  return { deps, calls };
}
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const world = (): World => ({
  targets: {
    [id(1)]: { id: id(1), email: '23566123456@tel.albasseshopping.com', is_admin: false, client_number: 123, phone: '66 12 34 56', whatsapp_number: '66 12 34 56' },
    [id(2)]: { id: id(2), email: 'fatime@gmail.com', is_admin: false, client_number: 124, phone: '66 99 88 77', whatsapp_number: '+235 99 00 11 22' },
    [id(3)]: { id: id(3), email: 'amina@gmail.com', is_admin: false, client_number: 125, phone: '99 88 77 66', whatsapp_number: null },
    [id(4)]: { id: id(4), email: 'closed-000126@closed.albasseshopping.com', is_admin: false, client_number: 126, phone: null, whatsapp_number: null },
    [id(5)]: { id: id(5), email: 'patron@exemple.com', is_admin: true, client_number: 1, phone: null, whatsapp_number: null },
    [id(6)]: { id: id(6), email: '23566000006@tel.albasseshopping.com', is_admin: false, client_number: null, phone: '66 00 00 06', whatsapp_number: null },
  },
  logins: {
    [id(1)]: '23566123456@tel.albasseshopping.com',
    [id(2)]: '23566998877@tel.albasseshopping.com',
    [id(3)]: 'amina@gmail.com',
    [id(4)]: 'closed-000126@closed.albasseshopping.com',
    [id(5)]: 'patron@exemple.com',
    [id(6)]: '23566000006@tel.albasseshopping.com',
  },
  orders: { [id(1)]: 2, [id(3)]: 1 },
});
const req = (action: any, userId: string, extra: Record<string, string> = {}) => ({ action, userId, value: '', reason: '', confirm: '', ...extra });

// -- changer le numéro de connexion
{
  const w = world();
  const { deps, calls } = makeDeps(w);
  const r = await run(deps, ADMIN, req('change_login', id(1), { value: '+235 66 77 88 99' }));
  check('numéro de connexion changé : ok', r.ok === true && (r as any).login === '23566778899@tel.albasseshopping.com', r);
  check('la connexion Supabase reçoit la nouvelle adresse (confirmée), et rien d\'autre (pas de mot de passe)', calls.auth.length === 1 && JSON.stringify(calls.auth[0].attrs) === JSON.stringify({ email: '23566778899@tel.albasseshopping.com', email_confirm: true }));
  check('la fiche suit : téléphone joli, WhatsApp (qui était le même) et adresse tirée du numéro', JSON.stringify(calls.profile[0].patch) === JSON.stringify({ phone: '+235 66 77 88 99', whatsapp_number: '+235 66 77 88 99', email: '23566778899@tel.albasseshopping.com' }), calls.profile);
  check('journal : une ligne « change_login » avec le numéro client 123, sans aucun numéro de téléphone', calls.logs.length === 1 && calls.logs[0].action === 'change_login' && calls.logs[0].client_number === 123 && calls.logs[0].admin_id === ADMIN && !/\d{6}/.test(calls.logs[0].detail), calls.logs);
}
{
  const w = world();
  const { deps, calls } = makeDeps(w);
  const r = await run(deps, ADMIN, req('change_login', id(2), { value: '66 11 22 33' }));
  check('compte avec vrai e-mail et WhatsApp à part : seuls le téléphone change (le vrai e-mail et l\'autre WhatsApp restent)', r.ok === true && JSON.stringify(calls.profile[0].patch) === JSON.stringify({ phone: '+235 66 11 22 33' }), calls.profile);
}
{
  const w = world();
  const { deps, calls } = makeDeps(w);
  w.authErrors = { update: 'A user with this email address has already been registered' };
  const r = await run(deps, ADMIN, req('change_login', id(1), { value: '66 77 88 99' }));
  check('numéro déjà pris par un autre compte : refusé (« login_taken »), rien dans la fiche, rien dans le journal', !r.ok && (r as any).reason === 'login_taken' && calls.profile.length === 0 && calls.logs.length === 0, r);
}
{
  const w = world();
  const { deps, calls } = makeDeps(w);
  w.authErrors = { update: 'Database error saving user' };
  const r = await run(deps, ADMIN, req('change_login', id(1), { value: '66 77 88 99' }));
  check('autre panne de la connexion : « auth_error », rien n\'est changé dans la fiche', !r.ok && (r as any).reason === 'auth_error' && calls.profile.length === 0 && calls.logs.length === 0, r);
}
check('même numéro : refusé', (await run(makeDeps(world()).deps, ADMIN, req('change_login', id(1), { value: '66 12 34 56' }))) .ok === false);
check('numéro faux : « bad_phone »', ((await run(makeDeps(world()).deps, ADMIN, req('change_login', id(1), { value: 'abc' }))) as any).reason === 'bad_phone');
{
  const { deps, calls } = makeDeps(world());
  const r = await run(deps, ADMIN, req('change_login', id(3), { value: 'Amina.Nouvelle@Gmail.com' }));
  check('ancien compte (e-mail) : la connexion et la fiche prennent le nouvel e-mail en minuscules', r.ok === true && calls.auth[0].attrs.email === 'amina.nouvelle@gmail.com' && JSON.stringify(calls.profile[0].patch) === JSON.stringify({ email: 'amina.nouvelle@gmail.com' }), [r, calls]);
  const bad = await run(makeDeps(world()).deps, ADMIN, req('change_login', id(3), { value: '66 12 34 56' }));
  check('ancien compte : un numéro n\'est pas un e-mail → « bad_email »', (bad as any).reason === 'bad_email');
}
{
  const { deps, calls } = makeDeps(world());
  const r = await run(deps, ADMIN, req('change_login', id(6), { value: '66 55 44 33' }));
  check('compte sans numéro client (script pas lancé) : marche, le journal garde « null »', r.ok === true && calls.logs[0].client_number === null);
}

// -- refus communs
for (const action of ['change_login', 'close', 'delete']) {
  const { deps, calls } = makeDeps(world());
  const a = await run(deps, ADMIN, req(action, id(5), { value: '66 77 88 99', confirm: 'FERMER' }));
  const b = await run(deps, ADMIN, req(action, ADMIN, { value: '66 77 88 99', confirm: 'FERMER' }));
  const c = await run(deps, ADMIN, req(action, id(99), { value: '66 77 88 99', confirm: 'FERMER' }));
  check(`${action} : jamais sur un compte administrateur, ni sur soi-même ; compte inconnu → « not_found »`, (a as any).reason === 'is_admin' && (b as any).reason === 'not_found' && (c as any).reason === 'not_found' && calls.auth.length === 0 && calls.profile.length === 0 && calls.deleted.length === 0 && calls.logs.length === 0, [a, b, c]);
}
{
  const w = world();
  w.targets[ADMIN] = { id: ADMIN, email: 'moi@exemple.com', is_admin: true, client_number: 2, phone: null, whatsapp_number: null };
  w.logins[ADMIN] = 'moi@exemple.com';
  const { deps } = makeDeps(w);
  check('un administrateur ne se modifie pas lui-même', ((await run(deps, ADMIN, req('close', ADMIN, { confirm: 'FERMER' }))) as any).reason === 'is_admin');
}

// -- fermer le compte
{
  const w = world();
  const { deps, calls } = makeDeps(w);
  const refus = await run(deps, ADMIN, req('close', id(1)));
  check('fermer sans taper FERMER : refusé, rien ne bouge', (refus as any).reason === 'bad_confirm' && calls.auth.length === 0 && calls.profile.length === 0);
  const r = await run(deps, ADMIN, req('close', id(1), { confirm: 'fermer', reason: 'téléphone volé' }));
  check('fermer : ok (« fermer » en minuscules accepté)', r.ok === true, r);
  const a = calls.auth[0].attrs;
  check('connexion : adresse de compte fermé (libère le numéro), mot de passe au hasard, bloquée ~100 ans', a.email === 'closed-000123@closed.albasseshopping.com' && a.email_confirm === true && /^[A-Za-z0-9]{32}$/.test(a.password) && a.ban_duration === '876000h', a);
  const p = calls.profile[0].patch;
  check('fiche : nom « Compte fermé », coordonnées effacées, bloquée, notifications coupées, Telegram délié', p.full_name === 'Compte fermé' && p.phone === null && p.whatsapp_number === null && p.address === null && p.region === null && p.profession === null && p.avatar_url === null && p.banned === true && p.notify_promotions === false && p.telegram_chat_id === null && p.email === a.email, p);
  check('les commandes ne sont pas touchées (aucune suppression, aucun changement de commande)', calls.deleted.length === 0 && !JSON.stringify(calls).includes('orders'));
  check('historique des sanctions : une ligne « Compte fermé : téléphone volé »', calls.sanctions.length === 1 && calls.sanctions[0].reason === 'Compte fermé : téléphone volé' && calls.sanctions[0].adminId === ADMIN, calls.sanctions);
  check('journal : « close » avec le numéro client, le motif et AUCUN nom ni téléphone', calls.logs.length === 1 && calls.logs[0].action === 'close' && calls.logs[0].client_number === 123 && calls.logs[0].detail === 'compte fermé : téléphone volé', calls.logs);
  const again = await run(deps, ADMIN, req('close', id(1), { confirm: 'FERMER' }));
  check('fermer un compte déjà fermé : « already_closed »', (again as any).reason === 'already_closed');
  const change = await run(deps, ADMIN, req('change_login', id(1), { value: '66 77 88 99' }));
  check('un compte fermé ne change plus de connexion', (change as any).reason === 'closed');
}
{
  const { deps } = makeDeps(world());
  check('compte déjà fermé (au départ) : « already_closed »', ((await run(deps, ADMIN, req('close', id(4), { confirm: 'FERMER' }))) as any).reason === 'already_closed');
}
{
  const w = world();
  w.authErrors = { update: 'boom' };
  const { deps, calls } = makeDeps(w);
  const r = await run(deps, ADMIN, req('close', id(1), { confirm: 'FERMER' }));
  check('fermer : si la connexion refuse, la fiche n\'est PAS effacée et rien n\'est noté', !r.ok && (r as any).reason === 'auth_error' && calls.profile.length === 0 && calls.logs.length === 0 && calls.sanctions.length === 0, r);
}
{
  const w = world();
  w.profileError = 'column "gender" does not exist';
  const { deps, calls } = makeDeps(w);
  const r = await run(deps, ADMIN, req('close', id(1), { confirm: 'FERMER' }));
  check('fermer : connexion coupée mais fiche pas effacée (panne) → ok, et le journal dit « fiche à effacer à la main »', r.ok === true && /fiche à effacer à la main/.test(calls.logs[0].detail), calls.logs);
}

// -- supprimer pour de bon
{
  const { deps, calls } = makeDeps(world());
  const r = await run(deps, ADMIN, req('delete', id(1), { confirm: 'AS-000123' }));
  check('supprimer un compte qui a des commandes : refusé « has_orders » (les commandes seraient effacées avec lui)', (r as any).reason === 'has_orders' && calls.deleted.length === 0 && calls.logs.length === 0, r);
}
{
  const { deps, calls } = makeDeps(world());
  const no = await run(deps, ADMIN, req('delete', id(2), { confirm: 'AS-000999' }));
  const empty = await run(deps, ADMIN, req('delete', id(2)));
  check('supprimer sans la bonne confirmation (numéro client) : refusé, rien n\'est supprimé', (no as any).reason === 'bad_confirm' && (empty as any).reason === 'bad_confirm' && calls.deleted.length === 0, [no, empty]);
  const yes = await run(deps, ADMIN, req('delete', id(2), { confirm: 'as-000124' }));
  check('supprimer un compte sans commande, avec « as-000124 » : ok', yes.ok === true && calls.deleted.length === 1 && calls.deleted[0] === id(2), yes);
  check('journal : « delete » avec le numéro client 124, noté APRÈS la suppression, sans donnée personnelle', calls.logs.length === 1 && calls.logs[0].action === 'delete' && calls.logs[0].client_number === 124 && calls.logs[0].target_id === id(2) && !/@|\d{8}/.test(calls.logs[0].detail), calls.logs);
}
{
  const { deps, calls } = makeDeps(world());
  const r = await run(deps, ADMIN, req('delete', id(6), { confirm: id(6).slice(0, 8) }));
  check('sans numéro client : la confirmation est les 8 premiers caractères de l\'identifiant', r.ok === true && calls.deleted[0] === id(6), r);
}
{
  const w = world();
  w.authErrors = { delete: 'boom' };
  const { deps, calls } = makeDeps(w);
  const r = await run(deps, ADMIN, req('delete', id(2), { confirm: 'AS-000124' }));
  check('suppression refusée par Supabase : « auth_error », rien noté dans le journal', !r.ok && (r as any).reason === 'auth_error' && calls.logs.length === 0, r);
}

console.log(`\n${ok} contrôles réussis`);
