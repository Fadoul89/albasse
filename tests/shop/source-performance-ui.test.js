// Admin › « Performance par source » (21 novembre 2026), dans le navigateur, sur le site fabriqué (expo export) :
// ventes rangées selon la première visite ou la visite de la commande, commandes sans visite, clics « Commander » site / WhatsApp,
// « D'où viennent les visiteurs Autre ? » ; et côté visiteur : le site enregistre le nom du site d'où il vient, son utm_source,
// et le bouton « Commander » touché (site ou WhatsApp).
// Le compte administrateur et le rapport de la base sont SIMULÉS ; les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée.
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/source-performance-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4581';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = 'https://xtitsmmccpkelxfjyqyh.supabase.co/rest/v1';
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
const UID = '55555555-5555-4555-8555-555555555555';

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1' })}.c2ln`;
const digits = (s) => String(s || '').replace(/\D/g, '');

// le rapport de la base, nouvelle version (même forme que add-source-report.sql)
const REPORT_V2 = {
  totals: { sessions: 30, visitors: 24, real_sessions: 6, real_visitors: 5 },
  sources: [
    { source: 'Accès direct', sessions: 12, visitors: 10, new_visitors: 8, avg_time_seconds: 25, pages_viewed: 20, product_views: 9, cart_adds: 4, checkout_site: 2, checkout_whatsapp: 1, orders: 1, revenue: 22500, orders_first: 0, revenue_first: 0, real_sessions: 3, real_visitors: 3 },
    { source: 'Autre', sessions: 8, visitors: 6, new_visitors: 6, avg_time_seconds: 4, pages_viewed: 9, product_views: 3, cart_adds: 0, checkout_site: 0, checkout_whatsapp: 0, orders: 1, revenue: 30000, orders_first: 0, revenue_first: 0, real_sessions: 1, real_visitors: 1 },
    { source: 'Facebook', sessions: 6, visitors: 5, new_visitors: 5, avg_time_seconds: 10, pages_viewed: 7, product_views: 2, cart_adds: 1, checkout_site: 0, checkout_whatsapp: 1, orders: 0, revenue: 0, orders_first: 1, revenue_first: 30000, real_sessions: 1, real_visitors: 1 },
    { source: 'TikTok', sessions: 4, visitors: 3, new_visitors: 3, avg_time_seconds: 0, pages_viewed: 4, product_views: 1, cart_adds: 0, checkout_site: 0, checkout_whatsapp: 0, orders: 0, revenue: 0, orders_first: 1, revenue_first: 22500, real_sessions: 1, real_visitors: 0 },
  ],
  campaigns: [],
  unattributed: { orders: 1, revenue: 15000, orders_first: 1, revenue_first: 15000 },
  other_hosts: [
    { label: 'org.telegram.messenger', visitors: 3, sessions: 4 },
    { label: 'utm : qr', visitors: 2, sessions: 2 },
    { label: null, visitors: 1, sessions: 2 },
  ],
};
// l'ancienne version (script pas encore relancé) : sans les nouveautés
const REPORT_V1 = {
  totals: REPORT_V2.totals,
  sources: REPORT_V2.sources.map(({ checkout_site, checkout_whatsapp, orders_first, revenue_first, ...rest }) => rest),
  campaigns: [],
};

async function visitor(b, { admin = false, report = REPORT_V2, failNewColumns = false } = {}) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 });
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', phone: '', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
  const profile = { id: UID, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', banned: false, role: 'admin', is_admin: true, created_at: '2026-01-01T00:00:00Z' };
  const state = { sessions: [], carts: [], writes: [], rpc: 0 };
  await ctx.addInitScript(([sk, s, isAdmin]) => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + day]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1' };
      seed.albasse_zara_install = JSON.stringify({ at: Date.now(), outcome: 'dismissed' });
      seed.albasse_zara_push = JSON.stringify({ at: Date.now(), outcome: 'later' });
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      if (isAdmin && !sessionStorage.getItem('__seeded')) {
        localStorage.setItem(sk, s);
        sessionStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
  }, [SK, JSON.stringify(session), admin]);
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (!u.hostname.endsWith('.supabase.co')) return route.continue();
    if (m === 'OPTIONS') return json(route, {});
    if (u.pathname === '/auth/v1/user') return admin ? json(route, user) : json(route, { msg: 'no user' }, 401);
    if (u.pathname === '/auth/v1/token') return admin ? json(route, session) : json(route, { error: 'invalid_grant' }, 400);
    if (u.pathname.startsWith('/auth/v1/')) return json(route, {});
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') {
      const one = (r.headers()['accept'] || '').includes('vnd.pgrst.object');
      return admin ? json(route, one ? profile : [profile]) : one ? json(route, { code: 'PGRST116' }, 406) : json(route, []);
    }
    if (u.pathname === '/rest/v1/rpc/admin_source_report') {
      state.rpc++;
      return json(route, report);
    }
    // le bouton « Commander sur WhatsApp » est peut-être éteint dans les vrais réglages : allumé pour ce test (vrais réglages, ce seul point changé)
    if (u.pathname === '/rest/v1/store_settings' && m === 'GET') {
      const res = await route.fetch({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } }).catch(() => null);
      if (!res) return route.abort();
      let body = await res.json();
      const fix = (row) => ({ ...row, whatsapp_order_enabled: true, account_required: false });
      body = Array.isArray(body) ? body.map(fix) : fix(body);
      return route.fulfill({ response: res, body: JSON.stringify(body) });
    }
    if (u.pathname === '/rest/v1/smart_promotions') return (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? json(route, { code: 'PGRST116' }, 406) : json(route, []);
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    // les visites et les clics « Commander » : notés ici, rien n'est écrit dans la vraie base
    if (u.pathname === '/rest/v1/visitor_sessions' && m === 'POST') {
      const body = JSON.parse(r.postData() || '{}');
      state.sessions.push(body);
      if (failNewColumns && ('referrer_host' in body || 'utm_source' in body)) return json(route, { code: 'PGRST204', message: "Could not find the 'referrer_host' column of 'visitor_sessions' in the schema cache" }, 400);
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (u.pathname === '/rest/v1/cart_events' && m === 'POST') {
      const body = JSON.parse(r.postData() || '{}');
      state.carts.push(body);
      if (failNewColumns && 'channel' in body) return json(route, { code: 'PGRST204', message: "Could not find the 'channel' column of 'cart_events' in the schema cache" }, 400);
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (!['GET', 'HEAD'].includes(m)) {
      if (!/visitor_sessions|product_views/.test(u.pathname)) state.writes.push(m + ' ' + u.pathname);
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    // les vraies lectures, avec la clé publique (le faux compte n'a pas de vrai jeton)
    if (u.pathname.startsWith('/rest/v1/')) return route.continue({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } });
    return route.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, state, errs };
}

const textOf = async (page, id) => (await page.getByTestId(id).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    // 1) l'administrateur, nouveau rapport
    let v = await visitor(b, { admin: true });
    let { page } = v;
    await page.goto(`${BASE}/admin/performance-par-source`, { waitUntil: 'load' });
    await page.getByTestId('source-attribution').waitFor({ timeout: 30000 });
    await sleep(800);
    check('le rapport de la base est demandé', v.state.rpc >= 1, v.state.rpc);
    check('« Ranger les ventes selon » : « Première visite » choisie par défaut',
      (await page.getByTestId('source-attribution-first').getAttribute('aria-selected')) === 'true' && (await page.getByTestId('source-attribution-order').getAttribute('aria-selected')) !== 'true');
    check('première visite : TikTok 1 commande livrée, 22 500 FCFA', digits(await textOf(page, 'source-orders-TikTok')) === '1' && digits(await textOf(page, 'source-revenue-TikTok')).startsWith('22500'),
      [await textOf(page, 'source-orders-TikTok'), await textOf(page, 'source-revenue-TikTok')]);
    check('première visite : Facebook 1 commande 30 000 ; Accès direct 0', digits(await textOf(page, 'source-orders-Facebook')) === '1' && digits(await textOf(page, 'source-revenue-Facebook')).startsWith('30000') && digits(await textOf(page, 'source-orders-Accès direct')) === '0');
    const rank = await page.getByText('Meilleure source en ventes').locator('..').innerText();
    check('classement (première visite) : meilleure source en ventes = Facebook', /Facebook/.test(rank), rank);
    check('Accès direct : « Commander » sur le site 2, sur WhatsApp 1, 1 clic d\'avant la mise à jour',
      digits(await textOf(page, 'source-checkout-site-Accès direct')) === '2' && digits(await textOf(page, 'source-checkout-whatsapp-Accès direct')) === '1'
      && /« Commander » \(avant la mise à jour\)/.test(await page.locator('body').innerText()));
    check('plus aucun « Paniers » sur la page', !/\bPaniers\b/.test(await page.locator('body').innerText()));
    const note = await textOf(page, 'source-unattributed');
    check('« 1 commande livrée sans visite connue … 15 000 FCFA » et l\'explication WhatsApp', /1 commande livrée sans visite connue/.test(note) && digits(note).includes('15000') && /Commander sur WhatsApp/.test(note), note);
    check('liste « Autre » : Telegram (3, « l\'appli Telegram »), utm : qr (2, « votre code QR »), Inconnu (1)',
      /org\.telegram\.messenger[\s\S]*l'appli Telegram[\s\S]*3/.test(await textOf(page, 'source-other-host-org.telegram.messenger'))
      && /utm : qr[\s\S]*votre code QR[\s\S]*2/.test(await textOf(page, 'source-other-host-utm : qr'))
      && /Inconnu[\s\S]*avant la mise à jour[\s\S]*1/.test(await textOf(page, 'source-other-host-inconnu')));
    // la page défile à l'intérieur (ScrollView) : un écran très haut pour tout voir sur l'image
    await page.setViewportSize({ width: 390, height: 3400 });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, 'source-1-premiere-visite.png') });
    await page.setViewportSize({ width: 390, height: 860 });

    // « Visite de la commande » : l'ancien rangement
    await page.getByTestId('source-attribution-order').click();
    await sleep(600);
    check('« Visite de la commande » choisie', (await page.getByTestId('source-attribution-order').getAttribute('aria-selected')) === 'true');
    check('visite de la commande : Accès direct 1 commande 22 500, TikTok 0, Autre 1 commande 30 000',
      digits(await textOf(page, 'source-orders-Accès direct')) === '1' && digits(await textOf(page, 'source-revenue-Accès direct')).startsWith('22500')
      && digits(await textOf(page, 'source-orders-TikTok')) === '0' && digits(await textOf(page, 'source-orders-Autre')) === '1');
    const rank2 = await page.getByText('Meilleure source en ventes').locator('..').innerText();
    check('classement (visite de la commande) : meilleure source en ventes = Autre', /Autre/.test(rank2), rank2);
    check('les clics ne changent pas avec le rangement', digits(await textOf(page, 'source-checkout-site-Accès direct')) === '2');
    // la page défile à l'intérieur (ScrollView) : un écran très haut pour tout voir sur l'image
    await page.setViewportSize({ width: 390, height: 3400 });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, 'source-2-visite-commande.png') });
    await page.setViewportSize({ width: 390, height: 860 });
    check('aucune erreur de page (admin)', v.errs.length === 0, v.errs);
    check('aucune écriture dans la base (admin)', v.state.writes.length === 0, v.state.writes);
    await v.ctx.close();

    // 2) l'ancien rapport (script pas encore relancé) : la page reste comme avant, sans les nouveautés
    v = await visitor(b, { admin: true, report: REPORT_V1 });
    page = v.page;
    await page.goto(`${BASE}/admin/performance-par-source`, { waitUntil: 'load' });
    await page.getByTestId('source-totals').waitFor({ timeout: 30000 });
    await sleep(800);
    const body1 = await page.locator('body').innerText();
    check('ancien rapport : pas de bouton de rangement, pas de liste « Autre », pas de note « sans visite »',
      (await page.getByTestId('source-attribution').count()) === 0 && !/D'où viennent les visiteurs/.test(body1) && (await page.getByTestId('source-unattributed').count()) === 0);
    check('ancien rapport : « Clics « Commander » » à la place de « Paniers », ventes selon la visite de la commande (Accès direct 1)',
      /Clics « Commander »/.test(body1) && !/\bPaniers\b/.test(body1) && digits(await textOf(page, 'source-orders-Accès direct')) === '1');
    check('aucune erreur de page (ancien rapport)', v.errs.length === 0, v.errs);
    await v.ctx.close();

    // 3) un visiteur arrive par un lien Telegram avec ?utm_source=qr : le site note le NOM du site et le utm_source
    v = await visitor(b);
    page = v.page;
    await page.goto(`${BASE}/?utm_source=qr&utm_medium=print&utm_campaign=code-qr`, { waitUntil: 'load', referer: 'https://t.me/s/albasse?secret=1' });
    await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
    await sleep(1500);
    const s0 = v.state.sessions[0] || {};
    check('visite : nom du site « t.me » (sans le chemin ni les paramètres), utm_source « qr », source « Autre », campagne code-qr',
      s0.referrer_host === 't.me' && s0.utm_source === 'qr' && s0.referrer_source === 'Autre' && s0.utm_campaign === 'code-qr', s0);
    check('une seule visite enregistrée', v.state.sessions.length === 1, v.state.sessions.length);

    // le bouton « Commander sur WhatsApp » d'un vrai article : clic noté « whatsapp »
    const prods = await (await fetch(`${REST}/products?select=slug&is_active=eq.true&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
    const slug = Array.isArray(prods) && prods[0] ? prods[0].slug : null;
    check('un vrai article trouvé dans la base', !!slug, prods);
    if (slug) {
      await page.goto(`${BASE}/produit/${slug}`, { waitUntil: 'load' });
      await page.getByTestId('product-wa-order').waitFor({ timeout: 30000 });
      await sleep(800);
      const popup = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
      await page.getByTestId('product-wa-order').click();
      const p2 = await popup;
      if (p2) await p2.close().catch(() => {});
      await sleep(800);
      const wa = v.state.carts.find((c) => c.channel === 'whatsapp');
      check('« Commander sur WhatsApp » : un clic noté « whatsapp » pour cet article', !!wa && !!wa.product_id, v.state.carts);
    }
    check('aucune erreur de page (visiteur)', v.errs.length === 0, v.errs);
    await v.ctx.close();

    // 4) la base n'a pas encore les nouvelles colonnes (script pas lancé) : le site réessaie sans elles, la visite est quand même enregistrée
    v = await visitor(b, { failNewColumns: true });
    page = v.page;
    await page.goto(`${BASE}/?utm_source=tiktok`, { waitUntil: 'load', referer: 'https://www.tiktok.com/' });
    await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
    await sleep(1500);
    const [first, second] = v.state.sessions;
    check('colonnes absentes : 1er essai avec les nouvelles colonnes, 2e essai sans (même visite, source TikTok)',
      v.state.sessions.length === 2 && 'referrer_host' in first && !('referrer_host' in second) && !('utm_source' in second) && first.id === second.id && second.referrer_source === 'TikTok', v.state.sessions);
    check('aucune erreur de page (colonnes absentes)', v.errs.length === 0, v.errs);
    await v.ctx.close();
  } finally {
    await b.close();
    server.kill();
  }
  console.log(ok ? '\nTOUS LES CONTROLES REUSSIS' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
