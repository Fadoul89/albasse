// Pages des catégories (« ‹ 1 2 3 … › » et « Page suivante ») dans le navigateur, sur le site fabriqué (expo export).
// Les articles et les catégories sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée ; le compte obligatoire est simulé « éteint ».
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/category-pages-ui.test.js <dossier dist> [port] [dossier des photos]
// BASE_URL=https://www.albasseshopping.com : le vrai site en ligne.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4550';
const OUT = process.argv[4] || os.tmpdir();
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = 'https://xtitsmmccpkelxfjyqyh.supabase.co/rest/v1';

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const get = async (q) => (await fetch(`${REST}/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();

async function visitor(b, opts = {}) {
  const ctx = await b.newContext(opts.desktop ? { viewport: { width: 1280, height: 900 } } : { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + day]: '1', albasse_install_after_signup: '1' };
      seed.albasse_zara_install = JSON.stringify({ at: Date.now(), outcome: 'dismissed' });
      seed.albasse_zara_push = JSON.stringify({ at: Date.now(), outcome: 'later' });
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch (e) {}
  });
  const writes = [];
  await ctx.route('**/*', (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (u.hostname.endsWith('.supabase.co')) {
      // le site du patron demande un compte : pour ce test, le compte obligatoire est « éteint » (on lit les vrais réglages, on change seulement ce point)
      if (u.pathname === '/rest/v1/store_settings' && m === 'GET') {
        return route
          .fetch()
          .then(async (res) => {
            let body = await res.json();
            const fix = (row) => ({ ...row, account_required: false });
            body = Array.isArray(body) ? body.map(fix) : fix(body);
            await route.fulfill({ response: res, body: JSON.stringify(body) });
          })
          .catch(() => route.continue());
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) {
        writes.push(m + ' ' + u.pathname);
        return route.abort();
      }
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, writes, errs };
}

const cardsOn = (page) => page.getByTestId('category-list').locator('[data-testid^="product-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('product-card-', '')));
const waitCards = async (page) => {
  await page.getByTestId('category-list').locator('[data-testid^="product-card-"]').first().waitFor({ timeout: 30000 });
  await sleep(600);
};
const bar = (page) => page.getByTestId('category-pages');
const buttons = (page) => bar(page).locator('[data-testid^="category-pages-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('category-pages-', '')).filter((t) => /^\d+$/.test(t)));
const pageParam = (page) => new URL(page.url()).searchParams.get('page');

(async () => {
  const server = process.env.BASE_URL ? null : spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();

  // les chiffres attendus, lus dans la base : articles actifs de la catégorie et de ses sous-catégories
  const cats = await get('categories?select=id,slug,parent_id');
  const prods = await get('products?select=id,slug,category_id,is_active&is_active=eq.true&limit=2000');
  const familyCount = (slug) => {
    const c = cats.find((x) => x.slug === slug);
    const ids = new Set([c.id, ...cats.filter((x) => x.parent_id === c.id).map((x) => x.id)]);
    return prods.filter((p) => ids.has(p.category_id)).length;
  };
  const N = familyCount('montre-accessoires');
  const pages = Math.ceil(N / 20);
  console.log(`info  Montre & Accessoires : ${N} articles actifs, donc ${pages} pages de 20`);

  // 1) téléphone : page 1
  const v = await visitor(b);
  const { page } = v;
  await page.goto(`${BASE}/categorie/montre-accessoires`, { waitUntil: 'load' });
  await waitCards(page);
  const p1 = await cardsOn(page);
  check('page 1 : 20 articles affichés d\'un coup (plus de zone vide)', p1.length === 20, p1.length);
  await bar(page).scrollIntoViewIfNeeded();
  const info1 = await page.getByTestId('category-pages-info').innerText();
  check(`page 1 : « Page 1 sur ${pages} · articles 1–20 sur ${N} »`, info1 === `Page 1 sur ${pages} · articles 1–20 sur ${N}`, info1);
  const b1 = await buttons(page);
  check('page 1 : boutons 1 2 3 … dernière (5 numéros au plus, tient sur un téléphone)', b1[0] === '1' && b1[1] === '2' && b1.includes(String(pages)) && b1.length <= 5, b1);
  check('page 1 : « ‹ » éteint, « › » et « Page suivante › » présents', (await page.getByTestId('category-pages-prev').getAttribute('aria-disabled')) === 'true' && (await page.getByTestId('category-pages-next-big').count()) === 1);
  const barBox = await bar(page).boundingBox();
  check('la barre tient dans la largeur du téléphone (390 px)', barBox && barBox.x >= 0 && barBox.x + barBox.width <= 390, barBox);
  // tout en bas de la liste : le bouton rond de Zara ne cache ni « › » ni « Page suivante »
  await page.getByTestId('category-list').evaluate((el) => { const sc = [el, ...el.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 50); if (sc) sc.scrollTop = sc.scrollHeight; });
  await sleep(600);
  const fab = await page.getByRole('button', { name: /Discuter avec Zara Kings/ }).boundingBox().catch(() => null);
  const nextBox = await page.getByTestId('category-pages-next').boundingBox();
  const bigBox = await page.getByTestId('category-pages-next-big').boundingBox();
  const overlap = (a, c) => !!a && !!c && a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
  check('tout en bas : le bouton de Zara ne cache ni « › » ni « Page suivante »', !overlap(fab, nextBox) && !overlap(fab, bigBox), { fab, nextBox, bigBox });
  await page.screenshot({ path: path.join(OUT, 'pages-1-bas.png') });

  // 2) « Page suivante › » : page 2, l'adresse dit ?page=2, la liste repart en haut
  await page.getByTestId('category-pages-next-big').click();
  await sleep(1200);
  const p2 = await cardsOn(page);
  check('« Page suivante » : 20 autres articles (aucun de la page 1)', p2.length === 20 && p2.every((s) => !p1.includes(s)), p2.length);
  check('l\'adresse garde la page (?page=2)', pageParam(page) === '2', page.url());
  const firstTop = await page.getByTestId('category-list').locator('[data-testid^="product-card-"]').first().boundingBox();
  check('la page 2 commence en haut (premier article visible)', firstTop && firstTop.y >= 0 && firstTop.y < 800, firstTop);

  // 3) toutes les pages une à une : chaque article une seule fois, et tous les articles de la catégorie
  const all = new Set([...p1, ...p2]);
  let lastCount = 0;
  for (let n = 3; n <= pages; n++) {
    await bar(page).scrollIntoViewIfNeeded();
    if (await page.getByTestId(`category-pages-${n}`).count()) await page.getByTestId(`category-pages-${n}`).click();
    else await page.getByTestId('category-pages-next').click();
    await sleep(1000);
    const pn = await cardsOn(page);
    pn.forEach((s) => all.add(s));
    lastCount = pn.length;
  }
  check(`toutes les pages : les ${N} articles, chacun une fois`, all.size === N, { vus: all.size, attendus: N });
  check(`dernière page : ${N - (pages - 1) * 20} articles, plus de « Page suivante », « › » éteint`, lastCount === N - (pages - 1) * 20 && (await page.getByTestId('category-pages-next-big').count()) === 0 && (await page.getByTestId('category-pages-next').getAttribute('aria-disabled')) === 'true', lastCount);
  await bar(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'pages-2-derniere.png') });

  // 4) retour en arrière depuis un article : on revient sur la même page
  // (depuis la dernière page, le bouton « 2 » est caché derrière « … » : on ouvre l'adresse de la page 2 directement, comme un lien partagé)
  await page.goto(`${BASE}/categorie/montre-accessoires?page=2`, { waitUntil: 'load' });
  await waitCards(page);
  const before = await cardsOn(page);
  check('une adresse ?page=2 ouvre directement la page 2', before.length === 20 && before.every((s) => p2.includes(s)), before.length);
  await page.getByTestId(`product-card-${before[3]}`).click();
  await page.waitForURL(/\/produit\//, { timeout: 15000 });
  await sleep(1200);
  await page.goBack();
  await waitCards(page);
  const after = await cardsOn(page);
  check('retour depuis un article de la page 2 : on revient sur la page 2', pageParam(page) === '2' && after[0] === before[0], { url: page.url(), avant: before[0], apres: after[0] });

  // 5) une recherche repart de la page 1
  await page.getByPlaceholder(/Rechercher dans/).fill('montre');
  await sleep(1200);
  check('une recherche dans la catégorie repart de la page 1', pageParam(page) === null || pageParam(page) === '1', page.url());

  // 6) une adresse avec une page absurde : la page est ramenée dans les limites
  await page.goto(`${BASE}/categorie/montre-accessoires?page=999`, { waitUntil: 'load' });
  await waitCards(page);
  await bar(page).scrollIntoViewIfNeeded();
  check('?page=999 : la dernière page', /^Page (\d+) sur \1 /.test(await page.getByTestId('category-pages-info').innerText()), await page.getByTestId('category-pages-info').innerText());
  await page.goto(`${BASE}/categorie/montre-accessoires?page=abc`, { waitUntil: 'load' });
  await waitCards(page);
  await bar(page).scrollIntoViewIfNeeded();
  check('?page=abc : la page 1', /^Page 1 sur /.test(await page.getByTestId('category-pages-info').innerText()));

  // 7) une sous-catégorie repart de la page 1
  await page.goto(`${BASE}/categorie/montre-accessoires?page=3`, { waitUntil: 'load' });
  await waitCards(page);
  const chips = await page.getByTestId('category-subchips').locator('[data-testid^="category-chip-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))).catch(() => []);
  const sub = chips.find((t) => t !== 'category-chip-all');
  if (sub) {
    await page.getByTestId(sub).click();
    await sleep(1500);
    check('une sous-catégorie repart de la page 1', pageParam(page) === null || pageParam(page) === '1', page.url());
  }
  check('téléphone : aucune écriture réelle, aucune erreur', v.writes.every((w) => /visitor_sessions|product_views|cart_events|\/rpc\//.test(w)) && v.errs.length === 0, { writes: v.writes, errs: v.errs });
  await v.ctx.close();

  // 8) une petite catégorie (tout tient sur une page) : pas de barre
  const small = cats.map((c) => c.slug).filter((s) => !cats.find((c) => c.slug === s).parent_id).find((s) => familyCount(s) >= 2 && familyCount(s) <= 20);
  if (small) {
    const w = await visitor(b);
    await w.page.goto(`${BASE}/categorie/${small}`, { waitUntil: 'load' });
    await waitCards(w.page);
    await sleep(800);
    check(`petite catégorie (${small}, ${familyCount(small)} articles) : tous montrés, pas de barre de pages`, (await cardsOn(w.page)).length === familyCount(small) && (await w.page.getByTestId('category-pages').count()) === 0);
    await w.ctx.close();
  }

  // 9) grand écran : 24 articles par page (6 lignes de 4)
  const d = await visitor(b, { desktop: true });
  await d.page.goto(`${BASE}/categorie/montre-accessoires`, { waitUntil: 'load' });
  await waitCards(d.page);
  check('grand écran : 24 articles par page', (await cardsOn(d.page)).length === Math.min(24, N));
  await d.ctx.close();

  await b.close();
  if (server) server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
