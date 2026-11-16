// Publicité mouvementée du menu ☰, dans le navigateur, sur le site fabriqué (expo export). Supabase : lectures VRAIES (lecture seule) sauf
// les réglages de la boutique, où la liste « menu_ad_items » est SIMULÉE (avec, vide, ou colonne absente). Toute écriture est bloquée
// (l'enregistrement de l'admin est capturé, jamais envoyé). Date du navigateur : 16 novembre 2026 (Black Friday annoncé).
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/menu-ad-ui.test.js <dossier dist> [port] [dossier des photos]
// BASE_URL=https://www.albasseshopping.com : le vrai site en ligne.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4570';
const OUT = process.argv[4] || os.tmpdir();
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY;
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
const IMG = 'https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/object/public/product-images';
// trois vraies images de publicité de la boutique, avec trois sortes de liens
const ADS = [
  { image_url: `${IMG}/1788374517382-aymnfgbq76i.jpeg`, link: 'https://www.albasseshopping.com/produit/ray-ban' },
  { image_url: `${IMG}/1792262518618-e83ouzrmmc.jpeg`, link: '/categorie/vetements' },
  { image_url: `${IMG}/1790853929473-udeuts187p.jpeg`, link: 'https://wa.me/23560605151' },
];

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// un visiteur. who : 'client' | 'admin'. ads : liste simulée, ou 'absent' (colonne pas encore créée). reduced : « moins d'animations ».
async function visitor(b, { who = 'client', ads = ADS, reduced = false } = {}) {
  const uid = who === 'admin' ? '55555555-5555-4555-8555-555555555555' : '11111111-1111-4111-8111-111111111111';
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.clock.install({ time: new Date('2026-11-16T10:00:00+01:00') });
  const aal = who === 'admin' ? 'aal2' : 'aal1';
  const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal, amr: [{ method: 'password', timestamp: 1 }, { method: 'totp', timestamp: 2 }], session_id: 's1' })}.c2ln`;
  const factors = who === 'admin' ? [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Albasse admin', created_at: '2026-11-15T00:00:00Z' }] : [];
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: `${who}@example.com`, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', factors };
  const session = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
  const profile = { id: uid, email: `${who}@example.com`, full_name: who === 'admin' ? 'Admin Albasse' : 'Aminata Hassan', phone: '66123456', banned: false, is_admin: who === 'admin', loyalty_points: 27, client_number: 883, avatar_url: null, created_at: '2026-01-01T00:00:00Z' };
  const state = { patches: [], writes: [] };
  await ctx.addInitScript(([sk, s]) => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + day]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1' };
      seed.albasse_zara_install = JSON.stringify({ at: Date.now(), outcome: 'dismissed' });
      seed.albasse_zara_push = JSON.stringify({ at: Date.now(), outcome: 'later' });
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem(sk, s);
    } catch (e) {}
  }, [SK, JSON.stringify(session)]);
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
  // WhatsApp : une petite page à la place (aucune sortie vers wa.me)
  await ctx.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>WhatsApp' }));
  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (/(^|\.)(wa\.me|whatsapp\.com)$/.test(u.hostname)) return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>WhatsApp' });
    if (!u.hostname.endsWith('.supabase.co')) return route.continue();
    if (m === 'OPTIONS') return json(route, {});
    if (u.pathname === '/auth/v1/user') return json(route, user);
    if (u.pathname === '/auth/v1/token') return json(route, session);
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') {
      const one = (r.headers()['accept'] || '').includes('vnd.pgrst.object');
      return json(route, one ? profile : [profile]);
    }
    if (u.pathname === '/rest/v1/smart_promotions' && m === 'GET') return (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? json(route, { code: 'PGRST116' }, 406) : json(route, []);
    if (u.pathname === '/rest/v1/store_settings') {
      if (m === 'PATCH') {
        state.patches.push(JSON.parse(r.postData() || '{}'));
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
      }
      // les vrais réglages, avec la liste simulée (ou sans la colonne) ; compte obligatoire « éteint » pour ce test
      const res = await route.fetch({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } }).catch(() => null);
      if (!res) return route.abort();
      let body = await res.json();
      const fix = (row) => {
        const out = { ...row, account_required: false };
        if (ads === 'absent') delete out.menu_ad_items;
        else out.menu_ad_items = ads;
        return out;
      };
      body = Array.isArray(body) ? body.map(fix) : fix(body);
      return route.fulfill({ response: res, body: JSON.stringify(body) });
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    if (!['GET', 'HEAD'].includes(m)) {
      if (!/^\/rest\/v1\/(visitor_sessions|product_views)/.test(u.pathname)) state.writes.push(m + ' ' + u.pathname);
      return route.abort();
    }
    if (u.pathname.startsWith('/rest/v1/')) return route.continue({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } });
    return route.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, state, errs };
}

// attend que l'image k soit montrée ET que le glissement soit fini (au plus maxMs)
const waitImage = async (page, k, maxMs = 7000) => {
  const t0 = Date.now();
  let s = await adState(page);
  while (Date.now() - t0 < maxMs) {
    if (s.active === k && Math.abs(s.track + k * s.w) <= 2) return { ...s, after: Date.now() - t0 };
    await sleep(100);
    s = await adState(page);
  }
  return { ...s, after: Date.now() - t0 };
};
const openMenu = async (page) => {
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(1500);
  await page.locator('[data-testid="menu-button"]:visible').first().click();
  await page.getByTestId('side-menu').waitFor({ timeout: 10000 });
  await sleep(400);
};
// l'état de la carte : image montrée (point large), position de la bande, zoom de la 1re image, largeur de la barre dorée, place du reflet
const adState = (page) =>
  page.getByTestId('menu-ad').evaluate((card) => {
    const q = (id) => card.querySelector(`[data-testid="${id}"]`);
    const mx = (el) => {
      const t = el ? getComputedStyle(el).transform : 'none';
      const v = t.startsWith('matrix(') ? t.slice(7, -1).split(',').map(Number) : [1, 0, 0, 1, 0, 0];
      return { scale: Math.round(Math.hypot(v[0], v[1]) * 1000) / 1000, x: Math.round(v[4]) };
    };
    const dots = [...card.querySelectorAll('[data-testid^="menu-ad-dot-"]')].map((d) => Math.round(d.getBoundingClientRect().width));
    return {
      w: Math.round(card.getBoundingClientRect().width),
      dots,
      active: dots.indexOf(Math.max(...dots, 0)),
      track: mx(q('menu-ad-track')).x,
      zoom: mx(q('menu-ad-zoom')).scale,
      bar: Math.round(q('menu-ad-bar')?.getBoundingClientRect().width ?? -1),
      shine: q('menu-ad-shine') ? mx(q('menu-ad-shine')).x : null,
      go: !!q('menu-ad-go'),
      role: card.getAttribute('role'),
    };
  });

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  const server = process.env.BASE_URL ? null : spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();

  // 1) trois images : la publicité remplace « À la une », et elle bouge
  let v = await visitor(b);
  let { page } = v;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await openMenu(page);
  const tOpen = Date.now() - 400; // la carte arrive avec le menu (openMenu attend 0,4 s après)
  check('la publicité du patron est dans le menu, à la place de la carte « À la une » (Black Friday)', (await page.getByTestId('menu-ad').count()) === 1 && (await page.getByTestId('menu-highlight').count()) === 0);
  const s0 = await adState(page);
  const panel = await page.getByTestId('menu-panel').boundingBox();
  const card = await page.getByTestId('menu-ad').boundingBox();
  check('la carte tient dans le panneau (dans les bords courbés), 168 px de haut', card && panel && card.x >= panel.x + 14 && card.x + card.width <= panel.x + panel.width - 14 && Math.round(card.height) === 168, { card, panel });
  check('3 points, le 1er allumé ; « PUB » ; « Voir › » (l\'image a un lien)', s0.dots.length === 3 && s0.active === 0 && /PUB/.test(await page.getByTestId('menu-ad').innerText()) && s0.go && s0.role === 'link', s0);
  await sleep(1200);
  const s1 = await adState(page);
  check('zoom lent : l\'image grossit doucement', s1.zoom > s0.zoom && s1.zoom <= 1.14, [s0.zoom, s1.zoom]);
  check('barre dorée : elle se remplit', s1.bar > s0.bar && s1.bar < s1.w, [s0.bar, s1.bar]);
  check('reflet de lumière : il passe sur l\'image', s1.shine !== null && s0.shine !== null && s1.shine !== s0.shine, [s0.shine, s1.shine]);
  check('pas encore de changement d\'image avant 5 secondes', s1.active === 0 && s1.track === 0, s1);
  await page.getByTestId('menu-panel').screenshot({ path: path.join(OUT, 'pub-1-image-1.png') });
  const s2 = await waitImage(page, 1);
  const took = Date.now() - tOpen;
  check('5 secondes après l\'ouverture : l\'image 2 est arrivée en glissant (la bande avance d\'une largeur)', s2.active === 1 && Math.abs(s2.track + s2.w) <= 2 && took >= 4600 && took <= 5900, { active: s2.active, track: s2.track, took });
  await page.getByTestId('menu-panel').screenshot({ path: path.join(OUT, 'pub-2-image-2.png') });
  const t2 = Date.now();
  const s3 = await waitImage(page, 2);
  check('5 secondes plus tard : l\'image 3', s3.active === 2 && Date.now() - t2 >= 4300 && Date.now() - t2 <= 5800, { ...s3, gap: Date.now() - t2 });
  const s4 = await waitImage(page, 0);
  check('5 secondes plus tard : retour à l\'image 1, sans saut (la boucle continue)', s4.active === 0 && Math.abs(s4.track) <= 2 && s4.after >= 4000 && s4.after <= 5800, s4);
  // toucher l'image 1 (un article du site) : l'article s'ouvre dans le site et le menu se ferme
  await page.getByTestId('menu-ad').click();
  await sleep(1500);
  check('toucher l\'image 1 : l\'article « ray-ban » s\'ouvre et le menu se ferme', new URL(page.url()).pathname === '/produit/ray-ban' && (await page.getByTestId('side-menu').count()) === 0, page.url());
  check('aucune écriture dans la base, aucune erreur de page', v.state.writes.length === 0 && v.errs.length === 0, [v.state.writes, v.errs]);
  await v.ctx.close();

  // 2) l'image 2 mène à une catégorie, l'image 3 à WhatsApp (à part)
  v = await visitor(b);
  page = v.page;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await openMenu(page);
  check('image 2 montrée', (await waitImage(page, 1)).active === 1);
  await page.getByTestId('menu-ad').click();
  await sleep(1500);
  check('toucher l\'image 2 (« /categorie/vetements ») : la catégorie s\'ouvre dans le site', new URL(page.url()).pathname === '/categorie/vetements' && (await page.getByTestId('side-menu').count()) === 0, page.url());
  await openMenu(page);
  await waitImage(page, 1);
  check('image 3 montrée', (await waitImage(page, 2)).active === 2);
  const popup = v.ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await page.getByTestId('menu-ad').click();
  const wa = await popup;
  check('toucher l\'image 3 (WhatsApp) : WhatsApp s\'ouvre à part, le site reste ouvert', !!wa && /wa\.me|whatsapp\.com/.test(wa.url()) && /\/categorie\/vetements/.test(page.url()), wa && wa.url());
  await v.ctx.close();

  // 3) une seule image sans lien : elle reste, pas de points, pas de « Voir › », pas cliquable
  v = await visitor(b, { ads: [{ image_url: ADS[0].image_url, link: null }] });
  page = v.page;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await openMenu(page);
  const one = await adState(page);
  check('une seule image sans lien : ni points ni « Voir › », image seulement (pas un lien)', one.dots.length === 0 && !one.go && one.role !== 'link', one);
  await sleep(5600);
  const one2 = await adState(page);
  check('une seule image : elle reste en place, le zoom et la barre continuent', one2.track === 0 && one2.bar >= 0 && one2.bar < one2.w, one2);
  await page.getByTestId('menu-ad').click({ force: true });
  await sleep(800);
  check('toucher l\'image sans lien : rien ne s\'ouvre, le menu reste', (await page.getByTestId('side-menu').count()) === 1 && new URL(page.url()).pathname === '/');
  await v.ctx.close();

  // 4) « moins d'animations » : ni zoom ni reflet ; les images changent quand même
  v = await visitor(b, { reduced: true });
  page = v.page;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await openMenu(page);
  await sleep(1500);
  const r1 = await adState(page);
  check('« moins d\'animations » : pas de reflet, pas de zoom', r1.shine === null && r1.zoom === 1, r1);
  const r2 = await waitImage(page, 1);
  check('« moins d\'animations » : l\'image 2 arrive quand même (sans glisser)', r2.active === 1 && Math.abs(r2.track + r2.w) <= 2 && r2.zoom === 1, r2);
  await v.ctx.close();

  // 5) liste vide, ou colonne pas encore créée : la carte automatique « À la une » revient
  for (const ads of [[], 'absent']) {
    v = await visitor(b, { ads });
    page = v.page;
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await openMenu(page);
    check(`publicité ${ads === 'absent' ? 'pas encore installée (colonne absente)' : 'vide'} : la carte « À la une » (Black Friday) revient`, (await page.getByTestId('menu-ad').count()) === 0 && (await page.getByTestId('menu-highlight').count()) === 1);
    check('aucune erreur de page', v.errs.length === 0, v.errs);
    await v.ctx.close();
  }

  // 6) l'admin : la partie « Publicité du menu ☰ », et ce qui est enregistré
  v = await visitor(b, { who: 'admin', ads: [{ image_url: ADS[0].image_url, link: 'https://www.albasseshopping.com/produit/ray-ban' }] });
  page = v.page;
  await page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
  const sec = page.getByTestId('admin-menu-ad');
  await sec.waitFor({ timeout: 30000 });
  await sleep(1500);
  const secTxt = await sec.innerText();
  check('admin : la partie « 📣 Publicité du menu ☰ » explique le mouvement et le format', /Publicité du menu/.test(secTxt) && /5 secondes/.test(secTxt) && /1 200 × 700/.test(secTxt) && (await page.getByTestId('admin-menu-ad-missing').count()) === 0, secTxt.slice(0, 200));
  await sec.locator('input').first().fill('https://www.albasseshopping.com/produit/lacoste');
  await sec.getByText('Enregistrer la publicité du menu').click();
  await sleep(1500);
  const p1 = v.state.patches.pop();
  check('admin : « Enregistrer » envoie la publicité du menu avec le nouveau lien, et garde les publicités de l\'accueil', p1 && Array.isArray(p1.menu_ad_items) && p1.menu_ad_items.length === 1 && p1.menu_ad_items[0].link === 'https://www.albasseshopping.com/produit/lacoste' && p1.menu_ad_items[0].image_url === ADS[0].image_url && Array.isArray(p1.left_ad_items) && Array.isArray(p1.right_ad_items), p1);
  await sec.screenshot({ path: path.join(OUT, 'pub-3-admin.png') });
  await v.ctx.close();

  v = await visitor(b, { who: 'admin', ads: 'absent' });
  page = v.page;
  await page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
  await page.getByTestId('admin-menu-ad').waitFor({ timeout: 30000 });
  await sleep(1500);
  check('admin, colonne pas encore créée : « lancez add-menu-ad.sql », pas d\'éditeur', (await page.getByTestId('admin-menu-ad-missing').count()) === 1 && /add-menu-ad\.sql/.test(await page.getByTestId('admin-menu-ad-missing').innerText()));
  await page.getByText('Enregistrer les publicités', { exact: true }).click();
  await sleep(1500);
  const p2 = v.state.patches.pop();
  check('admin, colonne absente : les publicités de l\'accueil s\'enregistrent sans « menu_ad_items » (pas d\'erreur)', p2 && !('menu_ad_items' in p2) && Array.isArray(p2.left_ad_items), p2);
  await v.ctx.close();

  await b.close();
  if (server) server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
