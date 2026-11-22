// Programme d'affiliation (22 novembre 2026), dans le navigateur, sur le site fabriqué (expo export) :
//   A. espace affilié : les chiffres viennent de la fonction sûre de la base (affiliate_my_stats) : visiteurs, ventes, chiffre
//      d'affaires, commissions (annulées à part), « Commande N° 101 » ; « Mes produits » : vues, commandes, commission par article ;
//   B. si le script de la base n'est pas encore lancé (fonction absente) : l'ancienne lecture, sans erreur ;
//   C. un lien ?ref= tapé en minuscules ou avec des espaces : le code est enregistré en MAJUSCULES (la vente sera bien comptée) ;
//   D. candidature : un code déjà pris → un autre code est tiré, la candidature passe ; une autre erreur → message en français ;
//   E. l'affilié touche « Déjà payé » : l'historique de ses paiements (un paiement = les commissions payées le même jour) ;
//   F. l'administrateur touche « Déjà payé » sur la fiche d'un affilié : ses paiements, avec l'heure et ce qu'il reste à payer ;
//   G. « Mes produits » › 📥 Photos : les vraies photos de l'article enregistrées, signées (drapeau du Tchad + albasseshopping.com).
// Le compte affilié et les réponses de la base sont SIMULÉS ; les articles sont lus dans la VRAIE base (lecture seule) ; toute écriture est bloquée.
// Usage : SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/shop/affiliate-ui.test.js <dossier dist> [port] [dossier des photos]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4611';
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
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'affilie@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const session = { access_token: jwt, refresh_token: 'x', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
const AFFILIATE = { id: UID, email: 'affilie@example.com', full_name: 'Aminata Hassan', phone: '66123456', banned: false, is_admin: false, role: 'customer', is_affiliate: true, affiliate_status: 'approved', referral_code: 'AMIN123', affiliate_mobile_money: '66123456', loyalty_points: 0, created_at: '2026-01-01T00:00:00Z' };
const CUSTOMER = { ...AFFILIATE, full_name: 'Aïcha Mahamat', is_affiliate: false, affiliate_status: null, referral_code: null };

const norm = (s) => s.replace(/[  ]/g, ' ');
const SEED = {
  albasse_cookie_consent: 'refused', albasse_app_banner_dismissed: '1', albasse_install_after_signup: '1', albasse_remember_login: '1',
  albasse_assistant_teaser_seen: '1', albasse_assistant_teaser_member_seen: '1',
};

// un navigateur : connecté (profil donné) ou anonyme ; `rpc` décide de la réponse de affiliate_my_stats ; `patch` celle des mises à jour du profil
async function visitor(b, { profile, rpc, patch, extra, blockPhotos }) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 1400 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([seed, s]) => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      const all = { ...seed, ['albasse_app_popup_seen_' + d]: '1', albasse_zara_install: JSON.stringify({ at: Date.now(), outcome: 'dismissed' }), albasse_zara_push: JSON.stringify({ at: Date.now(), outcome: 'later' }) };
      for (const [k, v] of Object.entries(all)) localStorage.setItem(k, v);
      if (s && !sessionStorage.getItem('__s')) { localStorage.setItem('sb-xtitsmmccpkelxfjyqyh-auth-token', s); sessionStorage.setItem('__s', '1'); }
    } catch (e) {}
  }, [SEED, profile ? JSON.stringify(session) : null]);
  const log = { rpc: 0, legacy: [], writes: [], sessions: [], patches: [], products: [] };
  const json = (route, body, status = 200, extra = {}) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: JSON.stringify(body) });
  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const m = r.method();
    if (!u.hostname.endsWith('.supabase.co')) return route.continue();
    if (m === 'OPTIONS') return json(route, {});
    if (blockPhotos && u.pathname.startsWith('/storage/')) return route.abort();
    if (u.pathname === '/auth/v1/user') return profile ? json(route, user) : json(route, { message: 'no' }, 401);
    if (u.pathname === '/auth/v1/token') return profile ? json(route, session) : json(route, { message: 'no' }, 400);
    if (extra) {
      const res = extra(u, m, r);
      if (res) return json(route, res.body, res.status ?? 200, res.headers ?? {});
    }
    if (u.pathname === '/rest/v1/profiles' && m === 'GET') return json(route, (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? profile : [profile]);
    if (u.pathname === '/rest/v1/profiles' && m === 'PATCH') {
      const body = r.postDataJSON();
      log.patches.push(body);
      const res = patch ? patch(body, log.patches.length) : { status: 204 };
      return res.status === 204 ? route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' }) : json(route, res.body, res.status);
    }
    if (u.pathname === '/rest/v1/rpc/affiliate_my_stats') {
      log.rpc++;
      const res = rpc(log.products);
      return json(route, res.body, res.status);
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    if (u.pathname === '/rest/v1/visitor_sessions' && m === 'POST') {
      log.sessions.push(r.postDataJSON());
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    // l'ancienne lecture (réservée à l'administrateur dans la vraie base : simulée ici pour le cas B)
    if (u.pathname === '/rest/v1/visitor_sessions' && profile) {
      log.legacy.push(m + ' visitor_sessions');
      if (m === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '0-36/37' }, body: '' });
      return json(route, Array.from({ length: 37 }, (_, i) => ({ id: 's' + i })));
    }
    if (u.pathname === '/rest/v1/affiliate_commissions') {
      log.legacy.push('affiliate_commissions');
      return json(route, [{ id: 'c1', affiliate_id: UID, order_id: 'o1aaaaaaaa-1', amount: 2500, status: 'validated', paid: false, paid_at: null, created_at: '2026-11-20T10:00:00Z', orders: { total: 50000 } }]);
    }
    if (u.pathname === '/rest/v1/product_views' && m === 'GET') { log.legacy.push('product_views'); return json(route, log.products.length ? Array(4).fill({ product_id: log.products[0] }) : []); }
    if (u.pathname === '/rest/v1/affiliate_commission_items') { log.legacy.push('affiliate_commission_items'); return json(route, []); }
    if (u.pathname === '/rest/v1/smart_promotions') return json(route, []);
    if (!['GET', 'HEAD'].includes(m)) {
      if (!/product_views|rpc\//.test(u.pathname)) log.writes.push(m + ' ' + u.pathname);
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (u.pathname === '/rest/v1/products') {
      // les vrais articles (lecture seule) : on retient les 1ers pour bâtir la réponse simulée de la base
      try {
        const res = await route.fetch({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } });
        const body = await res.text();
        try { const arr = JSON.parse(body); if (Array.isArray(arr) && !log.products.length) log.products.push(...arr.filter((p) => p && p.id && p.is_active !== false).slice(0, 3).map((p) => p.id)); } catch (e) {}
        return await route.fulfill({ response: res, body });
      } catch (e) {
        return route.abort().catch(() => {}); // page fermée pendant la lecture
      }
    }
    if (u.pathname.startsWith('/rest/v1/')) return route.continue({ headers: { ...r.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } });
    return route.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, log, errs };
}

// la réponse de affiliate_my_stats() : 3 visiteurs ; 4 commissions (une annulée) ; par article
const STATS = (prods) => ({
  status: 200,
  body: {
    visitors: 3,
    sessions: 4,
    commissions: [
      { id: 'c1', order_id: '11111111-aaaa-4000-8000-000000000001', order_number: 101, order_total: 40000, amount: 2500, status: 'validated', paid: false, paid_at: null, created_at: '2026-11-21T10:00:00Z' },
      { id: 'c2', order_id: '11111111-aaaa-4000-8000-000000000002', order_number: 105, order_total: 22000, amount: 1100, status: 'pending', paid: false, paid_at: null, created_at: '2026-11-20T10:00:00Z' },
      { id: 'c3', order_id: '11111111-aaaa-4000-8000-000000000003', order_number: 108, order_total: 40000, amount: 2500, status: 'cancelled', paid: false, paid_at: null, created_at: '2026-11-19T10:00:00Z' },
      { id: 'c4', order_id: '11111111-aaaa-4000-8000-000000000004', order_number: 96, order_total: 18000, amount: 900, status: 'validated', paid: true, paid_at: '2026-11-15T10:00:00Z', created_at: '2026-11-12T09:00:00Z' },
    ],
    products: prods.length >= 2 ? [
      { product_id: prods[0], views: 14, orders: 2, commission: 3600 },
      { product_id: prods[1], views: 9, orders: 0, commission: 0 },
    ] : [],
  },
});

(async () => {
  if (!KEY) throw new Error('SUPABASE_ANON_KEY manquant');
  const server = spawn('node', [path.join(__dirname, '..', 'zara', 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();
  try {
    // A. la fonction sûre de la base est en place
    {
      const v = await visitor(b, { profile: AFFILIATE, rpc: STATS });
      await v.page.goto(`${BASE}/espace-affilie`, { waitUntil: 'load' });
      await v.page.getByText('Commande N° 101').first().waitFor({ timeout: 30000 });
      await sleep(800);
      const t = norm(await v.page.evaluate(() => document.body.innerText));
      check('A. espace affilié : « Visiteurs envoyés » = 3 (avant : toujours 0)', /\b3\s*\n?\s*Visiteurs envoyés/.test(t), t.slice(0, 600));
      check('A. ventes = 3 (la commande annulée ne compte pas)', /\b3\s*\n?\s*Ventes/.test(t));
      check('A. chiffre d\'affaires généré = 80 000 FCFA (40 000 + 22 000 + 18 000 ; avant : toujours 0)', /80 000\s*FCFA\s*\n?\s*Chiffre d'affaires généré/.test(t), t.match(/[\d ]+FCFA\s*\n?\s*Chiffre[^\n]*/)?.[0]);
      check('A. commission en attente 1 100, validée 2 500, déjà payée 900', /1 100\s*FCFA\s*\n?\s*Commission en attente/.test(t) && /2 500\s*FCFA\s*\n?\s*Commission validée/.test(t) && /900\s*FCFA\s*\n?\s*Déjà payé/.test(t));
      check('A. historique : « Commande N° 101 », « N° 105 », « N° 108 », « N° 96 » (le numéro de l\'admin, plus « #11111111 »)', ['Commande N° 101', 'Commande N° 105', 'Commande N° 108', 'Commande N° 96'].every((s) => t.includes(s)) && !t.includes('#11111111'));
      check('A. la commande annulée apparaît « Annulée », la payée « Payée »', /Commande N° 108[\s\S]{0,80}Annulée/.test(t) && /Commande N° 96[\s\S]{0,80}Payée/.test(t), t.match(/Commande N° 108[\s\S]{0,80}/)?.[0]);
      check('A. une seule lecture : la fonction de la base, pas l\'ancienne lecture des visites et des commandes', v.log.rpc >= 1 && v.log.legacy.length === 0, v.log.legacy);
      await v.page.screenshot({ path: path.join(OUT, 'affilie-espace.png') });

      await v.page.goto(`${BASE}/espace-affilie/produits`, { waitUntil: 'load' });
      await v.page.getByText('👀 14').first().waitFor({ timeout: 30000 }).catch(() => null);
      await sleep(800);
      const p = norm(await v.page.evaluate(() => document.body.innerText));
      check('A. « Mes produits » : le 1er article vu 14 fois, 2 commandes, 3 600 FCFA (avant : 0 partout)', /👀 14\s*\n?\s*🛍️ 2\s*\n?\s*💰 3 600\s*FCFA/.test(p), p.match(/👀[^\n]*\n?[^\n]*\n?[^\n]*/)?.[0]);
      check('A. « Mes produits » : le 2e article vu 9 fois, sans vente', /👀 9\s*\n?\s*🛍️ 0/.test(p));
      check('A. « Mes produits » : rangés par commission (le 1er en haut)', p.indexOf('👀 14') > -1 && p.indexOf('👀 14') < p.indexOf('👀 9'));
      check('A. aucune ancienne lecture sur « Mes produits »', v.log.legacy.length === 0, v.log.legacy);
      await v.page.screenshot({ path: path.join(OUT, 'affilie-produits.png') });
      check('A. aucune erreur', v.errs.length === 0, v.errs);
      check('A. aucune écriture (hors suivi des visites)', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }

    // B. le script de la base n'est pas encore lancé : la fonction n'existe pas (404) → l'ancienne lecture, sans erreur
    {
      const v = await visitor(b, { profile: AFFILIATE, rpc: () => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.affiliate_my_stats' } }) });
      await v.page.goto(`${BASE}/espace-affilie`, { waitUntil: 'load' });
      await v.page.getByText('Commande #o1aaaaaa').first().waitFor({ timeout: 30000 });
      await sleep(800);
      const t = norm(await v.page.evaluate(() => document.body.innerText));
      check('B. fonction absente : l\'ancienne lecture s\'affiche (37 visites, 1 vente, 50 000 FCFA, « Commande #o1aaaaaa »)', /37\s*\n?\s*Visiteurs envoyés/.test(t) && /\b1\s*\n?\s*Ventes/.test(t) && /50 000\s*FCFA/.test(t), t.slice(0, 500));
      await v.page.goto(`${BASE}/espace-affilie/produits`, { waitUntil: 'load' });
      await v.page.getByText('👀 4').first().waitFor({ timeout: 30000 }).catch(() => null);
      const p = norm(await v.page.evaluate(() => document.body.innerText));
      check('B. « Mes produits » : l\'ancienne lecture (4 vues sur le 1er article)', /👀 4\b/.test(p));
      check('B. aucune erreur', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // C. un lien ?ref= en minuscules / avec espaces : la visite est enregistrée avec le code en MAJUSCULES, retenu 30 jours
    {
      const v = await visitor(b, { profile: null, rpc: () => ({ status: 200, body: null }) });
      await v.page.goto(`${BASE}/?ref=%20amin123%20`, { waitUntil: 'load' });
      for (let i = 0; i < 40 && !v.log.sessions.length; i++) await sleep(250);
      const sent = v.log.sessions.flat().map((s) => s && s.referral_code);
      check('C. lien « ?ref= amin123 » : visite enregistrée avec AMIN123 (avant : « amin123 », jamais compté)', sent.includes('AMIN123'), v.log.sessions);
      const stored = await v.page.evaluate(() => localStorage.getItem('albasse_referral_code'));
      check('C. le code retenu 30 jours est AMIN123', !!stored && JSON.parse(stored).code === 'AMIN123', stored);
      const v2 = await visitor(b, { profile: null, rpc: () => ({ status: 200, body: null }) });
      await v2.page.goto(`${BASE}/?ref=%3Cscript%3E`, { waitUntil: 'load' });
      for (let i = 0; i < 40 && !v2.log.sessions.length; i++) await sleep(250);
      check('C. lien avec un code bizarre (« <script> ») : ignoré', v2.log.sessions.length > 0 && v2.log.sessions.flat().every((s) => !s.referral_code), v2.log.sessions);
      check('C. aucune erreur', v.errs.length === 0 && v2.errs.length === 0, [...v.errs, ...v2.errs]);
      await v.ctx.close();
      await v2.ctx.close();
    }

    // D. candidature : code déjà pris → un autre code ; autre erreur → message en français (plus le message technique)
    for (const mode of ['doublon', 'autre']) {
      const patch = (body, n) =>
        mode === 'doublon' && n === 1
          ? { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_referral_code_idx"' } }
          : mode === 'autre'
            ? { status: 403, body: { code: '42501', message: 'new row violates row-level security policy for table "profiles"' } }
            : { status: 204 };
      const v = await visitor(b, { profile: CUSTOMER, rpc: () => ({ status: 200, body: null }), patch });
      await v.page.goto(`${BASE}/devenir-affilie`, { waitUntil: 'load' });
      await v.page.getByText('TikTokeur', { exact: true }).first().waitFor({ timeout: 30000 });
      await v.page.getByText('TikTokeur', { exact: true }).first().click();
      await v.page.getByPlaceholder('Lien TikTok / Facebook / Instagram *').fill('https://tiktok.com/@aicha');
      await v.page.getByPlaceholder(/Airtel Money/).fill('66123456');
      await v.page.getByText('Envoyer ma candidature').first().click();
      for (let i = 0; i < 40; i++) {
        const t = await v.page.evaluate(() => document.body.innerText);
        if (/Candidature envoyée|pas pu être envoyée/.test(t)) break;
        await sleep(250);
      }
      const t = norm(await v.page.evaluate(() => document.body.innerText));
      const codes = v.log.patches.map((p) => p.referral_code);
      if (mode === 'doublon') {
        check('D. code déjà pris : un 2e essai avec un autre code, et la candidature passe', codes.length === 2 && codes[0] !== codes[1] && /Candidature envoyée/.test(t), { codes, t: t.slice(0, 200) });
        check('D. les codes : 4 lettres du nom sans accent + 4 chiffres (AICH….)', codes.every((c) => /^AICH\d{4}$/.test(c)), codes);
        check('D. la demande reste « en attente » (l\'administrateur approuve)', v.log.patches.every((p) => p.affiliate_status === 'pending' && p.is_affiliate === true));
      } else {
        check('D. autre erreur : un seul essai, message en français (plus le message technique anglais)', codes.length === 1 && /pas pu être envoyée/.test(t) && !/row-level security/.test(t), { codes, t: t.slice(0, 300) });
      }
      check(`D. aucune erreur (${mode})`, v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // E. l'affilié touche « Déjà payé » : l'historique de ses paiements
    {
      const withPaid = (prods) => {
        const res = STATS(prods);
        res.body.commissions.push(
          { id: 'c5', order_id: '11111111-aaaa-4000-8000-000000000005', order_number: 99, order_total: 22000, amount: 1100, status: 'validated', paid: true, paid_at: '2026-11-21T08:00:00Z', created_at: '2026-11-10T09:00:00Z' },
          { id: 'c6', order_id: '11111111-aaaa-4000-8000-000000000006', order_number: 100, order_total: 28000, amount: 1400, status: 'validated', paid: true, paid_at: '2026-11-21T13:05:00Z', created_at: '2026-11-11T09:00:00Z' },
        );
        return res;
      };
      const v = await visitor(b, { profile: AFFILIATE, rpc: withPaid });
      await v.page.goto(`${BASE}/espace-affilie`, { waitUntil: 'load' });
      await v.page.getByTestId('stat-paid').waitFor({ timeout: 30000 });
      await sleep(800);
      const tile = norm(await v.page.getByTestId('stat-paid').innerText());
      check('E. la case « Déjà payé » : 3 400 FCFA et « Voir l\'historique › »', /3 400\s*FCFA/.test(tile) && /Voir l'historique ›/.test(tile), tile);
      check('E. avant de toucher : l\'historique est fermé', (await v.page.getByTestId('payment-history').count()) === 0);
      await v.page.getByTestId('stat-paid').click();
      await v.page.getByTestId('payment-history').waitFor({ timeout: 10000 });
      await sleep(700);
      const h = norm(await v.page.getByTestId('payment-history').innerText());
      check('E. « Historique des paiements » : total reçu 3 400 FCFA, 2 paiements, sur Mobile Money 66123456', /Historique des paiements/.test(h) && /Total reçu\s*\n?\s*3 400\s*FCFA/.test(h) && h.includes('2 paiements') && h.includes('sur Mobile Money 66123456'), h);
      const rows = (await v.page.getByTestId('payment-row').allInnerTexts()).map(norm);
      check('E. 1er paiement : 21 novembre 2026, 2 500 FCFA, « 2 commandes : N° 100 · N° 99 », ✓ Payé', rows.length === 2 && /21 novembre 2026/.test(rows[0]) && /2 500\s*FCFA/.test(rows[0]) && rows[0].includes('2 commandes : N° 100 · N° 99') && rows[0].includes('✓ Payé'), rows);
      check('E. 2e paiement : 15 novembre 2026, 900 FCFA, « 1 commande : N° 96 »', /15 novembre 2026/.test(rows[1] || '') && /900\s*FCFA/.test(rows[1] || '') && (rows[1] || '').includes('1 commande : N° 96'), rows[1]);
      check('E. côté affilié : ni l\'heure ni le montant des commandes des clients', !/\d+h\d\d/.test(h) && !h.includes('(22 000'), h);
      await v.page.screenshot({ path: path.join(OUT, 'affilie-paiements.png') });
      await v.page.getByLabel('Fermer', { exact: true }).click();
      await sleep(900);
      check('E. ✕ ferme l\'historique', (await v.page.getByTestId('payment-history').count()) === 0);
      check('E. aucune erreur', v.errs.length === 0, v.errs);
      check('E. aucune écriture', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }

    // F. l'administrateur touche « Déjà payé » sur la fiche d'un affilié
    {
      const ADMIN = { id: UID, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66000000', banned: false, role: 'admin', is_admin: true, created_at: '2026-01-01T00:00:00Z' };
      const A1 = { ...AFFILIATE, id: '77777777-7777-4777-8777-000000000001', created_at: '2026-02-01T00:00:00Z' };
      const A2 = { ...AFFILIATE, id: '77777777-7777-4777-8777-000000000002', full_name: 'Bachir Ali', referral_code: 'BACH4521', affiliate_mobile_money: '99887766', created_at: '2026-03-01T00:00:00Z' };
      const com = (id, aff, n, total, amount, status, paid, paidAt) => ({ id, affiliate_id: aff, order_id: `22222222-bbbb-4000-8000-00000000000${id}`, amount, status, paid, paid_at: paidAt, created_at: '2026-11-01T00:00:00Z', orders: { total, order_number: n } });
      const COMMISSIONS = [
        com(1, A1.id, 101, 40000, 2500, 'validated', true, '2026-11-21T13:05:00Z'),
        com(2, A1.id, 99, 22000, 1100, 'validated', true, '2026-11-21T08:00:00Z'),
        com(3, A1.id, 96, 18000, 900, 'validated', true, '2026-11-15T09:12:00Z'),
        com(4, A1.id, 108, 40000, 2500, 'validated', false, null),
        com(5, A1.id, 109, 20000, 1000, 'pending', false, null),
        com(6, A2.id, 110, 30000, 1500, 'validated', false, null),
      ];
      let selects = [];
      const extra = (u, m, r) => {
        if (m !== 'GET') return null;
        if (u.pathname === '/rest/v1/profiles' && u.searchParams.get('is_affiliate') === 'eq.true') return { body: [A2, A1] };
        if (u.pathname === '/rest/v1/visitor_sessions') return { body: [{ referral_code: 'AMIN123' }, { referral_code: 'amin123' }, { referral_code: 'BACH4521' }] };
        if (u.pathname === '/rest/v1/affiliate_commissions') { selects.push(u.searchParams.get('select')); return { body: COMMISSIONS }; }
        return null;
      };
      const v = await visitor(b, { profile: ADMIN, rpc: () => ({ status: 200, body: null }), extra });
      await v.page.goto(`${BASE}/admin/affilies`, { waitUntil: 'load' });
      await v.page.getByTestId(`paid-${A1.id}`).waitFor({ timeout: 30000 });
      await sleep(800);
      check('F. la lecture des commissions demande aussi le numéro de commande', selects.some((s) => /orders\(total,\s*order_number\)/.test(s || '')), selects);
      const m1 = norm(await v.page.getByTestId(`paid-${A1.id}`).innerText());
      const m2 = norm(await v.page.getByTestId(`paid-${A2.id}`).innerText());
      check('F. nouvelle case « Déjà payé » sur chaque fiche : Aminata 4 500 FCFA ›, Bachir 0 FCFA ›', /4 500\s*FCFA ›/.test(m1) && /Déjà payé/.test(m1) && /0\s*FCFA ›/.test(m2), { m1, m2 });
      const page1 = norm(await v.page.evaluate(() => document.body.innerText));
      check('F. visiteurs d\'Aminata : 2 (AMIN123 et amin123 comptés ensemble)', /\b2\s*\n?\s*Visiteurs/.test(page1));
      await v.page.getByTestId(`paid-${A1.id}`).click();
      await v.page.getByTestId('payment-history').waitFor({ timeout: 10000 });
      await sleep(700);
      const h = norm(await v.page.getByTestId('payment-history').innerText());
      check('F. « Paiements · Aminata Hassan », code et Mobile Money', h.includes('Paiements · Aminata Hassan') && h.includes('Code AMIN123 · Mobile Money 66123456'), h);
      check('F. total payé 4 500 FCFA, 2 paiements, reste à payer 2 500 FCFA (la commission en attente n\'est pas encore due)', /Total payé\s*\n?\s*4 500\s*FCFA/.test(h) && h.includes('2 paiements') && /Reste à payer : 2 500\s*FCFA/.test(h), h);
      const rows = (await v.page.getByTestId('payment-row').allInnerTexts()).map(norm);
      check('F. 1er paiement : 21 novembre 2026 · 14h05, 3 600 FCFA, N° 101 (40 000 FCFA) · N° 99 (22 000 FCFA)', rows.length === 2 && rows[0].includes('21 novembre 2026 · 14h05') && /3 600\s*FCFA/.test(rows[0]) && /N° 101 \(40 000\s*FCFA\) · N° 99 \(22 000\s*FCFA\)/.test(rows[0]), rows);
      check('F. 2e paiement : 15 novembre 2026 · 10h12, 900 FCFA, N° 96 (18 000 FCFA)', (rows[1] || '').includes('15 novembre 2026 · 10h12') && /N° 96 \(18 000\s*FCFA\)/.test(rows[1] || ''), rows[1]);
      await v.page.screenshot({ path: path.join(OUT, 'admin-paiements.png') });
      await v.page.getByLabel('Fermer', { exact: true }).click();
      await sleep(900);
      check('F. ✕ ferme l\'historique', (await v.page.getByTestId('payment-history').count()) === 0);
      await v.page.getByTestId(`paid-${A2.id}`).click();
      await v.page.getByTestId('payment-history').waitFor({ timeout: 10000 });
      const h2 = norm(await v.page.getByTestId('payment-history').innerText());
      check('F. Bachir, jamais payé : « Aucun paiement pour le moment. », reste à payer 1 500 FCFA', h2.includes('Paiements · Bachir Ali') && h2.includes('Aucun paiement pour le moment.') && /Reste à payer : 1 500\s*FCFA/.test(h2) && h2.includes('0 paiement'), h2);
      check('F. aucune erreur', v.errs.length === 0, v.errs);
      check('F. aucune écriture', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();
    }

    // G. « Mes produits » › 📥 Photos : les photos de l'article, signées
    {
      const v = await visitor(b, { profile: AFFILIATE, rpc: STATS });
      const downloads = [];
      v.page.on('download', (d) => downloads.push(d));
      await v.page.goto(`${BASE}/espace-affilie/produits`, { waitUntil: 'load' });
      await v.page.locator('[data-testid^="photos-"]').first().waitFor({ timeout: 30000 });
      await sleep(800);
      // un article qui a plusieurs photos
      const btns = await v.page.locator('[data-testid^="photos-"]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-testid'), text: e.innerText, label: e.getAttribute('aria-label') })));
      const multi = btns.find((x) => /Photos \(\d+\)/.test(x.text));
      check('G. un bouton « 📥 Photo(s) » sur chaque article qui a une photo, à côté de « Copier mon lien »', btns.length > 0 && btns.every((x) => /📥 Photos? ?(\(\d+\))?/.test(x.text)), btns.slice(0, 3));
      check('G. le bouton dit ce qu\'il fait (lecteur d\'écran) : « … avec la signature albasseshopping.com »', btns.every((x) => /signature albasseshopping\.com/.test(x.label || '')), btns[0]);
      const target = multi || btns[0];
      const n = multi ? Number(multi.text.match(/\((\d+)\)/)[1]) : 1;
      await v.page.getByTestId(target.id).scrollIntoViewIfNeeded();
      await v.page.screenshot({ path: path.join(OUT, 'affilie-photos-bouton.png') });
      await v.page.getByTestId(target.id).click();
      for (let i = 0; i < 80 && downloads.length < n; i++) await sleep(250);
      await sleep(1000);
      check(`G. ${n} photo(s) enregistrée(s) d'un coup`, downloads.length === n, downloads.map((d) => d.suggestedFilename()));
      const names = downloads.map((d) => d.suggestedFilename());
      check('G. noms des fichiers : albasse-<article>(-1, -2…).jpg', names.every((f) => /^albasse-[a-z0-9-]+\.jpg$/.test(f)) && (n === 1 || names.every((f, i) => f.endsWith(`-${i + 1}.jpg`))), names);
      const t = norm(await v.page.evaluate(() => document.body.innerText));
      check('G. message « … enregistrée(s), avec la signature albasseshopping.com »', /(\d+ photos enregistrées|Photo enregistrée), avec la signature albasseshopping\.com/.test(t));
      // la photo enregistrée : une vraie photo JPEG, avec la signature en bas à droite (bleu du site, drapeau, texte blanc)
      if (downloads[0]) {
        const file = path.join(OUT, names[0]);
        await downloads[0].saveAs(file);
        const buf = require('fs').readFileSync(file);
        check('G. le fichier est une photo JPEG', buf[0] === 0xff && buf[1] === 0xd8 && buf.length > 20000, buf.length);
        const probe = await b.newPage();
        const res = await probe.evaluate(async (dataUrl) => {
          const img = new Image();
          img.src = dataUrl;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const W = c.width, H = c.height;
          const zone = (x0, y0, x1, y1) => {
            const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
            const near = (r, g, b, R, G, B, tol) => Math.abs(r - R) < tol && Math.abs(g - G) < tol && Math.abs(b - B) < tol;
            let blue = 0, yellow = 0, red = 0, white = 0, pill = 0;
            for (let i = 0; i < d.length; i += 4) {
              const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
              if (near(r, g, b, 0x00, 0x26, 0x64, 40)) blue++;
              if (near(r, g, b, 0xfe, 0xcb, 0x00, 50)) yellow++;
              if (near(r, g, b, 0xc6, 0x0c, 0x30, 50)) red++;
              if (r > 235 && g > 235 && b > 235) white++;
              if (b > 70 && b < 160 && r < 60 && g < 80) pill++;
            }
            return { blue, yellow, red, white, pill };
          };
          return { W, H, corner: zone(Math.round(W * 0.4), Math.round(H * 0.85), W, H), top: zone(0, 0, Math.round(W * 0.4), Math.round(H * 0.1)) };
        }, 'data:image/jpeg;base64,' + buf.toString('base64'));
        await probe.close();
        check('G. taille gardée (2048 px au plus)', res.W > 200 && Math.max(res.W, res.H) <= 2048, { W: res.W, H: res.H });
        check('G. en bas à droite : le drapeau du Tchad (bleu, jaune, rouge) et le texte blanc sur la pastille bleue', res.corner.blue > 30 && res.corner.yellow > 30 && res.corner.red > 30 && res.corner.white > 100 && res.corner.pill > 500, res.corner);
        check('G. le haut de la photo n\'a pas de signature (l\'article reste visible)', res.top.yellow < res.corner.yellow / 4 || res.top.pill < res.corner.pill / 4, res.top);
      }
      check('G. aucune erreur', v.errs.length === 0, v.errs);
      check('G. aucune écriture', v.log.writes.length === 0, v.log.writes);
      await v.ctx.close();

      // photo impossible à lire (connexion coupée) : message en français, aucun fichier
      const v2 = await visitor(b, { profile: AFFILIATE, rpc: STATS, blockPhotos: true });
      const d2 = [];
      v2.page.on('download', (d) => d2.push(d));
      await v2.page.goto(`${BASE}/espace-affilie/produits`, { waitUntil: 'load' });
      await v2.page.locator('[data-testid^="photos-"]').first().waitFor({ timeout: 30000 });
      await v2.page.locator('[data-testid^="photos-"]').first().click();
      for (let i = 0; i < 40; i++) { if (/pas pu être enregistrée/.test(await v2.page.evaluate(() => document.body.innerText))) break; await sleep(250); }
      const t2 = norm(await v2.page.evaluate(() => document.body.innerText));
      check('G. photo illisible : « La photo n\'a pas pu être enregistrée… », aucun fichier', /La photo n'a pas pu être enregistrée/.test(t2) && d2.length === 0);
      check('G. le bouton redevient utilisable', !/⏳ Photos…/.test(t2));
      check('G. aucune erreur (photo illisible)', v2.errs.length === 0, v2.errs);
      await v2.ctx.close();
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
