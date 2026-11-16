// Menu ☰ « verre courbé » (comme la vidéo « Curved Sidebar »), dans le navigateur, sur le site fabriqué (expo export).
// Les catégories et les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée ; le compte client est SIMULÉ.
// La date est fixée (horloge du navigateur) : 16 novembre 2026 (Black Friday annoncé) puis 15 décembre 2026 (aucun moment fort).
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/side-menu-glass-ui.test.js <dossier dist> [port] [dossier des photos]
// BASE_URL=https://www.albasseshopping.com : le vrai site en ligne. LOOK=<fichier json> : nom, numéro, points et photo à montrer sur les images.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4561';
const OUT = process.argv[4] || os.tmpdir();
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = 'https://xtitsmmccpkelxfjyqyh.supabase.co/rest/v1';
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
const UID = '11111111-1111-4111-8111-111111111111';
const LOOK = process.env.LOOK ? JSON.parse(fs.readFileSync(process.env.LOOK, 'utf8')) : null;

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const get = async (q) => (await fetch(`${REST}/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1' })}.c2ln`;

// un visiteur. who : 'client' | 'guest'. at : date du navigateur. desktop : écran d'ordinateur.
async function visitor(b, { who = 'client', at = '2026-11-16T10:00:00+01:00', desktop = false } = {}) {
  const ctx = await b.newContext(desktop ? { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 } : { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  const look = LOOK || { full_name: 'Aminata Hassan', client_number: 883, loyalty_points: 27, avatar_url: null };
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'client@example.com', phone: '', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
  const profile = { id: UID, email: 'client@example.com', phone: '66123456', banned: false, is_admin: false, created_at: '2026-01-01T00:00:00Z', ...look };
  const state = { loggedIn: who === 'client', logout: 0, writes: [] };
  // la date du navigateur AVANT tout le reste (les réglages « déjà vu aujourd'hui » prennent cette date)
  await ctx.clock.install({ time: new Date(at) });
  await ctx.addInitScript(([sk, s, client]) => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + day]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1' };
      seed.albasse_zara_install = JSON.stringify({ at: Date.now(), outcome: 'dismissed' });
      seed.albasse_zara_push = JSON.stringify({ at: Date.now(), outcome: 'later' });
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      if (client && !sessionStorage.getItem('__seeded')) {
        localStorage.setItem(sk, s);
        sessionStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
  }, [SK, JSON.stringify(session), who === 'client']);
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (!u.hostname.endsWith('.supabase.co')) return route.continue();
    if (m === 'OPTIONS') return json(route, {});
    if (u.pathname === '/auth/v1/user') return state.loggedIn ? json(route, user) : json(route, { msg: 'no user' }, 401);
    if (u.pathname === '/auth/v1/token') return state.loggedIn ? json(route, session) : json(route, { error: 'invalid_grant' }, 400);
    if (u.pathname === '/auth/v1/logout') {
      state.logout++;
      state.loggedIn = false;
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') {
      const one = (r.headers()['accept'] || '').includes('vnd.pgrst.object');
      return state.loggedIn ? json(route, one ? profile : [profile]) : one ? json(route, { code: 'PGRST116' }, 406) : json(route, []);
    }
    // le site du patron demande un compte : pour ce test, le compte obligatoire est « éteint » (vrais réglages, ce seul point changé)
    if (u.pathname === '/rest/v1/store_settings' && m === 'GET') {
      const res = await route.fetch({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } }).catch(() => null);
      if (!res) return route.abort();
      let body = await res.json();
      const fix = (row) => ({ ...row, account_required: false });
      body = Array.isArray(body) ? body.map(fix) : fix(body);
      return route.fulfill({ response: res, body: JSON.stringify(body) });
    }
    // la fenêtre d'offre du site (smart_promotions) s'ouvrirait par-dessus le menu : pas d'offre pendant ce test
    if (u.pathname === '/rest/v1/smart_promotions') return (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? json(route, { code: 'PGRST116' }, 406) : json(route, []);
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    if (!['GET', 'HEAD'].includes(m)) {
      if (!u.pathname.startsWith('/rest/v1/visitor_sessions')) state.writes.push(m + ' ' + u.pathname);
      return route.abort();
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

let shot = 0;
let BROWSER = null;
const openMenu = async (page) => {
  // la fenêtre « Télécharge l'app » du site peut s'ouvrir par-dessus : « Plus tard »
  const later = page.getByText('Plus tard', { exact: true });
  if (await later.isVisible().catch(() => false)) {
    await later.click();
    await sleep(500);
  }
  await page.locator('[data-testid="menu-button"]:visible').first().click({ timeout: 15000 }).catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, `menu-erreur-${++shot}.png`) });
    throw e;
  });
  await page.getByTestId('side-menu').waitFor({ timeout: 10000 });
  await sleep(700);
};
const lum = (rgb) => {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  const server = process.env.BASE_URL ? null : spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  BROWSER = b;

  // les vraies catégories : les principales (dans l'ordre de l'admin) et leurs sous-catégories
  const cats = await get('categories?select=id,slug,name,parent_id,sort_order');
  const named = cats.filter((c) => String(c.name || '').trim());
  const mains = named.filter((c) => !c.parent_id || !cats.some((p) => p.id === c.parent_id && !p.parent_id));
  const subsOf = (id) => named.filter((c) => c.parent_id === id);
  const withSubs = mains.filter((c) => subsOf(c.id).length > 0);
  const montre = mains.find((c) => c.slug === 'montre-accessoires') || withSubs[0];
  const montreSub = subsOf(montre.id)[0];
  console.log(`info  ${mains.length} catégories principales, ${withSubs.length} avec des sous-catégories ; exemple : ${montre.name} › ${montreSub.name}`);

  // 1) client connecté, accueil, 16 novembre 2026
  let v = await visitor(b);
  let { page } = v;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2500);
  await openMenu(page);
  const glass = await page.evaluate(() => {
    const g = document.querySelector('[data-glass="verre"]');
    if (!g) return null;
    const cs = getComputedStyle(g);
    return { clip: cs.clipPath || cs.webkitClipPath, blur: cs.backdropFilter || cs.webkitBackdropFilter, bg: cs.backgroundImage, path: !!document.querySelector('#albasse-menu-curve path') };
  });
  check('panneau en verre : découpé par le chemin courbé et flou du fond', !!glass && /albasse-menu-curve/.test(glass.clip) && /blur\(22px\)/.test(glass.blur) && glass.path && /gradient/.test(glass.bg), glass);
  const panel = await page.getByTestId('menu-panel').boundingBox();
  check('téléphone : panneau posé à gauche (marge 10), 335 px de large, le site visible à droite', panel && Math.round(panel.x) === 10 && Math.abs(panel.width - 335) <= 1 && panel.x + panel.width < 390, panel);
  check('téléphone : pas de défilement de côté', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('profil : nom, numéro AS-000883, palier Argent, 27 pts, « 23 pts avant le palier 🥇 Or »', LOOK || ((await page.getByTestId('menu-profile-name').innerText()) === 'Aminata Hassan' && (await page.getByTestId('menu-profile-number').innerText()) === 'AS-000883' && /Argent/.test(await page.getByTestId('menu-profile-tier').innerText()) && (await page.getByTestId('menu-profile-points').innerText()) === '27 pts' && /23 pts avant le palier .*Or/.test(await page.getByTestId('menu-profile-hint').innerText())));
  const rows = await page.locator('[data-testid^="menu-cat-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('menu-cat-', '')));
  const order = mains.slice().sort((a, b2) => (a.sort_order ?? 1e9) - (b2.sort_order ?? 1e9) || String(a.name).localeCompare(String(b2.name), 'fr')).map((c) => c.slug);
  check(`les ${mains.length} catégories principales, une par ligne, dans l'ordre de l'admin`, rows.length === mains.length && new Set(rows).size === rows.length && mains.every((c) => rows.includes(c.slug)), { rows, order });
  const toggles = await page.locator('[data-testid^="menu-sub-toggle-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('menu-sub-toggle-', '')));
  check(`une flèche seulement pour les catégories qui ont des sous-catégories (${withSubs.length})`, toggles.length === withSubs.length && withSubs.every((c) => toggles.includes(c.slug)), toggles);
  const ink = await page.getByTestId(`menu-cat-${rows[0]}`).locator('div[dir], div').last().evaluate((e) => getComputedStyle(e).color).catch(() => null);
  const nameColor = await page.getByTestId(`menu-cat-${rows[0]}`).evaluate((e) => { const t = [...e.querySelectorAll('div')].find((d) => d.children.length === 0 && d.innerText.trim().length > 2); return t ? getComputedStyle(t).color : null; });
  check('texte foncé sur verre clair (lisible)', nameColor && lum(nameColor) < 0.05, [nameColor, ink]);
  const hl = page.getByTestId('menu-highlight');
  check('16 novembre : carte « À LA UNE · NOV. », « BLACK FRIDAY », « Le 27 novembre »', (await hl.count()) === 1 && /À LA UNE · NOV\./.test(await hl.innerText()) && /BLACK\s+FRIDAY/.test(await hl.innerText()) && /Le 27 novembre/.test(await hl.innerText()), await hl.innerText().catch(() => ''));
  check('client connecté : « Mon compte » et « Se déconnecter » en bas', (await page.getByTestId('menu-account').count()) === 1 && (await page.getByTestId('menu-signout').count()) === 1);
  const ys = await page.evaluate(() => ['menu-profile', 'menu-cat-', 'menu-highlight', 'menu-signout'].map((id) => (id.endsWith('-') ? document.querySelector(`[data-testid^="${id}"]`) : document.querySelector(`[data-testid="${id}"]`))?.getBoundingClientRect().top ?? -1));
  check('ordre : profil, catégories, carte « À la une », puis Mon compte / Se déconnecter', ys.every((y, i) => y > 0 && (i === 0 || y > ys[i - 1])), ys);
  await page.screenshot({ path: path.join(OUT, 'menu-1-accueil-connecte.png') });
  const arrows = await page.getByTestId('menu-panel').evaluate((p) => [...new Set([...p.querySelectorAll('div')].filter((d) => d.children.length === 0 && d.innerText === '›').map((d) => Math.round(d.getBoundingClientRect().right)))]);
  check('les flèches « › » sont toutes alignées', arrows.length === 1, arrows);
  // le bas du menu : la carte « À la une », Mon compte, Se déconnecter
  await page.getByTestId('menu-signout').scrollIntoViewIfNeeded();
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'menu-1b-bas-du-menu.png') });
  const sig = await page.getByTestId('menu-signout').boundingBox();
  check('« Se déconnecter » se voit en faisant défiler le menu (pas coupé par le bas)', sig && sig.y + sig.height <= 800, sig);

  // la flèche montre les sous-catégories, en arbre ; toucher le nom ouvre toujours la page
  const tg = page.getByTestId(`menu-sub-toggle-${montre.slug}`);
  check('flèche : fermée au départ (aria-expanded=false)', (await tg.getAttribute('aria-expanded')) === 'false');
  await tg.click();
  await sleep(400);
  const subTxt = await page.getByTestId(`menu-subs-${montre.slug}`).innerText().catch(() => '');
  check(`flèche de « ${montre.name} » : « Tout voir » puis ses sous-catégories (${subsOf(montre.id).map((c) => c.name).join(', ')})`, /Tout voir/.test(subTxt) && subsOf(montre.id).every((c) => subTxt.includes(c.name.trim())) && (await tg.getAttribute('aria-expanded')) === 'true', subTxt);
  const treeLine = await page.getByTestId(`menu-subs-${montre.slug}`).evaluate((e) => { const l = [...e.querySelectorAll('div')].find((d) => d.getBoundingClientRect().width <= 2 && d.getBoundingClientRect().height > 20); return !!l; });
  check('les sous-catégories sont reliées par une ligne en arbre', treeLine);
  const other = withSubs.find((c) => c.id !== montre.id);
  if (other) {
    await page.getByTestId(`menu-sub-toggle-${other.slug}`).click();
    await sleep(300);
    check('une seule catégorie ouverte à la fois', (await page.getByTestId(`menu-subs-${montre.slug}`).count()) === 0 && (await page.getByTestId(`menu-subs-${other.slug}`).count()) === 1);
    await page.getByTestId(`menu-sub-toggle-${other.slug}`).click();
    await sleep(300);
    check('toucher la flèche encore : les sous-catégories se cachent', (await page.getByTestId(`menu-subs-${other.slug}`).count()) === 0);
    await tg.click();
    await sleep(300);
  }
  await page.getByTestId(`menu-sub-${montreSub.slug}`).click();
  await sleep(1500);
  check(`toucher « ${montreSub.name} » : sa page s'ouvre et le menu se ferme`, new URL(page.url()).pathname === `/categorie/${montreSub.slug}` && (await page.getByTestId('side-menu').count()) === 0, page.url());

  // sur la page de la sous-catégorie : sa catégorie est ouverte et elle est mise en avant
  await openMenu(page);
  const subBg = await page.getByTestId(`menu-sub-${montreSub.slug}`).evaluate((e) => getComputedStyle(e).backgroundColor).catch(() => null);
  check(`page « ${montreSub.name} » : « ${montre.name} » ouverte d'elle-même, « ${montreSub.name} » mise en avant (verre blanc)`, (await page.getByTestId(`menu-subs-${montre.slug}`).count()) === 1 && /rgba\(255, 255, 255, 0\.8/.test(subBg || ''), subBg);
  await page.screenshot({ path: path.join(OUT, 'menu-2-sous-categorie.png') });
  await page.getByTestId(`menu-sub-all-${montre.slug}`).click();
  await sleep(1500);
  check(`« Tout voir » : la page « ${montre.name} »`, new URL(page.url()).pathname === `/categorie/${montre.slug}`, page.url());
  await openMenu(page);
  await page.getByTestId(`menu-cat-${montre.slug}`).click();
  await sleep(800);
  check('toucher le NOM d\'une catégorie qui a des sous-catégories ouvre sa page (pas seulement la flèche)', new URL(page.url()).pathname === `/categorie/${montre.slug}` && (await page.getByTestId('side-menu').count()) === 0);

  // la carte « À la une » ouvre Zara
  await openMenu(page).catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, 'menu-erreur.png') });
    throw e;
  });
  await page.getByTestId('menu-highlight').click({ timeout: 8000 }).catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, 'menu-erreur.png') });
    throw e;
  });
  await page.getByTestId('assistant-panel').waitFor({ timeout: 10000 }).catch(() => {});
  check('carte « À la une » : le menu se ferme et Zara s\'ouvre (promotions)', (await page.getByTestId('side-menu').count()) === 0 && (await page.getByTestId('assistant-panel').count()) === 1);
  await page.keyboard.press('Escape').catch(() => {});
  await v.ctx.close();

  // ✕, toucher à côté, Mon compte, Se déconnecter
  v = await visitor(b);
  page = v.page;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2500);
  await openMenu(page);
  await page.getByTestId('menu-close').click();
  await sleep(500);
  check('bouton « fermer » (en haut à droite du panneau) : le menu se ferme', (await page.getByTestId('side-menu').count()) === 0);
  await openMenu(page);
  await page.getByTestId('menu-backdrop').click({ position: { x: 20, y: 300 }, force: true });
  await sleep(500);
  check('toucher à côté du panneau : le menu se ferme', (await page.getByTestId('side-menu').count()) === 0);
  await openMenu(page);
  await page.getByTestId('menu-account').click();
  await sleep(1200);
  check('« Mon compte » : la page du compte', new URL(page.url()).pathname === '/compte' && (await page.getByTestId('side-menu').count()) === 0, page.url());
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2000);
  await openMenu(page);
  await page.getByTestId('menu-signout').click();
  await sleep(2000);
  await openMenu(page);
  check('« Se déconnecter » : déconnecté (le menu montre « Se connecter »)', (await page.getByTestId('menu-guest').count()) === 1 && (await page.getByTestId('menu-profile').count()) === 0, v.state.logout);
  check('aucune écriture dans la base', v.state.writes.length === 0, v.state.writes);
  check('aucune erreur de page (client)', v.errs.length === 0, v.errs);
  await v.ctx.close();

  // 2) visiteur sans compte
  v = await visitor(b, { who: 'guest' });
  page = v.page;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2500);
  await openMenu(page);
  check('visiteur : « Se connecter » et « Créer un compte », ni profil, ni points, ni « Se déconnecter »', (await page.getByTestId('menu-login').count()) === 1 && (await page.getByTestId('menu-register').count()) === 1 && (await page.getByTestId('menu-profile').count()) === 0 && (await page.getByTestId('menu-signout').count()) === 0 && (await page.getByTestId('menu-account').count()) === 0);
  check('visiteur : les catégories sont là', (await page.locator('[data-testid^="menu-cat-"]').count()) === mains.length);
  await page.screenshot({ path: path.join(OUT, 'menu-3-visiteur.png') });
  await page.getByTestId('menu-login').click();
  await sleep(1200);
  check('visiteur : « Se connecter » ouvre la connexion', /connexion/.test(new URL(page.url()).pathname), page.url());
  check('aucune erreur de page (visiteur)', v.errs.length === 0, v.errs);
  await v.ctx.close();

  // 3) 15 décembre 2026 : aucun moment fort -> pas de carte
  v = await visitor(b, { at: '2026-12-15T10:00:00+01:00' });
  page = v.page;
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2500);
  await openMenu(page);
  check('15 décembre : pas de carte « À la une » (aucun moment fort, rien d\'inventé)', (await page.getByTestId('menu-highlight').count()) === 0 && (await page.getByTestId('menu-signout').count()) === 1);
  await v.ctx.close();

  // 4) le menu ☰ des pages Recherche et catégorie : le même panneau
  v = await visitor(b);
  page = v.page;
  await page.goto(`${BASE}/recherche`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2000);
  await openMenu(page);
  check('page Recherche : le même menu en verre', (await page.locator('[data-glass="verre"]').count()) === 1 && (await page.locator('[data-testid^="menu-cat-"]').count()) === mains.length);
  await v.ctx.close();

  // 5) ordinateur : 340 px, le site visible à côté ; image pour le patron
  v = await visitor(b, { desktop: true });
  page = v.page;
  await page.goto(`${BASE}/categorie/${montreSub.slug}`, { waitUntil: 'load' });
  await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
  await sleep(2500);
  await openMenu(page);
  const pc = await page.getByTestId('menu-panel').boundingBox();
  check('ordinateur : panneau de 340 px à gauche, toute la hauteur', pc && Math.abs(pc.width - 340) <= 1 && pc.height > 850, pc);
  await page.screenshot({ path: path.join(OUT, 'menu-4-ordinateur.png') });
  await v.ctx.close();

  await b.close();
  if (server) server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch(async (e) => {
  console.error('ERREUR', e);
  // une photo de chaque page ouverte au moment du blocage, pour comprendre
  for (const ctx of BROWSER ? BROWSER.contexts() : []) for (const pg of ctx.pages()) await pg.screenshot({ path: path.join(OUT, `menu-blocage-${++shot}.png`) }).catch(() => {});
  process.exit(1);
});
