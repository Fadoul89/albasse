// La chaîne YouTube sur le site (22 novembre 2026), dans le navigateur, sur le site fabriqué (expo export) :
//   « Albasse TV » sur l'accueil (le lecteur ne se charge qu'à l'écran, démarre seul sans le son, au format 9:16),
//   « S'abonner » / « Toutes nos vidéos », la carte du menu ☰ et le bouton rouge en bas de l'accueil.
// Le compte client est SIMULÉ ; les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée ;
// YouTube est remplacé par une fausse page (aucune vraie vidéo chargée pendant le test).
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/youtube-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4621';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;
const KEY = process.env.SUPABASE_ANON_KEY;

const CHANNEL = 'https://www.youtube.com/@albasseshopping';
const SUBSCRIBE = `${CHANNEL}?sub_confirmation=1`;

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
const PROFILE = { id: UID, email: 'client@example.com', full_name: 'Aminata Hassan', phone: '66123456', banned: false, is_admin: false, role: 'customer', loyalty_points: 120, client_number: 'C-1042', created_at: '2026-01-01T00:00:00Z' };

async function visitor(b, viewport, mobile) {
  const ctx = await b.newContext(mobile ? { ...devices['Pixel 7'], viewport, deviceScaleFactor: 1 } : { viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + d]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1', albasse_assistant_teaser_seen: '1', albasse_assistant_teaser_member_seen: '1', albasse_zara_install: JSON.stringify({ at: Date.now(), outcome: 'dismissed' }), albasse_zara_push: JSON.stringify({ at: Date.now(), outcome: 'later' }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      if (!sessionStorage.getItem('__s')) { localStorage.setItem('sb-xtitsmmccpkelxfjyqyh-auth-token', s); sessionStorage.setItem('__s', '1'); }
    } catch (e) {}
    // les liens ouverts (Linking.openURL → window.open) : notés, pas ouverts
    window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
    // les ordres envoyés au lecteur (relayés par la fausse page YouTube)
    window.__yt = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.ytTest) window.__yt.push(e.data.ytTest); });
  }, JSON.stringify(session));
  const log = { writes: [], yt: [] };
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
  await ctx.route('**/*', (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (/youtube(-nocookie)?\.com$|ytimg\.com$|googlevideo\.com$/.test(u.hostname)) {
      log.yt.push(r.url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<body style="margin:0;background:#000;color:#fff;font:14px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">▶ lecteur YouTube (test)<script>addEventListener("message",function(e){try{parent.postMessage({ytTest:JSON.parse(e.data).func},"*")}catch(x){}})</script></body>' });
    }
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

const opened = (page) => page.evaluate(() => window.__opened.slice());

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    // téléphone
    {
      const v = await visitor(b, { width: 412, height: 860 }, true);
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('albasse-tv').waitFor({ state: 'attached', timeout: 30000 });
      await sleep(2500);
      const before = await v.page.evaluate(() => {
        const box = document.querySelector('[data-testid="albasse-tv-player"]').getBoundingClientRect();
        return { top: Math.round(box.top), inner: window.innerHeight, frames: document.querySelectorAll('[data-testid="albasse-tv-player"] iframe').length };
      });
      if (before.top > before.inner + 250) {
        check('« Albasse TV » hors de l\'écran : le lecteur n\'est pas encore chargé (aucune donnée YouTube téléchargée)', before.frames === 0 && v.log.yt.length === 0, { before, yt: v.log.yt.length });
      } else {
        console.log('INFO  l\'espace est déjà près de l\'écran au chargement : contrôle du chargement différé passé', before);
      }
      await v.page.getByTestId('albasse-tv').scrollIntoViewIfNeeded();
      await v.page.evaluate(() => document.querySelector('[data-testid="albasse-tv"]').scrollIntoView({ block: 'center' }));
      await v.page.locator('[data-testid="albasse-tv-player"] iframe').waitFor({ timeout: 10000 });
      await sleep(1500);
      const f = await v.page.evaluate(() => {
        const ifr = document.querySelector('[data-testid="albasse-tv-player"] iframe');
        const p = document.querySelector('[data-testid="albasse-tv-player"]').getBoundingClientRect();
        const card = document.querySelector('[data-testid="albasse-tv"]').getBoundingClientRect();
        return { src: ifr.getAttribute('src'), allow: ifr.getAttribute('allow'), title: ifr.getAttribute('title'), w: p.width, h: p.height, cardLeft: card.left, cardRight: card.right, inner: window.innerWidth, ifrW: ifr.getBoundingClientRect().width };
      });
      // la place : après la 1re catégorie (et après l'affiche « Vos articles préférés » si le client l'a), avant la 2e catégorie
      const place = await v.page.evaluate(() => {
        const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
        const secs = [...document.querySelectorAll('[data-testid^="home-section-"]')].filter((e) => /^home-section-[^-]/.test(e.getAttribute('data-testid')) && !e.getAttribute('data-testid').startsWith('home-section-title-'));
        const tv = r('[data-testid="albasse-tv"]');
        const ad = r('[data-testid="targeted-ad"]');
        return { tvTop: tv.top, tvBottom: tv.bottom, first: secs[0] ? secs[0].getBoundingClientRect().bottom : null, second: secs[1] ? secs[1].getBoundingClientRect().top : null, adBottom: ad ? ad.bottom : null, travel: r('[data-testid="home-sections"]').top };
      });
      check('place : après la 1re catégorie' + (place.adBottom !== null ? ' et après l\'affiche « Vos articles préférés »' : '') + ', avant la 2e catégorie', place.first !== null && place.tvTop >= place.first && (place.second === null || place.tvBottom <= place.second) && (place.adBottom === null || place.tvTop >= place.adBottom), place);
      const src = new URL(f.src);
      check('à l\'écran : le lecteur se charge (youtube-nocookie, liste des envois de la chaîne)', src.origin === 'https://www.youtube-nocookie.com' && src.pathname === '/embed/videoseries' && src.searchParams.get('list') === 'UUFSsx6lIT9sQa87xg-628Bw', f.src);
      check('la vidéo démarre seule, sans le son, sur place', ['autoplay', 'mute', 'playsinline'].every((k) => src.searchParams.get(k) === '1') && /autoplay/.test(f.allow || ''), { src: f.src, allow: f.allow });
      check('le lecteur a un titre (lecteur d\'écran)', /Albasse TV/.test(f.title || ''));
      check('le lecteur au format des Shorts (9:16), plus de la moitié de la carte', Math.abs(f.h / f.w - 16 / 9) < 0.02 && f.w > (f.cardRight - f.cardLeft) * 0.5 && f.ifrW === f.w, f);
      check('la carte tient dans l\'écran (16 px de chaque côté)', Math.abs(f.cardLeft - 16) <= 1 && Math.abs(f.inner - 16 - f.cardRight) <= 1, f);
      check('la page YouTube est bien demandée une fois l\'espace à l\'écran', v.log.yt.some((u) => u.includes('videoseries')), v.log.yt.slice(0, 2));
      const t = await v.page.getByTestId('albasse-tv').innerText();
      // l'espace sort de l'écran : pause ; il revient : lecture
      await v.page.evaluate(() => window.scrollBy(0, 0));
      await v.page.evaluate(() => { const el = document.querySelector('[data-testid="albasse-tv"]'); let p = el.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement; (p || document.scrollingElement).scrollBy(0, 2500); });
      await sleep(1200);
      const afterLeave = await v.page.evaluate(() => window.__yt.slice());
      await v.page.evaluate(() => document.querySelector('[data-testid="albasse-tv"]').scrollIntoView({ block: 'center' }));
      await sleep(1200);
      const afterBack = await v.page.evaluate(() => window.__yt.slice());
      check('l\'espace sort de l\'écran : la vidéo se met en pause (données mobiles économisées)', afterLeave[afterLeave.length - 1] === 'pauseVideo', afterLeave);
      check('l\'espace revient à l\'écran : la vidéo reprend', afterBack[afterBack.length - 1] === 'playVideo' && afterBack.length > afterLeave.length, afterBack);
      check('le lecteur n\'est chargé qu\'une fois (pas rechargé à chaque passage)', v.log.yt.filter((u) => u.includes('videoseries')).length === 1, v.log.yt.length);
      check('textes : « Albasse TV », « DERNIÈRE VIDÉO », « sans le son », « S\'abonner », « Toutes nos vidéos »', ['Albasse TV', 'DERNIÈRE VIDÉO', 'sans le son', "S'abonner", 'Toutes nos vidéos'].every((s) => t.includes(s)), t);
      await v.page.screenshot({ path: path.join(OUT, 'youtube-accueil.png') });

      await v.page.getByTestId('albasse-tv-subscribe').click();
      await sleep(400);
      await v.page.getByTestId('albasse-tv-channel').click();
      await sleep(400);
      let o = await opened(v.page);
      check('« S\'abonner » ouvre la fenêtre d\'abonnement ; « Toutes nos vidéos » ouvre la chaîne', o[0] === SUBSCRIBE && o[1] === CHANNEL && o.length === 2, o);

      // le bas de l'accueil
      await v.page.evaluate(async () => { for (let i = 0; i < 60 && !document.querySelector('[data-testid="footer-youtube"]'); i++) { window.scrollBy(0, 1500); await new Promise((r) => setTimeout(r, 250)); } document.querySelector('[data-testid="footer-youtube"]').scrollIntoView({ block: 'center' }); });
      await sleep(800);
      const ft = await v.page.getByTestId('footer-youtube').innerText();
      check('bas de l\'accueil : bouton rouge « Notre chaîne YouTube » avec WhatsApp et le téléphone', /Notre chaîne YouTube/.test(ft) && /Abonnez-vous/.test(ft));
      const bg = await v.page.getByTestId('footer-youtube').evaluate((e) => getComputedStyle(e).backgroundColor);
      check('le bouton est rouge YouTube', bg === 'rgb(255, 0, 0)', bg);
      await v.page.screenshot({ path: path.join(OUT, 'youtube-bas.png') });
      await v.page.getByTestId('footer-youtube').click();
      await sleep(400);
      o = await opened(v.page);
      check('le bouton du bas ouvre la chaîne', o[2] === CHANNEL && o.length === 3, o);

      // le menu ☰
      await v.page.evaluate(() => window.scrollTo(0, 0));
      await sleep(400);
      await v.page.getByTestId('menu-button').first().click();
      await v.page.getByTestId('menu-youtube').waitFor({ state: 'attached', timeout: 10000 });
      await v.page.evaluate(() => document.querySelector('[data-testid="menu-youtube"]').scrollIntoView({ block: 'center' }));
      await sleep(900);
      const mt = await v.page.getByTestId('menu-youtube').innerText();
      check('menu ☰ : la carte « Notre chaîne YouTube » avec « S\'abonner »', /Notre chaîne YouTube/.test(mt) && /S'abonner/.test(mt), mt);
      await v.page.screenshot({ path: path.join(OUT, 'youtube-menu.png') });
      await v.page.getByTestId('menu-youtube-subscribe').click();
      await sleep(400);
      o = await opened(v.page);
      check('menu : « S\'abonner » ouvre SEULEMENT la fenêtre d\'abonnement (pas aussi la chaîne)', o[3] === SUBSCRIBE && o.length === 4, o);
      await v.page.getByTestId('menu-youtube').click({ position: { x: 30, y: 20 } });
      await sleep(400);
      o = await opened(v.page);
      check('menu : toucher la carte ouvre la chaîne', o[4] === CHANNEL && o.length === 5, o);
      check('aucune erreur (téléphone)', v.errs.length === 0, v.errs);
      check('aucune écriture (téléphone)', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }

    // ordinateur : le lecteur garde une taille raisonnable
    {
      const v = await visitor(b, { width: 1280, height: 900 }, false);
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('albasse-tv').waitFor({ state: 'attached', timeout: 30000 });
      await v.page.locator('[data-testid^="product-card-"]').first().waitFor({ timeout: 30000 }); // les articles sont arrivés : la page ne bouge plus
      for (let i = 0; i < 10 && !(await v.page.locator('[data-testid="albasse-tv-player"] iframe').count()); i++) {
        await v.page.evaluate(() => document.querySelector('[data-testid="albasse-tv"]').scrollIntoView({ block: 'center' }));
        await sleep(1000);
      }
      await v.page.locator('[data-testid="albasse-tv-player"] iframe').waitFor({ timeout: 10000 });
      await sleep(1000);
      const d = await v.page.evaluate(() => {
        const p = document.querySelector('[data-testid="albasse-tv-player"]').getBoundingClientRect();
        const c = document.querySelector('[data-testid="albasse-tv"]').getBoundingClientRect();
        return { w: Math.round(p.width), h: Math.round(p.height), left: c.left, right: c.right, inner: window.innerWidth };
      });
      check('ordinateur : lecteur de 280 × 498 px au plus, la carte dans l\'écran', d.w === 280 && Math.abs(d.h - 498) <= 1 && d.left >= 15 && d.right <= d.inner - 15, d);
      await v.page.screenshot({ path: path.join(OUT, 'youtube-ordinateur.png') });
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
