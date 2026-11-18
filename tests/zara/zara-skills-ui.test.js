// Compétences de Zara (photo → article, mémoire du client) dans le navigateur, sur le site fabriqué (expo export).
// Supabase : articles et catégories VRAIS (lecture seule). Simulés : la fonction zara-ai (jamais la vraie IA), la table zara_memory,
// le compte du client. Toute autre écriture est bloquée.
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/zara/zara-skills-ui.test.js <dossier dist> <photo.jpg> [port] [dossier des captures]
// <photo.jpg> : une grande photo JPEG (plus de 1024 px) d'une chaussure, par exemple.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const PHOTO = process.argv[3];
const port = process.argv[4] || '4580';
const OUT = process.argv[5] || os.tmpdir();
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = 'https://xtitsmmccpkelxfjyqyh.supabase.co/rest/v1';
const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
const UID = '11111111-1111-4111-8111-111111111111';

let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300));
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// largeur et hauteur d'un JPEG (marqueur SOF)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

// un visiteur (member : client connecté). memory : notes de la table simulée ; 'absent' = table pas installée. ai(body) : réponse de zara-ai.
async function visitor(b, { member = false, memory = [], ai }) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1', session_id: 's1' })}.c2ln`;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'client@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
  const profile = { id: UID, email: 'client@example.com', full_name: 'Moussa Abakar', phone: '66123456', banned: false, is_admin: false, loyalty_points: 12, client_number: 884, avatar_url: null, created_at: '2026-01-01T00:00:00Z' };
  const state = { ai: [], aiAuth: [], memoryGets: 0, memoryDeletes: [], writes: [], notes: memory === 'absent' ? null : [...memory] };
  await ctx.addInitScript(([sk, s, isMember]) => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const seed = { albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', ['albasse_app_popup_seen_' + day]: '1', albasse_install_after_signup: '1', albasse_remember_login: '1', albasse_zara_lang: 'fr', albasse_zara_name: 'Moussa' };
      seed.albasse_zara_install = JSON.stringify({ at: Date.now(), outcome: 'dismissed' });
      seed.albasse_zara_push = JSON.stringify({ at: Date.now(), outcome: 'later' });
      for (const [k, v] of Object.entries(seed)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
      if (isMember) localStorage.setItem(sk, s);
    } catch (e) {}
  }, [SK, JSON.stringify(session), member]);
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (u.hostname === 'localhost') return route.continue();
    if (!u.hostname.endsWith('.supabase.co')) return route.abort();
    if (m === 'OPTIONS') return json(route, {});
    if (u.pathname === '/functions/v1/zara-ai' && m === 'POST') {
      const body = JSON.parse(r.postData() || '{}');
      state.ai.push(body);
      state.aiAuth.push(r.headers()['authorization'] || '');
      return json(route, ai(body, state));
    }
    if (u.pathname === '/rest/v1/zara_memory') {
      if (state.notes === null) return json(route, { code: 'PGRST205', message: "Could not find the table 'public.zara_memory' in the schema cache" }, 404);
      if (m === 'GET') {
        state.memoryGets++;
        const one = (r.headers()['accept'] || '').includes('vnd.pgrst.object');
        const rows = state.notes.length ? [{ notes: state.notes }] : [];
        return one ? (rows.length ? json(route, rows[0]) : json(route, { code: 'PGRST116' }, 406)) : json(route, rows);
      }
      if (m === 'DELETE') {
        state.memoryDeletes.push(u.search);
        state.notes = [];
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
      }
    }
    if (u.pathname === '/auth/v1/user') return member ? json(route, user) : json(route, { message: 'no user' }, 401);
    if (u.pathname === '/auth/v1/token') return json(route, session);
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') {
      const one = (r.headers()['accept'] || '').includes('vnd.pgrst.object');
      return json(route, one ? profile : [profile]);
    }
    // la fenêtre « offre pour vous » des promotions intelligentes couvrirait le chat : aucune pour ce test
    if (u.pathname === '/rest/v1/smart_promotions' && m === 'GET') return (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? json(route, { code: 'PGRST116' }, 406) : json(route, []);
    if (u.pathname === '/rest/v1/store_settings') {
      // les vrais réglages, compte obligatoire « éteint » pour ce test
      const res = await route.fetch({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } }).catch(() => null);
      if (!res) return route.abort();
      const body = await res.json();
      const fix = (row) => ({ ...row, account_required: false });
      return route.fulfill({ response: res, body: JSON.stringify(Array.isArray(body) ? body.map(fix) : fix(body)) });
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

const openZara = async (page) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('assistant-fab').first().waitFor({ timeout: 40000 });
  await sleep(1200);
  await page.getByTestId('assistant-fab').first().click();
  await page.getByTestId('assistant-panel').waitFor({ timeout: 10000 });
  // l'accueil de Zara est fini quand les trois points disparaissent
  for (let i = 0; i < 60; i++) {
    if ((await page.getByTestId('assistant-typing').count()) === 0 && (await page.locator('[data-testid="assistant-panel"] >> text=/Bienvenue|Bon retour|Salut/').count()) > 0) break;
    await sleep(250);
  }
  await sleep(600);
};
const waitIdle = async (page, maxMs = 20000) => {
  const t0 = Date.now();
  await sleep(300);
  while (Date.now() - t0 < maxMs) {
    if ((await page.getByTestId('assistant-typing').count()) === 0) return true;
    await sleep(200);
  }
  return false;
};
const panelText = (page) => page.getByTestId('assistant-panel').innerText();

(async () => {
  if (!KEY || !PHOTO || !fs.existsSync(PHOTO)) {
    console.log('Usage : SUPABASE_ANON_KEY=… node tests/zara/zara-skills-ui.test.js <dist> <photo.jpg> [port] [captures]');
    process.exit(2);
  }
  const big = jpegSize(fs.readFileSync(PHOTO));
  console.log('photo de test :', big);
  // deux vraies chaussures de la boutique (lecture seule)
  const shoes = await (await fetch(`${REST}/products?select=id,name&is_active=eq.true&stock=gt.0&name=ilike.*chaussure*&limit=2`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
  check('deux vraies chaussures trouvées pour la réponse simulée', Array.isArray(shoes) && shoes.length === 2, shoes);
  const server = process.env.BASE_URL ? null : spawn('node', [path.join(__dirname, 'serve.js'), path.resolve(dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    // ---------------- A. visiteur sans compte : photo + petit texte → articles qui ressemblent
    {
      const v = await visitor(b, {
        ai: (body) => (body.photo ? { ok: true, text: 'Je vois des chaussures pour homme 👟 Voici celles qui ressemblent le plus :', productIds: shoes.map((s) => s.id), memory: null } : { ok: false, reason: 'no_key' }),
      });
      await openZara(v.page);
      const cam = v.page.getByTestId('assistant-photo-button');
      check('A. bouton 📷 dans la barre du chat, avec « NOUVEAU »', (await cam.count()) === 1 && (await v.page.getByTestId('assistant-photo-new').count()) === 1);
      check('A. bouton 📷 : nom pour les lecteurs d\'écran', (await cam.getAttribute('aria-label')) === 'Envoyer une photo à Zara');
      check('A. visiteur sans compte : pas de « Zara se souvient de vous »', (await v.page.getByTestId('assistant-memory').count()) === 0 && v.state.memoryGets === 0);
      await v.page.getByRole('textbox').last().fill('Vous avez ça ?');
      const [chooser] = await Promise.all([v.page.waitForEvent('filechooser', { timeout: 8000 }), cam.click()]);
      await chooser.setFiles(PHOTO);
      await v.page.getByTestId('assistant-my-photo').waitFor({ timeout: 15000 });
      await waitIdle(v.page);
      await sleep(800);
      const sent = v.state.ai[0] || {};
      const img = sent.photo ? Buffer.from(sent.photo.data, 'base64') : null;
      const size = img ? jpegSize(img) : null;
      check('A. la photo part à Zara IA en JPEG (base64 seul)', sent.photo && sent.photo.mediaType === 'image/jpeg' && /^\/9j\//.test(sent.photo.data), sent.photo && sent.photo.data.slice(0, 20));
      check('A. la photo est réduite sur le téléphone (1024 px au plus)', size && Math.max(size.width, size.height) <= 1024 && Math.max(size.width, size.height) >= 1000, { avant: big, apres: size });
      check('A. … et reste légère (moins de 400 Ko)', img && img.length < 400000, img && img.length);
      check('A. le texte écrit avant part avec la photo, et la boîte se vide', sent.message === 'Vous avez ça ?' && (await v.page.getByRole('textbox').last().inputValue()) === '', sent.message);
      check('A. visiteur : la fonction reçoit la clé publique, pas un jeton de client', !/\.c2ln$/.test(v.state.aiAuth[0] || ''));
      const text = await panelText(v.page);
      check('A. la photo et le texte du client sont dans sa bulle', (await v.page.getByTestId('assistant-my-photo').count()) === 1 && text.includes('Vous avez ça ?'));
      check('A. Zara répond et montre les 2 articles', text.includes('Je vois des chaussures pour homme') && (await v.page.getByTestId('assistant-card').count()) >= 2, text.slice(-300));
      check('A. « NOUVEAU » disparaît après la première photo (retenu sur l\'appareil)', (await v.page.getByTestId('assistant-photo-new').count()) === 0 && (await v.page.evaluate(() => localStorage.getItem('albasse_zara_photo_seen'))) === '1');
      await v.page.screenshot({ path: path.join(OUT, 'zara-photo-article.png') });
      // une 2e photo : l'historique dit « (photo envoyée) » pour la première
      v.state.ai.length = 0;
      const [chooser2] = await Promise.all([v.page.waitForEvent('filechooser', { timeout: 8000 }), v.page.getByTestId('assistant-photo-button').click()]);
      await chooser2.setFiles(PHOTO);
      await waitIdle(v.page);
      await sleep(500);
      const second = v.state.ai[0] || {};
      check('A. 2e photo sans texte : message par défaut, et la 1re photo comptée dans l\'historique', /photo/i.test(second.message || '') && (second.history || []).some((h) => h.role === 'user' && /Vous avez ça|photo envoyée/.test(h.text)), { message: second.message, history: second.history });
      check('A. aucune erreur de page, aucune écriture', v.errs.length === 0 && v.state.writes.length === 0, { errs: v.errs, writes: v.state.writes });
      await v.ctx.close();
    }

    // ---------------- B. limite des 5 photos, photo illisible
    {
      const v = await visitor(b, { ai: () => ({ ok: false, reason: 'photo_limit' }) });
      await openZara(v.page);
      const [chooser] = await Promise.all([v.page.waitForEvent('filechooser', { timeout: 8000 }), v.page.getByTestId('assistant-photo-button').click()]);
      await chooser.setFiles(PHOTO);
      await waitIdle(v.page);
      await sleep(500);
      check('B. 6e photo du jour : Zara explique la limite et propose de décrire l\'article', (await panelText(v.page)).includes('déjà envoyé 5 photos aujourd’hui'));
      const fake = path.join(os.tmpdir(), 'pas-une-photo.jpg');
      fs.writeFileSync(fake, 'ceci n\'est pas une image');
      const before = v.state.ai.length;
      const [chooser2] = await Promise.all([v.page.waitForEvent('filechooser', { timeout: 8000 }), v.page.getByTestId('assistant-photo-button').click()]);
      await chooser2.setFiles(fake);
      await waitIdle(v.page);
      await sleep(500);
      check('B. fichier qui n\'est pas une photo : Zara le dit, rien n\'est envoyé', (await panelText(v.page)).includes('n’arrive pas à ouvrir cette photo') && v.state.ai.length === before);
      check('B. aucune erreur de page', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // ---------------- C. client connecté avec une mémoire : voir, mise à jour, tout oublier
    {
      const v = await visitor(b, {
        member: true,
        memory: ['pointure 42', 'budget parfum : environ 20 000 FCFA'],
        ai: (body, state) => {
          state.notes = ['pointure 42', 'budget parfum : environ 20 000 FCFA', 'aime le noir'];
          return { ok: true, text: 'Noté : vous aimez le noir. Voici des modèles :', productIds: shoes.map((s) => s.id), memory: state.notes };
        },
      });
      await openZara(v.page);
      await v.page.getByTestId('assistant-memory').waitFor({ timeout: 10000 }).catch(() => {});
      check('C. client connecté : « 🧠 Zara se souvient de vous · Tout oublier »', (await v.page.getByTestId('assistant-memory').count()) === 1 && (await v.page.getByTestId('assistant-memory').innerText()).includes('Zara se souvient de vous') && (await v.page.getByTestId('assistant-memory-forget').innerText()) === 'Tout oublier');
      await v.page.screenshot({ path: path.join(OUT, 'zara-memoire-barre.png') });
      await v.page.getByTestId('assistant-memory-show').click();
      await waitIdle(v.page);
      await sleep(400);
      const shown = await panelText(v.page);
      check('C. toucher « Zara se souvient de vous » : Zara montre ses notes', shown.includes('Voici ce que je retiens de vous') && shown.includes('• pointure 42') && shown.includes('• budget parfum : environ 20 000 FCFA'));
      await v.page.getByRole('textbox').last().fill('je cherche des chaussures noires');
      await v.page.getByRole('textbox').last().press('Enter');
      await waitIdle(v.page);
      await sleep(600);
      check('C. le message part avec le jeton du client (pour sa mémoire)', /\.c2ln$/.test(v.state.aiAuth[v.state.aiAuth.length - 1] || ''), v.state.aiAuth);
      check('C. la réponse de Zara s\'affiche avec les articles', (await panelText(v.page)).includes('Noté : vous aimez le noir') && (await v.page.getByTestId('assistant-card').count()) >= 2);
      await v.page.getByTestId('assistant-memory-show').click();
      await waitIdle(v.page);
      await sleep(400);
      check('C. la mémoire mise à jour par Zara est montrée', (await panelText(v.page)).includes('• aime le noir'));
      await v.page.getByTestId('assistant-memory-forget').click();
      await waitIdle(v.page);
      await sleep(500);
      const after = await panelText(v.page);
      check('C. « Tout oublier » efface les notes de CE client', v.state.memoryDeletes.length === 1 && v.state.memoryDeletes[0].includes(`user_id=eq.${UID}`), v.state.memoryDeletes);
      check('C. … Zara confirme et la barre disparaît', after.includes('j’ai tout oublié') && (await v.page.getByTestId('assistant-memory').count()) === 0);
      await v.page.screenshot({ path: path.join(OUT, 'zara-memoire-oubliee.png') });
      check('C. aucune erreur de page, aucune autre écriture', v.errs.length === 0 && v.state.writes.length === 0, { errs: v.errs, writes: v.state.writes });
      await v.ctx.close();
    }

    // ---------------- D. client connecté, mémoire pas encore installée : rien ne change
    {
      const v = await visitor(b, { member: true, memory: 'absent', ai: () => ({ ok: true, text: 'Bonjour Moussa !', productIds: [], memory: null }) });
      await openZara(v.page);
      await sleep(1500);
      check('D. table pas installée : pas de barre mémoire, le chat marche', (await v.page.getByTestId('assistant-memory').count()) === 0 && (await v.page.getByTestId('assistant-photo-button').count()) === 1);
      check('D. aucune erreur de page', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  } finally {
    await b.close();
    if (server) server.kill();
  }
  console.log(ok ? '\nTOUT EST OK' : '\nDES ÉCHECS');
  process.exit(ok ? 0 : 1);
})();
