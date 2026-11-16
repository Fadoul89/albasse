// Assistant marketing + psychologie de la vente, dans le navigateur, sur le site fabriqué (expo export). Supabase est SIMULÉ :
// faux compte administrateur, fausse fonction « marketing-ai » (aucune IA appelée, aucune écriture dans la vraie base).
// Usage : NODE_PATH=/opt/node-tools/node_modules node tests/account/marketing-levers-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4530';
const OUT = process.argv[4] || os.tmpdir();
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, ""); // BASE_URL=https://www.albasseshopping.com : le vrai site (Supabase toujours simulé)

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, aal) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal, amr: aal === 'aal2' ? [{ method: 'password', timestamp: 1 }, { method: 'totp', timestamp: 2 }] : [{ method: 'password', timestamp: 1 }], session_id: 's1' })}.c2ln`;
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 };
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
const PRODUCTS = [
  { id: '907110fd-65ae-479f-8f1f-dd4fa8693afd', name: 'COTTON SWISS 100 % COTON' },
  { id: '11111111-2222-4333-8444-555555555555', name: 'Sandale cuir' },
];
// les vrais chiffres renvoyés par la fonction (mêmes formes que supabase/functions/marketing-ai/levers.ts)
const FACTS = {
  [PRODUCTS[0].id]: {
    facts: { hasProduct: true, price: 40000, oldPrice: 50000, saving: 10000, pct: 20, stock: 500, endsAt: '2026-11-16T18:45:30Z', views: 1842, rank: 1, gift: true },
    levers: [{ key: 'social', available: true }, { key: 'loss', available: true }, { key: 'urgency', available: true }, { key: 'scarcity', available: false, reason: 'stock_ok' }, { key: 'trend', available: true }, { key: 'reciprocity', available: true }],
  },
  [PRODUCTS[1].id]: {
    facts: { hasProduct: true, price: 15000, oldPrice: null, saving: 0, pct: 0, stock: 3, endsAt: null, views: 0, rank: null, gift: true },
    levers: [{ key: 'social', available: false, reason: 'few_views' }, { key: 'loss', available: false, reason: 'no_discount' }, { key: 'urgency', available: false, reason: 'no_deadline' }, { key: 'scarcity', available: true }, { key: 'trend', available: false, reason: 'not_top' }, { key: 'reciprocity', available: true }],
  },
};
const TEXT = 'Version 1 · **Preuve sociale**\n👀 1842 personnes ont regardé ce tissu ces 30 derniers jours… et on comprend pourquoi !\nCOTTON SWISS 100 % coton : 40 000 FCFA.\n\nVersion 2 · Aversion à la perte\nPourquoi payer 50 000 FCFA ? Aujourd’hui 40 000 FCFA : vous gardez 10 000 FCFA dans votre poche.';
const ai = (body) => {
  if (body.action === 'facts') return FACTS[body.productId] ? { ok: true, ...FACTS[body.productId] } : { ok: true, facts: { hasProduct: false }, levers: [] };
  if (body.lever === 'scarcity' && body.productId === PRODUCTS[0].id) return { ok: false, reason: 'lever' };
  return { ok: true, text: TEXT, levers: body.lever === 'auto' ? ['urgency', 'loss'] : [body.lever], warnings: body.goal === 'faux' ? ['rareté'] : [] };
};

// un visiteur avec un compte simulé. who : 'admin' | 'client'. factors : faux facteurs du compte. aal : niveau de la session au départ.
async function visitor(b, { who, factors = [], aal = 'aal1', path: pagePath = '/compte', ai }) {
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
    // --- l'assistant marketing (fonction serveur) : simulé ; ai(body) donne la réponse ---
    if (u.pathname === '/functions/v1/marketing-ai' && m === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      state.calls.push(body);
      return json(route, ai(body));
    }
    if (u.pathname === '/rest/v1/products') return json(route, PRODUCTS.map((p) => ({ id: p.id, name: p.name })));
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


(async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  const errors = [];
  const v = await visitor(b, { who: 'admin', factors: [], path: '/admin/assistant-marketing', ai });
  const { page, state } = v;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByTestId('admin-marketing').waitFor({ timeout: 25000 });
  await sleep(1200);
  const leverState = async () =>
    page.getByTestId('marketing-levers').locator('[data-testid^="marketing-lever-"]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-testid').replace('marketing-lever-', ''), off: e.getAttribute('aria-disabled') === 'true', on: e.getAttribute('aria-checked') === 'true' })));

  // 1) sans article : seulement « Automatique » et « Réciprocité » (le cadeau du chat)
  let ls = await leverState();
  check('sans article : 7 leviers, seuls Automatique et Réciprocité actifs, Automatique choisi', ls.length === 7 && ls.filter((l) => !l.off).map((l) => l.id).join() === 'auto,reciprocity' && ls.find((l) => l.id === 'auto').on, ls);
  check('sans article : la raison « choisissez un article » est écrite', /choisissez un article/.test(await page.getByTestId('marketing-levers-hint').innerText()));
  check('sans article : pas de carte de chiffres', (await page.getByTestId('marketing-facts').count()) === 0);

  // 2) COTTON SWISS : les vrais chiffres et les leviers vrais (pas la rareté)
  await page.getByText(PRODUCTS[0].name, { exact: true }).first().click();
  await page.getByTestId('marketing-facts').getByText(/1 842 personnes/).waitFor({ timeout: 10000 });
  const facts = await page.getByTestId('marketing-facts').innerText();
  check('chiffres : 1 842 personnes (n° 1), 40 000 au lieu de 50 000, 10 000 économisés, fin de promo, stock normal', /1 842 personnes l'ont regardé en 30 jours \(n° 1 des plus regardés\)/.test(facts) && /40 000 FCFA au lieu de 50 000 FCFA : 10 000 FCFA économisés \(-20 %\)/.test(facts) && /La promotion se termine/.test(facts) && /Stock : 500 \(pas de « stock limité »\)/.test(facts), facts);
  check('la fonction est interrogée sur cet article (action « facts »)', state.calls.some((c) => c.action === 'facts' && c.productId === PRODUCTS[0].id));
  ls = await leverState();
  check('COTTON SWISS : tous les leviers actifs sauf la Rareté (stock normal)', ls.filter((l) => l.off).map((l) => l.id).join() === 'scarcity', ls);
  check('la raison de la Rareté barrée : « stock normal »', /Rareté \(stock normal\)/.test(await page.getByTestId('marketing-levers-hint').innerText()));
  await page.setViewportSize({ width: 390, height: 1500 });
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, 'marketing-1-chiffres.png') });

  // 3) écrire avec « Automatique » : le levier part avec la demande ; le texte est montré sans étoiles
  await page.getByTestId('marketing-write').click();
  await page.getByTestId('marketing-result').waitFor({ timeout: 10000 });
  const w1 = state.calls.filter((c) => c.channel).pop();
  check('écrire : la demande part avec le levier « auto », le canal et l\'article', w1 && w1.lever === 'auto' && w1.channel === 'facebook' && w1.productId === PRODUCTS[0].id, w1);
  const res = await page.getByTestId('marketing-result').innerText();
  check('le texte montre « Version 1 · Preuve sociale » (sans les étoiles du gras)', /Version 1 · Preuve sociale/.test(res) && !/\*/.test(res) && /Version 2 · Aversion à la perte/.test(res), res);
  check('texte fidèle : aucun avertissement', (await page.getByTestId('marketing-warning').count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'marketing-2-texte.png') });

  // 4) choisir « Preuve sociale » : c'est lui qui part
  await page.getByTestId('marketing-lever-social').click();
  await sleep(200);
  await page.getByTestId('marketing-write').click();
  await sleep(1200);
  check('levier choisi « Preuve sociale » : envoyé tel quel', state.calls.filter((c) => c.channel).pop().lever === 'social');

  // 5) un avertissement de la fonction est montré en phrase simple
  await page.getByPlaceholder(/fête des mères/).fill('faux');
  await page.getByTestId('marketing-write').click();
  await page.getByTestId('marketing-warning').waitFor({ timeout: 10000 });
  check('avertissement : « Vérifiez avant de publier : il parle de stock limité alors que le stock est normal »', /Vérifiez avant de publier : il parle de stock limité alors que le stock est normal/.test(await page.getByTestId('marketing-warning').innerText()));

  // 6) autre article (stock 3, sans promo) : la Preuve sociale n'est plus vraie -> retour à « Automatique » ; la Rareté devient vraie
  await page.getByTestId('marketing-picked').click();
  await page.getByText(PRODUCTS[1].name, { exact: true }).first().click();
  await page.getByTestId('marketing-facts').getByText(/Plus que 3 en stock/).waitFor({ timeout: 10000 });
  ls = await leverState();
  check('Sandale (stock 3, pas de promo, peu de visites) : Rareté et Réciprocité actives ; Preuve sociale, Perte, Urgence, Mode barrées', ls.filter((l) => !l.off).map((l) => l.id).join() === 'auto,scarcity,reciprocity', ls);
  check('le levier « Preuve sociale » choisi avant n\'est plus vrai : retour à « Automatique »', ls.find((l) => l.id === 'auto').on && !ls.find((l) => l.id === 'social').on, ls);
  const f2 = await page.getByTestId('marketing-facts').innerText();
  check('chiffres : « Moins de 50 personnes » et « 15 000 FCFA (pas de promotion en cours) »', /Moins de 50 personnes/.test(f2) && /15 000 FCFA \(pas de promotion en cours\)/.test(f2), f2);
  await page.screenshot({ path: path.join(OUT, 'marketing-3-autre-article.png') });

  check('aucune erreur de page', errors.length === 0, errors);
  await v.ctx.close();
  await b.close();
  server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
