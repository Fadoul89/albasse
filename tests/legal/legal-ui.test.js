// Liste « avant le lancement » : conditions générales, bandeau cookies (pixel TikTok), page 404, textes alternatifs des images, contraste des couleurs.
// Lecture seule vers la vraie base (articles) ; Internet coupé pour tout le reste ; TikTok est simulé (on regarde seulement s'il est appelé).
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/legal/legal-ui.test.js <dossier dist> [port] [chemin axe.min.js]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const OUT = process.env.OUT || os.tmpdir(); // les photos d'écran vont ici (jamais dans le dépôt)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4455';
const AXE = process.argv[4] || '';
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, ""); // BASE_URL=https://www.albasseshopping.com : le vrai site
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = (process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xtitsmmccpkelxfjyqyh.supabase.co') + '/rest/v1';

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400));
};
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 };

(async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();

  // un visiteur : le site sans mur de connexion, sans fenêtres d'installation, TikTok et Google Translate simulés
  async function visitor({ storage = {} } = {}) {
    const ctx = await b.newContext(phone);
    await ctx.addInitScript((entries) => {
      try {
        localStorage.setItem('albasse_app_banner_dismissed', '1');
        localStorage.setItem('albasse_app_popup_seen_' + new Date().toISOString().slice(0, 10), '1');
        localStorage.setItem('albasse_zara_install', JSON.stringify({ at: Date.now(), outcome: 'dismissed' }));
        localStorage.setItem('albasse_zara_push', JSON.stringify({ at: Date.now(), outcome: 'later' }));
        localStorage.setItem('albasse_install_after_signup', '1');
        localStorage.setItem('albasse_zara_lang', 'fr');
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      } catch (e) {}
    }, storage);
    const page = await ctx.newPage();
    const tiktok = [];
    await page.route('**/*', async (route) => {
      const u = route.request().url();
      if (u.startsWith(BASE) || u.includes('.supabase.co')) {
        if (/\/rest\/v1\/store_settings/.test(u)) {
          // sans mur de connexion
          const res = await route.fetch();
          let text = await res.text();
          try {
            const data = JSON.parse(text);
            const patch = (r) => ({ ...r, account_required: false });
            text = JSON.stringify(Array.isArray(data) ? data.map(patch) : patch(data));
          } catch (e) {}
          return route.fulfill({ status: res.status(), headers: { ...res.headers(), 'content-length': String(Buffer.byteLength(text)) }, body: text });
        }
        return route.continue();
      }
      if (/tiktok/.test(u)) {
        tiktok.push(u);
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      }
      return route.abort();
    });
    return { ctx, page, tiktok };
  }
  const pageErrors = [];
  const settle = async (page, ms = 3500) => page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}).then(() => sleep(ms));
  const stored = (page) => page.evaluate(() => localStorage.getItem('albasse_cookie_consent'));
  const ttq = (page) => page.evaluate(() => typeof window.ttq !== 'undefined' && !!window.ttq);

  // ---------- 1) bandeau cookies : rien n'est envoyé à TikTok avant l'accord ----------
  {
    const v = await visitor();
    v.page.on('pageerror', (e) => pageErrors.push(e.message));
    await v.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await settle(v.page);
    check('cookies : le bandeau apparaît pour un nouveau visiteur', (await v.page.getByTestId('cookie-banner').count()) === 1);
    const text = await v.page.getByTestId('cookie-banner').innerText();
    check('cookies : texte clair, boutons Accepter / Refuser / En savoir plus', /pixel TikTok/.test(text) && /Accepter/.test(text) && /Refuser/.test(text) && /En savoir plus/.test(text), text);
    check('cookies : AVANT le choix, TikTok n\'est pas chargé et rien n\'est envoyé', !(await ttq(v.page)) && v.tiktok.length === 0, v.tiktok);
    check('cookies : AVANT le choix, rien n\'est mémorisé', (await stored(v.page)) === null);
    await v.page.screenshot({ path: path.join(OUT, 'cookie-banner.png') }).catch(() => {});

    await v.page.getByTestId('cookie-refuse').click();
    await sleep(500);
    check('cookies : « Refuser » ferme le bandeau et mémorise le refus', (await v.page.getByTestId('cookie-banner').count()) === 0 && (await stored(v.page)) === 'refused');
    await v.page.reload({ waitUntil: 'domcontentloaded' });
    await settle(v.page);
    check('cookies : après un refus, le bandeau ne revient pas et TikTok n\'est jamais appelé', (await v.page.getByTestId('cookie-banner').count()) === 0 && !(await ttq(v.page)) && v.tiktok.length === 0, v.tiktok);
    await v.ctx.close();
  }
  {
    const v = await visitor();
    await v.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await settle(v.page);
    await v.page.getByTestId('cookie-accept').click();
    await settle(v.page, 1500);
    check('cookies : « Accepter » ferme le bandeau, mémorise, charge le pixel TikTok', (await v.page.getByTestId('cookie-banner').count()) === 0 && (await stored(v.page)) === 'accepted' && (await ttq(v.page)) && v.tiktok.length >= 1, { tiktok: v.tiktok.length });
    await v.page.reload({ waitUntil: 'domcontentloaded' });
    await settle(v.page);
    check('cookies : après un accord, le pixel se recharge tout seul (sans bandeau)', (await v.page.getByTestId('cookie-banner').count()) === 0 && (await ttq(v.page)), v.tiktok.length);

    // changer d'avis depuis la politique de confidentialité
    await v.page.goto(BASE + '/confidentialite', { waitUntil: 'domcontentloaded' });
    await settle(v.page, 2000);
    const choice = v.page.getByTestId('privacy-cookie-choice');
    check('confidentialité : la section « 5. Cookies et mesure publicitaire » dit l\'état du choix', (await v.page.getByText('5. Cookies et mesure publicitaire').count()) === 1 && /accepté/.test(await choice.innerText()), await choice.innerText().catch(() => ''));
    await v.page.getByTestId('privacy-cookie-change').click();
    await sleep(500);
    check('confidentialité : « Refuser » depuis la politique mémorise le refus', (await stored(v.page)) === 'refused' && /refusé/.test(await choice.innerText()));
    const before = v.tiktok.length;
    await v.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await settle(v.page);
    check('confidentialité : après le refus, plus de pixel au rechargement', !(await ttq(v.page)) && v.tiktok.length === before, { avant: before, apres: v.tiktok.length });
    await v.ctx.close();
  }
  {
    // un visiteur qui avait déjà accepté AVANT (ancien visiteur sans choix mémorisé) : pas de pixel tant qu'il n'a pas choisi
    const v = await visitor();
    await v.page.goto(BASE + '/produit', { waitUntil: 'domcontentloaded' });
    await settle(v.page);
    check('cookies : bandeau aussi sur les autres pages, toujours sans TikTok', (await v.page.getByTestId('cookie-banner').count()) === 1 && v.tiktok.length === 0);
    await v.page.getByTestId('cookie-more').click();
    await sleep(1500);
    check('cookies : « En savoir plus » ouvre la politique de confidentialité', /confidentialite/.test(v.page.url()), v.page.url());
    await v.ctx.close();
  }

  // ---------- 2) conditions générales ----------
  {
    const v = await visitor({ storage: { albasse_cookie_consent: 'refused' } });
    await v.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await settle(v.page);
    await v.page.getByTestId('footer-legal-links').scrollIntoViewIfNeeded().catch(() => {});
    const links = await v.page.getByTestId('footer-legal-links').innerText().catch(() => '');
    check('pied de page : liens Conditions générales, Conditions de retour, Confidentialité, Contact', /Conditions générales/.test(links) && /Conditions de retour/.test(links) && /Confidentialité/.test(links) && /Contact/.test(links), links);
    await v.page.getByTestId('footer-terms').click();
    await sleep(1500);
    check('conditions générales : le lien du pied de page ouvre /conditions-generales', v.page.url().endsWith('/conditions-generales'), v.page.url());
    const body = await v.page.getByTestId('terms-screen').innerText().catch(() => '');
    check('conditions générales : les 9 parties et les vraies règles (48 heures, 8h30 à 16h, 72 heures, 2 000 FCFA)', [1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => body.includes(`${n}. `)) && /48 heures/.test(body) && /8h30 à 16h/.test(body) && /72 heures/.test(body) && /2 000 FCFA/.test(body), body.slice(0, 200));
    await v.page.screenshot({ path: path.join(OUT, 'conditions-generales.png'), fullPage: false }).catch(() => {});
    // direct par l'adresse, sans connexion
    await v.page.goto(BASE + '/conditions-generales', { waitUntil: 'domcontentloaded' });
    await settle(v.page, 2000);
    check('conditions générales : la page s\'ouvre directement par son adresse', (await v.page.getByTestId('terms-screen').count()) === 1);
    await v.ctx.close();
  }

  // ---------- 3) page 404 ----------
  {
    const v = await visitor({ storage: { albasse_cookie_consent: 'refused' } });
    await v.page.goto(BASE + '/cette-page-nexiste-pas', { waitUntil: 'domcontentloaded' });
    await settle(v.page);
    check('404 : une adresse inconnue affiche « Page introuvable » (pas l\'accueil)', (await v.page.getByTestId('not-found-screen').count()) === 1 && /Page introuvable/.test(await v.page.getByTestId('not-found-screen').innerText()));
    await v.page.screenshot({ path: path.join(OUT, 'page-404.png') }).catch(() => {});
    await v.page.getByTestId('not-found-home').click();
    await sleep(1800);
    check('404 : « Retour à l\'accueil » ramène sur le site', new URL(v.page.url()).pathname === '/' && (await v.page.getByTestId('not-found-screen').count()) === 0, v.page.url());
    for (const p of ['/contact', '/conditions-de-retour', '/confidentialite', '/recherche']) {
      await v.page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      await settle(v.page, 2000);
      check(`404 : ${p} n'est PAS une page introuvable`, (await v.page.getByTestId('not-found-screen').count()) === 0);
    }
    await v.ctx.close();
  }

  // ---------- 4) textes alternatifs + 5) contraste (outil d'accessibilité axe) ----------
  {
    const rows = KEY ? await (await fetch(`${REST}/products?select=slug&is_active=eq.true&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json().catch(() => []) : [];
    const slug = (rows[0] || {}).slug;
    const cats = KEY ? await (await fetch(`${REST}/categories?select=slug&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json().catch(() => []) : [];
    const cat = (cats[0] || {}).slug;
    const pages = [['accueil', '/'], ['recherche', '/recherche'], ['confidentialité', '/confidentialite'], ['conditions générales', '/conditions-generales'], ['conditions de retour', '/conditions-de-retour'], ['page 404', '/introuvable-xyz']];
    if (slug) pages.push(['fiche article', `/produit/${slug}`]);
    if (cat) pages.push(['catégorie', `/categorie/${cat}`]);
    for (const withBanner of [true, false]) {
      const v = await visitor({ storage: withBanner ? {} : { albasse_cookie_consent: 'refused' } });
      for (const [name, p] of pages) {
        if (withBanner && !['accueil', 'fiche article'].includes(name)) continue; // le bandeau seulement sur 2 pages : c'est le même composant partout
        await v.page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
        await settle(v.page, 4000);
        const imgs = await v.page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => !i.closest('[aria-hidden="true"]')).map((i) => ({ alt: i.getAttribute('alt'), src: (i.currentSrc || i.src || '').slice(-50) })));
        const noAlt = imgs.filter((i) => i.alt === null);
        check(`alt (${name}${withBanner ? ' + bandeau' : ''}) : ${imgs.length} images, aucune sans attribut alt`, noAlt.length === 0, noAlt.slice(0, 3));
        if (AXE) {
          await v.page.addScriptTag({ content: fs.readFileSync(AXE, 'utf8') });
          const res = await v.page.evaluate(async () => {
            const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast', 'image-alt'] } });
            return r.violations.map((x) => ({ id: x.id, n: x.nodes.length, ex: x.nodes.slice(0, 40).map((n) => ({ t: (n.html || '').slice(0, 90), m: ((n.any && n.any[0]) || {}).message || '' })) }));
          });
          const contrast = res.find((r) => r.id === 'color-contrast');
          if (contrast && process.env.DETAIL) {
            for (const n of contrast.ex) console.log('   contraste', name, '|', n.t.replace(/class="[^"]*"/, '').slice(0, 70), '|', (n.m.match(/contrast of ([\d.]+) \(foreground color: (#\w+), background color: (#\w+), font size: ([\d.]+pt)/) || []).slice(1).join(' '));
          }
          const imageAlt = res.find((r) => r.id === 'image-alt');
          check(`contraste (${name}${withBanner ? ' + bandeau' : ''}) : aucun texte sous 4.5:1`, !contrast, contrast);
          check(`image-alt axe (${name}${withBanner ? ' + bandeau' : ''}) : aucune image sans texte`, !imageAlt, imageAlt);
        }
      }
      await v.ctx.close();
    }
  }

  check('aucune erreur JavaScript dans la page', pageErrors.length === 0, pageErrors.slice(0, 3));
  await b.close();
  server.kill();
  console.log(ok ? '\nTOUT EST BON' : '\nAVEC DES ECHECS');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('ERREUR', e);
  process.exit(2);
});
