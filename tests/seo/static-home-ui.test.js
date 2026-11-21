// Page de secours lisible sans JavaScript, dans le navigateur, sur le site fabriqué :
//   • sans JavaScript (robot qui ne lance pas l'application) : titre, titre principal, texte et liens visibles ;
//   • avec JavaScript (vrai visiteur) : l'application remplace la page de secours (jamais les deux à l'écran).
// Usage : NODE_PATH=/opt/node-tools/node_modules node tests/seo/static-home-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4631';
const OUT = process.argv[4] || os.tmpdir();
const BASE = `http://localhost:${port}`;

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};

(async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    // 1) sans JavaScript
    {
      const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'load' });
      const r = await page.evaluate(() => ({
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
        words: (document.body.innerText || '').split(/\s+/).filter(Boolean).length,
        links: [...document.querySelectorAll('#seo-static a')].map((a) => a.getAttribute('href')),
        visible: !!document.querySelector('#seo-static') && document.querySelector('#seo-static').getBoundingClientRect().height > 100,
      }));
      check('sans JavaScript : titre de la page « Albasse Shopping – Boutique en ligne au Tchad »', r.title === 'Albasse Shopping – Boutique en ligne au Tchad', r.title);
      check('sans JavaScript : un titre principal (h1)', r.h1.length === 1 && r.h1[0] === 'Albasse Shopping : boutique en ligne au Tchad', r.h1);
      check('sans JavaScript : du texte lisible (au moins 50 mots, avant : 0)', r.words >= 50, r.words);
      check('sans JavaScript : liens vers les articles, la recherche, le contact', ['/categorie/tous', '/recherche', '/contact'].every((l) => r.links.includes(l)), r.links);
      check('sans JavaScript : la page de secours est bien visible', r.visible);
      await page.screenshot({ path: path.join(OUT, 'sans-javascript.png') });
      await ctx.close();
    }
    // 2) avec JavaScript : l'application remplace la page de secours
    {
      const ctx = await b.newContext({ viewport: { width: 412, height: 860 } });
      await ctx.addInitScript(() => { try { const d = new Date().toISOString().slice(0, 10); for (const [k, v] of Object.entries({ albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + d]: '1', albasse_install_after_signup: '1' })) localStorage.setItem(k, v); } catch (e) {} });
      await ctx.route('**/rest/v1/visitor_sessions*', (r) => r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' }));
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(`${BASE}/`, { waitUntil: 'load' });
      await page.locator('[data-testid="menu-button"]:visible').first().waitFor({ timeout: 30000 });
      await sleep(800);
      check('avec JavaScript : l\'application est là et la page de secours a disparu (jamais les deux)', (await page.locator('#seo-static').count()) === 0 && (await page.getByText('Albasse Shopping : boutique en ligne au Tchad', { exact: true }).count()) === 0);
      await page.goto(`${BASE}/categorie/chaussures`, { waitUntil: 'load' });
      await page.locator('[data-testid="category-list"]').waitFor({ timeout: 30000 });
      check('avec JavaScript, page d\'une catégorie : pas de page de secours', (await page.locator('#seo-static').count()) === 0);
      check('aucune erreur de page', errs.length === 0, errs);
      await ctx.close();
    }
  } finally {
    await b.close();
    server.kill();
  }
  console.log(ok ? '\nTOUS LES CONTROLES REUSSIS' : '\nIL Y A DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
