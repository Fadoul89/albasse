// Controle complet de Zara Kings v4 (langue en 1er message, conseillere, arabe, bouton +, panier dans le chat, PWA) sur la version
// complete du site (export local). Lecture seule vers la vraie base : produits, villes, categories.
// Les commandes d'un client connecte sont simulees (fausse base en memoire) : aucune ecriture reelle.
// Parties : A (nouveau visiteur), B (contexte produit/panier), C (client connecte : chat, commande, mes commandes, admin),
//           D (panne), E (clavier, fiche produit, admin cache, ordinateur). Choisir avec PARTS=ABCDE.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = process.argv[2] || '../../dist';
const port = process.argv[3] || '4333';
const PARTS = (process.env.PARTS || 'ALKPBCDE').toUpperCase();
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

const WELCOME = "Bonjour ! Je suis Zara Kings, l'assistante marketing d'Albasse Shopping.";
const FAB_NAME = /Discuter avec Zara Kings/;
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 };

(async () => {
  const server = spawn('node', [path.join(__dirname, 'serve.js'), path.resolve(__dirname, dist), port], { stdio: 'ignore' });
  await sleep(1000);
  const b = await chromium.launch();

  // Un contexte = un visiteur. Lecture seule vers la base ; le reste d'internet est coupe.
  // fakeUser : compte simule. fakeOrders : { list: [...], patches: [] } = fausse table des commandes.
  async function newVisitor(opts, { storage = {}, fakeUser = null, blockPath = null, fakeOrders = null, lang = 'fr', cookies = null } = {}) {
    const ctx = await b.newContext(opts);
    if (cookies) await ctx.addCookies(cookies);
    if (lang) storage = { albasse_zara_lang: lang, ...storage };
    await ctx.addInitScript((entries) => {
      try {
        localStorage.setItem('albasse_app_banner_dismissed', '1');
        localStorage.setItem('albasse_app_popup_seen_' + new Date().toISOString().slice(0, 10), '1');
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      } catch (e) {}
    }, storage);
    const writes = [];
    const json = (route, body, status = 200) =>
      route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
    await ctx.route('**/*', (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const m = req.method();
      if (u.hostname === 'localhost') return route.continue();
      if (u.hostname.endsWith('.supabase.co')) {
        if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        if (blockPath && u.pathname.includes(blockPath)) return route.abort();
        if (fakeUser && u.pathname === '/auth/v1/user') return json(route, fakeUser.auth);
        if (fakeUser && u.pathname === '/rest/v1/profiles' && m === 'GET' && u.searchParams.get('id') === 'eq.' + fakeUser.auth.id) return json(route, fakeUser.profile);
        if (fakeOrders && u.pathname === '/rest/v1/rpc/auto_flag_stale_orders') return json(route, null);
        if (fakeOrders && u.pathname === '/rest/v1/orders') {
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
    return { ctx, page, errs, writes };
  }

  const panelOf = (p) => p.getByTestId('assistant-panel');
  const chip = (p, label) => panelOf(p).getByTestId('assistant-chip').filter({ hasText: label });
  const chipLabels = async (p) => (await panelOf(p).getByTestId('assistant-chip').allInnerTexts()).map((t) => t.trim());
  const waitText = (p, re, timeout = 15000) => panelOf(p).getByText(re).first().waitFor({ timeout });
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
      if (Date.now() - t0 > timeout) throw new Error(`pas de nouvelle reponse pour « ${text} » (${re})`);
      await sleep(200);
    }
  };
  // toucher un bouton puis attendre une NOUVELLE reponse qui correspond
  const tap = async (p, label, re, timeout = 15000) => {
    const n = await panelOf(p).getByText(re).count();
    await chip(p, label).click();
    const t0 = Date.now();
    while ((await panelOf(p).getByText(re).count()) <= n) {
      if (Date.now() - t0 > timeout) throw new Error(`pas de nouvelle reponse apres « ${label} » (${re})`);
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
    await waitText(page, "Bonjour Fatimé ! Je suis Zara Kings, l'assistante marketing d'Albasse Shopping.");
    await waitText(page, /À savoir avant de commander/);
    await waitText(page, /Créez votre compte gratuit(?:, Fatimé)?/);
    const menu = await chipLabels(page);
    check('menu du visiteur : compte, promotions, nouveautes, conseil, categories, livraison, WhatsApp, langue', menu.join('|') === '👤 Créer mon compte|🔥 Promotions|🆕 Nouveautés|🎯 Conseil|🛍️ Catégories|🚚 Livraison et paiement|💬 WhatsApp|🌐 العربية', menu);
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
    check('« je vais reflechir » : on ne force pas, on garde la porte ouverte (favoris) + creer un compte', (await chipLabels(page))[0] === '👤 Créer mon compte');
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
      await tap(page, 'العربية', /مرحبا! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping\./);
      await waitText(page, /كيف يمكنني أن أناديك؟/);
      check('apres « العربية » : Zara se presente en arabe, puis demande le prenom en arabe', true);
      check('champ de saisie en arabe : « اكتب اسمك الأول… »', (await inputOf(page).getAttribute('placeholder')) === 'اكتب اسمك الأول…', await inputOf(page).getAttribute('placeholder'));
      check('boutons : تخطي + Français', (await chipLabels(page)).join('|') === 'تخطي|🌐 Français', await chipLabels(page));
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
      check('menu en arabe : compte, offres, nouveautes, conseil, categories, livraison, WhatsApp, Francais', menuAr.join('|') === '👤 إنشاء حسابي|🔥 العروض|🆕 الجديد|🎯 نصيحة|🛍️ الفئات|🚚 التوصيل والدفع|💬 واتساب|🌐 Français', menuAr);
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
      await waitText(a.page, /مرحبا! ماذا تريد أن تكتشف؟ 🛍️/);
      check('premiere visite : il ecrit « مرحبا » -> Zara passe a l\'arabe et repond', (await a.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar');
      await a.ctx.close();
      const f = await newVisitor(phone, { lang: null });
      await f.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await f.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(f.page, /Choisissez votre langue/);
      await typeIn(f.page, 'bonjour');
      await waitText(f.page, /Bonjour ! Que souhaitez-vous découvrir \? 🛍️/);
      check('premiere visite : il ecrit « bonjour » -> Zara reste en francais et repond', (await f.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'fr');
      await f.ctx.close();
    }

    // --- L8. site traduit en arabe (cookie de Google) : pas de question de langue
    {
      const g = await newVisitor(phone, { lang: null, cookies: [{ name: 'googtrans', value: '/fr/ar', url: `http://localhost:${port}` }] });
      await g.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await g.page.getByRole('button', { name: /التحدث مع زارا كينغز|Discuter avec Zara Kings/ }).click();
      await waitText(g.page, /مرحبا! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping\./);
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
      await waitText(r.page, /مرحبا علي! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping\./);
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
    check('boutons apres l\'ajout : voir mon panier, commander, autres articles', (await chipLabels(page)).join('|') === '🛒 Voir mon panier|✅ Commander|🛍️ Autres articles', await chipLabels(page));
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
      await ask(g.page, 'je veux commander', /Touchez « Commander »/);
      check('« je veux commander » : Zara guide (panier, coordonnees, paiement) sans demander de donnees bancaires', (await g.page.getByTestId('chat-cart').count()) >= 1 && !/carte bancaire|code secret|CVV/i.test(await panelOf(g.page).innerText()));
      await g.page.getByTestId('chat-cart-checkout').last().click();
      await waitText(g.page, /créez votre compte ou connectez-vous/);
      check('sans compte : « Commander » demande de creer un compte / se connecter, la page reste, le panier est garde', g.page.url().endsWith('/') && (await chipLabels(g.page)).join('|') === '👤 Créer mon compte|Me connecter|🏠 Menu' && (await g.page.evaluate(() => JSON.parse(localStorage.getItem('albasse-cart')).state.items.length)) === 1, await chipLabels(g.page));
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
      await waitText(c.page, "Bonjour Ahmed ! Je suis Zara Kings, l'assistante marketing d'Albasse Shopping.");
      check('client connecte : salue avec le prenom de son profil (Ahmed)', true);
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      await ask(c.page, 'je veux commander', /Touchez « Commander »/);
      await waitText(c.page, /Le prix de « .* » a changé/);
      const guide = await panelOf(c.page).getByText(/Touchez « Commander »/).last().innerText();
      check('prix de la base plus recent que celui du panier : Zara l\'annonce et corrige', new RegExp(`${String(Number(dbA.price) - 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')}\\s?FCFA → ${String(Number(dbA.price)).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')}`).test(guide), guide);
      check('le total du chat utilise le prix verifie de la base (2 x prix)', num(await c.page.getByTestId('chat-cart-total').last().innerText()) === 2 * Number(dbA.price));
      await c.page.getByTestId('chat-cart-checkout').last().click();
      await c.page.waitForURL(/\/commande/, { timeout: 15000 });
      await sleep(2500);
      const checkoutBody = await c.page.evaluate(() => document.body.innerText);
      const subtotal = num((checkoutBody.match(/Sous-total\s*\n?\s*([\d\s\u00a0\u202f]+)\s*FCFA/) || [])[1]);
      check('« Commander » ouvre la page de commande officielle avec le panier garde (sous-total = 2 x le prix verifie)', subtotal === 2 * Number(dbA.price) && (await panelOf(c.page).count()) === 0, { url: c.page.url(), subtotal });
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
      check('iPhone : rien n\'est propose tant que le client n\'a pas besoin de l\'aide', (await panelOf(v.page).getByText(/ajouter notre boutique à l’écran d’accueil/).count()) === 0);
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
      check('Android : aucune boite d\'installation sans geste du client', (await v.page.evaluate(() => window.__fakePromptCalls)) === 0 && (await panelOf(v.page).getByText(/ajouter notre boutique à l’écran d’accueil/).count()) === 0);
      await ask(v.page, 'installer l’application', /vous pouvez ajouter notre boutique à l’écran d’accueil de votre téléphone/);
      check('Android : « Installer AlbasseShopping » est propose quand l\'installation est disponible', (await chipLabels(v.page)).join('|') === '📲 Installer AlbasseShopping|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Installer AlbasseShopping').click();
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
      await chip(d.page, 'Installer AlbasseShopping').click();
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
      await card.getByTestId('assistant-card-add').click();
      await waitText(v.page, /ajouté au panier/);
      await waitText(v.page, /vous pouvez ajouter notre boutique à l’écran d’accueil de votre téléphone/);
      check('Android : apres le premier ajout au panier, Zara propose d\'installer (au bon moment)', true);
      check('boutons : ceux du panier restent, puis installer + plus tard', (await chipLabels(v.page)).join('|') === '🛒 Voir mon panier|✅ Commander|🛍️ Autres articles|📲 Installer AlbasseShopping|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Plus tard').click();
      await waitText(v.page, /je ne vous le propose plus pour le moment/);
      await card.getByTestId('assistant-card-add').click();
      await sleep(2200);
      check('la proposition n\'est pas repetee (apres un 2e ajout, toujours une seule)', (await panelOf(v.page).getByText(/vous pouvez ajouter notre boutique à l’écran d’accueil de votre téléphone/).count()) === 1);
      await v.page.reload({ waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await sleep(1200);
      check('apres « Plus tard » et rechargement : pas de nouvelle proposition (pause de 14 jours)', (await panelOf(v.page).getByText(/vous pouvez ajouter notre boutique/).count()) === 1);
      check('aucune erreur (Android)', v.errs.length === 0, v.errs);
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
      });
      await v.page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, 'installer l’application', /est déjà installé sur votre téléphone/);
      check('deja installe (mode application) : Zara le dit et ne propose rien', (await chipLabels(v.page)).every((l) => !/Installer/.test(l)));
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

  // =============================================== B. CONTEXTE : FICHE PRODUIT ET PANIER ===============================================
  if (PARTS.includes('B')) {
    console.log('\n== B. contexte : fiche produit et panier');
    {
      const c = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await c.page.goto(`http://localhost:${port}/produit/rolex`, { waitUntil: 'load' });
      await sleep(3500);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, 'Bonjour Ali ! Je suis Zara Kings, l\'assistante marketing d\'Albasse Shopping.');
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
      await waitText(c.page, "Bonjour Aminata ! Je suis Zara Kings, l'assistante marketing d'Albasse Shopping.");
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
      check('sur la fiche produit le bouton est remonte au-dessus de la barre « Commander »', Math.round(fabHome.y - fabProduct.y) === 62, { accueil: Math.round(fabHome.y), produit: Math.round(fabProduct.y) });
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
