// Cartes des articles (22 novembre 2026), dans le navigateur, sur le site fabriqué (expo export) :
//   le prix en étiquette verte traversée par un éclat de lumière (chaque article à son moment), l'ancien prix comme avant (rouge barré),
//   pas d'étoiles vides « (0) », et la nouvelle icône d'accueil (rond bleu, maison blanche) en haut des pages et dans la barre du bas.
// Le compte client est SIMULÉ ; les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée.
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/price-tag-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4641';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;
const KEY = process.env.SUPABASE_ANON_KEY;

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
const PROFILE = { id: UID, email: 'client@example.com', full_name: 'Aminata Hassan', phone: '66123456', banned: false, is_admin: false, role: 'customer', loyalty_points: 120, created_at: '2026-01-01T00:00:00Z' };

async function visitor(b, viewport) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + d]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1', albasse_assistant_teaser_seen: '1', albasse_assistant_teaser_member_seen: '1', albasse_zara_install: JSON.stringify({ at: Date.now(), outcome: 'dismissed' }), albasse_zara_push: JSON.stringify({ at: Date.now(), outcome: 'later' }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      if (!sessionStorage.getItem('__s')) { localStorage.setItem('sb-xtitsmmccpkelxfjyqyh-auth-token', s); sessionStorage.setItem('__s', '1'); }
    } catch (e) {}
  }, JSON.stringify(session));
  const log = { writes: [] };
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
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') return json(route, (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? PROFILE : [PROFILE]);
    if (u.pathname === '/rest/v1/smart_promotions') return json(route, []);
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

// tout ce qu'on lit sur les cartes visibles
const readCards = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="product-card-"]')].slice(0, 24).map((c) => {
      const tag = c.querySelector('[data-testid="product-price"]');
      const shine = c.querySelector('[data-testid="product-price-shine"]');
      const old = c.querySelector('[data-testid="product-old-price"]');
      const cs = tag ? getComputedStyle(tag) : null;
      const priceText = tag ? tag.querySelector('div').innerText || tag.innerText : '';
      const ss = shine ? getComputedStyle(shine) : null;
      const cr = c.getBoundingClientRect();
      const tr = tag ? tag.getBoundingClientRect() : null;
      return {
        slug: c.getAttribute('data-testid').slice(13),
        tag: !!tag,
        bg: cs && cs.backgroundColor,
        color: tag ? getComputedStyle(tag.querySelector('div')).color : null,
        text: tag ? tag.innerText.replace(/[  ]/g, ' ') : null,
        fits: tr ? tr.right <= cr.right + 0.5 && tr.left >= cr.left - 0.5 : false,
        anim: ss ? { name: ss.animationName, dur: ss.animationDuration, iter: ss.animationIterationCount, delay: ss.animationDelay } : null,
        old: old ? { deco: getComputedStyle(old).textDecorationLine, color: getComputedStyle(old).color, inTag: !!old.closest('[data-testid="product-price"]') } : null,
        zeroStars: /\(0\)/.test(c.innerText),
        stars: /★/.test(c.innerText),
      };
    }),
  );

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    // une page de catégorie
    {
      const v = await visitor(b, { width: 412, height: 860 });
      await v.page.goto(`${BASE}/categorie/chaussures`, { waitUntil: 'load' });
      await v.page.locator('[data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
      await sleep(1500);
      const cards = await readCards(v.page);
      check('chaque carte a son étiquette de prix', cards.length > 3 && cards.every((c) => c.tag), cards.length);
      check('étiquette verte unie (#2fcf77), texte vert très foncé', cards.every((c) => c.bg === 'rgb(47, 207, 119)' && c.color === 'rgb(6, 52, 29)'), cards[0]);
      check('le prix et « FCFA » dans l\'étiquette (ex. « 35 000 FCFA »)', cards.every((c) => /^\d{1,3}( \d{3})* FCFA$/.test(c.text)), cards.slice(0, 3).map((c) => c.text));
      check('l\'étiquette tient dans la carte', cards.every((c) => c.fits), cards.filter((c) => !c.fits).map((c) => c.slug));
      check('un éclat de lumière traverse l\'étiquette : animation CSS de 3,6 s, sans fin', cards.every((c) => c.anim && c.anim.name !== 'none' && c.anim.dur === '3.6s' && c.anim.iter === 'infinite'), cards[0].anim);
      check('chaque article a son moment (les étiquettes ne brillent pas toutes ensemble)', new Set(cards.map((c) => c.anim && c.anim.delay)).size >= Math.min(4, cards.length), cards.map((c) => c.anim && c.anim.delay).slice(0, 6));
      check('plus d\'étoiles vides « (0) » sur les cartes', cards.every((c) => !c.zeroStars), cards.filter((c) => c.zeroStars).map((c) => c.slug));
      // l'éclat bouge vraiment
      const pos = async () => v.page.evaluate(() => [...document.querySelectorAll('[data-testid="product-price-shine"]')].slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().left)));
      const p1 = await pos();
      await sleep(700);
      const p2 = await pos();
      check('l\'éclat se déplace (au moins une étiquette en 0,7 s)', p1.some((x, i) => x !== p2[i]), { p1, p2 });
      // l'icône d'accueil en haut de la page
      const head = await v.page.evaluate(() => {
        const h = document.querySelector('[data-testid="header-home"]');
        const ic = h && h.querySelector('[data-testid="home-icon"]');
        const r = ic && ic.getBoundingClientRect();
        return { found: !!ic, w: r && Math.round(r.width), h: r && Math.round(r.height), radius: ic && getComputedStyle(ic).borderRadius, emoji: !!h && h.innerText.includes('🏠'), label: h && h.getAttribute('aria-label') };
      });
      check('en haut de la page : la nouvelle icône d\'accueil (rond de 34 px), plus l\'émoji 🏠, nommée « Accueil »', head.found && head.w === 34 && head.h === 34 && head.radius === '17px' && !head.emoji && head.label === 'Accueil', head);
      // l'icône d'accueil ne touche pas le titre
      const ov = await v.page.evaluate(() => {
        const home = document.querySelector('[data-testid="header-home"]');
        const side = home.parentElement;
        const title = [...side.parentElement.children].find((c) => c !== side && c.innerText && c.innerText.trim().length > 3);
        const range = document.createRange(); range.selectNodeContents(title); const tr = range.getBoundingClientRect();
        return { iconRight: Math.round(home.getBoundingClientRect().right), sideRight: Math.round(side.getBoundingClientRect().right), textLeft: Math.round(tr.left), title: title.innerText };
      });
      check('l\'icône d\'accueil reste dans sa place, à gauche du titre', ov.iconRight <= ov.sideRight && ov.iconRight < ov.textLeft, ov);
      await v.page.screenshot({ path: path.join(OUT, 'prix-categorie.png') });
      await v.page.getByTestId('header-home').click();
      await v.page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => null);
      check('toucher l\'icône ramène à l\'accueil', new URL(v.page.url()).pathname === '/', v.page.url());
      check('aucune erreur (catégorie)', v.errs.length === 0, v.errs);
      check('aucune écriture (catégorie)', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }

    // petit téléphone, titre long : l'icône ne touche pas le titre
    {
      const v = await visitor(b, { width: 360, height: 780 });
      await v.page.goto(`${BASE}/categorie/velos-pour-enfants-jouets-et-jeux`, { waitUntil: 'load' });
      await v.page.getByTestId('header-home').waitFor({ timeout: 30000 });
      await sleep(1500);
      const o = await v.page.evaluate(() => {
        const home = document.querySelector('[data-testid="header-home"]');
        const side = home.parentElement;
        const title = [...side.parentElement.children].find((c) => c !== side && c.innerText && c.innerText.trim().length > 3);
        const range = document.createRange(); range.selectNodeContents(title); const tr = range.getBoundingClientRect();
        return { iconRight: Math.round(home.getBoundingClientRect().right), sideRight: Math.round(side.getBoundingClientRect().right), textLeft: Math.round(tr.left), title: title.innerText };
      });
      check('petit téléphone, titre long (« ' + o.title + ' ») : l\'icône reste à gauche du titre', o.iconRight <= o.sideRight && o.iconRight < o.textLeft, o);
      await v.page.screenshot({ path: path.join(OUT, 'titre-long.png') });
      check('aucune erreur (titre long)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // l'accueil : barre du bas, ventes flash / promotions (ancien prix comme avant)
    {
      const v = await visitor(b, { width: 412, height: 860 });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.locator('[data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
      await sleep(1500);
      const tab = await v.page.evaluate(() => {
        // la barre du bas prépare l'icône « onglet ouvert » et « onglet fermé » : on ne garde que celle qu'on voit (opacité réelle)
        const shown = (e) => { let o = 1; for (let a = e; a; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity || '1'); return o > 0.5; };
        const icons = [...document.querySelectorAll('[data-testid="home-icon"]')].filter((e) => e.getBoundingClientRect().top > window.innerHeight * 0.75 && shown(e));
        const r = icons[0] && icons[0].getBoundingClientRect();
        const bar = [...document.querySelectorAll('[role="tablist"], [role="tab"]')].map((e) => e.innerText).join(' ');
        return { n: icons.length, w: r && Math.round(r.width), emoji: /🏠/.test(bar), label: /Accueil/.test(document.body.innerText) };
      });
      check('barre du bas : « Accueil » avec la nouvelle icône (32 px, onglet ouvert), plus l\'émoji 🏠', tab.n === 1 && tab.w === 32 && !tab.emoji && tab.label, tab);
      const cards = await readCards(v.page);
      const promo = cards.filter((c) => c.old);
      if (promo.length) {
        check('promo : l\'ancien prix reste comme avant (rouge, barré, hors de l\'étiquette)', promo.every((c) => c.old.deco === 'line-through' && c.old.color === 'rgb(255, 155, 155)' && !c.old.inTag), promo[0]);
        check('promo : le nouveau prix dans l\'étiquette verte', promo.every((c) => c.tag && c.bg === 'rgb(47, 207, 119)'));
        await v.page.evaluate(() => { const o = document.querySelector('[data-testid="product-old-price"]'); o.closest('[data-testid^="product-card-"]').scrollIntoView({ block: 'center' }); });
        await sleep(800);
        await v.page.screenshot({ path: path.join(OUT, 'prix-promo.png') });
      } else {
        console.log('INFO  aucune promotion en cours sur l\'accueil : contrôle de l\'ancien prix passé');
      }
      check('accueil : plus d\'étoiles vides « (0) »', cards.every((c) => !c.zeroStars));
      await v.page.screenshot({ path: path.join(OUT, 'prix-accueil.png') });
      check('aucune erreur (accueil)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // ordinateur : l'étiquette reste dans la carte
    {
      const v = await visitor(b, { width: 1280, height: 900 });
      await v.page.goto(`${BASE}/categorie/chaussures`, { waitUntil: 'load' });
      await v.page.locator('[data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
      await sleep(1500);
      const cards = await readCards(v.page);
      check('ordinateur : étiquettes dans les cartes, avec l\'éclat', cards.length > 3 && cards.every((c) => c.fits && c.anim && c.anim.name !== 'none'));
      await v.page.screenshot({ path: path.join(OUT, 'prix-ordinateur.png') });
      check('aucune erreur (ordinateur)', v.errs.length === 0, v.errs);
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
