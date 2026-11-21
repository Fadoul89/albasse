// La grille des articles selon la vraie largeur de l'écran (21 novembre 2026), dans le navigateur, sur le site fabriqué (expo export) :
// page d'une catégorie et recherche, à plusieurs largeurs (téléphone, téléphone en « version ordinateur », ordinateur), et un écran qu'on agrandit.
// Les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée.
// Usage : NODE_PATH=/opt/node-tools/node_modules node tests/shop/product-grid-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4601';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;
const PAD = 16;
const GAP = 16;

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};

async function visitor(b, viewport, mobile) {
  const ctx = await b.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + d]: '1', albasse_install_after_signup: '1' };
      seed.albasse_zara_install = JSON.stringify({ at: Date.now(), outcome: 'dismissed' });
      seed.albasse_zara_push = JSON.stringify({ at: Date.now(), outcome: 'later' });
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch (e) {}
  });
  const writes = [];
  await ctx.route('**/*', (route) => {
    const r = route.request();
    const u = new URL(r.url());
    if (!u.hostname.endsWith('.supabase.co')) return route.continue();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: '' });
    if (u.pathname === '/rest/v1/smart_promotions') return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '[]' });
    if (!['GET', 'HEAD'].includes(r.method())) {
      if (!/visitor_sessions|product_views|rpc\//.test(u.pathname)) writes.push(r.method() + ' ' + u.pathname);
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, writes, errs };
}

// la 1re ligne de cartes : combien, leurs bords, les espaces entre elles
const firstRow = (page, listId) =>
  page.evaluate((id) => {
    const cards = [...document.querySelectorAll(`[data-testid="${id}"] [data-testid^="product-card-"]`)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    if (!cards.length) return null;
    const top = cards[0].top;
    const row = cards.filter((r) => Math.abs(r.top - top) < 2).sort((a, b) => a.left - b.left);
    const gaps = row.slice(1).map((r, i) => Math.round((r.left - row[i].right) * 10) / 10);
    return { total: cards.length, n: row.length, left: Math.round(row[0].left), right: Math.round(row[row.length - 1].right), width: Math.round(row[0].width * 10) / 10, gaps, inner: window.innerWidth };
  }, listId);

const CASES = [
  { name: 'petit téléphone 360', vp: { width: 360, height: 780 }, mobile: true, cols: 2 },
  { name: 'téléphone 412', vp: { width: 412, height: 860 }, mobile: true, cols: 2 },
  { name: 'tablette 768', vp: { width: 768, height: 1000 }, mobile: false, cols: 3 },
  { name: 'téléphone en version ordinateur 980', vp: { width: 980, height: 1800 }, mobile: false, cols: 4 },
  { name: 'ordinateur 1280', vp: { width: 1280, height: 900 }, mobile: false, cols: 6 },
  { name: 'grand écran 1920', vp: { width: 1920, height: 1080 }, mobile: false, cols: 6 },
];

(async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    for (const c of CASES) {
      const v = await visitor(b, c.vp, c.mobile);
      await v.page.goto(`${BASE}/categorie/chaussures`, { waitUntil: 'load' });
      await v.page.locator('[data-testid="category-list"] [data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
      await sleep(1200);
      const r = await firstRow(v.page, 'category-list');
      const w = c.vp.width;
      const expect = Math.min(c.cols, r ? r.total : 0);
      check(`catégorie, ${c.name} : ${expect} articles sur la 1re ligne`, !!r && r.n === expect, r);
      check(`catégorie, ${c.name} : marge de 16 px à gauche, la ligne remplie jusqu'à 16 px du bord droit`, !!r && Math.abs(r.left - PAD) <= 1 && (r.n < c.cols || Math.abs(w - PAD - r.right) <= 2), r);
      check(`catégorie, ${c.name} : 16 px entre les cartes (plus de grand vide au milieu)`, !!r && r.gaps.every((g) => Math.abs(g - GAP) <= 1), r && r.gaps);
      check(`catégorie, ${c.name} : aucune carte ne dépasse de l'écran (toutes à 16 px du bord ou plus)`, await v.page.evaluate(() => [...document.querySelectorAll('[data-testid^="product-card-"]')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 15 && r.right <= window.innerWidth - 15; })));
      if (c.cols >= 4) await v.page.screenshot({ path: path.join(OUT, `grille-${w}.png`) });
      check(`aucune erreur (${c.name})`, v.errs.length === 0, v.errs);
      check(`aucune écriture (${c.name})`, v.writes.length === 0, v.writes);
      await v.ctx.close();
    }

    // un écran qu'on agrandit (téléphone puis version ordinateur / fenêtre élargie) : la grille suit, sans recharger la page
    {
      const v = await visitor(b, { width: 412, height: 860 }, false);
      await v.page.goto(`${BASE}/categorie/chaussures`, { waitUntil: 'load' });
      await v.page.locator('[data-testid="category-list"] [data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
      await sleep(1000);
      const before = await firstRow(v.page, 'category-list');
      await v.page.setViewportSize({ width: 1280, height: 900 });
      await sleep(1500);
      const after = await firstRow(v.page, 'category-list');
      check('fenêtre élargie de 412 à 1280 px : de 2 à 6 articles par ligne, sans grand vide', !!before && !!after && before.n === 2 && after.n === Math.min(6, after.total) && after.gaps.every((g) => Math.abs(g - GAP) <= 1), { before, after });
      await v.page.setViewportSize({ width: 412, height: 860 });
      await sleep(1500);
      const back = await firstRow(v.page, 'category-list');
      check('fenêtre rétrécie à 412 px : de nouveau 2 par ligne, rien ne dépasse', !!back && back.n === 2 && back.right <= 412 - PAD + 1, back);
      check('aucune erreur (agrandissement)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // la recherche : même grille
    for (const c of [CASES[1], CASES[4]]) {
      const v = await visitor(b, c.vp, c.mobile);
      await v.page.goto(`${BASE}/recherche`, { waitUntil: 'load' });
      await v.page.locator('[data-testid="search-list"] [data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
      await sleep(1200);
      const r = await firstRow(v.page, 'search-list');
      check(`recherche, ${c.name} : ${c.cols} articles sur la 1re ligne, 16 px entre eux`, !!r && r.n === Math.min(c.cols, r.total) && r.gaps.every((g) => Math.abs(g - GAP) <= 1), r);
      check(`aucune erreur (recherche, ${c.name})`, v.errs.length === 0, v.errs);
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
