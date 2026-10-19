// Controle complet de Zara Kings v5 (langue en 1er message, conseillere, arabe, bouton +, panier dans le chat, PWA, client avec compte salue par son prenom) sur la version
// complete du site (export local). Lecture seule vers la vraie base : produits, villes, categories.
// Les commandes d'un client connecte sont simulees (fausse base en memoire) : aucune ecriture reelle.
// Parties : A (nouveau visiteur), B (contexte produit/panier), C (client connecte : chat, commande, mes commandes, admin),
//           D (panne), E (clavier, fiche produit, admin cache, ordinateur), M (client avec compte reconnu et salue par son prenom).
//           T (personnalite : politesse, compliments, adresse et numero personnels), O (Zara finalise l'achat dans le chat).
//           F (programme de fidelite : grade, points, comment gagner). Y (conclure la vente, preuves vraies, packs), Z (rappel WhatsApp avec jour choisi et page admin), H (bouton de Zara : milieu de l'ecran, vibration, lumiere).
//           Choisir avec PARTS=ABCDEMTOF.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4333';
const PARTS = (process.env.PARTS || 'ALKPMRSUVWXYZHGJNTOFBCDE').toUpperCase();
const OUT = path.join(require('os').tmpdir(), 'zara-shots');
fs.mkdirSync(OUT, { recursive: true });
const KEY = process.env.SUPABASE_ANON_KEY;
const REST = 'https://xtitsmmccpkelxfjyqyh.supabase.co/rest/v1';
let ok = true;
const check = (label, cond, extra) => {
  if (!cond) ok = false;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 260));
};
const get = async (q) => (await fetch(`${REST}/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
const num = (t) => Number(String(t).replace(/[^\d]/g, ''));
const barAmount = (t) => num(((String(t).match(/·\s*([\d\s\u00a0\u202f]+)\s*FCFA/) || [])[1]) || '');

// Accueil de Zara (sans rang du jour : sans la fonction de la base, elle ne dit aucun nombre)
const WELCOME_FR = (name) => `Salut${name ? ' ' + name : ''} ! 😍👋 Bienvenue chez Albasse Shopping ! Ça me fait plaisir de vous accueillir ! 🥰🛍️`;
const INVITE_FR = 'Dites-moi, qu’est-ce qui vous ferait plaisir aujourd’hui ? Je suis là pour vous aider à trouver les meilleurs articles ! ❤️';
const WELCOME_AR = /أهلاً بك في Albasse Shopping! يسعدني استقبالك! 🥰🛍️/;
const FAB_NAME = /Discuter avec Zara Kings/;
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 };

(async () => {
  const server = spawn('node', [path.join(__dirname, 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();

  // Un contexte = un visiteur. Lecture seule vers la base ; le reste d'internet est coupe.
  // rank : rang du jour renvoye par la fonction de la base (null : fonction pas installee). fakeUser : compte simule (token : reponse a une connexion par mot de passe ; delay : lenteur du profil en ms). fakeOrders : { list: [...], patches: [] } = fausse table des commandes.
  async function newVisitor(opts, { storage = {}, session = {}, fakeUser = null, blockPath = null, fakeOrders = null, lang = 'fr', cookies = null, rank = null, oldRank = false, noStatsColumns = false, fakeStats = null, fakeBrowsing = null, fakeOverview = null, fakeSales = null, fakeCallbacks = null, initScripts = [] } = {}) {
    const ctx = await b.newContext(opts);
    if (cookies) await ctx.addCookies(cookies);
    if (lang) storage = { albasse_zara_lang: lang, ...storage };
    for (const code of initScripts) await ctx.addInitScript(code);
    await ctx.addInitScript(([entries, sessionEntries]) => {
      try {
        localStorage.setItem('albasse_app_banner_dismissed', '1');
        localStorage.setItem('albasse_app_popup_seen_' + new Date().toISOString().slice(0, 10), '1');
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
        // la conversation et le « deja salue » de l'onglet ne sont mis qu'a la premiere page (pas apres un rechargement)
        if (!sessionStorage.getItem('__zara_test_seeded')) {
          for (const [k, v] of Object.entries(sessionEntries)) sessionStorage.setItem(k, v);
          sessionStorage.setItem('__zara_test_seeded', '1');
        }
      } catch (e) {}
    }, [storage, session]);
    const writes = [];
    const rpcCalls = [];
    // statistiques de Zara : ce que le site envoie a la base (appareil du compteur, gestes d'installation, installations, demandes de la page admin)
    const chatStarts = [];
    const events = [];
    const installs = [];
    const statsCalls = [];
    // suivi de navigation : chaque envoi recu (browsingCalls), ce que la base aurait COMPTE (browsingApplied : un numero d'envoi deja recu est ignore),
    // les demandes d'effacement (forgets). fakeBrowsing.replies = reponses scriptees dans l'ordre : { status, body } ou { abort: true }
    const browsingCalls = [];
    const overviewCalls = [];
    const net = { offline: false }; // net.offline = true : aucune requete de suivi n'arrive a la base
    const browsingApplied = [];
    const forgets = [];
    const seenBatches = new Set();
    const json = (route, body, status = 200) =>
      route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
    await ctx.route('**/*', (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const m = req.method();
      if (u.hostname === 'localhost') return route.continue();
      // WhatsApp : la page s'ouvre (vide) pour qu'on puisse lire l'adresse du lien ; rien d'autre ne sort vers internet
      if (u.hostname === 'wa.me') return route.fulfill({ status: 200, contentType: 'text/html', body: 'wa' });
      if (u.hostname.endsWith('.supabase.co')) {
        if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        if (blockPath && u.pathname.includes(blockPath)) return route.abort();
        // « Vous etes mon Ne client aujourd'hui » : la fonction de la base est simulee (absente si rank est null)
        if (u.pathname === '/rest/v1/rpc/assistant_chat_start' && m === 'POST') {
          const body = JSON.parse(req.postData() || '{}');
          rpcCalls.push(Date.now());
          chatStarts.push(body);
          // oldRank : l'ancienne fonction de la base (sans appareil) : l'appel avec l'appareil est refuse comme « fonction introuvable »
          if (oldRank && body.p_device !== undefined) return json(route, { code: 'PGRST202', message: 'Could not find the function public.assistant_chat_start(p_device) in the schema cache' }, 404);
          return rank === null ? json(route, { message: 'function not found' }, 404) : json(route, rank);
        }
        if (u.pathname === '/rest/v1/rpc/assistant_log_event' && m === 'POST') {
          events.push(JSON.parse(req.postData() || '{}'));
          return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        if (u.pathname === '/rest/v1/app_installs' && m === 'POST') {
          const body = JSON.parse(req.postData() || '{}');
          installs.push(body);
          // noStatsColumns : le script de la base n'est pas applique, la colonne via_assistant n'existe pas
          if (noStatsColumns && body.via_assistant !== undefined) return json(route, { code: 'PGRST204', message: "Could not find the 'via_assistant' column of 'app_installs' in the schema cache" }, 400);
          return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
        }
        if (u.pathname === '/rest/v1/rpc/track_browsing' && m === 'POST') {
          if (net.offline) return route.abort('internetdisconnected'); // pas de reseau : la base ne recoit rien
          const body = JSON.parse(req.postData() || '{}');
          browsingCalls.push(body);
          const scripted = fakeBrowsing && fakeBrowsing.replies && fakeBrowsing.replies.length ? fakeBrowsing.replies.shift() : null;
          if (scripted && scripted.applyThenFail) {
            // la base a bien recu et compte l'envoi, mais la reponse se perd (coupure) : le site croit que ca a echoue
            if (!seenBatches.has(body.p_batch_id)) {
              seenBatches.add(body.p_batch_id);
              browsingApplied.push(body);
            }
            return route.abort();
          }
          if (scripted && scripted.abort) return route.abort();
          if (scripted) return json(route, scripted.body || {}, scripted.status || 200);
          if (!seenBatches.has(body.p_batch_id)) {
            seenBatches.add(body.p_batch_id);
            browsingApplied.push(body);
          }
          return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        if (u.pathname === '/rest/v1/rpc/forget_browsing' && m === 'POST') {
          forgets.push(JSON.parse(req.postData() || '{}'));
          return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        // le tableau de suivi de navigation (administrateur) : fakeOverview.replies = reponses a donner dans l'ordre (la derniere se repete)
        if (fakeOverview && u.pathname === '/rest/v1/rpc/browsing_overview' && m === 'POST') {
          overviewCalls.push(JSON.parse(req.postData() || '{}'));
          const reply = fakeOverview.replies[Math.min(overviewCalls.length - 1, fakeOverview.replies.length - 1)];
          return json(route, reply.body, reply.status || 200);
        }
        // ventes reelles des 7 derniers jours : fakeSales.rows = lignes { product_id, orders_count } ; sans fakeSales, la fonction est « absente » (la requete est coupee)
        if (u.pathname === '/rest/v1/rpc/assistant_product_sales' && m === 'POST') {
          // lecture seule (une fonction de la base appelee en POST) : pas une ecriture. Sans fakeSales : le script SQL n'est « pas applique » (fonction introuvable)
          if (fakeSales && fakeSales.abort) return route.abort();
          if (!fakeSales) return json(route, { code: 'PGRST202', message: 'Could not find the function public.assistant_product_sales(p_days) in the schema cache' }, 404);
          (fakeSales.calls = fakeSales.calls || []).push(JSON.parse(req.postData() || '{}'));
          if (fakeSales.status && fakeSales.status >= 400) return json(route, fakeSales.body || { code: 'PGRST202', message: 'Could not find the function public.assistant_product_sales' }, fakeSales.status);
          return json(route, fakeSales.rows);
        }
        // rappel WhatsApp : fakeCallbacks.calls = ce que la base aurait recu ; replies = reponses dans l'ordre (la derniere se repete, vrai par defaut) ;
        // table = la liste de l'admin { rows, error } ; patches = les « Fait »
        if (fakeCallbacks && u.pathname === '/rest/v1/rpc/assistant_request_callback' && m === 'POST') {
          fakeCallbacks.calls = fakeCallbacks.calls || [];
          fakeCallbacks.calls.push(JSON.parse(req.postData() || '{}'));
          const replies = fakeCallbacks.replies || [{ body: true }];
          const reply = replies[Math.min(fakeCallbacks.calls.length - 1, replies.length - 1)];
          return json(route, reply.body, reply.status || 200);
        }
        if (fakeCallbacks && fakeCallbacks.table && u.pathname === '/rest/v1/assistant_callbacks') {
          if (m === 'GET') return fakeCallbacks.table.error ? json(route, fakeCallbacks.table.error.body, fakeCallbacks.table.error.status) : json(route, fakeCallbacks.table.rows);
          if (m === 'DELETE') {
            // suppression d'une demande : renvoie les lignes vraiment supprimees (liste vide = la base a refuse, comme avec un client non administrateur)
            const id = (u.searchParams.get('id') || '').replace('eq.', '');
            (fakeCallbacks.deletes = fakeCallbacks.deletes || []).push(id);
            if (fakeCallbacks.deleteFails) return json(route, [], 200);
            const at = fakeCallbacks.table.rows.findIndex((x) => x.id === id);
            const removed = at >= 0 ? fakeCallbacks.table.rows.splice(at, 1) : [];
            return json(route, removed.map((x) => ({ id: x.id })));
          }
          if (m === 'PATCH') {
            const id = (u.searchParams.get('id') || '').replace('eq.', '');
            const body = JSON.parse(req.postData() || '{}');
            (fakeCallbacks.patches = fakeCallbacks.patches || []).push({ id, body });
            const row = fakeCallbacks.table.rows.find((x) => x.id === id);
            if (row) Object.assign(row, body);
            return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
          }
        }
        // la page « Statistiques de Zara » : fakeStats.replies = reponses a donner dans l'ordre (la derniere se repete)
        if (fakeStats && u.pathname === '/rest/v1/rpc/assistant_stats' && m === 'POST') {
          statsCalls.push(JSON.parse(req.postData() || '{}'));
          const reply = fakeStats.replies[Math.min(statsCalls.length - 1, fakeStats.replies.length - 1)];
          return json(route, reply.body, reply.status || 200);
        }
        if (fakeUser && u.pathname === '/auth/v1/user') return json(route, fakeUser.auth);
        if (fakeUser && fakeUser.token && u.pathname === '/auth/v1/token' && m === 'POST') return json(route, fakeUser.token);
        if (fakeUser && u.pathname === '/rest/v1/profiles' && m === 'GET' && u.searchParams.get('id') === 'eq.' + fakeUser.auth.id) {
          if (!fakeUser.delay) return json(route, fakeUser.profile);
          return sleep(fakeUser.delay).then(() => {
            fakeUser.servedAt = Date.now();
            return json(route, fakeUser.profile);
          });
        }
        // modification du profil par le client (fausse table : patches = ce que la base aurait recu ; refuseNext = la base ne change aucune ligne ; failNext = panne)
        if (fakeUser && fakeUser.editable && u.pathname === '/rest/v1/profiles' && m === 'PATCH' && u.searchParams.get('id') === 'eq.' + fakeUser.auth.id) {
          const body = JSON.parse(req.postData() || '{}');
          fakeUser.patches.push(body);
          if (fakeUser.rejectColumn && body[fakeUser.rejectColumn] !== undefined) return json(route, { code: 'PGRST204', message: `Could not find the '${fakeUser.rejectColumn}' column of 'profiles' in the schema cache` }, 400);
          if (fakeUser.failNext > 0) {
            fakeUser.failNext--;
            return json(route, { message: 'service indisponible', code: 'XX000' }, 500);
          }
          if (fakeUser.refuseNext > 0) {
            fakeUser.refuseNext--;
            return json(route, []);
          }
          Object.assign(fakeUser.profile, body);
          return json(route, [fakeUser.profile]);
        }
        if (fakeOrders && u.pathname === '/rest/v1/rpc/auto_flag_stale_orders') return json(route, null);
        if (fakeOrders && u.pathname === '/rest/v1/orders') {
          // enregistrement d'une commande (fausse base : created = ce que la base aurait recu ; failNext = pannes a simuler)
          if (m === 'POST') {
            const body = JSON.parse(req.postData() || '{}');
            (fakeOrders.attempts = fakeOrders.attempts || []).push(body);
            if (fakeOrders.rejectColumn && body[fakeOrders.rejectColumn] !== undefined) return json(route, { code: 'PGRST204', message: `Could not find the '${fakeOrders.rejectColumn}' column of 'orders' in the schema cache` }, 400);
            if (fakeOrders.failNext > 0) {
              fakeOrders.failNext--;
              return json(route, { message: 'service indisponible', code: 'XX000' }, 500);
            }
            fakeOrders.created = fakeOrders.created || [];
            // la commande est bien enregistree, mais la reponse est perdue (coupure de reseau) : le client reessaiera
            if (fakeOrders.failAfterSave > 0 && !fakeOrders.created.some((o) => o.id === body.id)) {
              fakeOrders.failAfterSave--;
              fakeOrders.created.push(body);
              return json(route, { message: 'reponse perdue', code: 'XX000' }, 500);
            }
            if (fakeOrders.created.some((o) => o.id === body.id)) return json(route, { code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
            fakeOrders.created.push(body);
            return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
          }
          if (m === 'GET') return json(route, fakeOrders.list);
          if (m === 'PATCH') {
            const id = (u.searchParams.get('id') || '').replace('eq.', '');
            const body = JSON.parse(req.postData() || '{}');
            fakeOrders.patches.push({ id, body });
            const o = fakeOrders.list.find((x) => x.id === id);
            if (o) Object.assign(o, body);
            return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
          }
        }
        if (['GET', 'HEAD'].includes(m)) {
          if (fakeUser) return route.continue({ headers: { ...req.headers(), authorization: 'Bearer ' + KEY } });
          return route.continue();
        }
        writes.push(m + ' ' + u.pathname);
        return route.abort();
      }
      return route.abort();
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/Failed to load resource|net::ERR|Erreur creation session visiteur/.test(msg.text())) errs.push(msg.text());
    });
    return { ctx, page, errs, writes, rpcCalls, chatStarts, events, installs, statsCalls, browsingCalls, browsingApplied, forgets, net, overviewCalls };
  }

  const panelOf = (p) => p.getByTestId('assistant-panel');
  const chip = (p, label) => panelOf(p).getByTestId('assistant-chip').filter({ hasText: label });
  const chipLabels = async (p) => (await panelOf(p).getByTestId('assistant-chip').allInnerTexts()).map((t) => t.trim());
  // en cas d'echec, on montre la fin de la conversation pour voir ce que Zara a vraiment dit
  const waitText = async (p, re, timeout = 15000) => {
    try {
      await panelOf(p).getByText(re).first().waitFor({ timeout });
    } catch (e) {
      const seen = await panelOf(p).innerText({ timeout: 2000 }).catch(() => '(pas de panneau ouvert)');
      throw new Error(`${String(e.message).split('\n')[0]} | fin de la conversation : ${seen.replace(/\s+/g, ' ').slice(-600)}`);
    }
  };
  const cardsOf = (p) => panelOf(p).getByTestId('assistant-card');
  // le prix est sur sa propre ligne (un nom de produit peut finir par des chiffres)
  const cardPrice = async (card) => num(((await card.innerText()).split('\n').map((l) => l.trim()).find((l) => /^[\d\s\u00a0\u202f]+FCFA$/.test(l)) || '').replace('FCFA', ''));
  // on attend que Zara ait fini d'ecrire (les trois points disparaissent) avant d'ecrire a notre tour
  const TYPING = /Zara est en train d’écrire…|زارا تكتب الآن…/;
  const inputOf = (p) => panelOf(p).locator('input');
  const typeIn = async (p, text) => {
    await p.getByLabel(TYPING).waitFor({ state: 'detached', timeout: 25000 }).catch(() => {});
    const input = inputOf(p);
    await input.fill(text);
    await input.press('Enter');
  };
  // ecrire puis attendre une NOUVELLE reponse qui correspond (la meme phrase peut deja etre plus haut)
  const ask = async (p, text, re, timeout = 15000) => {
    const n = await panelOf(p).getByText(re).count();
    await typeIn(p, text);
    const t0 = Date.now();
    while ((await panelOf(p).getByText(re).count()) <= n) {
      if (Date.now() - t0 > timeout) throw new Error(`pas de nouvelle reponse pour « ${text} » (${re}) | fin de la conversation : ${(await panelOf(p).innerText({ timeout: 2000 }).catch(() => '(pas de panneau ouvert)')).replace(/\s+/g, ' ').slice(-500)}`);
      await sleep(200);
    }
  };
  // toucher un bouton puis attendre une NOUVELLE reponse qui correspond
  const tap = async (p, label, re, timeout = 15000) => {
    const n = await panelOf(p).getByText(re).count();
    await chip(p, label).click();
    const t0 = Date.now();
    while ((await panelOf(p).getByText(re).count()) <= n) {
      if (Date.now() - t0 > timeout) throw new Error(`pas de nouvelle reponse apres « ${label} » (${re}) | fin de la conversation : ${(await panelOf(p).innerText({ timeout: 2000 }).catch(() => '(pas de panneau ouvert)')).replace(/\s+/g, ' ').slice(-500)}`);
      await sleep(200);
    }
  };
  // les cartes ajoutees depuis un compteur `before`
  async function newCards(p, before) {
    await sleep(900);
    const total = await cardsOf(p).count();
    const out = [];
    for (let i = before; i < total; i++) out.push(cardsOf(p).nth(i));
    return out;
  }
  async function pricesSince(p, before) {
    const cs = await newCards(p, before);
    return Promise.all(cs.map(cardPrice));
  }

  // produits reels pour les tests
  const cats = await get('categories?select=id,name,slug');
  const [promoRow] = (await get('products?select=name,slug,price,compare_at_price,stock,images&is_active=eq.true&slug=eq.rolex&limit=1'));
  const lowStock = (await get('products?select=id,name,slug,price,stock,images&is_active=eq.true&stock=gte.1&stock=lte.5&order=created_at.desc&limit=20')).find((p) => (p.images || [])[0] && p.name.trim().length < 40);
  const realProduct = (await get('products?select=*&is_active=eq.true&stock=gt.0&slug=eq.rolex&limit=1'))[0];
  const storeRow = (await get('store_settings?select=hours,address,city,phone&limit=1'))[0] || {};
  console.log('info  produit promo :', promoRow && promoRow.name, '| produit a stock bas :', lowStock && `${lowStock.name} (${lowStock.stock})`, '| horaires boutique :', storeRow.hours);

  // =============================================== A. CONSEILLERE : UNE QUESTION A LA FOIS (francais) ===============================================
  if (PARTS.includes('A')) {
    console.log('== A. conseillere : une question a la fois (telephone 390 x 800, francais)');
    const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Fatimé' } });
    const { page } = v;
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await sleep(2500);
    await page.getByRole('button', { name: FAB_NAME }).click();
    await waitText(page, WELCOME_FR('Fatimé'));
    await waitText(page, /À savoir avant de commander/);
    await waitText(page, /Créez votre compte gratuit(?:, Fatimé)?/);
    const menu = await chipLabels(page);
    check('menu du visiteur : compte, connexion, promotions, nouveautes, conseil, categories, livraison, WhatsApp, langue', menu.join('|') === '👤 Créer mon compte|Me connecter|🔥 Promotions|🆕 Nouveautés|🎯 Conseil|🛍️ Catégories|🚚 Livraison et paiement|💬 WhatsApp|🌐 العربية', menu);
    await page.screenshot({ path: path.join(OUT, 'A1-accueil.png') });

    // 1. la phrase du test du patron : un cadeau pour son mari -> des questions AVANT de montrer des articles
    let before = await cardsOf(page).count();
    await ask(page, 'Je veux faire une cadeau a mon marie', /Quel genre de cadeau pour lui \?/);
    check('cadeau pour mon mari : Zara pose une question avant de montrer des articles (aucune fiche produit)', (await cardsOf(page).count()) === before);
    const types = await chipLabels(page);
    check('quel genre de cadeau : montre, parfum, chaussures... + « je ne sais pas »', types[0] === 'Montre' && types[1] === 'Parfum' && types[2] === 'Chaussures' && types.length >= 5 && types[types.length - 1] === '🤷 Je ne sais pas', types);
    await page.screenshot({ path: path.join(OUT, 'A2-quel-cadeau.png') });
    await tap(page, 'Montre', /Quel est votre budget(?:, Fatimé)? \?/);
    check('une seule question a la fois : maintenant le budget, toujours aucun article', (await cardsOf(page).count()) === before);
    const bud = await chipLabels(page);
    check('budget : 4 tranches + Peu importe', bud.length === 5 && bud[4] === 'Peu importe', bud);
    check('le champ de saisie invite a ecrire un montant', (await inputOf(page).getAttribute('placeholder')) === 'Écrivez un montant…');
    await page.screenshot({ path: path.join(OUT, 'A3-budget.png') });
    await tap(page, '30 000 à 100 000', /Voici mes idées cadeaux pour lui(?:, Fatimé)? 🎁/);
    let prices = await pricesSince(page, before);
    check('cadeau pour lui, une montre, 30 000 a 100 000 : des articles dans le budget', prices.length > 0 && prices.every((p) => p >= 30000 && p <= 100000), prices);
    await waitText(page, /Mon conseil(?:, Fatimé)? :/);
    const advice = await panelOf(page).getByText(/Mon conseil(?:, Fatimé)? :/).last().innerText();
    check('conseil : une raison vraie (remise, stock, budget, couleurs ou tailles) pour le premier article', /(\d+ % de remise|plus que \d+ en stock|le dernier en stock|dans votre budget|disponible en|tailles :)/.test(advice), advice);
    check("cadeau : Zara propose l'emballage cadeau (2 000 FCFA par commande)", /emballage cadeau à 2\s?000 FCFA par commande/.test(advice), advice);
    const afterGift = await chipLabels(page);
    check('apres le cadeau : budget, produit qui se complete (parfum), emballage, promotions, menu, WhatsApp', afterGift.join('|') === '💰 Mon budget|➕ Avec : Parfum|🎁 Emballage cadeau|🔥 Promotions|🏠 Menu|💬 WhatsApp', afterGift);
    await page.screenshot({ path: path.join(OUT, 'A4-montres.png') });
    before = await cardsOf(page).count();
    await tap(page, 'Avec : Parfum', /Pour compléter votre achat(?:, Fatimé)?, voici nos parfum 👇/);
    check('a completer : 4 parfums', (await newCards(page, before)).length === 4);

    // 2. une categorie seule : on demande pour qui, puis le budget (ecrit au clavier)
    before = await cardsOf(page).count();
    await ask(page, 'chaussures', /Très bien(?:, Fatimé)? ! C’est pour qui \?/);
    check('« chaussures » : Zara demande pour qui avant de montrer', (await cardsOf(page).count()) === before && (await chipLabels(page)).join('|') === '👨 Pour un homme|👩 Pour une femme|👶 Pour un enfant', await chipLabels(page));
    await tap(page, 'Pour un homme', /Quel est votre budget(?:, Fatimé)? \?/);
    await ask(page, '25000', /Voici mes meilleurs choix à moins de 25\s?000 FCFA(?:, Fatimé)? :/);
    prices = await pricesSince(page, before);
    check('chaussures pour homme, budget ecrit au clavier (25000) : dans le budget', prices.length > 0 && prices.every((p) => p <= 25000), prices);

    // 3. « pour homme » : quel type d'article ? « je ne sais pas » est une reponse acceptee
    before = await cardsOf(page).count();
    await ask(page, 'pour homme', /Quel type d’article pour lui \?/);
    const shopTypes = await chipLabels(page);
    check("« pour homme » : Zara demande quel type d'article (chaussures, montre, parfum...)", (await cardsOf(page).count()) === before && shopTypes[0] === 'Chaussures' && shopTypes[1] === 'Montre' && shopTypes[shopTypes.length - 1] === '🤷 Je ne sais pas', shopTypes);
    await tap(page, 'Je ne sais pas', /Quel est votre budget(?:, Fatimé)? \?/);
    await tap(page, 'Moins de 10 000', /Voici mes meilleurs choix à moins de 10\s?000 FCFA(?:, Fatimé)? :|Je n’ai rien à moins de 10\s?000 FCFA pour cette sélection/);
    prices = await pricesSince(page, before);
    const fb = (await panelOf(page).getByText(/Je n’ai rien à moins de 10\s?000 FCFA pour cette sélection/).count()) > 0;
    check('« pour homme », type au choix, moins de 10 000 : dans le budget (ou les moins chers si rien)', prices.length > 0 && (fb || prices.every((p) => p <= 10000)), { prices, fb });

    // 4. demande precise : elle montre tout de suite
    before = await cardsOf(page).count();
    await ask(page, 'rolex', /Voici ce que j’ai trouvé pour « rolex »(?:, Fatimé)? :/);
    check('demande precise (« rolex ») : elle montre tout de suite, sans question', (await newCards(page, before)).length >= 1);

    // 5. conseil -> idee cadeau -> pour un enfant -> je ne sais pas -> peu importe
    await ask(page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
    const need = await chipLabels(page);
    check('conseil : 6 categories + idee cadeau', need.length === 7 && need[0] === 'Parfum' && need[1] === 'Chaussures' && need[6] === '🎁 Idée cadeau', need);
    await tap(page, 'Idée cadeau', /Avec plaisir(?:, Fatimé)? ! 🎁 C’est pour qui \?/);
    check('cadeau : pour elle, pour lui, pour un enfant', (await chipLabels(page)).join('|') === '👩 Pour elle|👨 Pour lui|👶 Pour un enfant');
    before = await cardsOf(page).count();
    await tap(page, 'Pour un enfant', /Quel genre de cadeau pour un enfant \?/);
    await tap(page, 'Je ne sais pas', /Quel est votre budget(?:, Fatimé)? \?/);
    await tap(page, 'Peu importe', /Voici mes idées cadeaux pour un enfant(?:, Fatimé)? 🎁/);
    check('cadeau pour un enfant, sans preference : des articles', (await newCards(page, before)).length >= 1);

    // 6. reponses ecrites a chaque question
    before = await cardsOf(page).count();
    await ask(page, 'un cadeau pour ma femme', /Quel genre de cadeau pour elle \?/);
    await ask(page, 'un parfum', /Quel est votre budget(?:, Fatimé)? \?/);
    await ask(page, 'entre 30000 et 100000', /Voici mes idées cadeaux pour elle(?:, Fatimé)? 🎁/);
    prices = await pricesSince(page, before);
    check('reponses ecrites : cadeau pour ma femme -> un parfum -> entre 30000 et 100000', prices.length > 0 && prices.every((p) => p >= 30000 && p <= 100000), prices);
    await page.screenshot({ path: path.join(OUT, 'A5-cadeau-elle.png') });

    // 7. objection de prix : des alternatives moins cheres, puis honnetete si il n'y en a plus
    const shownPrices = prices;
    before = await cardsOf(page).count();
    await ask(page, "c'est trop cher", /Voici des alternatives moins chères|C’est déjà le prix le plus bas/);
    const alts = await pricesSince(page, before);
    check("« c'est trop cher » : des alternatives au moins 10 % moins cheres que le moins cher montre", alts.length > 0 && alts.every((p) => p < Math.min(...shownPrices) * 0.9), { shownPrices, alts });
    await waitText(page, /le plus abordable de la sélection/);
    check('alternatives : boutons budget, promotions, menu, WhatsApp', (await chipLabels(page)).includes('💰 Mon budget') && (await chipLabels(page)).includes('💬 WhatsApp'), await chipLabels(page));
    before = await cardsOf(page).count();
    await ask(page, 'toujours trop cher', /Voici des alternatives moins chères|C’est déjà le prix le plus bas/);
    const alts2 = await pricesSince(page, before);
    check('2e « trop cher » : encore moins cher, ou la verite (deja le prix le plus bas)', alts2.length === 0 ? (await panelOf(page).getByText(/C’est déjà le prix le plus bas/).count()) > 0 : alts2.every((p) => p < Math.min(...alts)), { alts, alts2 });

    // 8. confiance, a propos, retours
    await ask(page, 'vous êtes fiables ?', /Votre confiance compte pour nous/);
    const trustText = await panelOf(page).getByText(/Votre confiance compte pour nous/).last().innerText();
    check('confiance : « premiere plateforme de vente en ligne du Tchad, depuis 2013 », Service Qualite Garantie, paiement a la reception a N\'Djamena', /la première plateforme de vente en ligne du Tchad, depuis 2013/.test(trustText) && /Service, Qualité, Garantie/.test(trustText) && /ne payez qu’en recevant votre commande/.test(trustText), trustText);
    check('confiance : adresse de la boutique et telephone reels', (storeRow.address ? trustText.includes(storeRow.address) : true) && /\+235 60 60 51 51/.test(trustText), trustText);
    await ask(page, 'depuis quand existez-vous ?', /Nous sommes dans ce domaine depuis 2013/);
    check('« depuis quand » : Albasse Shopping, premiere plateforme du Tchad, depuis 2013', true);
    await ask(page, 'je vais réfléchir', /Pas de souci(?:, Fatimé)? 😊/);
    const laterMsg = await panelOf(page).getByText(/Pas de souci(?:, Fatimé)? 😊/).last().innerText();
    check('« je vais reflechir » : on ne force pas, on garde la porte ouverte (favoris), « Creer mon compte » et un rappel WhatsApp proposes', /favoris/.test(laterMsg) && /Prenez votre temps/.test(laterMsg) && (await chipLabels(page)).includes('👤 Créer mon compte') && (await chipLabels(page)).includes('📲 Me rappeler sur WhatsApp'), [laterMsg, await chipLabels(page)]);
    await ask(page, 'je veux retourner un article', /Nos conditions de retour/);
    const ret = await panelOf(page).getByText(/Nos conditions de retour/).last().innerText();
    check('retours : 72 h, photo ou video, frais a notre charge (article incorrect), taille a la charge du client', /72 h/.test(ret) && /photo ou une vidéo/.test(ret) && /à notre charge/.test(ret) && /à votre charge/.test(ret), ret);
    check('retours : boutons conditions de retour, WhatsApp, menu', (await chipLabels(page)).join('|') === '📄 Conditions de retour|💬 WhatsApp|🏠 Menu', await chipLabels(page));

    // 9. livraison : les horaires et les 48 h ne sont pas redits en boucle
    await ask(page, 'livraison', /Dans quelle ville souhaitez-vous être livré/);
    await tap(page, 'Moundou', /par l'agence STTL ou Sud Voyage/);
    await waitText(page, /réglez dans ce délai/);
    const noteCount = async () => panelOf(page).getByText(/valable 48 h : réglez dans ce délai/).count();
    const n1 = await noteCount();
    await ask(page, 'Abéché', /par l'agence Abou Aziza/);
    await sleep(1500);
    check('2e ville : la meme note (8h30-16h, 48 h) n\'est pas redite', (await noteCount()) === n1, { n1, n2: await noteCount() });
    check('2e ville : les boutons suivent quand meme la reponse', (await chipLabels(page)).includes('🏠 Menu') && (await chipLabels(page)).includes('💬 WhatsApp'), await chipLabels(page));
    const mongo = await panelOf(page).getByText(/par l'agence Abou Aziza/).last().innerText();
    check("Abeche : par l'agence Abou Aziza, paiement a l'avance Airtel/Moov", /Airtel Money 60 60 51 51/.test(mongo) && /Moov Money 99 22 10 17/.test(mongo), mongo);

    // 10. rechargement au milieu des questions : la question et ses boutons sont gardes
    await ask(page, 'montre', /C’est pour qui \?/);
    await page.reload({ waitUntil: 'load' });
    await sleep(2500);
    await page.getByRole('button', { name: FAB_NAME }).click();
    await sleep(1200);
    check('apres rechargement : la question en cours et ses boutons sont gardes', (await chipLabels(page)).join('|') === '👨 Pour un homme|👩 Pour une femme|👶 Pour un enfant', await chipLabels(page));
    before = await cardsOf(page).count();
    await tap(page, 'Pour une femme', /Quel est votre budget(?:, Fatimé)? \?/);
    await tap(page, 'Peu importe', /Voici mes meilleurs choix(?:, Fatimé)? :/);
    check('apres rechargement : la conversation continue (montre pour femme, budget, resultat)', (await newCards(page, before)).length >= 1);

    // 11. le bouton « conditions de retour » ouvre la page
    await ask(page, 'conditions de retour', /Nos conditions de retour/);
    await chip(page, 'Conditions de retour').click();
    await sleep(1800);
    check('« Conditions de retour » ouvre la page et ferme la fenetre', page.url().endsWith('/conditions-de-retour') && (await panelOf(page).count()) === 0, page.url());
    check('aucune erreur dans la page (conseillere)', v.errs.length === 0, v.errs);
    await v.ctx.close();
  }

  // =============================================== L. LANGUES : FRANCAIS ET ARABE ===============================================
  if (PARTS.includes('L')) {
    console.log('\n== L. langues : francais et arabe');
    const dirOf = (p, re) => panelOf(p).getByText(re).first().evaluate((el) => ({ dir: getComputedStyle(el).direction, align: getComputedStyle(el).textAlign }));

    // --- L1. premiere visite : Zara propose les deux langues
    {
      const v = await newVisitor(phone, { lang: null });
      const { page } = v;
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(page, /Choisissez votre langue \/ اختر لغتك/);
      const first = await page.evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1') || '{"messages":[]}').messages);
      check('premiere visite : le TOUT premier message de Zara est la question de langue (Français / العربية)', first.length === 1 && /Choisissez votre langue \/ اختر لغتك/.test(first[0].text), first.map((m) => m.text));
      check('deux boutons : Français et العربية', (await chipLabels(page)).join('|') === 'Français|العربية', await chipLabels(page));
      check("la langue n'est pas retenue tant que le client n'a pas choisi", (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === null);
      await page.screenshot({ path: path.join(OUT, 'L1-premiere-visite.png') });
      await tap(page, 'العربية', /مرحباً! 😍👋 أهلاً بك في Albasse Shopping! يسعدني استقبالك!/);
      await waitText(page, /كيف يمكنني أن أناديك؟/);
      check('apres « العربية » : Zara se presente en arabe, puis demande le prenom en arabe', true);
      check('champ de saisie en arabe : « اكتب اسمك الأول… »', (await inputOf(page).getAttribute('placeholder')) === 'اكتب اسمك الأول…', await inputOf(page).getAttribute('placeholder'));
      check('boutons : تخطي + تسجيل الدخول + Français', (await chipLabels(page)).join('|') === 'تخطي|تسجيل الدخول|🌐 Français', await chipLabels(page));
      check('la langue est retenue sur l\'appareil', (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar');
      const hdr = await page.evaluate(() => ({ role: document.body.innerText.includes('مساعدة التسويق'), lang: document.querySelector('[data-testid="assistant-lang"]').innerText.trim(), foot: document.body.innerText.includes('زارا كينغز مساعدة آلية') }));
      check('en-tete et pied en arabe (role, bouton « Français », mention « assistante automatique »)', hdr.role && hdr.lang === 'Français' && hdr.foot, hdr);
      const attrs = await panelOf(page).evaluate((el) => ({ translate: el.getAttribute('translate'), cls: el.className, lang: el.getAttribute('lang') }));
      check('le traducteur de Google ne touche pas a Zara (translate="no", notranslate, lang="ar")', attrs.translate === 'no' && /notranslate/.test(attrs.cls) && attrs.lang === 'ar', attrs);
      await ask(page, 'فاطمة', /سعدت بمعرفتك يا فاطمة/);
      await waitText(page, /معلومات مهمة قبل الطلب/);
      const infoAr = await panelOf(page).getByText(/معلومات مهمة قبل الطلب/).first().innerText();
      check("informations importantes en arabe : livraison 8:30-16:00, paiement a la livraison seulement a N'Djamena, 48 heures", /8:30/.test(infoAr) && /16:00/.test(infoAr) && /فقط في إنجامينا/.test(infoAr) && /48 ساعة/.test(infoAr), infoAr);
      await waitText(page, /أنشئ حسابك المجاني(?:، فاطمة)?/);
      const menuAr = await chipLabels(page);
      check('menu en arabe : compte, connexion, offres, nouveautes, conseil, categories, livraison, WhatsApp, Francais', menuAr.join('|') === '👤 إنشاء حسابي|تسجيل الدخول|🔥 العروض|🆕 الجديد|🎯 نصيحة|🛍️ الفئات|🚚 التوصيل والدفع|💬 واتساب|🌐 Français', menuAr);
      await page.screenshot({ path: path.join(OUT, 'L2-menu-arabe.png') });

      // --- L2. cadeau en arabe : questions une par une
      let before = await cardsOf(page).count();
      await ask(page, 'اريد هدية لزوجي', /أي نوع من الهدايا له؟/);
      check('« اريد هدية لزوجي » : Zara pose une question avant de montrer des articles', (await cardsOf(page).count()) === before);
      const typesAr = await chipLabels(page);
      check('quel genre de cadeau (arabe) : ساعات، عطور، أحذية... + لا أعرف', typesAr[0] === 'ساعات' && typesAr[1] === 'عطور' && typesAr[2] === 'أحذية' && typesAr[typesAr.length - 1] === '🤷 لا أعرف', typesAr);
      await tap(page, 'ساعات', /ما هي ميزانيتك(?:، فاطمة)?؟/);
      const budAr = await chipLabels(page);
      check('budget en arabe : 4 tranches + لا يهم', budAr.length === 5 && /من 30 000 إلى 100 000 FCFA/.test(budAr[2]) && budAr[4] === 'لا يهم', budAr);
      check('champ de saisie : « اكتب مبلغا… »', (await inputOf(page).getAttribute('placeholder')) === 'اكتب مبلغا…');
      await tap(page, '30 000 إلى 100 000', /إليك أفكاري لهدية له(?:، فاطمة)? 🎁/);
      const pr = await pricesSince(page, before);
      check('cadeau pour lui, ساعات، 30 000 a 100 000 : des articles dans le budget', pr.length > 0 && pr.every((p) => p >= 30000 && p <= 100000), pr);
      await waitText(page, /نصيحتي(?:، فاطمة)?:/);
      const adviceAr = await panelOf(page).getByText(/نصيحتي(?:، فاطمة)?:/).last().innerText();
      check('conseil en arabe : raison vraie + emballage cadeau 2 000 FCFA', /(خصم \d+ %|بقي \d+ فقط|ضمن ميزانيتك|متوفر بألوان|المقاسات)/.test(adviceAr) && /تغليف الهدايا بـ 2\s?000 FCFA/.test(adviceAr), adviceAr);
      const chipsAr = await chipLabels(page);
      check('apres le cadeau (arabe) : ميزانيتي، مع: عطور، تغليف الهدايا، العروض، القائمة، واتساب', chipsAr.join('|') === '💰 ميزانيتي|➕ مع: عطور|🎁 تغليف الهدايا|🔥 العروض|🏠 القائمة|💬 واتساب', chipsAr);
      const cardTxt = await cardsOf(page).last().innerText();
      check('fiche produit en arabe : « عرض المنتج ›»', /عرض المنتج ›/.test(cardTxt), cardTxt);
      const advDir = await dirOf(page, /نصيحتي(?:، فاطمة)?:/);
      check('bulle arabe alignee a droite, de droite a gauche', advDir.dir === 'rtl' && advDir.align === 'right', advDir);
      await page.screenshot({ path: path.join(OUT, 'L3-cadeau-arabe.png') });
      await tap(page, 'تغليف الهدايا', /تغليف الهدايا: مقابل 2\s?000 FCFA لكل طلب/);
      check('emballage cadeau (arabe) : 2 000 FCFA par commande, image cadeau, « طلباتي »', true);

      // --- L3. recherche en arabe avec budget ecrit
      before = await cardsOf(page).count();
      await ask(page, 'عطر رجالي اقل من 25000', /إليك أفضل اختياراتي بأقل من 25\s?000 FCFA(?:، فاطمة)?:/);
      const prAr = await pricesSince(page, before);
      check('« عطر رجالي اقل من 25000 » : des parfums dans le budget (aucune question : tout est dit)', prAr.length > 0 && prAr.every((p) => p <= 25000), prAr);

      // --- L4. livraison en arabe
      await ask(page, 'التوصيل الى مونذو', /عبر وكالة/);
      const moAr = await panelOf(page).getByText(/عبر وكالة/).last().innerText();
      check('Moundou en arabe : tarif, agence, paiement a l\'avance, Airtel et Moov', /2\s?500 FCFA/.test(moAr) && /STTL/.test(moAr) && /مسبقا/.test(moAr) && /Airtel Money 60 60 51 51/.test(moAr) && /Moov Money 99 22 10 17/.test(moAr), moAr);
      await waitText(page, /ادفع خلال هذه المدة/);
      const noteN = async () => panelOf(page).getByText(/ادفع خلال هذه المدة/).count();
      const n1 = await noteN();
      await ask(page, 'ابشي', /عبر وكالة Abou Aziza/);
      await sleep(1500);
      check('2e ville (arabe) : la note des horaires et des 48 h n\'est pas redite', (await noteN()) === n1, { n1, n2: await noteN() });

      // --- L5. objections, confiance, retours en arabe
      before = await cardsOf(page).count();
      await ask(page, 'غالي', /أفهمك(?:، فاطمة)?\. إليك بدائل أرخص:|هذا بالفعل أقل سعر|أفهمك 😊/);
      check('« غالي » : Zara repond en arabe (alternatives moins cheres, ou la verite)', true);
      await ask(page, 'هل انتم موثوقون', /ثقتك تهمّنا/);
      const trustAr = await panelOf(page).getByText(/ثقتك تهمّنا/).last().innerText();
      check('confiance en arabe : أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013', /أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013/.test(trustAr) && /خدمة، جودة، ضمان/.test(trustAr), trustAr);
      await ask(page, 'شروط الارجاع', /شروط الإرجاع لدينا/);
      const retAr = await panelOf(page).getByText(/شروط الإرجاع لدينا/).last().innerText();
      check('retours en arabe : 72 heures, photo ou video', /72 ساعة/.test(retAr) && /صورة أو فيديو/.test(retAr), retAr);
      check('retours en arabe : bouton « شروط الإرجاع »', (await chipLabels(page)).join('|') === '📄 شروط الإرجاع|💬 واتساب|🏠 القائمة', await chipLabels(page));

      // --- L6. changer de langue avec le bouton de l'en-tete, puis en ecrivant
      await page.getByTestId('assistant-lang').click();
      await waitText(page, /Très bien, on continue en français/);
      await waitText(page, /Que souhaitez-vous découvrir(?:, فاطمة)? \? 🛍️/);
      check('bouton de l\'en-tete : retour au francais (confirmation + menu en francais)', (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'fr' && (await chipLabels(page))[0] === '👤 Créer mon compte', await chipLabels(page));
      check('apres le retour : bouton « العربية », champ « Écrivez votre message… »', (await page.getByTestId('assistant-lang').innerText()).trim() === 'العربية' && (await inputOf(page).getAttribute('placeholder')) === 'Écrivez votre message…');
      await ask(page, 'عطور', /حسنا(?:، فاطمة)?! لمن هي؟/);
      check('il ecrit en arabe alors que Zara parle francais : Zara passe a l\'arabe toute seule', (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar' && (await chipLabels(page)).join('|') === '👨 لرجل|👩 لامرأة|👶 لطفل', await chipLabels(page));
      await ask(page, 'français', /Très bien, on continue en français/);
      check('« français » ecrit : Zara repasse au francais', (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'fr');
      await ask(page, 'arabe', /حسنا، نكمل بالعربية/);
      check('« arabe » ecrit : Zara passe a l\'arabe', (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar');
      await ask(page, 'Français', /Très bien, on continue en français/);
      before = await cardsOf(page).count();
      await ask(page, 'parfum arabe', /Voici ce que j’ai trouvé pour « parfum arabe »|Je n’ai rien trouvé pour « parfum arabe »/);
      check('« parfum arabe » est une recherche de produit, pas un changement de langue', (await page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'fr');
      check('aucune erreur dans la page (langues)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- L7. premiere visite : il ecrit au lieu de toucher un bouton
    {
      const a = await newVisitor(phone, { lang: null });
      await a.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await a.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(a.page, /Choisissez votre langue/);
      await typeIn(a.page, 'مرحبا');
      await waitText(a.page, /مرحباً(، علي)? 😊 أهلاً بك في Albasse Shopping! كيف أساعدك اليوم؟|مرحباً(، علي)?! 😊 يسعدني استقبالك/);
      check('premiere visite : il ecrit « مرحبا » -> Zara passe a l\'arabe et repond', (await a.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar');
      await a.ctx.close();
      const f = await newVisitor(phone, { lang: null });
      await f.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await f.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(f.page, /Choisissez votre langue/);
      await typeIn(f.page, 'bonjour');
      await waitText(f.page, /Bonjour(?: !)? 😊 (?:Bienvenue chez Albasse Shopping ! Comment puis-je vous aider aujourd’hui \?|Ravie de vous accueillir\. Que puis-je faire pour vous aujourd’hui \?)/);
      check('premiere visite : il ecrit « bonjour » -> Zara reste en francais et repond', (await f.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'fr');
      await f.ctx.close();
    }

    // --- L8. site traduit en arabe (cookie de Google) : pas de question de langue
    {
      const g = await newVisitor(phone, { lang: null, cookies: [{ name: 'googtrans', value: '/fr/ar', url: `http://localhost:${port}` }] });
      await g.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await g.page.getByRole('button', { name: /التحدث مع زارا كينغز|Discuter avec Zara Kings/ }).click();
      await waitText(g.page, /مرحباً! 😍👋 أهلاً بك في Albasse Shopping! يسعدني استقبالك!/);
      await waitText(g.page, /كيف يمكنني أن أناديك؟/);
      check('site deja affiche en arabe : Zara parle arabe tout de suite, sans demander la langue', (await g.page.getByText(/Choisissez votre langue/).count()) === 0);
      await g.ctx.close();
    }

    // --- L9. visiteur arabe qui revient : prenom et langue retenus, bulle de bienvenue en arabe
    {
      const r = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      await r.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(7500);
      const teaser = await r.page.getByText(/مرحبا علي! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping\. 😊/).count();
      check('visiteur arabe qui revient : la bulle de bienvenue du bouton est en arabe, avec son prenom', teaser === 1, teaser);
      await r.page.getByRole('button', { name: 'التحدث مع زارا كينغز، مساعدة التسويق' }).click();
      await waitText(r.page, /مرحباً علي! 😍👋 أهلاً بك في Albasse Shopping! يسعدني استقبالك!/);
      await waitText(r.page, /أنشئ حسابك المجاني(?:، علي)?/);
      check('visiteur arabe qui revient : pas de question de langue ni de prenom, directement les infos et le menu', (await r.page.getByText(/كيف يمكنني أن أناديك/).count()) === 0 && (await chipLabels(r.page))[0] === '👤 إنشاء حسابي');
      check('aucune erreur (visiteur arabe)', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }

    // --- L10. en-tete : tout tient a l'ecran en 390 et 360 de large, en francais et en arabe ; ordinateur
    for (const [w, lg] of [[390, 'fr'], [390, 'ar'], [360, 'fr'], [360, 'ar']]) {
      const h = await newVisitor({ ...devices['Pixel 7'], viewport: { width: w, height: 780 } }, { lang: lg, storage: { albasse_zara_name: 'Ali' } });
      await h.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await h.page.getByRole('button', { name: /Discuter avec Zara Kings|التحدث مع زارا كينغز/ }).click();
      await h.page.getByRole('button', { name: /Recommencer la conversation|ابدأ المحادثة من جديد/ }).waitFor({ timeout: 25000 });
      await sleep(300);
      const g = await h.page.evaluate(() => {
        const panel = document.querySelector('[data-testid="assistant-panel"]');
        const pr = panel.getBoundingClientRect();
        const leaf = (txt) => [...panel.querySelectorAll('div')].find((e) => e.children.length === 0 && e.textContent.trim() === txt);
        const name = leaf('Zara Kings');
        const close = panel.querySelector('[aria-label="Fermer"],[aria-label="إغلاق"]');
        const lang = panel.querySelector('[data-testid="assistant-lang"]');
        const trash = panel.querySelector('[aria-label="Recommencer la conversation"],[aria-label="ابدأ المحادثة من جديد"]');
        const wa = panel.querySelector('[aria-label^="Parler à"],[aria-label^="التحدث مع الفريق"]');
        const r = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
        return { panelR: Math.round(pr.right), name: r(name), close: r(close), lang: r(lang), trash: r(trash), wa: r(wa), sw: document.documentElement.scrollWidth };
      });
      const fits = g.close.r <= g.panelR - 8 && g.name.h < 30 && g.name.r <= g.lang.l && g.lang.r <= g.trash.l && g.trash.r <= g.wa.l && g.wa.r <= g.close.l && g.sw <= w;
      check(`en-tete ${w} px, ${lg === 'fr' ? 'francais' : 'arabe'} : le nom sur une ligne, bouton de langue, WhatsApp et fermer tiennent sans depasser`, fits, g);
      if (w === 360) await h.page.screenshot({ path: path.join(OUT, `L4-entete-${w}-${lg}.png`) });
      await h.ctx.close();
    }
    {
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { storage: { albasse_zara_name: 'Ali' } });
      await d.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await d.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(d.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('ordinateur : bouton de langue « العربية » et « WhatsApp » en toutes lettres dans l\'en-tete', (await d.page.getByTestId('assistant-lang').innerText()).trim() === 'العربية' && (await panelOf(d.page).getByText('WhatsApp', { exact: true }).count()) >= 1);
      await d.page.getByTestId('assistant-lang').click();
      await waitText(d.page, /حسنا، نكمل بالعربية/);
      await waitText(d.page, /ماذا تريد أن تكتشف(?:، Ali)?؟ 🛍️/);
      await d.page.screenshot({ path: path.join(OUT, 'L5-ordinateur-arabe.png') });
      check('ordinateur : le bouton de langue passe a l\'arabe', (await d.page.getByTestId('assistant-lang').innerText()).trim() === 'Français');
      check('aucune erreur (ordinateur / arabe)', d.errs.length === 0, d.errs);
      await d.ctx.close();
    }
  }

  // =============================================== K. BOUTON « + », PANIER ET COMMANDE DANS LE CHAT ===============================================
  if (PARTS.includes('K')) {
    console.log('\n== K. bouton « + », panier et commande dans la conversation');
    // 3 vrais produits sans variante (une seule couleur au plus, pas de taille), au nom simple
    const all = await get('products?select=id,name,slug,price,compare_at_price,stock,sizes,colors,images&is_active=eq.true&stock=gt.0&limit=1000');
    const BAD = /montre|parfum|chaussure|sac|robe|homme|femme|enfant|bebe|lunette|cadeau|sandale|basket|veste|costume|chemise|pantalon|creme|jouet|velo|meuble|maison|electri|voiture|aliment|budget|panier|promo|livraison|conseil|ajout|total/i;
    const same = (n) => all.filter((p) => p.name.trim().toLowerCase() === n.trim().toLowerCase()).length;
    const plain = all.filter((p) => (p.images || [])[0] && /^[A-Za-zÀ-ÿ]{4,14}( [A-Za-zÀ-ÿ]{3,12})?$/.test(p.name.trim()) && !BAD.test(p.name) && same(p.name) === 1 && p.stock >= 4 && (p.sizes || []).length === 0 && (p.colors || []).length <= 1);
    const [A, B, C] = plain;
    console.log('info  produits du test :', [A, B, C].map((p) => p && `${p.name.trim()} (${p.price})`).join(' | '));
    check('3 vrais produits sans variante trouves pour le test', !!(A && B && C));
    const rowOf = async (slug) => (await get(`products?select=*&slug=eq.${slug}&is_active=eq.true`))[0];
    const [rowC, rowB] = [await rowOf(C.slug), await rowOf(B.slug)];

    const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
    const { page } = v;
    const mock = { mode: null, slug: null };
    await page.route(/\/rest\/v1\/products\?.*slug=eq\./, async (route) => {
      const slug = (new URL(route.request().url()).searchParams.get('slug') || '').replace('eq.', '');
      if (mock.mode === 'fail') return route.abort();
      const json = (row) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify([row]) });
      if (mock.mode === 'variants' && slug === C.slug) return json({ ...rowC, sizes: ['40', '41', '42'], colors: ['Noir', 'Blanc'] });
      if (mock.mode === 'stock0' && slug === B.slug) return json({ ...rowB, stock: 0 });
      return route.continue();
    });
    const cartItems = async () => {
      await sleep(600);
      return page.evaluate(() => { try { return JSON.parse(localStorage.getItem('albasse-cart') || '{}').state?.items ?? []; } catch (e) { return []; } });
    };
    const qtyOf = (items, p) => items.filter((i) => i.product.id === p.id).reduce((n, i) => n + i.quantity, 0);
    const cardFor = (p) => cardsOf(page).filter({ hasText: p.name.trim() }).first();
    const showProduct = async (p) => {
      await ask(page, p.name.trim(), new RegExp(`Voici ce que j’ai trouvé pour « ${p.name.trim()} »`));
      await cardFor(p).waitFor({ timeout: 10000 });
    };
    const addVia = async (p, re = /ajouté au panier/) => {
      const n = await panelOf(page).getByText(re).count();
      await cardFor(p).getByTestId('assistant-card-add').click();
      const t0 = Date.now();
      while ((await panelOf(page).getByText(re).count()) <= n) {
        if (Date.now() - t0 > 15000) throw new Error('pas de reponse apres le bouton + de ' + p.name);
        await sleep(150);
      }
    };

    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await sleep(2500);
    await page.getByRole('button', { name: FAB_NAME }).click();
    await waitText(page, /Créez votre compte gratuit(?:, Ali)?/);
    check('panier vide : pas de barre « panier » dans la conversation', (await page.getByTestId('chat-cart-bar').count()) === 0);

    // --- indicateur « Zara est en train d'ecrire… »
    await typeIn(page, A.name.trim());
    await page.getByText('Zara est en train d’écrire…').first().waitFor({ timeout: 4000 });
    check('« Zara est en train d\'ecrire… » apparait des que la demande est envoyee (texte visible, accessible)', (await page.getByTestId('assistant-typing').first().getAttribute('aria-label')) === 'Zara est en train d’écrire…');
    await waitText(page, new RegExp(`Voici ce que j’ai trouvé pour « ${A.name.trim()} »`));
    await page.getByTestId('assistant-typing').waitFor({ state: 'detached', timeout: 15000 });
    check('l\'indicateur disparait quand la reponse est terminee', (await page.getByTestId('assistant-typing').count()) === 0);
    await cardFor(A).waitFor({ timeout: 10000 });

    // --- le bouton « + » est sur chaque fiche, sans masquer le prix ni « Voir le produit »
    const nCards = await cardsOf(page).count();
    check('chaque fiche produit a son bouton « + » (ajouter au panier)', nCards > 0 && (await panelOf(page).getByTestId('assistant-card-add').count()) === nCards, { nCards });
    const geo = await cardFor(A).evaluate((card) => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const add = card.querySelector('[data-testid="assistant-card-add"]');
      const leaf = (re) => [...card.querySelectorAll('div')].find((e) => e.children.length === 0 && re.test(e.textContent));
      const price = leaf(/FCFA/); const see = leaf(/Voir le produit/);
      const hit = (a, b) => b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
      const ra = r(add); const rc = r(card);
      return { overlapPrice: hit(ra, price && r(price)), overlapSee: hit(ra, see && r(see)), inside: ra.l >= rc.l && ra.r <= rc.r && ra.b <= rc.b, size: Math.round(ra.r - ra.l) };
    });
    check('le bouton « + » ne cache ni le prix ni « Voir le produit », reste dans la carte, assez grand pour le doigt', !geo.overlapPrice && !geo.overlapSee && geo.inside && geo.size >= 36, geo);
    await page.screenshot({ path: path.join(OUT, 'K1-cartes-plus.png') });

    // --- ajout : le bon article, au vrai prix, sans quitter la conversation
    await addVia(A);
    let items = await cartItems();
    const dbA = await rowOf(A.slug);
    check('« + » ajoute le bon article au vrai panier du site (meme produit, prix de la base)', items.length === 1 && items[0].product.id === A.id && items[0].product.price === Number(dbA.price) && items[0].quantity === 1, items.map((i) => [i.product.name, i.product.price, i.quantity]));
    check('la conversation reste ouverte et Zara confirme : article, nombre, total', (await panelOf(page).count()) === 1 && (await panelOf(page).getByText(new RegExp(`✅ « ${A.name.trim()} » ajouté au panier\\.\\nVotre panier : 1 article · ${String(A.price).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')}`)).count()) >= 1 || (await panelOf(page).getByText(/Votre panier : 1 article/).count()) >= 1);
    const barTxt = await page.getByTestId('chat-cart-bar').innerText();
    check('compteur et total du panier mis a jour tout de suite (barre sous la conversation)', /1 article/.test(barTxt) && barAmount(barTxt) === Number(dbA.price), barTxt);
    check('boutons apres l\'ajout : voir mon panier, commander, autres articles, emballage cadeau', (await chipLabels(page)).join('|') === '🛒 Voir mon panier|✅ Commander|🛍️ Autres articles|🎁 Emballage cadeau', await chipLabels(page));
    check('apres l\'article choisi : Zara propose TOUJOURS l\'emballage cadeau (2 000 FCFA par commande, propose a la commande)', (await panelOf(page).getByText('🎁 Pour offrir : l’emballage cadeau est à 2 000 FCFA par commande (je vous le proposerai au moment de commander).').count()) >= 1);
    check('astuce du bouton + donnee une seule fois', (await panelOf(page).getByText(/Astuce : touchez \+ sur un article/).count()) === 1);
    await page.screenshot({ path: path.join(OUT, 'K2-ajoute.png') });

    // --- double clic : un seul ajout
    await showProduct(B);
    await cardFor(B).getByTestId('assistant-card-add').dblclick();
    await sleep(1800);
    items = await cartItems();
    check('double clic sur « + » : un seul exemplaire ajoute', qtyOf(items, B) === 1, items.map((i) => [i.product.name, i.quantity]));

    // --- plusieurs produits d'affilee, sans attendre
    await showProduct(A);
    await cardFor(A).getByTestId('assistant-card-add').click();
    await showProduct(B);
    await sleep(1400); // plus d'une seconde apres le precedent ajout de B
    const nBefore = await panelOf(page).getByText(/ajouté au panier/).count();
    await cardFor(B).getByTestId('assistant-card-add').click();
    await sleep(2500);
    items = await cartItems();
    check('plusieurs articles ajoutes les uns apres les autres sans quitter le chat', items.length === 2 && qtyOf(items, A) === 2 && qtyOf(items, B) === 2 && (await panelOf(page).getByText(/ajouté au panier/).count()) >= nBefore, items.map((i) => [i.product.name, i.quantity]));

    // --- variantes obligatoires : taille puis couleur (lues dans la base au moment de l'ajout)
    mock.mode = 'variants';
    await showProduct(C);
    await cardFor(C).getByTestId('assistant-card-add').click();
    await waitText(page, new RegExp(`Quelle taille pour « ${C.name.trim()} » \\?`));
    check('produit avec tailles : Zara demande la taille avant d\'ajouter (rien dans le panier)', (await chipLabels(page)).join('|') === 'Taille 40|Taille 41|Taille 42|Annuler' && qtyOf(await cartItems(), C) === 0, await chipLabels(page));
    await tap(page, 'Taille 41', new RegExp(`Quelle couleur pour « ${C.name.trim()} » \\?`));
    check('puis la couleur', (await chipLabels(page)).join('|') === 'Noir|Blanc|Annuler', await chipLabels(page));
    await tap(page, 'Blanc', /ajouté au panier/);
    items = await cartItems();
    const itC = items.find((i) => i.product.id === C.id);
    check('apres la taille et la couleur : ajoute avec la bonne taille et la bonne couleur', !!itC && itC.size === '41' && itC.color === 'Blanc' && itC.quantity === 1, itC && [itC.size, itC.color]);
    check('la confirmation rappelle la variante : (Taille 41 · Blanc)', (await panelOf(page).getByText(/\(Taille 41 · Blanc\)/).count()) >= 1);
    const nAdded = await panelOf(page).getByText(/ajouté au panier\./).count();
    const nNudge = await panelOf(page).getByText(/Pour offrir : l’emballage cadeau est à 2\s000\sFCFA par commande/).count();
    check('« toujours » : CHAQUE article ajoute dans le chat est suivi du rappel de l\'emballage cadeau (jamais un seul rappel pour toute la conversation)', nAdded >= 4 && nNudge === nAdded, [nAdded, nNudge]);
    await tap(page, 'Emballage cadeau', /Emballage cadeau : pour 2\s000\sFCFA par commande/);
    check('bouton « Emballage cadeau » : Zara explique, et ramene vers la commande (Commander, Voir mon panier, Menu)', (await chipLabels(page)).join('|') === '✅ Commander|🛒 Voir mon panier|🏠 Menu', await chipLabels(page));
    // annuler
    await cardFor(C).getByTestId('assistant-card-add').click();
    await waitText(page, /Quelle taille pour/);
    const n0 = await panelOf(page).getByText(/je n’ajoute rien/).count();
    await chip(page, 'Annuler').click();
    await sleep(900);
    check('« Annuler » : rien n\'est ajoute', (await panelOf(page).getByText(/je n’ajoute rien/).count()) > n0 && qtyOf(await cartItems(), C) === 1);
    mock.mode = null;

    // --- article epuise : pas d'ajout, explication, alternatives avec « + »
    mock.mode = 'stock0';
    const qB = qtyOf(await cartItems(), B);
    await cardFor(B).getByTestId('assistant-card-add').click();
    await waitText(page, new RegExp(`« ${B.name.trim()} » n’est plus disponible pour le moment`));
    await sleep(1500);
    check('article epuise : l\'ajout est refuse, le panier ne change pas', qtyOf(await cartItems(), B) === qB);
    check('article epuise : Zara propose des articles proches (cartes avec « + »), ou le dit honnetement', (await panelOf(page).getByText(/Voici des articles proches, disponibles/).count()) >= 1 || (await chipLabels(page)).includes('🎯 Conseil'), await chipLabels(page));
    mock.mode = 'fail';
    const qA = qtyOf(await cartItems(), A);
    await showProduct(A).catch(() => {});
    await cardFor(A).getByTestId('assistant-card-add').click();
    await waitText(page, /Je n’arrive pas à ajouter cet article pour le moment/);
    check('coupure reseau pendant l\'ajout : message poli, rien d\'ajoute, le chat reste utilisable', qtyOf(await cartItems(), A) === qA && (await inputOf(page).isEnabled()));
    mock.mode = null;

    // --- voir le panier dans la conversation : totaux
    await ask(page, 'mon panier', /Voici votre panier 🛒/);
    await page.getByTestId('chat-cart').last().waitFor({ timeout: 10000 });
    items = await cartItems();
    const expTotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const cartTxt = await page.getByTestId('chat-cart').last().innerText();
    const shownTotal = num(await page.getByTestId('chat-cart-total').last().innerText());
    const rows = await page.getByTestId('chat-cart-item').count();
    check('panier dans le chat : un article par ligne (nom, prix a l\'unite, quantite, sous-total)', rows >= 3 && /FCFA l’unité/.test(cartTxt), { rows });
    check('panier dans le chat : le total est exact (somme des prix de la base x quantites)', shownTotal === expTotal, { shownTotal, expTotal });
    check('prix et stock verifies a l\'instant (relus dans la base)', (await panelOf(page).getByText(/Prix et stock vérifiés à l’instant/).count()) >= 1);
    const hasSaving = items.some((i) => i.product.compare_at_price && i.product.compare_at_price > i.product.price);
    check('reduction affichee seulement si elle est reelle', hasSaving === /Vous économisez/.test(cartTxt), { hasSaving });
    check('livraison : pas de frais affiches tant que la ville n\'est pas connue', /calculée à la commande selon votre ville/.test(cartTxt) && !/Livraison à/.test(cartTxt), cartTxt);
    await page.screenshot({ path: path.join(OUT, 'K3-panier.png') });

    // --- livraison connue -> affichee
    await ask(page, 'livraison à Moundou', /par l'agence/);
    await ask(page, 'mon panier', /Voici votre panier 🛒/);
    const cartTxt2 = await page.getByTestId('chat-cart').last().innerText();
    const total2 = num(await page.getByTestId('chat-cart-total').last().innerText());
    check('ville connue (Moundou) : livraison 2 500 FCFA affichee, total avec livraison', /Livraison à Moundou/.test(cartTxt2) && /Total avec livraison/.test(cartTxt2) && total2 === expTotal + 2500, { total2, expTotal });
    await ask(page, "livraison à N'Djamena", /vous payez à la livraison/);
    await ask(page, 'le total', /Voici votre panier 🛒/);
    const cartTxt3 = await page.getByTestId('chat-cart').last().innerText();
    check("N'Djamena : livraison gratuite, total inchange", /Livraison à N'Djamena/.test(cartTxt3) && /gratuite/.test(cartTxt3) && num(await page.getByTestId('chat-cart-total').last().innerText()) === expTotal, cartTxt3);

    // --- quantites, suppression
    const last = () => page.getByTestId('chat-cart').last();
    const firstRow = () => last().getByTestId('chat-cart-item').first();
    const q0 = Number(await firstRow().getByTestId('chat-cart-qty').innerText());
    await firstRow().getByTestId('chat-cart-plus').click();
    await sleep(500);
    items = await cartItems();
    check('« + » du panier : la quantite augmente (chat, barre et panier du site)', Number(await firstRow().getByTestId('chat-cart-qty').innerText()) === q0 + 1 && items[0].quantity === q0 + 1 && barAmount(await page.getByTestId('chat-cart-bar').innerText()) === items.reduce((s, i) => s + i.product.price * i.quantity, 0));
    await firstRow().getByTestId('chat-cart-minus').click();
    await sleep(500);
    check('« − » : la quantite diminue', Number(await firstRow().getByTestId('chat-cart-qty').innerText()) === q0);
    const nRows = await last().getByTestId('chat-cart-item').count();
    await last().getByTestId('chat-cart-remove').last().click();
    await sleep(600);
    check('« ✕ » : l\'article est supprime du panier (chat et site)', (await last().getByTestId('chat-cart-item').count()) === nRows - 1 && (await cartItems()).length === nRows - 1);

    // --- le panier du site est le meme
    await page.getByRole('button', { name: 'Fermer' }).click();
    await page.goto(`http://localhost:${port}/panier`, { waitUntil: 'load' });
    await sleep(3000);
    const body = await page.evaluate(() => document.body.innerText);
    items = await cartItems();
    const siteTotal = num((body.match(/Total\s*\n?\s*([\d\s  ]+)\s*FCFA/) || [])[1]);
    check('panier principal du site : memes articles et meme total que dans le chat', items.every((i) => body.includes(i.product.name)) && siteTotal === items.reduce((s, i) => s + i.product.price * i.quantity, 0), { siteTotal });
    await page.getByRole('button', { name: FAB_NAME }).click();
    await sleep(1200);
    check('apres rechargement, la barre du chat montre le meme panier', barAmount(await page.getByTestId('chat-cart-bar').innerText()) === siteTotal, await page.getByTestId('chat-cart-bar').innerText());
    check('aucune ecriture reelle dans la base pendant tout le test', v.writes.length === 0 || v.writes.every((w) => /visitor_sessions/.test(w)), v.writes);
    check('aucune erreur dans la page (panier)', v.errs.length === 0, v.errs);
    await v.ctx.close();

    // --- « je veux commander » : visiteur sans compte -> il faut un compte, le panier est garde
    {
      const item = { id: `${dbA.id}__nc__ns`, product: dbA, quantity: 1, color: null, size: null };
      const cartJson = JSON.stringify({ state: { items: [item], updatedAt: Date.now() }, version: 0 });
      const g = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali', 'albasse-cart': cartJson } });
      await g.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await g.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(g.page, /Votre panier vous attend/);
      await waitText(g.page, /Créez votre compte gratuit/);
      await ask(g.page, 'je veux commander', /créez votre compte ou connectez-vous/);
      check('« je veux commander » sans compte : Zara demande de creer un compte / se connecter (jamais de donnees bancaires), la page reste, le panier est garde', g.page.url().endsWith('/') && (await chipLabels(g.page)).join('|') === '👤 Créer mon compte|Me connecter|🏠 Menu' && (await g.page.evaluate(() => JSON.parse(localStorage.getItem('albasse-cart')).state.items.length)) === 1 && !/carte bancaire|code secret|CVV/i.test(await panelOf(g.page).innerText()), await chipLabels(g.page));
      await ask(g.page, 'mon panier', /Voici votre panier 🛒/);
      await g.page.getByTestId('chat-cart-checkout').last().click();
      await sleep(1500);
      check('sans compte : le bouton « Commander » du panier demande aussi un compte (deuxieme message), rien n\'est enregistre', (await panelOf(g.page).getByText(/créez votre compte ou connectez-vous/).count()) >= 2 && g.writes.every((w) => !/\/orders/.test(w)));
      check('visiteur sans compte : aucune donnee privee affichee (ni commandes ni coordonnees)', !/Commande #|Moundou|@/.test(await panelOf(g.page).innerText()));
      await ask(g.page, 'mes commandes', /Retrouvez et suivez toutes vos commandes ici/);
      check('« mes commandes » sans compte : seulement connexion / creation de compte', (await chipLabels(g.page)).join('|') === 'Me connecter|👤 Créer mon compte', await chipLabels(g.page));
      check('aucune erreur (visiteur sans compte)', g.errs.length === 0, g.errs);
      await g.ctx.close();
    }

    // --- client connecte : prenom du profil, une seule fois ; Commander ouvre la commande officielle avec le panier
    {
      const uid = '11111111-1111-4111-8111-111111111111';
      const fu = {
        auth: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
        profile: { id: uid, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', banned: false, role: 'customer', is_admin: false },
      };
      const session = JSON.stringify({ access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln', refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: fu.auth });
      const itemA = { id: `${dbA.id}__nc__ns`, product: dbA, quantity: 2, color: null, size: null };
      // le panier garde un ancien prix (1 000 FCFA de moins que la base) : Zara doit annoncer le vrai prix
      const stale = { ...itemA, product: { ...dbA, price: Number(dbA.price) - 1000 } };
      const cartJson = JSON.stringify({ state: { items: [stale], updatedAt: Date.now() }, version: 0 });
      const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': session, 'albasse-cart': cartJson }, fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(3000);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Ahmed'));
      check('client connecte : salue par le prenom de son profil (Ahmed)', true);
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      await ask(c.page, 'je veux commander', /Le prix de « .* » a changé/);
      const guide = await panelOf(c.page).getByText(/Le prix de « .* » a changé/).last().innerText();
      check('prix de la base plus recent que celui du panier : Zara l\'annonce et corrige AVANT de commencer la commande', new RegExp(`${String(Number(dbA.price) - 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')}\\s?FCFA → ${String(Number(dbA.price)).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')}`).test(guide), guide);
      check('le total du chat utilise le prix verifie de la base (2 x prix)', num(await c.page.getByTestId('chat-cart-total').last().innerText()) === 2 * Number(dbA.price));
      check('rien n\'est demande tant que le client n\'a pas revu le panier (pas de question d\'adresse)', (await panelOf(c.page).getByText(/Quelle est votre adresse de livraison/).count()) === 0);
      await c.page.getByTestId('chat-cart-checkout').last().click();
      await waitText(c.page, /Quelle est votre adresse de livraison/);
      check('« Commander » : Zara finalise la commande DANS le chat (nom et telephone du compte deja connus, elle demande l\'adresse), la page de commande ne s\'ouvre pas', !/\/commande/.test(c.page.url()) && (await panelOf(c.page).count()) === 1 && (await panelOf(c.page).getByText(/Quel est le nom complet|Quel est votre numéro/).count()) === 0, c.page.url());
      const namesInBot = (await c.ctx.pages()[0].evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1') || '{"messages":[]}').messages.filter((m) => m.role === 'assistant' && /Ahmed/.test(m.text)).length));
      check('le prenom n\'est pas repete a chaque message (2 fois au plus sur toute la conversation)', namesInBot >= 1 && namesInBot <= 2, namesInBot);
      check('aucune ecriture reelle de commande', c.writes.every((w) => !/\/orders/.test(w)), c.writes);
      check('aucune erreur (client connecte)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- stock insuffisant detecte avant la commande
    {
      const uid = '11111111-1111-4111-8111-111111111111';
      const fu = {
        auth: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
        profile: { id: uid, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', banned: false, role: 'customer', is_admin: false },
      };
      const session = JSON.stringify({ access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln', refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: fu.auth });
      const itemA = { id: `${dbA.id}__nc__ns`, product: dbA, quantity: 1, color: null, size: null };
      const cartJson = JSON.stringify({ state: { items: [itemA], updatedAt: Date.now() }, version: 0 });
      const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': session, 'albasse-cart': cartJson }, fakeUser: fu });
      await c.page.route(/\/rest\/v1\/products\?.*select=id%2Cprice|\/rest\/v1\/products\?.*select=id,price/, (route) =>
        route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: dbA.id, price: dbA.price, compare_at_price: dbA.compare_at_price, stock: 0, is_active: true }]) })
      );
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(3000);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      await ask(c.page, 'mon panier', /Voici votre panier 🛒/);
      await waitText(c.page, /n’est plus disponible : retirez-le de votre panier pour commander/);
      await c.page.getByTestId('chat-cart-checkout').last().click();
      await sleep(2500);
      check('article epuise dans le panier : « Commander » est refuse (pas de page de commande), Zara explique', !/\/commande/.test(c.page.url()) && (await panelOf(c.page).getByText(/n’est plus disponible : retirez-le/).count()) >= 2, c.page.url());
      await c.ctx.close();
    }
  }

  // =============================================== P. INSTALLATION DU RACCOURCI (PWA) ===============================================
  if (PARTS.includes('P')) {
    console.log('\n== P. installation du raccourci : Android, iPhone, deja installe, ordinateur');
    const iphone = { ...devices['iPhone 13'], viewport: { width: 390, height: 800 } };
    // iPhone (Safari) : aide pas a pas, tutoriel
    {
      const v = await newVisitor(iphone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('iPhone : rien n\'est propose tant que le client n\'a pas besoin de l\'aide', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0);
      await ask(v.page, 'comment installer l’application sur mon téléphone', /Sur iPhone :/);
      const steps = await panelOf(v.page).getByText(/Sur iPhone :/).last().innerText();
      check('iPhone : Partager, puis « Sur l\'ecran d\'accueil », puis Ajouter (pas d\'installation native promise)', /Partager/.test(steps) && /Sur l’écran d’accueil/.test(steps) && /Ajouter/.test(steps) && !/Safari \(l’installation ne marche pas/.test(steps), steps);
      check('iPhone : bouton tutoriel + menu', (await chipLabels(v.page)).join('|') === '🎬 Voir le tutoriel|🏠 Menu', await chipLabels(v.page));
      await chip(v.page, 'Voir le tutoriel').click();
      await v.page.locator('video').first().waitFor({ state: 'attached', timeout: 8000 });
      check('le tutoriel video existant de l\'iPhone s\'ouvre', (await v.page.locator('video').count()) >= 1);
      check('aucune erreur (iPhone)', v.errs.length === 0, v.errs);
      await v.ctx.close();
      // iPhone mais pas Safari : il faut ouvrir Safari
      const w = await newVisitor({ ...iphone, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1' }, { storage: { albasse_zara_name: 'Ali' } });
      await w.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await w.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(w.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(w.page, 'installer', /Sur iPhone :/);
      check('iPhone avec un autre navigateur que Safari : Zara demande d\'ouvrir Safari d\'abord', (await panelOf(w.page).getByText(/Ouvrez d’abord albasseshopping\.com dans Safari/).count()) === 1);
      await w.ctx.close();
    }
    // Android : invite native apres un clic volontaire, une seule fois
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => {
        window.__fakePromptCalls = 0;
        window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('Android : aucune boite d\'installation sans geste du client', (await v.page.evaluate(() => window.__fakePromptCalls)) === 0 && (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0);
      await ask(v.page, 'installer l’application', /vous pouvez ajouter notre boutique à l’écran d’accueil de votre téléphone/);
      check('Android : « Installer Albasse Shopping » est propose quand l\'installation est disponible', (await chipLabels(v.page)).join('|') === '📲 Installer Albasse Shopping|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Installer Albasse Shopping').click();
      await waitText(v.page, /C’est installé !/);
      check('Android : l\'invite native est ouverte par le clic du client, le choix « accepte » est respecte', (await v.page.evaluate(() => window.__fakePromptCalls)) === 1);
      check('le site reste utilisable (le champ de saisie fonctionne)', await inputOf(v.page).isEnabled());
      await v.ctx.close();
      // refus
      const d = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await d.ctx.addInitScript(() => {
        window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      });
      await d.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await d.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(d.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(d.page, 'installer', /ajouter notre boutique/);
      await chip(d.page, 'Installer Albasse Shopping').click();
      await waitText(d.page, /Pas de souci 😊 Vous pourrez le faire plus tard/);
      check('Android : refus dans la boite native -> message poli, aucune insistance', (await d.page.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_install')).outcome)) === 'dismissed');
      await d.ctx.close();
    }
    // Android : proposition automatique apres le premier ajout au panier, une seule fois, avec « Plus tard »
    {
      const all = await get('products?select=id,name,slug,price,stock,sizes,colors,images&is_active=eq.true&stock=gt.3&limit=1000');
      const BAD = /montre|parfum|chaussure|sac|robe|homme|femme|enfant|bebe|lunette|cadeau|sandale|basket|veste|costume|chemise|pantalon|creme|jouet|velo|meuble|maison|electri|voiture|aliment|budget|panier|promo|livraison|conseil|ajout|total/i;
      const p = all.find((x) => (x.images || [])[0] && /^[A-Za-zÀ-ÿ]{4,14}$/.test(x.name.trim()) && !BAD.test(x.name) && all.filter((y) => y.name.trim() === x.name.trim()).length === 1 && (x.sizes || []).length === 0 && (x.colors || []).length <= 1);
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => { window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, p.name.trim(), new RegExp(`Voici ce que j’ai trouvé pour « ${p.name.trim()} »`));
      const card = cardsOf(v.page).filter({ hasText: p.name.trim() }).first();
      await card.waitFor({ timeout: 10000 });
      await waitText(v.page, /Astuce : installez Albasse Shopping/);
      check('Android : sous les articles trouves, le bouton « Installer Albasse Shopping »', (await chipLabels(v.page)).includes('📲 Installer Albasse Shopping'), await chipLabels(v.page));
      await card.getByTestId('assistant-card-add').click();
      await waitText(v.page, /ajouté au panier/);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('Android : apres le premier ajout au panier, Zara propose d\'installer (au bon moment)', true);
      check('boutons : ceux du panier restent, puis installer + plus tard', (await chipLabels(v.page)).join('|') === '🛒 Voir mon panier|✅ Commander|🛍️ Autres articles|🎁 Emballage cadeau|📲 Installer Albasse Shopping|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Plus tard').click();
      await waitText(v.page, /je ne vous le propose plus pour le moment/);
      await card.getByTestId('assistant-card-add').click();
      await sleep(2200);
      check('la proposition n\'est pas repetee (apres un 2e ajout, toujours une seule)', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 1);
      await v.page.reload({ waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await sleep(1200);
      check('apres « Plus tard » et rechargement : pas de nouvelle proposition (pause de 14 jours)', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 1);
      check('aucune erreur (Android)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Android avec invite : bouton « Installer » dans le menu, proposition apres deux messages (une seule fois), bouton retire apres « Plus tard »
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => {
        window.__fakePromptCalls = 0;
        window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      const menu = await chipLabels(v.page);
      check('Android, pas encore installe : le menu a un bouton « Installer Albasse Shopping » (juste avant WhatsApp), sans message insistant', menu.includes('📲 Installer Albasse Shopping') && menu.indexOf('📲 Installer Albasse Shopping') === menu.indexOf('💬 WhatsApp') - 1 && (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0, menu);
      await v.page.screenshot({ path: path.join(OUT, 'P1-menu-installer.png') });
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(1500);
      check('apres UN seul message du client : toujours pas de proposition (on le laisse discuter)', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('apres DEUX messages : Zara demande « Avez-vous deja installe l\'application ? » avec « Installer », « Oui, deja installee » et « Plus tard »', (await chipLabels(v.page)).join('|') === '📲 Installer Albasse Shopping|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await v.page.screenshot({ path: path.join(OUT, 'P2-proposition-installer.png') });
      await ask(v.page, 'promotions', /promotion|promo|offre/i);
      await sleep(3500);
      check('la proposition n\'est pas repetee apres le 3e message', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 1);
      await chip(v.page, 'Menu').first().click();
      await sleep(1800);
      check('le bouton « Installer » reste dans le menu tant que le client n\'a pas dit non', (await chipLabels(v.page)).includes('📲 Installer Albasse Shopping'), await chipLabels(v.page));
      await chip(v.page, 'Installer Albasse Shopping').first().click();
      await waitText(v.page, /Pas de souci 😊 Vous pourrez le faire plus tard/);
      check('le client refuse dans la boite de Chrome : message poli, aucune insistance', (await v.page.evaluate(() => window.__fakePromptCalls)) === 1 && (await v.page.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_install')).outcome)) === 'dismissed');
      await ask(v.page, 'promotions', /promotion|promo|offre/i);
      await chip(v.page, 'Menu').first().click();
      await sleep(1800);
      check('apres un refus : le bouton « Installer » n\'est plus dans le menu (pause de 14 jours)', (await chipLabels(v.page)).every((l) => !/Installer Albasse Shopping/.test(l)), await chipLabels(v.page));
      check('aucune erreur (Android, proposition)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Android avec invite, en arabe
    {
      const v = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      await v.ctx.addInitScript(() => {
        window.__fakePromptCalls = 0;
        window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: /التحدث مع زارا كينغز/ }).click();
      await waitText(v.page, /أنشئ حسابك المجاني|إنشاء حسابي/);
      const menuAr = await chipLabels(v.page);
      check('en arabe : le menu a le bouton « تثبيت Albasse Shopping »', menuAr.includes('📲 تثبيت Albasse Shopping'), menuAr);
      await chip(v.page, 'تثبيت Albasse Shopping').first().click();
      await waitText(v.page, /تم التثبيت!/);
      check('en arabe : le bouton ouvre l\'invite de Chrome (une fois) et Zara confirme', (await v.page.evaluate(() => window.__fakePromptCalls)) === 1);
      check('aucune erreur (arabe, installation)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // iPhone : bouton « Ajouter a l'ecran d'accueil » dans le menu -> les etapes ; proposition apres deux messages
    {
      const v = await newVisitor(iphone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      const menu = await chipLabels(v.page);
      check('iPhone : le menu a le bouton « Voir comment installer » (juste avant WhatsApp)', menu.includes('📲 Voir comment installer') && menu.indexOf('📲 Voir comment installer') === menu.indexOf('💬 WhatsApp') - 1, menu);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await waitText(v.page, /Astuce : installez Albasse Shopping sur votre écran d’accueil/);
      const promoChips = await chipLabels(v.page);
      check('iPhone : sous les articles proposes, le bouton « Voir comment installer » (juste avant Menu) + l\'astuce une seule fois', promoChips.includes('📲 Voir comment installer') && promoChips.indexOf('📲 Voir comment installer') === promoChips.indexOf('🏠 Menu') - 1 && (await panelOf(v.page).getByText(/Astuce : installez Albasse Shopping/).count()) === 1, promoChips);
      check('iPhone : apres un seul message, pas de proposition', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('iPhone : apres deux messages, Zara propose l\'aide pas a pas (une seule fois)', (await chipLabels(v.page)).join('|') === '📲 Voir comment installer|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Voir comment installer').click();
      await waitText(v.page, /Sur iPhone :/);
      check('iPhone : le bouton donne les etapes (Partager, puis Sur l\'ecran d\'accueil, puis Ajouter)', /Partager/.test(await panelOf(v.page).getByText(/Sur iPhone :/).last().innerText()));
      check('aucune erreur (iPhone, proposition)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // « Oui, deja installee » : Zara remercie et ne propose plus rien (ni la question, ni le bouton du menu), meme apres un rechargement
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => { window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(1500);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      const q = await panelOf(v.page).getByText(/Avez-vous déjà installé l’application/).first().innerText();
      check('la question de Zara : « Avez-vous deja installe l\'application ? » + ce que ca apporte (commander plus vite, suivre ses commandes)', /sur votre téléphone \?/.test(q) && /commandez plus vite/.test(q) && /suivez vos commandes/.test(q), q);
      await chip(v.page, 'Oui, déjà installée').click();
      await waitText(v.page, /Parfait, merci ! 🎉 Vous faites déjà partie de la famille Albasse Shopping/);
      check('« Oui, deja installee » : Zara remercie, c\'est note comme deja installe (plus jamais propose)', (await v.page.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_install')).outcome)) === 'accepted');
      await chip(v.page, 'Menu').first().click();
      await sleep(1800);
      check('apres « Oui, deja installee » : le bouton « Installer » n\'est plus dans le menu', (await chipLabels(v.page)).every((l) => !/Installer Albasse Shopping|Voir comment installer/.test(l)), await chipLabels(v.page));
      await v.page.reload({ waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await sleep(1500);
      check('apres un rechargement : la question n\'est pas reposee', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application/).count()) === 1);
      check('aucune erreur (Oui, deja installee)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // iPhone : « Voir comment installer » envoie les etapes ET la photo pas a pas (4 images du tutoriel) ; la photo s'ouvre en grand ; elle reste apres un rechargement
    {
      const v = await newVisitor(iphone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('iPhone : pas de photo envoyee tant que le client ne la demande pas', (await v.page.getByTestId('assistant-photo').count()) === 0);
      await chip(v.page, 'Voir comment installer').click();
      await waitText(v.page, /Sur iPhone :/);
      const photo = v.page.getByTestId('assistant-photo');
      await photo.waitFor({ timeout: 10000 });
      const img = photo.locator('img').first();
      await img.waitFor({ state: 'attached', timeout: 10000 });
      await v.page.waitForFunction(() => { const i = document.querySelector('[data-testid="assistant-photo"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
      const info = await img.evaluate((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, shownW: Math.round(i.getBoundingClientRect().width) }));
      check('iPhone : la photo « comment installer » est envoyee et se charge (1120 x 1960, a la bonne taille dans la bulle)', /\/ios-installer-photo\.jpg$/.test(info.src) && info.w === 1120 && info.h === 1960 && info.shownW >= 200 && info.shownW <= 300, info);
      const txt = await panelOf(v.page).getByText(/Sur iPhone :/).last().innerText();
      check('iPhone : les etapes ecrites + « Touchez-la pour l\'agrandir » + boutons tutoriel video et menu', /Partager/.test(txt) && /Touchez-la pour l’agrandir/.test(txt) && (await chipLabels(v.page)).join('|') === '🎬 Voir le tutoriel|🏠 Menu', { txt, chips: await chipLabels(v.page) });
      check('la photo a un texte alternatif (lecteurs d\'ecran)', /Comment installer Albasse Shopping sur iPhone/.test((await photo.getAttribute('aria-label')) || ''));
      await v.page.screenshot({ path: path.join(OUT, 'P3-photo-iphone.png') });
      const [pop] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), photo.click()]);
      check('toucher la photo l\'ouvre en grand dans un nouvel onglet', /\/ios-installer-photo\.jpg$/.test(pop.url()), pop.url());
      await pop.close();
      await v.page.reload({ waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await sleep(1500);
      check('apres un rechargement : la conversation garde la photo', (await v.page.getByTestId('assistant-photo').count()) === 1);
      check('aucune erreur (iPhone, photo)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // iPhone en arabe : les etapes en arabe + la meme photo
    {
      const v = await newVisitor(iphone, { lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: /التحدث مع زارا كينغز/ }).click();
      await waitText(v.page, /أنشئ حسابك المجاني|إنشاء حسابي/);
      check('iPhone en arabe : le menu a le bouton « شاهد كيفية التثبيت »', (await chipLabels(v.page)).includes('📲 شاهد كيفية التثبيت'), await chipLabels(v.page));
      await chip(v.page, 'شاهد كيفية التثبيت').first().click();
      await waitText(v.page, /على الآيفون:/);
      await v.page.getByTestId('assistant-photo').waitFor({ timeout: 10000 });
      check('iPhone en arabe : etapes en arabe + la photo + « المسها لتكبيرها »', (await panelOf(v.page).getByText(/المسها لتكبيرها/).count()) === 1 && (await v.page.getByTestId('assistant-photo').count()) === 1);
      check('aucune erreur (iPhone, arabe)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Visiteur tout neuf (iPhone, ni langue ni prenom retenus) : choisir la langue et « Passer » ne comptent pas ; la question vient apres 2 vrais messages
    {
      const v = await newVisitor(iphone, { lang: null });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Choisissez votre langue/);
      await tap(v.page, 'Français', /Bienvenue chez Albasse Shopping/);
      await waitText(v.page, /Comment puis-je vous appeler/);
      await chip(v.page, 'Passer').click();
      await waitText(v.page, /Créez votre compte gratuit/);
      await sleep(2500);
      const menu = await chipLabels(v.page);
      check('visiteur tout neuf : la langue et « Passer » ne comptent pas, la question n\'arrive pas pendant la presentation (le menu reste)', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application/).count()) === 0 && menu.includes('🔥 Promotions') && menu.includes('📲 Voir comment installer'), menu);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(2500);
      check('apres UN vrai message : toujours pas de question', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application/).count()) === 0);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('apres DEUX vrais messages : la question arrive (iPhone : « Voir comment installer »)', (await chipLabels(v.page)).join('|') === '📲 Voir comment installer|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Plus tard').click();
      await waitText(v.page, /je ne vous le propose plus pour le moment/);
      const back = await chipLabels(v.page);
      check('« Plus tard » : Zara rend les boutons habituels (promotions, categories, menu), le client n\'est jamais bloque', back.includes('🏠 Menu') && back.includes('🔥 Promotions'), back);
      await chip(v.page, 'Promotions').last().click();
      await sleep(3500);
      const later = await chipLabels(v.page);
      check('apres « Plus tard » : plus de bouton d\'installation sous les articles proposes', later.includes('🏠 Menu') && later.every((l) => !/Voir comment installer|Installer Albasse Shopping/.test(l)), later);
      const oldAfter = (await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts()).map((t) => t.trim());
      check('apres « Plus tard » : les anciens boutons d\'installation partent aussi (les autres restent)', oldAfter.includes('🔥 Promotions') && oldAfter.every((l) => !/Voir comment installer|Installer Albasse Shopping|Plus tard|Oui, déjà installée/.test(l)), oldAfter);
      check('aucune erreur (visiteur tout neuf)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Android sans invite disponible : pas de bouton, seulement l'explication quand le client la demande
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, 'installer', /trois points/);
      check("Android sans invite disponible : aucun bouton « Installer », seulement l'explication a la demande", (await chipLabels(v.page)).every((l) => !/Installer/.test(l)), await chipLabels(v.page));
      await v.ctx.close();
    }
    // deja installe (mode application) et ordinateur
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => {
        const mm = window.matchMedia.bind(window);
        window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
        window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, 'installer l’application', /est déjà installé sur votre téléphone/);
      check('deja installe (mode application) : Zara le dit et ne propose rien', (await chipLabels(v.page)).every((l) => !/Installer/.test(l)));
      await ask(v.page, 'promotions', /promotion|promo|offre/i);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await sleep(2500);
      check('deja installe : ni bouton « Installer » dans le menu, ni proposition apres plusieurs messages', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0 && (await chipLabels(v.page)).every((l) => !/Installer|Voir comment installer|Oui, déjà installée/.test(l)), await chipLabels(v.page));
      await v.ctx.close();
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { storage: { albasse_zara_name: 'Ali' } });
      await d.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await d.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(d.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(d.page, 'installer', /Pour installer : cliquez sur l’icône d’installation/);
      check('ordinateur : explication pour la barre d\'adresse (pas de proposition sur ecran d\'ordinateur)', true);
      await d.ctx.close();
    }
  }

  // =============================================== M. CLIENT AVEC COMPTE : RECONNU ET SALUE PAR SON PRENOM ===============================================
  if (PARTS.includes('M')) {
    console.log('\n== M. client avec compte : reconnu et salue par son prenom, avec honneur (francais et arabe)');
    const uid = '11111111-1111-4111-8111-111111111111';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    // un compte simule : `session` est ce que le navigateur garde quand le client est deja connecte, `token` la reponse a une connexion par mot de passe
    const memberOf = (fullName, extra = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'test@example.com', full_name: fullName, phone: '66123456', banned: false, role: 'customer', is_admin: false }, ...extra };
    };
    const loggedIn = (fu) => ({ 'sb-xtitsmmccpkelxfjyqyh-auth-token': fu.session });
    const MEMBER_FR = WELCOME_FR('Ahmed');
    const countOf = (p, re) => panelOf(p).getByText(re).count();
    const closeChat = (p) => panelOf(p).getByRole('button', { name: /^(Fermer|إغلاق)$/ }).click();
    const openFab = (p) => p.getByRole('button', { name: /Discuter avec Zara Kings|التحدث مع زارا كينغز/ }).click();

    // --- M1. 1re visite (aucune langue retenue) : le tout premier message salue par le prenom ET demande la langue
    {
      const fu = memberOf('Ahmed Hassan');
      const c = await newVisitor(phone, { lang: null, storage: loggedIn(fu), fakeUser: fu });
      const t0 = Date.now();
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await sleep(1500);
      const typingDuringWait = await c.page.getByLabel(TYPING).count();
      const noMessageYet = (await countOf(c.page, /Salut Ahmed/)) === 0;
      await waitText(c.page, /Salut Ahmed ! 😍👋/);
      const waited = Date.now() - t0;
      check('client connecte : Zara attend 10 secondes apres sa connexion avant de saluer (les trois points s\'affichent pendant l\'attente)', typingDuringWait >= 1 && noMessageYet && waited >= 9500 && waited < 20000, { typingDuringWait, noMessageYet, waitedMs: waited });
      await waitText(c.page, /Choisissez votre langue \/ اختر لغتك/);
      const first = await panelOf(c.page).getByText(/Choisissez votre langue/).first().innerText();
      check('1re visite, client avec compte : le tout premier message dit son prenom (francais + arabe) puis demande la langue', /^Salut Ahmed ! 😍👋\s*\n\s*مرحباً Ahmed! 😍👋\s*\n\s*Choisissez votre langue \/ اختر لغتك/.test(first), first);
      check('seuls deux boutons : Francais / arabe (et aucune langue retenue avant son choix)', (await chipLabels(c.page)).join('|') === 'Français|العربية' && (await c.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === null, await chipLabels(c.page));
      check('Zara ne demande pas le prenom d\'un client qui a un compte', (await countOf(c.page, /Comment puis-je vous appeler/)) === 0);
      await c.page.screenshot({ path: path.join(OUT, 'M1-premier-message.png') });
      await tap(c.page, 'Français', /Bienvenue chez Albasse Shopping ! Ça me fait plaisir de vous accueillir ! 🥰🛍️/);
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      check('apres le choix du francais : accueil SANS redire « Salut » ni le prenom une 2e fois', (await countOf(c.page, /Bonjour/)) === 0 && (await countOf(c.page, /Salut Ahmed/)) === 1 && (await countOf(c.page, /Comment puis-je vous appeler/)) === 0);
      const labels = await chipLabels(c.page);
      check('client avec compte : ni « Creer mon compte » ni « Me connecter » ; « Mes commandes » propose', !labels.some((l) => /Créer mon compte|Me connecter/.test(l)) && labels.includes('📦 Mes commandes'), labels);
      check('la langue choisie est retenue (fr)', (await c.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'fr');
      await c.page.screenshot({ path: path.join(OUT, 'M2-accueil-honneur.png') });
      check('aucune erreur (client avec compte, 1re visite)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- M2. pareil en arabe
    {
      const fu = memberOf('Ahmed Hassan');
      const c = await newVisitor(phone, { lang: null, storage: loggedIn(fu), fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, /Salut Ahmed ! 😍👋/);
      await tap(c.page, 'العربية', /أهلاً بك في Albasse Shopping! يسعدني استقبالك! 🥰🛍️/);
      await waitText(c.page, /معلومات مهمة قبل الطلب/);
      await waitText(c.page, 'ماذا تريد أن تكتشف اليوم؟ 🛍️');
      const labels = await chipLabels(c.page);
      check('en arabe : accueil sans repeter le prenom, sans question de prenom ni de compte a creer', (await countOf(c.page, /مرحباً/)) === 1 && (await countOf(c.page, /Ahmed/)) === 1 && (await countOf(c.page, /كيف يمكنني أن أناديك/)) === 0 && !labels.some((l) => /إنشاء حسابي|تسجيل الدخول/.test(l)) && labels.includes('📦 طلباتي'), labels);
      const dir = await panelOf(c.page).getByText(/أهلاً بك في Albasse Shopping! يسعدني استقبالك!/).first().evaluate((el) => getComputedStyle(el).direction);
      check('la salutation arabe s\'ecrit de droite a gauche', dir === 'rtl', dir);
      await c.page.screenshot({ path: path.join(OUT, 'M3-arabe.png') });
      check('aucune erreur (client avec compte, arabe)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- M3. langue deja retenue : un seul message de bienvenue d'honneur ; jamais salue deux fois (fermer/rouvrir, recharger)
    {
      const fu = memberOf('Ahmed Hassan');
      const c = await newVisitor(phone, { lang: 'fr', storage: loggedIn(fu), fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, MEMBER_FR);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      check('langue deja retenue : pas de question de langue, un seul accueil', (await countOf(c.page, /Choisissez votre langue/)) === 0 && (await countOf(c.page, /Salut Ahmed/)) === 1);
      await closeChat(c.page);
      await openFab(c.page);
      await sleep(2500);
      check('fermer puis rouvrir le chat : pas de nouvelle salutation', (await countOf(c.page, /Salut Ahmed/)) === 1 && (await countOf(c.page, /Vous êtes bien connecté/)) === 0);
      await c.page.reload({ waitUntil: 'load' });
      await sleep(3000);
      await openFab(c.page);
      await sleep(3000);
      check('apres un rechargement de la page : la conversation revient et il n\'est pas salue une 2e fois', (await countOf(c.page, /Salut Ahmed/)) === 1 && (await countOf(c.page, /Vous êtes bien connecté/)) === 0 && (await countOf(c.page, /Comment puis-je vous appeler/)) === 0);
      check('aucune erreur (bienvenue unique)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- M4. nom du profil ecrit en majuscules, avec un titre : « Mr MAHAMAT ABDERAMAN » -> Mahamat
    {
      const fu = memberOf('Mr MAHAMAT ABDERAMAN');
      const c = await newVisitor(phone, { lang: 'fr', storage: loggedIn(fu), fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, WELCOME_FR('Mahamat'));
      check('« Mr MAHAMAT ABDERAMAN » : salue « Mahamat » (ni « Mr », ni « MAHAMAT » en majuscules)', (await countOf(c.page, /Salut Mr|MAHAMAT/)) === 0);
      await c.ctx.close();
    }

    // --- M5. le compte met du temps a se charger (2,5 s) : le site attend (page de chargement), puis Zara salue par le prenom
    {
      const fu = memberOf('Ahmed Hassan', { delay: 2500 });
      const c = await newVisitor(phone, { lang: 'fr', storage: loggedIn(fu), fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await openFab(c.page);
      await waitText(c.page, MEMBER_FR);
      check('compte lent a charger : Zara salue Ahmed, elle ne demande pas le prenom', !!fu.servedAt && (await countOf(c.page, /Comment puis-je vous appeler/)) === 0 && (await countOf(c.page, /Salut Ahmed/)) === 1);
      await c.ctx.close();
    }

    // --- M6. visiteur qui a deja un compte mais n'est pas connecte : « Me connecter » depuis Zara, puis il est reconnu (telephone)
    {
      const fu = memberOf('Ahmed Hassan');
      const c = await newVisitor(phone, { lang: 'fr', fakeUser: fu }); // aucune session gardee : il arrive comme un visiteur
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, /Comment puis-je vous appeler \? Si vous avez déjà un compte, connectez-vous : je vous reconnaîtrai 😊/);
      check('visiteur sans compte connecte : Zara propose de se connecter pour etre reconnue (Passer / Me connecter / arabe)', (await chipLabels(c.page)).join('|') === 'Passer|Me connecter|🌐 العربية', await chipLabels(c.page));
      await c.page.screenshot({ path: path.join(OUT, 'M4-visiteur-connexion.png') });
      await chip(c.page, 'Me connecter').click();
      await c.page.waitForURL(/\/connexion/, { timeout: 15000 });
      await c.page.getByPlaceholder('Email').fill('test@example.com');
      await c.page.getByPlaceholder('Mot de passe').fill('motdepasse-test');
      await c.page.getByText('Se connecter', { exact: true }).first().click();
      await c.page.waitForURL((url) => !/\/connexion/.test(url.pathname), { timeout: 20000 });
      await sleep(1000);
      await openFab(c.page);
      await waitText(c.page, /Salut Ahmed ! 😍👋 Vous êtes bien connecté\(e\), ça me fait plaisir de vous retrouver ! 🥰/, 20000);
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      const labels = await chipLabels(c.page);
      check('apres la connexion : Zara salue Ahmed par son prenom, puis continue (infos, menu de client connecte)', labels.includes('📦 Mes commandes') && !labels.some((l) => /Créer mon compte|Me connecter/.test(l)), labels);
      await c.page.screenshot({ path: path.join(OUT, 'M5-apres-connexion.png') });
      await closeChat(c.page);
      await openFab(c.page);
      await sleep(2500);
      check('fermer puis rouvrir : la salutation de connexion n\'est dite qu\'une fois', (await countOf(c.page, /Vous êtes bien connecté/)) === 1);
      check('aucune ecriture reelle dans la base (connexion simulee)', c.writes.every((w) => /visitor_sessions|profiles/.test(w)), c.writes);
      check('aucune erreur (connexion depuis Zara)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- M7. ordinateur : le chat reste ouvert pendant la connexion, Zara salue des que le client est connecte
    {
      const fu = memberOf('Fatimé Ali');
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { lang: 'fr', fakeUser: fu });
      await d.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(d.page);
      await waitText(d.page, /Comment puis-je vous appeler \? Si vous avez déjà un compte/);
      await chip(d.page, 'Me connecter').click();
      await d.page.waitForURL(/\/connexion/, { timeout: 15000 });
      check('ordinateur : le chat reste ouvert pendant que le client se connecte', (await panelOf(d.page).count()) === 1);
      await d.page.getByPlaceholder('Email').fill('test@example.com');
      await d.page.getByPlaceholder('Mot de passe').fill('motdepasse-test');
      await d.page.getByText('Se connecter', { exact: true }).first().click();
      await waitText(d.page, /Salut Fatimé ! 😍👋 Vous êtes bien connecté\(e\), ça me fait plaisir de vous retrouver ! 🥰/, 25000);
      check('ordinateur : Zara salue Fatimé tout de suite apres la connexion, sans rouvrir le chat', (await countOf(d.page, /Salut Fatimé/)) === 1);
      await d.page.screenshot({ path: path.join(OUT, 'M6-ordinateur.png') });
      await d.ctx.close();
    }

    // --- M9. « Vous etes mon Ne client aujourd'hui » : le VRAI rang du jour, donne par la base, jamais invente
    {
      const SAMPLE = 'Salut Moussa ! 😍👋 Bienvenue chez Albasse Shopping ! Vous êtes mon 3ᵉ client aujourd’hui, ça me fait plaisir de vous accueillir ! 🥰🛍️\n' + INVITE_FR;
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, rank: 3 });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(v.page);
      await waitText(v.page, /Vous êtes mon 3ᵉ client aujourd’hui/);
      const bubble = (await panelOf(v.page).getByText(/Vous êtes mon 3ᵉ client aujourd’hui/).first().innerText()).replace(/[ \t]+/g, ' ').trim();
      check('accueil = exactement l\'exemple du patron (prenom, 3ᵉ client, invitation, emojis)', bubble === SAMPLE, bubble);
      check('le rang vient bien de la base (une seule demande)', v.rpcCalls.length === 1, v.rpcCalls.length);
      const stored = await v.page.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_rank') || 'null'));
      check('le rang est retenu pour la journee sur l\'appareil (il n\'est compte qu\'une fois)', stored && stored.n === 3 && /^\d{4}-\d{2}-\d{2}$/.test(stored.day), stored);
      await v.page.screenshot({ path: path.join(OUT, 'M7-vrai-rang.png') });
      // meme appareil, nouvel onglet, meme jour : meme rang, pas de nouveau comptage
      const tab = await v.ctx.newPage();
      await tab.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(tab);
      await waitText(tab, /Vous êtes mon 3ᵉ client aujourd’hui/);
      check('meme appareil, meme jour : toujours « mon 3ᵉ client » et aucun nouveau comptage', v.rpcCalls.length === 1, v.rpcCalls.length);
      check('aucune erreur (rang du jour)', v.errs.length === 0, v.errs);
      await v.ctx.close();

      // un autre jour : nouvelle demande, nouveau rang (4)
      const y = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa', albasse_zara_rank: JSON.stringify({ day: '2020-01-01', n: 99 }) }, rank: 4 });
      await y.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(y.page);
      await waitText(y.page, /Vous êtes mon 4ᵉ client aujourd’hui/);
      check('le lendemain : nouvelle demande a la base et nouveau rang (pas l\'ancien 99)', y.rpcCalls.length === 1 && (await countOf(y.page, /99/)) === 0, y.rpcCalls.length);
      await y.ctx.close();

      // 1er client du jour : « 1ᵉʳ »
      const f = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, rank: 1 });
      await f.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(f.page);
      await waitText(f.page, /Vous êtes mon 1ᵉʳ client aujourd’hui/);
      check('le tout premier client du jour : « mon 1ᵉʳ client »', true);
      await f.ctx.close();

      // en arabe
      const a = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' }, rank: 3 });
      await a.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(a.page);
      await waitText(a.page, /أنت رقم 3 بين عملائي اليوم، ويسعدني استقبالك!/);
      check('en arabe : « أنت رقم 3 بين عملائي اليوم »', (await countOf(a.page, /مرحباً علي! 😍👋/)) === 1);
      await a.ctx.close();

      // fonction absente (pas encore installee) ou reponse bizarre : AUCUN nombre n'est dit
      for (const [label, rankValue] of [['fonction pas installee', null], ['reponse incorrecte (texte)', 'abc'], ['reponse incorrecte (zero)', 0], ['reponse incorrecte (negatif)', -5]]) {
        const n = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, rank: rankValue });
        await n.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
        await sleep(2500);
        await openFab(n.page);
        await waitText(n.page, WELCOME_FR('Moussa'));
        check(`${label} : Zara accueille sans dire de nombre (rien d'invente)`, (await countOf(n.page, /client aujourd/)) === 0 && (await n.page.evaluate(() => localStorage.getItem('albasse_zara_rank'))) === null);
        await n.ctx.close();
      }
    }

    // --- M8. la bulle de bienvenue du bouton salue le client avec compte par son prenom (fr et ar)
    for (const [lg, expected] of [['fr', /Salut Ahmed ! 😍👋 Zara Kings est à votre service 🛍️/], ['ar', /مرحباً Ahmed! 😍👋 زارا كينغز في خدمتك 🛍️/]]) {
      const fu = memberOf('Ahmed Hassan');
      const c = await newVisitor(phone, { lang: lg, storage: loggedIn(fu), fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(7500);
      const tooEarly = await c.page.getByText(expected).count();
      await sleep(5000);
      const n = await c.page.getByText(expected).count();
      check(`bulle du bouton (${lg}) : pas avant 10 secondes, puis le client avec compte est accueilli par son prenom`, tooEarly === 0 && n === 1, { tooEarly, n });
      await c.ctx.close();
    }

    // --- M10. compte connecte SANS prenom (profil sans nom) : Zara voit qu'il est connecte, demande le prenom sans l'inviter a se connecter, puis le retient
    for (const [lg, askRe, niceRe, typed, skipLabel] of [['fr', /Je vois que vous êtes connecté\(e\)/, /Enchantée Fadoul/, 'Fadoul', 'Passer'], ['ar', /أرى أنك مسجّل الدخول/, /سعدت بمعرفتك يا Fadoul/, 'Fadoul', null]]) {
      const fu = memberOf(null);
      const c = await newVisitor(phone, { lang: lg, storage: loggedIn(fu), fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, askRe);
      const labels = await chipLabels(c.page);
      check(`connecte sans prenom (${lg}) : Zara dit qu'elle le voit connecte, sans « connectez-vous » ni bouton « Me connecter »`, (await countOf(c.page, /connectez-vous|déjà un compte|سجّل الدخول وسأتعرف|إذا كان لديك حساب/)) === 0 && !labels.some((l) => /Me connecter|تسجيل الدخول|Créer mon compte|إنشاء حسابي/.test(l)), labels);
      if (skipLabel) check(`connecte sans prenom (${lg}) : il peut passer`, labels.includes(skipLabel), labels);
      await c.page.screenshot({ path: path.join(OUT, `M10-sans-prenom-${lg}.png`) });
      await ask(c.page, typed, niceRe);
      check(`connecte sans prenom (${lg}) : le prenom donne est retenu sur l'appareil`, (await c.page.evaluate(() => localStorage.getItem('albasse_zara_name'))) === typed);
      await waitText(c.page, lg === 'fr' ? 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️' : 'ماذا تريد أن تكتشف اليوم؟ 🛍️');
      const menu = await chipLabels(c.page);
      check(`connecte sans prenom (${lg}) : le menu est celui d'un client connecte (Mes commandes, pas de creation de compte)`, menu.includes(lg === 'fr' ? '📦 Mes commandes' : '📦 طلباتي') && !menu.some((l) => /Créer mon compte|Me connecter|إنشاء حسابي|تسجيل الدخول/.test(l)), menu);
      check(`aucune erreur (connecte sans prenom, ${lg})`, c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    // prochaine visite sur cet appareil : le prenom retenu sert, Zara ne le redemande pas
    {
      const fu = memberOf(null);
      const c = await newVisitor(phone, { lang: 'fr', storage: { ...loggedIn(fu), albasse_zara_name: 'Fadoul' }, fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, WELCOME_FR('Fadoul'));
      await sleep(1500);
      check('connecte sans prenom, prenom deja retenu sur l\'appareil : accueil par son prenom, Zara ne le redemande pas', (await countOf(c.page, /Comment puis-je vous appeler|Je vois que vous êtes connecté/)) === 0);
      check('aucune erreur (connecte sans prenom, prenom retenu)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
  }

  // =============================================== R. PROFIL CLIENT MODIFIABLE : NOM, TELEPHONE, ADRESSE ===============================================
  if (PARTS.includes('R')) {
    console.log('\n== R. profil client modifiable : nom, telephone, WhatsApp, adresse (bouton « Modifier mon profil »)');
    const uid = '11111111-1111-4111-8111-111111111111';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const accountOf = (profile = {}, opts = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], ...opts, profile: { id: uid, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, ...profile } };
    };
    const openAccount = async (fu) => {
      const c = await newVisitor(phone, { lang: 'fr', storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': fu.session }, fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/compte`, { waitUntil: 'load' });
      await c.page.getByTestId('profile-edit-open').waitFor({ timeout: 25000 });
      return c;
    };
    const input = (c, id) => c.page.getByTestId('profile-input-' + id);
    const fillIn = (c, id, value) => input(c, id).fill(value);
    const save = (c) => c.page.getByText('Enregistrer', { exact: true }).click();
    const editorOpen = (c) => c.page.getByTestId('profile-editor').count().then((n) => n === 1);
    const pageHas = (c, re) => c.page.getByText(re).count();
    const openEditor = async (c) => {
      await c.page.getByTestId('profile-edit-open').click();
      await c.page.getByTestId('profile-editor').waitFor({ timeout: 10000 });
    };

    // --- R1. le parcours complet : on ouvre, on change nom + telephone + adresse (+ WhatsApp), on enregistre ; tout est a jour partout, Zara dit le nouveau prenom
    {
      const fu = accountOf();
      const c = await openAccount(fu);
      check('page Compte : le telephone enregistre est affiche, pas d\'adresse encore', (await pageHas(c, '📞 66123456')) === 1 && (await pageHas(c, /^📍/)) === 0);
      await openEditor(c);
      const before = { name: await input(c, 'fullName').inputValue(), phone: await input(c, 'phone').inputValue(), wa: await input(c, 'whatsapp').inputValue(), country: await input(c, 'country').inputValue(), address: await input(c, 'address').inputValue() };
      check('le formulaire s\'ouvre rempli avec les informations du compte', before.name === 'Ahmed Hassan' && before.phone === '66123456' && before.wa === '' && before.country === 'Tchad' && before.address === '', before);
      await save(c);
      await sleep(700);
      check('rien n\'a change : « Enregistrer » ne fait rien (aucune demande envoyee a la base)', fu.patches.length === 0 && (await editorOpen(c)));
      await fillIn(c, 'fullName', 'Fadoul Mahamat');
      await fillIn(c, 'phone', '99221017');
      await c.page.getByText('Même numéro que mon téléphone').click();
      check('« Même numéro que mon téléphone » recopie le telephone dans WhatsApp', (await input(c, 'whatsapp').inputValue()) === '99221017');
      await fillIn(c, 'address', "Quartier Chagoua, N'Djamena");
      await c.page.screenshot({ path: path.join(OUT, 'R1-formulaire.png') });
      await save(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('une seule demande envoyee, avec exactement les 7 informations (jamais de points, d\'admin ou d\'e-mail)', fu.patches.length === 1 && JSON.stringify(fu.patches[0]) === JSON.stringify({ full_name: 'Fadoul Mahamat', phone: '99221017', whatsapp_number: '99221017', profession: null, region: null, country: 'Tchad', address: "Quartier Chagoua, N'Djamena" }), fu.patches);
      check('message de confirmation affiche, le formulaire se ferme', (await pageHas(c, 'Vos informations ont été mises à jour.')) >= 1 && !(await editorOpen(c)));
      check('la carte du compte montre tout de suite le nouveau nom, telephone et adresse', (await pageHas(c, 'Fadoul Mahamat')) >= 1 && (await pageHas(c, '📞 99221017')) === 1 && (await pageHas(c, "📍 Quartier Chagoua, N'Djamena")) === 1 && (await pageHas(c, 'Ahmed Hassan')) === 0);
      await c.page.screenshot({ path: path.join(OUT, 'R2-apres-enregistrement.png') });
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Fadoul'), 30000);
      const oldName = await panelOf(c.page).getByText(/Salut Ahmed/).count();
      check('Zara salue le client par son NOUVEAU prenom (Fadoul), plus par l\'ancien', oldName === 0, oldName);
      check('aucune erreur (modification du profil)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- R2. numero invalide : le message s'affiche sous le champ, rien n'est envoye ; on corrige, ca s'enregistre
    {
      const fu = accountOf();
      const c = await openAccount(fu);
      await openEditor(c);
      await fillIn(c, 'phone', '123');
      await save(c);
      await c.page.getByTestId('profile-error').waitFor({ timeout: 5000 });
      const msg = await c.page.getByTestId('profile-error').innerText();
      check('telephone trop court : message clair sous le champ, rien d\'envoye a la base', /8 à 15 chiffres/.test(msg) && fu.patches.length === 0 && (await editorOpen(c)), { msg, patches: fu.patches.length });
      await fillIn(c, 'phone', '99221017');
      await sleep(300);
      check('le message disparait des que le client corrige', (await c.page.getByTestId('profile-error').count()) === 0);
      await fillIn(c, 'whatsapp', '12');
      await save(c);
      await c.page.getByTestId('profile-error').waitFor({ timeout: 5000 });
      check('WhatsApp invalide : refuse aussi, avec son message', /WhatsApp/.test(await c.page.getByTestId('profile-error').innerText()) && fu.patches.length === 0);
      await fillIn(c, 'whatsapp', '');
      await save(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('corrige (WhatsApp laisse vide) : enregistre, WhatsApp envoye comme « vide » (null)', fu.patches.length === 1 && fu.patches[0].phone === '99221017' && fu.patches[0].whatsapp_number === null, fu.patches);
      await c.ctx.close();
    }

    // --- R3. nom vide : refuse
    {
      const fu = accountOf();
      const c = await openAccount(fu);
      await openEditor(c);
      await fillIn(c, 'fullName', '   ');
      await save(c);
      await c.page.getByTestId('profile-error').waitFor({ timeout: 5000 });
      check('nom vide : « Merci d\'ecrire votre nom et prenom », rien d\'envoye', /nom et prénom/.test(await c.page.getByTestId('profile-error').innerText()) && fu.patches.length === 0);
      await c.ctx.close();
    }

    // --- R4. la base ne change aucune ligne (droit refuse) : on ne dit JAMAIS « enregistre » ; le formulaire reste, puis on reessaie
    {
      const fu = accountOf({}, { refuseNext: 1 });
      const c = await openAccount(fu);
      await openEditor(c);
      await fillIn(c, 'address', 'Farcha');
      await save(c);
      await c.page.getByText('Enregistrement impossible').waitFor({ timeout: 10000 });
      check('la base ne change rien : message d\'echec honnete, jamais « mis a jour »', (await pageHas(c, /n'a pas pu être enregistré/)) >= 1 && (await pageHas(c, 'Profil mis à jour ✓')) === 0);
      check('le formulaire reste ouvert avec ce que le client a ecrit, la carte garde l\'ancien profil', (await editorOpen(c)) && (await input(c, 'address').inputValue()) === 'Farcha' && (await pageHas(c, /^📍 (?!Ville$)/)) === 0);
      await save(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('il reessaie : ca s\'enregistre (2e demande identique), la carte montre l\'adresse', fu.patches.length === 2 && fu.patches[1].address === 'Farcha' && (await pageHas(c, '📍 Farcha')) === 1, fu.patches.length);
      await c.ctx.close();
    }

    // --- R5. panne de la base (500) : message d'echec, pas de deconnexion, on reessaie
    {
      const fu = accountOf({}, { failNext: 1 });
      const c = await openAccount(fu);
      await openEditor(c);
      await fillIn(c, 'fullName', 'Ahmed Hassan Idriss');
      await save(c);
      await c.page.getByText('Enregistrement impossible').waitFor({ timeout: 10000 });
      check('panne de la base : echec annonce, le client reste connecte (page Compte toujours la)', (await pageHas(c, 'Profil mis à jour ✓')) === 0 && (await editorOpen(c)) && (await c.page.getByText('Se déconnecter').count()) === 1);
      await save(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('apres la panne, le 2e essai enregistre le nouveau nom', fu.patches.length === 2 && fu.patches[1].full_name === 'Ahmed Hassan Idriss' && (await pageHas(c, 'Ahmed Hassan Idriss')) >= 1, fu.patches.length);
      await c.ctx.close();
    }

    // --- R6. annuler : rien n'est envoye, le formulaire se ferme, et il se rouvre avec les vraies informations
    {
      const fu = accountOf();
      const c = await openAccount(fu);
      await openEditor(c);
      await fillIn(c, 'fullName', 'Quelqu\'un d\'autre');
      await c.page.getByText('Annuler', { exact: true }).click();
      await sleep(500);
      check('« Annuler » : le formulaire se ferme, rien n\'est envoye, l\'ancien nom reste', !(await editorOpen(c)) && fu.patches.length === 0 && (await pageHas(c, 'Ahmed Hassan')) >= 1);
      await openEditor(c);
      check('on rouvre : le formulaire montre le vrai nom (pas ce qui avait ete tape)', (await input(c, 'fullName').inputValue()) === 'Ahmed Hassan');
      await c.ctx.close();
    }

    // --- R7. effacer l'adresse : envoyee comme « vide » (null), la ligne disparait de la carte
    {
      const fu = accountOf({ address: 'Quartier Chagoua' });
      const c = await openAccount(fu);
      check('adresse enregistree affichee sur la carte', (await pageHas(c, '📍 Quartier Chagoua')) === 1);
      await openEditor(c);
      await fillIn(c, 'address', '');
      await save(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('adresse effacee : envoyee « vide » (null), la ligne 📍 disparait de la carte', fu.patches.length === 1 && fu.patches[0].address === null && (await pageHas(c, /^📍/)) === 0, fu.patches);
      await c.ctx.close();
    }

    // --- R8. compte sans telephone ni adresse (inscription Google) : le client peut les ajouter
    {
      const fu = accountOf({ full_name: 'Fatima Idriss', phone: null, country: null });
      const c = await openAccount(fu);
      check('compte sans telephone ni adresse : rien d\'affiche sur la carte', (await pageHas(c, /^📞/)) === 0 && (await pageHas(c, /^📍/)) === 0);
      await openEditor(c);
      await fillIn(c, 'phone', '66 12 34 56');
      await fillIn(c, 'address', 'Moursal');
      await fillIn(c, 'profession', 'Étudiante');
      await save(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('il ajoute telephone, adresse et profession : enregistres et affiches', fu.patches.length === 1 && fu.patches[0].phone === '66 12 34 56' && fu.patches[0].address === 'Moursal' && fu.patches[0].profession === 'Étudiante' && (await pageHas(c, '📞 66 12 34 56')) === 1 && (await pageHas(c, '📍 Moursal')) === 1, fu.patches);
      check('aucune erreur (compte sans coordonnees)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
  }

  // =============================================== S. STATISTIQUES DE ZARA ===============================================
  if (PARTS.includes('S')) {
    console.log('\n== S. statistiques de Zara : suivi (appareil, comptes, installations, gestes) et page « Statistiques de Zara » (administrateur)');
    const iphone = { ...devices['iPhone 13'], viewport: { width: 390, height: 800 } };
    const uid = '11111111-1111-4111-8111-111111111111';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const accountOf = (profile = {}, opts = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], ...opts, profile: { id: uid, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, ...profile } };
    };
    const SESSION_KEY = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const openChat = async (v, name = /Discuter avec Zara Kings|التحدث مع زارا كينغز/) => {
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name }).click();
    };
    // la boite d'installation de Chrome, simulee : outcome = ce que le client y repond
    const fakePromptWith = (v, outcome) => v.ctx.addInitScript(`window.__fakePromptCalls = 0; window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: ${JSON.stringify(outcome)} }) };`);
    const reachQuestion = async (v) => {
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(1500);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
    };
    const eventNames = (v) => v.events.map((e) => `${e.p_event}:${e.p_device}`);

    // --- S1. chaque conversation envoie l'appareil au compteur ; l'ancienne fonction de la base (sans appareil) marche toujours
    {
      const a = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, rank: 5 });
      await openChat(a);
      await waitText(a.page, /Vous êtes mon 5ᵉ client aujourd’hui/);
      check('Android : le compteur de conversations recoit l\'appareil (Android), une seule fois', a.chatStarts.length === 1 && a.chatStarts[0].p_device === 'Android', a.chatStarts);
      await a.ctx.close();
      const i = await newVisitor(iphone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, rank: 3 });
      await openChat(i);
      await waitText(i.page, /Vous êtes mon 3ᵉ client aujourd’hui/);
      check('iPhone : le compteur recoit « iPhone »', i.chatStarts.length === 1 && i.chatStarts[0].p_device === 'iPhone', i.chatStarts);
      await i.ctx.close();
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, rank: 2 });
      await openChat(d);
      await waitText(d.page, /Vous êtes mon 2ᵉ client aujourd’hui/);
      check('ordinateur : le compteur recoit « PC »', d.chatStarts.length === 1 && d.chatStarts[0].p_device === 'PC', d.chatStarts);
      await d.ctx.close();
      const o = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, rank: 4, oldRank: true });
      await openChat(o);
      await waitText(o.page, /Vous êtes mon 4ᵉ client aujourd’hui/);
      check('ancienne fonction de la base (script pas encore applique) : Zara refait UN appel sans appareil, le numero de client s\'affiche quand meme', o.chatStarts.length === 2 && o.chatStarts[0].p_device === 'Android' && o.chatStarts[1].p_device === undefined, o.chatStarts);
      check('aucune erreur (compteur de conversations)', a.errs.length === 0 && i.errs.length === 0 && d.errs.length === 0 && o.errs.length === 0, [a.errs, i.errs, d.errs, o.errs]);
      await o.ctx.close();
    }

    // --- S2. les gestes de Zara autour de l'installation sont notes avec l'appareil (question, deja installee, plus tard, aide iPhone)
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await fakePromptWith(v, 'accepted');
      await openChat(v);
      await reachQuestion(v);
      await sleep(600);
      check('Android : la question posee est notee (install_question, Android)', eventNames(v).join('|') === 'install_question:Android', v.events);
      await chip(v.page, 'Oui, déjà installée').click();
      await waitText(v.page, /Parfait, merci/);
      await sleep(600);
      check('Android : « Oui, deja installee » est note (install_already)', eventNames(v).join('|') === 'install_question:Android|install_already:Android', v.events);
      check('aucune erreur (gestes, Android)', v.errs.length === 0, v.errs);
      await v.ctx.close();
      const w = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await fakePromptWith(w, 'accepted');
      await openChat(w);
      await reachQuestion(w);
      await chip(w.page, 'Plus tard').click();
      await waitText(w.page, /je ne vous le propose plus pour le moment/);
      await sleep(600);
      check('« Plus tard » est note (install_later)', eventNames(w).join('|') === 'install_question:Android|install_later:Android', w.events);
      await w.ctx.close();
      const x = await newVisitor(iphone, { storage: { albasse_zara_name: 'Ali' } });
      await openChat(x);
      await reachQuestion(x);
      await chip(x.page, 'Voir comment installer').click();
      await waitText(x.page, /Sur iPhone :/);
      await sleep(600);
      check('iPhone : la question puis l\'aide avec la photo sont notees (install_ios_guide, iPhone)', eventNames(x).join('|') === 'install_question:iPhone|install_ios_guide:iPhone', x.events);
      check('aucune erreur (gestes, iPhone)', x.errs.length === 0, x.errs);
      await x.ctx.close();
    }

    // --- S3. installations : « grace a Zara » seulement si le client a touche « Installer » chez Zara et accepte
    {
      const a = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await fakePromptWith(a, 'accepted');
      await openChat(a);
      await waitText(a.page, /Créez votre compte gratuit(?:, Ali)?/);
      await chip(a.page, 'Installer Albasse Shopping').click();
      await waitText(a.page, /C’est installé !/);
      await sleep(800);
      const row = a.installs[0] || {};
      check('installation acceptee depuis Zara : comptee UNE fois, « grace a Zara », avec l\'appareil et le navigateur', a.installs.length === 1 && row.via_assistant === true && row.install_type === 'shortcut' && row.device_type === 'Android' && row.browser === 'Chrome' && /^[0-9a-f-]{36}$/.test(row.device_id), a.installs);
      check('la memoire « vient de Zara » est effacee apres le comptage', (await a.page.evaluate(() => localStorage.getItem('albasse_zara_install_intent'))) === null);
      check('aucune erreur (installation via Zara)', a.errs.length === 0, a.errs);
      await a.ctx.close();

      const b = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await b.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(3000);
      await b.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await sleep(800);
      check('installation faite autrement (menu de Chrome, sans passer par Zara) : comptee, mais PAS « grace a Zara »', b.installs.length === 1 && b.installs[0].via_assistant === undefined && b.installs[0].device_type === 'Android', b.installs);
      await b.ctx.close();

      const c = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await fakePromptWith(c, 'dismissed');
      await openChat(c);
      await waitText(c.page, /Créez votre compte gratuit(?:, Ali)?/);
      await chip(c.page, 'Installer Albasse Shopping').click();
      await waitText(c.page, /Pas de souci 😊/);
      check('refus dans la boite de Chrome : rien n\'est compte, la memoire « vient de Zara » est effacee', c.installs.length === 0 && (await c.page.evaluate(() => localStorage.getItem('albasse_zara_install_intent'))) === null, c.installs);
      await c.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await sleep(800);
      check('installe plus tard par un autre chemin apres un refus : PAS « grace a Zara »', c.installs.length === 1 && c.installs[0].via_assistant === undefined, c.installs);
      await c.ctx.close();

      const d = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' }, noStatsColumns: true });
      await fakePromptWith(d, 'accepted');
      await openChat(d);
      await waitText(d.page, /Créez votre compte gratuit(?:, Ali)?/);
      await chip(d.page, 'Installer Albasse Shopping').click();
      await waitText(d.page, /C’est installé !/);
      await sleep(1200);
      check('base sans la colonne de Zara : l\'installation est comptee QUAND MEME (2e essai sans la colonne)', d.installs.length === 2 && d.installs[0].via_assistant === true && d.installs[1].via_assistant === undefined && d.installs[1].install_type === 'shortcut', d.installs);
      check('aucune erreur (installation sans colonne de Zara)', d.errs.length === 0, d.errs);
      await d.ctx.close();
    }

    // --- S4. comptes : « Creer mon compte » touche chez Zara, puis premiere connexion du nouveau compte = « grace a Zara »
    {
      const login = async (c) => {
        await c.page.goto(`http://localhost:${port}/connexion`, { waitUntil: 'load' });
        await c.page.getByPlaceholder('Email').fill('test@example.com');
        await c.page.getByPlaceholder('Mot de passe').fill('motdepasse-test');
        await c.page.getByText('Se connecter', { exact: true }).first().click();
        await sleep(3500); // la page /connexion ouverte directement n'a pas de page precedente : on attend l'enregistrement de la connexion, pas un changement de page
      };
      const withZaraRegister = async (fu, extra = {}) => {
        const c = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, fakeUser: fu, ...extra });
        await openChat(c);
        await waitText(c.page, /Créez votre compte gratuit(?:, Ali)?/);
        await chip(c.page, 'Créer mon compte').click();
        await c.page.waitForURL(/\/inscription/, { timeout: 15000 });
        return c;
      };
      const forZara = (fu) => fu.patches.filter((p) => p.assistant_device !== undefined);

      const fu1 = accountOf({ login_count: 0 });
      const c1 = await withZaraRegister(fu1);
      const intent = await c1.page.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_signup_intent') || 'null'));
      check('« Creer mon compte » touche chez Zara : retenu avec l\'appareil (Android)', intent && intent.device === 'Android' && Math.abs(Date.now() - intent.at) < 60000, intent);
      await login(c1);
      check('premiere connexion du compte : note « grace a Zara » avec l\'appareil, UNE fois', forZara(fu1).length === 1 && forZara(fu1)[0].assistant_device === 'Android' && fu1.patches.some((p) => p.login_count === 1), fu1.patches);
      check('la memoire est effacee apres le comptage (un seul compte compte)', (await c1.page.evaluate(() => localStorage.getItem('albasse_zara_signup_intent'))) === null);
      check('aucune erreur (compte grace a Zara)', c1.errs.length === 0, c1.errs);
      await c1.ctx.close();

      const fu2 = accountOf({ login_count: 0 });
      const c2 = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, fakeUser: fu2 });
      await login(c2);
      check('compte cree SANS passer par Zara : rien n\'est note « grace a Zara »', forZara(fu2).length === 0 && fu2.patches.some((p) => p.login_count === 1), fu2.patches);
      await c2.ctx.close();

      const fu3 = accountOf({ login_count: 7 });
      const c3 = await withZaraRegister(fu3);
      await login(c3);
      check('client deja connu (il se connecte juste) qui a touche le bouton : PAS compte comme nouveau compte', forZara(fu3).length === 0, fu3.patches);
      await c3.ctx.close();

      const fu4 = accountOf({ login_count: 0 }, { rejectColumn: 'assistant_device' });
      const c4 = await withZaraRegister(fu4);
      await login(c4);
      check('base sans la colonne de Zara : la connexion reussit quand meme, aucun message d\'erreur', fu4.patches.some((p) => p.login_count === 1) && forZara(fu4).length === 1 && (await c4.page.getByText(/Erreur technique|Connexion impossible/).count()) === 0 && (await c4.page.evaluate(() => localStorage.getItem('albasse_zara_signup_intent'))) === null);
      check('aucune erreur (compte, base sans colonne)', c4.errs.length === 0, c4.errs);
      await c4.ctx.close();
    }

    // --- S5. la page « Statistiques de Zara » (administrateur)
    {
      const STATS = {
        conversations: [{ device: 'iPhone', n: 1 }, { device: 'Android', n: 1 }, { device: 'Autre', n: 2 }],
        events: [{ event: 'install_question', device: 'iPhone', n: 1 }, { event: 'install_question', device: 'Android', n: 1 }, { event: 'install_ios_guide', device: 'iPhone', n: 1 }, { event: 'install_already', device: 'Android', n: 1 }, { event: 'install_later', device: 'Autre', n: 1 }],
        orders: [{ device: 'Android', status: 'pending', n: 1, amount: 10000 }, { device: 'Android', status: 'delivered', n: 1, amount: 20000 }, { device: 'iPhone', status: 'paid', n: 1, amount: 5000 }, { device: 'Android', status: 'cancelled', n: 1, amount: 3000 }],
        accounts: [{ device: 'Android', n: 2 }, { device: 'iPhone', n: 1 }],
        installs: [{ device: 'Android', n: 1 }, { device: 'iPhone', n: 1 }],
        totals: { orders: 4, orders_amount: 42000, accounts: 5, installs: 3 },
      };
      const norm = (t) => t.replace(/[\s  ]+/g, ' ').trim();
      const text = async (c, id) => norm(await c.page.getByTestId(id).innerText());
      const openStats = async (fakeStats, admin = true) => {
        const fu = accountOf({ is_admin: admin, full_name: 'Admin Albasse' });
        const c = await newVisitor(phone, { lang: 'fr', storage: { [SESSION_KEY]: fu.session }, fakeUser: fu, fakeStats });
        await c.page.goto(`http://localhost:${port}/admin/statistiques-zara`, { waitUntil: 'load' });
        return c;
      };

      // chiffres, appareils, parcours
      {
        const c = await openStats({ replies: [{ body: STATS }] });
        await c.page.getByTestId('zara-stat-sales-value').waitFor({ timeout: 25000 });
        check('ventes de Zara : 3 commandes (l\'annulee n\'est pas comptee), 35 000 FCFA, dont 1 livree de 20 000, 75 % des commandes de la boutique', (await text(c, 'zara-stat-sales-value')) === '3' && /35 000 FCFA/.test(await text(c, 'zara-stat-sales')) && /dont livrées : 1 \(20 000 FCFA\)/.test(await text(c, 'zara-stat-sales')) && /75 % des commandes de la boutique \(4\)/.test(await text(c, 'zara-stat-sales')) && /1 annulée\(s\), non comptée\(s\)/.test(await text(c, 'zara-stat-sales')), await text(c, 'zara-stat-sales'));
        check('comptes crees grace a Zara : 3, soit 60 % des nouveaux comptes (5)', (await text(c, 'zara-stat-accounts-value')) === '3' && /60 % des nouveaux comptes \(5\)/.test(await text(c, 'zara-stat-accounts')), await text(c, 'zara-stat-accounts'));
        check('installations grace a Zara : 2, soit 66,7 % des installations (3), 1 aide iPhone envoyee', (await text(c, 'zara-stat-installs-value')) === '2' && /66,7 % des installations \(3\)/.test(await text(c, 'zara-stat-installs')) && /Aides iPhone envoyées : 1/.test(await text(c, 'zara-stat-installs')), await text(c, 'zara-stat-installs'));
        check('conversations : 4, soit 75 ventes pour 100 conversations', (await text(c, 'zara-stat-chats-value')) === '4' && /75 vente\(s\) pour 100 conversations/.test(await text(c, 'zara-stat-chats')), await text(c, 'zara-stat-chats'));
        check('par appareil : iPhone 1 conversation, 1 vente (5 000), 1 compte, 1 installation', (await text(c, 'zara-device-iPhone')) === 'iPhone 1 1 5 000 1 1', await text(c, 'zara-device-iPhone'));
        check('par appareil : Android 1 conversation, 2 ventes (30 000), 2 comptes, 1 installation', (await text(c, 'zara-device-Android')) === 'Android 1 2 30 000 2 1', await text(c, 'zara-device-Android'));
        check('par appareil : tablette et ordinateur a zero ; « Autre / inconnu » affiche (2 conversations)', (await text(c, 'zara-device-Tablette')) === 'Tablette 0 0 0 0' && (await text(c, 'zara-device-PC')) === 'Ordinateur 0 0 0 0' && (await text(c, 'zara-device-Autre')) === 'Autre / inconnu 2 0 0 0');
        check('parcours d\'installation : 2 questions, 1 deja installee, 1 plus tard, 1 aide iPhone, 2 installees', (await text(c, 'zara-funnel-questions')).endsWith(' 2') && (await text(c, 'zara-funnel-already')).endsWith(' 1') && (await text(c, 'zara-funnel-later')).endsWith(' 1') && (await text(c, 'zara-funnel-ios')).endsWith(' 1') && (await text(c, 'zara-funnel-done')).endsWith(' 2'));
        check('la page dit comment on compte (iPhone non confirmable, jours a l\'heure du Tchad)', (await c.page.getByText(/Sur iPhone, le site ne peut pas savoir/).count()) === 1 && (await c.page.getByText(/minuit, heure du Tchad/).count()) === 1);
        await c.page.screenshot({ path: path.join(OUT, 'S1-statistiques-zara.png') });
        await c.page.setViewportSize({ width: 390, height: 1900 });
        await sleep(800);
        await c.page.screenshot({ path: path.join(OUT, 'S3-statistiques-zara-complet.png') });
        await c.page.setViewportSize({ width: 390, height: 800 });
        const b = c.statsCalls[0] || {};
        check('1re demande : 30 jours (debut a minuit heure du Tchad = 23:00 UTC), sans fin', c.statsCalls.length === 1 && /T23:00:00\.000Z$/.test(b.p_since) && b.p_until === null, c.statsCalls);
        check('aucune erreur (page des statistiques)', c.errs.length === 0, c.errs);
        // periodes
        await c.page.getByTestId('zara-period-today').click();
        await sleep(1200);
        const today = c.statsCalls[c.statsCalls.length - 1];
        check('« Aujourd\'hui » : depuis minuit heure du Tchad, sans fin', /T23:00:00\.000Z$/.test(today.p_since) && today.p_until === null && Date.now() - Date.parse(today.p_since) < 24 * 3600 * 1000 + 60000 && Date.parse(today.p_since) <= Date.now(), today);
        await c.page.getByTestId('zara-period-yesterday').click();
        await sleep(1200);
        const yday = c.statsCalls[c.statsCalls.length - 1];
        check('« Hier » : de minuit a minuit (24 h exactement), fin exclue', Date.parse(yday.p_until) - Date.parse(yday.p_since) === 24 * 3600 * 1000 && Date.parse(yday.p_until) === Date.parse(today.p_since), yday);
        await c.page.getByTestId('zara-period-7d').click();
        await sleep(1200);
        const w = c.statsCalls[c.statsCalls.length - 1];
        check('« 7 jours » : aujourd\'hui + 6 jours avant', Date.parse(today.p_since) - Date.parse(w.p_since) === 6 * 24 * 3600 * 1000 && w.p_until === null, w);
        await c.page.getByTestId('zara-period-all').click();
        await sleep(1200);
        const all = c.statsCalls[c.statsCalls.length - 1];
        check('« Depuis le debut » : sans limite', all.p_since === null && all.p_until === null, all);
        check('une demande par periode choisie, rien d\'autre (4 + la 1re)', c.statsCalls.length === 5, c.statsCalls.length);
        await c.ctx.close();
      }

      // pas encore active (script pas applique)
      {
        const c = await openStats({ replies: [{ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.assistant_stats(p_since, p_until) in the schema cache' } }] });
        await c.page.getByTestId('zara-stats-not-installed').waitFor({ timeout: 25000 });
        const t = norm(await c.page.getByTestId('zara-stats-not-installed').innerText());
        check('script de la base pas applique : message clair avec les etapes et le nom du fichier, pas de chiffres inventes', /pas encore activées/.test(t) && /add-assistant-stats\.sql/.test(t) && /SQL Editor/.test(t) && (await c.page.getByTestId('zara-stat-sales').count()) === 0, t);
        await c.page.screenshot({ path: path.join(OUT, 'S2-statistiques-pas-activees.png') });
        check('aucune erreur (statistiques pas activees)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      // acces refuse
      {
        const c = await openStats({ replies: [{ status: 403, body: { code: '42501', message: 'Accès réservé aux administrateurs' } }] });
        await c.page.getByTestId('zara-stats-error').waitFor({ timeout: 25000 });
        check('la base refuse (pas administrateur) : « Acces refuse », pas de bouton reessayer', /Accès refusé/.test(await text(c, 'zara-stats-error')) && (await c.page.getByTestId('zara-stats-retry').count()) === 0);
        await c.ctx.close();
      }
      // panne puis reessai
      {
        const c = await openStats({ replies: [{ status: 500, body: { code: 'XX000', message: 'service indisponible' } }, { body: STATS }] });
        await c.page.getByTestId('zara-stats-error').waitFor({ timeout: 25000 });
        check('panne de la base : message et bouton « Reessayer », aucun chiffre', /Impossible de lire les statistiques/.test(await text(c, 'zara-stats-error')) && /service indisponible/.test(await text(c, 'zara-stats-error')) && (await c.page.getByTestId('zara-stat-sales').count()) === 0);
        await c.page.getByTestId('zara-stats-retry').click();
        await c.page.getByTestId('zara-stat-sales-value').waitFor({ timeout: 15000 });
        check('apres « Reessayer » : les chiffres s\'affichent et le message disparait', (await text(c, 'zara-stat-sales-value')) === '3' && (await c.page.getByTestId('zara-stats-error').count()) === 0);
        await c.ctx.close();
      }
      // periode sans aucune donnee
      {
        const c = await openStats({ replies: [{ body: { conversations: [], events: [], orders: [], accounts: [], installs: [], totals: { orders: 0, orders_amount: 0, accounts: 0, installs: 0 } } }] });
        await c.page.getByTestId('zara-stat-sales-value').waitFor({ timeout: 25000 });
        check('periode sans donnees : tout a zero, pourcentages « — », jamais NaN ni undefined', (await text(c, 'zara-stat-sales-value')) === '0' && (await text(c, 'zara-stat-chats')).includes('Aucune conversation') && !/NaN|undefined|null/.test(norm(await c.page.getByTestId('zara-stats').innerText())) && (await c.page.getByTestId('zara-device-Autre').count()) === 0, norm(await c.page.getByTestId('zara-stats').innerText()).slice(0, 400));
        await c.ctx.close();
      }
      // pas administrateur
      {
        const c = await openStats({ replies: [{ body: STATS }] }, false);
        await c.page.getByText('Accès réservé aux administrateurs.').waitFor({ timeout: 25000 });
        await sleep(800);
        check('un client (pas administrateur) ne voit pas la page et ne demande rien a la base', (await c.page.getByTestId('zara-stat-sales').count()) === 0 && c.statsCalls.length === 0, c.statsCalls);
        await c.ctx.close();
      }
      // acces depuis le menu administrateur du compte
      {
        const fu = accountOf({ is_admin: true, full_name: 'Admin Albasse' });
        const c = await newVisitor(phone, { lang: 'fr', storage: { [SESSION_KEY]: fu.session }, fakeUser: fu, fakeStats: { replies: [{ body: STATS }] } });
        await c.page.goto(`http://localhost:${port}/compte`, { waitUntil: 'load' });
        await c.page.getByText('Espace Admin', { exact: true }).waitFor({ timeout: 25000 });
        await c.page.getByText('Espace Admin', { exact: true }).click();
        await c.page.getByText('Statistiques de Zara', { exact: true }).click();
        await c.page.getByTestId('zara-stat-sales-value').waitFor({ timeout: 25000 });
        check('menu « Espace Admin » : « Statistiques de Zara » ouvre la page', /\/admin\/statistiques-zara/.test(c.page.url()) && (await text(c, 'zara-stat-sales-value')) === '3', c.page.url());
        check('aucune erreur (menu administrateur)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
    }
  }

  // =============================================== U. INTELLIGENCE COMMERCIALE : SUIVI DE NAVIGATION ===============================================
  if (PARTS.includes('U')) {
    console.log('\n== U. suivi de navigation pour Zara : temps ACTIF, variantes, panier, recherches, consentement, envoi fiable');
    const base = `http://localhost:${port}`;
    const PK = 'albasse_browsing_profile_v1';
    const OK = 'albasse_browsing_outbox_v1';
    const readProfile = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), PK);
    const readOutbox = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), OK);
    const ls = (pg, k) => pg.evaluate((key) => localStorage.getItem(key), k);
    const sandales = (await get('products?select=id,name,slug,category_id,images,sizes,colors&slug=eq.sandales-al-madjaz&limit=1'))[0];
    const clarks = (await get('products?select=id,name,slug&slug=eq.clarks-moccasin&limit=1'))[0];
    const cats = await get('categories?select=id,name,slug');
    const sandalesCat = cats.find((c) => c.id === sandales.category_id);
    console.log('info  suivi : produit', sandales.name.trim(), '| categorie', sandalesCat && sandalesCat.name, '| tailles', sandales.sizes.join(','), '| couleurs', sandales.colors.join(','));
    const sleepSec = (n) => sleep(n * 1000);
    const touch = (pg, i = 0) => pg.mouse.move(120 + i * 7, 320 + i * 3);
    const openProduct = async (v, slug = sandales.slug) => {
      await v.page.goto(`${base}/produit/${slug}`, { waitUntil: 'load' });
      await v.page.waitForFunction((k) => { try { const p = JSON.parse(localStorage.getItem(k) || 'null'); return !!p && Object.keys(p.products).length > 0; } catch (e) { return false; } }, PK, { timeout: 25000 });
    };
    const hide = (pg) => pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const show = (pg) => pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    const fresh = () => newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });

    // --- U1. une fiche regardee : consultation, temps ACTIF, categorie ; le temps est garde meme quand on ferme la page
    {
      const v = await fresh();
      await openProduct(v);
      for (let i = 0; i < 4; i++) { await touch(v.page, i); await sleepSec(1.8); }
      check('suivi en arriere-plan : aucun message, aucune fenetre, aucun bouton ne previent le visiteur pendant qu\'il regarde les fiches', (await v.page.getByTestId('tracking-notice').count()) === 0 && !/retient les articles|Refuser|suivi/i.test(await v.page.locator('body').innerText()));
      await v.page.screenshot({ path: path.join(OUT, 'U1-fiche-et-information.png') });
      await v.page.goto(`${base}/`, { waitUntil: 'load' }); // fermeture de la fiche (la page se recharge)
      await sleepSec(1);
      const p = await readProfile(v.page);
      const rec = p && p.products[sandales.id];
      check('consultation notee : 1 vue, 1 visite, nom et categorie du produit, ordre de consultation', !!rec && rec.views === 1 && rec.sessions === 1 && rec.name.trim() === sandales.name.trim() && rec.categoryName === (sandalesCat && sandalesCat.name) && rec.categorySlug === (sandalesCat && sandalesCat.slug) && p.order.join() === sandales.id && !!p.categories[sandalesCat.slug], rec);
      check('temps ACTIF note meme si la page est fermee/rechargee (environ 6 a 9 secondes, avec la derniere duree)', !!rec && rec.activeSeconds >= 5 && rec.activeSeconds <= 10 && rec.lastDurationSeconds >= 5 && rec.lastDurationSeconds <= 10, rec && [rec.activeSeconds, rec.lastDurationSeconds]);
      check('le profil ne contient aucune donnee personnelle (ni nom du client, ni telephone, ni e-mail)', !/Ali|@|66123456/.test(JSON.stringify(p).replace(/"name":"[^"]*"/g, '')) && /^[0-9a-f-]{36}$/.test(p.visitorId), p.visitorId);
      await v.page.getByRole('button', { name: FAB_NAME }).waitFor({ timeout: 10000 });
      check('aucune erreur (suivi d\'une fiche)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- U2. le temps ACTIF : un onglet cache ne compte pas
    {
      const v = await fresh();
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(3);
      await hide(v.page);
      await sleepSec(6);
      await show(v.page);
      await touch(v.page, 2);
      await sleepSec(2);
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      const rec = (await readProfile(v.page)).products[sandales.id];
      check('onglet cache pendant 6 secondes : ces 6 secondes ne comptent PAS (temps actif entre 4 et 8 s au lieu de 11+)', rec.activeSeconds >= 4 && rec.activeSeconds <= 8, rec.activeSeconds);
      check('l\'onglet qui se cache envoie tout de suite ce qui est note (courrier pour la base)', v.browsingCalls.length >= 1 && v.browsingCalls[0].p_items.some((i) => i.product_id === sandales.id), v.browsingCalls.length);
      await v.ctx.close();
    }

    // --- U3. retour sur un article apres en avoir regarde un autre ; recherches ; la meme fiche rouverte tout de suite = actualisation
    {
      const v = await fresh();
      await v.page.goto(`${base}/recherche`, { waitUntil: 'load' });
      const box = v.page.getByPlaceholder('Rechercher un produit…');
      await box.waitFor({ timeout: 25000 });
      await box.fill('sandales');
      await v.page.getByText(/Sandales AL madjaz/i).first().click();
      await v.page.waitForFunction((k) => { const p = JSON.parse(localStorage.getItem(k) || 'null'); return p && Object.keys(p.products).length > 0; }, PK, { timeout: 25000 });
      await touch(v.page, 1);
      await sleepSec(3.5);
      await v.page.goBack();
      await box.waitFor({ timeout: 15000 });
      await box.fill('clarks');
      await v.page.getByText(/Clarks moccasin/i).first().click();
      await sleepSec(1);
      await touch(v.page, 2);
      await sleepSec(3);
      await v.page.goBack();
      await box.waitFor({ timeout: 15000 });
      await box.fill('sandales');
      await v.page.getByText(/Sandales AL madjaz/i).first().click();
      await sleepSec(1.5);
      await touch(v.page, 3);
      await sleepSec(2);
      await v.page.goBack();
      await box.waitFor({ timeout: 15000 });
      await sleepSec(1.5);
      const p = await readProfile(v.page);
      const a = p.products[sandales.id], b = p.products[clarks.id];
      check('les 2 articles sont suivis : sandales 2 vues, clarks 1 vue', !!a && !!b && a.views === 2 && b.views === 1, [a && a.views, b && b.views]);
      check('retour sur les sandales apres avoir regarde des Clarks : « retour apres d\'autres produits » = 1', a.returnsAfterOthers === 1 && b.returnsAfterOthers === 0, [a.returnsAfterOthers, b.returnsAfterOthers]);
      check('chaque fiche a son propre temps actif (changer de fiche arrete le temps de la precedente)', a.activeSeconds >= 4 && a.activeSeconds <= 11 && b.activeSeconds >= 2 && b.activeSeconds <= 6, [a.activeSeconds, b.activeSeconds]);
      check('ordre de consultation : clarks puis sandales (la derniere en dernier)', p.order.join() === `${clarks.id},${sandales.id}`, p.order);
      check('recherches notees (« sandales », « clarks », « sandales »), jamais lettre apres lettre', p.searches.map((s) => s.q).join() === 'sandales,clarks,sandales', p.searches);
      check('niveau d\'interet estime apres ce parcours : les sandales sont au moins « moyen » (retour apres un autre produit)', a.returnsAfterOthers >= 1 && a.views >= 2);
      check('aucune erreur (retours entre fiches)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- U4. actualisation de la page : la MEME consultation (pas deux vues), le temps continue
    {
      const v = await fresh();
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(2.5);
      await v.page.reload({ waitUntil: 'load' });
      await sleepSec(3);
      await touch(v.page, 2);
      await sleepSec(1.5);
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      const rec = (await readProfile(v.page)).products[sandales.id];
      check('page actualisee moins de 8 secondes apres : toujours 1 SEULE vue (pas deux)', rec.views === 1 && rec.sessions === 1, rec);
      check('le temps actif des deux chargements s\'additionne (environ 5 a 9 s)', rec.activeSeconds >= 4 && rec.activeSeconds <= 10, rec.activeSeconds);
      await v.ctx.close();
    }

    // --- U5. images, tailles, couleurs, panier
    {
      const v = await fresh();
      await openProduct(v);
      await v.page.getByTestId('product-thumb-1').click();
      await v.page.getByTestId('product-thumb-2').click();
      await v.page.getByText(sandales.sizes[1], { exact: true }).click();
      await v.page.getByText(sandales.sizes[2], { exact: true }).click();
      await v.page.getByText(sandales.sizes[1], { exact: true }).click();
      await v.page.getByText(sandales.colors[0], { exact: true }).click();
      await v.page.getByText(sandales.colors[1], { exact: true }).click();
      await sleepSec(1);
      let rec = (await readProfile(v.page)).products[sandales.id];
      check('clics notes : 2 images, 3 clics de taille (2 tailles differentes), 2 clics de couleur (2 couleurs differentes)', rec.imageClicks === 2 && rec.sizeClicks === 3 && rec.sizes.join() === `${sandales.sizes[1]},${sandales.sizes[2]}` && rec.colorClicks === 2 && rec.colors.join() === `${sandales.colors[0]},${sandales.colors[1]}`, rec);
      await v.page.getByText('Ajouter au panier', { exact: true }).click();
      await sleepSec(1);
      rec = (await readProfile(v.page)).products[sandales.id];
      check('« Ajouter au panier » : l\'article est au panier', rec.cartStatus === 'in_cart' && rec.cartChangedAt > 0, rec.cartStatus);
      await v.page.goto(`${base}/panier`, { waitUntil: 'load' });
      await v.page.getByText('Retirer', { exact: true }).first().click();
      await sleepSec(1);
      rec = (await readProfile(v.page)).products[sandales.id];
      check('article retire du panier : statut « retire »', rec.cartStatus === 'removed', rec.cartStatus);
      check('aucune erreur (variantes et panier)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- U6. categories et recherche dans une categorie ; une recherche qui ressemble a un numero ou a un e-mail n'est jamais gardee
    {
      const v = await fresh();
      await v.page.goto(`${base}/categorie/parfum`, { waitUntil: 'load' });
      const box = v.page.getByPlaceholder(/Rechercher/).first();
      await box.waitFor({ timeout: 25000 });
      await sleepSec(1);
      await box.fill('oud');
      await sleepSec(1.6);
      await box.fill('66123456');
      await sleepSec(1.6);
      await box.fill('moi@exemple.com');
      await sleepSec(1.6);
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleepSec(1);
      const p = await readProfile(v.page);
      check('categorie ouverte : notee (1 ouverture de « Parfum »)', p && p.categories.parfum && p.categories.parfum.views === 1 && /Parfum/.test(p.categories.parfum.name), p && p.categories);
      check('recherche dans la categorie : « oud » notee ; un numero de telephone ou une adresse e-mail ne sont JAMAIS gardes', p.searches.map((s) => s.q).join() === 'oud', p.searches);
      await v.ctx.close();
    }

    // --- U7. Zara ajoute un article au panier : note aussi ; la commande passee l'enregistre comme achete
    {
      const v = await fresh();
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, 'Rolex', /Voici ce que j’ai trouvé pour « Rolex »/);
      const card = cardsOf(v.page).filter({ hasText: 'Rolex' }).first();
      await card.waitFor({ timeout: 10000 });
      await card.getByTestId('assistant-card-add').click();
      await waitText(v.page, /ajouté au panier/);
      await sleepSec(1);
      const rec = (await readProfile(v.page)).products[realProduct.id];
      check('article ajoute au panier depuis le chat de Zara : note « au panier » (meme chemin que le site)', !!rec && rec.cartStatus === 'in_cart' && rec.views === 0, rec && rec.cartStatus);
      await v.ctx.close();
    }

    // --- U8. suivi 100 % automatique : aucun choix, aucune fenetre ; seul le signal « Ne pas me suivre » du navigateur est respecte
    {
      const r = await fresh();
      await openProduct(r);
      await sleepSec(1.5);
      check('le suivi est actif des la 1re fiche, tout seul : aucune fenetre, aucun bouton, aucune question', (await readProfile(r.page)) !== null && (await r.page.getByTestId('tracking-notice').count()) === 0 && !/Refuser|Autoriser|suivi/i.test(await r.page.locator('body').innerText()));
      await r.page.goto(`${base}/confidentialite`, { waitUntil: 'load' });
      await r.page.getByText(/nous retenons aussi les articles que vous regardez/).waitFor({ timeout: 25000 });
      const policy = await r.page.locator('body').innerText();
      check('page de confidentialite : aucun bouton pour refuser ou autoriser le suivi', (await r.page.getByTestId('privacy-tracking-toggle').count()) === 0 && !/Refuser le suivi|Autoriser le suivi/.test(policy));
      check('...mais le texte reste honnete (ce qui est retenu, 90 jours, effacement sur demande, signal du navigateur)', /conservées 90 jours/.test(policy) && /demander l'effacement/.test(policy) && /Ne pas me suivre/.test(policy));
      await r.page.screenshot({ path: path.join(OUT, 'U8-confidentialite.png') });
      check('aucune erreur (suivi automatique)', r.errs.length === 0, r.errs);
      await r.ctx.close();

      const d = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, initScripts: ["Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });"] });
      await d.page.goto(`${base}/produit/${sandales.slug}`, { waitUntil: 'load' });
      await sleepSec(5);
      check('signal « Ne pas me suivre » du navigateur : rien n\'est note, rien n\'est envoye, aucune fenetre', (await readProfile(d.page)) === null && d.browsingCalls.length === 0 && (await d.page.getByTestId('tracking-notice').count()) === 0);
      await d.ctx.close();
    }

    // --- U9. envoi vers la base : seulement des differences, un numero d'envoi unique, rien de perdu, rien compte deux fois
    {
      const v = await fresh();
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(5.5);
      await hide(v.page);
      await sleepSec(1);
      const vid = await ls(v.page, 'albasse_visitor_id');
      const c1 = v.browsingCalls[0];
      check('1er envoi : identifiant anonyme du visiteur, numero d\'envoi unique, la fiche avec ses chiffres (1 vue, quelques secondes actives)', !!c1 && c1.p_visitor_id === vid && /^[0-9a-f-]{36}$/.test(c1.p_batch_id) && c1.p_items.length === 1 && c1.p_items[0].product_id === sandales.id && c1.p_items[0].views === 1 && c1.p_items[0].active_seconds >= 4 && c1.p_items[0].cart_status === 'none' && c1.p_items[0].interest === 'leger' && c1.p_items[0].category_slug === sandalesCat.slug, c1 && c1.p_items);
      check('l\'envoi ne contient que des chiffres et des noms d\'articles (jamais le nom du client, son telephone, son adresse)', !/Ali|66123456|@/.test(JSON.stringify(c1).replace(/"name":"[^"]*"/g, '')));
      check('la base a compte cet envoi une fois', v.browsingApplied.length === 1);
      await show(v.page);
      await touch(v.page, 2);
      await sleepSec(9); // plus de 8 s : rouvrir la fiche est une nouvelle consultation
      await v.page.goto(`${base}/produit/${sandales.slug}`, { waitUntil: 'load' });
      await v.page.waitForFunction((k) => { const p = JSON.parse(localStorage.getItem(k) || 'null'); return p && p.products && Object.values(p.products)[0].views >= 2; }, PK, { timeout: 25000 });
      await touch(v.page, 3);
      await sleepSec(3);
      await hide(v.page);
      for (let i = 0; i < 20 && v.browsingApplied.length < 3; i++) await sleep(250);
      const rec = (await readProfile(v.page)).products[sandales.id];
      const sent = v.browsingApplied.flatMap((c) => c.p_items.filter((x) => x.product_id === sandales.id));
      const sumViews = sent.reduce((n, x) => n + x.views, 0);
      const sumSeconds = sent.reduce((n, x) => n + x.active_seconds, 0);
      check('apres 2 consultations : les envois cumules donnent exactement 2 vues (seulement des DIFFERENCES, jamais le total deja envoye)', rec.views === 2 && sumViews === 2 && sent.every((x) => x.views <= 1), [rec.views, sent.map((x) => x.views), v.browsingCalls.map((c) => c.p_items.map((x) => [x.views, x.active_seconds]))]);
      check('le temps actif envoye au total correspond au temps du telephone (a 3 secondes pres), sans doublon', Math.abs(sumSeconds - rec.activeSeconds) <= 3 && sent.every((x) => x.active_seconds <= 14), [sumSeconds, rec.activeSeconds, sent.map((x) => x.active_seconds)]);
      check('numeros d\'envoi tous differents', new Set(v.browsingCalls.map((c) => c.p_batch_id)).size === v.browsingCalls.length);
      await v.ctx.close();
    }
    {
      // connexion qui coupe : le courrier attend sur le telephone, repart avec le MEME numero, la base ne le compte qu'une fois
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, fakeBrowsing: { replies: [{ status: 500, body: { code: 'XX000', message: 'service indisponible' } }] } });
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(4);
      await hide(v.page);
      await sleepSec(1.5);
      const box = await readOutbox(v.page);
      check('envoi qui echoue : le courrier reste sur le telephone (avec son numero), la base n\'a rien compte', v.browsingCalls.length === 1 && !!box && box.id === v.browsingCalls[0].p_batch_id && v.browsingApplied.length === 0, box && box.id);
      await show(v.page);
      await v.page.evaluate(() => window.dispatchEvent(new Event('online')));
      await sleepSec(1.5);
      for (let i = 0; i < 12 && (await readOutbox(v.page)) !== null; i++) await sleep(250);
      const firstId0 = v.browsingCalls[0].p_batch_id;
      check('connexion revenue : le MEME courrier repart (meme numero) et la base le compte une fois', v.browsingCalls.length >= 2 && v.browsingCalls[1].p_batch_id === firstId0 && v.browsingApplied.filter((c) => c.p_batch_id === firstId0).length === 1 && (await readOutbox(v.page)) === null, v.browsingCalls.map((c) => c.p_batch_id));
      await v.page.evaluate(() => window.dispatchEvent(new Event('online')));
      await sleepSec(1);
      await sleepSec(1);
      const firstId = v.browsingCalls[0].p_batch_id;
      check('apres ca : le courrier deja recu n\'est plus jamais renvoye (un envoi ulterieur, s\'il y en a un, porte un autre numero et seulement du temps en plus)', v.browsingCalls.slice(2).every((c) => c.p_batch_id !== firstId && c.p_items.every((x) => x.views === 0)) && v.browsingApplied.reduce((n, c) => n + c.p_items.reduce((m, x) => m + x.views, 0), 0) === 1, v.browsingCalls.map((c) => [c.p_batch_id.slice(0, 4), c.p_items.map((x) => x.views)]));
      check('aucune erreur (envoi qui echoue puis repart)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      // la base recoit mais la reponse se perd : le site renvoie, la base reconnait le numero -> compte UNE fois
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, fakeBrowsing: { replies: [{ applyThenFail: true }] } });
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(4);
      await hide(v.page);
      await sleepSec(1.5);
      await show(v.page);
      await v.page.evaluate(() => window.dispatchEvent(new Event('online')));
      await sleepSec(1.5);
      const lostId = v.browsingCalls[0].p_batch_id;
      check('reponse perdue : le site renvoie le meme courrier, la base le reconnait et ne compte PAS deux fois (1 seule vue au total)', v.browsingCalls.length >= 2 && v.browsingCalls[1].p_batch_id === lostId && v.browsingApplied.filter((c) => c.p_batch_id === lostId).length === 1 && v.browsingApplied.reduce((n, c) => n + c.p_items.reduce((m, x) => m + x.views, 0), 0) === 1, [v.browsingCalls.length, v.browsingApplied.length]);
      await v.ctx.close();
    }
    {
      // telephone hors connexion pendant la consultation
      const v = await fresh();
      await v.page.goto(`${base}/produit/${sandales.slug}`, { waitUntil: 'load' });
      await v.page.waitForFunction((k) => { const p = JSON.parse(localStorage.getItem(k) || 'null'); return p && Object.keys(p.products).length > 0; }, PK, { timeout: 25000 });
      v.net.offline = true;
      await v.ctx.setOffline(true);
      await touch(v.page, 1);
      await sleepSec(4);
      await hide(v.page);
      await sleepSec(1.5);
      const callsOffline = v.browsingCalls.length;
      check('hors connexion : rien n\'arrive a la base, mais le profil du telephone est a jour et le courrier est garde', v.browsingApplied.length === 0 && !!(await readOutbox(v.page)) && (await readProfile(v.page)).products[sandales.id].activeSeconds >= 3, callsOffline);
      v.net.offline = false;
      await v.ctx.setOffline(false);
      await show(v.page);
      await v.page.evaluate(() => window.dispatchEvent(new Event('online')));
      await sleepSec(2);
      check('connexion revenue : le courrier arrive, une seule fois, avec le temps passe hors connexion', v.browsingApplied.length === 1 && v.browsingApplied[0].p_items[0].active_seconds >= 3 && (await readOutbox(v.page)) === null, v.browsingApplied.length);
      await v.ctx.close();
    }
    {
      // page rechargee avec un courrier en attente : il repart tout seul
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, fakeBrowsing: { replies: [{ abort: true }] } });
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(4);
      await hide(v.page);
      await sleepSec(1.5);
      const waiting = await readOutbox(v.page);
      check('envoi coupe : un courrier est en attente', !!waiting && v.browsingApplied.length === 0);
      v.net.offline = true; // la page qui se ferme n'arrive pas a envoyer non plus
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      v.net.offline = false;
      for (let i = 0; i < 30 && v.browsingApplied.length === 0; i++) await sleep(500);
      check('a la visite suivante : le courrier en attente repart tout seul avec le meme numero et est compte une fois', v.browsingApplied.length === 1 && v.browsingApplied[0].p_batch_id === waiting.id && (await readOutbox(v.page)) === null, [v.browsingApplied.length, v.browsingCalls.length]);
      await v.ctx.close();
    }
    {
      // la base n'a pas encore le script : on se tait, rien ne casse
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' }, fakeBrowsing: { replies: [{ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.track_browsing in the schema cache' } }] } });
      await openProduct(v);
      await touch(v.page, 1);
      await sleepSec(3);
      for (let i = 0; i < 3; i++) { await hide(v.page); await sleepSec(0.6); await show(v.page); await touch(v.page, i); await sleepSec(0.6); }
      check('base sans le script : UN seul essai (ensuite on se tait 10 minutes), le profil du telephone continue de marcher', v.browsingCalls.length === 1 && (await readProfile(v.page)).products[sandales.id].views === 1, v.browsingCalls.length);
      check('aucune erreur visible (base sans le script de suivi)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- U10. duree de conservation : ce qui a plus de 90 jours est efface au chargement
    {
      const now = Date.now();
      const mk = (id, name, daysAgo) => ({ id, name, slug: id, categoryId: null, categorySlug: 'divers', categoryName: 'Divers', views: 2, sessions: 1, activeSeconds: 30, lastDurationSeconds: 10, firstViewedAt: now - daysAgo * 86400000, lastViewedAt: now - daysAgo * 86400000, lastSessionKey: 's1', imageClicks: 0, sizeClicks: 0, colorClicks: 0, sizes: [], colors: [], returnsAfterOthers: 0, cartStatus: 'none', cartChangedAt: null, orderedAt: null, lastSuggestionAt: null, lastSuggestionKind: null });
      const old = { version: 1, visitorId: 'visiteur-de-test-0001', createdAt: now - 120 * 86400000, updatedAt: now - 3 * 86400000, products: { vieux: mk('vieux', 'Vieux produit', 100), recent: mk('recent', 'Produit recent', 3) }, order: ['vieux', 'recent'], categories: { divers: { key: 'divers', name: 'Divers', views: 1, productIds: ['vieux', 'recent'], lastViewedAt: now - 3 * 86400000 } }, searches: [{ q: 'vieille recherche', at: now - 100 * 86400000 }, { q: 'recherche recente', at: now - 3 * 86400000 }], suggestions: [], quietUntil: 0, lastStart: null, lastActivityAt: now - 3 * 86400000, sessionKey: 's1', sessionStartedAt: now - 3 * 86400000, synced: {}, searchesSyncedAt: 0 };
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali', [PK]: JSON.stringify(old) } });
      await v.page.goto(`${base}/produit/${sandales.slug}`, { waitUntil: 'load' });
      await v.page.waitForFunction(([k, id]) => { const p = JSON.parse(localStorage.getItem(k) || 'null'); return p && !!p.products[id]; }, [PK, sandales.id], { timeout: 25000 });
      const p = await readProfile(v.page);
      check('duree de conservation 90 jours : le produit vu il y a 100 jours est efface, celui d\'il y a 3 jours reste', !p.products.vieux && !!p.products.recent && !!p.products[sandales.id] && !p.order.includes('vieux') && p.searches.map((s) => s.q).join() === 'recherche recente', [Object.keys(p.products), p.searches]);
      await v.ctx.close();
    }

    // --- U11. la politique de confidentialite explique le suivi (quoi, pourquoi, combien de temps, comment refuser)
    {
      const v = await fresh();
      await v.page.goto(`${base}/confidentialite`, { waitUntil: 'load' });
      await v.page.getByText(/nous retenons aussi les articles que vous regardez/).waitFor({ timeout: 25000 });
      const txt = await v.page.locator('body').innerText();
      check('information : la politique de confidentialite parle des articles regardes, des 90 jours, de l\'effacement sur demande et du signal du navigateur (sans bouton)', /nous retenons aussi les articles que vous regardez/.test(txt) && /conservées 90 jours/.test(txt) && /demander l'effacement/.test(txt) && /Ne pas me suivre/.test(txt) && !/bouton ci-dessous|Refuser le suivi/.test(txt));
      check('aucune erreur (page de confidentialite)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  // =============================================== V. ZARA INTELLIGENTE : SUGGESTIONS DISCRETES, HISTORIQUE, CHOIX DU SUIVI ===============================================
  if (PARTS.includes('V')) {
    console.log('\n== V. Zara suggere sans insister (vrais articles), dit la verite sur ce qu\'elle sait, respecte le refus du suivi');
    const base = `http://localhost:${port}`;
    const PK = 'albasse_browsing_profile_v1';
    const CK = 'albasse_tracking_choice';
    const readProfile = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), PK);
    const prods = await get('products?select=id,name,slug,price,stock,category_id,description,sizes,colors&limit=1000');
    const cats = await get('categories?select=id,name,slug');
    const byName = (re) => prods.find((p) => re.test(p.name));
    const sandales = byName(/Sandales AL madjaz/i);
    const clarks = byName(/Clarks moccasin/i);
    const catOf = (p) => cats.find((c) => c.id === p.category_id);
    const perfumeCat = cats.find((c) => c.slug === 'parfum');
    const perfumes = prods.filter((p) => p.category_id === perfumeCat.id && p.stock > 0).slice(0, 3);
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const now0 = Date.now();
    const DAY = 86400000;
    const rec = (p, over = {}) => ({ id: p.id, name: p.name.trim(), slug: p.slug, categoryId: p.category_id, categorySlug: catOf(p).slug, categoryName: catOf(p).name, views: 1, sessions: 1, activeSeconds: 12, lastDurationSeconds: 12, firstViewedAt: now0 - 3 * DAY, lastViewedAt: now0 - 3 * DAY + 60000, lastSessionKey: 's0', imageClicks: 0, sizeClicks: 0, colorClicks: 0, sizes: [], colors: [], returnsAfterOthers: 0, cartStatus: 'none', cartChangedAt: null, orderedAt: null, lastSuggestionAt: null, lastSuggestionKind: null, ...over });
    const profileOf = (records, { quiet = false } = {}) => {
      const products = {};
      const categories = {};
      records.forEach((r, i) => {
        products[r.id] = { ...r, lastViewedAt: now0 - 3 * DAY + (i + 1) * 60000 };
        const c = categories[r.categorySlug] || { key: r.categorySlug, name: r.categoryName, views: 1, productIds: [], lastViewedAt: now0 - 3 * DAY };
        c.productIds.push(r.id);
        categories[r.categorySlug] = c;
      });
      return { version: 1, visitorId: '0f1e2d3c-4b5a-4968-8777-665544332211', createdAt: now0 - 10 * DAY, updatedAt: now0 - 3 * DAY, products, order: records.map((r) => r.id), categories, searches: [], suggestions: [], quietUntil: quiet ? now0 + 5 * DAY : 0, lastStart: null, lastActivityAt: now0 - 3 * DAY, sessionKey: 's0', sessionStartedAt: now0 - 3 * DAY, synced: {}, searchesSyncedAt: 0 };
    };
    // la sandale regardee 3 fois (dont un retour apres d'autres articles), avec plusieurs tailles essayees : interet eleve
    const shoeRec = () => rec(sandales, { views: 3, sessions: 2, returnsAfterOthers: 1, sizeClicks: 2, sizes: [sandales.sizes[0], sandales.sizes[1]], imageClicks: 3, activeSeconds: 70, lastDurationSeconds: 25 });
    const shoeProfile = (o) => profileOf([rec(clarks), shoeRec()], o);
    const perfumeProfile = () => profileOf(perfumes.map((p) => rec(p)));
    const visitor = (profile, extra = {}) => newVisitor(phone, { lang: extra.lang || 'fr', storage: { albasse_zara_name: 'Ali', ...(profile ? { [PK]: JSON.stringify(profile) } : {}), ...(extra.storage || {}) }, initScripts: extra.initScripts || [], fakeBrowsing: extra.fakeBrowsing || null });
    const openZara = async (v, wait = /Créez votre compte gratuit(?:, Ali)?|أنشئ حسابك/) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, wait, 25000);
    };
    // le nom d'une carte produit : son libelle d'accessibilite (« Voir <nom> »), la 1re ligne du texte etant le badge de remise
    const cardName = async (c) => ((await c.getAttribute('aria-label')) || '').replace(/^Voir le produit ›\s*/, '').trim();
    const countText = (pg, re) => panelOf(pg).getByText(re).count();
    const sayAsk = async (pg, text, re) => ask(pg, text, re, 20000);
    // le suivi reste en arriere-plan : le chat ne propose JAMAIS de bouton pour « suivre » ou « ne plus suivre »
    const TRACK_CHIP = /suivre|suivi|Ne plus me|Autoriser|Mes articles vus|تتبع|متابع/i;
    const noTrackingChips = async (pg) => !(await chipLabels(pg)).some((c) => TRACK_CHIP.test(c));
    console.log('info  suggestions : sandales', sandales.name.trim(), '| parfums', perfumes.map((p) => p.name.trim()).join(' / '));

    // --- V1. la chaussure qui revient : Zara propose les tailles, puis des modeles similaires (vrais articles)
    {
      const v = await visitor(shoeProfile());
      await openZara(v);
      await waitText(v.page, /Cette paire semble vous intéresser/, 20000);
      const chips = await chipLabels(v.page);
      check('chaussure regardee 3 fois : Zara propose discretement, avec le message exact du patron', (await countText(v.page, '😊 Cette paire semble vous intéresser ! Voulez-vous revoir les tailles disponibles ou découvrir des modèles similaires ?')) === 1);
      check('boutons : « Voir les tailles », « Modeles similaires », « Non merci » (et le menu), aucun bouton de suivi', (await noTrackingChips(v.page)) && chips.some((c) => /Voir les tailles/.test(c)) && chips.some((c) => /Modèles similaires/.test(c)) && chips.some((c) => c === 'Non merci') && chips.some((c) => /Menu/.test(c)), chips);
      await v.page.screenshot({ path: path.join(OUT, 'V1-suggestion-chaussure.png') });
      let p = await readProfile(v.page);
      check('suggestion notee dans le profil : « montree », sur la bonne chaussure', p.suggestions.length === 1 && p.suggestions[0].outcome === 'shown' && p.suggestions[0].key === `product:${sandales.id}` && p.suggestions[0].kind === 'product_revisit' && p.products[sandales.id].lastSuggestionKind === 'product_revisit', p.suggestions);
      await tap(v.page, 'Voir les tailles', /Voici les tailles proposées pour/);
      check('« Voir les tailles » : les VRAIES tailles de la fiche', (await countText(v.page, `Voici les tailles proposées pour « ${sandales.name.trim()} » : ${sandales.sizes.join(', ')}`)) === 1, sandales.sizes);
      const sizesCards = await cardsOf(v.page).allInnerTexts();
      check('...avec la fiche de cette chaussure et son vrai prix', sizesCards.some((x) => x.includes(sandales.name.trim())) && num(sizesCards.find((x) => x.includes(sandales.name.trim())).match(/([\d\s  ]+)FCFA/)?.[1] || '') > 0);
      p = await readProfile(v.page);
      check('suggestion acceptee : notee UNE fois', p.suggestions.filter((s) => s.outcome === 'accepted').length === 1, p.suggestions.map((s) => s.outcome));
      const before = await cardsOf(v.page).count();
      await tap(v.page, 'Modèles similaires', /Voici des modèles similaires, disponibles en ce moment/);
      const added = await newCards(v.page, before);
      check('« Modeles similaires » : des vraies chaussures en stock de la meme categorie, jamais la meme', added.length >= 1);
      const names = await Promise.all(added.map(cardName));
      const sameCat = names.every((n) => { const pr = prods.find((x) => n.startsWith(x.name.trim().slice(0, 12))); return !!pr && pr.category_id === sandales.category_id && pr.stock > 0 && pr.id !== sandales.id; });
      check('...meme categorie, en stock, autre article', sameCat, names);
      p = await readProfile(v.page);
      check('...et l\'acceptation n\'est pas comptee une 2e fois', p.suggestions.filter((s) => s.outcome === 'accepted').length === 1);
      // fermer puis rouvrir : pas de 2e suggestion dans la meme visite
      await panelOf(v.page).getByRole('button', { name: 'Fermer' }).first().click();
      await sleep(600);
      await v.page.getByTestId('assistant-fab').click();
      await sleep(2500);
      check('une seule suggestion par visite : en rouvrant Zara, rien de nouveau', (await countText(v.page, /Cette paire semble vous intéresser/)) === 1 && p.suggestions.filter((s) => s.outcome === 'shown').length === 1);
      await sleep(9500); // l'envoi vers la base se fait avec la suggestion
      check('la suggestion part vers la base avec le reste (type de suggestion)', JSON.stringify(v.browsingCalls).includes('product_revisit'), v.browsingCalls.length);
      check('aucune erreur (suggestion chaussure)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- V2. « Non merci » : Zara se tait 7 jours
    {
      const v = await visitor(shoeProfile());
      await openZara(v);
      await waitText(v.page, /Cette paire semble vous intéresser/, 20000);
      await tap(v.page, 'Non merci', /D’accord, pas de souci 😊 Je reste là si vous avez besoin d’aide, sans insister/);
      const p = await readProfile(v.page);
      check('« Non merci » : Zara repond poliment et ne propose rien d\'autre', (await cardsOf(v.page).count()) === 0 && p.suggestions.some((s) => s.outcome === 'dismissed'));
      check('...et se tait pendant 7 jours', p.quietUntil > Date.now() + 6.9 * DAY && p.quietUntil < Date.now() + 7.1 * DAY, (p.quietUntil - Date.now()) / DAY);
      await v.ctx.close();
      // une nouvelle visite (nouvel onglet, meme appareil : le profil est garde, la conversation non)
      const w = await visitor(p);
      await openZara(w);
      await sleep(2500);
      check('nouvelle visite apres « Non merci » : aucune suggestion', (await countText(w.page, /Cette paire semble vous intéresser/)) === 0);
      await w.ctx.close();
    }

    // --- V3. plusieurs parfums regardes : Zara demande la famille de parfum et ne propose que ce que les fiches annoncent
    {
      const v = await visitor(perfumeProfile());
      await openZara(v);
      await waitText(v.page, /Vous découvrez plusieurs parfums/, 20000);
      const chips = await chipLabels(v.page);
      check('3 parfums regardes : le message exact du patron avec les 4 familles', (await countText(v.page, '🥰 Vous découvrez plusieurs parfums. Préférez-vous une fragrance fraîche, boisée, sucrée ou intense ? Je peux vous aider à choisir.')) === 1 && ['Fraîche', 'Boisée', 'Sucrée', 'Intense'].every((f) => chips.some((c) => c.includes(f))) && chips.some((c) => c === 'Non merci'), chips);
      await v.page.screenshot({ path: path.join(OUT, 'V3-suggestion-parfums.png') });
      const before = await cardsOf(v.page).count();
      await tap(v.page, 'Boisée', /Voici les parfums dont la fiche annonce une fragrance boisée/);
      const added = await newCards(v.page, before);
      const names = await Promise.all(added.map(cardName));
      const woodWords = /\b(bois|boise|boisee|boisees|cedre|santal|vetiver|oud|agar|wood|woody)\b/;
      const allWoody = names.length >= 1 && names.every((n) => { const pr = prods.find((x) => n.startsWith(x.name.trim().slice(0, 12))); return !!pr && pr.stock > 0 && woodWords.test(fold(`${pr.name} ${pr.description}`)); });
      check('« Boisee » : seulement des parfums en stock dont la fiche parle de bois, de cedre, de santal, d\'oud...', allWoody, names);
      check('...et les prix sont ceux de la boutique', (await Promise.all(added.map(async (c) => { const n = await cardName(c); const pr = prods.find((x) => n.startsWith(x.name.trim().slice(0, 12))); return pr && (await cardPrice(c)) === Math.round(Number(pr.price)); }))).every(Boolean));
      const p = await readProfile(v.page);
      check('suggestion « parfums » notee : montree puis acceptee', p.suggestions.some((s) => s.kind === 'perfume_browse' && s.outcome === 'shown') && p.suggestions.some((s) => s.kind === 'perfume_browse' && s.outcome === 'accepted'), p.suggestions);
      check('aucune erreur (suggestion parfums)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- V4 a V7. le client ne sait JAMAIS qu'il est suivi : Zara ne parle pas du suivi d'elle-meme, quoi qu'on lui demande
    const SUIVI_RE = /suivi|suivre|retient|retenu|retiens|regardés sur cet appareil|90 jours|confidentialité|historique|je n’ai encore noté/i;
    {
      const v = await visitor(null);
      await openZara(v);
      await sleep(2000);
      check('visiteur qui n\'a rien regarde : aucune suggestion', (await countText(v.page, /semble vous intéresser|Vous découvrez plusieurs parfums|Ce modèle vous plaît|quelques suggestions/)) === 0);
      const botTexts = (pg) => pg.evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1') || '{"messages":[]}').messages.filter((m) => m.role === 'assistant').map((m) => m.text));
      for (const q of ['Qu\'est-ce que j\'ai regardé ?', 'Tu me suis ?', 'tu peux me suivre', 'que sais-tu de moi']) {
        const n0 = (await botTexts(v.page)).length;
        await typeIn(v.page, q);
        for (let i = 0; i < 20 && (await botTexts(v.page)).length <= n0; i++) await sleep(300);
        await sleep(1500);
        const added = (await botTexts(v.page)).slice(n0).join('\n');
        check(`« ${q} » : Zara repond (jamais en silence) mais ne parle ni de suivi, ni d'historique, ni de ce qui est retenu`, added.length > 0 && !SUIVI_RE.test(added), added.slice(0, 300));
        check(`« ${q} » : aucun bouton de suivi ni de confidentialite`, await noTrackingChips(v.page));
      }
      check('aucune erreur (questions sur le suivi)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // un client qui ECRIT « ne me suis plus » est respecte (tout est efface), sans que Zara en parle d'elle-meme
    {
      const v = await visitor(profileOf([rec(clarks), rec(perfumes[0]), shoeRec()], { quiet: true }));
      await openZara(v);
      await sleep(1500);
      check('suggestions en pause (« Non merci » recent) : aucune suggestion a l\'ouverture', (await countText(v.page, /Cette paire semble vous intéresser/)) === 0);
      check('le chat n\'affiche aucun bouton de suivi', await noTrackingChips(v.page));
      await sayAsk(v.page, 'ne me suis plus', /Je ne retiens plus les articles que vous regardez, et ce qui était retenu sur cet appareil est effacé/);
      await sleep(800);
      check('le client ECRIT « ne me suis plus » : Zara obeit, le profil de l\'appareil est efface, le choix « refuse » est retenu', (await readProfile(v.page)) === null && JSON.parse(await v.page.evaluate((k) => localStorage.getItem(k), CK)).choice === 'denied');
      check('...et la base est priee d\'effacer (avec l\'identifiant anonyme)', v.forgets.length === 1 && v.forgets[0].p_visitor_id === '0f1e2d3c-4b5a-4968-8777-665544332211', v.forgets);
      await sayAsk(v.page, 'ne me suis plus', /C’est déjà le cas/);
      check('« ne me suis plus » une 2e fois : « c\'est deja le cas », aucun bouton de suivi', await noTrackingChips(v.page));
      check('aucune erreur (demande ecrite)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // signal « Ne pas me suivre » du navigateur : rien n'est note, Zara n'en parle pas
    {
      const v = await visitor(null, { initScripts: ["Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });"] });
      await openZara(v);
      const botTexts2 = (pg) => pg.evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1') || '{"messages":[]}').messages.filter((m) => m.role === 'assistant').map((m) => m.text));
      const m0 = (await botTexts2(v.page)).length;
      await typeIn(v.page, 'Qu\'est-ce que j\'ai regardé ?');
      await sleep(4500);
      const said = (await botTexts2(v.page)).slice(m0).join('\n');
      check('navigateur « Ne pas me suivre » : rien n\'est note, rien n\'est envoye, et Zara n\'en parle pas', (await readProfile(v.page)) === null && v.browsingCalls.length === 0 && !SUIVI_RE.test(said), said.slice(0, 200));
      await v.ctx.close();
    }

    // --- V8. en arabe
    {
      const v = await visitor(shoeProfile(), { lang: 'ar' });
      await openZara(v, /أنشئ حسابك|حسابك/);
      await waitText(v.page, /يبدو أن هذا الحذاء أعجبك/, 20000);
      const chips = await chipLabels(v.page);
      check('arabe : la suggestion et ses boutons sont en arabe', chips.some((c) => /عرض المقاسات/.test(c)) && chips.some((c) => /لا شكراً/.test(c)), chips);
      await tap(v.page, 'عرض المقاسات', /هذه المقاسات المعروضة/);
      await sayAsk(v.page, 'لا تتبعني', /لن أحتفظ بعد الآن بالمنتجات التي تشاهدها/);
      check('arabe : « لا تتبعني » arrete le suivi et efface', (await readProfile(v.page)) === null && v.forgets.length === 1);
      await v.ctx.close();
    }

    // --- V9. Zara parle deja du produit regarde : pas de suggestion par-dessus
    {
      const v = await visitor(shoeProfile());
      await v.page.goto(`${base}/produit/${sandales.slug}`, { waitUntil: 'load' });
      await sleep(3500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/, 25000);
      await sleep(2500);
      check('Zara a deja parle du produit regarde : aucune suggestion en plus', (await countText(v.page, /Cette paire semble vous intéresser/)) === 0);
      await v.ctx.close();
    }
  }

  // =============================================== W. ADMIN : TABLEAU DE SUIVI DE NAVIGATION ===============================================
  if (PARTS.includes('W')) {
    console.log('\n== W. page administrateur « Suivi de navigation » (fausse base : aucune vraie donnee)');
    const base = `http://localhost:${port}`;
    const uid = '22222222-2222-4222-8222-222222222222';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const accountOf = ({ is_admin = true } = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', banned: false, role: 'admin', is_admin } };
    };
    const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const NOW = Date.now();
    const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
    const OVERVIEW = {
      rows: [
        { visitor_ref: 'V-a1b2c3', account_ref: null, session_id: null, product_id: 'p1', product_name: 'Sandales AL madjaz', category_name: 'Chaussures', views: 4, sessions: 2, active_seconds: 185, last_duration_seconds: 62, last_viewed_at: iso(5 * 60000), variant_clicks: 7, cart_status: 'in_cart', order_status: null, interest: 'eleve', last_suggestion_kind: 'product_revisit', last_suggestion_at: iso(3 * 60000) },
        { visitor_ref: 'V-d4e5f6', account_ref: 'C-9f8e7d6c', session_id: 's-1', product_id: 'p2', product_name: 'Parfum Aqua', category_name: 'Parfum', views: 2, sessions: 1, active_seconds: 45, last_duration_seconds: 30, last_viewed_at: iso(3 * 3600000), variant_clicks: 0, cart_status: 'purchased', order_status: 'delivered', interest: 'moyen', last_suggestion_kind: 'perfume_browse', last_suggestion_at: iso(2 * 3600000) },
        { visitor_ref: 'V-0a0b0c', account_ref: null, session_id: null, product_id: 'p3', product_name: 'Chemise bleue', category_name: 'Vêtements', views: 1, sessions: 1, active_seconds: 8, last_duration_seconds: 8, last_viewed_at: iso(2 * 86400000), variant_clicks: 0, cart_status: 'none', order_status: null, interest: 'leger', last_suggestion_kind: null, last_suggestion_at: null },
      ],
      top_products: [{ product_id: 'p1', product_name: 'Sandales AL madjaz', category_name: 'Chaussures', views: 9, active_seconds: 420, visitors: 3, high_interest: 2 }, { product_id: 'p2', product_name: 'Parfum Aqua', category_name: 'Parfum', views: 5, active_seconds: 100, visitors: 2, high_interest: 0 }],
      top_categories: [{ category: 'Chaussures', views: 11, visitors: 4 }, { category: 'Parfum', views: 6, visitors: 3 }],
      top_searches: [{ query: 'sandales', n: 6 }, { query: 'parfum oud', n: 3 }],
      levels: { eleve: 1, moyen: 1, leger: 1 },
      totals: { visitors: 3, rows: 3 },
    };
    const open = async (fakeOverview, admin = true) => {
      const fu = accountOf({ is_admin: admin });
      const c = await newVisitor(phone, { lang: 'fr', storage: SK ? { [SK]: fu.session } : {}, fakeUser: fu, fakeOverview });
      await c.page.goto(`${base}/admin/suivi-navigation`, { waitUntil: 'load' });
      return c;
    };
    const norm = (s) => s.replace(/[\s  ]+/g, ' ').trim();
    const text = async (c, id) => norm(await c.page.getByTestId(id).innerText());

    {
      // --- W1. les chiffres, les lignes, les filtres
      {
        const c = await open({ replies: [{ body: OVERVIEW }] });
        await c.page.getByTestId('browsing-levels').waitFor({ timeout: 25000 });
        check('niveaux d\'interet : 3 visiteurs, 1 eleve, 1 moyen, 1 leger', (await text(c, 'browsing-level-visitors')).startsWith('3') && (await text(c, 'browsing-level-eleve')).startsWith('1') && (await text(c, 'browsing-level-moyen')).startsWith('1') && (await text(c, 'browsing-level-leger')).startsWith('1'));
        check('articles les plus regardes : Sandales en tete (9 vues, 3 visiteurs, 7 min au total, 2 interets eleves)', /1 Sandales AL madjaz Chaussures · 3 visiteur\(s\) · 7 min 00 s au total · 2 intérêt élevé 9/.test(await text(c, 'browsing-top-product-0')), await text(c, 'browsing-top-product-0'));
        check('categories et recherches les plus frequentes', /Chaussures 4 visiteur\(s\) 11/.test(await text(c, 'browsing-top-categories')) && /« sandales » 6/.test(await text(c, 'browsing-top-searches')) && /« parfum oud » 3/.test(await text(c, 'browsing-top-searches')));
        const r0 = await text(c, 'browsing-row-0');
        check('ligne 1 : visiteur anonyme, produit, categorie, vues, temps actif, derniere visite, clics, panier, suggestion', /Sandales AL madjaz/.test(r0) && /Chaussures · Visiteur V-a1b2c3/.test(r0) && /Élevé/.test(r0) && /VUES 4/.test(r0) && /VISITES 2/.test(r0) && /TEMPS ACTIF 3 min 05 s/.test(r0) && /DERNIÈRE VISITE 1 min 02 s · il y a 5 min/.test(r0) && /CLICS \(PHOTOS, TAILLES, COULEURS\) 7/.test(r0) && /PANIER Au panier/.test(r0) && /COMMANDE —/.test(r0) && /Tailles \/ modèles similaires · il y a 3 min/.test(r0), r0);
        check('ligne 1 : visiteur sans compte -> pas de numero de session', /SESSION sans compte/.test(r0));
        const r1 = await text(c, 'browsing-row-1');
        check('ligne 2 : client connecte (code C-, jamais son nom), achete, commande livree, suggestion « parfums »', /Parfum · Compte C-9f8e7d6c/.test(r1) && /SESSION s-1/.test(r1) && !/Admin|Ahmed|@/.test(r1) && /Moyen/.test(r1) && /PANIER Acheté/.test(r1) && /COMMANDE Livrée/.test(r1) && /Familles de parfums · il y a 2 h/.test(r1), r1);
        const r2 = await text(c, 'browsing-row-2');
        check('ligne 3 : interet leger, 8 s, vue il y a 2 jours, aucune suggestion', /Léger/.test(r2) && /TEMPS ACTIF 8 s/.test(r2) && /il y a 2 j/.test(r2) && /DERNIÈRE SUGGESTION DE ZARA —/.test(r2), r2);
        check('la page explique comment lire (temps actif, estimation, jamais une certitude, 90 jours)', (await c.page.getByText(/le temps passé seul ne suffit jamais/).count()) === 1 && (await c.page.getByText(/effacées après 90 jours/).count()) === 1);
        await c.page.screenshot({ path: path.join(OUT, 'W1-suivi-navigation.png') });
        await c.page.getByTestId('browsing-filter-eleve').click();
        check('filtre « Eleve » : seulement la ligne a interet eleve', (await c.page.getByTestId('browsing-row-0').count()) === 1 && (await c.page.getByTestId('browsing-row-1').count()) === 0 && /Sandales/.test(await text(c, 'browsing-row-0')));
        await c.page.getByTestId('browsing-filter-leger').click();
        check('filtre « Leger » : la chemise', /Chemise bleue/.test(await text(c, 'browsing-row-0')) && (await c.page.getByTestId('browsing-row-1').count()) === 0);
        await c.page.getByTestId('browsing-filter-all').click();
        check('filtre « Tous » : les 3 lignes', (await c.page.getByTestId('browsing-row-2').count()) === 1);
        const body0 = c.overviewCalls[0] || {};
        check('periode par defaut « 30 jours » : demande avec une date de debut, 300 lignes au plus', typeof body0.p_since === 'string' && body0.p_limit === 300, body0);
        await c.page.getByTestId('browsing-period-all').click();
        await sleep(1200);
        check('periode « Tout » : demande sans date de debut', c.overviewCalls.length >= 2 && c.overviewCalls[c.overviewCalls.length - 1].p_since === null, c.overviewCalls.map((x) => x.p_since));
        check('aucune erreur (tableau de suivi)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }

      // --- W2. rien a montrer / script pas applique / refus / panne
      {
        const c = await open({ replies: [{ body: { rows: [], top_products: [], top_categories: [], top_searches: [], levels: {}, totals: { visitors: 0, rows: 0 } } }] });
        await c.page.getByTestId('browsing-empty').waitFor({ timeout: 25000 });
        check('aucun article regarde : message clair, niveaux a zero, pas de tableau vide', (await text(c, 'browsing-level-visitors')).startsWith('0') && (await c.page.getByTestId('browsing-top-products').count()) === 0);
        await c.ctx.close();
      }
      {
        const c = await open({ replies: [{ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.browsing_overview(p_limit, p_since) in the schema cache' } }] });
        await c.page.getByTestId('browsing-not-installed').waitFor({ timeout: 25000 });
        check('script pas encore applique : « pas encore active » avec les 3 etapes (add-browsing-intelligence.sql), la boutique marche', /add-browsing-intelligence\.sql/.test(await text(c, 'browsing-not-installed')) && /Zara utilise déjà ce que le téléphone du client a retenu/.test(await text(c, 'browsing-not-installed')));
        await c.ctx.close();
      }
      {
        const c = await open({ replies: [{ status: 403, body: { code: '42501', message: 'Accès réservé aux administrateurs' } }] });
        await c.page.getByTestId('browsing-error').waitFor({ timeout: 25000 });
        check('acces refuse par la base : « Acces refuse »', /Accès refusé/.test(await text(c, 'browsing-error')));
        await c.ctx.close();
      }
      {
        const c = await open({ replies: [{ status: 500, body: { code: 'XX000', message: 'service indisponible' } }, { body: OVERVIEW }] });
        await c.page.getByTestId('browsing-error').waitFor({ timeout: 25000 });
        check('panne : message + bouton « Reessayer »', /service indisponible/.test(await text(c, 'browsing-error')));
        await c.page.getByTestId('browsing-retry').click();
        await c.page.getByTestId('browsing-levels').waitFor({ timeout: 15000 });
        check('« Reessayer » : les donnees s\'affichent', (await text(c, 'browsing-level-visitors')).startsWith('3'));
        await c.ctx.close();
      }
      {
        const c = await open({ replies: [{ body: OVERVIEW }] }, false);
        await c.page.getByText('Accès réservé aux administrateurs.').waitFor({ timeout: 25000 });
        check('client NON administrateur : page refusee, aucune demande envoyee a la base', c.overviewCalls.length === 0);
        await c.ctx.close();
      }
      // donnees abimees : l'ecran ne casse pas
      {
        const c = await open({ replies: [{ body: { rows: [{ visitor_ref: null, product_id: 5, views: 'abc', interest: 'bizarre', cart_status: 'x' }, null, 'texte'], levels: 'x', totals: null, top_products: 'x' } }] });
        await c.page.getByTestId('browsing-row-0').waitFor({ timeout: 25000 });
        check('donnees incompletes ou abimees : l\'ecran s\'affiche quand meme (valeurs sures), sans erreur', /Article sans nom/.test(await text(c, 'browsing-row-0')) && /VUES 0/.test(await text(c, 'browsing-row-0')) && /Léger/.test(await text(c, 'browsing-row-0')) && c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      // le lien depuis le tableau de bord et le menu du compte
      {
        const fu = accountOf();
        const c = await newVisitor(phone, { lang: 'fr', storage: { [SK]: fu.session }, fakeUser: fu, fakeOverview: { replies: [{ body: OVERVIEW }] } });
        await c.page.goto(`${base}/compte`, { waitUntil: 'load' });
        await c.page.getByText('Espace Admin', { exact: true }).waitFor({ timeout: 25000 });
        await c.page.getByText('Espace Admin', { exact: true }).click();
        await c.page.getByText('Suivi de navigation', { exact: true }).waitFor({ timeout: 10000 });
        await c.page.getByText('Suivi de navigation', { exact: true }).click();
        await c.page.getByTestId('browsing-levels').waitFor({ timeout: 25000 });
        check('menu « Espace Admin » : « Suivi de navigation » ouvre le tableau de suivi', /suivi-navigation/.test(new URL(c.page.url()).pathname));
        check('aucune erreur (menu administrateur)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
    }
  }

  // =============================================== X. MOMENTS FORTS ET ACHATS EN GROS ===============================================
  if (PARTS.includes('X')) {
    console.log('\n== X. moments forts (Tabaski, Ramadan, mariage, fete des meres, Black Friday, Saint-Valentin) et achats en gros vers WhatsApp');
    const base = `http://localhost:${port}`;
    const visitor = (extra = {}) => newVisitor(phone, { lang: extra.lang || 'fr', storage: { albasse_zara_name: 'Ali' }, initScripts: extra.initScripts || [] });
    const openZara = async (v) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?|أنشئ حسابك|حسابك/, 25000);
    };
    const sayAskX = (pg, text, re) => ask(pg, text, re, 20000);
    const prodsAll = await get('products?select=id,name,price,compare_at_price,stock&limit=1000');

    // --- X1. moments forts en francais : un mot adapte, puis Zara continue (un visiteur neuf pour chaque sujet)
    {
      const one = async (q, re) => {
        const v = await visitor();
        await openZara(v);
        await sayAskX(v.page, q, re);
        await sleep(1500);
        return v;
      };
      let v = await one('tabaski', /Tabaski : un beau moment en famille/);
      await waitText(v.page, /C’est pour qui \?/);
      check('Tabaski : un mot adapte puis la question « pour qui ? » (conseil cadeau), aucune remise annoncee', !/remise|%/.test(await panelOf(v.page).getByText(/Tabaski : un beau moment en famille/).first().innerText()));
      await v.page.screenshot({ path: path.join(OUT, 'X1-tabaski.png') });
      check('aucune erreur (Tabaski)', v.errs.length === 0, v.errs);
      await v.ctx.close();
      v = await one('fête des mères', /Fête des mères : une belle attention pour elle/);
      check('fete des meres : le message avec l\'emballage cadeau (2 000 FCFA), et Zara sait deja que c\'est pour « elle » (elle ne demande pas pour qui)', (await panelOf(v.page).getByText(/C’est pour qui \?/).count()) === 0 && /2\s000 FCFA par commande/.test(await panelOf(v.page).getByText(/Fête des mères : une belle attention pour elle/).first().innerText()));
      await v.ctx.close();
      v = await one('Saint-Valentin', /Saint-Valentin : une belle idée pour la personne qui compte/);
      check('Saint-Valentin : le message, puis « pour qui ? »', (await panelOf(v.page).getByText(/C’est pour qui \?/).count()) === 1);
      await v.ctx.close();
      v = await one('un cadeau de mariage', /Un mariage ! Tenues, montres, parfums/);
      await v.ctx.close();
      v = await one('Ramadan Karim', /Ramadan Karim ! Tenues, parfums, cadeaux/);
      await v.ctx.close();
      v = await one('Korité', /Aïd Moubarak ! Pour la fête/);
      check('mariage, Ramadan, Korite : un message adapte chacun', true);
      await v.ctx.close();
    }

    // --- X2. un article precis pour un moment fort : Zara montre de vrais articles
    {
      const v = await visitor();
      await openZara(v);
      const before = await cardsOf(v.page).count();
      await sayAskX(v.page, 'parfum pour la fête des mères', /Fête des mères : une belle attention pour elle/);
      await sleep(3000);
      const added = await newCards(v.page, before);
      const names = await Promise.all(added.map(async (c) => ((await c.getAttribute('aria-label')) || '').replace(/^Voir le produit ›\s*/, '').trim()));
      check('« parfum pour la fete des meres » : de vrais parfums en stock (ou la question suivante), jamais une recherche « fete des meres »', (await panelOf(v.page).getByText(/Je n’ai rien trouvé|n’ai pas trouvé/).count()) === 0, names);
      await v.ctx.close();
    }

    // --- X3. Black Friday : les VRAIES promotions
    {
      const v = await visitor();
      await openZara(v);
      const before = await cardsOf(v.page).count();
      await sayAskX(v.page, 'Black Friday', /Black Friday : je vous montre les vraies promotions en cours/);
      await sleep(3000);
      const added = await newCards(v.page, before);
      const checks = await Promise.all(added.map(async (c) => {
        const n = ((await c.getAttribute('aria-label')) || '').replace(/^Voir le produit ›\s*/, '').trim();
        const pr = prodsAll.find((x) => n.startsWith(x.name.trim().slice(0, 12)));
        return !!pr && pr.stock > 0 && Number(pr.compare_at_price) > Number(pr.price);
      }));
      check('Black Friday : des articles reellement en promotion dans la base (ancien prix > prix) et en stock', added.length >= 1 && checks.every(Boolean), checks);
      await v.page.screenshot({ path: path.join(OUT, 'X3-black-friday.png') });
      await v.ctx.close();
    }

    // --- X4. en arabe
    {
      const v = await visitor({ lang: 'ar' });
      await openZara(v);
      await sayAskX(v.page, 'رمضان', /رمضان كريم! ملابس وعطور وهدايا/);
      await sayAskX(v.page, 'عيد الأم', /عيد الأم: لفتة جميلة لها/);
      await sayAskX(v.page, 'الجمعة السوداء', /الجمعة السوداء: أعرض لك العروض الحقيقية/);
      check('arabe : les moments forts sont compris et repondus en arabe', true);
      await v.ctx.close();
    }

    // --- X5. gros / cartons : Zara passe la main a l'equipe sur WhatsApp, sans jamais donner de prix de gros
    {
      const v = await visitor();
      await v.ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>whatsapp</body></html>' }));
      await openZara(v);
      for (const q of ['prix en gros', 'combien le carton ?', 'je veux 50 pièces']) {
        await sayAskX(v.page, q, /Pour les achats en gros \(cartons, grandes quantités\), les prix sont donnés directement par notre équipe/);
      }
      const reply = await panelOf(v.page).getByText(/Pour les achats en gros/).last().innerText();
      check('gros : Zara renvoie vers l\'equipe, SANS aucun prix ni chiffre', !/\d/.test(reply) && /WhatsApp/.test(reply), reply.slice(0, 200));
      const chips = await chipLabels(v.page);
      check('boutons : « Parler a l\'equipe (gros) » et « Menu »', chips.some((c) => /Parler à l’équipe \(gros\)/.test(c)) && chips.some((c) => /Menu/.test(c)), chips);
      const [popup] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), chip(v.page, 'Parler à l’équipe (gros)').click()]);
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      const url = popup.url();
      check('le bouton ouvre WhatsApp avec le numero de la boutique et un message deja ecrit (article, quantite, ville)', url.startsWith('https://wa.me/23560605151?text=') && /prix de gros/.test(decodeURIComponent(url)) && /Quantité/.test(decodeURIComponent(url)) && /Ville/.test(decodeURIComponent(url)), decodeURIComponent(url));
      await popup.close();
      // petites quantites : pas du gros
      await sayAskX(v.page, '2 parfums', /C’est pour qui \?|Quel type|Voici ce que j’ai trouvé/);
      check('« 2 parfums » : une recherche normale, jamais l\'equipe du gros', (await panelOf(v.page).getByText(/Pour les achats en gros/).count()) === 3);
      check('aucune erreur (gros)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- X6. grosse commande dans le panier : Zara propose l'equipe, une seule fois, sans bloquer la commande
    {
      const v = await visitor();
      await v.ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>whatsapp</body></html>' }));
      await openZara(v);
      const big = prodsAll.find((x) => /^armoire$/i.test(x.name.trim()));
      await typeIn(v.page, 'armoire');
      const card = cardsOf(v.page).filter({ hasText: /armoire/i }).first();
      await card.waitFor({ timeout: 20000 });
      await card.getByTestId('assistant-card-add').click();
      await waitText(v.page, /ajouté au panier\./);
      check('1er article a 280 000 FCFA (sous le seuil de 500 000) : aucune proposition d\'equipe', (await panelOf(v.page).getByText(/Grosse commande \?/).count()) === 0, big && big.price);
      await sleep(1500);
      await card.getByTestId('assistant-card-add').click();
      await waitText(v.page, /Grosse commande \? Notre équipe peut vous faire un prix/);
      const chips = await chipLabels(v.page);
      check('total de 560 000 FCFA (seuil 500 000) : Zara propose l\'equipe WhatsApp (bouton en tete) ET garde « Commander »', chips[0].includes('Parler à l’équipe (gros)') && chips.some((c) => /Commander/.test(c)), chips);
      await sleep(1500);
      await card.getByTestId('assistant-card-add').click();
      await sleep(2500);
      check('la proposition n\'est faite qu\'une fois par conversation (pas a chaque ajout)', (await panelOf(v.page).getByText(/Grosse commande \?/).count()) === 1);
      check('aucune erreur (grosse commande)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- X7. un moment fort qui approche : Zara en parle d'elle-meme, une fois 
    {
      const v = await visitor();
      await v.ctx.clock.setFixedTime(new Date('2026-11-10T09:00:00Z'));
      await openZara(v);
      await waitText(v.page, /Black Friday : je vous montre les vraies promotions en cours/);
      const texts = await panelOf(v.page).innerText();
      check('le 10 novembre 2026 (17 jours avant le Black Friday) : Zara en parle d\'elle-meme, avant les infos importantes, une seule fois', (texts.match(/Black Friday : je vous montre/g) || []).length === 1 && texts.indexOf('Black Friday : je vous montre') < texts.indexOf('À savoir avant de commander'));
      await v.page.screenshot({ path: path.join(OUT, 'X7-moment-fort-proactif.png') });
      await v.ctx.close();
      const w = await visitor();
      await w.ctx.clock.setFixedTime(new Date('2026-12-15T09:00:00Z'));
      await openZara(w);
      await sleep(1500);
      check('le 15 decembre 2026 (aucun moment fort proche) : Zara n\'en parle pas', (await panelOf(w.page).getByText(/Black Friday|Saint-Valentin|Tabaski|Ramadan/).count()) === 0);
      await w.ctx.close();
    }
  }

  // =============================================== Y. CONCLURE LA VENTE, PREUVES VRAIES, PACKS ===============================================
  if (PARTS.includes('Y')) {
    console.log('\n== Y. conclure la vente (« je reflechis »), preuves VRAIES (ventes reelles, stock), pack (l\'article qui complete)');
    const base = `http://localhost:${port}`;
    const visitor = (extra = {}) => newVisitor(phone, { lang: extra.lang || 'fr', storage: { albasse_zara_name: 'Ali' }, fakeSales: extra.fakeSales || null, fakeCallbacks: extra.fakeCallbacks || null });
    const openZara = async (v) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?|أنشئ حسابك|حسابك/, 25000);
    };
    const rolex = realProduct;
    const prods = await get('products?select=id,name,slug,price,stock,images,category_id&is_active=eq.true&limit=1000');
    const catSlug = (id) => (cats.find((c) => c.id === id) || {}).slug;
    const CROSS = { vetements: ['chaussures', 'montre'], 'vetements-pour-femmes': ['sacs-et-bagages', 'parfum'], chaussures: ['sacs-et-bagages', 'montre'], montre: ['parfum', 'lunettes'], parfum: ['montre', 'cosmetique'], lunettes: ['montre', 'parfum'], cosmetique: ['parfum'], 'sacs-et-bagages': ['chaussures', 'parfum'] };
    const rolexCat = rolex ? catSlug(rolex.category_id) : null;
    // ajoute le produit « rolex » au panier depuis la conversation (choisit la 1re taille / couleur si Zara la demande)
    const addRolex = async (v) => {
      await typeIn(v.page, 'rolex');
      const card = cardsOf(v.page).filter({ hasText: /rolex/i }).first();
      await card.waitFor({ timeout: 20000 });
      await card.getByTestId('assistant-card-add').click();
      for (let i = 0; i < 3; i++) {
        const done = await panelOf(v.page).getByText(/ajouté au panier\./).count();
        if (done) break;
        await sleep(1200);
        const sizeChip = panelOf(v.page).getByTestId('assistant-chip').filter({ hasText: /Taille|Couleur|^\d+$/ }).first();
        if (await sizeChip.count()) await sizeChip.click();
      }
      await waitText(v.page, /ajouté au panier\./, 20000);
    };
    check('info : produit de test et sa categorie', !!rolex && !!rolexCat, { name: rolex && rolex.name, cat: rolexCat, stock: rolex && rolex.stock });

    // --- Y1. « je reflechis » sans panier et sans article montre : des mots simples, jamais de chiffre invente ; le rappel WhatsApp n'est PAS propose
    {
      const v = await visitor();
      await openZara(v);
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 20000);
      const msg = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
      check('« je reflechis » (sans panier, sans article montre) : « Pas de souci » et la porte reste ouverte', /Pas de souci/.test(msg), msg);
      check('sans panier : rien sur le panier, aucun chiffre de commandes, aucune validite 48 h', !/panier reste enregistré/.test(msg) && !/\d/.test(msg), msg);
      const chips = await chipLabels(v.page);
      check('le rappel WhatsApp n\'est PAS propose a quelqu\'un qui n\'hesite pas encore a commander (ni phrase, ni bouton)', !/WhatsApp/.test(msg) && !chips.some((c) => /Me rappeler/.test(c)), [msg, chips]);
      check('boutons : « Promotions », « Menu » (et « Creer mon compte » : visiteur sans compte)', chips.some((c) => /Promotions/.test(c)) && chips.some((c) => /Menu/.test(c)) && chips.some((c) => /Créer mon compte/.test(c)), chips);
      await v.page.screenshot({ path: path.join(OUT, 'Y1-je-reflechis.png') });
      check('aucune erreur (je reflechis)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- Y1b. le client a regarde un article puis hesite : LA, le rappel WhatsApp est propose
    if (rolex) {
      const v = await visitor();
      await openZara(v);
      await typeIn(v.page, 'rolex');
      await cardsOf(v.page).filter({ hasText: /rolex/i }).first().waitFor({ timeout: 20000 });
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 20000);
      const msg = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
      check('apres avoir regarde un article : « je reflechis » -> l\'offre d\'un rappel WhatsApp par l\'equipe', /Pas de souci/.test(msg) && /l’équipe peut vous écrire sur WhatsApp/.test(msg), msg);
      const chips = await chipLabels(v.page);
      check('boutons : « Me rappeler sur WhatsApp », « Promotions », « Menu »', chips.some((c) => /Me rappeler sur WhatsApp/.test(c)) && chips.some((c) => /Promotions/.test(c)) && chips.some((c) => /Menu/.test(c)), chips);
      check('aucune erreur (je reflechis apres un article)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- Y2. avec des ventes REELLES (9 commandes) : preuve a l'ajout, puis pack, puis « je reflechis » avec le panier
    if (rolex) {
      const v = await visitor({ fakeSales: { rows: [{ product_id: rolex.id, orders_count: 9 }] } });
      await openZara(v);
      const before = await cardsOf(v.page).count();
      await addRolex(v);
      await sleep(2500);
      const added = await panelOf(v.page).getByText(/ajouté au panier\./).last().innerText();
      check('a l\'ajout : la preuve VRAIE (9 commandes sur 7 jours, le chiffre vient de la base)', /Cet article a été commandé 9 fois ces 7 derniers jours\./.test(added) && !/%/.test(added), added);
      // pack : l'article qui complete
      const packMsgs = await panelOf(v.page).getByText(/Pour compléter votre choix :/).count();
      if (packMsgs === 1) {
        const pack = await panelOf(v.page).getByText(/Pour compléter votre choix :/).first().innerText();
        const tot = num((pack.match(/=\s*([\d\s  ]+)\s*FCFA/) || [])[1] || '');
        const cards = await newCards(v.page, before);
        const last = cards[cards.length - 1];
        const compName = ((await last.getAttribute('aria-label')) || '').replace(/^Voir le produit ›\s*/, '').trim();
        const comp = prods.find((x) => x.name.trim() === compName);
        const compCat = comp ? catSlug(comp.category_id) : null;
        check('pack : l\'article propose est d\'une categorie qui va avec ' + rolexCat + ' (' + (CROSS[rolexCat] || []).join(' / ') + '), en stock', !!comp && (CROSS[rolexCat] || []).includes(compCat) && comp.stock > 0, { compName, compCat });
        check('pack : le total annonce = prix des deux articles, sans remise ni pourcentage', !!comp && tot === Number(rolex.price) + Number(comp.price) && !/remise|%|gratuit|offert/i.test(pack), { tot, a: rolex.price, b: comp && comp.price });
        const chipsAfterPack = await chipLabels(v.page);
        check('apres le pack : « Voir mon panier », « Commander » et « Emballage cadeau » restent disponibles', chipsAfterPack.some((c) => /panier/i.test(c)) && chipsAfterPack.some((c) => /Commander/.test(c)) && chipsAfterPack.some((c) => /mballage/.test(c)), chipsAfterPack);
        await v.page.screenshot({ path: path.join(OUT, 'Y2-pack.png') });
      } else {
        check('pack : aucun complement en stock dans la boutique pour cette categorie (message absent, rien d\'invente)', packMsgs === 0, packMsgs);
      }
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 25000);
      const later = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
      check('« je reflechis » avec le panier : le panier est garde, la preuve vraie (9), la commande valable 48 h, l\'offre de rappel', /Votre panier reste enregistré sur cet appareil\./.test(later) && /commandé 9 fois ces 7 derniers jours/.test(later) && /la commande reste valable 48 h\./.test(later) && /rappel|écrire sur WhatsApp/.test(later), later);
      const chips2 = await chipLabels(v.page);
      check('boutons : « Commander » (en tete), « Me rappeler sur WhatsApp », « Voir mon panier »', /Commander/.test(chips2[0]) && chips2.some((c) => /Me rappeler sur WhatsApp/.test(c)) && chips2.some((c) => /panier/i.test(c)), chips2);
      check('aucune erreur (preuve, pack, conclusion)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- Y3. chiffre trop faible (2) ou fonction de la base absente : AUCUNE preuve, aucune erreur
    if (rolex) {
      for (const [label, extra] of [['2 commandes seulement (sous le seuil de 3)', { fakeSales: { rows: [{ product_id: rolex.id, orders_count: 2 }] } }], ['fonction de la base introuvable (script pas applique)', { fakeSales: { status: 404 } }], ['aucune reponse de la base (requete coupee)', { fakeSales: { abort: true } }]]) {
        const v = await visitor(extra);
        await openZara(v);
        await addRolex(v);
        await sleep(2000);
        const added = await panelOf(v.page).getByText(/ajouté au panier\./).last().innerText();
        check(`${label} : aucune preuve de ventes dans le message d'ajout`, !/commandé \d+ fois/.test(added), added);
        await ask(v.page, 'je réfléchis', /Prenez votre temps/, 25000);
        const later = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
        check(`${label} : aucune preuve dans « je reflechis » non plus, mais le panier est garde`, !/commandé \d+ fois/.test(later) && /panier reste enregistré/.test(later), later);
        check(`${label} : aucune erreur affichee`, v.errs.length === 0 && (await panelOf(v.page).getByText(/Oups|erreur|problème/i).count()) === 0, v.errs);
        await v.ctx.close();
      }
    }

    // --- Y4. en arabe
    {
      const v = await visitor({ lang: 'ar' });
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /أنشئ حسابك|حسابك/, 25000);
      await ask(v.page, 'لاحقا', /خذ وقتك/, 20000);
      const chips = await chipLabels(v.page);
      check('en arabe : sans article regarde, « لاحقا » -> Zara conclut, sans bouton de rappel WhatsApp', !chips.some((c) => /تواصلوا معي على واتساب/.test(c)), chips);
      if (rolex) {
        await typeIn(v.page, 'rolex');
        await cardsOf(v.page).filter({ hasText: /rolex/i }).first().waitFor({ timeout: 20000 });
        await ask(v.page, 'لاحقا', /خذ وقتك/, 20000);
        const chips2 = await chipLabels(v.page);
        check('en arabe : apres avoir regarde un article, « لاحقا » -> Zara conclut en arabe avec le bouton de rappel WhatsApp', chips2.some((c) => /تواصلوا معي على واتساب/.test(c)), chips2);
      }
      await v.ctx.close();
    }
  }

  // =============================================== Z. RAPPEL WHATSAPP (chat + page admin) ===============================================
  if (PARTS.includes('Z')) {
    console.log('\n== Z. « Me rappeler sur WhatsApp » : prenom, numero, accord, demande envoyee a l\'equipe ; page admin « Rappels WhatsApp »');
    const base = `http://localhost:${port}`;
    // Les jours proposes par Zara, recalcules ici a part du code de l'application (heure du Tchad = UTC+1) : 5 jours ouvrables,
    // « aujourd'hui » seulement avant 15 h, jamais un dimanche. (Une horloge figee bloque les animations de la page : on prend l'heure reelle.)
    const DAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const MON_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const chadDays = (now = new Date()) => {
      const chad = new Date(now.getTime() + 3600000);
      const out = [];
      for (let off = chad.getUTCHours() < 15 ? 0 : 1; out.length < 5 && off < 14; off++) {
        const d = new Date(Date.UTC(chad.getUTCFullYear(), chad.getUTCMonth(), chad.getUTCDate() + off, 12));
        if (d.getUTCDay() === 0) continue;
        const plain = `${DAY_FR[d.getUTCDay()]} ${d.getUTCDate()} ${MON_FR[d.getUTCMonth()]}`;
        const label = off === 0 ? `Aujourd’hui (${plain})` : off === 1 ? `Demain (${plain})` : plain[0].toUpperCase() + plain.slice(1);
        out.push({ iso: d.toISOString().slice(0, 10), label, word: DAY_FR[d.getUTCDay()], dom: d.getUTCDate() });
      }
      return out;
    };
    const days = chadDays();
    const dayLabel = (iso) => {
      const d = new Date(iso + 'T12:00:00Z');
      return `${DAY_FR[d.getUTCDay()]} ${d.getUTCDate()} ${MON_FR[d.getUTCMonth()]}`;
    };
    const visitor = (extra = {}) => newVisitor(phone, { lang: extra.lang || 'fr', storage: extra.noName ? {} : { albasse_zara_name: 'Ali' }, fakeCallbacks: extra.fakeCallbacks || { calls: [], replies: [{ body: true }] } });
    const openZara = async (v, welcome = /Créez votre compte gratuit(?:, Ali)?|أنشئ حسابك|حسابك/) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, welcome, 25000);
    };

    // --- Z1. le parcours complet : demande ecrite, numero, accord, envoi
    {
      const fc = { calls: [], replies: [{ body: true }] };
      const v = await visitor({ fakeCallbacks: fc });
      await openZara(v);
      await ask(v.page, 'rappelez-moi', /Quel est votre numéro WhatsApp/, 20000);
      await ask(v.page, '12345', /Il faut 8 chiffres/, 20000);
      check('numero faux (12345) : Zara redemande, rien n\'est envoye', fc.calls.length === 0);
      await ask(v.page, '66 12 34 56', /Quel jour voulez-vous que l’équipe vous écrive/, 20000);
      const dayChips = await chipLabels(v.page);
      check('apres le numero : Zara demande le JOUR, avec les 5 prochains jours ouvrables (jamais un dimanche) et « Annuler »', days.length === 5 && days.every((d) => dayChips.includes(d.label)) && dayChips.some((c) => /Annuler/.test(c)), [dayChips, days.map((d) => d.label)]);
      check('rien n\'est envoye avant le jour et l\'accord du client', fc.calls.length === 0);
      await v.page.screenshot({ path: path.join(OUT, 'Z1-jour.png') });
      await ask(v.page, '45', /Je n’ai pas compris le jour/, 20000);
      check('un jour illisible (« 45 ») : Zara redonne les jours, rien n\'est devine ni envoye', fc.calls.length === 0 && (await chipLabels(v.page)).includes(days[2].label));
      await ask(v.page, days[2].word, /Je transmets à l’équipe : Ali, WhatsApp 66 12 34 56/, 20000);
      const confirmTxt = await panelOf(v.page).getByText(/Je transmets à l’équipe : Ali, WhatsApp 66 12 34 56/).last().innerText();
      check(`confirmation : prenom, numero ET jour choisi (« ${days[2].word} » ecrit par le client -> ${days[2].label})`, new RegExp(esc(days[2].label)).test(confirmTxt) && /C’est d’accord \?/.test(confirmTxt), confirmTxt);
      const chips = await chipLabels(v.page);
      check('boutons : « Oui, d\'accord », « Changer le numero », « Changer le jour », « Annuler »', chips.some((c) => /Oui, d’accord/.test(c)) && chips.some((c) => /Changer le numéro/.test(c)) && chips.some((c) => /Changer le jour/.test(c)) && chips.some((c) => /Annuler/.test(c)), chips);
      check('rien n\'est envoye avant l\'accord du client', fc.calls.length === 0);
      await v.page.screenshot({ path: path.join(OUT, 'Z1-confirmation.png') });
      await tap(v.page, 'Oui, d’accord', new RegExp('C’est noté ✅ L’équipe vous écrira sur WhatsApp : ' + esc(days[2].label)), 20000);
      check(`apres l'accord : UNE demande envoyee avec le prenom, le numero a 8 chiffres, l'origine « chat » et le JOUR (${days[2].iso})`, fc.calls.length === 1 && fc.calls[0].p_name === 'Ali' && fc.calls[0].p_phone === '66123456' && fc.calls[0].p_source === 'chat' && fc.calls[0].p_day === days[2].iso, fc.calls);
      check('la demande ne porte aucun mot de passe, aucun paiement : seulement prenom, numero, note, origine, appareil, jour', Object.keys(fc.calls[0]).sort().join(',') === 'p_day,p_device,p_name,p_note,p_phone,p_source', Object.keys(fc.calls[0]));
      await ask(v.page, 'promotions', /promotion|promo/i, 20000);
      check('apres la demande, Zara repond normalement (le parcours est termine)', (await panelOf(v.page).getByText(/Quel est votre numéro WhatsApp/).count()) === 1 && fc.calls.length === 1);
      check('aucune erreur (rappel)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- Z2. « Changer le numero », « Annuler », demande refusee par la base, base sans la fonction
    {
      const fc = { calls: [], replies: [{ body: true }] };
      const v = await visitor({ fakeCallbacks: fc });
      await openZara(v);
      await ask(v.page, 'appelez-moi demain', /Quel est votre numéro WhatsApp/, 20000);
      await ask(v.page, '91 23 45 67', /Quel jour voulez-vous/, 20000);
      await tap(v.page, days[1].label, /Je transmets à l’équipe : Ali, WhatsApp 91 23 45 67/, 20000);
      await tap(v.page, 'Changer le numéro', /Quel est votre numéro WhatsApp/, 20000);
      check('« Changer le numero » : Zara redemande le numero (rien d\'envoye)', fc.calls.length === 0);
      await ask(v.page, '+235 66 12 34 56', /WhatsApp 66 12 34 56/, 20000);
      const kept = await panelOf(v.page).getByText(/Je transmets à l’équipe : Ali, WhatsApp 66 12 34 56/).last().innerText();
      check('le jour deja choisi est garde apres « Changer le numero » : Zara ne le redemande pas', new RegExp(esc(days[1].label)).test(kept), kept);
      await tap(v.page, 'Changer le jour', /Quel jour voulez-vous/, 20000);
      check('« Changer le jour » : Zara redonne les jours (rien d\'envoye)', fc.calls.length === 0 && (await chipLabels(v.page)).includes(days[3].label));
      await tap(v.page, days[3].label, new RegExp(esc('Elle vous écrira sur WhatsApp : ' + days[3].label)), 20000);
      await tap(v.page, 'Annuler', /je n’enregistre rien/, 20000);
      check('« Annuler » : rien n\'est enregistre', fc.calls.length === 0);
      await ask(v.page, 'livraison', /livraison|Livraison/i, 20000);
      check('apres l\'annulation, Zara repond de nouveau normalement (elle n\'attend plus de numero)', (await panelOf(v.page).getByText(/Il faut 8 chiffres/).count()) === 0);
      await v.ctx.close();

      for (const [label, replies, re] of [['la base refuse (numero invalide pour elle)', [{ body: false }, { body: true }], /Quel est votre numéro WhatsApp/], ['script SQL pas applique (fonction introuvable)', [{ status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }], /Je n’ai pas pu enregistrer votre demande/]]) {
        const f2 = { calls: [], replies };
        const w = await visitor({ fakeCallbacks: f2 });
        await openZara(w);
        await ask(w.page, 'rappelez-moi', /Quel est votre numéro WhatsApp/, 20000);
        await ask(w.page, '66 12 34 56', /Quel jour voulez-vous/, 20000);
        await tap(w.page, days[1].label, /Je transmets à l’équipe/, 20000);
        const before = await panelOf(w.page).getByText(re).count();
        await chip(w.page, 'Oui, d’accord').click();
        const t0 = Date.now();
        while ((await panelOf(w.page).getByText(re).count()) <= before && Date.now() - t0 < 20000) await sleep(200);
        check(`${label} : Zara le dit simplement`, (await panelOf(w.page).getByText(re).count()) > before, f2.calls.length);
        if (re.source.includes('pas pu')) {
          const chipsF = await chipLabels(w.page);
          check('si la demande ne peut pas partir : bouton WhatsApp pour ecrire directement a l\'equipe', chipsF.some((c) => /WhatsApp/.test(c)), chipsF);
        }
        check(`${label} : aucune erreur`, w.errs.length === 0, w.errs);
        await w.ctx.close();
      }
    }

    // --- Z3. depuis « je reflechis » : l'origine est « later » ; visiteur sans prenom : Zara le demande
    {
      const fc = { calls: [], replies: [{ body: true }] };
      const v = await visitor({ fakeCallbacks: fc, noName: true });
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /Comment puis-je vous appeler \?/, 25000);
      await chip(v.page, 'Passer').click();
      await sleep(3500);
      await typeIn(v.page, 'rolex');
      await cardsOf(v.page).filter({ hasText: /rolex/i }).first().waitFor({ timeout: 20000 });
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 25000);
      await tap(v.page, 'Me rappeler sur WhatsApp', /Quel est votre prénom \?/, 20000);
      await ask(v.page, 'Awa', /Merci Awa/, 20000);
      await ask(v.page, '66 12 34 56', /Quel jour voulez-vous/, 20000);
      await ask(v.page, days[1].word, /Je transmets à l’équipe : Awa, WhatsApp 66 12 34 56/, 20000);
      await tap(v.page, 'Oui, d’accord', /C’est noté ✅/, 20000);
      check(`sans prenom connu : Zara le demande, puis le numero, puis le jour (${days[1].word}) ; l'origine est « later », l'article regarde est transmis`, fc.calls.length === 1 && fc.calls[0].p_name === 'Awa' && fc.calls[0].p_source === 'later' && fc.calls[0].p_day === days[1].iso && /rolex/i.test(fc.calls[0].p_note), fc.calls);
      await v.ctx.close();
    }

    // --- Z4. en arabe
    {
      const fc = { calls: [], replies: [{ body: true }] };
      const v = await visitor({ lang: 'ar', fakeCallbacks: fc });
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /أنشئ حسابك|حسابك/, 25000);
      await ask(v.page, 'اتصلوا بي', /ما رقم واتساب الخاص بك/, 20000);
      await ask(v.page, '66 12 34 56', /في أي يوم تريد/, 20000);
      const arChips = await chipLabels(v.page);
      check('en arabe : les 5 jours sont proposes avec des noms de jours arabes', arChips.filter((c) => /[؀-ۿ]/.test(c) && !/[a-z]/i.test(c)).length >= 5, arChips);
      await ask(v.page, String(days[2].dom), /أحول إلى الفريق: Ali، واتساب 66 12 34 56/, 20000);
      await tap(v.page, 'نعم، موافق', /تم التسجيل ✅/, 20000);
      check('en arabe : tout le parcours (numero, jour ecrit avec son numero, accord), la demande part avec le meme numero et le bon jour', fc.calls.length === 1 && fc.calls[0].p_phone === '66123456' && fc.calls[0].p_day === days[2].iso, fc.calls);
      await v.ctx.close();
    }

    // --- Z4b. « c'est cher » : le rappel n'est propose qu'a celui qui a deja regarde un article ou a un panier
    {
      const v = await visitor();
      await openZara(v);
      await ask(v.page, 'c’est trop cher', /Je comprends/, 20000);
      await sleep(2500);
      const chips = await chipLabels(v.page);
      check('« c\'est cher » sans article ni panier : pas de bouton de rappel WhatsApp (Promotions et Budget restent)', !chips.some((c) => /Me rappeler/.test(c)) && chips.some((c) => /Promotions/.test(c)), chips);
      await v.ctx.close();
    }

    // --- Z5. la page admin « Rappels WhatsApp » (fausse base)
    {
      const uid = '22222222-2222-4222-8222-222222222222';
      const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
      const accountOf = ({ is_admin = true } = {}) => {
        const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
        const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
        return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', banned: false, role: 'admin', is_admin } };
      };
      const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
      const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
      // jours demandes, par rapport a aujourd'hui (heure du Tchad)
      const chadIso = (plusDays) => new Date(Date.now() + 3600000 + plusDays * 86400000).toISOString().slice(0, 10);
      const [dLate, dToday, dSoon, dDone] = [chadIso(-1), chadIso(0), chadIso(3), chadIso(1)];
      const rowsOf = () => [
        { id: 'c1', created_at: iso(10 * 60000), name: 'Awa', phone: '66123456', note: 'Rolex (+1)', source: 'cart', device: 'Android', status: 'new', wanted_day: dSoon },
        { id: 'c2', created_at: iso(5 * 3600000), name: 'Moussa', phone: '91234567', note: '', source: 'later', device: 'Autre', status: 'new', wanted_day: dLate },
        { id: 'c3', created_at: iso(2 * 86400000), name: 'Hawa', phone: '66998877', note: 'Parfum Oud', source: 'price', device: 'iPhone', status: 'done', wanted_day: dDone },
        { id: 'c4', created_at: iso(3 * 3600000), name: 'Karim', phone: '60112233', note: 'Montre', source: 'chat', device: 'PC', status: 'new', wanted_day: dToday },
        { id: 'c5', created_at: iso(40 * 3600000), name: 'Zeinab', phone: '66554433', note: '', source: 'chat', device: 'Autre', status: 'new', wanted_day: null },
      ];
      const openAdmin = async (fc, admin = true) => {
        const fu = accountOf({ is_admin: admin });
        const c = await newVisitor(phone, { lang: 'fr', storage: { [SK]: fu.session }, fakeUser: fu, fakeCallbacks: fc });
        await c.page.goto(`${base}/admin/rappels`, { waitUntil: 'load' });
        return c;
      };
      const norm = (t) => t.replace(/[\s  ]+/g, ' ').trim();
      {
        const fc = { calls: [], patches: [], table: { rows: rowsOf() } };
        const c = await openAdmin(fc);
        await c.page.getByTestId('callbacks-screen').waitFor({ timeout: 25000 });
        await c.page.getByTestId('callback-row-c1').waitFor({ timeout: 15000 });
        check('onglets : « A rappeler (4) » et « Faits (1) »', /À rappeler \(4\)/.test(await c.page.getByTestId('callbacks-tab-new').innerText()) && /Faits \(1\)/.test(await c.page.getByTestId('callbacks-tab-done').innerText()));
        const order = await c.page.locator('[data-testid^="callback-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
        check('ordre : le jour deja passe (c2), puis aujourd\'hui (c4), puis le jour a venir (c1), puis la demande sans jour (c5)', order.join(',') === 'callback-row-c2,callback-row-c4,callback-row-c1,callback-row-c5', order);
        const d2 = norm(await c.page.getByTestId('callback-day-c2').innerText());
        const d4 = norm(await c.page.getByTestId('callback-day-c4').innerText());
        const d1 = norm(await c.page.getByTestId('callback-day-c1').innerText());
        check('jour demande : « en retard » (jour passe), « aujourd\'hui ! » (jour du rappel), jour a venir sans alerte', new RegExp('À rappeler : ' + esc(dayLabel(dLate)) + ' — en retard').test(d2) && new RegExp('À rappeler : ' + esc(dayLabel(dToday)) + ' — aujourd’hui !').test(d4) && new RegExp('À rappeler : ' + esc(dayLabel(dSoon)) + '$').test(d1) && !/retard|aujourd’hui/.test(d1), [d2, d4, d1]);
        check('ancienne demande sans jour : aucune ligne « A rappeler : »', (await c.page.getByTestId('callback-day-c5').count()) === 0);
        const r1 = norm(await c.page.getByTestId('callback-row-c1').innerText());
        check('demande 1 : prenom, numero (+235), origine « Panier en attente », appareil, article, il y a 10 min', /Awa/.test(r1) && /\+235 66 12 34 56/.test(r1) && /Panier en attente · Android/.test(r1) && /À propos de : Rolex \(\+1\)/.test(r1) && /il y a 10 min/.test(r1), r1);
        const r2 = norm(await c.page.getByTestId('callback-row-c2').innerText());
        check('demande 2 : « A dit je reflechis », pas de ligne « A propos de » quand il n\'y a pas d\'article, il y a 5 h', /A dit « je réfléchis »/.test(r2) && !/À propos de/.test(r2) && /il y a 5 h/.test(r2), r2);
        check('la demande deja faite n\'est pas dans l\'onglet « A rappeler »', (await c.page.getByTestId('callback-row-c3').count()) === 0);
        const [pop] = await Promise.all([c.ctx.waitForEvent('page', { timeout: 10000 }), c.page.getByTestId('callback-wa-c1').click()]);
        await pop.waitForLoadState('domcontentloaded').catch(() => {});
        const url = pop.url();
        check('« Ecrire sur WhatsApp » : ouvre WhatsApp avec le numero du client (+235) et un message poli deja ecrit', url.startsWith('https://wa.me/23566123456?text=') && /Bonjour Awa, ici l'équipe Albasse Shopping/.test(decodeURIComponent(url)), decodeURIComponent(url));
        await pop.close();
        await c.page.getByTestId('callback-done-c1').click();
        const t0 = Date.now();
        while ((await c.page.getByTestId('callback-row-c1').count()) > 0 && Date.now() - t0 < 10000) await sleep(200);
        check('« Fait » : la demande part dans « Faits » et la base recoit le changement (status done)', (fc.patches || []).length === 1 && fc.patches[0].id === 'c1' && fc.patches[0].body.status === 'done' && !!fc.patches[0].body.done_at, fc.patches);
        await c.page.getByTestId('callbacks-tab-done').click();
        await c.page.getByTestId('callback-row-c1').waitFor({ timeout: 10000 });
        check('onglet « Faits » : les 2 demandes traitees', (await c.page.getByTestId('callback-row-c3').count()) === 1 && (await c.page.getByTestId('callback-row-c1').count()) === 1);
        check('une demande deja traitee garde son jour mais sans alerte « en retard »', new RegExp('À rappeler : ' + esc(dayLabel(dDone)) + '$').test(norm(await c.page.getByTestId('callback-day-c3').innerText())) && !/retard|aujourd’hui/.test(norm(await c.page.getByTestId('callback-day-c3').innerText())));
        await c.page.screenshot({ path: path.join(OUT, 'Z5-rappels-admin.png') });
        // supprimer une demande (apres traitement) : confirmation en deux temps, « Non » ne supprime rien
        await c.page.getByTestId('callback-delete-c3').click();
        await c.page.getByTestId('callback-confirm-c3').waitFor({ timeout: 10000 });
        check('🗑 : l\'admin doit confirmer (« Supprimer cette demande pour toujours ? »), rien n\'est encore supprime', /Supprimer cette demande pour toujours/.test(await c.page.getByTestId('callback-confirm-c3').innerText()) && (fc.deletes || []).length === 0);
        await c.page.getByTestId('callback-delete-no-c3').click();
        await sleep(400);
        check('« Non » : la demande reste, aucune suppression envoyee', (await c.page.getByTestId('callback-confirm-c3').count()) === 0 && (await c.page.getByTestId('callback-row-c3').count()) === 1 && (fc.deletes || []).length === 0);
        await c.page.getByTestId('callback-delete-c3').click();
        await c.page.getByTestId('callback-delete-yes-c3').click();
        const t1 = Date.now();
        while ((await c.page.getByTestId('callback-row-c3').count()) > 0 && Date.now() - t1 < 10000) await sleep(200);
        check('« Oui, supprimer » : la demande disparait de la liste et la base recoit la suppression (c3)', (await c.page.getByTestId('callback-row-c3').count()) === 0 && (fc.deletes || []).join(',') === 'c3' && fc.table.rows.every((r) => r.id !== 'c3'), fc.deletes);
        check('onglet « Faits » : il reste 1 demande (celle de Awa)', /Faits \(1\)/.test(await c.page.getByTestId('callbacks-tab-done').innerText()) && (await c.page.getByTestId('callback-row-c1').count()) === 1);
        // la base refuse (client non administrateur / panne) : message, la demande reste
        fc.deleteFails = true;
        await c.page.getByTestId('callback-delete-c1').click();
        await c.page.getByTestId('callback-delete-yes-c1').click();
        await c.page.getByTestId('callbacks-delete-error').waitFor({ timeout: 10000 });
        check('suppression refusee par la base : message simple, la demande reste dans la liste', (await c.page.getByTestId('callback-row-c1').count()) === 1 && /n’a pas marché/.test(await c.page.getByTestId('callbacks-delete-error').innerText()));
        check('aucune erreur (page admin des rappels)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      {
        // script SQL pas applique : un message simple qui dit quoi faire
        const fc = { calls: [], table: { rows: [], error: { status: 404, body: { code: 'PGRST205', message: "Could not find the table 'public.assistant_callbacks' in the schema cache" } } } };
        const c = await openAdmin(fc);
        await c.page.getByTestId('callbacks-not-installed').waitFor({ timeout: 25000 });
        check('table absente : message clair avec le nom des fichiers a coller dans Supabase', /add-zara-sales-boost\.sql/.test(await c.page.getByTestId('callbacks-not-installed').innerText()) && /add-zara-callback-day\.sql/.test(await c.page.getByTestId('callbacks-not-installed').innerText()));
        await c.ctx.close();
      }
      {
        // vide, et client non administrateur
        const c = await openAdmin({ calls: [], table: { rows: [] } });
        await c.page.getByTestId('callbacks-empty').waitFor({ timeout: 25000 });
        check('aucune demande : « Aucune demande en attente pour le moment. »', /Aucune demande en attente/.test(await c.page.getByTestId('callbacks-empty').innerText()));
        await c.ctx.close();
        const d = await openAdmin({ calls: [], table: { rows: rowsOf() } }, false);
        await d.page.getByText(/Accès réservé aux administrateurs/).waitFor({ timeout: 25000 });
        check('client normal : « Acces reserve aux administrateurs », aucune demande visible', (await d.page.getByTestId('callback-row-c1').count()) === 0);
        await d.ctx.close();
      }
    }
  }

  // =============================================== H. LE BOUTON DE ZARA : AU MILIEU, VIBRATION ET LUMIERE ===============================================
  if (PARTS.includes('N')) {
    console.log('\n== N. bouton « Facebook » d\'une fiche produit : l\'application Facebook sur telephone, pas le navigateur');
    const prod = (await get('products?select=slug,name&is_active=eq.true&stock=gt.0&order=created_at.desc&limit=1'))[0];
    const sharer = (u) => 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u);
    const pageUrl = `https://www.albasseshopping.com/produit/${prod.slug}`;
    // les liens que la page fait « toucher » sont notes (et pas suivis) : on voit ce que le telephone recevrait
    const catchLinks = () => {
      window.__fbNav = [];
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && /^(intent|fb):|facebook\.com/.test(a.getAttribute('href') || '')) {
          window.__fbNav.push(a.getAttribute('href'));
          e.preventDefault();
        }
      }, true);
    };
    const openProduct = async (v) => {
      await v.page.goto(`http://localhost:${port}/produit/${prod.slug}`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByText('📘 Facebook').first().waitFor({ timeout: 15000 });
    };
    const shareOf = async (v) => (await v.page.evaluate(() => window.__fbNav || []));
    // Android (Chrome)
    {
      const v = await newVisitor(phone, { initScripts: [catchLinks] });
      await openProduct(v);
      await v.page.getByText('📘 Facebook').first().click();
      await sleep(600);
      const nav = await shareOf(v);
      const m = /^intent:\/\/facewebmodal\/f\?href=([^#]+)#Intent;scheme=fb;package=com\.facebook\.katana;S\.browser_fallback_url=([^;]+);end$/.exec(nav[0] || '');
      check('Android : le bouton ouvre l\'application Facebook (et la page de partage seulement si l\'application manque)', nav.length === 1 && !!m && decodeURIComponent(m[1]) === sharer(pageUrl) && decodeURIComponent(m[2]) === sharer(pageUrl), nav);
      check('Android : la fiche produit reste affichee (pas d\'onglet du navigateur ouvert)', v.ctx.pages().length === 1 && v.page.url().includes(`/produit/${prod.slug}`), v.ctx.pages().map((p) => p.url()));
      check('aucune erreur (Facebook, Android)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Android, dans l'application Albasse : fb:// d'abord ; sans reponse de Facebook, la page de partage 1,5 s plus tard
    {
      const v = await newVisitor(phone, { storage: { albasse_app_shell: '1' }, initScripts: [catchLinks] });
      await openProduct(v);
      await v.page.getByText('📘 Facebook').first().click();
      await sleep(400);
      const first = await shareOf(v);
      check('application Albasse : l\'application Facebook est appelee tout de suite (fb://facewebmodal)', first.length === 1 && first[0] === 'fb://facewebmodal/f?href=' + encodeURIComponent(sharer(pageUrl)), first);
      await sleep(1700);
      const after = await shareOf(v);
      check('application Albasse : Facebook ne s\'est pas ouvert -> la page de partage ensuite (une seule fois)', after.length === 2 && after[1] === sharer(pageUrl), after);
      // Facebook s'ouvre (la page perd la main) : pas de page de partage en plus
      await v.page.getByText('📘 Facebook').first().click();
      await sleep(300);
      await v.page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await sleep(1800);
      const opened = await shareOf(v);
      check('application Albasse : si Facebook s\'ouvre, rien d\'autre ne s\'ouvre', opened.length === 3 && opened[2].startsWith('fb://'), opened);
      check('aucune erreur (Facebook, application Albasse)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // iPhone : le lien facebook.com (l'iPhone l'ouvre dans l'application Facebook quand elle est installee)
    {
      const v = await newVisitor({ ...devices['iPhone 13'], viewport: { width: 390, height: 800 } }, { initScripts: [catchLinks] });
      await openProduct(v);
      await v.page.getByText('📘 Facebook').first().click();
      await sleep(600);
      const nav = await shareOf(v);
      check('iPhone : le lien Facebook est touche dans la page (lien universel vers l\'application Facebook)', nav.length === 1 && nav[0] === sharer(pageUrl), nav);
      check('aucune erreur (Facebook, iPhone)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // ordinateur : un nouvel onglet avec la page de partage (comme avant)
    {
      const v = await newVisitor({ viewport: { width: 1280, height: 800 } }, { initScripts: [catchLinks] });
      await openProduct(v);
      const asked = [];
      v.ctx.on('request', (r) => { if (/facebook\.com/.test(r.url())) asked.push(r.url()); }); // le test ne laisse rien sortir : on note l'adresse demandee
      const [popup] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), v.page.getByText('📘 Facebook').first().click()]);
      await sleep(800);
      check('ordinateur : la page de partage Facebook s\'ouvre dans un nouvel onglet', popup !== v.page && asked.includes(sharer(pageUrl)) && v.page.url().includes(`/produit/${prod.slug}`), { asked, page: v.page.url() });
      check('aucune erreur (Facebook, ordinateur)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('J')) {
    console.log('\n== J. anciens boutons de Zara : ceux qui menent quelque part restent touchables, les reponses passees partent');
    const oldLabels = async (p) => (await panelOf(p).getByTestId('assistant-chip-old').allInnerTexts()).map((t) => t.trim());
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('au debut : aucun ancien bouton (seulement ceux du dernier message)', (await oldLabels(v.page)).length === 0, await oldLabels(v.page));
      const menu = await chipLabels(v.page);
      await tap(v.page, '🔥 Promotions', /promotion|promo|offre/i);
      await sleep(1500);
      const old1 = await oldLabels(v.page);
      const kept = menu.filter((l) => !/العربية/.test(l));
      check('apres un clic : les boutons du menu restent (promotions, nouveautes, conseil, categories, compte, WhatsApp)', kept.every((l) => old1.includes(l)) && ['🔥 Promotions', '🆕 Nouveautés', '🎯 Conseil', '🛍️ Catégories', '👤 Créer mon compte', '💬 WhatsApp'].every((l) => old1.includes(l)), { menu, old1 });
      check('le bouton de langue d\'un ancien message part (le bouton en haut reste)', old1.every((l) => !/العربية/.test(l)), old1);
      check('« Mon budget » d\'une ancienne liste part (il parlerait d\'autres articles)', old1.every((l) => l !== '💰 Mon budget'), old1);
      const n = await panelOf(v.page).getByText(/Voici nos dernières nouveautés/).count();
      await panelOf(v.page).getByTestId('assistant-chip-old').filter({ hasText: '🆕 Nouveautés' }).first().click();
      await waitText(v.page, /Voici nos dernières nouveautés/);
      check('un ancien bouton se touche et Zara repond (Nouveautes)', (await panelOf(v.page).getByText(/Voici nos dernières nouveautés/).count()) === n + 1 && (await cardsOf(v.page).count()) > 0);
      check('les anciens « Mon budget » ne reviennent pas', (await oldLabels(v.page)).every((l) => l !== '💰 Mon budget'), await oldLabels(v.page));
      // une question (quel article ?) : une fois repondue, ses boutons partent
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await sleep(800);
      const typeChips = (await chipLabels(v.page)).filter((l) => !['🏠 Menu', '💬 WhatsApp', '🎁 Idée cadeau'].includes(l));
      check('la question « Que cherchez-vous ? » a ses boutons (articles)', typeChips.length >= 2, typeChips);
      await chip(v.page, typeChips[0]).first().click();
      await waitText(v.page, /C’est pour qui|pour qui|budget/i);
      await sleep(1500);
      const old2 = await oldLabels(v.page);
      check('apres la reponse : les boutons de la question passee ne restent pas', typeChips.every((l) => !old2.includes(l)), { typeChips, old2 });
      check('aucune erreur (anciens boutons)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('H')) {
    console.log('\n== H. bouton de Zara : au milieu de l\'ecran (un peu plus haut qu\'avant), vibration et lumiere, bulle au-dessus, moins d\'animations respecte');
    const base = `http://localhost:${port}`;
    const open = async (v) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await v.page.getByTestId('assistant-fab').waitFor({ timeout: 25000 });
      // la fenetre « offre speciale » (s'il y a une promotion en cours) s'ouvre apres ~2 s et couvrirait l'ecran : on la ferme (Echap)
      await sleep(3500);
      await v.page.keyboard.press('Escape');
      await sleep(500);
    };
    const desk = { viewport: { width: 1280, height: 800 } }; // ordinateur : souris reelle, sans tactile
    const geo = async (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, bottom: r.y + r.height }; });
    // --- H1. place, vibration, lumiere
    {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await open(v);
      const fab = v.page.getByTestId('assistant-fab');
      const g = await geo(fab);
      const vp = v.page.viewportSize();
      check('le bouton est au MILIEU de l\'ecran (centre a 2 px pres), de la taille d\'avant (62 px)', Math.abs(g.cx - vp.width / 2) <= 2 && Math.round(g.w) === 62, { g, vp });
      check('le bouton est DANS la barre du bas, sur la meme ligne que les onglets (8 px du bas de l\'ecran, sans depasser au-dessus de la barre de 78 px)', Math.abs(vp.height - g.bottom - 8) <= 2 && g.y >= vp.height - 78 && g.bottom <= vp.height, { bottom: vp.height - g.bottom, g });
      // meme ligne : le centre du bouton est a la hauteur du centre des onglets (icones + noms), a quelques pixels pres
      const rowC = await v.page.locator('[role="tab"]').evaluateAll((els) => { const r = els.map((e) => e.getBoundingClientRect()); return (Math.min(...r.map((x) => x.y)) + Math.max(...r.map((x) => x.bottom))) / 2; });
      check('meme ligne que les autres : le centre du bouton est a la hauteur du centre des onglets (a 8 px pres)', Math.abs(g.y + g.h / 2 - rowC) <= 8, { fabCenter: g.y + g.h / 2, rowC });
      // un espace est ouvert entre « Recherche » et « Panier » : le bouton y tient sans toucher aucun onglet
      const tabs = await v.page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, label: (e.innerText || '').replace(/\s+/g, ' ').trim() }; }));
      const sTab = tabs.find((t) => /Recherche/.test(t.label));
      const cTab = tabs.find((t) => /Panier/.test(t.label));
      check('barre du bas : un espace est ouvert entre « Recherche » et « Panier » (au moins 80 px) et le bouton de Zara y tient, sans toucher les onglets', tabs.length === 4 && !!sTab && !!cTab && cTab.x - sTab.right >= 80 && g.x >= sTab.right && g.x + g.w <= cTab.x, { tabs, g });
      const anim = await fab.evaluate((el) => {
        const list = el.getAnimations({ subtree: true });
        const kf = (a) => a.effect.getKeyframes().map((k) => Object.keys(k).join(','));
        return { n: list.length, shake: list.filter((a) => kf(a).some((k) => k.includes('transform')) && a.effect.getTiming().duration === 4200).length, glow: list.filter((a) => kf(a).some((k) => k.includes('boxShadow'))).length, rings: list.filter((a) => a.effect.getTiming().duration === 2400).length };
      });
      check('animations du navigateur actives : 1 vibration, 1 lueur qui respire, 2 halos', anim.shake === 1 && anim.glow === 1 && anim.rings === 2, anim);
      // la photo vibre vraiment (une rotation non nulle dans les 5 secondes qui suivent), et le bouton qui recoit le toucher, lui, ne bouge jamais
      const watched = await fab.evaluate(async (el) => {
        const shaker = el.getAnimations({ subtree: true }).find((a) => a.effect.getTiming().duration === 4200).effect.target;
        const seen = new Set();
        let maxAbs = 0;
        const slot0 = el.getBoundingClientRect();
        let slotMoved = false;
        const t0 = performance.now();
        while (performance.now() - t0 < 5200) {
          const m = getComputedStyle(shaker).transform;
          if (m && m !== 'none') {
            const [a, b] = m.replace(/matrix\(|\)/g, '').split(',').map(Number);
            const deg = (Math.atan2(b, a) * 180) / Math.PI;
            maxAbs = Math.max(maxAbs, Math.abs(deg));
            seen.add(Math.round(deg));
          }
          const r = el.getBoundingClientRect();
          if (Math.abs(r.x - slot0.x) > 0.5 || Math.abs(r.y - slot0.y) > 0.5 || Math.abs(r.width - slot0.width) > 0.5) slotMoved = true;
          await new Promise((r2) => setTimeout(r2, 16));
        }
        return { maxAbs, angles: seen.size, slotMoved };
      });
      check('vibration : la photo tremble (rotation jusqu\'a ~14 degres) dans le cycle de 4,2 s', watched.maxAbs >= 8 && watched.maxAbs <= 16 && watched.angles >= 4, watched);
      check('la zone du bouton qui recoit le toucher ne bouge jamais (le client peut toujours la toucher)', watched.slotMoved === false, watched);
      await v.page.screenshot({ path: path.join(OUT, 'H1-bouton-milieu.png') });
      await fab.click();
      await panelOf(v.page).waitFor({ timeout: 15000 });
      const left = await v.page.evaluate(() => document.getAnimations().filter((a) => a.effect && [4200, 2400].includes(a.effect.getTiming().duration)).length);
      check('le chat s\'ouvre au toucher ; le bouton disparait et ses animations sont arretees (aucune animation qui tourne pour rien)', (await v.page.getByTestId('assistant-fab').count()) === 0 && left === 0, left);
      check('aucune erreur (bouton)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- H2. la bulle de bienvenue : au-dessus du bouton, au milieu ; toucher la bulle ouvre le chat
    {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await open(v);
      const bubble = v.page.getByRole('button', { name: 'Ouvrir la discussion avec Zara Kings' });
      await bubble.waitFor({ timeout: 15000 });
      const b = await geo(bubble);
      const g = await geo(v.page.getByTestId('assistant-fab'));
      const vp = v.page.viewportSize();
      check('la bulle est au-dessus du bouton, bien centree, et tient dans l\'ecran', Math.abs(b.cx - g.cx) <= 2 && b.bottom <= g.y - 6 && b.x >= 0 && b.x + b.w <= vp.width, { b, g });
      await v.page.screenshot({ path: path.join(OUT, 'H2-bulle-au-dessus.png') });
      await bubble.click();
      await panelOf(v.page).waitFor({ timeout: 15000 });
      check('toucher la bulle ouvre le chat', true);
      await v.ctx.close();
    }

    // --- H3. sur la fiche produit, le bouton monte encore au-dessus de la barre « Commander »
    if (realProduct) {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await v.page.getByTestId('assistant-fab').waitFor({ timeout: 25000 });
      const slug = realProduct.slug;
      await v.page.goto(`${base}/produit/${slug}`, { waitUntil: 'load' }).catch(() => {});
      await sleep(2500);
      const fab = v.page.getByTestId('assistant-fab');
      if (await fab.count()) {
        const g = await geo(fab);
        const vp = v.page.viewportSize();
        check('fiche produit (pas de barre du bas) : le bouton est dans le coin en bas a droite, 62 px plus haut (au-dessus de la barre Commander / Ajouter au panier)', Math.abs(vp.height - g.bottom - (82 + 62)) <= 2 && Math.abs(vp.width - 14 - (g.x + g.w)) <= 2, { bottom: vp.height - g.bottom, g });
      } else {
        check('fiche produit : la page du produit n\'a pas pu etre ouverte par son adresse (test ignore)', true);
      }
      await v.ctx.close();
    }

    // --- H4. « moins d'animations » : le bouton reste immobile, avec une lueur fixe
    {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await v.page.emulateMedia({ reducedMotion: 'reduce' });
      await open(v);
      const fab = v.page.getByTestId('assistant-fab');
      const n = await fab.evaluate((el) => el.getAnimations({ subtree: true }).length);
      check('moins d\'animations demande : aucune vibration ni halo (le bouton reste la, immobile, avec sa lueur fixe)', n === 0 && (await fab.count()) === 1, n);
      await v.ctx.close();
    }

    // --- H5. appuyer et glisser (souris) : le bouton suit, reste dans l'ecran, retient sa place, et un glissement n'ouvre jamais Zara
    {
      const v = await newVisitor(desk, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await open(v);
      const fab = v.page.getByTestId('assistant-fab');
      const vp = v.page.viewportSize();
      const g0 = await geo(fab);
      const drag = async (dx, dy) => {
        const g = await geo(fab);
        const x = g.cx;
        const y = g.y + g.h / 2;
        await v.page.mouse.move(x, y);
        await v.page.mouse.down();
        await v.page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 });
        await v.page.mouse.move(x + dx, y + dy, { steps: 6 });
        await v.page.mouse.up();
        await sleep(600);
      };
      await drag(-100, -200);
      const g1 = await geo(fab);
      check('glisser : le bouton suit le doigt (100 px a gauche, 200 px plus haut, a 2 px pres)', Math.abs(g1.cx - (g0.cx - 100)) <= 2 && Math.abs(g1.y - (g0.y - 200)) <= 2, { g0, g1 });
      check('un glissement n\'ouvre PAS Zara (meme quand on relache sur le bouton)', (await panelOf(v.page).count()) === 0 && (await v.page.getByTestId('assistant-fab').count()) === 1);
      const stored = await v.page.evaluate(() => window.localStorage.getItem('albasse_zara_fab_pos'));
      check('la place est retenue sur l\'appareil (100 px a gauche du milieu, et sa distance du bas)', stored === JSON.stringify({ dx: -100, b: Math.round(vp.height - g1.bottom) }), stored);
      await v.page.reload({ waitUntil: 'load' });
      await v.page.getByTestId('assistant-fab').waitFor({ timeout: 25000 });
      await sleep(3500);
      await v.page.keyboard.press('Escape'); // ferme la fenetre « offre speciale » si elle s'est ouverte
      await sleep(500);
      const g2 = await geo(fab);
      check('apres rechargement de la page : le bouton est a la meme place', Math.abs(g2.cx - g1.cx) <= 2 && Math.abs(g2.y - g1.y) <= 2, { g1, g2 });
      // jamais hors de l'ecran : en haut a gauche, puis en bas a droite
      await drag(5 - g2.cx, 5 - (g2.y + g2.h / 2));
      const g3 = await geo(fab);
      check('tire trop loin en haut a gauche : le bouton reste dans l\'ecran (marge de 8 px a gauche, 56 px en haut)', Math.abs(g3.x - 8) <= 1 && Math.abs(g3.y - 56) <= 1, g3);
      await drag(vp.width - 12 - g3.cx, vp.height - 150 - (g3.y + g3.h / 2));
      const g4 = await geo(fab);
      check('colle a droite, au-dessus de la barre du bas : le bouton reste dans l\'ecran (marge de 8 px a droite)', Math.abs(g4.x + g4.w - (vp.width - 8)) <= 1 && Math.abs(vp.height - g4.bottom - 119) <= 2, g4);
      // lache dans la barre du bas : il revient dans l'espace du milieu, et la place retenue est effacee
      await drag(vp.width / 2 - g4.cx, vp.height - 30 - (g4.y + g4.h / 2));
      const g5 = await geo(fab);
      const stored5 = await v.page.evaluate(() => window.localStorage.getItem('albasse_zara_fab_pos'));
      check('lache dans la barre du bas (sur les onglets) : le bouton revient tout seul dans l\'espace du milieu, et la place retenue est effacee', Math.abs(g5.cx - vp.width / 2) <= 2 && Math.abs(vp.height - g5.bottom - 8) <= 2 && stored5 === null, { g5, stored5 });
      await drag(-150, -300);
      const g6 = await geo(fab);
      check('on peut le redeplacer ensuite (150 px a gauche, 300 px plus haut)', Math.abs(g6.cx - (g5.cx - 150)) <= 2 && Math.abs(g6.y - (g5.y - 300)) <= 2, { g5, g6 });
      await v.page.screenshot({ path: path.join(OUT, 'H5-bouton-deplace.png') });
      // un simple toucher (sans glisser) ouvre toujours Zara, a sa nouvelle place
      await sleep(500);
      await fab.click();
      await panelOf(v.page).waitFor({ timeout: 15000 });
      check('un simple toucher a la nouvelle place ouvre Zara', true);
      check('aucune erreur (glissement)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- H6. au doigt (vrais evenements tactiles) : la page ne defile pas, le bouton suit, un toucher simple ouvre Zara
    {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await open(v);
      const fab = v.page.getByTestId('assistant-fab');
      const g0 = await geo(fab);
      const cdp = await v.ctx.newCDPSession(v.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      const x = g0.cx;
      const y = g0.y + g0.h / 2;
      const scrollBefore = await v.page.evaluate(() => [window.scrollY, ...[...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop)]);
      await touch('touchStart', x, y);
      for (let i = 1; i <= 12; i++) {
        await touch('touchMove', x + (i * 60) / 12, y - (i * 150) / 12);
        await sleep(16);
      }
      await touch('touchEnd', 0, 0);
      await sleep(600);
      const g1 = await geo(fab);
      const scrollAfter = await v.page.evaluate(() => [window.scrollY, ...[...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop)]);
      check('au doigt : le bouton suit (60 px a droite, 150 px plus haut, a 3 px pres)', Math.abs(g1.cx - (g0.cx + 60)) <= 3 && Math.abs(g1.y - (g0.y - 150)) <= 3, { g0, g1 });
      check('au doigt : la page ne defile pas pendant le glissement', JSON.stringify(scrollBefore) === JSON.stringify(scrollAfter), { scrollBefore, scrollAfter });
      check('au doigt : le glissement n\'ouvre pas Zara', (await panelOf(v.page).count()) === 0);
      await sleep(500);
      const x1 = g1.cx;
      const y1 = g1.y + g1.h / 2;
      await touch('touchStart', x1, y1);
      await sleep(60);
      await touch('touchEnd', 0, 0);
      await panelOf(v.page).waitFor({ timeout: 15000 });
      check('au doigt : un simple toucher ouvre Zara', true);
      check('aucune erreur (glissement au doigt)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- H7. la bulle de bienvenue suit le bouton : sur le cote, ou en dessous quand le bouton est tout en haut
    {
      const v = await newVisitor(desk, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await open(v);
      const fab = v.page.getByTestId('assistant-fab');
      const vp = v.page.viewportSize();
      const g = await geo(fab);
      await v.page.mouse.move(g.cx, g.y + g.h / 2);
      await v.page.mouse.down();
      await v.page.mouse.move(g.cx - 60, g.y - 200, { steps: 8 });
      await v.page.mouse.move(12, 70, { steps: 8 });
      await v.page.mouse.up();
      await sleep(500);
      const bubble = v.page.getByRole('button', { name: 'Ouvrir la discussion avec Zara Kings' });
      await bubble.waitFor({ timeout: 15000 });
      const b = await geo(bubble);
      const g2 = await geo(fab);
      check('bouton tout en haut a gauche : la bulle passe EN DESSOUS du bouton et reste dans l\'ecran', b.y >= g2.bottom + 6 && b.x >= 0 && b.x + b.w <= vp.width, { b, g2 });
      await v.page.screenshot({ path: path.join(OUT, 'H7-bulle-sous-le-bouton.png') });
      await v.ctx.close();
      const w = await newVisitor(desk, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await open(w);
      const gw = await geo(w.page.getByTestId('assistant-fab'));
      await w.page.mouse.move(gw.cx, gw.y + gw.h / 2);
      await w.page.mouse.down();
      await w.page.mouse.move(vp.width - 12, gw.y - 200, { steps: 10 });
      await w.page.mouse.up();
      await sleep(500);
      const bubble2 = w.page.getByRole('button', { name: 'Ouvrir la discussion avec Zara Kings' });
      await bubble2.waitFor({ timeout: 15000 });
      const b2 = await geo(bubble2);
      const g3 = await geo(w.page.getByTestId('assistant-fab'));
      check('bouton colle a droite : la bulle reste au-dessus, entiere dans l\'ecran, et toujours au-dessus du bouton', b2.bottom <= g3.y - 6 && b2.x >= 0 && b2.x + b2.w <= vp.width, { b2, g3 });
      await w.ctx.close();
    }
  }

  // =============================================== G. PSYCHOLOGIE COMMERCIALE ET VENTE EMOTIONNELLE ===============================================
  if (PARTS.includes('G')) {
    console.log('\n== G. psychologie commerciale : metier (ton seulement), style dit par le client, trois gammes de prix, comparer, hesitation, fidelite, regles ethiques');
    const base = `http://localhost:${port}`;
    const uid = '11111111-1111-4111-8111-111111111111';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const memberOf = (fullName, extra = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'test@example.com', full_name: fullName, phone: '66123456', banned: false, role: 'customer', is_admin: false, loyalty_points: 0, ...extra } };
    };
    const norm = (t) => t.replace(/[\s  ]+/g, ' ').trim();
    // les mots que Zara n'ecrit JAMAIS dans ses messages de vente (fausse rarete, exclusivite, urgence, pression)
    const FORBID = /exclusi|élite|réservé aux|dernière chance|dépêchez|ne ratez|offre limitée|seulement pour vous|pièce unique|introuvable/i;
    const visitor = (extra = {}) => newVisitor(phone, { lang: extra.lang || 'fr', storage: { albasse_zara_name: 'Ali' }, fakeUser: extra.fakeUser || null });
    const openZara = async (v) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?|أنشئ حسابك|حسابك/, 25000);
    };
    const allText = async (v) => norm(await panelOf(v.page).innerText());
    // le conseil en trois questions (pour qui, quel article, budget) -> les articles ; renvoie le nombre de fiches avant
    const afterStyleFlow = async (v, kind) => {
      const before = await cardsOf(v.page).count();
      // le style est retenu, puis Zara demande l'article (une question a la fois) : « Que cherchez-vous ? », « C'est pour qui ? », le budget
      await waitText(v.page, /Que cherchez-vous \?/, 20000);
      await tap(v.page, 'Chaussures', /C’est pour qui \?/, 20000);
      await tap(v.page, 'Pour un homme', /Quel est votre budget/, 20000);
      await tap(v.page, 'Peu importe', /Voici mes meilleurs choix/, 25000);
      return before;
    };

    // --- G1. le metier : Zara valorise, ne suppose AUCUN budget, demande ce qui fait plaisir ; l'ordre des boutons seul change
    {
      const v = await visitor();
      await openZara(v);
      const before = await cardsOf(v.page).count();
      await ask(v.page, 'je suis ingénieur', /Merci de me parler de vous/, 20000);
      const msg = norm(await panelOf(v.page).getByText(/Merci de me parler de vous/).last().innerText());
      const chips = await chipLabels(v.page);
      check('« je suis ingenieur » : Zara remercie et demande ce qui fait plaisir (elegant, tendance, sportif, petit prix) ; metier « pro » : elegant en premier', /Enchanté/.test(msg) && /style élégant/.test(msg) && chips.join('|') === '✨ Élégant / premium|🔥 Moderne et tendance|👟 Sportif|💰 Petit prix|🏠 Menu', [msg, chips]);
      check('REGLE : le metier ne dit rien du budget : Zara ne parle ni de budget, ni de salaire, ni de moyens, et ne montre aucun article avant que le client dise ce qu\'il aime', !/budget|salaire|moyens|riche|argent/i.test(msg) && (await cardsOf(v.page).count()) === before, msg);
      await v.page.screenshot({ path: path.join(OUT, 'G1-metier-style.png') });
      check('aucune erreur (metier)', v.errs.length === 0, v.errs);
      await v.ctx.close();
      const w = await visitor();
      await openZara(w);
      await ask(w.page, 'moi je suis étudiante', /Merci de me parler de vous/, 20000);
      const chips2 = await chipLabels(w.page);
      check('« je suis etudiante » : memes 4 styles, seulement dans un autre ordre (tendance et petit prix d\'abord) : le metier change l\'ordre, pas l\'offre', chips2.join('|') === '🔥 Moderne et tendance|💰 Petit prix|👟 Sportif|✨ Élégant / premium|🏠 Menu', chips2);
      await w.ctx.close();
    }

    // --- G2. style « elegant » : les choix du plus haut de gamme au plus accessible, phrase dans son style, aucune fausse rarete
    {
      const v = await visitor();
      await openZara(v);
      await ask(v.page, 'je suis banquier', /Merci de me parler de vous/, 20000);
      await tap(v.page, 'Élégant', /Très bon choix ✨ Je vous montre des pièces élégantes/, 20000);
      const before = await afterStyleFlow(v);
      const prices = await pricesSince(v.page, before);
      check('style « elegant » : les articles vont du plus haut de gamme (prix) au plus accessible (prix decroissants), tous en stock', prices.length >= 2 && prices.every((p, i) => i === 0 || prices[i - 1] >= p), prices);
      const last = norm(await panelOf(v.page).getByText(/Voici mes meilleurs choix/).last().innerText());
      const tail = norm(await panelOf(v.page).locator('[data-testid="assistant-message"], div').filter({ hasText: /Ce modèle pourrait vraiment compléter votre style|tenues soignées|Dites-moi laquelle vous parle le plus/ }).last().innerText().catch(() => ''));
      check('une phrase valorisante dans le style du client (elegant), basee sur les photos et les tailles, jamais sur une qualite inventee', /(Ce modèle pourrait vraiment compléter votre style|tenues soignées|Dites-moi laquelle vous parle le plus)/.test(await allText(v)), tail);
      const text = await allText(v);
      const mine = text.slice(text.indexOf('Merci de me parler de vous'));
      check('REGLE ETHIQUE : aucune fausse rarete, exclusivite, urgence ni pression dans toute la conversation de vente', !FORBID.test(mine), mine.match(FORBID));
      check('un client qui a deja dit son style n\'a plus le bouton « Mon style » ni la question de style', (await chipLabels(v.page)).every((c) => !/Mon style/.test(c)));
      await v.page.screenshot({ path: path.join(OUT, 'G2-elegant.png') });
      check('aucune erreur (style elegant)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- G3. style « petit prix » : du plus accessible ; l'ecrit libre « je cherche un petit prix » marche aussi
    {
      const v = await visitor();
      await openZara(v);
      await ask(v.page, 'je cherche un petit prix', /Pas de souci 😊 On peut trouver quelque chose de stylé à un prix accessible/, 20000);
      const before = await afterStyleFlow(v);
      const prices = await pricesSince(v.page, before);
      check('style « petit prix » : les articles vont du plus accessible au plus cher (prix croissants), toujours les vrais prix du site', prices.length >= 2 && prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices);
      check('phrase respectueuse pour ce client (« un look stylé sans trop dépenser », « respecte votre budget »), sans jamais le rabaisser', /(L’objectif : trouver un article qui vous plaît|On peut avoir un look stylé sans trop dépenser|Les prix affichés sont ceux du site)/.test(await allText(v)) && !/pas les moyens|bas de gamme|pauvre|radin/i.test(await allText(v)));
      await v.ctx.close();
      const w = await visitor();
      await openZara(w);
      await ask(w.page, 'je veux quelque chose de moderne', /Parfait 🔥 Du moderne, facile à associer avec d’autres pièces/, 20000);
      await waitText(w.page, /Que cherchez-vous \?/, 20000);
      check('ecrit libre « je veux quelque chose de moderne » : style tendance retenu, puis Zara demande l\'article (une question a la fois)', (await panelOf(w.page).getByText(/Que cherchez-vous \?/).count()) >= 1);
      await w.ctx.close();
    }

    // --- G4. REGLE : un client dont le compte indique un metier recoit les MEMES choix qu'un autre (rien n'est suppose) ; un bouton « Mon style » lui laisse choisir
    {
      const fu = memberOf('Ahmed Hassan', { profession: 'Ingénieur' });
      const m = await newVisitor(phone, { lang: 'fr', storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': fu.session }, fakeUser: fu });
      await m.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await m.page.getByTestId('assistant-fab').click();
      await waitText(m.page, /Salut Ahmed/, 30000);
      await waitText(m.page, /À savoir avant de commander/, 20000);
      const beforeM = await cardsOf(m.page).count();
      await ask(m.page, 'chaussures', /C’est pour qui \?/, 20000);
      await tap(m.page, 'Pour un homme', /Quel est votre budget/, 20000);
      await tap(m.page, 'Peu importe', /Voici mes meilleurs choix/, 25000);
      const namesM = (await Promise.all((await newCards(m.page, beforeM)).map((c) => c.getAttribute('aria-label')))).join('|');
      const labelsM = await chipLabels(m.page);
      await m.ctx.close();
      const g = await visitor();
      await openZara(g);
      const beforeG = await cardsOf(g.page).count();
      await ask(g.page, 'chaussures', /C’est pour qui \?/, 20000);
      await tap(g.page, 'Pour un homme', /Quel est votre budget/, 20000);
      await tap(g.page, 'Peu importe', /Voici mes meilleurs choix/, 25000);
      const namesG = (await Promise.all((await newCards(g.page, beforeG)).map((c) => c.getAttribute('aria-label')))).join('|');
      const labelsG = await chipLabels(g.page);
      check('REGLE : « ingenieur » dans le compte ne change PAS les articles montres : exactement les memes que pour un visiteur sans metier (aucun budget suppose)', namesM.length > 0 && namesM === namesG, [namesM, namesG]);
      check('le client dont le compte indique un metier a le bouton « Mon style » pour dire ce qu\'il aime ; le visiteur sans metier ne l\'a pas', labelsM.some((l) => /Mon style/.test(l)) && !labelsG.some((l) => /Mon style/.test(l)), [labelsM, labelsG]);
      await g.ctx.close();
    }

    // --- G5. trois gammes de prix : vrais prix du catalogue, trois articles differents
    {
      const v = await visitor();
      await openZara(v);
      let before = await cardsOf(v.page).count();
      await ask(v.page, 'chaussures', /C’est pour qui \?/, 20000);
      await tap(v.page, 'Pour un homme', /Quel est votre budget/, 20000);
      await tap(v.page, 'Peu importe', /Voici mes meilleurs choix/, 25000);
      await chip(v.page, '3 gammes de prix').first().waitFor({ timeout: 20000 }).catch(() => {});
      const labels = await chipLabels(v.page);
      check('apres les articles, sans budget ni style : le bouton « 3 gammes de prix » est propose (les prix de la selection sont vraiment differents)', labels.includes('🎯 3 gammes de prix'), labels);
      before = await cardsOf(v.page).count();
      await tap(v.page, '3 gammes de prix', /J’ai trois idées pour vous/, 25000);
      const msg = norm(await panelOf(v.page).getByText(/J’ai trois idées pour vous/).last().innerText());
      const cards = await newCards(v.page, before);
      const prices = await Promise.all(cards.map(cardPrice));
      const money = (re) => { const m = msg.match(re); return m ? num(m[1]) : null; };
      const dealP = money(/Bon plan : .+? — ([\d\s  ]+) FCFA/);
      const premP = money(/Style premium : .+? — ([\d\s  ]+) FCFA/);
      const favP = money(/Coup de cœur : .+? — ([\d\s  ]+) FCFA/);
      check('3 gammes : un bon plan, un style premium (et un coup de coeur) ; 2 ou 3 fiches avec photo et prix', /Bon plan/.test(msg) && /Style premium/.test(msg) && cards.length >= 2 && cards.length <= 3, [msg, prices]);
      check('3 gammes : les prix ecrits sont ceux des fiches (bon plan = le moins cher, premium = le plus cher), jamais inventes', dealP === Math.min(...prices) && premP === Math.max(...prices) && (favP === null || prices.includes(favP)) && dealP < premP, { dealP, premP, favP, prices });
      check('3 gammes : « premium » est decrit comme le plus haut de gamme de la selection (par le prix), sans promesse de qualite ni d\'exclusivite', /le plus haut de gamme de cette sélection/.test(msg) && !FORBID.test(msg) && !/finition|qualité supérieure/i.test(msg), msg);
      const after = await chipLabels(v.page);
      check('apres les 3 gammes : budget, comparer, promotions, menu, WhatsApp', after.includes('💰 Mon budget') && after.includes('⚖️ Comparer') && after.includes('🏠 Menu'), after);
      await v.page.screenshot({ path: path.join(OUT, 'G5-trois-gammes.png') });

      // --- G6. comparer deux articles : prix exacts, ecart exact, choix de couleurs / tailles ; « Je prends » ajoute au panier
      before = await cardsOf(v.page).count();
      await tap(v.page, 'Comparer', /Comparons-les ensemble/, 25000);
      const cmp = norm(await panelOf(v.page).getByText(/Comparons-les ensemble/).last().innerText());
      const cc = await newCards(v.page, before);
      const cp = await Promise.all(cc.map(cardPrice));
      const lines = [...cmp.matchAll(/• .+? : ([\d\s  ]+) FCFA/g)].map((x) => num(x[1]));
      check('comparer : deux articles, leurs prix exacts (ceux des fiches), la ligne « le plus accessible » avec l\'ecart exact', cc.length === 2 && lines.length === 2 && lines.every((p, i) => p === cp[i]) && (cp[0] === cp[1] ? /même prix/.test(cmp) : new RegExp(`Le plus accessible : .+? \\(${Math.abs(cp[0] - cp[1]).toLocaleString('fr-FR').replace(/\s/g, '\\s')} FCFA de moins\\)`).test(cmp.replace(/[  ]/g, ' ').replace(/(\d) (\d)/g, '$1 $2'))), [cmp, cp, lines]);
      check('comparer : aucun mot sur la qualite, la marque ou l\'exclusivite (seulement prix, couleurs, tailles)', !FORBID.test(cmp) && !/meilleure qualité|de luxe|garanti/i.test(cmp), cmp);
      const take = (await chipLabels(v.page)).filter((c) => /^✅ Je prends/.test(c));
      check('comparer : un bouton « Je prends » pour chaque article', take.length === 2, take);
      await chip(v.page, 'Je prends').first().click();
      // l'article demande une couleur et/ou une taille : on choisit la premiere option proposee
      for (let i = 0; i < 6; i++) {
        if (await panelOf(v.page).getByText(/ajouté au panier\./).count()) break;
        await sleep(1500);
        if ((await panelOf(v.page).getByText(/Quelle (taille|couleur) pour/).count()) > 0 && (await panelOf(v.page).getByText(/ajouté au panier\./).count()) === 0) {
          const q = await panelOf(v.page).getByText(/Quelle (taille|couleur) pour/).count();
          const before = q;
          await panelOf(v.page).getByTestId('assistant-chip').first().click();
          const t0 = Date.now();
          while ((await panelOf(v.page).getByText(/Quelle (taille|couleur) pour|ajouté au panier\./).count()) <= before && Date.now() - t0 < 8000) await sleep(300);
        }
      }
      await waitText(v.page, /ajouté au panier\./, 25000);
      check('« Je prends » : l\'article est ajoute au vrai panier du site (aucune commande n\'est annoncee avant la confirmation du systeme)', (await panelOf(v.page).getByText(/commande (est )?passée|paiement reçu|stock réservé/i).count()) === 0);
      check('aucune erreur (gammes et comparaison)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- G7. un client qui hesite : Zara propose de comparer, sans pression
    {
      const v = await visitor();
      await openZara(v);
      await ask(v.page, 'chaussures', /C’est pour qui \?/, 20000);
      await tap(v.page, 'Pour un homme', /Quel est votre budget/, 20000);
      await tap(v.page, 'Peu importe', /Voici mes meilleurs choix/, 25000);
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 25000);
      const later = norm(await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText());
      const chips = await chipLabels(v.page);
      check('« je reflechis » apres plusieurs articles : Zara propose de montrer les differences entre ces modeles (bouton « Comparer »), sans pression', /Je peux aussi vous montrer les différences entre ces modèles/.test(later) && chips.includes('⚖️ Comparer') && !FORBID.test(later), [later, chips]);
      await tap(v.page, 'Comparer', /Comparons-les ensemble/, 25000);
      check('apres « Comparer » : la comparaison s\'affiche (deux articles)', (await panelOf(v.page).getByText(/Comparons-les ensemble/).count()) >= 1);
      await ask(v.page, 'comparer', /Comparons-les ensemble/, 25000);
      await v.ctx.close();
      // sans deux articles montres : Zara le dit simplement
      const w = await visitor();
      await openZara(w);
      await ask(w.page, 'comparer', /il me faut deux articles/, 20000);
      check('« comparer » sans articles montres : Zara demande lesquels, sans rien inventer (aucune fiche)', (await cardsOf(w.page).count()) === 0);
      await w.ctx.close();
    }

    // --- G8. fidelite : les VRAIS points du compte, jamais inventes ; un visiteur ou un client sans point n'a aucune phrase de fidelite
    {
      const fu = memberOf('Ahmed Hassan', { loyalty_points: 30 });
      const m = await newVisitor(phone, { lang: 'fr', storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': fu.session }, fakeUser: fu });
      await m.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await m.page.getByTestId('assistant-fab').click();
      await waitText(m.page, /Salut Ahmed/, 30000);
      await waitText(m.page, /À savoir avant de commander/, 20000);
      await ask(m.page, 'nouveautés', /Merci pour votre fidélité/, 25000);
      const loyal = norm(await panelOf(m.page).getByText(/Merci pour votre fidélité/).last().innerText());
      check('client avec 30 points : « Merci pour votre fidelite », ses points relus dans son compte (30, grade Argent) et ce qu\'il lui manque pour le grade Or (20 points)', /Vos points : 30 \(grade Argent/.test(loyal) && /il vous manque 20 points pour le grade Or/.test(loyal) && !FORBID.test(loyal), loyal);
      await m.page.screenshot({ path: path.join(OUT, 'G8-fidelite.png') });
      await m.ctx.close();
      const z = memberOf('Ahmed Hassan', { loyalty_points: 0 });
      const n = await newVisitor(phone, { lang: 'fr', storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': z.session }, fakeUser: z });
      await n.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await n.page.getByTestId('assistant-fab').click();
      await waitText(n.page, /Salut Ahmed/, 30000);
      await waitText(n.page, /À savoir avant de commander/, 20000);
      await ask(n.page, 'nouveautés', /Voici les nouveautés/, 25000).catch(() => {});
      await sleep(1500);
      check('client avec 0 point : aucune phrase de fidelite inventee', (await panelOf(n.page).getByText(/Merci pour votre fidélité|Vos points/).count()) === 0);
      await n.ctx.close();
      const g = await visitor();
      await openZara(g);
      await ask(g.page, 'nouveautés', /Voici les nouveautés/, 25000).catch(() => {});
      await sleep(1500);
      check('visiteur sans compte : aucune phrase de fidelite', (await panelOf(g.page).getByText(/Merci pour votre fidélité|Vos points/).count()) === 0);
      await g.ctx.close();
    }

    // --- G9. en arabe : metier, boutons de style, reponse
    {
      const v = await visitor({ lang: 'ar' });
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /أنشئ حسابك|حسابك/, 25000);
      await ask(v.page, 'أنا مهندس', /شكرا لأنك حدثتني عن نفسك/, 20000);
      const chips = await chipLabels(v.page);
      check('en arabe : « أنا مهندس » -> Zara remercie et demande le style (4 boutons arabes, elegant d\'abord)', chips[0] === '✨ أنيق / فاخر' && chips.length === 5 && chips.every((c) => /[؀-ۿ]/.test(c)), chips);
      await tap(v.page, 'أنيق', /اختيار ممتاز/, 20000);
      check('en arabe : le style choisi est reconnu et Zara continue avec ses questions', (await panelOf(v.page).getByText(/لمن|لرجل|لامرأة|هل هو/).count()) >= 0);
      check('aucune erreur (arabe)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  // =============================================== T. PERSONNALITE : POLITESSE, COMPLIMENTS, ADRESSE ET NUMERO PERSONNELS ===============================================
  if (PARTS.includes('T')) {
    console.log('\n== T. personnalite : politesse, compliments, jamais d\'adresse ni de numero personnel (francais et arabe)');
    // tous les messages de Zara depuis le debut (gardes dans l'onglet), et le dernier message qui correspond a un motif
    const replies = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1') || '{"messages":[]}').messages.filter((m) => m.role === 'assistant').map((m) => m.text));
    const lastMatching = (p, re) => panelOf(p).getByText(re).last().innerText();
    const openZara = async (p, name) => {
      await p.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await p.getByRole('button', { name: /Discuter avec Zara Kings|التحدث مع زارا كينغز/ }).click();
      await waitText(p, name === 'ar' ? /أنشئ حسابك المجاني(?:، علي)?/ : /Créez votre compte gratuit(?:, Ali)?/);
    };
    const HELLO = /Bienvenue chez Albasse Shopping ! Comment puis-je vous aider aujourd’hui \?|Ravie de vous accueillir\. Que puis-je faire pour vous aujourd’hui \?/;
    const COMPL = /(Oh, merci beaucoup|Oh, c’est très gentil|Merci beaucoup, c’est adorable)/;

    // --- T1. francais : salutations, merci, ca va, au revoir
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      const { page } = v;
      const tOpen0 = Date.now();
      await openZara(page, 'fr');
      check('visiteur sans compte : salue tout de suite (pas d\'attente de 10 secondes)', Date.now() - tOpen0 < 12000 && (await replies(page)).length >= 2, Date.now() - tOpen0);
      await ask(page, 'Bonjour !', HELLO);
      const hello = await lastMatching(page, HELLO);
      check('« Bonjour ! » : « Bonjour 😊 Bienvenue chez Albasse Shopping ! Comment puis-je vous aider aujourd\'hui ? » (ou une variante) avec le menu', /^Bonjour(, Ali)? ?!? ?😊/.test(hello) && (await chipLabels(page)).includes('🔥 Promotions'), hello);
      await ask(page, 'Salut Zara !', /Salut(, Ali)? ?!? ?😊/);
      const salut = await lastMatching(page, /Salut(, Ali)? ?!? ?😊/);
      check('« Salut Zara ! » : Zara salue sur le meme ton et dit « retrouver / revoir » car elle connait deja le prenom', /retrouver|revoir/.test(salut), salut);
      await ask(page, 'Bonsoir', /Bonsoir(, Ali)? ?!? ?(😊|🌙)/);
      check('« Bonsoir » : Zara repond « Bonsoir »', true);
      await ask(page, 'Ça va ?', /(Très bien, merci|Je vais très bien, merci|Ça va très bien, merci)/);
      const fine = await lastMatching(page, /(Très bien, merci|Je vais très bien, merci|Ça va très bien, merci)/);
      check('« Ça va ? » : Zara repond qu\'elle va bien et demande comment l\'aider', /Et vous \?|J’espère que vous aussi|Et de votre côté/.test(fine), fine);
      await ask(page, 'Merci.', /^Avec plaisir|^Je vous en prie/);
      const thanks1 = await lastMatching(page, /^Avec plaisir|^Je vous en prie/);
      check('« Merci. » : reponse simple et chaleureuse, sans publicite (pas de « promotions »), seulement le bouton Menu', !/promotion|solde|remise/i.test(thanks1) && (await chipLabels(page)).join('|') === '🏠 Menu', { thanks1, chips: await chipLabels(page) });
      await ask(page, 'Merci beaucoup', /^C’est avec plaisir|^Merci à vous|^Avec grand plaisir/);
      const thanks2 = await lastMatching(page, /^C’est avec plaisir|^Merci à vous|^Avec grand plaisir/);
      check('« Merci beaucoup » : une autre phrase que « Merci. »', thanks2 !== thanks1, { thanks1, thanks2 });
      await ask(page, 'merci', /^Avec plaisir|^Je vous en prie/);
      await ask(page, 'merci', /^Avec plaisir|^Je vous en prie/);
      const seq = (await replies(page)).filter((t) => /^(Avec plaisir|Je vous en prie)/.test(t));
      check('« merci » dit plusieurs fois : Zara ne repond jamais deux fois exactement la meme phrase de suite', seq.length >= 3 && seq.every((t, i) => i === 0 || t !== seq[i - 1]), seq);
      await ask(page, 'Bonne nuit', /Bonne nuit (à vous aussi )?🌙/);
      check('« Bonne nuit » : « Bonne nuit à vous aussi 🌙 Merci pour votre visite ! » (ou variante)', /🌙/.test(await lastMatching(page, /Bonne nuit (à vous aussi )?🌙/)));
      await ask(page, 'Au revoir', /Au plaisir de vous revoir sur Albasse Shopping|Au revoir ! 😊 Merci pour votre visite/);
      await ask(page, 'merci, bonne journée', /Bonne journée/);
      check('« Au revoir » et « merci, bonne journée » : Zara dit au revoir gentiment', true);
      const byeCount = (await replies(page)).filter((t) => /^(Au plaisir de vous revoir|Au revoir ! 😊)/.test(t)).length;
      await ask(page, 'à plus de 10000 FCFA', /budget|Voici|trouvé|Je n’ai rien|Quel genre|Pour qui/i).catch(() => {});
      check('« à plus de 10 000 FCFA » n\'est PAS pris pour un au revoir (c\'est un budget)', (await replies(page)).filter((t) => /^(Au plaisir de vous revoir|Au revoir ! 😊)/.test(t)).length === byeCount, byeCount);
      await page.screenshot({ path: path.join(OUT, 'T1-politesse.png') });
      check('aucune erreur (politesse en francais)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- T2. compliments, puis « merci » juste apres
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      const { page } = v;
      await openZara(page, 'fr');
      await ask(page, 'Tu es belle 😍', COMPL);
      const c1 = await lastMatching(page, COMPL);
      check('« Tu es belle 😍 » : Zara remercie avec chaleur et dit qu\'elle est l\'assistante virtuelle Zara (aucun faux sentiment humain)', /assistante virtuelle/.test(c1) && !/toi aussi|moi aussi|je t’aime/i.test(c1), c1);
      await ask(page, 'Merci.', /aujourd’hui \? 🛍️/);
      const c2 = await lastMatching(page, /aujourd’hui \? 🛍️/);
      check('« Merci. » juste apres le compliment : « Avec grand plaisir ! ... qu\'est-ce qui vous ferait plaisir aujourd\'hui ? 🛍️ »', /^Avec (grand )?plaisir/.test(c2), c2);
      await ask(page, 'vous êtes adorable', COMPL);
      await ask(page, 'bravo', COMPL);
      const compl = (await replies(page)).filter((t) => COMPL.test(t));
      check('3 compliments de suite : 3 reponses differentes', compl.length === 3 && new Set(compl).size === 3, compl);
      await page.screenshot({ path: path.join(OUT, 'T2-compliment.png') });
      check('aucune erreur (compliments)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- T3. adresse, numero, vie personnelle : Zara reste une assistante virtuelle, aucun faux numero
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      const { page } = v;
      await openZara(page, 'fr');
      const cases = [
        ['Zara, quelle est ton adresse ?', /Je suis votre assistante virtuelle, disponible en ligne pour vous aider ! Vous pouvez me retrouver ici sur Albasse Shopping\.|Je n’ai pas d’adresse comme une personne/, ['📍 Adresse de la boutique', '🏠 Menu']],
        ['Tu habites où ?', /Je n’ai pas de domicile comme une personne|Je n’ai pas de maison/, ['🏠 Menu']],
        ['Zara, donne-moi ton numéro', /Je n’ai pas de numéro personnel\. Je travaille en ligne comme assistante virtuelle de marketing digital chez Albasse Shopping|Je n’ai pas de téléphone personnel/, ['💬 WhatsApp', '🏠 Menu']],
        ['Je veux ton WhatsApp personnel', /Je n’ai pas de WhatsApp personnel|Je n’ai pas de WhatsApp à moi/, ['💬 WhatsApp', '🏠 Menu']],
        ['Je veux t’appeler', /Je comprends ! Je suis une assistante virtuelle|Je ne peux pas recevoir d’appels/, ['💬 WhatsApp', '🏠 Menu']],
        ['tu es mariée ?', /Je suis une assistante virtuelle/, ['🏠 Menu']],
      ];
      for (const [q, re, chips] of cases) {
        await ask(page, q, re);
        const reply = await lastMatching(page, re);
        const got = await chipLabels(page);
        check(`« ${q} » : assistante virtuelle, aucun numero ni adresse invente, boutons ${chips.join(' + ')}`, !/\d{3,}|\+\s?\d|rue |avenue |quartier/i.test(reply) && got.join('|') === chips.join('|'), { reply: reply.slice(0, 160), got });
      }
      await page.screenshot({ path: path.join(OUT, 'T3-perso.png') });
      // le bouton « Adresse de la boutique » donne la VRAIE adresse (donnees de la boutique), pas celle de Zara
      await ask(page, 'Zara, quelle est ton adresse ?', /Je suis votre assistante virtuelle, disponible|Je n’ai pas d’adresse/);
      await tap(page, 'Adresse de la boutique', /Pour une question, écrivez-nous sur WhatsApp/);
      const shop = await lastMatching(page, /Pour une question, écrivez-nous sur WhatsApp/);
      check('« Adresse de la boutique » : les vraies informations de la boutique (adresse, horaires de la base), pas celles de Zara', /📍|🕗/.test(shop), shop);
      // les questions sur la boutique, elles, continuent de marcher
      await ask(page, 'numéro whatsapp de la boutique', /Pour une question, écrivez-nous sur WhatsApp/);
      check('« numéro whatsapp de la boutique » : reponse de la boutique (contact officiel), pas « je n\'ai pas de numero »', true);
      check('aucune erreur (vie personnelle)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- T4. arabe
    {
      const v = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      const { page } = v;
      await openZara(page, 'ar');
      await ask(page, 'السلام عليكم', /وعليكم السلام/);
      await ask(page, 'شكرا', /(على الرحب والسعة|العفو|بكل سرور)/);
      await ask(page, 'كيف حالك', /(بخير|الحمد لله)/);
      await ask(page, 'تصبح على خير', /(وأنتم من أهل الخير|تصبحون على خير)/);
      await ask(page, 'انت جميلة', /(شكراً جزيلاً|ما أجمل كلامك|هذا لطف منك)/);
      await ask(page, 'ما هو عنوانك', /(أنا مساعدتك الافتراضية|أنا مساعدة افتراضية)/);
      const addrChips = await chipLabels(page);
      check('en arabe : « ما هو عنوانك » -> assistante virtuelle + bouton « عنوان المتجر »', addrChips.includes('📍 عنوان المتجر'), addrChips);
      await ask(page, 'اعطني رقمك', /ليس لدي (رقم|هاتف) شخصي/);
      const numChips = await chipLabels(page);
      const numReply = await lastMatching(page, /ليس لدي (رقم|هاتف) شخصي/);
      check('en arabe : « اعطني رقمك » -> pas de numero personnel, bouton واتساب officiel, aucun chiffre invente', numChips.includes('💬 واتساب') && !/\d{3,}/.test(numReply), { numChips, numReply: numReply.slice(0, 120) });
      await ask(page, 'كم عمرك', /(أنا مساعدة افتراضية)/);
      const dir = await panelOf(page).getByText(/ليس لدي (رقم|هاتف) شخصي/).last().evaluate((el) => getComputedStyle(el).direction);
      check('les reponses arabes s\'ecrivent de droite a gauche', dir === 'rtl', dir);
      await page.screenshot({ path: path.join(OUT, 'T4-arabe.png') });
      check('aucune erreur (politesse en arabe)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  // =============================================== O. ZARA FINALISE L'ACHAT DANS LE CHAT ===============================================
  if (PARTS.includes('O') || PARTS.includes('F')) {
    console.log('\n== O/F. Zara finalise l\'achat dans le chat et repond sur la fidelite (fausse base : aucune vraie commande)');
    const UID = '11111111-1111-4111-8111-111111111111';
    const JWT_FAKE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const mkMember = (fullName, { phone: ph = '66123456', address = null, points = undefined } = {}) => {
      const auth = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT_FAKE, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: UID, email: 'test@example.com', full_name: fullName, phone: ph, address, loyalty_points: points, banned: false, role: 'customer', is_admin: false } };
    };
    const newDb = () => ({ list: [], patches: [], created: [], attempts: [], failNext: 0, failAfterSave: 0 });
    const cartOf = (qty) => JSON.stringify({ state: { items: [{ id: `${realProduct.id}__nc__ns`, product: realProduct, quantity: qty, color: null, size: null }], updatedAt: Date.now() }, version: 0 });
    // le client est deja connu et salue (conversation et « deja salue » mis dans l'onglet) : ces essais testent la commande, pas l'accueil
    const seedOf = (lg) => ({ albasse_zara_v1: JSON.stringify({ messages: [{ id: 's1', role: 'assistant', text: lg === 'ar' ? 'مرحباً' : 'Bonjour', lang: lg }], step: 'menu', ctx: null, need: null, order: null }), albasse_zara_member: UID });
    const orderVisitor = (fu, db, { qty = 1, lg = 'fr' } = {}) =>
      newVisitor(phone, { lang: lg, storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': fu.session, 'albasse-cart': cartOf(qty) }, session: seedOf(lg), fakeUser: fu, fakeOrders: db });
    const openOrderChat = async (c) => {
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await c.page.getByRole('button', { name: /Discuter avec Zara Kings|التحدث مع زارا كينغز/ }).click();
    };
    const numRe = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00a0\\u202f]?');
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tapExact = async (p, label, re, timeout = 15000) => {
      const n = await panelOf(p).getByText(re).count();
      await panelOf(p).getByTestId('assistant-chip').filter({ hasText: new RegExp(`^\\s*${esc(label)}\\s*$`) }).click();
      const t0 = Date.now();
      while ((await panelOf(p).getByText(re).count()) <= n) {
        if (Date.now() - t0 > timeout) throw new Error(`pas de nouvelle reponse apres « ${label} » (${re})`);
        await sleep(200);
      }
    };
    const cartCount = (p) => p.evaluate(() => (JSON.parse(localStorage.getItem('albasse-cart') || '{"state":{"items":[]}}').state.items || []).length);
    const realErrs = (c) => c.errs.filter((e) => !/Erreur création commande/.test(e));

    // donnees reelles (lecture seule) : villes avec leurs frais, numeros de paiement
    const cityRows = await get('cities?select=name,delivery_fee&is_active=eq.true&order=sort_order&order=name');
    const isHome = (n) => ['ndjamena', 'djamena', 'ndjam'].includes(n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, ''));
    const homeCity = cityRows.find((c) => isHome(c.name));
    const farCity = cityRows.slice(0, 8).find((c) => !isHome(c.name) && Number(c.delivery_fee) > 0) || cityRows.find((c) => !isHome(c.name) && Number(c.delivery_fee) > 0);
    const payRow = (await get('payment_settings?select=*&id=eq.1'))[0] || {};
    const price = Number(realProduct.price);
    const farFee = Number(farCity.delivery_fee);
    const homeFee = homeCity && homeCity.delivery_fee != null ? Number(homeCity.delivery_fee) : 0;
    console.log('info  commande : article', realProduct.name, price, '| ville loin :', farCity.name, farFee, '| ville de la boutique :', homeCity && homeCity.name, homeFee, '| paiement Airtel :', payRow.airtel_number || '(constante)');

    if (PARTS.includes('O')) {
    // --- O1. parcours complet : adresse, ville avec frais, Airtel Money, emballage cadeau, recapitulatif, confirmation
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 2 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await waitText(c.page, /finalisons votre commande ensemble/);
      check('compte connu : Zara ne redemande ni le nom ni le telephone, elle commence par l\'adresse', (await panelOf(c.page).getByText(/nom complet de la personne|Quel est votre numéro/).count()) === 0);
      await typeIn(c.page, 'Quartier Farcha, rue 12, près du marché');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      check('pendant la commande : aucun ancien bouton (le client ne peut pas se tromper)', (await panelOf(c.page).getByTestId('assistant-chip-old').count()) === 0);
      const cityChips = await chipLabels(c.page);
      check('la ville : boutons des villes de la boutique + annuler', cityChips.includes(farCity.name) && cityChips[cityChips.length - 1] === 'Annuler la commande', cityChips);
      await tapExact(c.page, farCity.name, /Dans votre ville, le paiement se fait à l’avance/);
      const payChips = await chipLabels(c.page);
      check('hors N\'Djamena : paiement a l\'avance seulement (Airtel Money, Moov Money), pas de paiement a la livraison', payChips.join('|') === '📱 Airtel Money|📲 Moov Money|Annuler la commande', payChips);
      await tapExact(c.page, '📱 Airtel Money', /Souhaitez-vous l’emballage cadeau/);
      check('emballage cadeau : oui (+2 000 FCFA) / non', (await chipLabels(c.page)).join('|').replace(/[\s  ]/g, '') === '🎁Oui(+2000FCFA)|Non,merci|Annulerlacommande', await chipLabels(c.page));
      await tapExact(c.page, (await chipLabels(c.page))[0], /Récapitulatif de votre commande/);
      const total = 2 * price + farFee + 2000;
      const recap = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('recapitulatif : article x 2, livraison de la ville, emballage cadeau, total exact', new RegExp(`× 2 : ${numRe(2 * price)} FCFA`).test(recap) && new RegExp(`Livraison à ${esc(farCity.name)} : ${numRe(farFee)} FCFA`).test(recap) && new RegExp(`Emballage cadeau : ${numRe(2000)} FCFA`).test(recap) && new RegExp(`Total : ${numRe(total)} FCFA`).test(recap), recap);
      check('recapitulatif : nom, telephone, adresse, ville, mode de paiement', /👤 Ahmed Hassan · 📞 66123456/.test(recap) && new RegExp(`📍 Quartier Farcha, rue 12, près du marché, ${esc(farCity.name)}`).test(recap) && /📱 Paiement à l’avance par Airtel Money/.test(recap), recap);
      check('recapitulatif : boutons Confirmer / Modifier / Annuler, et RIEN n\'est encore enregistre', (await chipLabels(c.page)).join('|') === '✅ Confirmer la commande|✏️ Modifier|Annuler la commande' && db.attempts.length === 0, await chipLabels(c.page));
      await c.page.screenshot({ path: path.join(OUT, 'O1-recapitulatif.png') });
      await tapExact(c.page, '✅ Confirmer la commande', /a bien été enregistrée/);
      check('la commande est enregistree UNE fois', db.created.length === 1 && db.attempts.length === 1, db.attempts.length);
      const b = db.created[0];
      check('ce qui est enregistre : compte, statut en attente, paiement, livraison, cadeau, total', b.user_id === UID && b.status === 'pending' && b.payment_method === 'airtel_money' && b.shipping_name === 'Ahmed Hassan' && b.shipping_phone === '66123456' && b.shipping_address === 'Quartier Farcha, rue 12, près du marché' && b.shipping_city === farCity.name && b.gift_wrap === true && b.total === total && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b.id), { ...b, items: undefined });
      check('statistiques de Zara : la commande passee dans le chat note l\'appareil du client (Android)', b.assistant_device === 'Android', b.assistant_device);
      check('articles enregistres : le bon produit, le prix de la base, la quantite', b.items.length === 1 && b.items[0].product_id === realProduct.id && b.items[0].unit_price === price && b.items[0].quantity === 2, b.items);
      const done = await panelOf(c.page).getByText(/a bien été enregistrée/).last().innerText();
      const airtelLine = payRow.airtel_payment_url ? `Payez ici : ${payRow.airtel_payment_url}` : `Envoyez ${numRe(total)} FCFA au ${esc(payRow.airtel_number || '60 60 51 51')} \\(Airtel Money\\)`;
      check('confirmation : numero de commande, total, instructions de paiement, emballage cadeau, horaires et 48 h', done.includes(`#${b.id.slice(0, 8)}`) && new RegExp(`Total à régler : ${numRe(total)} FCFA`).test(done) && new RegExp(airtelLine).test(done) && /Emballage cadeau inclus/.test(done) && /valable 48 h/.test(done) && /8h30 à 16h/.test(done) && new RegExp(`Fidélité : cette commande vous rapportera ${Math.floor(total / 5000)} points? une fois livrée`).test(done), done);
      check('confirmation : jamais « payee » ni « confirmee par la boutique » (seulement « enregistree »)', !/payée|paiement reçu|commande confirmée/i.test(done), done);
      check('le panier est vide apres l\'enregistrement, et boutons Mes commandes / Menu', (await cartCount(c.page)) === 0 && (await chipLabels(c.page)).join('|') === '📦 Mes commandes|🏠 Menu', await chipLabels(c.page));
      await c.page.screenshot({ path: path.join(OUT, 'O2-confirmation.png') });
      await ask(c.page, 'oui', /./).catch(() => {});
      await sleep(1500);
      check('un « oui » apres coup ne refait PAS de commande', db.attempts.length === 1 && db.created.length === 1);
      check('aucune ecriture reelle (toutes les ecritures sont dans la fausse base)', c.writes.every((w) => !/\/orders/.test(w)), c.writes);
      check('aucune erreur (commande complete)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O2. en ecrivant : N'Djamena, paiement a la livraison, sans emballage, confirmation par « oui »
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Farcha, face à la pharmacie');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      await typeIn(c.page, homeCity.name);
      await waitText(c.page, /Comment souhaitez-vous payer/);
      check('a N\'Djamena : paiement a la livraison propose en plus d\'Airtel Money et Moov Money', (await chipLabels(c.page)).join('|') === '💵 À la livraison|📱 Airtel Money|📲 Moov Money|Annuler la commande', await chipLabels(c.page));
      await typeIn(c.page, 'je paie à la livraison');
      await waitText(c.page, /Souhaitez-vous l’emballage cadeau/);
      await typeIn(c.page, 'non merci');
      await waitText(c.page, /Récapitulatif de votre commande/);
      const recap = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('recapitulatif a N\'Djamena : pas d\'emballage cadeau, paiement a la livraison en especes', !/Emballage cadeau/.test(recap) && /💵 Paiement à la livraison, en espèces/.test(recap) && new RegExp(`Total : ${numRe(price + homeFee)} FCFA`).test(recap), recap);
      await typeIn(c.page, 'oui');
      await waitText(c.page, /a bien été enregistrée/);
      const b = db.created[0];
      const done = await panelOf(c.page).getByText(/a bien été enregistrée/).last().innerText();
      check('enregistre : paiement a la livraison, sans emballage, bon total ; confirmation sans numero Mobile Money', db.created.length === 1 && b.payment_method === 'cash_on_delivery' && !('gift_wrap' in b) && b.total === price + homeFee && /Vous payez en espèces directement à la livraison/.test(done) && !/Envoyez|Payez ici/.test(done) && !/Emballage cadeau inclus/.test(done) && /réglez dans ce délai|valable 48 h/.test(done) && new RegExp(`vous rapportera ${Math.floor((price + homeFee) / 5000)} points? une fois livrée`).test(done), { total: b.total, done });
      check('aucune erreur (paiement a la livraison)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O3. controles : telephone invalide, question au milieu, modifier, annuler
    {
      const fu = mkMember('Ahmed Hassan', { phone: '' });
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quel est votre numéro de téléphone/);
      await ask(c.page, '1234', /Le numéro doit contenir 8 chiffres et commencer par 6 ou 9/);
      await ask(c.page, 'abc', /Le numéro doit contenir 8 chiffres et commencer par 6 ou 9/);
      await ask(c.page, '55123456', /Le numéro doit contenir 8 chiffres et commencer par 6 ou 9/);
      check('telephone invalide (trop court, lettres, commence par 5) : refuse chaque fois, rien d\'enregistre', (await panelOf(c.page).getByText(/Le numéro doit contenir 8 chiffres/).count()) === 3 && db.attempts.length === 0);
      await ask(c.page, '+235 66 12 34 56', /Quelle est votre adresse de livraison/);
      const addressAsks = await panelOf(c.page).getByText(/Quelle est votre adresse de livraison/).count();
      await ask(c.page, 'tu es une vraie personne ?', /assistante virtuelle d’Albasse Shopping/);
      await waitText(c.page, /Quelle est votre adresse de livraison/);
      await sleep(800);
      check('une question au milieu de la commande : Zara repond, puis repose la question en cours (la commande reste ouverte)', (await panelOf(c.page).getByText(/Quelle est votre adresse de livraison/).count()) === addressAsks + 1 && (await c.page.evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1')).step)) === 'co_address');
      await typeIn(c.page, 'Quartier Moursal');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      await tapExact(c.page, homeCity.name, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      const recap1 = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('le telephone « +235 66 12 34 56 » est enregistre en 8 chiffres : 66123456', /📞 66123456/.test(recap1), recap1);
      await tapExact(c.page, '✏️ Modifier', /Que voulez-vous modifier/);
      check('modifier : nom, telephone, adresse, ville, paiement, emballage', (await chipLabels(c.page)).join('|') === '👤 Nom|📞 Téléphone|📍 Adresse|🏙️ Ville|💳 Paiement|🎁 Emballage|Annuler la commande', await chipLabels(c.page));
      await tapExact(c.page, '📍 Adresse', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Chagoua, rue 5');
      await waitText(c.page, /📍 Quartier Chagoua, rue 5, /);
      const recap2 = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('apres la modification : nouveau recapitulatif avec la nouvelle adresse (le reste ne change pas)', /📍 Quartier Chagoua, rue 5,/.test(recap2) && /📞 66123456/.test(recap2) && !/Moursal/.test(recap2), recap2);
      await tapExact(c.page, 'Annuler la commande', /j’ai arrêté la commande/);
      check('annuler : le panier est garde, rien n\'est enregistre, boutons du panier', (await cartCount(c.page)) === 1 && db.attempts.length === 0 && (await chipLabels(c.page)).includes('✅ Commander'), await chipLabels(c.page));
      check('aucune erreur (controles)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O4. panne a l'enregistrement : rien n'est dit « enregistre », le panier est garde, on peut reessayer (meme numero de commande)
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      db.failNext = 1;
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Farcha');
      await tapExact(c.page, homeCity.name, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      await tapExact(c.page, '✅ Confirmer la commande', /Je n’ai pas pu enregistrer votre commande/);
      check('panne : Zara dit la verite (commande NON enregistree), propose Reessayer / Page de commande / WhatsApp', (await chipLabels(c.page)).join('|') === '🔄 Réessayer|📄 Page de commande|💬 WhatsApp' && (await panelOf(c.page).getByText(/a bien été enregistrée/).count()) === 0, await chipLabels(c.page));
      check('panne : rien d\'enregistre, le panier est garde', db.created.length === 0 && db.attempts.length === 1 && (await cartCount(c.page)) === 1);
      await tapExact(c.page, '🔄 Réessayer', /a bien été enregistrée/);
      check('reessayer : la commande est enregistree avec le MEME numero que le premier essai', db.created.length === 1 && db.attempts.length === 2 && db.attempts[0].id === db.created[0].id && db.attempts[1].id === db.created[0].id, db.attempts.map((a) => a.id));
      check('apres reussite : panier vide', (await cartCount(c.page)) === 0);
      await c.page.screenshot({ path: path.join(OUT, 'O3-reessai.png') });
      check('aucune autre erreur (panne)', realErrs(c).length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O5. reponse perdue : la commande est deja enregistree, le client reessaie -> pas de doublon
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      db.failAfterSave = 1;
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Farcha');
      await tapExact(c.page, homeCity.name, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '📲 Moov Money', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      await tapExact(c.page, '✅ Confirmer la commande', /Je n’ai pas pu enregistrer votre commande/);
      await tapExact(c.page, '🔄 Réessayer', /a bien été enregistrée/);
      const done = await panelOf(c.page).getByText(/a bien été enregistrée/).last().innerText();
      const moovLine = payRow.moov_payment_url ? `Payez ici : ${payRow.moov_payment_url}` : `Envoyez ${numRe(price + homeFee)} FCFA au ${esc(payRow.moov_number || '99 22 10 17')} \\(Moov Money\\)`;
      check('reponse perdue puis reessai : UNE seule commande en base (pas de doublon), confirmation avec les instructions Moov Money', db.created.length === 1 && db.attempts.length === 2 && new RegExp(moovLine).test(done), { created: db.created.length, attempts: db.attempts.length, done });
      check('aucune autre erreur (reponse perdue)', realErrs(c).length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O6. la page de commande du site reste possible (secours)
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      db.failNext = 1;
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Farcha');
      await tapExact(c.page, homeCity.name, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      await tapExact(c.page, '✅ Confirmer la commande', /Je n’ai pas pu enregistrer votre commande/);
      await panelOf(c.page).getByTestId('assistant-chip').filter({ hasText: 'Page de commande' }).click();
      await c.page.waitForURL(/\/commande/, { timeout: 15000 });
      check('« Page de commande » : ouvre la page officielle du site, le panier est garde', (await cartCount(c.page)) === 1 && db.created.length === 0);
      await c.ctx.close();
    }

    // --- O7. le prix change pendant la commande : Zara le dit et redemande la confirmation, jamais de prix change en silence
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 2 });
      let bump = 0;
      await c.page.route(/\/rest\/v1\/products\?.*select=id%2Cprice|\/rest\/v1\/products\?.*select=id,price/, (route) =>
        route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: realProduct.id, price: price + bump, compare_at_price: realProduct.compare_at_price, stock: realProduct.stock, is_active: true }]) })
      );
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Farcha');
      await tapExact(c.page, homeCity.name, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      bump = 500;
      await tapExact(c.page, '✅ Confirmer la commande', /Les prix ou le stock ont changé/);
      await waitText(c.page, /Le prix de « .* » a changé/);
      await sleep(1200);
      const recaps = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).allInnerTexts();
      const newTotal = 2 * (price + 500) + homeFee;
      check('prix change au moment de confirmer : Zara l\'annonce, montre le nouveau recapitulatif, et N\'enregistre PAS', db.attempts.length === 0 && recaps.length === 2 && new RegExp(`Total : ${numRe(newTotal)} FCFA`).test(recaps[1]), recaps.map((r) => r.slice(0, 120)));
      await tapExact(c.page, '✅ Confirmer la commande', /a bien été enregistrée/);
      check('apres nouvelle confirmation : enregistre au NOUVEAU prix', db.created.length === 1 && db.created[0].items[0].unit_price === price + 500 && db.created[0].total === newTotal, db.created[0] && db.created[0].total);
      await c.ctx.close();
    }

    // --- O8. arabe, avec changement de langue en cours de route
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await c.page.getByTestId('assistant-lang').click();
      await waitText(c.page, /ما عنوان التوصيل؟/);
      check('changement de langue pendant la commande : la question en cours est reposee en arabe, la commande continue', (await c.page.evaluate(() => JSON.parse(sessionStorage.getItem('albasse_zara_v1')).step)) === 'co_address' && (await c.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar');
      await typeIn(c.page, 'حي فرشا قرب الصيدلية');
      await waitText(c.page, /في أي مدينة يجب أن نوصّل إليك؟/);
      await tapExact(c.page, farCity.name, /في مدينتك، يتم الدفع مسبقاً/);
      await tapExact(c.page, '📱 Airtel Money', /هل تريد تغليف الهدية؟/);
      await tapExact(c.page, 'لا، شكراً', /ملخص طلبك/);
      const recap = await panelOf(c.page).getByText(/ملخص طلبك/).last().innerText();
      check('recapitulatif en arabe : article, livraison, total, nom, telephone, adresse, paiement', /الدفع مسبقاً عبر Airtel Money/.test(recap) && new RegExp(`المجموع: ${numRe(price + farFee)} FCFA`).test(recap) && /66123456/.test(recap) && /حي فرشا قرب الصيدلية/.test(recap), recap);
      const dir = await panelOf(c.page).getByText(/ملخص طلبك/).last().evaluate((el) => getComputedStyle(el).direction);
      check('le recapitulatif arabe s\'ecrit de droite a gauche', dir === 'rtl', dir);
      await c.page.screenshot({ path: path.join(OUT, 'O4-arabe-recapitulatif.png') });
      await tapExact(c.page, '✅ تأكيد الطلب', /تم تسجيل طلبك رقم #/);
      check('commande enregistree une fois, avec les bonnes informations (arabe)', db.created.length === 1 && db.created[0].payment_method === 'airtel_money' && db.created[0].shipping_address === 'حي فرشا قرب الصيدلية' && db.created[0].shipping_city === farCity.name && db.created[0].total === price + farFee, db.created[0]);
      const done = await panelOf(c.page).getByText(/تم تسجيل طلبك رقم #/).last().innerText();
      check('confirmation arabe : numero de commande et total', done.includes(`#${db.created[0].id.slice(0, 8)}`) && new RegExp(`المبلغ المطلوب: ${numRe(price + farFee)} FCFA`).test(done), done);
      check('aucune erreur (commande en arabe)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O9. statistiques de Zara : la colonne n'existe pas encore dans la base (script pas applique) -> la commande est enregistree quand meme, sans l'appareil
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      db.rejectColumn = 'assistant_device';
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Farcha, face à la pharmacie');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      await typeIn(c.page, homeCity.name);
      await waitText(c.page, /Comment souhaitez-vous payer/);
      await typeIn(c.page, 'je paie à la livraison');
      await waitText(c.page, /Souhaitez-vous l’emballage cadeau/);
      await typeIn(c.page, 'non merci');
      await waitText(c.page, /Récapitulatif de votre commande/);
      await typeIn(c.page, 'oui');
      await waitText(c.page, /a bien été enregistrée/);
      check('base sans la colonne de Zara : la commande est enregistree QUAND MEME (une seule fois), sans l\'appareil', db.created.length === 1 && !('assistant_device' in db.created[0]) && db.created[0].total === price + homeFee, db.created[0] && Object.keys(db.created[0]));
      check('le client ne voit aucun echec : 1er essai avec l\'appareil refuse, 2e sans, meme numero de commande', db.attempts.length === 2 && db.attempts[0].assistant_device === 'Android' && !('assistant_device' in db.attempts[1]) && db.attempts[0].id === db.attempts[1].id, db.attempts.map((a) => Object.keys(a).includes('assistant_device')));
      check('aucun message d\'echec dans le chat', (await panelOf(c.page).getByText(/n’a pas pu être enregistrée|problème|réessay/i).count()) === 0);
      check('aucune erreur (commande sans colonne de Zara)', realErrs(c).length === 0, realErrs(c));
      await c.ctx.close();
    }
    }

    // --- F. programme de fidelite : le grade et les points viennent du compte (relus dans la base), jamais inventes
    if (PARTS.includes('F')) {
      const loyalty = async (points, question, re, { lg = 'fr', fail = false, stale } = {}) => {
        const fu = mkMember('Ahmed Hassan', { points: stale === undefined ? points : stale });
        const c = await orderVisitor(fu, newDb(), { qty: 1, lg });
        if (fail) await c.page.route(/select=loyalty_points/, (route) => route.abort());
        await openOrderChat(c);
        if (stale !== undefined) fu.profile.loyalty_points = points; // les points ont change depuis la connexion : Zara doit lire la valeur actuelle
        await ask(c.page, question, re);
        const text = await panelOf(c.page).getByText(re).last().innerText();
        return { c, text, fu };
      };
      {
        const { c, text } = await loyalty(0, 'quel est mon grade ?', /Bienvenue dans notre programme de fidélité ! 🥉/);
        check('0 point : Bronze 🥉, bienvenue dans le programme, 0 point, il manque 25 points pour Argent 🥈', /Vous êtes actuellement au grade Bronze/.test(text) && /Vos points : 0/.test(text) && /Il vous manque 25 points pour atteindre le grade Argent 🥈/.test(text), text);
        check('boutons : gagner des points / mes commandes / menu', (await chipLabels(c.page)).join('|') === '🎁 Gagner des points|📦 Mes commandes|🏠 Menu', await chipLabels(c.page));
        await c.page.screenshot({ path: path.join(OUT, 'F1-bronze.png') });
        await c.ctx.close();
      }
      {
        const { c, text } = await loyalty(37, 'mes points de fidélité', /Bonne nouvelle ! 😍 Vous êtes au grade Argent 🥈/);
        check('37 points : Argent 🥈, « il ne vous manque que 13 points pour atteindre le grade Or 🥇 » (nombre exact)', /il ne vous manque que 13 points pour atteindre le grade Or 🥇 ! Continuez à profiter de nos articles sur albasseshopping\.com/.test(text) && /Vos points : 37/.test(text), text);
        await c.page.screenshot({ path: path.join(OUT, 'F2-argent-proche.png') });
        await c.ctx.close();
      }
      {
        const { c, text } = await loyalty(30, 'mon grade', /Félicitations ! 🎉 Votre grade actuel chez Albasse Shopping est Argent 🥈/);
        check('30 points : Argent 🥈, il manque 20 points pour Or 🥇, invitation a continuer sur albasseshopping.com', /Il vous manque 20 points pour atteindre le grade Or 🥇/.test(text) && /Continuez à acheter sur albasseshopping\.com/.test(text), text);
        await c.ctx.close();
      }
      {
        const { c, text } = await loyalty(120, 'quel est mon niveau', /le plus haut grade du programme/);
        check('120 points : Diamond 👑, le plus haut grade, aucun « points manquants »', /Diamond 👑/.test(text) && !/manque/.test(text), text);
        await c.ctx.close();
      }
      {
        // points changes depuis la connexion (le profil gardait 10) : Zara relit le compte, elle ne se sert pas d'une valeur ancienne
        const { c, text } = await loyalty(55, 'combien de points j’ai', /Votre grade actuel chez Albasse Shopping est Or 🥇/, { stale: 10 });
        check('les points sont relus dans le compte au moment de la question (55 maintenant, et non les 10 gardes a la connexion)', /Vos points : 55/.test(text) && /Il vous manque 20 points pour atteindre le grade Platine 💎/.test(text), text);
        await c.ctx.close();
      }
      {
        const { c, text } = await loyalty(0, 'comment gagner des points', /C’est simple ! 😊 Achetez vos articles sur https:\/\/albasseshopping\.com/);
        check('comment gagner des points : phrase du patron, regle reelle (1 point / 5 000 FCFA d\'une commande livree) et les 5 grades avec leurs vrais paliers', /1 point pour chaque tranche de 5[\s  ]000 FCFA du total d’une commande livrée/.test(text) && text.includes('🥉 Bronze (au départ) · 🥈 Argent (25 points) · 🥇 Or (50 points) · 💎 Platine (75 points) · 👑 Diamond (100 points)'), text);
        check('boutons du client connecte : mes points / menu', (await chipLabels(c.page)).join('|') === '🏆 Mes points|🏠 Menu', await chipLabels(c.page));
        await ask(c.page, 'Bonjour', /Bienvenue chez Albasse Shopping ! Comment puis-je vous aider aujourd’hui \?|Ravie de vous accueillir\. Que puis-je faire pour vous aujourd’hui \?/);
        check('le menu du client connecte propose « Mes points »', (await chipLabels(c.page)).includes('🏆 Mes points'), await chipLabels(c.page));
        await tapExact(c.page, '🏆 Mes points', /Bienvenue dans notre programme de fidélité ! 🥉/);
        check('le bouton « Mes points » donne le grade du compte', true);
        await c.ctx.close();
      }
      {
        // visiteur sans compte : aucun grade, aucun nombre, il est invite a se connecter
        const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' }, session: seedOf('fr') });
        await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
        await sleep(2500);
        await v.page.getByRole('button', { name: FAB_NAME }).click();
        await ask(v.page, 'quel est mon grade ?', /Pour connaître votre grade et vos points de fidélité, connectez-vous à votre compte sur albasseshopping\.com/);
        const text = await panelOf(v.page).getByText(/Pour connaître votre grade/).last().innerText();
        check('sans compte : aucun grade ni nombre invente, invitation a se connecter (boutons compte / connexion / gagner des points)', !/\d|Bronze|Argent|Diamond/.test(text) && (await chipLabels(v.page)).join('|') === '👤 Créer mon compte|Me connecter|🎁 Gagner des points|🏠 Menu', { text, chips: await chipLabels(v.page) });
        await v.ctx.close();
      }
      {
        // les points ne se lisent pas : Zara n'invente rien et ne se sert pas du profil ancien (80 points -> Platine)
        const { c, text } = await loyalty(0, 'quel est mon grade', /Je n’arrive pas à lire vos points pour le moment/, { fail: true, stale: 80 });
        check('lecture impossible : aucun grade ni nombre (meme pas celui du profil ancien), on invite a consulter le compte', !/\d|Platine|Bronze|Or 🥇/.test(text) && /albasseshopping\.com/.test(text) && (await chipLabels(c.page)).join('|') === '👤 Mon compte|🎁 Gagner des points|🏠 Menu', { text, chips: await chipLabels(c.page) });
        await c.ctx.close();
      }
      {
        const { c, text } = await loyalty(37, 'ما هي درجتي', /بشرى سارة! 😍/, { lg: 'ar' });
        check('en arabe : grade (الدرجة الفضية 🥈), points restants exacts (13), enthousiasme', /الدرجة الفضية 🥈/.test(text) && /ينقصك 13 نقطة فقط للوصول إلى الدرجة الذهبية 🥇/.test(text) && /نقاطك: 37/.test(text), text);
        const dir = await panelOf(c.page).getByText(/بشرى سارة/).last().evaluate((el) => getComputedStyle(el).direction);
        check('la reponse arabe s\'ecrit de droite a gauche', dir === 'rtl', dir);
        await c.page.screenshot({ path: path.join(OUT, 'F3-arabe.png') });
        await c.ctx.close();
      }
    }
  }

  // =============================================== B. CONTEXTE : FICHE PRODUIT ET PANIER ===============================================
  if (PARTS.includes('B')) {
    console.log('\n== B. contexte : fiche produit et panier');
    {
      const c = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await c.page.goto(`http://localhost:${port}/produit/rolex`, { waitUntil: 'load' });
      await sleep(3500);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Ali'));
      await waitText(c.page, /Vous regardez « Rolex » \? Excellent choix !/);
      const pitch = await panelOf(c.page).getByText(/Vous regardez « Rolex »/).first().innerText();
      check('sur la fiche d\'un produit : Zara parle de ce produit (prix barre, -50 %, « Acheter »)', /12\s?500 FCFA au lieu de 25\s?000 FCFA \(-50 %\)/.test(pitch) && /« Acheter »/.test(pitch), pitch);
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, /Créez votre compte gratuit(?:, Ali)?/);
      await c.page.screenshot({ path: path.join(OUT, 'B1-produit.png') });
      check('aucune erreur (fiche produit)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    {
      const item = { id: `${realProduct.id}__nc__ns`, product: realProduct, quantity: 2, color: null, size: null };
      const cart = JSON.stringify({ state: { items: [item], updatedAt: Date.now() }, version: 0 });
      const c = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali', 'albasse-cart': cart } });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(3000);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, /🛒 Votre panier vous attend : 2 articles pour 25\s?000 FCFA/);
      await waitText(c.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('panier plein : Zara le rappelle (2 articles, total) et propose « Mon panier »', (await chipLabels(c.page)).includes('🛒 Mon panier'), await chipLabels(c.page));
      await chip(c.page, 'Mon panier').click();
      await waitText(c.page, /Voici votre panier 🛒/);
      await c.page.getByTestId('chat-cart').last().waitFor({ timeout: 10000 });
      const qtyShown = await c.page.getByTestId('chat-cart-qty').last().innerText();
      check('« Mon panier » montre le panier dans la conversation (1 ligne, quantite 2, total 25 000 FCFA)', (await c.page.getByTestId('chat-cart-item').count()) === 1 && qtyShown.trim() === '2' && num(await c.page.getByTestId('chat-cart-total').last().innerText()) === 25000 && (await panelOf(c.page).count()) === 1, qtyShown);
      check('aucune erreur (panier)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
  }

  // =============================================== C. CLIENT CONNECTE ===============================================
  if (PARTS.includes('C')) {
    console.log('\n== C. client connecte (compte et commandes simules)');
    const uid = '11111111-1111-4111-8111-111111111111';
    const mk = (admin) => ({
      auth: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
      profile: { id: uid, email: 'test@example.com', full_name: 'Aminata Hassan', phone: '66123456', banned: false, role: 'customer', is_admin: !!admin },
    });
    const sessionFor = (fu) =>
      JSON.stringify({
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln',
        refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: fu.auth,
      });
    const fu = mk(false);
    const item = { id: `${realProduct.id}__nc__ns`, product: realProduct, quantity: 1, color: null, size: null };
    const cartJson = JSON.stringify({ state: { items: [item], updatedAt: Date.now() }, version: 0 });
    const storage = { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fu), 'albasse-cart': cartJson };
    const mkOrder = (id, status, gift, total, items) => ({
      id, user_id: uid, items, total, status, payment_method: 'airtel_money', payment_reference: null, shipping_name: 'Aminata Hassan', shipping_phone: '66123456',
      shipping_address: 'Quartier Farcha', shipping_city: 'Moundou', session_id: null, referrer_source: null, is_flagged_fake: false, gift_wrap: gift, created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    });
    const oi = (name, price, qty = 1) => ({ product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', product_name: name, product_image: null, unit_price: price, quantity: qty, color: null, size: null });

    // --- chat d'un client connecte
    {
      const c = await newVisitor(phone, { storage, fakeUser: fu });
      await c.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(3500);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Aminata'));
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      const labels = await chipLabels(c.page);
      check('client connecte : pas d\'invitation a creer un compte ; panier et commandes proposes', !labels.some((l) => /Créer mon compte/.test(l)) && labels.includes('🛒 Mon panier') && labels.includes('📦 Mes commandes'), labels);
      await c.page.screenshot({ path: path.join(OUT, 'C1-connecte.png') });
      check('aucune erreur (client connecte)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- page de commande : paiement a la livraison seulement a N'Djamena + emballage cadeau
    {
      const c = await newVisitor(phone, { storage, fakeUser: fu });
      const { page } = c;
      await page.goto(`http://localhost:${port}/commande`, { waitUntil: 'load' });
      await sleep(3500);
      const cod = page.getByRole('radio', { name: /Paiement à la livraison/ });
      const airtel = page.getByRole('radio', { name: /Airtel Money/ });
      check('commande : 3 modes de paiement', (await page.getByRole('radio').count()) === 3);
      check('commande : sans ville choisie, le paiement a la livraison est grise', (await cod.getAttribute('aria-disabled')) === 'true');
      const cityInput = page.getByPlaceholder('📍 Rechercher une ville...');
      const pickCity = async (name) => {
        await cityInput.click();
        await cityInput.fill(name);
        await sleep(300);
        await page.getByText(name, { exact: true }).first().click();
        await sleep(500);
      };
      await pickCity('Moundou');
      check('Moundou : paiement a la livraison grise avec « Seulement a N\'Djamena »', (await cod.getAttribute('aria-disabled')) === 'true' && (await page.getByText("Seulement à N'Djamena", { exact: true }).count()) === 1);
      check('Moundou : le numero Airtel Money (paiement a l\'avance) est affiche', (await page.getByText('Numéro : 60 60 51 51').count()) === 1);
      check('la regle de paiement est ecrite sur la page', (await page.getByText(/Paiement à la livraison : seulement à N'Djamena\. Dans les autres villes, le paiement se fait à l'avance/).count()) === 1);
      await page.getByRole('radio', { name: /Moov Money/ }).click();
      check('Moundou : Moov Money choisi, son numero est affiche', (await page.getByText('Numéro : 99 22 10 17').count()) === 1);
      await page.screenshot({ path: path.join(OUT, 'C2-commande-moundou.png') });
      await pickCity("N'Djamena");
      check("N'Djamena : le paiement a la livraison est possible", (await cod.getAttribute('aria-disabled')) !== 'true');
      await cod.click();
      check("N'Djamena : paiement a la livraison choisi (plus de numero Mobile Money)", (await page.getByText(/^Numéro : /).count()) === 0);
      // retour a une autre ville : le mode bascule tout seul vers Airtel Money
      await pickCity('Sarh');
      check('autre ville apres N\'Djamena : le mode passe a Airtel Money automatiquement', (await cod.getAttribute('aria-disabled')) === 'true' && (await page.getByText('Numéro : 60 60 51 51').count()) === 1);

      // emballage cadeau : image cadeau cliquable, +2 000 FCFA au total
      const totalOf = async () => num(await page.evaluate(() => {
        const row = [...document.querySelectorAll('div')].find((el) => el.children.length === 2 && el.children[0].textContent.trim() === 'Total');
        return row ? row.children[1].textContent : '';
      }));
      const gift = page.getByTestId('gift-wrap-option');
      check('emballage cadeau : la carte avec l\'image cadeau est la, non cochee', (await gift.count()) === 1 && (await gift.getAttribute('aria-checked')) === 'false');
      const imgOk = await gift.locator('img').first().evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
      check('l\'image cadeau s\'affiche', imgOk);
      check('texte : Emballage cadeau, + 2 000 FCFA', /Emballage cadeau/.test(await gift.innerText()) && /\+\s?2\s?000 FCFA/.test(await gift.innerText()), await gift.innerText());
      const t0 = await totalOf();
      await gift.click();
      await sleep(300);
      const t1 = await totalOf();
      check('toucher l\'image cadeau : cochee, ligne « Emballage cadeau » et total + 2 000 FCFA', (await gift.getAttribute('aria-checked')) === 'true' && t1 === t0 + 2000 && (await page.getByText('🎁 Emballage cadeau', { exact: true }).count()) === 1, { t0, t1 });
      await page.screenshot({ path: path.join(OUT, 'C3-commande-cadeau.png') });
      await gift.click();
      await sleep(300);
      check('toucher une 2e fois : l\'emballage est retire, total d\'origine', (await totalOf()) === t0 && (await gift.getAttribute('aria-checked')) === 'false');
      check('commande : horaires de livraison et 48 h', (await page.getByText(/Nos services de livraison sont ouverts de 8h30 à 16h/).count()) === 1 && (await page.getByText(/chaque commande est valable 48 h/).count()) >= 1);
      check('aucune ecriture reelle depuis la page de commande', c.writes.every((w) => !/\/orders/.test(w)), c.writes);
      check('aucune erreur (page de commande)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- Mes commandes : image cadeau a cote de chaque commande en attente
    {
      const A = mkOrder('aaaaaaaa-0000-4000-8000-000000000001', 'pending', false, 27500, [oi('Rolex', 12500, 1), oi('Parfum Khamrah', 15000, 1)]);
      const B = mkOrder('bbbbbbbb-0000-4000-8000-000000000002', 'pending', true, 14500, [oi('Sag a main', 12500, 1)]);
      const C = mkOrder('cccccccc-0000-4000-8000-000000000003', 'delivered', false, 9000, [oi('Montre', 9000, 1)]);
      const D = mkOrder('dddddddd-0000-4000-8000-000000000004', 'delivered', true, 17000, [oi('Lunettes', 15000, 1)]);
      const fakeOrders = { list: [A, B, C, D], patches: [] };
      const c = await newVisitor(phone, { storage, fakeUser: fu, fakeOrders });
      const { page } = c;
      await page.goto(`http://localhost:${port}/mes-commandes`, { waitUntil: 'load' });
      await page.getByText('Commande #aaaaaaaa').waitFor({ timeout: 15000 });
      await sleep(800);
      check('Mes commandes : image cadeau « Ajouter » sur la commande en attente sans emballage (une seule)', (await page.getByTestId('order-gift-add').count()) === 1);
      check('Mes commandes : « Emballage cadeau ajouté » sur les commandes emballees (en attente et livree)', (await page.getByTestId('order-gift-on').count()) === 2);
      check('Mes commandes : « Retirer » seulement tant que la commande est en attente', (await page.getByRole('button', { name: "Retirer l'emballage cadeau" }).count()) === 1);
      const imgOk2 = await page.getByTestId('order-gift-add').locator('img').first().evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
      check('l\'image cadeau s\'affiche sur la commande', imgOk2);
      await page.getByTestId('order-gift-add').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, 'C4-mes-commandes.png') });
      await page.getByTestId('order-gift-add').click();
      await page.getByText("Ajouter l'emballage cadeau ?").waitFor({ timeout: 5000 });
      const msg = await page.getByText(/Votre commande sera emballée pour/).innerText();
      check('confirmation : 2 000 FCFA, le total passe de 27 500 a 29 500', /2\s?000 FCFA/.test(msg) && /29\s?500 FCFA/.test(msg), msg);
      await page.screenshot({ path: path.join(OUT, 'C5-confirmer-cadeau.png') });
      await page.getByText('Ajouter', { exact: true }).click();
      await sleep(1500);
      const p1 = fakeOrders.patches[0];
      check('ajout : la commande est mise a jour (gift_wrap vrai, total + 2 000)', p1 && p1.id === A.id && p1.body.gift_wrap === true && p1.body.total === 29500, p1);
      check('apres l\'ajout : plus de bouton « Ajouter », 3 commandes emballees', (await page.getByTestId('order-gift-add').count()) === 0 && (await page.getByTestId('order-gift-on').count()) === 3);
      // retirer l'emballage de B
      // la commande A vient d'etre emballee : le 2e bouton « Retirer » est celui de la commande B
      await page.getByRole('button', { name: "Retirer l'emballage cadeau" }).nth(1).click();
      await page.getByText("Retirer l'emballage cadeau ?").waitFor({ timeout: 5000 });
      await page.getByText('Retirer', { exact: true }).last().click();
      await sleep(1500);
      const pB = fakeOrders.patches.find((p) => p.id === B.id);
      check('retrait : gift_wrap faux et total - 2 000', pB && pB.body.gift_wrap === false && pB.body.total === 12500, pB);
      // retirer un article d'une commande emballee : le total garde les 2 000 FCFA
      const removeBtn = page.getByText('✕', { exact: true }).first();
      await removeBtn.click();
      await page.getByText('Retirer cet article ?').waitFor({ timeout: 5000 });
      await page.getByText('Retirer', { exact: true }).last().click();
      await sleep(1500);
      const pA = fakeOrders.patches.find((p) => p.id === A.id && p.body.items);
      check('retirer un article d\'une commande emballee : le total garde l\'emballage (15 000 + 2 000)', pA && pA.body.total === 17000, pA);
      check('aucune erreur (Mes commandes)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- page d'administration : badge pour l'equipe
    {
      const fa = mk(true);
      const A = mkOrder('eeeeeeee-0000-4000-8000-000000000005', 'pending', true, 14500, [oi('Sag a main', 12500, 1)]);
      const B = mkOrder('ffffffff-0000-4000-8000-000000000006', 'pending', false, 9000, [oi('Montre', 9000, 1)]);
      const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeOrders: { list: [A, B], patches: [] } });
      await c.page.goto(`http://localhost:${port}/admin/commandes`, { waitUntil: 'load' });
      await c.page.getByText('#eeeeeeee').waitFor({ timeout: 15000 });
      await sleep(600);
      check('admin : « À emballer » sur la commande avec emballage cadeau seulement', (await c.page.getByText(/🎁 À emballer : emballage cadeau/).count()) === 1);
      await c.page.screenshot({ path: path.join(OUT, 'C6-admin.png') });
      check('aucune erreur (admin)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
  }

  // =============================================== D. PANNE ===============================================
  if (PARTS.includes('D')) {
    console.log('\n== D. panne : les villes ne se chargent pas');
    const f = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' }, blockPath: '/rest/v1/cities' });
    await f.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await sleep(2500);
    await f.page.getByRole('button', { name: FAB_NAME }).click();
    await waitText(f.page, /Créez votre compte gratuit(?:, Ali)?/);
    const t0 = Date.now();
    await typeIn(f.page, 'livraison');
    await waitText(f.page, /Dans quelle ville souhaitez-vous être livré/, 25000);
    check('panne : elle repond quand meme en moins de 12 s', Date.now() - t0 < 12000, Date.now() - t0 + ' ms');
    check("panne : seul N'Djamena est propose", (await chipLabels(f.page)).join('|') === "N'Djamena", await chipLabels(f.page));
    await typeIn(f.page, 'Moundou');
    await waitText(f.page, /Je n’arrive pas à charger ces informations/, 25000);
    check('panne : message poli + WhatsApp, la saisie reste utilisable', (await chipLabels(f.page)).join('|') === '💬 WhatsApp|🏠 Menu' && (await f.page.getByLabel('Votre message').isEnabled()));
    await typeIn(f.page, 'ndjamena');
    await waitText(f.page, /vous payez à la livraison/, 25000);
    await waitText(f.page, /Nos services de livraison sont ouverts de 8h30 à 16h/, 25000);
    check("panne : N'Djamena repond quand meme (gratuit, paiement a la livraison, horaires)", true);
    check('aucune erreur de page (panne)', f.errs.length === 0, f.errs);
    await f.ctx.close();
  }

  // =============================================== E. CLAVIER, PRODUIT, ADMIN, ORDINATEUR ===============================================
  if (PARTS.includes('E')) {
    console.log('\n== E. clavier, fiche produit, admin, ordinateur');
    {
      const k = await newVisitor({ ...devices['Pixel 7'], viewport: { width: 390, height: 800 } }, { storage: { albasse_zara_name: 'Ali' } });
      await k.ctx.addInitScript(() => {
        const vv = Object.assign(new EventTarget(), { height: 800, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
        Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
        window.__vv = vv;
      });
      await k.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      const fabHome = await k.page.getByRole('button', { name: FAB_NAME }).boundingBox();
      await k.page.getByRole('button', { name: FAB_NAME }).click();
      await sleep(600);
      const full = await panelOf(k.page).boundingBox();
      check('sans clavier : la fenetre occupe toute la hauteur', Math.round(full.height) === 800, full);
      await k.page.evaluate(() => { window.__vv.height = 430; window.__vv.offsetTop = 0; window.__vv.dispatchEvent(new Event('resize')); });
      await sleep(400);
      const small = await panelOf(k.page).boundingBox();
      const inputBox = await k.page.getByLabel('Votre message').boundingBox();
      check('clavier ouvert (zone visible de 430 px) : la fenetre se reduit, la saisie reste visible', Math.round(small.height) === 430 && Math.round(small.y) === 0 && inputBox.y + inputBox.height <= 430, { small, inputBox });
      await k.page.evaluate(() => { window.__vv.height = 800; window.__vv.dispatchEvent(new Event('resize')); });
      await sleep(300);
      await k.page.getByRole('button', { name: 'Fermer' }).click();
      await sleep(300);
      await k.page.goto(`http://localhost:${port}/produit/rolex`, { waitUntil: 'load' });
      await sleep(3500);
      const fabProduct = await k.page.getByRole('button', { name: FAB_NAME }).boundingBox();
      const vpK = k.page.viewportSize();
      check('sur la fiche produit (pas de barre du bas) le bouton est remonte au-dessus de la barre « Commander » : coin en bas a droite, 144 px du bas', Math.round(vpK.height - (fabProduct.y + fabProduct.height)) === 144 && Math.round(vpK.width - 14 - (fabProduct.x + fabProduct.width)) === 0, { accueil: Math.round(fabHome.y), produit: Math.round(fabProduct.y), vpK });
      check('aucune erreur (clavier / produit)', k.errs.length === 0, k.errs);
      await k.ctx.close();
    }
    {
      const a = await newVisitor({ ...devices['Pixel 7'], viewport: { width: 390, height: 800 } });
      await a.page.goto(`http://localhost:${port}/admin/tableau-de-bord`, { waitUntil: 'load' });
      await sleep(6500);
      check('le bouton de Zara est cache sur les pages d\'administration', (await a.page.getByRole('button', { name: FAB_NAME }).count()) === 0);
      await a.ctx.close();
    }
    {
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { storage: { albasse_zara_name: 'Ali' } });
      await d.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await d.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(d.page, /Créez votre compte gratuit(?:, Ali)?/);
      const panel = await d.page.evaluate(() => {
        const close = document.querySelector('[aria-label="Fermer"]');
        let el = close;
        while (el && !(getComputedStyle(el).position === 'absolute' && el.getBoundingClientRect().width > 300 && el.getBoundingClientRect().width < 700)) el = el.parentElement;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      });
      check('ordinateur : carte de 400 px en bas a droite (pas plein ecran)', panel.w === 400 && panel.x + panel.w <= 1280 && panel.y + panel.h <= 800 && panel.x > 800, panel);
      await chip(d.page, 'Promotions').click();
      await waitText(d.page, /meilleures promotions du moment/);
      await sleep(1500);
      await d.page.screenshot({ path: path.join(OUT, 'E1-ordinateur.png') });
      await cardsOf(d.page).first().click();
      await sleep(1500);
      check('ordinateur : la fenetre reste ouverte quand on ouvre un produit', (await d.page.getByText('Assistante marketing', { exact: true }).count()) === 1 && d.page.url().includes('/produit/'));
      check('aucune erreur (ordinateur)', d.errs.length === 0, d.errs);
      await d.ctx.close();
    }
  }

  await b.close();
  server.kill('SIGKILL');
  console.log('\n' + (ok ? 'TOUT EST BON' : 'IL Y A DES ECHECS'));
})().catch((e) => {
  console.error('ERREUR DU TEST', e);
  process.exit(1);
});
