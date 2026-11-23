// Promotions intelligentes (23 novembre 2026), dans le navigateur, sur le site fabriqué (expo export) :
//   - client : « PROFITER DE L'OFFRE » d'une promotion SANS ciblage ouvre WhatsApp avec l'offre déjà écrite (avant : la fenêtre se
//     fermait et le client restait où il était) ; avec un article ciblé : la fiche de l'article ;
//   - admin › Promotions intelligentes : l'avertissement « sans ciblage » dans le formulaire, et ce que fait le bouton de chaque promotion.
// Comptes et promotions SIMULÉS ; les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée.
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/promo-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4671';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = 'https://xtitsmmccpkelxfjyqyh.supabase.co/rest/v1';

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400));
};

const UID = '66666666-6666-4666-8666-666666666666';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1' })}.c2ln`;
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'client@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const session = { access_token: jwt, refresh_token: 'x', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
const CUSTOMER = { id: UID, email: 'client@example.com', full_name: 'Aminata Hassan', phone: '66123456', banned: false, is_admin: false, role: 'customer', created_at: '2026-01-01T00:00:00Z' };
const ADMIN = { ...CUSTOMER, full_name: 'Admin Albasse', is_admin: true, role: 'admin' };

const today = new Date().toISOString().slice(0, 10);
const promo = (over) => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Cadeau', category_id: null, product_id: null, gift: '', min_purchase: 0, start_date: '2026-11-01', end_date: '2099-12-31', end_time: '23:59:00', max_beneficiaries: null, claimed_count: 180, message: "Offre unique jusqu'à fin de mois\n4XL 3XL 2XL XL", image_url: null, button_text: "PROFITER DE L'OFFRE", is_active: true, created_at: '2026-11-14T07:32:06Z', ...over });

async function visitor(b, profile, promos) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + d]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1', albasse_assistant_teaser_seen: '1', albasse_assistant_teaser_member_seen: '1', albasse_zara_install: JSON.stringify({ at: Date.now(), outcome: 'dismissed' }), albasse_zara_push: JSON.stringify({ at: Date.now(), outcome: 'later' }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      if (!sessionStorage.getItem('__s')) { localStorage.setItem('sb-xtitsmmccpkelxfjyqyh-auth-token', s); sessionStorage.setItem('__s', '1'); }
    } catch (e) {}
    window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
  }, JSON.stringify(session));
  const log = { writes: [], claims: 0 };
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
  await ctx.route('**/*', (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (/youtube(-nocookie)?\.com$/.test(u.hostname)) return route.fulfill({ status: 200, contentType: 'text/html', body: '<body style="background:#000"></body>' });
    if (!u.hostname.endsWith('.supabase.co')) return route.continue();
    if (m === 'OPTIONS') return json(route, {});
    if (u.pathname === '/auth/v1/user') return json(route, user);
    if (u.pathname === '/auth/v1/token') return json(route, session);
    if (u.pathname === '/auth/v1/factors' || u.pathname.startsWith('/auth/v1/factors')) return json(route, []);
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') return json(route, (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? profile : [profile]);
    if (u.pathname === '/rest/v1/smart_promotions' && m === 'GET') return json(route, promos);
    if (u.pathname === '/rest/v1/rpc/claim_promotion') { log.claims++; return json(route, true); }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    if (!['GET', 'HEAD'].includes(m)) {
      if (!/visitor_sessions|product_views/.test(u.pathname)) log.writes.push(m + ' ' + u.pathname);
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (u.pathname.startsWith('/rest/v1/')) return route.continue({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } });
    return route.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, log, errs };
}

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  // un vrai article en vente, pour la promotion ciblée
  const real = (await (await fetch(`${REST}/products?select=id,slug,name&is_active=eq.true&order=created_at.desc&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json())[0];
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    const IMG = 'https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/object/public/product-images/1795440629757-iodmho9vj6m.jpeg';
    // la photo de l'offre : entière (pas coupée), à sa vraie forme, 45 % de l'écran au plus
    const photo = (page) =>
      page.evaluate(() => {
        const img = document.querySelector('[data-testid="promo-image"] img');
        if (!img || !img.complete || !img.naturalWidth) return null;
        const r = img.getBoundingClientRect();
        return { nw: img.naturalWidth, nh: img.naturalHeight, w: Math.round(r.width), h: Math.round(r.height), fit: getComputedStyle(img).objectFit, max: Math.round(window.innerHeight * 0.45), tag: /Voir l'article/.test(document.querySelector('[data-testid="promo-image"]').innerText) };
      });
    const fullPhoto = (f) => !!f && f.fit === 'contain' && (Math.abs(f.w / f.h - f.nw / f.nh) < 0.03 || f.h <= f.max + 1);

    // 1. client, promotion SANS ciblage : seulement le bouton vert WhatsApp, offre déjà écrite
    {
      const v = await visitor(b, CUSTOMER, [promo({ image_url: IMG })]);
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('promo-whatsapp').waitFor({ timeout: 60000 });
      await v.page.waitForFunction(() => { const i = document.querySelector('[data-testid="promo-image"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 }).catch(() => null);
      await sleep(600);
      const f = await photo(v.page);
      check('sans ciblage : la photo s\'affiche en entier (pas coupée)', fullPhoto(f), f);
      check('sans ciblage : pas de bouton or ni « Voir l\'article » (aucun article à ouvrir), seulement le bouton vert', (await v.page.getByTestId('promo-claim').count()) === 0 && f && !f.tag);
      await v.page.screenshot({ path: path.join(OUT, 'promo-sans-ciblage.png') });
      await v.page.getByTestId('promo-whatsapp').click();
      for (let i = 0; i < 30 && !(await v.page.evaluate(() => window.__opened.length)); i++) await sleep(200);
      const opened = await v.page.evaluate(() => window.__opened.slice());
      const url = opened[0] || '';
      const text = url.includes('?text=') ? decodeURIComponent(url.split('?text=')[1]) : '';
      check('le clic est compté (bénéficiaire)', v.log.claims === 1, v.log.claims);
      check('WhatsApp s\'ouvre (numéro des commandes)', url.startsWith('https://wa.me/23599221017?text='), opened);
      check('le message est déjà écrit : prénom, nom de l\'offre, texte, photo', text.startsWith("Bonjour Albasse Shopping 👋 C'est Aminata.") && text.includes('« Cadeau »') && text.includes('4XL 3XL 2XL XL') && text.includes(IMG), text);
      await sleep(400);
      check('message au client : « votre message WhatsApp est déjà prêt »', /Votre message WhatsApp est déjà prêt/.test(await v.page.evaluate(() => document.body.innerText)));
      check('la fenêtre de l\'offre se ferme', (await v.page.getByTestId('promo-whatsapp').count()) === 0);
      check('aucune erreur (sans ciblage)', v.errs.length === 0, v.errs);
      check('aucune écriture directe (seul le compteur de l\'offre)', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }

    // 2. client, promotion ciblée sur un article : la photo et le bouton or ouvrent l'article ; le bouton vert ouvre WhatsApp
    const targeted = promo({ id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Article', product_id: real.id, image_url: IMG });
    {
      const v = await visitor(b, CUSTOMER, [targeted]);
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('promo-claim').waitFor({ timeout: 60000 });
      await v.page.waitForFunction(() => { const i = document.querySelector('[data-testid="promo-image"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 }).catch(() => null);
      await sleep(600);
      const f = await photo(v.page);
      check('article ciblé : la photo en entier, avec « 👆 Voir l\'article »', fullPhoto(f) && f.tag, f);
      check('article ciblé : le bouton or ET le bouton vert « Commander sur WhatsApp »', (await v.page.getByTestId('promo-claim').count()) === 1 && /Commander sur WhatsApp/.test(await v.page.getByTestId('promo-whatsapp').innerText()));
      const order = await v.page.evaluate(() => { const a = document.querySelector('[data-testid="promo-claim"]').getBoundingClientRect(); const w = document.querySelector('[data-testid="promo-whatsapp"]').getBoundingClientRect(); return { orTop: a.top, waTop: w.top, bg: getComputedStyle(document.querySelector('[data-testid="promo-whatsapp"]')).backgroundColor }; });
      check('le bouton vert (WhatsApp) sous le bouton or', order.waTop > order.orTop && order.bg === 'rgb(37, 211, 102)', order);
      await v.page.screenshot({ path: path.join(OUT, 'promo-article.png') });
      await v.page.getByTestId('promo-image').click();
      await v.page.waitForURL((u) => new URL(u).pathname.startsWith('/produit/'), { timeout: 15000 }).catch(() => null);
      check(`toucher la photo : la fiche de l'article s'ouvre (/produit/${real.slug}), le clic est compté`, new URL(v.page.url()).pathname === `/produit/${real.slug}` && v.log.claims === 1, { url: v.page.url(), claims: v.log.claims });
      check('toucher la photo : pas de WhatsApp', (await v.page.evaluate(() => window.__opened.length)) === 0);
      check('aucune erreur (photo)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      const v = await visitor(b, CUSTOMER, [targeted]);
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('promo-claim').waitFor({ timeout: 60000 });
      await sleep(600);
      await v.page.getByTestId('promo-claim').click();
      await v.page.waitForURL((u) => new URL(u).pathname.startsWith('/produit/'), { timeout: 15000 }).catch(() => null);
      check('bouton or : la fiche de l\'article', new URL(v.page.url()).pathname === `/produit/${real.slug}` && v.log.claims === 1, v.page.url());
      await v.ctx.close();
    }
    {
      const v = await visitor(b, CUSTOMER, [targeted]);
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('promo-whatsapp').waitFor({ timeout: 60000 });
      await sleep(600);
      await v.page.getByTestId('promo-whatsapp').click();
      for (let i = 0; i < 30 && !(await v.page.evaluate(() => window.__opened.length)); i++) await sleep(200);
      const opened = await v.page.evaluate(() => window.__opened.slice());
      const text = opened[0] && opened[0].includes('?text=') ? decodeURIComponent(opened[0].split('?text=')[1]) : '';
      check('bouton vert (article ciblé) : WhatsApp avec l\'offre écrite, le clic est compté, on reste sur la page', opened[0]?.startsWith('https://wa.me/23599221017?text=') && text.includes('« Article »') && v.log.claims === 1 && new URL(v.page.url()).pathname === '/', { opened, url: v.page.url() });
      await v.ctx.close();
    }

    // 3. admin › Promotions intelligentes
    {
      const promos = [promo({}), promo({ id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Montre', product_id: real.id, claimed_count: 0, max_beneficiaries: 1 })];
      const v = await visitor(b, ADMIN, promos);
      await v.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
      await v.page.getByTestId('promo-target-aaaaaaaa-0000-4000-8000-000000000001').waitFor({ timeout: 30000 });
      // la liste des articles arrive : le libellé de « Montre » donne alors le nom de l'article
      await v.page.waitForFunction(() => /Ouvre l'article :/.test(document.querySelector('[data-testid="promo-target-aaaaaaaa-0000-4000-8000-000000000002"]')?.innerText || ''), null, { timeout: 30000 }).catch(() => null);
      await sleep(500);
      const t1 = await v.page.getByTestId('promo-target-aaaaaaaa-0000-4000-8000-000000000001').innerText();
      const t2 = await v.page.getByTestId('promo-target-aaaaaaaa-0000-4000-8000-000000000002').innerText();
      check('liste : « Cadeau » → « ⚠️ Sans ciblage : le bouton ouvre WhatsApp »', /Sans ciblage : le bouton ouvre WhatsApp/.test(t1), t1);
      check(`liste : « Montre » → « 🎯 Ouvre l'article : ${real.name.trim()} »`, t2 === `🎯 Ouvre l'article : ${real.name.trim()}`, t2);
      check('formulaire, « Aucun ciblage » : l\'avertissement s\'affiche', (await v.page.getByTestId('promo-no-target-warning').count()) === 1);
      await v.page.getByTestId('promo-no-target-warning').scrollIntoViewIfNeeded();
      await v.page.screenshot({ path: path.join(OUT, 'promo-admin-avertissement.png') });
      await v.page.getByText('Produit précis', { exact: true }).first().click();
      await sleep(400);
      check('« Produit précis » choisi : l\'avertissement disparaît', (await v.page.getByTestId('promo-no-target-warning').count()) === 0);
      await v.page.getByTestId('promo-target-aaaaaaaa-0000-4000-8000-000000000001').scrollIntoViewIfNeeded();
      await v.page.screenshot({ path: path.join(OUT, 'promo-admin-liste.png') });
      check('aucune erreur (admin)', v.errs.length === 0, v.errs);
      check('aucune écriture (admin)', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }
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
