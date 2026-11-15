// Double vérification des admins, dans le navigateur, sur le site fabriqué (expo export). Supabase est SIMULÉ :
// faux comptes, faux téléphone (code accepté : 123456). Aucune écriture dans la vraie base, aucun vrai compte touché.
// Usage : NODE_PATH=/opt/node-tools/node_modules node tests/account/admin-mfa-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4520';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;
const GOOD = '123456';

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, aal) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal, amr: aal === 'aal2' ? [{ method: 'password', timestamp: 1 }, { method: 'totp', timestamp: 2 }] : [{ method: 'password', timestamp: 1 }], session_id: 's1' })}.c2ln`;
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 };
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="#ffffff"/><path fill="#072469" d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0zM9 9h3v3H9zM15 15h2v2h-2zM9 2h2v2H9zM2 9h2v2H2z"/></svg>';

// un visiteur avec un compte simulé. who : 'admin' | 'client'. factors : faux facteurs du compte. aal : niveau de la session au départ.
async function visitor(b, { who, factors = [], aal = 'aal1', path: pagePath = '/compte' }) {
  const uid = who === 'admin' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666';
  const state = { factors: factors.map((f) => ({ ...f })), aal, calls: [], verifyCodes: [] };
  const user = () => ({ id: uid, aud: 'authenticated', role: 'authenticated', email: `${who}@example.com`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', factors: state.factors });
  const session = () => ({ access_token: jwt(uid, state.aal), refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: user() });
  const profile = { id: uid, email: `${who}@example.com`, full_name: who === 'admin' ? 'Admin Albasse' : 'Client Test', phone: '66123456', banned: false, is_admin: who === 'admin', loyalty_points: 0, client_number: 12 };
  const ctx = await b.newContext(phone);
  await ctx.addInitScript(([sk, s]) => {
    try {
      // seulement au premier chargement : après le code, la nouvelle session (aal2) gardée par supabase-js doit rester
      if (!sessionStorage.getItem('__mfa_seeded')) { localStorage.setItem(sk, s); sessionStorage.setItem('__mfa_seeded', '1'); }
      localStorage.setItem('albasse_cookie_consent', 'refused');
      localStorage.setItem('albasse_app_banner_dismissed', '1');
      localStorage.setItem('albasse_app_popup_seen_' + new Date().toISOString().slice(0, 10), '1');
      localStorage.setItem('albasse_zara_install', JSON.stringify({ at: Date.now(), outcome: 'dismissed' }));
      localStorage.setItem('albasse_zara_push', JSON.stringify({ at: Date.now(), outcome: 'later' }));
      localStorage.setItem('albasse_install_after_signup', '1');
      localStorage.setItem('albasse_remember_login', '1');
    } catch (e) {}
  }, [SK, JSON.stringify(session())]);
  const page = await ctx.newPage();
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
  await page.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const m = req.method();
    if (u.origin === BASE) return route.continue();
    if (!u.hostname.endsWith('.supabase.co')) return route.abort();
    if (m === 'OPTIONS') return json(route, {});
    // --- auth simulée ---
    if (u.pathname === '/auth/v1/user') return json(route, user());
    if (u.pathname === '/auth/v1/token') return json(route, session());
    if (u.pathname === '/auth/v1/logout') return json(route, {}, 204);
    if (u.pathname === '/auth/v1/factors' && m === 'POST') {
      state.calls.push('enroll');
      const f = { id: 'f-new', factor_type: 'totp', status: 'unverified', friendly_name: 'Albasse admin', created_at: '2026-11-15T00:00:00Z' };
      state.factors.push(f);
      return json(route, { id: f.id, type: 'totp', friendly_name: f.friendly_name, totp: { qr_code: QR_SVG, secret: 'KJ4EWQ7SABCDEFGH', uri: 'otpauth://totp/Albasse:admin?secret=KJ4EWQ7SABCDEFGH' } });
    }
    let mm = u.pathname.match(/^\/auth\/v1\/factors\/([^/]+)$/);
    if (mm && m === 'DELETE') {
      state.calls.push('unenroll:' + mm[1]);
      state.factors = state.factors.filter((f) => f.id !== mm[1]);
      return json(route, { id: mm[1] });
    }
    mm = u.pathname.match(/^\/auth\/v1\/factors\/([^/]+)\/challenge$/);
    if (mm) {
      state.calls.push('challenge:' + mm[1]);
      return json(route, { id: 'ch-' + state.calls.length, type: 'totp', expires_at: 4102444800 });
    }
    mm = u.pathname.match(/^\/auth\/v1\/factors\/([^/]+)\/verify$/);
    if (mm) {
      const body = JSON.parse(req.postData() || '{}');
      state.verifyCodes.push(body.code);
      if (body.code !== GOOD) return json(route, { code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
      state.factors = state.factors.map((f) => (f.id === mm[1] ? { ...f, status: 'verified' } : f));
      state.aal = 'aal2';
      return json(route, session());
    }
    // --- base simulée : profil du compte, réglages sans mur ; le reste vide ---
    if (u.pathname === '/rest/v1/profiles') {
      const accept = req.headers()['accept'] || '';
      return json(route, accept.includes('vnd.pgrst.object') ? profile : [profile]);
    }
    if (u.pathname === '/rest/v1/store_settings') {
      const accept = req.headers()['accept'] || '';
      const row = { id: 1, shop_name: 'Albasse Shopping', account_required: false, city: "N'Djamena", country: 'Tchad' };
      return json(route, accept.includes('vnd.pgrst.object') ? row : [row]);
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    if (u.pathname.startsWith('/rest/v1/')) {
      const accept = req.headers()['accept'] || '';
      return accept.includes('vnd.pgrst.object') ? json(route, { code: 'PGRST116', message: 'no rows' }, 406) : json(route, []);
    }
    return json(route, {});
  });
  await page.goto(BASE + pagePath, { waitUntil: 'domcontentloaded' });
  return { ctx, page, state };
}

const typeCode = async (page, testId, code) => {
  const input = page.getByTestId(testId);
  await input.click({ force: true });
  await input.fill('');
  await page.keyboard.type(code, { delay: 30 });
};

(async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  const errors = [];

  // 1) client : jamais de code
  {
    const v = await visitor(b, { who: 'client', factors: [] });
    v.page.on('pageerror', (e) => errors.push(e.message));
    await sleep(5000);
    check('client : aucun écran de code', (await v.page.getByTestId('admin-mfa-gate').count()) === 0);
    await v.ctx.close();
  }

  // 2) admin SANS double vérification : comme avant (pas d'écran de code) ; la page « Double vérification » propose la mise en route
  {
    const v = await visitor(b, { who: 'admin', factors: [], path: '/admin/securite' });
    v.page.on('pageerror', (e) => errors.push(e.message));
    await v.page.getByTestId('admin-security').waitFor({ timeout: 20000 });
    await sleep(1500);
    check('admin sans double vérification : pas d\'écran de code (comme avant)', (await v.page.getByTestId('admin-mfa-gate').count()) === 0);
    check('page « Double vérification » : bouton « Commencer »', (await v.page.getByTestId('admin-security-start').count()) === 1);
    await v.page.getByTestId('admin-security-start').click();
    await v.page.getByTestId('admin-security-setup').waitFor({ timeout: 10000 });
    await sleep(800);
    const qr = await v.page.getByTestId('admin-security-qr').locator('img').first().evaluate((img) => ({ alt: img.getAttribute('alt'), w: img.naturalWidth, src: img.getAttribute('src').slice(0, 40) })).catch((e) => ({ err: e.message }));
    check('mise en route : le QR code s\'affiche (image chargée, texte alternatif)', qr.w > 0 && /QR code/.test(qr.alt || ''), qr);
    check('mise en route : la clé à taper à la main, par groupes de 4', (await v.page.getByTestId('admin-security-secret').innerText()).includes('KJ4E WQ7S ABCD EFGH'));
    await v.page.screenshot({ path: path.join(OUT, 'mfa-1-mise-en-route.png') });
    await typeCode(v.page, 'admin-security-code', '111111');
    await sleep(1200);
    check('mauvais code : message clair, pas activée', /Code incorrect/.test(await v.page.getByTestId('admin-security-error').innerText().catch(() => '')) && (await v.page.getByTestId('admin-security-active').count()) === 0, v.state.verifyCodes);
    await typeCode(v.page, 'admin-security-code', GOOD);
    await v.page.getByTestId('admin-security-active').waitFor({ timeout: 10000 });
    check('bon code : « Double vérification activée »', /activée/.test(await v.page.getByTestId('admin-security-active').innerText()) && v.state.factors.some((f) => f.status === 'verified'), v.state);
    check('le code est vérifié par Supabase (verify), pas par le site', v.state.verifyCodes.join(',') === `111111,${GOOD}`);
    await v.page.screenshot({ path: path.join(OUT, 'mfa-2-activee.png') });
    await v.ctx.close();
  }

  // 3) admin avec double vérification, connexion par mot de passe seulement (aal1) : l'écran du code bloque tout
  {
    const v = await visitor(b, { who: 'admin', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'tel' }], aal: 'aal1', path: '/compte' });
    v.page.on('pageerror', (e) => errors.push(e.message));
    await v.page.getByTestId('admin-mfa-gate').waitFor({ timeout: 20000 });
    check('admin + double vérification + mot de passe seul : écran « Code de vérification »', /Code de vérification/.test(await v.page.getByTestId('admin-mfa-gate').innerText()));
    check('pendant l\'écran du code : Zara et les fenêtres sont cachées', (await v.page.getByTestId('assistant-fab').count()) === 0);
    check('« Valider » grisé tant qu\'il manque des chiffres', await v.page.getByTestId('admin-mfa-submit').evaluate((el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')).catch(() => false));
    await v.page.getByTestId('admin-mfa-lost').click();
    check('« Téléphone perdu ? » explique quoi faire', /Supabase/.test(await v.page.getByTestId('admin-mfa-help').innerText()));
    await v.page.screenshot({ path: path.join(OUT, 'mfa-3-code-demande.png') });
    await typeCode(v.page, 'admin-mfa-code', '000000');
    await sleep(1200);
    check('mauvais code : refusé, message clair, l\'écran reste', /Code incorrect/.test(await v.page.getByTestId('admin-mfa-error').innerText().catch(() => '')) && (await v.page.getByTestId('admin-mfa-gate').count()) === 1);
    await typeCode(v.page, 'admin-mfa-code', GOOD);
    const okShown = await v.page.getByTestId('admin-mfa-ok').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    if (okShown) await v.page.screenshot({ path: path.join(OUT, 'mfa-4-code-correct.png') }).catch(() => {});
    check('bon code : « Code correct », session passée en aal2', okShown && v.state.aal === 'aal2', { calls: v.state.calls, codes: v.state.verifyCodes, err: await v.page.getByTestId('admin-mfa-error').innerText().catch(() => null), boxes: await v.page.getByTestId('admin-mfa-code').inputValue().catch(() => null) });
    await v.page.waitForLoadState('load');
    await sleep(4000);
    check('après le code (page rechargée) : plus d\'écran de code', (await v.page.getByTestId('admin-mfa-gate').count()) === 0);
    await v.ctx.close();
  }

  // 4) admin déjà passé par le code (aal2) : rien à demander ; la page dit « active »
  {
    const v = await visitor(b, { who: 'admin', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'tel' }], aal: 'aal2', path: '/admin/securite' });
    v.page.on('pageerror', (e) => errors.push(e.message));
    await v.page.getByTestId('admin-security').waitFor({ timeout: 20000 });
    await sleep(2500);
    check('admin en aal2 : pas d\'écran de code', (await v.page.getByTestId('admin-mfa-gate').count()) === 0);
    check('page : « La double vérification est active »', /active/.test(await v.page.getByTestId('admin-security-active').innerText().catch(() => '')));
    await v.ctx.close();
  }

  // 5) « Se déconnecter » depuis l'écran du code
  {
    const v = await visitor(b, { who: 'admin', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }], aal: 'aal1', path: '/' });
    await v.page.getByTestId('admin-mfa-gate').waitFor({ timeout: 20000 });
    await v.page.getByTestId('admin-mfa-signout').click();
    await sleep(2500);
    check('« Se déconnecter » : l\'écran du code disparaît', (await v.page.getByTestId('admin-mfa-gate').count()) === 0);
    await v.ctx.close();
  }

  check('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3));
  await b.close();
  server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nAVEC DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERREUR', e);
  process.exit(2);
});
