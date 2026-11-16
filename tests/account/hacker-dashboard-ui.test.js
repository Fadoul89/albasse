// Tableau de bord « couleur hacker », dans le navigateur, sur le site fabriqué (expo export). Supabase est SIMULÉ :
// faux compte administrateur, fausse fonction admin_dashboard_overview (aucune lecture ni écriture dans la vraie base).
// Usage : NODE_PATH=/opt/node-tools/node_modules node tests/account/hacker-dashboard-ui.test.js <dossier dist> [port] [dossier des images]
// DATA_DIR=<dossier> : prend les réponses dans <dossier>/real-<période>.json (today, 7d, 30d, all) au lieu des chiffres du test.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4531';
const OUT = process.argv[4] || os.tmpdir();
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''); // BASE_URL=https://www.albasseshopping.com : le vrai site (Supabase toujours simulé)

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const sp = (s) => String(s).replace(/[  ]/g, ' ');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: 1 }, { method: 'totp', timestamp: 2 }], session_id: 's1' })}.c2ln`;
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 };
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';

// les réponses de la fonction : mêmes formes que add-admin-dashboard.sql (vrais totaux du 16 novembre 2026 pour 30 jours)
const WEEKS = [485, 2, 1117, 2617, 3341, 238, 1737, 3584, 7471, 1931, 10738, 120].map((v, i) => ({ week: new Date(Date.UTC(2026, 7, 31 + i * 7)).toISOString().slice(0, 10), visitors: v }));
const TEST_DATA = {
  '30d': {
    period: '30d', since: '2026-10-17T11:35:01Z', visitors: 24180, visitors_prev: 7101, new_customers: 541, new_customers_prev: 9, orders: 1, orders_prev: 0, revenue: 0, products: 623, categories: 18, weeks: WEEKS,
    sources: [{ source: 'TikTok', visitors: 13887 }, { source: 'Publicité / campagne', visitors: 5685 }, { source: 'Accès direct', visitors: 3155 }, { source: 'Facebook', visitors: 1695 }, { source: 'Autre', visitors: 197 }, { source: 'Google', visitors: 41 }],
    top: [{ product_id: '907110fd-65ae-479f-8f1f-dd4fa8693afd', name: 'COTTON SWISS 100 % COTON ', visitors: 1844 }, { product_id: '0c7e6708-fb70-413c-9862-6e041adc963f', name: 'Chaussures homme slip-on sport ', visitors: 1641 }],
  },
  today: { period: 'today', since: '2026-11-15T23:00:00Z', visitors: 122, visitors_prev: 61, new_customers: 4, new_customers_prev: 2, orders: 0, orders_prev: 0, revenue: 0, products: 623, categories: 18, weeks: WEEKS, sources: [{ source: 'Accès direct', visitors: 56 }], top: [] },
  '7d': { period: '7d', since: '2026-11-09T11:46:04Z', visitors: 10501, visitors_prev: 2206, new_customers: 223, new_customers_prev: 266, orders: 1, orders_prev: 0, revenue: 25000, products: 623, categories: 18, weeks: WEEKS, sources: [{ source: 'TikTok', visitors: 8633 }], top: [] },
  all: { period: 'all', since: null, visitors: 39366, visitors_prev: null, new_customers: 1033, new_customers_prev: null, orders: 1, orders_prev: null, revenue: 0, products: 623, categories: 18, weeks: WEEKS, sources: [], top: [] },
};
const DATA_DIR = process.env.DATA_DIR;
const DATA = DATA_DIR ? Object.fromEntries(['today', '7d', '30d', 'all'].map((k) => [k, JSON.parse(fs.readFileSync(path.join(DATA_DIR, `real-${k}.json`), 'utf8'))])) : TEST_DATA;

// un administrateur simulé. rpc(p_period) : réponse de la fonction ({ status, body }) ; who : 'admin' | 'client'
async function visitor(b, { who = 'admin', rpc, viewport, pagePath = '/admin/tableau-de-bord-hacker' }) {
  const uid = who === 'admin' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666';
  const state = { calls: [], writes: [] };
  const factors = who === 'admin' ? [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Albasse admin', created_at: '2026-11-15T00:00:00Z' }] : [];
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: `${who}@example.com`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', factors };
  const session = { access_token: jwt(uid), refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
  const profile = { id: uid, email: `${who}@example.com`, full_name: who === 'admin' ? 'Admin Albasse' : 'Client Test', phone: '66123456', banned: false, is_admin: who === 'admin', loyalty_points: 0, client_number: 12 };
  const ctx = await b.newContext(viewport ? { viewport, deviceScaleFactor: 1.5 } : phone);
  await ctx.addInitScript(([sk, s]) => {
    try {
      localStorage.setItem(sk, s);
      localStorage.setItem('albasse_cookie_consent', 'refused');
      localStorage.setItem('albasse_app_banner_dismissed', '1');
      localStorage.setItem('albasse_app_popup_seen_' + new Date().toISOString().slice(0, 10), '1');
      localStorage.setItem('albasse_zara_install', JSON.stringify({ at: Date.now(), outcome: 'dismissed' }));
      localStorage.setItem('albasse_zara_push', JSON.stringify({ at: Date.now(), outcome: 'later' }));
      localStorage.setItem('albasse_install_after_signup', '1');
      localStorage.setItem('albasse_remember_login', '1');
    } catch (e) {}
  }, [SK, JSON.stringify(session)]);
  const page = await ctx.newPage();
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
  await page.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const m = req.method();
    if (u.origin === BASE) return route.continue();
    if (!u.hostname.endsWith('.supabase.co')) return route.abort();
    if (m === 'OPTIONS') return json(route, {});
    if (u.pathname === '/auth/v1/user') return json(route, user);
    if (u.pathname === '/auth/v1/token') return json(route, session);
    if (u.pathname === '/rest/v1/rpc/admin_dashboard_overview') {
      const body = JSON.parse(req.postData() || '{}');
      state.calls.push(body.p_period);
      const r = rpc(body.p_period);
      return json(route, r.body, r.status || 200);
    }
    // (l'enregistrement de la visite, fait sur toutes les pages du site, n'est pas une écriture du tableau de bord)
    if (m !== 'GET' && m !== 'HEAD' && !u.pathname.startsWith('/rest/v1/rpc/') && !u.pathname.startsWith('/auth/') && u.pathname !== '/rest/v1/visitor_sessions') state.writes.push(`${m} ${u.pathname}`);
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
  const okRpc = (p) => ({ body: DATA[p] || DATA['30d'] });

  // 1) depuis l'ancien tableau de bord : le bouton « Tableau de bord hacker » ouvre le nouveau
  let v = await visitor(b, { rpc: okRpc, pagePath: '/admin/tableau-de-bord' });
  v.page.on('pageerror', (e) => errors.push(e.message));
  await v.page.getByTestId('dashboard-hacker-link').waitFor({ timeout: 25000 });
  check('ancien tableau de bord : le bouton « Tableau de bord hacker » est là', /Tableau de bord hacker/.test(await v.page.getByTestId('dashboard-hacker-link').innerText()));
  await v.page.getByTestId('dashboard-hacker-link').click();
  await v.page.getByTestId('hacker-visitors-value').waitFor({ timeout: 15000 });
  check('le bouton ouvre /admin/tableau-de-bord-hacker', new URL(v.page.url()).pathname === '/admin/tableau-de-bord-hacker', v.page.url());
  await v.page.getByTestId('hacker-back').click();
  await v.page.getByTestId('dashboard-hacker-link').waitFor({ timeout: 10000 });
  check('« retour » ramène à l\'ancien tableau de bord (toujours là)', new URL(v.page.url()).pathname === '/admin/tableau-de-bord', v.page.url());
  await v.ctx.close();

  // 2) téléphone : 30 jours par défaut, les vrais chiffres
  v = await visitor(b, { rpc: okRpc });
  const { page, state } = v;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByTestId('hacker-visitors-value').waitFor({ timeout: 25000 });
  await sleep(600);
  const d30 = DATA['30d'];
  check('30 jours demandés par défaut', state.calls[0] === '30d', state.calls);
  check('ligne de commande « ./tableau_de_bord --30j »', /root@albasse:~\$ \.\/tableau_de_bord --30j/.test(await page.getByTestId('hacker-command').innerText()));
  const t = async (id) => sp(await page.getByTestId(id).innerText());
  check('carte Visiteurs', (await t('hacker-visitors-value')) === sp(d30.visitors.toLocaleString('fr-FR')), await t('hacker-visitors-value'));
  if (!DATA_DIR) {
    check('Visiteurs : ▲ +241 % vs 30 j d\'avant', (await t('hacker-visitors-line')) === "▲ +241 % vs 30 j d'avant", await t('hacker-visitors-line'));
    check('Nouveaux clients : 541, ▲ +532 (peu de clients avant : en nombre)', (await t('hacker-customers-value')) === '541' && (await t('hacker-customers-line')) === "▲ +532 vs 30 j d'avant", await t('hacker-customers-line'));
    check('Commandes : 1, chiffre livré 0 FCFA', (await t('hacker-orders-value')) === '1' && (await t('hacker-orders-line')) === 'Chiffre livré : 0 FCFA');
    check('Articles : 623 dans 18 catégories', (await t('hacker-products-value')) === '623' && (await t('hacker-products-line')) === 'dans 18 catégories');
    check('jauge : 2,2 %', (await t('hacker-rate')) === '2,2 %' && /541 nouveaux clients sur 24 180 visiteurs/.test(await t('hacker-rate-sub')), await t('hacker-rate'));
    check('commandes : « moins de 0,1 % »', /Commandes : 1 sur 24 180 \(moins de 0,1 %\)/.test(await t('hacker-gauge')));
    const src = await t('hacker-sources');
    check('sources : TikTok 13 887 en premier, « Publicité » raccourci, Google 41', /🎵 TikTok\s+13 887/.test(src) && /📣 Publicité\s+5 685/.test(src) && !/campagne/.test(src) && /🔎 Google\s+41/.test(src), src);
    const top = await t('hacker-top');
    check('plus regardés : COTTON SWISS 1 844', /COTTON SWISS 100 % COTON\s+1 844/.test(top), top);
  }
  check('12 barres de semaines', (await page.locator('[data-testid^="hacker-bar-"]').count()) === 12);
  const h = await page.locator('[data-testid^="hacker-bar-"]').evaluateAll((els) => els.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), o: getComputedStyle(e).opacity })));
  const maxI = d30.weeks.reduce((bi, w, i, a) => (w.visitors > a[bi].visitors ? i : bi), 0);
  check('la plus haute barre est la semaine la plus visitée', h[maxI].h === Math.max(...h.map((x) => x.h)) && h[maxI].h >= 130, h);
  const top3 = await page.getByTestId(`hacker-barnum-${maxI}`).evaluate((e) => ({ t: e.innerText, cut: e.scrollWidth > e.clientWidth + 1 }));
  check('le chiffre au-dessus de la plus haute barre est écrit en entier (téléphone : « 10,7k »)', !top3.cut && !/…/.test(top3.t) && (DATA_DIR || top3.t === '10,7k'), top3);
  check('la semaine en cours (dernière) est plus claire', Number(h[11].o) < 0.6 && Number(h[maxI].o) === 1, h[11]);
  const lit = await page.getByTestId('hacker-gauge').locator('div').evaluateAll((els) => els.filter((e) => getComputedStyle(e).position === 'absolute' && e.offsetWidth <= 6 && e.offsetHeight >= 10 && getComputedStyle(e).backgroundColor === 'rgb(0, 255, 65)').length);
  check('jauge : au moins 1 trait allumé en vert, pas tous', lit >= 1 && lit < 36, lit);
  const bg = await page.getByTestId('hacker-dashboard').evaluate((e) => getComputedStyle(e).backgroundColor);
  check('fond noir', bg === 'rgb(1, 4, 1)', bg);
  const color = await page.getByTestId('hacker-command').evaluate((e) => getComputedStyle(e).color);
  check('ligne de commande en vert néon', color === 'rgb(0, 255, 65)', color);
  const font = await page.getByTestId('hacker-visitors-value').evaluate((e) => getComputedStyle(e).fontFamily);
  check('écriture de terminal (monospace)', /mono/i.test(font), font);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('téléphone : pas de défilement de côté', wide);
  const cards = await page.locator('[data-testid$="-value"][data-testid^="hacker-"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  check('téléphone : 2 cartes par ligne', cards.length === 4 && cards[0] === cards[1] && cards[2] === cards[3] && cards[2] > cards[0], cards);
  const fit = async (pg, w) => {
    const hh = await pg.evaluate(() => Math.ceil(document.querySelector('[data-testid="hacker-dashboard"] > div > div').scrollHeight));
    await pg.setViewportSize({ width: w, height: hh + 4 });
    await sleep(400);
  };
  await fit(page, 390);
  await page.screenshot({ path: path.join(OUT, 'hacker-1-telephone-30j.png') });
  await page.setViewportSize({ width: 390, height: 800 });

  // 3) changer de période : la fonction est appelée avec la bonne période ; « Tout » n'a pas de comparaison
  await page.getByTestId('hacker-period-today').click();
  await page.waitForFunction(() => /--aujourdhui/.test(document.querySelector('[data-testid="hacker-command"]').innerText));
  await fit(page, 390);
  const cmdLines = await page.getByTestId('hacker-command').evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).fontSize));
  check('téléphone : la ligne de commande « --aujourdhui » tient sur une ligne', cmdLines > 0 && cmdLines < 1.8, cmdLines);
  check('« Aujourd\'hui » : période today demandée, chiffres du jour', state.calls.includes('today') && (await t('hacker-visitors-value')) === sp(DATA.today.visitors.toLocaleString('fr-FR')), state.calls);
  if (!DATA_DIR) check('« Aujourd\'hui » : ▲ +100 % vs hier à la même heure', (await t('hacker-visitors-line')) === '▲ +100 % vs hier à la même heure', await t('hacker-visitors-line'));
  check('« Aujourd\'hui » : sélection annoncée (aria-checked)', (await page.getByTestId('hacker-period-today').getAttribute('aria-checked')) === 'true' && (await page.getByTestId('hacker-period-30d').getAttribute('aria-checked')) === 'false');
  await page.screenshot({ path: path.join(OUT, 'hacker-2-aujourdhui.png') });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByTestId('hacker-period-7d').click();
  await page.waitForFunction(() => /--7j/.test(document.querySelector('[data-testid="hacker-command"]').innerText));
  await sleep(400);
  if (!DATA_DIR) check('« 7 jours » : baisse des nouveaux clients en rouge (▼ -16 %)', (await t('hacker-customers-line')) === "▼ -16 % vs 7 j d'avant" && (await page.getByTestId('hacker-customers-line').evaluate((e) => getComputedStyle(e).color)) === 'rgb(255, 92, 122)', await t('hacker-customers-line'));
  if (!DATA_DIR) check('« 7 jours » : chiffre livré 25 000 FCFA', (await t('hacker-orders-line')) === 'Chiffre livré : 25 000 FCFA');
  await page.getByTestId('hacker-period-all').click();
  await page.waitForFunction(() => /--tout/.test(document.querySelector('[data-testid="hacker-command"]').innerText));
  await sleep(400);
  check('« Tout » : pas de ligne de comparaison', (await page.getByTestId('hacker-visitors-line').count()) === 0 && (await page.getByTestId('hacker-customers-line').count()) === 0);
  if (!DATA_DIR) check('« Tout » : aucune source -> message clair', /aucune visite sur cette période/.test(await t('hacker-sources')));
  const before = state.calls.length;
  await page.getByTestId('hacker-period-30d').click();
  await page.waitForFunction(() => /--30j/.test(document.querySelector('[data-testid="hacker-command"]').innerText));
  await sleep(400);
  check('revenir sur 30 jours : chiffres gardés, pas de nouvelle lecture', state.calls.length === before, state.calls);
  check('aucune écriture dans la base', state.writes.length === 0, state.writes);
  await v.ctx.close();

  // 4) ordinateur : 4 cartes sur une ligne
  v = await visitor(b, { rpc: okRpc, viewport: { width: 1280, height: 900 } });
  v.page.on('pageerror', (e) => errors.push(e.message));
  await v.page.getByTestId('hacker-visitors-value').waitFor({ timeout: 25000 });
  await sleep(700);
  const cardsPc = await v.page.locator('[data-testid$="-value"][data-testid^="hacker-"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  check('ordinateur : 4 cartes sur une ligne', cardsPc.length === 4 && new Set(cardsPc).size === 1, cardsPc);
  const side = await v.page.evaluate(() => {
    const a = document.querySelector('[data-testid="hacker-weeks"]').getBoundingClientRect();
    const g = document.querySelector('[data-testid="hacker-gauge"]').getBoundingClientRect();
    return Math.abs(a.top - g.top) < 2 && g.left > a.right - 1;
  });
  check('ordinateur : barres et jauge côte à côte', side);
  const hPc = await v.page.evaluate(() => Math.ceil(document.querySelector('[data-testid="hacker-dashboard"] > div > div').scrollHeight));
  await v.page.setViewportSize({ width: 1280, height: hPc + 4 });
  await sleep(400);
  await v.page.screenshot({ path: path.join(OUT, 'hacker-3-ordinateur.png') });
  await v.ctx.close();

  // 5) la fonction n'est pas encore installée dans la base : message clair
  v = await visitor(b, { rpc: () => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.admin_dashboard_overview(p_period) in the schema cache' } }) });
  await v.page.getByTestId('hacker-missing').waitFor({ timeout: 25000 });
  check('fonction absente : « Lancez add-admin-dashboard.sql »', /add-admin-dashboard\.sql/.test(await v.page.getByTestId('hacker-missing').innerText()));
  await v.ctx.close();

  // 6) refus de la base (double vérification pas faite, etc.) : erreur + « Réessayer », aucun chiffre inventé
  let fail = true;
  v = await visitor(b, { rpc: (p) => (fail ? { status: 403, body: { code: '42501', message: 'Non autorise' } } : okRpc(p)) });
  await v.page.getByTestId('hacker-error').waitFor({ timeout: 25000 });
  check('refus : message d\'erreur, aucune carte de chiffres', (await v.page.getByTestId('hacker-visitors-value').count()) === 0);
  fail = false;
  await v.page.getByTestId('hacker-retry').click();
  await v.page.getByTestId('hacker-visitors-value').waitFor({ timeout: 10000 });
  check('« Réessayer » relit les chiffres', true);
  await v.ctx.close();

  // 7) un client (pas administrateur) : accès refusé, la fonction n'est même pas appelée
  v = await visitor(b, { who: 'client', rpc: okRpc });
  await sleep(4000);
  const txt = await v.page.locator('body').innerText();
  check('client : pas de chiffres, fonction jamais appelée', (await v.page.getByTestId('hacker-visitors-value').count()) === 0 && v.state.calls.length === 0 && !/24 180/.test(sp(txt)), v.state.calls);
  await v.ctx.close();

  check('aucune erreur de page', errors.length === 0, errors);
  await b.close();
  server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
