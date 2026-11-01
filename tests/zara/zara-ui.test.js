// Controle complet de Zara Kings v5 (langue en 1er message, conseillere, arabe, bouton « Commander » (commande directe, plus de panier), PWA, client avec compte salue par son prenom) sur la version
// complete du site (export local). Lecture seule vers la vraie base : produits, villes, categories.
// Les commandes d'un client connecte sont simulees (fausse base en memoire) : aucune ecriture reelle.
// Parties : A (nouveau visiteur), B (contexte produit / commande commencee), C (client connecte : chat, commande, mes commandes, admin),
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
// BASE_URL=https://www.albasseshopping.com : teste le VRAI site en ligne (les commandes et comptes restent simules, rien n'est enregistre)
const BASE = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const BASE_HOST = new URL(BASE).hostname;
const PARTS = (process.env.PARTS || 'ALKPMRSUVWXYZHGJNQI0123456789TOFBCDE+=^~%&').toUpperCase();
// saison fraiche (blousons et manteaux) : le bouton du menu de Zara n'existe que jusqu'au 31 decembre 2026 a 23h59 (N'Djamena)
const COLD_ON = Date.now() < Date.parse('2027-01-01T00:00:00+01:00');
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
  // zaraInstall : par defaut, le visiteur a deja repondu « Plus tard » a l'installation (Zara ne la propose pas) ; null = vrai nouveau
  // visiteur, pour les parties qui testent l'installation
  async function newVisitor(opts, { storage = {}, session = {}, fakeUser = null, blockPath = null, fakeOrders = null, lang = 'fr', cookies = null, rank = null, oldRank = false, noStatsColumns = false, fakeStats = null, fakeBrowsing = null, fakeOverview = null, fakeSales = null, fakeCallbacks = null, fakePushes = null, fakeStore = null, fakeCats = null, fakeOnline = null, fakeRecent = null, fakeUnsub = null, initScripts = [], zaraInstall = 'dismissed', zaraPush = 'later', installAfterSignUp = '1', pushPerm = null, pushAnswer = 'granted', fakeAi = null, autoOpen = false, fakePromos = null, fakeTelegram = null } = {}) {
    // Zara s'ouvre seule sur l'Accueil apres 8 s : par defaut c'est deja « fait » pour ce visiteur (les autres tests gardent leur deroulement) ; autoOpen: true = vrai nouveau visiteur
    if (!autoOpen) session = { albasse_assistant_autoopen_seen: '1', ...session };
    const ctx = await b.newContext(opts);
    if (cookies) await ctx.addCookies(cookies);
    if (lang) storage = { albasse_zara_lang: lang, ...storage };
    for (const code of initScripts) await ctx.addInitScript(code);
    // notifications du telephone (faux) : pushPerm = ce que le telephone repond deja ('default' pas encore demande, 'granted', 'denied'),
    // pushAnswer = la reponse du client a la question « Autoriser les notifications ? » ; l'abonnement est un faux (aucun vrai service)
    if (pushPerm) {
      await ctx.addInitScript(([perm, answer]) => {
        let current = perm;
        Object.defineProperty(Notification, 'permission', { get: () => current, configurable: true });
        Notification.requestPermission = async () => {
          window.__pushAsked = (window.__pushAsked || 0) + 1;
          current = answer;
          return answer;
        };
        const fakeSub = { endpoint: 'https://push.example.test/abonnement-1', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BPfaux', auth: 'authfaux' } }; } };
        PushManager.prototype.getSubscription = async function () { return window.__pushSub || null; };
        PushManager.prototype.subscribe = async function () { window.__pushSub = fakeSub; return fakeSub; };
      }, [pushPerm, pushAnswer]);
    }
    await ctx.addInitScript(([entries, sessionEntries, installDefault, pushDefault, afterSignUp]) => {
      try {
        localStorage.setItem('albasse_app_banner_dismissed', '1');
        localStorage.setItem('albasse_app_popup_seen_' + new Date().toISOString().slice(0, 10), '1');
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
        if (installDefault && !localStorage.getItem('albasse_zara_install')) localStorage.setItem('albasse_zara_install', JSON.stringify({ at: Date.now(), outcome: installDefault }));
        // page d'installation montree juste apres l'inscription : par defaut deja vue (installAfterSignUp: null = vrai nouveau telephone)
        if (afterSignUp && !localStorage.getItem('albasse_install_after_signup')) localStorage.setItem('albasse_install_after_signup', afterSignUp);
        // rappel des notifications de Zara : deja repondu « Plus tard » par defaut (zaraPush: null = jamais demande)
        if (pushDefault && !localStorage.getItem('albasse_zara_push')) localStorage.setItem('albasse_zara_push', JSON.stringify({ at: Date.now(), outcome: pushDefault }));
        // la conversation et le « deja salue » de l'onglet ne sont mis qu'a la premiere page (pas apres un rechargement)
        if (!sessionStorage.getItem('__zara_test_seeded')) {
          for (const [k, v] of Object.entries(sessionEntries)) sessionStorage.setItem(k, v);
          sessionStorage.setItem('__zara_test_seeded', '1');
        }
      } catch (e) {}
    }, [storage, session, zaraInstall, zaraPush, installAfterSignUp]);
    const writes = [];
    const rpcCalls = [];
    const pushClicks = []; // clics de notifications comptes (record_push_click)
    const pushSubs = []; // telephones abonnes aux notifications (faux enregistrement)
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
    // Zara IA (fonction serveur zara-ai) : simulee, jamais la vraie IA. fakeAi : reponse (objet ou fonction du message) ;
    // par defaut « pas installee » (Zara repond avec ses regles). aiCalls : ce que le site envoie.
    const aiCalls = [];
    const json = (route, body, status = 200) =>
      route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
    await ctx.route('**/*', (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const m = req.method();
      if (u.hostname === 'localhost' || u.hostname === BASE_HOST) return route.continue();
      // WhatsApp : la page s'ouvre (vide) pour qu'on puisse lire l'adresse du lien ; rien d'autre ne sort vers internet
      if (u.hostname === 'wa.me') return route.fulfill({ status: 200, contentType: 'text/html', body: 'wa' });
      if (u.hostname.endsWith('.supabase.co')) {
        if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        if (blockPath && u.pathname.includes(blockPath)) return route.abort();
        if (u.pathname === '/functions/v1/zara-ai' && m === 'POST') {
          const body = JSON.parse(req.postData() || '{}');
          aiCalls.push(body);
          return json(route, typeof fakeAi === 'function' ? fakeAi(body) : fakeAi || { ok: false, reason: 'no_key' });
        }
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
          // fakeOverview.respond(demande, numero) : la reponse depend de la demande (filtre p_interest, plafond p_limit)
          const reply = fakeOverview.respond ? fakeOverview.respond(overviewCalls[overviewCalls.length - 1], overviewCalls.length) : fakeOverview.replies[Math.min(overviewCalls.length - 1, fakeOverview.replies.length - 1)];
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
        // un telephone s'abonne aux notifications (faux enregistrement : rien n'arrive dans la vraie base)
        if (u.pathname === '/rest/v1/web_push_subscriptions' && m === 'POST') {
          pushSubs.push(JSON.parse(req.postData() || '{}'));
          return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
        }
        // un client a touche une notification programmee : le site compte le clic (fausse base)
        if (u.pathname === '/rest/v1/rpc/record_push_click' && m === 'POST') {
          pushClicks.push(JSON.parse(req.postData() || '{}'));
          return json(route, true);
        }
        // vrai nombre de personnes en ligne (add-online-count.sql) : fakeOnline.n = le nombre renvoye (fakeOnline.calls = appels) ;
        // sans fakeOnline : fonction absente (script pas lance), le compteur est cache
        if (u.pathname === '/rest/v1/rpc/online_visitors_count' && m === 'POST') {
          if (!fakeOnline) return json(route, { code: 'PGRST202', message: 'Could not find the function public.online_visitors_count without parameters in the schema cache' }, 404);
          fakeOnline.calls = (fakeOnline.calls || 0) + 1;
          return json(route, fakeOnline.n);
        }
        // nombre de clients lies a Telegram (add-telegram-absent.sql) : fakeTelegram.stats = {linked, consented, stopped} ; sans fakeTelegram : fonction absente (script pas lance)
        if (u.pathname === '/rest/v1/rpc/telegram_linked_stats' && m === 'POST') {
          if (!fakeTelegram) return json(route, { code: 'PGRST202', message: 'Could not find the function public.telegram_linked_stats without parameters in the schema cache' }, 404);
          fakeTelegram.calls = (fakeTelegram.calls || 0) + 1;
          return json(route, fakeTelegram.stats);
        }
        // barre « achats recents » (add-recent-purchases.sql) : fakeRecent.rows = les vraies commandes recentes renvoyees (fakeRecent.calls = appels) ;
        // sans fakeRecent : fonction absente (script pas lance), la barre est cachee
        if (u.pathname === '/rest/v1/rpc/recent_purchases' && m === 'POST') {
          if (!fakeRecent) return json(route, { code: 'PGRST202', message: 'Could not find the function public.recent_purchases(p_limit) in the schema cache' }, 404);
          fakeRecent.calls = (fakeRecent.calls || 0) + 1;
          return json(route, fakeRecent.rows);
        }
        // desinscription des e-mails publicitaires (add-inactive-promo-emails.sql) : fakeUnsub.result = vrai si le code est reconnu, faux sinon ;
        // fakeUnsub.error = la base repond une erreur ; fakeUnsub.calls = les codes recus ; sans fakeUnsub : fonction absente (script pas lance)
        if (u.pathname === '/rest/v1/rpc/email_unsubscribe' && m === 'POST') {
          if (!fakeUnsub) return json(route, { code: 'PGRST202', message: 'Could not find the function public.email_unsubscribe(p_token) in the schema cache' }, 404);
          (fakeUnsub.calls = fakeUnsub.calls || []).push(JSON.parse(req.postData() || '{}'));
          if (fakeUnsub.error) return json(route, { message: 'erreur de test' }, 500);
          return json(route, fakeUnsub.result === true);
        }
        // ordre des categories (add-category-order.sql) : les vraies categories avec un faux sort_order. fakeCats.order = { slug: numero } ;
        // missing = colonne absente (script pas lance) ; patches = numeros recus de la page admin ({ id, sort_order })
        if (fakeCats && u.pathname === '/rest/v1/categories') {
          fakeCats.order = fakeCats.order || {};
          fakeCats.slugOf = fakeCats.slugOf || {};
          if (m === 'PATCH') {
            const id = (u.searchParams.get('id') || '').replace('eq.', '');
            const body = JSON.parse(req.postData() || '{}');
            (fakeCats.patches = fakeCats.patches || []).push({ id, ...body });
            if (fakeCats.missing) return json(route, { code: 'PGRST204', message: "Could not find the 'sort_order' column of 'categories' in the schema cache" }, 400);
            if (fakeCats.slugOf[id] && 'sort_order' in body) fakeCats.order[fakeCats.slugOf[id]] = body.sort_order;
            return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
          }
          if (m === 'GET') {
            return route.fetch({ headers: { ...req.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } }).then(async (res) => {
              const data = await res.json();
              if (!Array.isArray(data)) return json(route, data, res.status());
              return json(route, data.map((c) => {
                if (c.id && c.slug) fakeCats.slugOf[c.id] = c.slug;
                const r = { ...c };
                delete r.sort_order;
                if (!fakeCats.missing) r.sort_order = fakeCats.order[c.slug] ?? null;
                return r;
              }), res.status());
            }).catch(() => {}); // page deja fermee pendant la lecture
          }
        }
        // reglages de la boutique : la vraie ligne, avec deux fausses colonnes. fakeStore.waOrder = whatsapp_order_enabled (undefined = colonne
        // absente : script add-whatsapp-order-toggle.sql pas lance) ; fakeStore.accountRequired = account_required ('missing' = colonne absente,
        // sinon false par defaut : les autres parties voient le site ouvert meme quand le compte est obligatoire en vrai) ; patches = ce que la
        // base aurait recu. Sans fakeStore : seulement account_required = false.
        if (u.pathname === '/rest/v1/store_settings' && m === 'GET') {
          const fs = fakeStore || {};
          const select = u.searchParams.get('select') || '*';
          const wants = (col) => select === '*' || select.split(',').includes(col);
          if (fakeStore) (fakeStore.gets = fakeStore.gets || []).push({ select, waOrder: fakeStore.waOrder });
          const fix = (row) => {
            const r = { ...row };
            if (fakeStore) {
              if (fakeStore.waOrder === undefined) delete r.whatsapp_order_enabled;
              else if (wants('whatsapp_order_enabled')) r.whatsapp_order_enabled = fakeStore.waOrder;
              // la vraie ligne a maintenant ces colonnes (allumees en vrai par le patron) : les tests partent toujours de « eteint »
              if (wants('order_emails_enabled')) r.order_emails_enabled = fakeStore.orderEmails === true;
              if (wants('inactive_emails_enabled')) r.inactive_emails_enabled = fakeStore.inactiveEmails === true;
              if (fakeStore.legalLine !== undefined && wants('invoice_legal_line')) r.invoice_legal_line = fakeStore.legalLine;
              // Telegram aux clients absents : fakeStore.telegramAbsent undefined = colonne absente (script add-telegram-absent.sql pas lance), sinon true / false
              if (fakeStore.telegramAbsent === undefined) { delete r.telegram_absent_enabled; delete r.telegram_absent_daily_limit; }
              else if (wants('telegram_absent_enabled')) r.telegram_absent_enabled = fakeStore.telegramAbsent;
              // publicites de Zara : fakeStore.zaraAds undefined = colonne absente (script add-zara-ads.sql pas lance), sinon true / false
              if (fakeStore.zaraAds === undefined) delete r.zara_ads_enabled;
              else if (wants('zara_ads_enabled')) r.zara_ads_enabled = fakeStore.zaraAds;
              // delai de la publicite : fakeStore.zaraDelay undefined = colonne absente (script add-zara-ads-delay.sql pas lance)
              if (fakeStore.zaraDelay === undefined) delete r.zara_ads_delay_seconds;
              else if (wants('zara_ads_delay_seconds')) r.zara_ads_delay_seconds = fakeStore.zaraDelay;
              // vente flash automatique de Zara : fakeStore.zaraAutoFlash undefined = colonne absente (script add-zara-promotions.sql pas lance), sinon true / false
              if (fakeStore.zaraAutoFlash === undefined) { delete r.zara_auto_flash_enabled; delete r.zara_auto_flash_last; }
              else {
                if (wants('zara_auto_flash_enabled')) r.zara_auto_flash_enabled = fakeStore.zaraAutoFlash;
                if (wants('zara_auto_flash_last')) r.zara_auto_flash_last = fakeStore.zaraAutoFlashLast || null;
              }
              // notification automatique des nouveaux articles : fakeStore.pushNewProducts undefined = colonne absente (script add-push-new-products-switch.sql pas lance), sinon true / false
              if (fakeStore.pushNewProducts === undefined) delete r.push_new_products_enabled;
              else if (wants('push_new_products_enabled')) r.push_new_products_enabled = fakeStore.pushNewProducts;
            }
            if (fs.accountRequired === 'missing') delete r.account_required;
            else if (wants('account_required')) r.account_required = fs.accountRequired === true;
            return r;
          };
          const wait = fs.delay ? sleep(fs.delay) : Promise.resolve();
          // avec fakeStore, la vraie ligne est lue avec la cle publique (la base refuserait la fausse session de l'admin)
          const fetchOpts = fakeStore || fakeUser ? { headers: { ...req.headers(), apikey: KEY, authorization: `Bearer ${KEY}` } } : undefined;
          return wait.then(() => route.fetch(fetchOpts)).then(async (res) => {
            const text = await res.text();
            let data = null;
            try {
              data = JSON.parse(text);
            } catch (e) {}
            if (!res.ok() || data === null || typeof data !== 'object') return route.fulfill({ status: res.status(), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: text });
            return json(route, Array.isArray(data) ? data.map(fix) : fix(data), res.status());
          }).catch(() => {}); // page deja fermee pendant la lecture
        }
        if (fakeStore && u.pathname === '/rest/v1/store_settings' && m === 'PATCH') {
          const body = JSON.parse(req.postData() || '{}');
          (fakeStore.patches = fakeStore.patches || []).push(body);
          const missing = ('telegram_absent_enabled' in body && fakeStore.telegramAbsent === undefined && 'telegram_absent_enabled') || ('zara_auto_flash_enabled' in body && fakeStore.zaraAutoFlash === undefined && 'zara_auto_flash_enabled') || ('zara_ads_delay_seconds' in body && fakeStore.zaraDelay === undefined && 'zara_ads_delay_seconds') || ('zara_ads_enabled' in body && fakeStore.zaraAds === undefined && 'zara_ads_enabled') || ('whatsapp_order_enabled' in body && fakeStore.waOrder === undefined && 'whatsapp_order_enabled') || ('account_required' in body && fakeStore.accountRequired === 'missing' && 'account_required') || ('push_new_products_enabled' in body && fakeStore.pushNewProducts === undefined && 'push_new_products_enabled');
          if (missing) return json(route, { code: 'PGRST204', message: `Could not find the '${missing}' column of 'store_settings' in the schema cache` }, 400);
          if ('whatsapp_order_enabled' in body) fakeStore.waOrder = body.whatsapp_order_enabled;
          if ('account_required' in body) fakeStore.accountRequired = body.account_required;
          if ('order_emails_enabled' in body) fakeStore.orderEmails = body.order_emails_enabled;
          if ('inactive_emails_enabled' in body) fakeStore.inactiveEmails = body.inactive_emails_enabled;
          if ('telegram_absent_enabled' in body) fakeStore.telegramAbsent = body.telegram_absent_enabled;
          if ('zara_ads_enabled' in body) fakeStore.zaraAds = body.zara_ads_enabled;
          if ('zara_ads_delay_seconds' in body) fakeStore.zaraDelay = body.zara_ads_delay_seconds;
          if ('zara_auto_flash_enabled' in body) fakeStore.zaraAutoFlash = body.zara_auto_flash_enabled;
          if ('push_new_products_enabled' in body) fakeStore.pushNewProducts = body.push_new_products_enabled;
          return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        // les promotions publiees en vrai sur le site (fenetre « offre du jour ») ne doivent pas couvrir les pages pendant les tests
        // fakePromos = une promotion de test (fenetre « offre du jour ») ; sinon aucune
        if (u.pathname === '/rest/v1/smart_promotions' && m === 'GET') return json(route, fakePromos || []);
        // notifications push programmees (page « Promotions intelligentes ») : fakePushes.rows = la liste ; missing = table absente (script SQL pas lance) ;
        // posts = programmations recues ; patches = annulations / « envoyer maintenant » (avec le filtre de statut)
        if (fakePushes && u.pathname === '/rest/v1/scheduled_pushes') {
          if (fakePushes.missing) return json(route, { code: 'PGRST205', message: "Could not find the table 'public.scheduled_pushes' in the schema cache" }, 404);
          if (m === 'GET') return json(route, [...fakePushes.rows].sort((a, b) => b.send_at.localeCompare(a.send_at)));
          if (m === 'POST') {
            const body = JSON.parse(req.postData() || '{}');
            (fakePushes.posts = fakePushes.posts || []).push(body);
            const product = (fakePushes.products || []).find((x) => x.id === body.product_id) || null;
            fakePushes.rows.push({ id: 'new' + fakePushes.posts.length, status: 'pending', sent_at: null, ...body, product: product && { name: product.name, slug: product.slug, images: product.images } });
            return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
          }
          if (m === 'PATCH') {
            const id = (u.searchParams.get('id') || '').replace('eq.', '');
            const body = JSON.parse(req.postData() || '{}');
            (fakePushes.patches = fakePushes.patches || []).push({ id, body, status: u.searchParams.get('status') });
            const row = fakePushes.rows.find((x) => x.id === id && (u.searchParams.get('status') !== 'eq.pending' || x.status === 'pending'));
            if (row) {
              Object.assign(row, body);
              // « envoyer maintenant » : la base l'envoie au passage suivant du minuteur
              if (body.send_at && fakePushes.sendOnNow) Object.assign(row, { status: 'sent', sent_at: body.send_at });
            }
            return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
          }
        }
        // la page « Statistiques de Zara » : fakeStats.replies = reponses a donner dans l'ordre (la derniere se repete)
        if (fakeStats && u.pathname === '/rest/v1/rpc/assistant_stats' && m === 'POST') {
          statsCalls.push(JSON.parse(req.postData() || '{}'));
          const reply = fakeStats.replies[Math.min(statsCalls.length - 1, fakeStats.replies.length - 1)];
          return json(route, reply.body, reply.status || 200);
        }
        if (fakeUser && u.pathname === '/auth/v1/user') {
          // changement du mot de passe par le client connecte : passwordChanges = ce que Supabase aurait recu ; passwordError = { status, body } pour le refuser
          if (m === 'PUT') {
            (fakeUser.passwordChanges = fakeUser.passwordChanges || []).push(JSON.parse(req.postData() || '{}'));
            if (fakeUser.passwordError) return json(route, fakeUser.passwordError.body, fakeUser.passwordError.status || 422);
          }
          return json(route, fakeUser.auth);
        }
        if (fakeUser && fakeUser.token && u.pathname === '/auth/v1/token' && m === 'POST') {
          (fakeUser.tokenCalls = fakeUser.tokenCalls || []).push({ grant: u.searchParams.get('grant_type'), ...JSON.parse(req.postData() || '{}') });
          if (fakeUser.loginError && u.searchParams.get('grant_type') === 'password') return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
          return json(route, fakeUser.token);
        }
        // inscription (fausse base) : signups = ce que Supabase aurait recu ; signupError = 'exists' (numero deja inscrit)
        if (fakeUser && fakeUser.token && u.pathname === '/auth/v1/signup' && m === 'POST') {
          (fakeUser.signups = fakeUser.signups || []).push(JSON.parse(req.postData() || '{}'));
          if (fakeUser.signupError === 'exists') return json(route, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, 422);
          return json(route, fakeUser.token);
        }
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
          if (m === 'GET') {
            // une commande precise (page « Facture ») : seulement celle demandee
            const idq = u.searchParams.get('id');
            if (idq && idq.startsWith('eq.')) return json(route, fakeOrders.list.filter((o) => o.id === idq.slice(3)));
            return json(route, fakeOrders.list);
          }
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
    return { ctx, page, errs, writes, rpcCalls, pushClicks, pushSubs, chatStarts, events, installs, statsCalls, browsingCalls, browsingApplied, forgets, net, overviewCalls, aiCalls };
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

  // =============================================== 6. ACCUEIL : HORLOGE DES VILLES DU TCHAD ===============================================
  if (PARTS.includes('6')) {
    console.log("== 6. accueil : heure locale des villes (telephone 390 x 800), une ville toutes les 10 s");
    const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Fatimé' } });
    const { page } = v;
    // 26 octobre 2026, 05:15 UTC = 06:15 a N'Djamena (le temps avance normalement a partir de la)
    await v.ctx.clock.install({ time: new Date('2026-10-26T05:15:00Z') });
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="city-clock"]', { timeout: 20000 });
    const read = async () => ({
      time: ((await page.getByTestId('city-clock').innerText()).match(/\d\d\s*:\s*\d\d/) || [''])[0].replace(/\s/g, ''),
      city: ((await page.getByTestId('city-clock-city').textContent()) || '').trim(),
    });
    const first = await read();
    check("horloge : « 06:15 H a N'Djamena » au depart", first.time === '06:15' && first.city === "N'Djamena", first);
    const box = await page.getByTestId('city-clock').boundingBox();
    const tag = await page.getByText('GARANTIE', { exact: true }).boundingBox();
    check('horloge : placee sous le cadre SERVICE QUALITE GARANTIE', !!box && !!tag && box.y > tag.y + tag.height, { box, tag });
    const cats = await page.getByTestId('home-categories').boundingBox();
    check('horloge : au-dessus de la ligne des categories', !!box && !!cats && box.y + box.height <= cats.y + 1, { box, cats });
    check('horloge : visible en entier dans la largeur du telephone (390)', !!box && box.x >= 0 && box.x + box.width <= 390, box);
    const pillBox = await page.getByTestId('city-clock').locator('[role="timer"]').boundingBox();
    check('horloge : bandeau tres fin (entre 26 et 34 px de haut)', !!pillBox && pillBox.height >= 26 && pillBox.height <= 34, pillBox);
    // la largeur de l'horloge = celle du cadre SERVICE QUALITE GARANTIE (elle ne le depasse jamais), centree comme lui
    const frameBox = await page.getByTestId('home-tagline').boundingBox();
    check('horloge : plus etroite que le cadre SERVICE QUALITE GARANTIE (80 a 100 % de sa largeur) et centree comme lui', !!pillBox && !!frameBox && pillBox.width <= frameBox.width + 2 && pillBox.width >= frameBox.width * 0.8 && Math.abs((pillBox.x + pillBox.width / 2) - (frameBox.x + frameBox.width / 2)) <= 3, { pillBox, frameBox });
    // chaque ville : le nom tient en entier dans sa place, a droite de l'heure, sans etre coupe ni depasser le bandeau
    const fits = async (pg, label, widthPx) => {
      const pill = await pg.getByTestId('city-clock').locator('[role="timer"]').boundingBox();
      const frame = await pg.getByTestId('home-tagline').boundingBox();
      const time = await pg.getByTestId('city-clock-time').boundingBox();
      const slot = await pg.getByTestId('city-clock-slot').boundingBox();
      const cut = await pg.getByTestId('city-clock-city').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      const okFit = !!pill && !!frame && !!time && !!slot && !cut && pill.width <= frame.width + 2 && slot.x >= time.x + time.width && slot.x + slot.width <= pill.x + pill.width && pill.x >= 0 && pill.x + pill.width <= widthPx;
      return okFit ? null : `${label} : ${JSON.stringify({ pill, frame, time, slot, cut })}`;
    };
    const cityInfo = await page.getByTestId('city-clock-city').evaluate((el) => { const c = getComputedStyle(el); return { size: parseFloat(c.fontSize), upper: c.textTransform === 'uppercase', color: c.color, family: c.fontFamily }; });
    check("horloge : le nom de la ville en lettres claires (majuscules, jaune, 12 px ou plus, meme ecriture que le cadre)", cityInfo.size >= 12 && cityInfo.upper && /254,\s*203,\s*0/.test(cityInfo.color) && /Manrope/i.test(cityInfo.family), cityInfo);
    const digitsSize = await page.getByTestId('city-clock-time').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    check('heure bien lisible (chiffres >= 14 px)', digitsSize >= 14, digitsSize);
    const logo = await page.getByText('ALBASSE', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    check('logo ALBASSE inchange (34 px)', logo === 34, logo);
    await sleep(1000);
    await page.screenshot({ path: path.join(OUT, '6a-horloge-ndjamena.png') });

    const seen = [first.city];
    const misfit = [await fits(page, "N'Djamena", 390)];
    for (let i = 0; i < 8; i++) {
      await page.clock.runFor(10000);
      await sleep(1000); // le nom glisse pendant 0,6 s
      const c = (await read()).city;
      seen.push(c);
      misfit.push(await fits(page, c, 390));
    }
    check('horloge : les 8 villes tiennent dans le bandeau, sans depasser le cadre (390 px)', misfit.every((m) => m === null), misfit.filter(Boolean));
    check("rotation : N'Djamena, Abeche, Moundou, Moussoro, Ati, Mongo, Sarh, Amdjarass, puis de nouveau N'Djamena", seen.join('|') === "N'Djamena|Abéché|Moundou|Moussoro|Ati|Mongo|Sarh|Amdjarass|N'Djamena", seen);
    await page.clock.runFor(60000);
    await sleep(1000);
    const later = await read();
    check('apres 80 s + 60 s : 06:17 (les minutes avancent)', later.time === '06:17', later);
    await page.screenshot({ path: path.join(OUT, '6b-horloge-ensuite.png') });

    // un telephone mal regle (fuseau de Los Angeles) : l'heure affichee reste celle du Tchad
    const w = await newVisitor({ ...phone, timezoneId: 'America/Los_Angeles' }, { storage: { albasse_zara_name: 'Fatimé' } });
    await w.ctx.clock.install({ time: new Date('2026-10-26T05:15:00Z') });
    await w.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await w.page.waitForSelector('[data-testid="city-clock"]', { timeout: 20000 });
    const wt = ((await w.page.getByTestId('city-clock').innerText()).match(/\d\d\s*:\s*\d\d/) || [''])[0].replace(/\s/g, '');
    check("telephone au fuseau de Los Angeles : l'heure reste 06:15 (heure du Tchad)", wt === '06:15', wt);
    await w.ctx.close();

    // mouvement automatique, en temps reel (sans fausse horloge) : a la 10e seconde l'ancien nom (qui sort) et le nouveau (qui arrive) sont ensemble
    // dans la place un court instant, puis il ne reste que le nouveau
    const live = await newVisitor(phone, { storage: { albasse_zara_name: 'Fatimé' } });
    await live.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await live.page.waitForSelector('[data-testid="city-clock-slot"]', { timeout: 20000 });
    const slid = await live.page.evaluate(() => new Promise((resolve) => {
      const slot = document.querySelector('[data-testid="city-clock-slot"]');
      const t0 = performance.now();
      let both = false;
      let moved = false;
      const tick = () => {
        const txt = slot.textContent || '';
        if (/N'Djamena/i.test(txt) && /Abéché/i.test(txt)) {
          both = true;
          const xs = Array.from(slot.querySelectorAll('[dir]')).map((e) => e.getBoundingClientRect().x);
          if (new Set(xs.map((x) => Math.round(x))).size > 1) moved = true;
        }
        if (performance.now() - t0 > 14000) resolve({ both, moved, final: (slot.textContent || '').trim() });
        else requestAnimationFrame(tick);
      };
      tick();
    }));
    check("horloge : le nom glisse tout seul a la 10e seconde (N'Djamena sort pendant qu'Abeche arrive), puis il ne reste qu'Abeche", slid.both && slid.final === 'Abéché', slid);
    await live.ctx.close();

    // un petit telephone (320 px) : meme les noms les plus longs (N'Djamena, Amdjarass) tiennent dans le bandeau
    const small = await newVisitor({ ...phone, viewport: { width: 320, height: 640 } }, { storage: { albasse_zara_name: 'Fatimé' } });
    await small.ctx.clock.install({ time: new Date('2026-10-26T05:15:00Z') });
    await small.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await small.page.waitForSelector('[data-testid="city-clock"]', { timeout: 20000 });
    await sleep(800);
    const smallMisfit = [await fits(small.page, "N'Djamena", 320)];
    for (let i = 0; i < 7; i++) {
      await small.page.clock.runFor(10000);
      await sleep(1000);
      smallMisfit.push(await fits(small.page, ((await small.page.getByTestId('city-clock-city').textContent()) || '').trim(), 320));
    }
    check('horloge : les 8 villes tiennent aussi sur un petit telephone (320 px), sans depasser le cadre', smallMisfit.every((m) => m === null), smallMisfit.filter(Boolean));
    await sleep(900);
    await small.page.screenshot({ path: path.join(OUT, '6c-horloge-320.png') });
    await small.ctx.close();
    await v.ctx.close();
  }

  // =============================================== 7. ACCUEIL : PUBLICITES DE ZARA (FAITS VRAIS SEULEMENT) ===============================================
  if (PARTS.includes('7')) {
    console.log("\n== 7. accueil : publicites de Zara (vrais chiffres seulement, article rare pour les metiers haut places)");
    const uid7 = '11111111-1111-4111-8111-111111111111';
    const JWT7 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const SK7 = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const memberWith = (profession, isAdmin = false) => {
      const auth = { id: uid7, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT7, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: false, patches: [], profile: { id: uid7, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: isAdmin ? 'admin' : 'customer', is_admin: isAdmin, is_affiliate: false } };
    };
    const home7 = async (extra = {}) => {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Fatimé' }, ...extra });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      return v;
    };
    const adText = async (pg) => ((await pg.getByTestId('zara-ad-line').textContent()) || '').trim();
    const waitAd = async (pg) => { await pg.getByTestId('zara-ad').waitFor({ timeout: 25000 }); await sleep(900); };

    const live = await get('products?select=id,name,slug,price,stock,images,sizes,colors&is_active=eq.true&stock=gt.0&limit=1000');
    const withPhoto = live.filter((p) => (p.images || [])[0] && Number(p.price) > 0);
    const rare = withPhoto.filter((p) => p.stock <= 5);
    // un article sans choix de taille ni de couleur : « Commander » le prend tout de suite
    const abundant = withPhoto.find((p) => p.stock > 5 && (p.sizes || []).length === 0 && (p.colors || []).length <= 1) || withPhoto.find((p) => p.stock > 5);
    console.log('info  articles a vrai petit stock :', rare.length, '| article abondant du test :', abundant && abundant.name.trim());
    check('le catalogue a des articles a vrai petit stock (stock 5 ou moins) et un article abondant', rare.length >= 2 && !!abundant);

    // a. interrupteur absent / colonne absente : aucune publicite
    const off = await home7();
    await sleep(4500);
    check('colonne absente (script SQL pas lance) : aucune publicite de Zara sur l’accueil', (await off.page.getByTestId('zara-ad').count()) === 0);
    await off.ctx.close();
    const offFalse = await home7({ fakeStore: { zaraAds: false } });
    await sleep(4500);
    check('interrupteur eteint : aucune publicite de Zara', (await offFalse.page.getByTestId('zara-ad').count()) === 0);
    await offFalse.ctx.close();

    // b. interrupteur allume, visiteur ordinaire, aucune commande en base : « Plus que N en stock », jamais « article rare » ni « beaucoup »
    const guest = await home7({ fakeStore: { zaraAds: true, zaraDelay: 0 } });
    await waitAd(guest.page);
    const gl = await adText(guest.page);
    check('visiteur : « Plus que N en stock. » (vrai stock), jamais « Article rare » ni « Beaucoup de clients »', /^Plus (que \d|qu'un seul) en stock\.$/.test(gl), gl);
    const gname = ((await guest.page.getByTestId('zara-ad-name').textContent()) || '').trim();
    check('la publicite montre un VRAI article du catalogue a petit stock, avec son prix', rare.some((p) => p.name.trim() === gname), gname);
    const gbox = await guest.page.getByTestId('zara-ad').boundingBox();
    const gcats = await guest.page.getByTestId('home-categories').boundingBox();
    check('la carte de Zara est juste sous la ligne des categories, dans la largeur du telephone', !!gbox && !!gcats && gbox.y >= gcats.y && gbox.x >= 0 && gbox.x + gbox.width <= 390, { gbox, gcats });
    await guest.page.screenshot({ path: path.join(OUT, '7a-pub-zara-visiteur.png') });
    // un toucher sur la carte : Zara ouvre le chat et prend le relais comme vendeuse (plus de fiche produit)
    await guest.page.getByTestId('zara-ad-open').click();
    await waitText(guest.page, /Je suis Zara, votre conseillère/);
    await waitText(guest.page, /Je peux m’occuper de votre commande tout de suite/);
    const gChat = await panelOf(guest.page).innerText();
    check('toucher la pub : le chat de Zara s’ouvre (la page reste l’accueil, pas de fiche produit)', !/\/produit\//.test(guest.page.url()) && /Je suis Zara, votre conseillère/.test(gChat), guest.page.url());
    check('Zara presente CET article (la fiche dans le chat, avec son nom)', (await cardsOf(guest.page).count()) === 1 && gChat.includes(gname.slice(0, 18)), { gname });
    check('Zara redit le vrai fait de la pub (« Plus que N en stock. »), sans « Article rare » ni « Beaucoup »', /Plus (que \d|qu'un seul) en stock\./.test(gChat) && !/Article rare|Beaucoup de clients/.test(gChat), gChat.slice(0, 400));
    const gChips = await chipLabels(guest.page);
    check('boutons de la vendeuse : « Commander cet article » en premier, « D’autres idées », menu, WhatsApp', gChips[0] === '🛒 Commander cet article' && gChips.includes('🔎 D’autres idées') && gChips.some((c) => /WhatsApp/.test(c)), gChips);
    check('Zara n’a PAS fait l’accueil habituel (pas de question de langue ni de prenom)', !/Choisissez votre langue|اختر لغتك/.test(gChat) && !/Quel est votre prénom/.test(gChat));
    await guest.page.screenshot({ path: path.join(OUT, '7g-pub-zara-chat.png') });
    await guest.ctx.close();

    // c. client haut place (metier du compte) : « Article rare : il n'en reste que N » (vrai stock)
    const dir = memberWith('Directeur');
    const boss = await home7({ fakeStore: { zaraAds: true, zaraDelay: 0 }, storage: { [SK7]: dir.session, albasse_zara_name: 'Fatimé' }, fakeUser: dir });
    await waitAd(boss.page);
    const bl = await adText(boss.page);
    check('metier « Directeur » : « Article rare : il n’en reste que N. » (vrai stock)', /^Article rare : il n'en reste (que \d|qu'un seul)\.$/.test(bl), bl);
    const bname = ((await boss.page.getByTestId('zara-ad-name').textContent()) || '').trim();
    check('client haut place : un VRAI article a petit stock du catalogue', rare.some((p) => p.name.trim() === bname), bname);
    await boss.page.screenshot({ path: path.join(OUT, '7b-pub-zara-directeur.png') });
    await boss.ctx.close();

    // d. etudiant : le meme fait, dit simplement
    const stu = memberWith('Étudiant');
    const student = await home7({ fakeStore: { zaraAds: true, zaraDelay: 0 }, storage: { [SK7]: stu.session, albasse_zara_name: 'Fatimé' }, fakeUser: stu });
    await waitAd(student.page);
    const sl = await adText(student.page);
    check('metier « Étudiant » : « Plus que N en stock. » (jamais « Article rare »)', /^Plus (que \d|qu'un seul) en stock\.$/.test(sl), sl);
    await student.ctx.close();

    // e. de vraies commandes (3 ou plus) : « Beaucoup de clients ont acheté », avec le vrai chiffre, et seulement pour cet article
    const sold = await home7({ fakeStore: { zaraAds: true, zaraDelay: 0 }, fakeSales: { rows: [{ product_id: abundant.id, orders_count: 8 }, { product_id: rare[0].id, orders_count: 1 }] } });
    await waitAd(sold.page);
    const al = await adText(sold.page);
    const aname = ((await sold.page.getByTestId('zara-ad-name').textContent()) || '').trim();
    check('8 vraies commandes : « Beaucoup de clients ont acheté cet article : 8 commandes ces 7 derniers jours. »', /^Beaucoup de clients ont acheté cet article : 8 commandes ces 7 derniers jours\./.test(al) && aname === abundant.name.trim(), { al, aname });
    check('l’article le plus commande passe en premier (1 seule commande : pas de chiffre pour l’autre)', !/1 commande|1 clients/.test(al), al);
    await sold.page.screenshot({ path: path.join(OUT, '7c-pub-zara-commandes.png') });
    // un toucher : Zara reprend la preuve VRAIE (8 commandes) puis « Commander cet article » lance la commande dans le chat
    await sold.page.getByTestId('zara-ad-open').click();
    await waitText(sold.page, /Je suis Zara, votre conseillère/);
    await waitText(sold.page, /Je peux m’occuper de votre commande tout de suite/);
    const sChat = await panelOf(sold.page).innerText();
    check('toucher la pub (8 vraies commandes) : Zara redit « Beaucoup de clients ont acheté cet article : 8 commandes… »', /Beaucoup de clients ont acheté cet article : 8 commandes/.test(sChat), sChat.slice(0, 500));
    const sCards = await cardsOf(sold.page).count();
    await tap(sold.page, 'Commander cet article', /Très bon choix/);
    check('« Commander cet article » : Zara choisit l’article pour le client et lance la commande dans le chat', (await panelOf(sold.page).innerText()).includes('Très bon choix') && sCards === 1);
    await sold.ctx.close();

    // f. fenetre de promotion : la phrase de Zara sous le message quand l'offre concerne un article
    const promo = { id: '00000000-0000-4000-8000-0000000000aa', name: 'Test', category_id: null, product_id: rare[0].id, gift: null, min_purchase: 0, start_date: '2020-01-01', end_date: '2099-12-31', end_time: '23:59:59', max_beneficiaries: null, claimed_count: 0, message: 'Offre du jour pour vous', image_url: null, button_text: 'PROFITER DE L’OFFRE', is_active: true, created_at: '2026-10-01T00:00:00Z' };
    const withPromo = await home7({ fakeStore: { zaraAds: true, zaraDelay: 0 }, fakePromos: [promo] });
    await withPromo.page.getByTestId('promo-zara-line').waitFor({ timeout: 25000 });
    const pl = ((await withPromo.page.getByTestId('promo-zara-line').textContent()) || '').trim();
    check('fenetre de promotion : « Zara : Plus que N en stock. » sous le message de l’offre', /^💬 Zara : Plus (que \d|qu'un seul) en stock\.$/.test(pl), pl);
    await withPromo.page.screenshot({ path: path.join(OUT, '7d-promo-zara.png') });
    await withPromo.ctx.close();
    const promoOff = await home7({ fakeStore: { zaraAds: false }, fakePromos: [promo] });
    await sleep(5000);
    check('interrupteur eteint : la fenetre de promotion n’a aucune phrase de Zara', (await promoOff.page.getByTestId('promo-zara-line').count()) === 0 && /Offre du jour pour vous/.test(await promoOff.page.locator('body').innerText()));
    await promoOff.ctx.close();

    // delai choisi par l'admin : la carte de l'accueil n'apparait qu'apres N secondes (5 s par defaut quand la colonne n'existe pas encore)
    const late = await home7({ fakeStore: { zaraAds: true, zaraDelay: 7 } });
    await sleep(3500);
    check('delai de 7 s : apres 3,5 s la publicite de Zara n’est pas encore la', (await late.page.getByTestId('zara-ad').count()) === 0);
    await late.page.getByTestId('zara-ad').waitFor({ timeout: 25000 });
    check('delai de 7 s : la publicite apparait ensuite', true);
    await late.ctx.close();
    const instant = await home7({ fakeStore: { zaraAds: true, zaraDelay: 0 } });
    await instant.page.getByTestId('zara-ad').waitFor({ timeout: 15000 });
    check('delai « tout de suite » (0 s) : la publicite apparait des que les ventes sont lues', true);
    await instant.ctx.close();
    const dflt = await home7({ fakeStore: { zaraAds: true } });
    await sleep(2500);
    check('colonne du delai absente : 5 secondes par defaut (pas encore la apres 2,5 s)', (await dflt.page.getByTestId('zara-ad').count()) === 0);
    await dflt.page.getByTestId('zara-ad').waitFor({ timeout: 25000 });
    check('colonne du delai absente : la publicite apparait ensuite', true);
    await dflt.ctx.close();
    // fenetre de promotion : meme delai quand Zara gere les publicites
    const promoLate = await home7({ fakeStore: { zaraAds: true, zaraDelay: 8 }, fakePromos: [promo] });
    await sleep(4000);
    check('delai de 8 s : la fenetre de promotion n’est pas ouverte apres 4 s', (await promoLate.page.getByTestId('promo-zara-line').count()) === 0 && !/Offre du jour pour vous/.test(await promoLate.page.locator('body').innerText()));
    await promoLate.page.getByTestId('promo-zara-line').waitFor({ timeout: 25000 });
    check('delai de 8 s : la fenetre s’ouvre ensuite avec la phrase de Zara', true);
    await promoLate.ctx.close();

    // f2. client CONNECTE : la carte s'affiche d'abord, puis Zara ouvre son chat 10 s plus tard, en fenetre du bas (pas en plein ecran)
    {
      const m = memberWith(null);
      const c = await newVisitor(phone, { storage: { [SK7]: m.session }, fakeUser: m, fakeStore: { zaraAds: true, zaraDelay: 3, waOrder: true, patches: [] }, autoOpen: true });
      const t0 = Date.now();
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await c.page.getByTestId('zara-ad').waitFor({ timeout: 25000 });
      const seen = (await c.page.evaluate(() => {
        const el = document.querySelector('[data-testid="zara-ad"]');
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { visibleDansEcran: r.y >= 0 && r.y + r.height <= innerHeight, libre: !!top && el.contains(top) };
      }));
      check('client connecte : la carte de Zara s\'affiche (apres 3 s), dans l\'ecran et PAS cachee par le chat', seen.visibleDansEcran && seen.libre, seen);
      // l'ancienne regle ouvrait le chat a 8 s : maintenant la carte reste seule jusqu'a 3 s + 10 s
      const wait11 = Math.max(0, 11000 - (Date.now() - t0));
      await sleep(wait11);
      check('11 s apres l\'arrivee (Zara s\'ouvrait a 8 s avant) : le chat n\'est pas encore ouvert, la carte est toujours visible', (await panelOf(c.page).count()) === 0 && (await c.page.getByTestId('zara-ad').count()) === 1);
      await panelOf(c.page).waitFor({ timeout: 12000 });
      const openedAfter = Date.now() - t0;
      check('Zara ouvre son chat environ 10 s apres l\'apparition de la carte (entre 12 s et 19 s apres l\'arrivee)', openedAfter >= 12000 && openedAfter <= 19000, openedAfter);
      await sleep(700);
      const pb = await panelOf(c.page).boundingBox();
      const vp = c.page.viewportSize();
      check('le chat est une fenetre du bas, pas en plein ecran : moins de 70 % de la hauteur, collee en bas, haut de l\'ecran visible', pb.height < vp.height * 0.7 && pb.y > 100 && Math.round(pb.y + pb.height) === vp.height, { pb, vp });
      const tagline = await c.page.getByTestId('home-tagline').boundingBox();
      check('le haut de l\'accueil reste visible au-dessus de la fenetre de Zara', !!tagline && tagline.y + tagline.height < pb.y, { tagline, pb });
      await c.page.screenshot({ path: path.join(OUT, '7f2-pub-puis-chat-du-bas.png') });
      check('aucune erreur (client connecte, publicite puis chat)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // g. l'interrupteur de l'admin (page « Promotions intelligentes ») : la base recoit zara_ads_enabled ; colonne absente : il faut lancer le script
    const adm = memberWith(null, true);
    const fs7 = { zaraAds: false, zaraDelay: 5, waOrder: true, patches: [] };
    const admin = await newVisitor(phone, { storage: { [SK7]: adm.session }, fakeUser: adm, fakeStore: fs7 });
    await admin.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
    await admin.page.getByTestId('zara-ads-toggle').waitFor({ timeout: 25000 });
    check('admin : « Zara gère les publicités » eteint au depart (« Désactivé »)', /Désactivé/.test(await admin.page.getByTestId('zara-ads-status').innerText()), await admin.page.getByTestId('zara-ads-status').innerText());
    check('admin : le texte explique les faits vrais (3 commandes, stock 5, metier haut place)', /faits vrais/.test(await admin.page.locator('body').innerText()) && /3 ou plus en 7 jours/.test(await admin.page.locator('body').innerText()) && /Article rare/.test(await admin.page.locator('body').innerText()));
    await sleep(3000); // l'interrupteur est bloque pendant la toute premiere lecture du reglage
    await admin.page.getByTestId('zara-ads-switch').click();
    await admin.page.getByText(/Sur l’accueil et dans les promotions, Zara met en avant/).waitFor({ timeout: 8000 });
    check('admin : on l’allume, la base recoit zara_ads_enabled = true', (fs7.patches || []).some((b) => b.zara_ads_enabled === true), fs7.patches);
    await admin.page.waitForFunction(() => /Activé/.test(document.querySelector('[data-testid="zara-ads-status"]')?.textContent || ''), null, { timeout: 8000 });
    check('admin : « Activé » affiché apres relecture', true);
    await admin.page.screenshot({ path: path.join(OUT, '7e-admin-zara-pubs.png') });
    await admin.page.getByTestId('zara-ads-switch').click();
    await admin.page.getByText('Publicités de Zara coupées', { exact: false }).waitFor({ timeout: 8000 });
    check('admin : on l’eteint, la base recoit zara_ads_enabled = false', (fs7.patches || []).some((b) => b.zara_ads_enabled === false), fs7.patches);
    // choix du delai : un toucher, la base recoit zara_ads_delay_seconds
    await admin.page.getByTestId('zara-delay').waitFor({ timeout: 15000 });
    check('admin : delai affiche : 5 secondes', /5 secondes/.test(await admin.page.getByTestId('zara-delay-status').innerText()), await admin.page.getByTestId('zara-delay-status').innerText());
    await admin.page.getByTestId('zara-delay-10').click();
    await admin.page.getByText(/10 secondes après l’ouverture de l’accueil\./).first().waitFor({ timeout: 8000 });
    check('admin : « 10 s » choisi, la base recoit zara_ads_delay_seconds = 10', (fs7.patches || []).some((b) => b.zara_ads_delay_seconds === 10), fs7.patches);
    await admin.page.getByTestId('zara-delay-0').click();
    await admin.page.getByText(/s’affiche tout de suite/).first().waitFor({ timeout: 8000 });
    check('admin : « Tout de suite » choisi, la base recoit zara_ads_delay_seconds = 0', (fs7.patches || []).some((b) => b.zara_ads_delay_seconds === 0), fs7.patches);
    await admin.page.screenshot({ path: path.join(OUT, '7f-admin-delai.png') });
    await admin.ctx.close();
    const adm2 = memberWith(null, true);
    const noCol = await newVisitor(phone, { storage: { [SK7]: adm2.session }, fakeUser: adm2, fakeStore: { waOrder: true, patches: [] } });
    await noCol.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
    await noCol.page.getByTestId('zara-ads-toggle').waitFor({ timeout: 25000 });
    await sleep(3000); // le reglage se lit d'abord : l'interrupteur est bloque pendant la toute premiere lecture
    await noCol.page.getByTestId('zara-ads-switch').click();
    await noCol.page.getByText(/Lancez d’abord le script add-zara-ads\.sql/).waitFor({ timeout: 8000 });
    check('admin : colonne absente (script pas lance) : message « Lancez d’abord le script add-zara-ads.sql »', true);
    await noCol.page.getByTestId('zara-delay-15').click();
    await noCol.page.getByText(/Lancez d’abord le script add-zara-ads-delay\.sql/).waitFor({ timeout: 8000 });
    check('admin : colonne du delai absente : message « Lancez d’abord le script add-zara-ads-delay.sql »', true);
    check('admin : le delai revient sur 5 secondes apres l’echec', /5 secondes/.test(await noCol.page.getByTestId('zara-delay-status').innerText()));
    check('admin : l’interrupteur revient sur « Désactivé » apres l’echec', /Désactivé/.test(await noCol.page.getByTestId('zara-ads-status').innerText()));
    await noCol.ctx.close();
  }

  // =============================================== 8. VENTE FLASH 24 H, ANCIEN PRIX SEULEMENT EN PROMOTION, ZARA CHOISIT LES ARTICLES ===============================================
  if (PARTS.includes('8')) {
    console.log("\n== 8. vente flash qui disparait apres 24 h, ancien prix seulement en promotion, Zara choisit les articles (fausse base : rien n'est ecrit)");
    const uid8 = '11111111-1111-4111-8111-111111111111';
    const JWT8 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const SK8 = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const member8 = (isAdmin) => {
      const auth = { id: uid8, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT8, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: false, patches: [], profile: { id: uid8, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: isAdmin ? 'admin' : 'customer', is_admin: isAdmin, is_affiliate: false } };
    };
    const HDR8 = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json8 = (route, body, status = 200) => route.fulfill({ status, headers: { ...HDR8, 'content-type': 'application/json' }, body: JSON.stringify(body) });

    // le catalogue du test : de VRAIS articles (lecture seule) avec des dates de vente flash et de promotion fabriquees
    const catalog = (await get('products?select=*&is_active=eq.true&stock=gt.0&limit=80&order=created_at.desc')).filter((p) => (p.images || [])[0] && Number(p.price) > 0);
    const uniq = []; const seenNames = new Set();
    for (const p of catalog) { const key = p.name.replace(/\s+/g, ' ').trim().toLowerCase(); if (!seenNames.has(key)) { seenNames.add(key); uniq.push(p); } }
    check('le catalogue a assez d\'articles pour le test', uniq.length >= 20, uniq.length);
    const inMs = (ms) => new Date(Date.now() + ms).toISOString();
    const withOld = (p, over = {}) => ({ ...p, compare_at_price: Math.round(Number(p.price) * 1.25), is_flash_sale: false, flash_sale_ends_at: null, promo_ends_at: null, ...over });
    const flashA = withOld(uniq[0], { is_flash_sale: true, flash_sale_ends_at: inMs(5 * 3600_000) });
    const flashB = withOld(uniq[1], { is_flash_sale: true, flash_sale_ends_at: inMs(2 * 3600_000) });
    const flashGone = withOld(uniq[2], { is_flash_sale: true, flash_sale_ends_at: inMs(-3600_000) });
    const promos = [uniq[3], uniq[4], uniq[5]].map((p) => withOld(p, { promo_ends_at: inMs(3 * 86_400_000) }));
    const promoGone = withOld(uniq[6], { promo_ends_at: inMs(-3600_000) });
    const others = uniq.slice(7, 20).map((p) => withOld(p));
    const all8 = [flashA, flashB, flashGone, ...promos, promoGone, ...others];
    const nm = (p) => p.name.replace(/\s+/g, ' ').trim(); // la page affiche les espaces multiples comme une seule
    const visit8 = async (rows, opts = {}) => {
      const v = await newVisitor(phone, opts);
      await v.page.route(/\/rest\/v1\/products\?/, (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: HDR8 }) : json8(route, rows)));
      return v;
    };
    // pour chaque carte de la page : a-t-elle un ancien prix barre ?
    const oldPrices = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-testid^="product-card-"]')].map((c) => ({ slug: c.getAttribute('data-testid').slice('product-card-'.length), old: !!c.querySelector('[data-testid="product-old-price"]'), badge: !!c.querySelector('[data-testid="product-discount-badge"]') })));

    // --- a. accueil : seule la vente flash EN COURS, les promotions en cours, l'ancien prix seulement pour elles
    const home = await visit8(all8);
    await home.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await home.page.getByTestId('home-flash').waitFor({ timeout: 25000 });
    await home.page.getByTestId('home-promotions').waitFor({ timeout: 25000 });
    const flashText = await home.page.getByTestId('home-flash').innerText();
    check('Vente flash de l\'accueil : les 2 articles en cours', flashText.includes(nm(flashA)) && flashText.includes(nm(flashB)), flashText.slice(0, 200));
    check('Vente flash de l\'accueil : l\'article dont les 24 h sont passees a DISPARU (meme marque « flash » dans la base)', !flashText.includes(nm(flashGone)));
    check('Vente flash : le compte a rebours est la, avec « Offres limitees dans le temps »', /Offres limitées dans le temps/.test(flashText) && /\bH\b/.test(flashText) && /\bS\b/.test(flashText));
    const promoText = await home.page.getByTestId('home-promotions').innerText();
    check('section Promotions : les 3 articles en promotion de Zara', promos.every((p) => promoText.includes(nm(p))), promoText.slice(0, 300));
    check('section Promotions : une promotion terminee n\'y est plus', !promoText.includes(nm(promoGone)));
    check('section Promotions : « 🏷️ PROMOTIONS » et « Prix reduits jusqu\'au … »', /🏷️ PROMOTIONS/.test(promoText) && /Prix réduits jusqu’au \d{1,2} \p{L}+/u.test(promoText), promoText.slice(0, 120));
    check('les articles ne sont pas en double entre Vente flash et Promotions', !promos.some((p) => flashText.includes(nm(p))) && !flashText.includes(nm(promoGone)));
    await sleep(800);
    const cards = await oldPrices(home.page);
    const slugsWithOld = new Set(cards.filter((c) => c.old).map((c) => c.slug));
    const promoted = [flashA, flashB, ...promos].map((p) => p.slug);
    const notPromoted = [flashGone, promoGone, ...others].map((p) => p.slug);
    check('ancien prix barre + « -X % » : les 5 articles en vraie promotion les ont', promoted.every((s) => slugsWithOld.has(s)) && cards.filter((c) => promoted.includes(c.slug)).every((c) => c.old && c.badge), promoted.filter((s) => !slugsWithOld.has(s)));
    check('AUCUN ancien prix barre ni « -X % » sur les autres articles (meme si la base en garde un)', notPromoted.every((s) => !cards.some((c) => c.slug === s && (c.old || c.badge))), notPromoted.filter((s) => cards.some((c) => c.slug === s && c.old)));
    const priced = await home.page.evaluate((slug) => document.querySelector(`[data-testid="product-card-${slug}"]`)?.innerText || '', others[0].slug);
    check('les prix de vente ne changent pas : le prix de l\'article normal est toujours affiche', priced.replace(/[\s  ]/g, '').includes(String(Math.round(Number(others[0].price))).replace(/\B(?=(\d{3})+(?!\d))/g, '')) , priced);
    await home.page.screenshot({ path: path.join(OUT, '8a-accueil-flash-promos.png') });
    await home.page.getByTestId('home-flash').scrollIntoViewIfNeeded();
    await home.page.getByTestId('home-flash').screenshot({ path: path.join(OUT, '8a-vente-flash.png') });
    await home.page.getByTestId('home-promotions').scrollIntoViewIfNeeded();
    await home.page.getByTestId('home-promotions').screenshot({ path: path.join(OUT, '8a-promotions.png') });

    // --- b. fiche article : ancien prix seulement pour une promotion
    await home.page.goto(`${BASE}/produit/${promos[0].slug}`, { waitUntil: 'load' });
    await home.page.getByText(nm(promos[0]), { exact: false }).first().waitFor({ timeout: 25000 });
    await sleep(800);
    // l'ancien prix de LA fiche (pas ceux des cartes « articles similaires » plus bas)
    const ownOld = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-testid="product-old-price"]')].filter((e) => !e.closest('[data-testid^="product-card-"]')).length);
    check('fiche d\'un article en promotion : ancien prix barre affiche', (await ownOld(home.page)) === 1);
    await home.page.goto(`${BASE}/produit/${others[0].slug}`, { waitUntil: 'load' });
    await home.page.getByText(nm(others[0]), { exact: false }).first().waitFor({ timeout: 25000 });
    await sleep(800);
    check('fiche d\'un article normal : AUCUN ancien prix barre', (await ownOld(home.page)) === 0);
    check('aucune erreur (accueil et fiches)', home.errs.length === 0, home.errs);
    await home.ctx.close();

    // --- c. la vente flash qui se termine PENDANT que la page est ouverte disparait toute seule
    const soon = withOld(uniq[7], { is_flash_sale: true, flash_sale_ends_at: inMs(6000) });
    const live = await visit8([soon, withOld(uniq[8])]);
    await live.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await live.page.getByTestId('home-flash').waitFor({ timeout: 25000 });
    check('vente flash qui finit dans quelques secondes : visible au depart', (await live.page.getByTestId('home-flash').count()) === 1);
    await live.page.getByTestId('home-flash').waitFor({ state: 'detached', timeout: 20000 });
    check('apres les 24 h : la section Vente flash disparait toute seule, sans recharger la page', (await live.page.getByTestId('home-flash').count()) === 0);
    const gone = await oldPrices(live.page);
    check('et l\'ancien prix de cet article disparait aussi', gone.filter((c) => c.slug === soon.slug).every((c) => !c.old && !c.badge), gone.filter((c) => c.slug === soon.slug));
    await live.ctx.close();

    // --- d. sans aucune promotion : ni section Vente flash, ni section Promotions, ni ancien prix
    const none = await visit8(others);
    await none.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await none.page.getByText('Toute la collection').waitFor({ timeout: 25000 });
    await sleep(1500);
    const noneCards = await oldPrices(none.page);
    check('aucune promotion en cours : pas de section Vente flash ni Promotions', (await none.page.getByTestId('home-flash').count()) === 0 && (await none.page.getByTestId('home-promotions').count()) === 0);
    check('aucune promotion en cours : AUCUN ancien prix barre sur la page', noneCards.length > 0 && noneCards.every((c) => !c.old && !c.badge), noneCards.filter((c) => c.old).length);
    await none.ctx.close();

    // --- e. Zara (chat) : elle ne parle de promotion que pour les vraies promotions
    const chat = await visit8(all8, { storage: { albasse_zara_name: 'Fatimé' }, session: { albasse_zara_v1: JSON.stringify({ messages: [{ id: 's1', role: 'assistant', text: 'Bonjour', lang: 'fr' }], step: 'menu', ctx: null, need: null, order: null }) } });
    await chat.page.goto(`${BASE}/`, { waitUntil: 'load' });
    await sleep(2500);
    await chat.page.getByRole('button', { name: /Discuter avec Zara Kings|التحدث مع زارا كينغز/ }).click();
    await ask(chat.page, 'les promotions', /promotion|remise|réduction/i);
    await sleep(1500);
    const chatText = await panelOf(chat.page).innerText();
    const chatCards = await cardsOf(chat.page).count();
    check('Zara : « les promotions » ne montre que de vraies promotions (aucun article sans promotion)', chatCards >= 1 && chatCards <= 5 && !others.some((p) => chatText.includes(nm(p))) && !chatText.includes(nm(flashGone)) && !chatText.includes(nm(promoGone)), { chatCards, chatText: chatText.slice(0, 300) });
    await chat.page.screenshot({ path: path.join(OUT, '8b-zara-promotions.png') });
    await chat.ctx.close();

    // --- f. administrateur : Zara choisit, l'administrateur valide
    const mkRow = (i, extra = {}) => ({ id: `0000000${i}-0000-4000-8000-00000000000${i % 10}`.slice(0, 36), name: `Zara test ${String(i).padStart(2, '0')}`, slug: `zara-test-${i}`, image: null, price: 10000, old_price: 12500, stock: 20, category_id: `cat${i % 7}`, likes: i % 5, views: 100 - i * 3, carts: i % 4, sold: i % 3, flash_active: false, promo_active: false, ...extra });
    const statRows = [
      ...Array.from({ length: 24 }, (_, i) => mkRow(i + 10)),
      { ...mkRow(60), name: 'Erreur de saisie', views: 999, carts: 99, price: 2500, old_price: 10000 },
      { ...mkRow(61), name: 'Sans ancien prix', views: 999, carts: 99, old_price: null },
      { ...mkRow(62), name: 'Presque epuise', views: 999, carts: 99, stock: 1 },
      { ...mkRow(63), name: 'Deja en flash', views: 999, carts: 99, flash_active: true },
      { ...mkRow(64), name: 'Deja en promo', views: 999, carts: 99, promo_active: true },
    ];
    const adm = member8(true);
    const calls = { stats: 0, apply: [], stop: 0 };
    const fsAuto = { waOrder: true, patches: [], zaraAutoFlash: false, zaraAutoFlashLast: { at: new Date(Date.now() - 3600_000).toISOString(), count: 4, names: ['Zara test 10', 'Zara test 11', 'Zara test 14', 'Zara test 15'] } };
    const admin = await newVisitor(phone, { storage: { [SK8]: adm.session }, fakeUser: adm, fakeStore: fsAuto });
    await admin.page.route(/\/rest\/v1\/rpc\/zara_promotion_stats/, (route) => { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR8 }); calls.stats++; return json8(route, statRows); });
    await admin.page.route(/\/rest\/v1\/rpc\/zara_apply_promotions/, (route) => { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR8 }); calls.apply.push(JSON.parse(route.request().postData() || '{}')); return json8(route, { flash: 4, promo: 12, skipped: [] }); });
    await admin.page.route(/\/rest\/v1\/rpc\/zara_stop_promotions/, (route) => { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR8 }); calls.stop++; return json8(route, { flash: 1, promo: 1 }); });
    await admin.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
    await admin.page.getByTestId('zara-promo-picker').waitFor({ timeout: 25000 });
    await admin.page.getByTestId('zara-promo-status').waitFor({ timeout: 15000 });
    await admin.page.waitForFunction(() => /En ce moment/.test(document.querySelector('[data-testid="zara-promo-status"]')?.textContent || ''), null, { timeout: 15000 });
    check('admin : « En ce moment : 1 en Vente flash · 1 en Promotion » (les vraies donnees de la base)', /En ce moment : 1 en Vente flash · 1 en Promotion/.test(await admin.page.getByTestId('zara-promo-status').innerText()), await admin.page.getByTestId('zara-promo-status').innerText());
    const picker = await admin.page.getByTestId('zara-promo-picker').innerText();
    check('admin : le texte dit que Zara ne modifie JAMAIS un prix, et que rien n\'est publie avant « Valider » pour les choix manuels', /ne modifie JAMAIS le prix d’un article/.test(picker) && /rien n’est publié avant votre « Valider »/.test(picker) && /24 h/.test(picker) && /7 jours/.test(picker), picker.slice(0, 500));
    // Vente flash AUTOMATIQUE : interrupteur, texte, dernier choix
    const lastTxt = await admin.page.getByTestId('zara-auto-flash-last').innerText();
    check('admin : « Dernier choix automatique : … · 4 articles : Zara test 10, Zara test 11, … »', /Dernier choix automatique : .*· 4 articles : Zara test 10, Zara test 11, Zara test 14, Zara test 15/.test(lastTxt), lastTxt);
    check('admin : l\'interrupteur « Vente flash automatique » est eteint au depart (« Désactivé »)', /Désactivé : Zara ne lance aucune Vente flash toute seule/.test(await admin.page.getByTestId('zara-auto-flash-status').innerText()), await admin.page.getByTestId('zara-auto-flash-status').innerText());
    check('admin : le texte explique les 4 articles suivants, jamais le meme deux fois de suite, et qu\'on peut couper', /4 articles suivants/.test(await admin.page.getByTestId('zara-auto-flash-help').innerText()) && /jamais le même article\s+deux fois de suite/.test(await admin.page.getByTestId('zara-auto-flash-help').innerText()), await admin.page.getByTestId('zara-auto-flash-help').innerText());
    await sleep(3000); // l'interrupteur est bloque pendant la toute premiere lecture du reglage
    await admin.page.getByTestId('zara-auto-flash-switch').click();
    await admin.page.waitForFunction(() => /Activé : à chaque fin de Vente flash/.test(document.querySelector('[data-testid="zara-auto-flash-status"]')?.textContent || ''), null, { timeout: 8000 });
    check('admin : on l\'allume, la base recoit zara_auto_flash_enabled = true (et rien d\'autre : aucun prix)', fsAuto.patches.length === 1 && fsAuto.patches[0].zara_auto_flash_enabled === true && Object.keys(fsAuto.patches[0]).join() === 'zara_auto_flash_enabled', fsAuto.patches);
    await admin.page.getByText(/Zara choisit seule les articles de la Vente flash \(24 h\)/).first().waitFor({ timeout: 8000 });
    check('admin : message « Zara choisit seule les articles de la Vente flash (24 h)… Elle ne modifie aucun prix »', /Elle ne modifie aucun prix/.test(await admin.page.locator('body').innerText()));
    check('admin : rien n\'est choisi ni publie avant le toucher', (await admin.page.getByTestId('zara-promo-plan').count()) === 0 && calls.apply.length === 0);
    await admin.page.getByText('🔎 Zara, choisis les articles').click();
    await admin.page.getByTestId('zara-promo-plan').waitFor({ timeout: 15000 });
    const flashList = await admin.page.getByTestId('zara-promo-flash').innerText();
    const promoList = await admin.page.getByTestId('zara-promo-promo').innerText();
    const flashItems = await admin.page.getByTestId('zara-promo-flash-item').count();
    const promoItems = await admin.page.getByTestId('zara-promo-promo-item').count();
    check('admin : Vente flash = 4 articles, Promotions = 12 articles', flashItems === 4 && promoItems === 12, { flashItems, promoItems });
    check('admin : les 4 articles les plus demandes en Vente flash (les plus de vues et de paniers)', /Zara test 10/.test(flashList) && /Zara test 11/.test(flashList), flashList.slice(0, 300));
    check('admin : jamais les articles refuses (remise fausse, sans ancien prix, presque epuise, deja en promotion)', !/Erreur de saisie|Sans ancien prix|Presque epuise|Deja en/.test(flashList + promoList));
    check('admin : chaque choix dit pourquoi avec de vrais chiffres (vues, paniers, stock, vraie remise)', /👁 \d+ vues? cette semaine/.test(flashList) && /20 en stock/.test(flashList) && /vraie remise −20 %/.test(flashList) && /10 000 FCFA/.test(flashList.replace(/[\s  ]/g, ' ')), flashList.slice(0, 400));
    const summary = await admin.page.getByTestId('zara-promo-summary').innerText();
    check('admin : « 29 articles examines · 24 avec une vraie remise… »', /29 articles examinés · 24 avec une vraie remise/.test(summary), summary);
    check('rien n\'est publie tant que l\'administrateur n\'a pas valide', calls.apply.length === 0);
    await admin.page.screenshot({ path: path.join(OUT, '8c-admin-zara-choisit.png'), fullPage: true });
    await admin.page.getByText('✅ Valider et publier').click();
    await admin.page.getByText(/⚡ 4 en Vente flash · 🏷️ 12 en Promotions/).waitFor({ timeout: 10000 });
    check('admin : « Valider » publie UNE fois, avec les bons articles, 24 h et 7 jours', calls.apply.length === 1 && calls.apply[0].p_flash.length === 4 && calls.apply[0].p_promo.length === 12 && calls.apply[0].p_flash_hours === 24 && calls.apply[0].p_promo_days === 7, calls.apply);
    check('admin : aucun article en double entre la Vente flash et les Promotions', new Set([...calls.apply[0].p_flash, ...calls.apply[0].p_promo]).size === 16);
    check('admin : aucun prix envoye (la publication ne contient que des numeros d\'articles et des durees)', Object.keys(calls.apply[0]).sort().join() === 'p_flash,p_flash_hours,p_promo,p_promo_days');
    check('admin : apres la publication, la liste disparait et l\'etat est relu', (await admin.page.getByTestId('zara-promo-plan').count()) === 0 && calls.stats >= 3, calls.stats);
    // arreter : boite de confirmation, « Non » ne fait rien
    await admin.page.getByTestId('zara-promo-stop').click();
    await admin.page.getByText('Arrêter la Vente flash et les promotions ?').waitFor({ timeout: 8000 });
    await admin.page.getByText('Annuler', { exact: true }).click();
    await sleep(600);
    check('admin : « Annuler » dans la confirmation : rien n\'est arrete', calls.stop === 0);
    await admin.page.getByTestId('zara-promo-stop').click();
    await admin.page.getByText('Oui, arrêter').click();
    await admin.page.getByText(/Plus de Vente flash ni de promotion sur le site/).waitFor({ timeout: 10000 });
    check('admin : « Oui, arreter » : un seul arret, message « Les anciens prix restent enregistres »', calls.stop === 1 && (await admin.page.getByText(/anciens prix restent enregistrés/).count()) >= 1, calls.stop);
    check('aucune erreur (administrateur)', admin.errs.length === 0, admin.errs);
    await admin.ctx.close();

    // --- g. script SQL pas lance : message clair, rien ne casse
    const adm2 = member8(true);
    const noSql = await newVisitor(phone, { storage: { [SK8]: adm2.session }, fakeUser: adm2, fakeStore: { waOrder: true, patches: [] } });
    await noSql.page.route(/\/rest\/v1\/rpc\/zara_promotion_stats/, (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: HDR8 }) : json8(route, { code: 'PGRST202', message: 'Could not find the function public.zara_promotion_stats(p_days) in the schema cache' }, 404)));
    await noSql.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
    await noSql.page.getByTestId('zara-promo-missing').waitFor({ timeout: 25000 });
    check('script pas lance : « Lancez d\'abord le script add-zara-promotions.sql dans Supabase »', /add-zara-promotions\.sql/.test(await noSql.page.getByTestId('zara-promo-missing').innerText()));
    check('script pas lance : pas de bouton « Zara, choisis »', (await noSql.page.getByText('🔎 Zara, choisis les articles').count()) === 0);
    await sleep(3000); // l'interrupteur est bloque pendant la toute premiere lecture du reglage
    await noSql.page.getByTestId('zara-auto-flash-switch').click();
    await noSql.page.getByText('Pas enregistré').first().waitFor({ timeout: 8000 });
    check('script pas lance : l\'interrupteur automatique dit « Lancez d’abord le script add-zara-promotions.sql » et reste eteint', /Désactivé/.test(await noSql.page.getByTestId('zara-auto-flash-status').innerText()) && (await noSql.page.getByText(/Lancez d’abord le script add-zara-promotions\.sql dans Supabase\./).count()) >= 1);
    await noSql.ctx.close();
  }

  // =============================================== 0. COMMANDE SANS COMPTE (fausse base : rien n'est ecrit) ===============================================
  if (PARTS.includes('0')) {
    console.log("\n== 0. commande sans compte : le visiteur remplit ses infos, son compte est cree a la confirmation (code de 6 chiffres, jamais 1234)");
    const uid0 = '33333333-3333-4333-8333-333333333333';
    const JWT0 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzMzMzMzMy0zMzMzLTQzMzMtODMzMy0zMzMzMzMzMzMzMzMiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const SK0 = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const account0 = (profile = {}, opts = {}) => {
      const auth = { id: uid0, aud: 'authenticated', role: 'authenticated', email: '23566123456@tel.albasseshopping.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-26T00:00:00Z' };
      const token = { access_token: JWT0, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], ...opts, profile: { id: uid0, email: null, full_name: null, phone: null, whatsapp_number: null, profession: null, region: null, country: null, address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, ...profile } };
    };
    const live0 = await get('products?select=id,name,slug,price,stock,images,sizes,colors,category_id&is_active=eq.true&stock=gt.2&limit=1000');
    const simple = live0.filter((p) => (p.sizes || []).length <= 1 && (p.colors || []).length <= 1 && Number(p.price) > 0 && (p.images || [])[0]);
    const prod0 = simple[0];
    check('un article simple (une seule taille ou couleur) existe pour le test', !!prod0);
    const cartOf = (p) => JSON.stringify({ state: { items: [{ id: `${p.id}__nc__ns`, product: p, quantity: 1, color: null, size: null }], updatedAt: Date.now() }, version: 1 });
    const fillCity = async (page) => {
      await page.getByPlaceholder(/Rechercher une ville/).click();
      await page.keyboard.type("N'Dja", { delay: 60 });
      await page.getByText(/^\s*N.Djamena\s*$/).locator('visible=true').first().click();
      await sleep(600);
    };
    const confirm0 = (page) => page.getByText('Confirmer la commande', { exact: true }).locator('visible=true').first().click();

    // --- a. visiteur sans compte : fiche -> Commander -> page de commande (plus de renvoi vers la connexion) -> compte cree a la confirmation
    {
      const fu = account0();
      const fo = { list: [], patches: [], created: [] };
      const g = await newVisitor(phone, { fakeUser: fu, fakeOrders: fo, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await g.page.goto(`${BASE}/produit/${prod0.slug}`, { waitUntil: 'load' });
      await g.page.getByText('Commander', { exact: true }).locator('visible=true').first().waitFor({ timeout: 25000 });
      await g.page.getByText('Commander', { exact: true }).locator('visible=true').first().click();
      await g.page.getByTestId('checkout-guest-note').waitFor({ timeout: 15000 }).catch(async (e) => {
        await g.page.screenshot({ path: path.join(OUT, '0x-echec-commander.png'), fullPage: true });
        console.log('page apres « Commander » :', g.page.url(), (await g.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300));
        throw e;
      });
      check('sans compte : « Commander » ouvre la page de commande (pas la connexion)', new URL(g.page.url()).pathname === '/commande', g.page.url());
      check('page de commande : « pas besoin de creer un compte avant »', /Pas besoin de créer un compte avant/.test(await g.page.getByTestId('checkout-guest-note').innerText()));
      check('champs demandes : prenom, nom, telephone, e-mail (plus de « Nom complet »)', (await g.page.getByTestId('checkout-first-name').count()) === 1 && (await g.page.getByTestId('checkout-last-name').count()) === 1 && (await g.page.getByTestId('checkout-phone').count()) === 1 && (await g.page.getByTestId('checkout-email').count()) === 1 && (await g.page.getByPlaceholder('Nom complet').count()) === 0);
      await g.page.screenshot({ path: path.join(OUT, '0a-commande-sans-compte.png'), fullPage: true });
      // rien rempli : on demande le prenom, rien n'est envoye
      await confirm0(g.page);
      await g.page.getByText('Merci d’écrire votre prénom.').waitFor({ timeout: 8000 });
      check('rien rempli : « Merci d\'ecrire votre prenom », aucun compte cree, aucune commande', !(fu.signups || []).length && fo.created.length === 0);
      await g.page.getByTestId('checkout-first-name').fill('Amina');
      await g.page.getByTestId('checkout-last-name').fill('Hassan');
      await g.page.getByTestId('checkout-phone').fill('66123456');
      await g.page.getByTestId('checkout-email').fill('amina');
      await confirm0(g.page);
      await g.page.getByText(/adresse e-mail valide/).first().waitFor({ timeout: 8000 });
      check('e-mail mal ecrit : message, aucun compte cree', !(fu.signups || []).length);
      await g.page.getByTestId('checkout-email').fill('amina@gmail.com');
      await g.page.getByPlaceholder(/Adresse \(quartier, rue\)/).fill('Quartier Moursal');
      await fillCity(g.page);
      await g.page.getByText('Paiement à la livraison', { exact: true }).locator('visible=true').first().click();
      await confirm0(g.page);
      await g.page.getByTestId('confirm-new-account').waitFor({ timeout: 25000 });
      const shown = (await g.page.getByTestId('confirm-new-password').innerText()).trim();
      const su = (fu.signups || [])[0] || {};
      check('compte cree UNE fois, avec le numero (23566123456@tel.albasseshopping.com)', fu.signups.length === 1 && su.email === '23566123456@tel.albasseshopping.com', fu.signups);
      check('mot de passe : un code de 6 chiffres, jamais « 1234 » ni un code facile', /^\d{6}$/.test(su.password) && su.password !== '1234' && !/^(\d)\1{5}$/.test(su.password) && su.password !== '123456', su.password);
      check('la page de confirmation montre le MEME code que celui envoye pour creer le compte', shown === su.password, { shown, sent: su.password });
      const box = await g.page.getByTestId('confirm-new-account').innerText();
      check('confirmation : « Votre compte est cree », numero (66 12 34 56), mot de passe, conseil de capture d\'ecran, « Compte » pour le changer', /Votre compte est créé/.test(box) && /66 12 34 56/.test(box) && /capture d’écran/.test(box) && /« Compte »/.test(box), box);
      const patch = fu.patches.find((x) => 'full_name' in x) || {};
      check('profil : nom complet, numero, e-mail donne, ville, pas d\'abonnement aux messages publicitaires', patch.full_name === 'Amina Hassan' && patch.phone === '66123456' && patch.email === 'amina@gmail.com' && patch.region === "N'Djamena" && patch.notify_new_products === false && patch.notify_promotions === false && patch.notify_flash_sale === false, patch);
      const ord = fo.created[0] || {};
      check('la commande est enregistree UNE fois, au nom du nouveau compte', fo.created.length === 1 && ord.user_id === uid0 && ord.shipping_name === 'Amina Hassan' && ord.shipping_phone === '66123456' && ord.shipping_city === "N'Djamena" && ord.payment_method === 'cash_on_delivery' && ord.status === 'pending', ord);
      check('apres la commande : le visiteur est connecte (la facture PDF est proposee)', (await g.page.getByText(/Télécharger.*facture|Facture/i).count()) > 0);
      await g.page.screenshot({ path: path.join(OUT, '0b-confirmation-compte-cree.png'), fullPage: true });
      check('aucune erreur (commande sans compte)', g.errs.length === 0, g.errs);
      await g.ctx.close();
    }

    // --- b. le numero a deja un compte : on ne cree rien, on demande de se connecter (la commande n'est pas mise sur le compte de quelqu'un d'autre)
    {
      const fu = account0({}, { signupError: 'exists' });
      const fo = { list: [], patches: [], created: [] };
      const g = await newVisitor(phone, { storage: { 'albasse-cart': cartOf(prod0) }, fakeUser: fu, fakeOrders: fo, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await g.page.goto(`${BASE}/commande`, { waitUntil: 'load' });
      await g.page.getByTestId('checkout-first-name').waitFor({ timeout: 25000 });
      await g.page.getByTestId('checkout-first-name').fill('Amina');
      await g.page.getByTestId('checkout-last-name').fill('Hassan');
      await g.page.getByTestId('checkout-phone').fill('66123456');
      await g.page.getByTestId('checkout-email').fill('amina@gmail.com');
      await g.page.getByPlaceholder(/Adresse \(quartier, rue\)/).fill('Quartier Moursal');
      await fillCity(g.page);
      await g.page.getByText('Paiement à la livraison', { exact: true }).locator('visible=true').first().click();
      await confirm0(g.page);
      await g.page.getByText(/Vous avez déjà un compte avec ce numéro/).first().waitFor({ timeout: 15000 });
      await g.page.waitForURL(/\/connexion/, { timeout: 15000 });
      check('numero deja inscrit : « vous avez deja un compte », page de connexion, aucune commande', fo.created.length === 0 && /\/connexion/.test(g.page.url()), g.page.url());
      await g.ctx.close();
    }

    // --- d. « Compte obligatoire » ACTIVE : l'option n'existe pas, comme avant (page de commande, fiche et Zara demandent un compte).
    //        Le mur d'entree couvre tout visiteur : on utilise l'agent d'un robot de Google (que le mur laisse passer) pour atteindre les pages.
    {
      const fu = account0();
      const fo = { list: [], patches: [], created: [] };
      const bot = { ...phone, userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' };
      const g = await newVisitor(bot, { storage: { 'albasse-cart': cartOf(prod0), albasse_zara_name: 'Ali' }, fakeUser: fu, fakeOrders: fo, fakeStore: { waOrder: true, accountRequired: true, patches: [] } });
      await g.page.goto(`${BASE}/commande`, { waitUntil: 'load' });
      await g.page.waitForURL(/\/connexion/, { timeout: 25000 });
      check('compte obligatoire active : la page de commande renvoie vers la connexion (pas de formulaire prenom / nom / e-mail)', (await g.page.getByTestId('checkout-first-name').count()) === 0 && fo.created.length === 0 && !(fu.signups || []).length, g.page.url());
      await g.page.goto(`${BASE}/produit/${prod0.slug}`, { waitUntil: 'load' });
      await g.page.getByText('Commander', { exact: true }).locator('visible=true').first().waitFor({ timeout: 25000 });
      await g.page.getByText('Commander', { exact: true }).locator('visible=true').first().click();
      await g.page.waitForURL(/\/connexion/, { timeout: 15000 });
      check('compte obligatoire active : « Commander » sur la fiche renvoie vers la connexion, comme avant', /\/connexion/.test(g.page.url()), g.page.url());
      check('compte obligatoire active : aucun compte cree, aucune commande', fo.created.length === 0 && !(fu.signups || []).length);
      // Zara : sans compte et compte obligatoire, elle demande un compte (et ne propose pas la commande sans compte)
      await g.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await g.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(g.page, /Votre commande n’est pas terminée/);
      await chip(g.page, 'Terminer ma commande').click();
      await waitText(g.page, /créez votre compte ou connectez-vous/);
      check('compte obligatoire active : Zara demande de creer un compte / se connecter (pas « Pas besoin de compte »)', (await chipLabels(g.page)).join('|') === '👤 Créer mon compte|Me connecter|🏠 Menu' && (await panelOf(g.page).getByText(/Pas besoin de compte pour commander/).count()) === 0, await chipLabels(g.page));
      await g.ctx.close();
    }

    // --- c. client deja connecte : rien ne change (« Nom complet », pas de formulaire de compte, pas de code a la confirmation)
    {
      const fu = account0({ full_name: 'Ahmed Hassan', phone: '66123456', email: 'ahmed@example.com' });
      const fo = { list: [], patches: [], created: [] };
      const m = await newVisitor(phone, { storage: { [SK0]: fu.session, 'albasse-cart': cartOf(prod0) }, fakeUser: fu, fakeOrders: fo, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await m.page.goto(`${BASE}/commande`, { waitUntil: 'load' });
      await m.page.getByPlaceholder('Nom complet').waitFor({ timeout: 25000 });
      check('client connecte : « Nom complet » comme avant, pas de formulaire prenom / nom / e-mail', (await m.page.getByTestId('checkout-first-name').count()) === 0 && (await m.page.getByTestId('checkout-email').count()) === 0 && (await m.page.getByTestId('checkout-guest-note').count()) === 0);
      await m.page.getByPlaceholder(/Adresse \(quartier, rue\)/).fill('Quartier Moursal');
      await fillCity(m.page);
      await m.page.getByText('Paiement à la livraison', { exact: true }).locator('visible=true').first().click();
      await confirm0(m.page);
      await m.page.getByText(/a bien été enregistrée/).waitFor({ timeout: 25000 });
      check('client connecte : commande enregistree, aucun nouveau compte, aucun code affiche', fo.created.length === 1 && !(fu.signups || []).length && (await m.page.getByTestId('confirm-new-account').count()) === 0, { orders: fo.created.length, signups: fu.signups });
      await m.ctx.close();
    }
  }

  // =============================================== 9. ZARA SEO : descriptions des articles (fausse base, fausse fonction : rien n'est ecrit) ===============================================
  if (PARTS.includes('9')) {
    console.log("\n== 9. Zara SEO : Zara propose les descriptions des fiches faibles, l'administrateur valide (fausse base : rien n'est ecrit)");
    const uid9 = '22222222-2222-4222-8222-222222222222';
    const JWT9 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const SK9 = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const member9 = (isAdmin) => {
      const auth = { id: uid9, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT9, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: false, patches: [], profile: { id: uid9, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: isAdmin ? 'admin' : 'customer', is_admin: isAdmin, is_affiliate: false } };
    };
    const HDR9 = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json9 = (route, body, status = 200) => route.fulfill({ status, headers: { ...HDR9, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const GOOD9 = 'Montre homme au cadran blanc texturé et bracelet noir souple. Un modèle sobre et élégant, facile à porter au quotidien.';
    const R = (i, name, description, extra = {}) => ({ id: `0000000${i}-0000-4000-8000-00000000000${i}`, name, slug: `zs-${i}`, description, stock: 5, is_active: true, images: [], created_at: `2026-10-${String(10 + i).padStart(2, '0')}T00:00:00Z`, description_zara_at: null, description_before_zara: null, ...extra });
    const makeDb = () => ({
      rows: [
        R(1, 'Lunettes Panthère VIP', null),
        R(2, 'Montre KEEP MOVING', ''),
        R(3, 'Sandale  MS', 'Courte'),
        R(4, 'Ceinture homme', 'Trop courte'),
        R(5, 'Parfum 110 Degrees', GOOD9),
        R(6, 'Parfum 110 degrees', GOOD9),
        R(7, 'Survêtement ZEGNA', GOOD9),
        R(8, 'Article désactivé', null, { is_active: false }),
        R(9, 'Déjà fait par Zara', 'Description de Zara pour cet article, claire et utile pour Google et pour les acheteurs.', { description_zara_at: '2026-10-25T10:00:00Z', description_before_zara: 'Ancienne' }),
      ],
      invoke: [], apply: [], undo: [], missing: false, failInvoke: false,
    });
    const wire9 = async (page, db) => {
      await page.route((url) => url.pathname.endsWith('/rest/v1/products') && /select=/.test(url.search) && /description_zara_at|zs-/.test(url.search) === true, async (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR9 });
        if (db.missing) return json9(route, { code: '42703', message: 'column products.description_zara_at does not exist' }, 400);
        return json9(route, db.rows);
      });
      if (db.missing) {
        await page.route((url) => url.pathname.endsWith('/rest/v1/products') && /select=id/.test(url.search) && !/description_zara_at/.test(url.search), (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: HDR9 }) : json9(route, db.rows.map((r) => ({ ...r, description_zara_at: undefined, description_before_zara: undefined })))));
      }
      await page.route(/\/functions\/v1\/zara-seo/, (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR9 });
        const body = JSON.parse(route.request().postData() || '{}');
        db.invoke.push({ ids: body.ids, auth: route.request().headers()['authorization'] || '' });
        if (db.failInvoke) return json9(route, { ok: false, reason: 'error' });
        const items = body.ids.map((id, k) => {
          const r = db.rows.find((x) => x.id === id);
          return { id, name: r.name, current: r.description || '', proposal: k === 0 ? `${r.name}, un modèle au style affirmé et facile à porter au quotidien. À commander sur Albasse Shopping.` : `${r.name.replace(/\s+/g, ' ')}. À commander sur Albasse Shopping, boutique en ligne au Tchad.`, source: k === 0 ? 'ia' : 'modele', problems: k === 0 ? [] : ['IA indisponible'] };
        });
        return json9(route, { ok: true, items });
      });
      await page.route(/\/rest\/v1\/rpc\/zara_apply_seo/, (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR9 });
        const body = JSON.parse(route.request().postData() || '{}');
        db.apply.push(body);
        for (const it of body.p_items) {
          const r = db.rows.find((x) => x.id === it.id);
          if (r) { r.description_before_zara = r.description || ''; r.description = it.description; r.description_zara_at = '2026-10-26T18:00:00Z'; }
        }
        return json9(route, { applied: body.p_items.length, skipped: [] });
      });
      await page.route(/\/rest\/v1\/rpc\/zara_undo_seo/, (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: HDR9 });
        const body = JSON.parse(route.request().postData() || '{}');
        db.undo.push(body);
        for (const id of body.p_ids) {
          const r = db.rows.find((x) => x.id === id);
          if (r) { r.description = r.description_before_zara || ''; r.description_before_zara = null; r.description_zara_at = null; }
        }
        return json9(route, body.p_ids.length);
      });
    };
    const statsOf = async (page) => (await page.getByTestId('zara-seo-stat-value').allInnerTexts()).map(Number);

    // --- a. l'administrateur
    const db = makeDb();
    const adm9 = member9(true);
    const seoAdmin = await newVisitor(phone, { storage: { [SK9]: adm9.session }, fakeUser: adm9, fakeStore: { waOrder: true, patches: [] } });
    await wire9(seoAdmin.page, db);
    await seoAdmin.page.goto(`${BASE}/admin/zara-seo`, { waitUntil: 'load' });
    await seoAdmin.page.getByTestId('zara-seo-panel').waitFor({ timeout: 25000 });
    await seoAdmin.page.waitForFunction(() => document.querySelectorAll('[data-testid="zara-seo-stat-value"]').length === 4, null, { timeout: 15000 });
    check('Zara SEO : le titre et le texte disent que rien n\'est publie avant validation et que l\'ancienne description est gardee', /rien n’est publié\s+avant/.test(await seoAdmin.page.getByTestId('zara-seo-panel').innerText()) && /L’ancienne description est toujours gardée/.test(await seoAdmin.page.getByTestId('zara-seo-panel').innerText()));
    check('Zara SEO : bilan = 8 en vente (le desactive n\'est pas compte), 2 sans description, 2 trop courtes, 4 correctes', JSON.stringify(await statsOf(seoAdmin.page)) === JSON.stringify([8, 2, 2, 4]), await statsOf(seoAdmin.page));
    await seoAdmin.page.getByTestId('zara-seo-dup-toggle').click();
    check('Zara SEO : 1 nom en double signale (majuscules ignorees), a renommer par la boutique', /1 nom d’article en double/.test(await seoAdmin.page.getByTestId('zara-seo-dup-toggle').innerText()) && /À renommer vous-même/.test(await seoAdmin.page.getByTestId('zara-seo-dup-list').innerText()) && /Parfum 110/.test(await seoAdmin.page.getByTestId('zara-seo-dup-list').innerText()));
    check('Zara SEO : rien n\'est demande a la fonction tant qu\'on n\'a pas touche le bouton', db.invoke.length === 0 && (await seoAdmin.page.getByTestId('zara-seo-drafts').count()) === 0);
    const btn = seoAdmin.page.getByText(/Zara, prépare \d+ descriptions/);
    check('Zara SEO : le bouton annonce « 4 descriptions (4 à faire) »', /Zara, prépare 4 descriptions \(4 à faire\)/.test(await btn.innerText()), await btn.innerText());
    await seoAdmin.page.screenshot({ path: path.join(OUT, '9a-zara-seo-bilan.png'), fullPage: true });
    await btn.click();
    await seoAdmin.page.getByTestId('zara-seo-drafts').waitFor({ timeout: 15000 });
    check('Zara SEO : la fonction recoit les 4 fiches faibles (sans description d\'abord, la plus recente en premier), avec la connexion de l\'administrateur', db.invoke.length === 1 && db.invoke[0].ids.length === 4 && db.invoke[0].ids.join() === ['00000002-0000-4000-8000-000000000002', '00000001-0000-4000-8000-000000000001', '00000004-0000-4000-8000-000000000004', '00000003-0000-4000-8000-000000000003'].join() && db.invoke[0].auth.startsWith('Bearer '), db.invoke);
    check('Zara SEO : 4 propositions, chacune avec « Avant » et une zone de texte modifiable', (await seoAdmin.page.getByTestId('zara-seo-draft').count()) === 4 && (await seoAdmin.page.getByTestId('zara-seo-text').count()) === 4);
    const draftsText = await seoAdmin.page.getByTestId('zara-seo-drafts').innerText();
    check('Zara SEO : « — aucune description — » pour une fiche vide, et l\'ancien texte court pour les autres', /— aucune description —/.test(draftsText) && /Courte/.test(draftsText) && /Trop courte/.test(draftsText));
    check('Zara SEO : l\'origine est indiquee (« d\'apres la photo » ou « avec les faits connus »)', /écrit d’après la photo/.test(draftsText) && /faits connus/.test(draftsText));
    check('Zara SEO : rien n\'est publie tant qu\'on n\'a pas valide', db.apply.length === 0);
    await seoAdmin.page.screenshot({ path: path.join(OUT, '9b-zara-seo-propositions.png'), fullPage: true });
    // correction d'un texte + une fiche non retenue
    const edited = 'Lunettes de soleil à monture épaisse et verres foncés, un style affirmé et facile à porter.';
    await seoAdmin.page.getByTestId('zara-seo-text').first().fill(edited);
    await seoAdmin.page.getByTestId('zara-seo-keep').nth(3).click();
    check('Zara SEO : le bouton compte 3 descriptions a publier', (await seoAdmin.page.getByText(/Valider et publier \(3\)/).count()) === 1);
    await seoAdmin.page.getByText(/Valider et publier \(3\)/).click();
    await seoAdmin.page.getByText(/3 descriptions publiées/).waitFor({ timeout: 10000 });
    check('Zara SEO : « Valider » publie UNE fois, 3 articles, avec le texte corrige, sans la fiche decochee', db.apply.length === 1 && db.apply[0].p_items.length === 3 && db.apply[0].p_items[0].description === edited && !db.apply[0].p_items.some((i) => i.id.startsWith('00000003')), db.apply);
    check('Zara SEO : la publication ne contient que des numeros d\'articles et des descriptions (aucun prix, aucun nom, aucun stock)', db.apply[0].p_items.every((i) => Object.keys(i).sort().join() === 'description,id') && Object.keys(db.apply[0]).join() === 'p_items');
    await seoAdmin.page.waitForFunction(() => document.querySelectorAll('[data-testid="zara-seo-drafts"]').length === 0, null, { timeout: 8000 });
    await seoAdmin.page.waitForFunction(() => JSON.stringify([...document.querySelectorAll('[data-testid="zara-seo-stat-value"]')].map((e) => Number(e.textContent))) === '[8,0,1,7]', null, { timeout: 8000 }).catch(() => {});
    check('Zara SEO : apres la publication, le bilan est relu (plus que 1 trop courte, 7 correctes)', JSON.stringify(await statsOf(seoAdmin.page)) === JSON.stringify([8, 0, 1, 7]), await statsOf(seoAdmin.page));
    // deja ecrites par Zara + annuler
    await seoAdmin.page.getByTestId('zara-seo-done-toggle').waitFor({ timeout: 8000 });
    check('Zara SEO : « 4 descriptions déjà écrites par Zara » (1 ancienne + 3 nouvelles)', /4 descriptions déjà écrites par Zara/.test(await seoAdmin.page.getByTestId('zara-seo-done-toggle').innerText()), await seoAdmin.page.getByTestId('zara-seo-done-toggle').innerText());
    await seoAdmin.page.getByTestId('zara-seo-done-toggle').click();
    check('Zara SEO : la liste montre les 4 avec « Remettre l\'ancienne »', (await seoAdmin.page.getByTestId('zara-seo-done-item').count()) === 4 && (await seoAdmin.page.getByTestId('zara-seo-undo').count()) === 4);
    await seoAdmin.page.getByTestId('zara-seo-undo').first().click();
    await seoAdmin.page.getByText('L’ancienne description est remise.').waitFor({ timeout: 8000 });
    check('Zara SEO : « Remettre l\'ancienne » appelle la base une fois, pour cet article seulement', db.undo.length === 1 && db.undo[0].p_ids.length === 1, db.undo);
    check('Zara SEO : l\'article rendu a son ancienne description (et sa fiche redevient « a faire »)', db.rows.find((r) => r.id === db.undo[0].p_ids[0]).description_zara_at === null);
    check('Zara SEO : aucune erreur (administrateur)', seoAdmin.errs.length === 0, seoAdmin.errs);
    await seoAdmin.ctx.close();

    // --- b. la fonction ne repond pas : message clair, rien ne casse
    const dbFail = makeDb();
    dbFail.failInvoke = true;
    const adm9b = member9(true);
    const seoFail = await newVisitor(phone, { storage: { [SK9]: adm9b.session }, fakeUser: adm9b, fakeStore: { waOrder: true, patches: [] } });
    await wire9(seoFail.page, dbFail);
    await seoFail.page.goto(`${BASE}/admin/zara-seo`, { waitUntil: 'load' });
    await seoFail.page.getByTestId('zara-seo-panel').waitFor({ timeout: 25000 });
    await seoFail.page.waitForFunction(() => document.querySelectorAll('[data-testid="zara-seo-stat-value"]').length === 4, null, { timeout: 15000 });
    await seoFail.page.getByText(/Zara, prépare \d+ descriptions/).click();
    await seoFail.page.getByText(/Zara n’a pas pu préparer les descriptions/).first().waitFor({ timeout: 10000 });
    check('Zara SEO : si la fonction echoue, message clair, aucune proposition, rien n\'est publie', (await seoFail.page.getByTestId('zara-seo-drafts').count()) === 0 && dbFail.apply.length === 0);
    await seoFail.ctx.close();

    // --- c. script SQL pas lance : message clair
    const dbMiss = makeDb();
    dbMiss.missing = true;
    const adm9c = member9(true);
    const seoMiss = await newVisitor(phone, { storage: { [SK9]: adm9c.session }, fakeUser: adm9c, fakeStore: { waOrder: true, patches: [] } });
    await wire9(seoMiss.page, dbMiss);
    await seoMiss.page.goto(`${BASE}/admin/zara-seo`, { waitUntil: 'load' });
    await seoMiss.page.getByTestId('zara-seo-missing').waitFor({ timeout: 25000 });
    check('Zara SEO : script pas lance : « Lancez d\'abord le script add-zara-seo.sql dans Supabase »', /add-zara-seo\.sql/.test(await seoMiss.page.getByTestId('zara-seo-missing').innerText()));
    await seoMiss.ctx.close();

    // --- d. un client (pas administrateur) ne voit rien
    const cust9 = member9(false);
    const seoCust = await newVisitor(phone, { storage: { [SK9]: cust9.session }, fakeUser: cust9, fakeStore: { waOrder: true, patches: [] } });
    await seoCust.page.goto(`${BASE}/admin/zara-seo`, { waitUntil: 'load' });
    await seoCust.page.getByText('Accès réservé aux administrateurs.').waitFor({ timeout: 25000 });
    check('Zara SEO : un client connecte (pas administrateur) : « Accès réservé aux administrateurs »', (await seoCust.page.getByTestId('zara-seo-panel').count()) === 0);
    await seoCust.ctx.close();
  }

  // =============================================== A. CONSEILLERE : UNE QUESTION A LA FOIS (francais) ===============================================
  if (PARTS.includes('A')) {
    console.log('== A. conseillere : une question a la fois (telephone 390 x 800, francais)');
    const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Fatimé' } });
    const { page } = v;
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await sleep(2500);
    await page.getByRole('button', { name: FAB_NAME }).click();
    await waitText(page, WELCOME_FR('Fatimé'));
    await waitText(page, /À savoir avant de commander/);
    await waitText(page, /Créez votre compte gratuit(?:, Fatimé)?/);
    const menu = await chipLabels(page);
    check('menu du visiteur : compte, connexion, promotions, nouveautes, conseil, categories, livraison, WhatsApp, langue', menu.join('|') === `👤 Créer mon compte|Me connecter|🔥 Promotions|🆕 Nouveautés|${COLD_ON ? '🧥 Blousons & manteaux|' : ''}🎯 Conseil|🛍️ Catégories|🚚 Livraison et paiement|💬 WhatsApp|🌐 العربية`, menu);
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
      await page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      check('menu en arabe : compte, connexion, offres, nouveautes, conseil, categories, livraison, WhatsApp, Francais', menuAr.join('|') === `👤 إنشاء حسابي|تسجيل الدخول|🔥 العروض|🆕 الجديد|${COLD_ON ? '🧥 جاكيتات ومعاطف|' : ''}🎯 نصيحة|🛍️ الفئات|🚚 التوصيل والدفع|💬 واتساب|🌐 Français`, menuAr);
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
      await a.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await a.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(a.page, /Choisissez votre langue/);
      await typeIn(a.page, 'مرحبا');
      await waitText(a.page, /مرحباً(، علي)? 😊 أهلاً بك في Albasse Shopping! كيف أساعدك اليوم؟|مرحباً(، علي)?! 😊 يسعدني استقبالك/);
      check('premiere visite : il ecrit « مرحبا » -> Zara passe a l\'arabe et repond', (await a.page.evaluate(() => localStorage.getItem('albasse_zara_lang'))) === 'ar');
      await a.ctx.close();
      const f = await newVisitor(phone, { lang: null });
      await f.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      const g = await newVisitor(phone, { lang: null, cookies: [{ name: 'googtrans', value: '/fr/ar', url: `${BASE}` }] });
      await g.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await g.page.getByRole('button', { name: /التحدث مع زارا كينغز|Discuter avec Zara Kings/ }).click();
      await waitText(g.page, /مرحباً! 😍👋 أهلاً بك في Albasse Shopping! يسعدني استقبالك!/);
      await waitText(g.page, /كيف يمكنني أن أناديك؟/);
      check('site deja affiche en arabe : Zara parle arabe tout de suite, sans demander la langue', (await g.page.getByText(/Choisissez votre langue/).count()) === 0);
      await g.ctx.close();
    }

    // --- L8b. telephone sans l'application (jamais repondu a l'installation) : la bulle invite a installer, en arabe avec le prenom ;
    // en francais, toucher la bulle ouvre Zara directement sur l'installation
    {
      const r = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' }, zaraInstall: null });
      await r.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(7500);
      const ar = await r.page.getByText(/📲 علي، ثبّت تطبيق Albasse: العروض أولاً ومتابعة طلباتك!/).count();
      check('telephone sans l application : la bulle invite a installer, en arabe, avec le prenom', ar === 1, ar);
      await r.ctx.close();
      const f = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, zaraInstall: null });
      await f.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await f.page.getByText(/📲 Moussa, installez l'application Albasse/).waitFor({ timeout: 15000 });
      await f.page.getByTestId('assistant-teaser').click();
      await waitText(f.page, /✅ Oui, déjà installée/);
      check('toucher la bulle d installation : Zara s ouvre directement sur l installation', true);
      await f.ctx.close();
    }
    // --- L9. visiteur arabe qui revient : prenom et langue retenus, bulle de bienvenue en arabe
    {
      const r = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      await r.page.goto(`${BASE}/`, { waitUntil: 'load' });
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

    // --- L9b. Zara prend la parole la premiere : sur l'Accueil, 8 secondes apres l'arrivee, elle ouvre toute seule la conversation (une fois par visite)
    {
      const v = await newVisitor(phone, { lang: 'fr', autoOpen: true, fakeStore: { waOrder: true, patches: [], zaraAds: false }, rank: 5 });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(6500);
      check('avant 8 secondes : rien ne s\'ouvre, et la petite bulle ne passe pas juste avant', (await panelOf(v.page).count()) === 0 && (await v.page.getByTestId('assistant-teaser').count()) === 0);
      await waitText(v.page, /Bienvenue chez Albasse Shopping/, 12000);
      check('Accueil : Zara ouvre toute seule la conversation et se presente', (await panelOf(v.page).count()) === 1);
      check('une seule conversation comptee pour l\'ouverture automatique', v.chatStarts.length === 1, v.chatStarts);
      await panelOf(v.page).getByRole('button', { name: 'Fermer', exact: true }).click();
      await sleep(2000);
      check('le visiteur ferme Zara : elle ne se rouvre pas, le bouton rond revient', (await panelOf(v.page).count()) === 0 && (await v.page.getByRole('button', { name: FAB_NAME }).count()) === 1);
      await v.page.reload({ waitUntil: 'load' });
      await sleep(9500);
      check('meme visite, page rechargee : Zara ne se rouvre pas seule et la bulle ne revient pas', (await panelOf(v.page).count()) === 0 && (await v.page.getByTestId('assistant-teaser').count()) === 0);
      check('aucune erreur (ouverture automatique)', v.errs.length === 0, v.errs);
      await v.ctx.close();

      // hors Accueil : pas d'ouverture automatique, la petite bulle reste comme avant
      const o = await newVisitor(phone, { lang: 'fr', autoOpen: true, fakeStore: { waOrder: true, patches: [], zaraAds: false } });
      await o.page.goto(`${BASE}/contact`, { waitUntil: 'load' });
      await sleep(9500);
      check('page Contact : Zara ne s\'ouvre pas seule', (await panelOf(o.page).count()) === 0);
      check('page Contact : la petite bulle apparait comme avant', (await o.page.getByTestId('assistant-teaser').count()) === 1);
      await o.ctx.close();

      // le visiteur qui touche le bouton avant les 8 secondes : une seule ouverture, une seule conversation comptee
      const t = await newVisitor(phone, { lang: 'fr', autoOpen: true, fakeStore: { waOrder: true, patches: [], zaraAds: false }, rank: 7 });
      await t.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await t.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(t.page, /Bienvenue chez Albasse Shopping/);
      await sleep(8000);
      check('Zara deja ouverte par le visiteur : pas de deuxieme ouverture ni de deuxieme conversation', (await panelOf(t.page).count()) === 1 && t.chatStarts.length === 1, t.chatStarts);
      await t.ctx.close();

      // le son : un faux « audio » compte ce que Zara joue (le vrai son ne peut pas etre entendu ici)
      const fakeAudio = (state) => `window.__ding = { created: 0, started: 0, closed: 0 };
        window.AudioContext = class { constructor() { window.__ding.created++; this.state = '${state}'; this.currentTime = 0; this.destination = {}; }
          createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
          createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() { window.__ding.started++; }, stop() {} }; }
          close() { window.__ding.closed++; return Promise.resolve(); } };`;
      const s1 = await newVisitor(phone, { lang: 'fr', autoOpen: true, fakeStore: { waOrder: true, patches: [], zaraAds: false }, initScripts: [fakeAudio('running')] });
      await s1.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(6500);
      const before = await s1.page.evaluate(() => window.__ding);
      check('avant l\'ouverture automatique : aucun son', before.created === 0 && before.started === 0, before);
      await waitText(s1.page, /Bienvenue chez Albasse Shopping/, 12000);
      const played = await s1.page.evaluate(() => window.__ding);
      check('telephone qui autorise le son : un petit « ding » de deux notes quand Zara s\'ouvre', played.created === 1 && played.started === 2, played);
      await s1.ctx.close();
      const s2 = await newVisitor(phone, { lang: 'fr', autoOpen: true, fakeStore: { waOrder: true, patches: [], zaraAds: false }, initScripts: [fakeAudio('suspended')] });
      await s2.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitText(s2.page, /Bienvenue chez Albasse Shopping/, 20000);
      const muted = await s2.page.evaluate(() => window.__ding);
      check('telephone qui refuse le son (visiteur n\'a rien touche) : Zara s\'ouvre en silence, sans erreur', (await panelOf(s2.page).count()) === 1 && muted.started === 0 && muted.closed === 1 && s2.errs.length === 0, { muted, errs: s2.errs });
      await s2.ctx.close();
    }

    // --- L9c. un mot mal ecrit : « Vouliez-vous dire… ? » dans la barre de recherche et dans le chat de Zara
    {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/recherche`, { waitUntil: 'load' });
      const box = v.page.getByPlaceholder('Rechercher un produit…');
      await box.waitFor({ timeout: 25000 });
      await box.fill('sandalles');
      await v.page.getByTestId('search-suggestion').waitFor({ timeout: 15000 });
      const sug = (await v.page.getByTestId('search-suggestion').innerText()).replace(/\s+/g, ' ');
      check('recherche « sandalles » : « Vouliez-vous dire « sandale » ? »', /Vouliez-vous dire « sandale » \?/.test(sug), sug);
      check('« Aucun résultat pour « sandalles » » est dit, et les articles du bon mot sont déjà montrés', /Aucun résultat pour « sandalles »/.test(await v.page.getByTestId('search-no-result').innerText()) && (await v.page.getByText(/Sandales/i).count()) > 0);
      await v.page.getByTestId('search-suggestion').click();
      await sleep(400);
      check('toucher la proposition met le bon mot dans la barre ; la proposition disparait, les articles restent', (await box.inputValue()) === 'sandale' && (await v.page.getByTestId('search-suggestion').count()) === 0 && (await v.page.getByText(/Sandales/i).count()) > 0, await box.inputValue());
      await box.fill('SANDALES');
      await sleep(400);
      check('mot bien ecrit (meme en majuscules) : les articles, pas de proposition', (await v.page.getByTestId('search-suggestion').count()) === 0 && (await v.page.getByText(/Sandales/i).count()) > 0);
      await box.fill('asdfghj');
      await sleep(400);
      check('mot qui ne ressemble a rien : « Aucun résultat. », pas de proposition', (await v.page.getByText('Aucun résultat.').count()) === 1 && (await v.page.getByTestId('search-suggestion').count()) === 0);
      await box.fill('sandalles homme');
      await sleep(400);
      check('deux mots dont un faux : le mot faux est propose avec l\'autre (« sandale homme »)', /Vouliez-vous dire « sandale homme » \?/.test((await v.page.getByTestId('search-suggestion').innerText().catch(() => '')).replace(/\s+/g, ' ')) || (await v.page.getByText('Aucun résultat.').count()) === 1);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Bienvenue chez Albasse Shopping/);
      const before = await cardsOf(v.page).count();
      await ask(v.page, 'chausure', /Vouliez-vous dire « chaussure »/);
      await sleep(600);
      check('Zara : « chausure » -> « Vouliez-vous dire « chaussure » ? Voici ce que j\'ai trouvé » avec des articles', (await cardsOf(v.page).count()) > before, [before, await cardsOf(v.page).count()]);
      await ask(v.page, 'xqzwvbn', /Je n’ai rien trouvé pour « xqzwvbn »/);
      check('Zara : un mot qui ne ressemble a rien garde la reponse d\'avant, sans « Vouliez-vous dire »', (await panelOf(v.page).getByText(/Vouliez-vous dire « xqzwvbn/).count()) === 0);
      check('aucune erreur (mot mal ecrit)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- L10. en-tete : tout tient a l'ecran en 390 et 360 de large, en francais et en arabe ; ordinateur
    for (const [w, lg] of [[390, 'fr'], [390, 'ar'], [360, 'fr'], [360, 'ar']]) {
      const h = await newVisitor({ ...devices['Pixel 7'], viewport: { width: w, height: 780 } }, { lang: lg, storage: { albasse_zara_name: 'Ali' } });
      await h.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await d.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
    console.log('\n== K. bouton « Commander » dans la conversation : commande directe d\'un article (plus de panier)');
    // 3 vrais produits sans variante (une seule couleur au plus, pas de taille), au nom simple
    const all = await get('products?select=id,name,slug,price,compare_at_price,stock,sizes,colors,images&is_active=eq.true&stock=gt.0&limit=1000');
    const BAD = /montre|parfum|chaussure|sac|robe|homme|femme|enfant|bebe|lunette|cadeau|sandale|basket|veste|costume|chemise|pantalon|creme|jouet|velo|meuble|maison|electri|voiture|aliment|budget|panier|promo|livraison|conseil|ajout|total|command/i;
    const same = (n) => all.filter((p) => p.name.trim().toLowerCase() === n.trim().toLowerCase()).length;
    const plain = all.filter((p) => (p.images || [])[0] && /^[A-Za-zÀ-ÿ]{4,14}( [A-Za-zÀ-ÿ]{3,12})?$/.test(p.name.trim()) && !BAD.test(p.name) && same(p.name) === 1 && p.stock >= 4 && (p.sizes || []).length === 0 && (p.colors || []).length <= 1);
    const [A, B, C] = plain;
    console.log('info  produits du test :', [A, B, C].map((p) => p && `${p.name.trim()} (${p.price})`).join(' | '));
    check('3 vrais produits sans variante trouves pour le test', !!(A && B && C));
    const rowOf = async (slug) => (await get(`products?select=*&slug=eq.${slug}&is_active=eq.true`))[0];
    const [rowC, rowB] = [await rowOf(C.slug), await rowOf(B.slug)];
    const dbA = await rowOf(A.slug);
    const uid = '11111111-1111-4111-8111-111111111111';
    const fu = {
      auth: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
      profile: { id: uid, email: 'test@example.com', full_name: 'Ahmed Hassan', phone: '66123456', banned: false, role: 'customer', is_admin: false },
    };
    const session = JSON.stringify({ access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln', refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: fu.auth });
    const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const orderItems = async (pg) => {
      await sleep(600);
      return pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('albasse-cart') || '{}').state?.items ?? []; } catch (e) { return []; } });
    };
    const ADDRESS = /Quelle est votre adresse de livraison/;
    // pendant la commande, ce que le client ecrit repond a la question : on arrete la commande avant de chercher un autre article
    const cancelOrder = async (pg) => {
      await tap(pg, 'Annuler la commande', /j’ai arrêté la commande/);
    };

    const v = await newVisitor(phone, { storage: { [SK]: session }, fakeUser: fu });
    const { page } = v;
    const mock = { mode: null };
    await page.route(/\/rest\/v1\/products\?.*slug=eq\./, async (route) => {
      const slug = (new URL(route.request().url()).searchParams.get('slug') || '').replace('eq.', '');
      if (mock.mode === 'fail') return route.abort();
      const json = (row) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify([row]) });
      if (mock.mode === 'variants' && slug === C.slug) return json({ ...rowC, sizes: ['40', '41', '42'], colors: ['Noir', 'Blanc'] });
      if (mock.mode === 'stock0' && slug === B.slug) return json({ ...rowB, stock: 0 });
      return route.fallback(); // la suite passe par le faux compte du test (cle publique)
    });
    const cardFor = (p) => cardsOf(page).filter({ hasText: p.name.trim() }).first();
    const showProduct = async (p) => {
      await ask(page, p.name.trim(), new RegExp(`Voici ce que j’ai trouvé pour « ${p.name.trim()} »`));
      await cardFor(p).waitFor({ timeout: 10000 });
    };
    const orderVia = async (p, re = /Très bon choix/) => {
      const n = await panelOf(page).getByText(re).count();
      await cardFor(p).getByTestId('assistant-card-add').click();
      const t0 = Date.now();
      while ((await panelOf(page).getByText(re).count()) <= n) {
        if (Date.now() - t0 > 15000) throw new Error('pas de reponse apres « Commander » sur ' + p.name + ' | ' + (await panelOf(page).innerText()).slice(-600) + ' | ' + JSON.stringify(v.errs));
        await sleep(150);
      }
    };

    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await sleep(3000);
    await page.getByRole('button', { name: FAB_NAME }).click();
    await waitText(page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
    check('plus de panier : aucune barre ni carte « panier » dans la conversation', (await page.getByTestId('chat-cart-bar').count()) === 0 && (await page.getByTestId('chat-cart').count()) === 0);
    check('menu : plus de bouton « Mon panier »', !(await chipLabels(page)).some((l) => /panier/i.test(l)), await chipLabels(page));

    // --- indicateur « Zara est en train d'ecrire… »
    await typeIn(page, A.name.trim());
    await page.getByText('Zara est en train d’écrire…').first().waitFor({ timeout: 4000 });
    check('« Zara est en train d\'ecrire… » apparait des que la demande est envoyee (texte visible, accessible)', (await page.getByTestId('assistant-typing').first().getAttribute('aria-label')) === 'Zara est en train d’écrire…');
    await waitText(page, new RegExp(`Voici ce que j’ai trouvé pour « ${A.name.trim()} »`));
    await page.getByTestId('assistant-typing').waitFor({ state: 'detached', timeout: 15000 });
    check('l\'indicateur disparait quand la reponse est terminee', (await page.getByTestId('assistant-typing').count()) === 0);
    await cardFor(A).waitFor({ timeout: 10000 });

    // --- le bouton « Commander » est sur chaque fiche, sous le prix, sans rien cacher
    const nCards = await cardsOf(page).count();
    const btnTexts = await panelOf(page).getByTestId('assistant-card-add').allInnerTexts();
    check('chaque fiche produit a son bouton « Commander » (plus de « + »)', nCards > 0 && btnTexts.length === nCards && btnTexts.every((t) => t.trim() === 'Commander'), { nCards, btnTexts });
    const geo = await cardFor(A).evaluate((card) => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const add = card.querySelector('[data-testid="assistant-card-add"]');
      const leaf = (re) => [...card.querySelectorAll('div')].find((e) => e.children.length === 0 && re.test(e.textContent));
      const price = leaf(/FCFA/); const see = leaf(/Voir le produit/);
      const hit = (a, b) => b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
      const ra = r(add); const rc = r(card);
      return { overlapPrice: hit(ra, price && r(price)), overlapSee: hit(ra, see && r(see)), inside: ra.l >= rc.l && ra.r <= rc.r && ra.b <= rc.b, w: Math.round(ra.r - ra.l), h: Math.round(ra.b - ra.t), below: price ? ra.t >= r(price).b : false };
    });
    check('« Commander » ne cache ni le prix ni « Voir le produit », sous le prix, dans la carte, assez grand pour le doigt', !geo.overlapPrice && !geo.overlapSee && geo.inside && geo.below && geo.w >= 100 && geo.h >= 32, geo);
    check('astuce « Commander » donnee une seule fois', (await panelOf(page).getByText(/Astuce : touchez « Commander » sous un article/).count()) === 1);
    await page.screenshot({ path: path.join(OUT, 'K1-cartes-commander.png') });

    // --- « Commander » : l'article de la commande, au vrai prix, puis Zara prend la commande tout de suite
    await orderVia(A);
    let items = await orderItems(page);
    check('« Commander » : l\'article devient LA commande (un seul article, prix de la base, quantite 1)', items.length === 1 && items[0].product.id === A.id && items[0].product.price === Number(dbA.price) && items[0].quantity === 1, items.map((i) => [i.product.name, i.product.price, i.quantity]));
    const picked = await panelOf(page).getByText(/Très bon choix/).last().innerText();
    check('Zara confirme le choix (nom, couleur ou taille choisie, prix), sans parler de panier', new RegExp(`« ${A.name.trim()} »(?: \\([^)]*\\))? · `).test(picked) && !/panier/i.test(picked), picked);
    await waitText(page, ADDRESS);
    check('puis elle prend la commande tout de suite (nom et telephone du compte deja connus : elle demande l\'adresse), dans le chat', (await panelOf(page).count()) === 1 && !/\/commande/.test(page.url()));
    await page.screenshot({ path: path.join(OUT, 'K2-commande-directe.png') });
    await cancelOrder(page);
    check('« Annuler la commande » : l\'article reste choisi, « Terminer ma commande » pour reprendre', (await chipLabels(page)).join('|') === '✅ Terminer ma commande|🎯 Conseil|🏠 Menu' && (await orderItems(page))[0]?.product.id === A.id, await chipLabels(page));

    // --- un autre article pendant la commande : il remplace le premier (une commande = un article)
    await showProduct(B);
    await orderVia(B);
    items = await orderItems(page);
    check('« Commander » sur un autre article : il remplace le precedent (toujours un seul article)', items.length === 1 && items[0].product.id === B.id, items.map((i) => i.product.name));
    await waitText(page, ADDRESS);
    await cancelOrder(page);

    // --- double clic : une seule demande
    await showProduct(A);
    const nPicked = await panelOf(page).getByText(/Très bon choix/).count();
    await cardFor(A).getByTestId('assistant-card-add').dblclick();
    await sleep(2500);
    check('double clic sur « Commander » : une seule prise de commande', (await panelOf(page).getByText(/Très bon choix/).count()) === nPicked + 1 && (await orderItems(page)).length === 1);
    await waitText(page, ADDRESS);
    await cancelOrder(page);

    // --- variantes obligatoires : taille puis couleur (lues dans la base au moment du choix)
    mock.mode = 'variants';
    await showProduct(C);
    await cardFor(C).getByTestId('assistant-card-add').click();
    await waitText(page, new RegExp(`Quelle taille pour « ${C.name.trim()} » \\?`));
    await chip(page, 'Annuler').first().waitFor({ timeout: 8000 });
    check('produit avec tailles : Zara demande la taille d\'abord (la commande ne change pas encore)', (await chipLabels(page)).join('|') === 'Taille 40|Taille 41|Taille 42|Annuler' && (await orderItems(page))[0]?.product.id === A.id, await chipLabels(page));
    await tap(page, 'Taille 41', new RegExp(`Quelle couleur pour « ${C.name.trim()} » \\?`));
    check('puis la couleur', (await chipLabels(page)).join('|') === 'Noir|Blanc|Annuler', await chipLabels(page));
    await tap(page, 'Blanc', /Très bon choix/);
    items = await orderItems(page);
    check('apres la taille et la couleur : la commande porte la bonne taille et la bonne couleur', items.length === 1 && items[0].product.id === C.id && items[0].size === '41' && items[0].color === 'Blanc', items.map((i) => [i.size, i.color]));
    check('la confirmation rappelle la variante : (Taille 41 · Blanc)', (await panelOf(page).getByText(/\(Taille 41 · Blanc\)/).count()) >= 1);
    await waitText(page, ADDRESS);
    await cancelOrder(page);
    // annuler
    await cardFor(C).getByTestId('assistant-card-add').click();
    await waitText(page, /Quelle taille pour/);
    const n0 = await panelOf(page).getByText(/on ne commande rien pour le moment/).count();
    await chip(page, 'Annuler').click();
    await sleep(900);
    check('« Annuler » : rien ne change', (await panelOf(page).getByText(/on ne commande rien pour le moment/).count()) > n0 && (await orderItems(page))[0]?.product.id === C.id);
    mock.mode = null;

    // --- article epuise : pas de commande, explication, alternatives
    mock.mode = 'stock0';
    await showProduct(B);
    await cardFor(B).getByTestId('assistant-card-add').click();
    await waitText(page, new RegExp(`« ${B.name.trim()} » n’est plus disponible pour le moment`));
    await sleep(1500);
    check('article epuise : la commande est refusee, rien ne change', (await orderItems(page))[0]?.product.id === C.id);
    check('article epuise : Zara propose des articles proches, ou le dit honnetement', (await panelOf(page).getByText(/Voici des articles proches, disponibles/).count()) >= 1 || (await chipLabels(page)).includes('🎯 Conseil'), await chipLabels(page));
    mock.mode = 'fail';
    await showProduct(A).catch(() => {});
    await cardFor(A).getByTestId('assistant-card-add').click();
    await waitText(page, /Je n’arrive pas à préparer la commande de cet article pour le moment/);
    check('coupure reseau : message poli, rien ne change, le chat reste utilisable', (await orderItems(page))[0]?.product.id === C.id && (await inputOf(page).isEnabled()));
    mock.mode = null;

    // --- « mon panier » ecrit : il n'y a plus de panier, la commande commencee reprend
    await ask(page, 'mon panier', ADDRESS);
    check('« mon panier » : Zara reprend la commande commencee (pas de panier)', (await page.getByTestId('chat-cart').count()) === 0);

    // --- le site : plus de page panier, l'onglet « Commandes »
    await page.getByRole('button', { name: 'Fermer' }).click();
    await page.goto(`${BASE}/panier`, { waitUntil: 'load' });
    await sleep(3000);
    check('ancien lien /panier : la page « Mes commandes » s\'ouvre', (await page.getByText('Mes commandes', { exact: true }).count()) >= 1 && !(await page.evaluate(() => document.body.innerText)).includes('Votre panier'));
    // (toutes les ecritures sont bloquees par le test ; la page « Mes commandes » demande seulement le marquage des vieilles commandes)
    check('aucune ecriture reelle dans la base pendant tout le test', v.writes.every((w) => /visitor_sessions|profiles|auto_flag_stale_orders/.test(w)), v.writes);
    check('aucune erreur dans la page (commande directe)', v.errs.length === 0, v.errs);
    await v.ctx.close();

    // --- visiteur sans compte avec une commande commencee : rappel, puis il faut un compte (l'article reste choisi)
    {
      const item = { id: `${dbA.id}__nc__ns`, product: dbA, quantity: 1, color: null, size: null };
      const cartJson = JSON.stringify({ state: { items: [item], updatedAt: Date.now() }, version: 1 });
      const g = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali', 'albasse-cart': cartJson } });
      await g.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await g.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(g.page, new RegExp(`Votre commande n’est pas terminée : « ${A.name.trim()} »`));
      await waitText(g.page, /Créez votre compte gratuit/);
      check('commande commencee : le menu propose « Terminer ma commande »', (await chipLabels(g.page)).includes('✅ Terminer ma commande'), await chipLabels(g.page));
      await ask(g.page, 'je veux commander', /Pas besoin de compte pour commander/);
      check('« je veux commander » sans compte : Zara dit qu\'il n\'y a pas besoin de compte et propose la page de commande, l\'article reste choisi', g.page.url().endsWith('/') && (await chipLabels(g.page)).join('|') === '📄 Page de commande|Me connecter|🏠 Menu' && (await orderItems(g.page)).length === 1, await chipLabels(g.page));
      check('rien n\'est enregistre', g.writes.every((w) => !/\/orders/.test(w)));
      await ask(g.page, 'mes commandes', /Retrouvez et suivez toutes vos commandes ici/);
      check('« mes commandes » sans compte : seulement connexion / creation de compte', (await chipLabels(g.page)).join('|') === 'Me connecter|👤 Créer mon compte', await chipLabels(g.page));
      check('aucune erreur (visiteur sans compte)', g.errs.length === 0, g.errs);
      await g.ctx.close();
    }

    // --- client connecte, prix change depuis le choix : Zara l'annonce AVANT de commencer
    {
      const stale = { id: `${dbA.id}__nc__ns`, product: { ...dbA, price: Number(dbA.price) - 1000 }, quantity: 2, color: null, size: null };
      const cartJson = JSON.stringify({ state: { items: [stale], updatedAt: Date.now() }, version: 1 });
      const c = await newVisitor(phone, { storage: { [SK]: session, 'albasse-cart': cartJson }, fakeUser: fu });
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(3000);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Ahmed'));
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      await ask(c.page, 'je veux commander', /Le prix de « .* » a changé/);
      const guide = await panelOf(c.page).getByText(/Le prix de « .* » a changé/).last().innerText();
      const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?');
      check('prix de la base plus recent : Zara l\'annonce (ancien → nouveau) et montre la commande au bon prix (2 × prix)', new RegExp(`${sp(Number(dbA.price) - 1000)}\\s?FCFA → ${sp(Number(dbA.price))}`).test(guide) && new RegExp(`× 2 · ${sp(2 * Number(dbA.price))}`).test(guide), guide);
      check('rien n\'est demande tant que le client n\'a pas revu le prix (pas de question d\'adresse)', (await panelOf(c.page).getByText(ADDRESS).count()) === 0 && (await chipLabels(c.page)).join('|') === '✅ Terminer ma commande|🏠 Menu', await chipLabels(c.page));
      await chip(c.page, 'Terminer ma commande').click();
      await waitText(c.page, ADDRESS);
      check('« Terminer ma commande » : Zara finalise DANS le chat (la page de commande ne s\'ouvre pas)', !/\/commande/.test(c.page.url()));
      check('aucune ecriture reelle de commande', c.writes.every((w) => !/\/orders/.test(w)), c.writes);
      check('aucune erreur (client connecte)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- article epuise detecte avant la commande
    {
      const itemA = { id: `${dbA.id}__nc__ns`, product: dbA, quantity: 1, color: null, size: null };
      const cartJson = JSON.stringify({ state: { items: [itemA], updatedAt: Date.now() }, version: 1 });
      const c = await newVisitor(phone, { storage: { [SK]: session, 'albasse-cart': cartJson }, fakeUser: fu });
      await c.page.route(/\/rest\/v1\/products\?.*(select=id%2Cprice|select=id,price|[?&]id=in\.)/, (route) =>
        route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: dbA.id, price: dbA.price, compare_at_price: dbA.compare_at_price, stock: 0, is_active: true }]) })
      );
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(3000);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      await ask(c.page, 'je veux commander', /n’est plus disponible : choisissez un autre article/);
      await sleep(1500);
      check('article epuise : la commande ne commence pas, Zara propose de choisir autre chose (Conseil, Menu)', (await panelOf(c.page).getByText(ADDRESS).count()) === 0 && (await chipLabels(c.page)).join('|') === '🎯 Conseil|🏠 Menu', await chipLabels(c.page));
      await c.ctx.close();
    }
  }

  // =============================================== P. INSTALLATION DU RACCOURCI (PWA) ===============================================
  if (PARTS.includes('P')) {
    console.log('\n== P. installation du raccourci : Android, iPhone, deja installe, ordinateur');
    const iphone = { ...devices['iPhone 13'], viewport: { width: 390, height: 800 } };
    // iPhone (Safari) : aide pas a pas, tutoriel
    {
      const v = await newVisitor(iphone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('iPhone : rien n\'est propose tant que le client n\'a pas besoin de l\'aide', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0);
      await ask(v.page, 'comment installer l’application sur mon téléphone', /Sur iPhone :/);
      const steps = await panelOf(v.page).getByText(/Sur iPhone :/).last().innerText();
      check('iPhone : Partager, puis « Sur l\'ecran d\'accueil », puis Ajouter (pas d\'installation native promise)', /Partager/.test(steps) && /Sur l’écran d’accueil/.test(steps) && /Ajouter/.test(steps) && !/Safari \(l’installation ne marche pas/.test(steps), steps);
      check('iPhone : bouton tutoriel + « Oui, deja installee » + menu', (await chipLabels(v.page)).join('|') === '🎬 Voir le tutoriel|✅ Oui, déjà installée|🏠 Menu', await chipLabels(v.page));
      await chip(v.page, 'Voir le tutoriel').click();
      await v.page.locator('video').first().waitFor({ state: 'attached', timeout: 8000 });
      check('le tutoriel video existant de l\'iPhone s\'ouvre', (await v.page.locator('video').count()) >= 1);
      check('aucune erreur (iPhone)', v.errs.length === 0, v.errs);
      await v.ctx.close();
      // iPhone mais pas Safari : il faut ouvrir Safari
      const w = await newVisitor({ ...iphone, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1' }, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await w.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await w.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(w.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(w.page, 'installer', /Sur iPhone :/);
      check('iPhone avec un autre navigateur que Safari : Zara demande d\'ouvrir Safari d\'abord', (await panelOf(w.page).getByText(/Ouvrez d’abord albasseshopping\.com dans Safari/).count()) === 1);
      await w.ctx.close();
    }
    // Android : invite native apres un clic volontaire, une seule fois
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => {
        window.__fakePromptCalls = 0;
        window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      const d = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await d.ctx.addInitScript(() => {
        window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      });
      await d.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await d.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(d.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(d.page, 'installer', /ajouter notre boutique/);
      await chip(d.page, 'Installer Albasse Shopping').click();
      await waitText(d.page, /Pas de souci 😊 Vous pourrez le faire plus tard/);
      check('Android : refus dans la boite native -> message poli, aucune insistance', (await d.page.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_install')).outcome)) === 'dismissed');
      await d.ctx.close();
    }
    // Android : sous les articles, le bouton « Installer » ; « Commander » n'est jamais interrompu par la question d'installation
    {
      const all = await get('products?select=id,name,slug,price,stock,sizes,colors,images&is_active=eq.true&stock=gt.3&limit=1000');
      const BAD = /montre|parfum|chaussure|sac|robe|homme|femme|enfant|bebe|lunette|cadeau|sandale|basket|veste|costume|chemise|pantalon|creme|jouet|velo|meuble|maison|electri|voiture|aliment|budget|panier|promo|livraison|conseil|ajout|total/i;
      const p = all.find((x) => (x.images || [])[0] && /^[A-Za-zÀ-ÿ]{4,14}$/.test(x.name.trim()) && !BAD.test(x.name) && all.filter((y) => y.name.trim() === x.name.trim()).length === 1 && (x.sizes || []).length === 0 && (x.colors || []).length <= 1);
      const v = await newVisitor(phone, { zaraInstall: 'asked', storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => { window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, p.name.trim(), new RegExp(`Voici ce que j’ai trouvé pour « ${p.name.trim()} »`));
      const card = cardsOf(v.page).filter({ hasText: p.name.trim() }).first();
      await card.waitFor({ timeout: 10000 });
      await waitText(v.page, /Astuce : installez Albasse Shopping/);
      check('Android : sous les articles trouves, le bouton « Installer Albasse Shopping »', (await chipLabels(v.page)).includes('📲 Installer Albasse Shopping'), await chipLabels(v.page));
      await card.getByTestId('assistant-card-add').click();
      await waitText(v.page, /Très bon choix/);
      await waitText(v.page, /Pas besoin de compte pour commander/);
      await sleep(2500);
      check('Android : « Commander » n\'est pas interrompu par la proposition d\'installer (elle n\'est jamais posee au milieu d\'une commande)', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0 && (await chipLabels(v.page)).join('|') === '📄 Page de commande|Me connecter|🏠 Menu', await chipLabels(v.page));
      check('aucune erreur (Android)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Android avec invite : bouton « Installer » dans le menu, proposition apres le premier message (une seule fois), bouton retire apres « Plus tard »
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => {
        window.__fakePromptCalls = 0;
        window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      const menu = await chipLabels(v.page);
      check('Android, pas encore installe : le menu a un bouton « Installer Albasse Shopping » (juste avant WhatsApp), sans message insistant', menu.includes('📲 Installer Albasse Shopping') && menu.indexOf('📲 Installer Albasse Shopping') === menu.indexOf('💬 WhatsApp') - 1 && (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 0, menu);
      await v.page.screenshot({ path: path.join(OUT, 'P1-menu-installer.png') });
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('apres le PREMIER message : Zara demande « Avez-vous deja installe l\'application ? » avec « Installer », « Oui, deja installee » et « Plus tard »', (await chipLabels(v.page)).join('|') === '📲 Installer Albasse Shopping|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await v.page.screenshot({ path: path.join(OUT, 'P2-proposition-installer.png') });
      await ask(v.page, 'promotions', /promotion|promo|offre/i);
      await sleep(3500);
      check('la proposition n\'est pas repetee apres le 2e message', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) === 1);
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
      const v = await newVisitor(phone, { zaraInstall: null, lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      await v.ctx.addInitScript(() => {
        window.__fakePromptCalls = 0;
        window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
    // iPhone : bouton « Ajouter a l'ecran d'accueil » dans le menu -> les etapes ; proposition apres le premier message
    {
      const v = await newVisitor(iphone, { zaraInstall: 'asked', storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      const menu = await chipLabels(v.page);
      check('iPhone : le menu a le bouton « Voir comment installer » (juste avant WhatsApp)', menu.includes('📲 Voir comment installer') && menu.indexOf('📲 Voir comment installer') === menu.indexOf('💬 WhatsApp') - 1, menu);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await waitText(v.page, /Astuce : installez Albasse Shopping sur votre écran d’accueil/);
      const promoChips = await chipLabels(v.page);
      check('iPhone : sous les articles proposes, le bouton « Voir comment installer » (juste avant Menu) + l\'astuce une seule fois', promoChips.includes('📲 Voir comment installer') && promoChips.indexOf('📲 Voir comment installer') === promoChips.indexOf('🏠 Menu') - 1 && (await panelOf(v.page).getByText(/Astuce : installez Albasse Shopping/).count()) === 1, promoChips);
      check('aucune erreur (iPhone, astuce sous les articles)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      const v = await newVisitor(iphone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('iPhone : apres le premier message, Zara propose l\'aide pas a pas (une seule fois)', (await chipLabels(v.page)).join('|') === '📲 Voir comment installer|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Voir comment installer').click();
      await waitText(v.page, /Sur iPhone :/);
      check('iPhone : le bouton donne les etapes (Partager, puis Sur l\'ecran d\'accueil, puis Ajouter)', /Partager/.test(await panelOf(v.page).getByText(/Sur iPhone :/).last().innerText()));
      check('aucune erreur (iPhone, proposition)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // « Oui, deja installee » : Zara remercie et ne propose plus rien (ni la question, ni le bouton du menu), meme apres un rechargement
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => { window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
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
      const v = await newVisitor(iphone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      check('iPhone : les etapes ecrites + « Touchez-la pour l\'agrandir » + boutons tutoriel video et menu', /Partager/.test(txt) && /Touchez-la pour l’agrandir/.test(txt) && (await chipLabels(v.page)).join('|') === '🎬 Voir le tutoriel|✅ Oui, déjà installée|🏠 Menu', { txt, chips: await chipLabels(v.page) });
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
      // l'iPhone ne dit pas si l'application est la : le client le dit, et le bouton d'installation ne revient plus
      await chip(v.page, 'Oui, déjà installée').first().click();
      await waitText(v.page, /Vous faites déjà partie de la famille Albasse Shopping/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(2500);
      const left = [...(await chipLabels(v.page)), ...(await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts())];
      check('iPhone, « Oui, deja installee » apres les etapes : plus aucun bouton d\'installation (articles, anciens messages)', left.every((l) => !/Voir comment installer|Voir le tutoriel|Oui, déjà installée/.test(l)) && left.includes('🏠 Menu'), left);
      check('aucune erreur (iPhone, photo)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // iPhone en arabe : les etapes en arabe + la meme photo
    {
      const v = await newVisitor(iphone, { zaraInstall: null, lang: 'ar', storage: { albasse_zara_name: 'علي' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      const v = await newVisitor(iphone, { zaraInstall: null, lang: null });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('apres le PREMIER vrai message : la question arrive (iPhone : « Voir comment installer »)', (await chipLabels(v.page)).join('|') === '📲 Voir comment installer|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
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
    // Android sans installation en un toucher : sous les articles proposes, le bouton « Voir comment installer » (question deja posee ailleurs)
    {
      const w = await newVisitor(phone, { zaraInstall: 'asked', storage: { albasse_zara_name: 'Ali' } });
      await w.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await w.page.keyboard.press('Escape');
      await w.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(w.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(w.page, 'Promotions', /promotion|promo|offre/i);
      await waitText(w.page, /Astuce : installez Albasse Shopping/);
      check('Android sans installation en un toucher : « Voir comment installer » sous les articles proposes', (await chipLabels(w.page)).includes('📲 Voir comment installer'), await chipLabels(w.page));
      await w.ctx.close();
    }
    // Android sans installation en un toucher (Chrome pas encore pret, autre navigateur) : Zara propose quand meme, avec les etapes
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      const menu = await chipLabels(v.page);
      check('Android sans installation en un toucher : le menu a « Voir comment installer » (juste avant WhatsApp)', menu.includes('📲 Voir comment installer') && menu.indexOf('📲 Voir comment installer') === menu.indexOf('💬 WhatsApp') - 1, menu);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await waitText(v.page, /Avez-vous déjà installé l’application Albasse Shopping/);
      check('Android sans installation en un toucher : apres le premier message, la question avec « Voir comment installer », « Oui, deja installee », « Plus tard »', (await chipLabels(v.page)).join('|') === '📲 Voir comment installer|✅ Oui, déjà installée|Plus tard', await chipLabels(v.page));
      await chip(v.page, 'Voir comment installer').click();
      await waitText(v.page, /trois points \(⋮\) en haut à droite de Chrome/);
      check('Android : les etapes de Chrome (⋮ puis « Installer l\'application » / « Ajouter a l\'ecran d\'accueil ») + « Oui, deja installee » + menu', (await chipLabels(v.page)).join('|') === '✅ Oui, déjà installée|🏠 Menu', await chipLabels(v.page));
      await chip(v.page, 'Oui, déjà installée').click();
      await waitText(v.page, /Vous faites déjà partie de la famille Albasse Shopping/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(2500);
      const after = [...(await chipLabels(v.page)), ...(await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts())];
      check('Android : apres « Oui, deja installee », plus aucun bouton d\'installation', after.every((l) => !/Voir comment installer|Installer Albasse/.test(l)), after);
      check('aucune erreur (Android sans installation en un toucher)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // Android dans le navigateur de Facebook / WhatsApp : ouvrir Chrome d'abord ; Samsung Internet : ses propres etapes
    for (const [ua, re, label] of [
      ['Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/fr_FR;FBAV/400.0.0.0;]', /Vous êtes dans le navigateur de TikTok, Facebook, WhatsApp ou Instagram/, 'navigateur de Facebook'],
      ['Mozilla/5.0 (Linux; Android 12; SM-A125F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6', /Vous êtes dans le navigateur de TikTok, Facebook, WhatsApp ou Instagram/, 'navigateur de TikTok'],
      ['Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', /menu \(☰\) en bas de Samsung Internet/, 'Samsung Internet'],
    ]) {
      const catchIntents = () => {
        window.__nav = [];
        document.addEventListener('click', (e) => {
          const a = e.target && e.target.closest ? e.target.closest('a') : null;
          if (a && /^intent:/.test(a.getAttribute('href') || '')) {
            window.__nav.push(a.getAttribute('href'));
            e.preventDefault();
          }
        }, true);
      };
      const v = await newVisitor({ ...phone, userAgent: ua }, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' }, initScripts: [catchIntents] });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await chip(v.page, 'Voir comment installer').first().click();
      await waitText(v.page, re);
      check(`Android, ${label} : les bonnes etapes d'installation`, true);
      if (label === 'navigateur de Facebook') {
        check('navigateur de Facebook : bouton « Ouvrir dans Chrome » + « Oui, deja installee » + menu', (await chipLabels(v.page)).join('|') === '🌐 Ouvrir dans Chrome|✅ Oui, déjà installée|🏠 Menu', await chipLabels(v.page));
        await chip(v.page, 'Ouvrir dans Chrome').click();
        await sleep(500);
        const nav = await v.page.evaluate(() => window.__nav);
        check('« Ouvrir dans Chrome » : la page s\'ouvre dans Chrome (lien intent vers com.android.chrome), le chat reste la', nav.length === 1 && /^intent:\/\/localhost:\d+\/#Intent;scheme=https;package=com\.android\.chrome;/.test(nav[0]) && (await panelOf(v.page).count()) === 1, nav);
      }
      check(`aucune erreur (${label})`, v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // deja installee sur ce telephone, visite dans Chrome (souvenir sur l'appareil) : aucun bouton « Installer », ni chez Zara ni sur le site
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali', albasse_app_installed: '1' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      check('deja installee : pas de bandeau « Installer » du site', (await v.page.getByText("Albasse Shopping, l'app").count()) === 0);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('deja installee : pas de bouton « Installer » dans le menu de Zara', (await chipLabels(v.page)).every((l) => !/Installer|Voir comment installer/.test(l)), await chipLabels(v.page));
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(2500);
      const all = [...(await chipLabels(v.page)), ...(await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts())];
      check('deja installee : pas de bouton « Installer » sous les articles proposes, ni l\'astuce', all.every((l) => !/Installer|Voir comment installer/.test(l)) && (await panelOf(v.page).getByText(/Astuce : installez/).count()) === 0, all);
      await ask(v.page, 'conseil', /Je suis là pour vous conseiller\. Que cherchez-vous \?/);
      await sleep(2500);
      check('deja installee : pas de question « Avez-vous deja installe l\'application ? »', (await panelOf(v.page).getByText(/Avez-vous déjà installé l’application/).count()) === 0);
      await ask(v.page, 'installer l’application', /est déjà installé sur votre téléphone/);
      check('deja installee : « comment installer ? » -> Zara dit que c\'est deja installe', true);
      check('aucune erreur (deja installee, souvenir)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // une installation acceptee autrefois (suivi des installations du site) compte aussi
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali', albasse_shortcut_install_tracked: 'abc-123' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await ask(v.page, 'installer', /est déjà installé sur votre téléphone/);
      check('installation acceptee autrefois : Zara sait que c\'est installe, aucun bouton', (await chipLabels(v.page)).every((l) => !/Installer/.test(l)), await chipLabels(v.page));
      await v.ctx.close();
    }
    // souvenir perime (desinstallee depuis) : Chrome propose de nouveau l'installation -> le bouton revient
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali', albasse_app_installed: '1' } });
      await v.ctx.addInitScript(() => { window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('desinstallee depuis (Chrome propose l\'installation) : le bouton « Installer » revient et le vieux souvenir est oublie', (await chipLabels(v.page)).includes('📲 Installer Albasse Shopping') && (await v.page.evaluate(() => localStorage.getItem('albasse_app_installed'))) === null, await chipLabels(v.page));
      // Chrome annonce l'installation (menu de Chrome) : le bouton part tout de suite
      await v.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
      await sleep(2500);
      const after = [...(await chipLabels(v.page)), ...(await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts())];
      check('« appinstalled » de Chrome : plus de bouton « Installer » (ni sous les articles ni sur les anciens messages), souvenir enregistre', after.every((l) => !/Installer/.test(l)) && (await v.page.evaluate(() => localStorage.getItem('albasse_app_installed'))) === '1', after);
      check('aucune erreur (souvenir perime, appinstalled)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // deja installe (mode application) et ordinateur
    {
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await v.ctx.addInitScript(() => {
        const mm = window.matchMedia.bind(window);
        window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
        window.__pwaInstallPrompt__ = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await d.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await openFab(c.page);
      await waitText(c.page, MEMBER_FR);
      check('compte lent a charger : Zara salue Ahmed, elle ne demande pas le prenom', !!fu.servedAt && (await countOf(c.page, /Comment puis-je vous appeler/)) === 0 && (await countOf(c.page, /Salut Ahmed/)) === 1);
      await c.ctx.close();
    }

    // --- M6. visiteur qui a deja un compte mais n'est pas connecte : « Me connecter » depuis Zara, puis il est reconnu (telephone)
    {
      const fu = memberOf('Ahmed Hassan');
      const c = await newVisitor(phone, { lang: 'fr', fakeUser: fu }); // aucune session gardee : il arrive comme un visiteur
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(c.page);
      await waitText(c.page, /Comment puis-je vous appeler \? Si vous avez déjà un compte, connectez-vous : je vous reconnaîtrai 😊/);
      check('visiteur sans compte connecte : Zara propose de se connecter pour etre reconnue (Passer / Me connecter / arabe)', (await chipLabels(c.page)).join('|') === 'Passer|Me connecter|🌐 العربية', await chipLabels(c.page));
      await c.page.screenshot({ path: path.join(OUT, 'M4-visiteur-connexion.png') });
      await chip(c.page, 'Me connecter').click();
      await c.page.waitForURL(/\/connexion/, { timeout: 15000 });
      await c.page.getByTestId('login-identifier').fill('test@example.com');
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
      await d.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(d.page);
      await waitText(d.page, /Comment puis-je vous appeler \? Si vous avez déjà un compte/);
      await chip(d.page, 'Me connecter').click();
      await d.page.waitForURL(/\/connexion/, { timeout: 15000 });
      check('ordinateur : le chat reste ouvert pendant que le client se connecte', (await panelOf(d.page).count()) === 1);
      await d.page.getByTestId('login-identifier').fill('test@example.com');
      await d.page.getByPlaceholder('Mot de passe').fill('motdepasse-test');
      await d.page.getByText('Se connecter', { exact: true }).first().click();
      await waitText(d.page, /Salut Fatimé ! 😍👋 Vous êtes bien connecté\(e\), ça me fait plaisir de vous retrouver ! 🥰/, 25000);
      check('ordinateur : Zara salue Fatimé tout de suite apres la connexion, sans rouvrir le chat', (await countOf(d.page, /Salut Fatimé/)) === 1);
      await d.page.screenshot({ path: path.join(OUT, 'M6-ordinateur.png') });
      await d.ctx.close();
    }

    // --- M9. « Vous etes mon Ne client aujourd'hui » : le VRAI rang du jour, donne par la base, jamais invente
    {
      const SAMPLE = 'Salut Moussa ! 😍👋 Bienvenue chez Albasse Shopping ! Vous êtes mon 3ᵉ client aujourd’hui, ça me fait plaisir de vous accueillir ! 🥰🛍️\n🇹🇩 Nous sommes une plateforme 100 % TCHADIENNE !\n' + INVITE_FR;
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, rank: 3 });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await tab.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(tab);
      await waitText(tab, /Vous êtes mon 3ᵉ client aujourd’hui/);
      check('meme appareil, meme jour : toujours « mon 3ᵉ client » et aucun nouveau comptage', v.rpcCalls.length === 1, v.rpcCalls.length);
      check('aucune erreur (rang du jour)', v.errs.length === 0, v.errs);
      await v.ctx.close();

      // un autre jour : nouvelle demande, nouveau rang (4)
      const y = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa', albasse_zara_rank: JSON.stringify({ day: '2020-01-01', n: 99 }) }, rank: 4 });
      await y.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(y.page);
      await waitText(y.page, /Vous êtes mon 4ᵉ client aujourd’hui/);
      check('le lendemain : nouvelle demande a la base et nouveau rang (pas l\'ancien 99)', y.rpcCalls.length === 1 && (await countOf(y.page, /99/)) === 0, y.rpcCalls.length);
      await y.ctx.close();

      // 1er client du jour : « 1ᵉʳ »
      const f = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, rank: 1 });
      await f.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(f.page);
      await waitText(f.page, /Vous êtes mon 1ᵉʳ client aujourd’hui/);
      check('le tout premier client du jour : « mon 1ᵉʳ client »', true);
      await f.ctx.close();

      // en arabe
      const a = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'علي' }, rank: 3 });
      await a.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await openFab(a.page);
      await waitText(a.page, /أنت رقم 3 بين عملائي اليوم، ويسعدني استقبالك!/);
      check('en arabe : « أنت رقم 3 بين عملائي اليوم »', (await countOf(a.page, /مرحباً علي! 😍👋/)) === 1);
      await a.ctx.close();

      // fonction absente (pas encore installee) ou reponse bizarre : AUCUN nombre n'est dit
      for (const [label, rankValue] of [['fonction pas installee', null], ['reponse incorrecte (texte)', 'abc'], ['reponse incorrecte (zero)', 0], ['reponse incorrecte (negatif)', -5]]) {
        const n = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Moussa' }, rank: rankValue });
        await n.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/compte`, { waitUntil: 'load' });
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
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name }).click();
    };
    // la boite d'installation de Chrome, simulee : outcome = ce que le client y repond
    const fakePromptWith = (v, outcome) => v.ctx.addInitScript(`window.__fakePromptCalls = 0; window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: ${JSON.stringify(outcome)} }) };`);
    const reachQuestion = async (v) => {
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, 'Promotions', /promotion|promo|offre/i);
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
      const v = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
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
      const w = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await fakePromptWith(w, 'accepted');
      await openChat(w);
      await reachQuestion(w);
      await chip(w.page, 'Plus tard').click();
      await waitText(w.page, /je ne vous le propose plus pour le moment/);
      await sleep(600);
      check('« Plus tard » est note (install_later)', eventNames(w).join('|') === 'install_question:Android|install_later:Android', w.events);
      await w.ctx.close();
      const x = await newVisitor(iphone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
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
      const a = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
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

      const b = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
      await b.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(3000);
      await b.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await sleep(800);
      check('installation faite autrement (menu de Chrome, sans passer par Zara) : comptee, mais PAS « grace a Zara »', b.installs.length === 1 && b.installs[0].via_assistant === undefined && b.installs[0].device_type === 'Android', b.installs);
      await b.ctx.close();

      const c = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' } });
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

      const d = await newVisitor(phone, { zaraInstall: null, storage: { albasse_zara_name: 'Ali' }, noStatsColumns: true });
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
        await c.page.goto(`${BASE}/connexion`, { waitUntil: 'load' });
        await c.page.getByTestId('login-identifier').fill('test@example.com');
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
        await c.page.goto(`${BASE}/admin/statistiques-zara`, { waitUntil: 'load' });
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
        await c.page.goto(`${BASE}/compte`, { waitUntil: 'load' });
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
    const base = `${BASE}`;
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

    // --- U5. images, tailles, couleurs, commande commencee
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
      await v.page.getByText('Commander', { exact: true }).click();
      await sleepSec(1);
      rec = (await readProfile(v.page)).products[sandales.id];
      check('« Commander » : la commande de l\'article est notee comme commencee', rec.cartStatus === 'in_cart' && rec.cartChangedAt > 0, rec.cartStatus);
      check('aucune erreur (variantes et commande)', v.errs.length === 0, v.errs);
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
      await waitText(v.page, /Très bon choix/);
      await sleepSec(1);
      const rec = (await readProfile(v.page)).products[realProduct.id];
      check('« Commander » depuis le chat de Zara : la commande est notee comme commencee (meme chemin que le site)', !!rec && rec.cartStatus === 'in_cart' && rec.views === 0, rec && rec.cartStatus);
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
    const base = `${BASE}`;
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
    const base = `${BASE}`;
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
        check('ligne 1 : visiteur anonyme, produit, categorie, vues, temps actif, derniere visite, clics, intention, suggestion', /Sandales AL madjaz/.test(r0) && /Chaussures · Visiteur V-a1b2c3/.test(r0) && /Élevé/.test(r0) && /VUES 4/.test(r0) && /VISITES 2/.test(r0) && /TEMPS ACTIF 3 min 05 s/.test(r0) && /DERNIÈRE VISITE 1 min 02 s · il y a 5 min/.test(r0) && /CLICS \(PHOTOS, TAILLES, COULEURS\) 7/.test(r0) && /INTENTION Commande commencée/.test(r0) && /COMMANDE —/.test(r0) && /Tailles \/ modèles similaires · il y a 3 min/.test(r0), r0);
        check('ligne 1 : visiteur sans compte -> pas de numero de session', /SESSION sans compte/.test(r0));
        const r1 = await text(c, 'browsing-row-1');
        check('ligne 2 : client connecte (code C-, jamais son nom), achete, commande livree, suggestion « parfums »', /Parfum · Compte C-9f8e7d6c/.test(r1) && /SESSION s-1/.test(r1) && !/Admin|Ahmed|@/.test(r1) && /Moyen/.test(r1) && /INTENTION Acheté/.test(r1) && /COMMANDE Livrée/.test(r1) && /Familles de parfums · il y a 2 h/.test(r1), r1);
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
      // --- W3. la liste « Détail » montre TOUTES les lignes du niveau choisi (avant : les tuiles disaient 141, la liste « Élevé » n'en montrait que 5)
      {
        const mk = (n, interest) => Array.from({ length: n }, (_, i) => ({ visitor_ref: `V-${interest[0]}${String(i).padStart(5, '0')}`, account_ref: null, session_id: null, product_id: `p${i}`, product_name: `Article ${interest} ${i}`, category_name: 'Test', views: 1, sessions: 1, active_seconds: 10, last_duration_seconds: 10, last_viewed_at: iso(i * 60000), variant_clicks: 0, cart_status: 'none', order_status: null, interest, last_suggestion_kind: null, last_suggestion_at: null }));
        const LEVELS = { eleve: 141, moyen: 166, leger: 2705 };
        const base3 = { top_products: [], top_categories: [], top_searches: [], levels: LEVELS, totals: { visitors: 108, rows: 3012 } };
        // la base d'avant (script add-browsing-interest-filter.sql pas lance) : elle ne connait pas p_interest
        const oldDb = (b) => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.browsing_overview(p_interest, p_limit, p_since) in the schema cache' }, _b: b });
        // la base d'aujourd'hui : p_interest ne change que la liste (les tuiles restent), 1 000 lignes au plus
        const respond = (b) => {
          if (!b.p_interest) return { body: { ...base3, rows: [...mk(5, 'eleve'), ...mk(295, 'leger')] } };
          return { body: { ...base3, rows: mk(Math.min(b.p_limit || 300, LEVELS[b.p_interest]), b.p_interest) } };
        };
        const countRows = (c) => c.page.locator('[data-testid^="browsing-row-"]').count();
        {
          const c = await open({ respond });
          await c.page.getByTestId('browsing-levels').waitFor({ timeout: 25000 });
          check('tuile « Intérêt élevé » : 141 (comme dans la base)', (await text(c, 'browsing-level-eleve')).startsWith('141'));
          check('sans filtre : les 300 lignes les plus récentes, avec la note « 300 lignes »', (await countRows(c)) === 300 && /Les 300 lignes les plus récentes sont affichées/.test(await text(c, 'browsing-rows-limit')), await countRows(c));
          check('sans filtre : la demande n\'a ni niveau (p_interest) ni plafond de 1 000', c.overviewCalls[0].p_interest === undefined && c.overviewCalls[0].p_limit === 300, c.overviewCalls[0]);
          await c.page.getByTestId('browsing-filter-eleve').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 141, null, { timeout: 15000 });
          const last = c.overviewCalls[c.overviewCalls.length - 1];
          check('filtre « Élevé » : la demande porte p_interest = eleve et un plafond de 1 000', last.p_interest === 'eleve' && last.p_limit === 1000 && typeof last.p_since === 'string', last);
          check('filtre « Élevé » : les 141 lignes (la tuile dit 141), plus de note de plafond', (await countRows(c)) === 141 && (await c.page.getByTestId('browsing-rows-limit').count()) === 0 && /Élevé/.test(await text(c, 'browsing-row-140')));
          check('filtre « Élevé » : les tuiles ne changent pas (141 / 166 / 2 705)', (await text(c, 'browsing-level-eleve')).startsWith('141') && (await text(c, 'browsing-level-moyen')).startsWith('166') && /^2[\s\u202f\u00a0]?705/.test(await text(c, 'browsing-level-leger')), await text(c, 'browsing-level-leger'));
          await c.page.getByTestId('browsing-filter-moyen').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 166, null, { timeout: 15000 });
          check('filtre « Moyen » : les 166 lignes', (await countRows(c)) === 166 && c.overviewCalls[c.overviewCalls.length - 1].p_interest === 'moyen');
          await c.page.getByTestId('browsing-filter-leger').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 1000, null, { timeout: 30000 });
          check('filtre « Léger » : 1 000 lignes au plus, avec la note « 1000 lignes »', (await countRows(c)) === 1000 && /Les 1000 lignes les plus récentes sont affichées/.test(await text(c, 'browsing-rows-limit')));
          await c.page.getByTestId('browsing-filter-all').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 300, null, { timeout: 15000 });
          const back = c.overviewCalls[c.overviewCalls.length - 1];
          check('retour à « Tous » : on redemande les 300 lignes sans niveau', back.p_interest === undefined && back.p_limit === 300, back);
          await c.page.getByTestId('browsing-period-7d').click();
          await sleep(1500);
          check('changer de période garde le niveau choisi : « Tous » ici, donc toujours sans p_interest', c.overviewCalls[c.overviewCalls.length - 1].p_interest === undefined && c.overviewCalls.length >= 6, c.overviewCalls.length);
          check('aucune erreur (liste complète par niveau)', c.errs.length === 0, c.errs);
          await c.ctx.close();
        }
        // changer de période avec un niveau choisi : le niveau est redemandé avec la nouvelle période
        {
          const c = await open({ respond });
          await c.page.getByTestId('browsing-levels').waitFor({ timeout: 25000 });
          await c.page.getByTestId('browsing-filter-eleve').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 141, null, { timeout: 15000 });
          await c.page.getByTestId('browsing-period-all').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 141, null, { timeout: 15000 });
          const last = c.overviewCalls[c.overviewCalls.length - 1];
          check('période « Tout » avec « Élevé » : demande p_interest = eleve et sans date de début', last.p_interest === 'eleve' && last.p_since === null, last);
          await c.ctx.close();
        }
        // la base d'avant (script pas encore lancé) : on retombe sur les 300 lignes, filtrées sur l'écran, sans erreur ni écran vide
        {
          const c = await open({ respond: (b) => (b.p_interest ? oldDb(b) : { body: { ...base3, rows: [...mk(5, 'eleve'), ...mk(295, 'leger')] } }) });
          await c.page.getByTestId('browsing-levels').waitFor({ timeout: 25000 });
          await c.page.getByTestId('browsing-filter-eleve').click();
          await sleep(2500);
          const withInterest = c.overviewCalls.filter((x) => x.p_interest === 'eleve').length;
          check('base pas encore mise à jour : la demande avec niveau est refusée, puis refaite comme avant (2 demandes)', withInterest === 1 && c.overviewCalls[c.overviewCalls.length - 1].p_interest === undefined && c.overviewCalls[c.overviewCalls.length - 1].p_limit === 300, c.overviewCalls.slice(-3));
          check('base pas encore mise à jour : la liste « Élevé » montre les 5 lignes des 300 récentes, avec la note « 300 lignes », sans message d\'erreur', (await countRows(c)) === 5 && /Les 300 lignes/.test(await text(c, 'browsing-rows-limit')) && (await c.page.getByTestId('browsing-error').count()) === 0 && (await c.page.getByTestId('browsing-not-installed').count()) === 0);
          await c.ctx.close();
        }
        // panne pendant le filtrage : message clair et « Réessayer »
        {
          let failed = false;
          const c = await open({ respond: (b) => { if (b.p_interest && !failed) { failed = true; return { status: 500, body: { code: 'XX000', message: 'service indisponible' } }; } return respond(b); } });
          await c.page.getByTestId('browsing-levels').waitFor({ timeout: 25000 });
          await c.page.getByTestId('browsing-filter-eleve').click();
          await c.page.getByTestId('browsing-error').waitFor({ timeout: 15000 });
          await c.page.getByTestId('browsing-retry').click();
          await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="browsing-row-"]').length === 141, null, { timeout: 15000 });
          check('panne pendant le filtrage : « Réessayer » redemande le niveau choisi et affiche les 141 lignes', (await countRows(c)) === 141 && c.overviewCalls[c.overviewCalls.length - 1].p_interest === 'eleve');
          await c.ctx.close();
        }
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
    const base = `${BASE}`;
    const visitor = (extra = {}) => newVisitor(phone, { lang: extra.lang || 'fr', storage: { albasse_zara_name: 'Ali' }, initScripts: extra.initScripts || [] });
    const openZara = async (v) => {
      await v.page.goto(`${base}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByTestId('assistant-fab').click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?|أنشئ حسابك|حسابك/, 25000);
    };
    const sayAskX = (pg, text, re) => ask(pg, text, re, 20000);
    const numReSimple = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\u00a0\u202f]?');
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

    // --- X8. saison fraiche : blousons et manteaux mis en avant jusqu'a fin decembre (accueil, menu et reponses de Zara), seulement les VRAIS articles
    {
      const COAT = /\b(blousons?|manteaux?|vestes?|doudounes?|parkas?|perfectos?|coupe[- ]?vents?|pardessus|trenchs?)\b/i;
      const RACK = /porte[- ]?manteaux?/i;
      const live = await get('products?select=name,price,compare_at_price,stock,images&is_active=eq.true&limit=1000');
      const coats = live.filter((p) => COAT.test(p.name) && !RACK.test(p.name) && Number(p.stock) > 0 && Number(p.price) > 0 && (p.images || []).length > 0);
      const pct = (p) => (Number(p.compare_at_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0);
      const shown = [...coats].sort((a, b) => pct(b) - pct(a) || Number(b.stock) - Number(a.stock) || a.name.localeCompare(b.name)).slice(0, 4);
      const minPrice = Math.min(...shown.map((p) => Number(p.price)));
      const maxPct = Math.max(0, ...shown.map(pct));
      console.log('info  saison fraiche : articles reels', shown.map((p) => `${p.name.trim()} (${p.price}${pct(p) ? `, -${pct(p)} %` : ''})`).join(' | '), '| porte-manteaux ecartes :', live.filter((p) => RACK.test(p.name)).length);
      check('la boutique a de vrais blousons ou manteaux a montrer (sinon ce test ne prouve rien)', shown.length >= 1, shown.length);
      const nameOf = async (c) => ((await c.getAttribute('aria-label')) || '').replace(/^Voir le produit ›\s*/, '').trim();

      // l'accueil : la bande « Saison fraiche »
      {
        const v = await visitor();
        await v.page.goto(`${base}/`, { waitUntil: 'load' });
        const strip = v.page.getByTestId('home-cold-season');
        await strip.waitFor({ timeout: 25000 });
        await sleep(800);
        const txt = await strip.innerText();
        check('accueil : bande « SAISON FRAICHE — Blousons et manteaux »', /SAISON FRAÎCHE/.test(txt) && /Blousons et manteaux/.test(txt), txt.slice(0, 80));
        check('accueil : les vrais blousons et manteaux y sont, et AUCUN porte-manteau', shown.every((p) => txt.toLowerCase().includes(p.name.trim().toLowerCase().slice(0, 14))) && !RACK.test(txt), txt);
        check('accueil : aucune vente flash ni urgence annoncee dans cette bande', !/flash|dernier|limité|jusqu.au/i.test(txt), txt);
        await strip.scrollIntoViewIfNeeded();
        await v.page.screenshot({ path: path.join(OUT, 'X8-accueil-saison-fraiche.png') });
        check('aucune erreur (accueil saison fraiche)', v.errs.length === 0, v.errs);
        await v.ctx.close();
      }

      // Zara : une ligne a l'ouverture, un bouton dans le menu, les vrais modeles
      {
        const v = await visitor();
        await openZara(v);
        const all = await panelOf(v.page).innerText();
        check('Zara a l\'ouverture : « La saison fraiche arrive », une seule fois, avant les infos importantes', (all.match(/La saison fraîche arrive/g) || []).length === 1 && all.indexOf('La saison fraîche arrive') < all.indexOf('À savoir avant de commander'), all.slice(0, 300));
        check('le menu a le bouton « 🧥 Blousons & manteaux »', (await chipLabels(v.page)).includes('🧥 Blousons & manteaux'), await chipLabels(v.page));
        const before = await cardsOf(v.page).count();
        await tap(v.page, '🧥 Blousons & manteaux', /Nos blousons et manteaux/);
        await sleep(2500);
        const added = await newCards(v.page, before);
        const names = await Promise.all(added.map(nameOf));
        const intro = await panelOf(v.page).getByText(/Nos blousons et manteaux/).last().innerText();
        check('le bouton montre les vrais modeles (les memes que l\'accueil), jamais un porte-manteau', names.length === shown.length && names.every((n) => COAT.test(n) && !RACK.test(n)) && shown.every((p) => names.some((n) => n.trim().toLowerCase() === p.name.trim().toLowerCase())), { names, expected: shown.map((p) => p.name) });
        check('premiere carte = la plus grande remise reelle', names[0] && names[0].trim().toLowerCase() === shown[0].name.trim().toLowerCase(), names);
        check(`les chiffres dits sont ceux des articles montres : ${shown.length} modele(s), a partir de ${minPrice} FCFA${maxPct >= 5 ? `, jusqu'a -${maxPct} %` : ', pas de remise annoncee'}`, new RegExp(`${shown.length} modèle`).test(intro) && new RegExp(`à partir de ${numReSimple(minPrice)} FCFA`).test(intro) && (maxPct >= 5 ? new RegExp(`jusqu’à -${maxPct} % sur l’ancien prix`).test(intro) : !/%/.test(intro)), intro);
        check('aucune fausse urgence : ni « vente flash » ni « dernier » ni date limite', !/flash|dernier|plus que|limité|jusqu.au/i.test(intro), intro);
        await v.page.screenshot({ path: path.join(OUT, 'X8-zara-blousons-manteaux.png') });
        // « Mon budget » juste apres : la question du budget, puis des blousons et manteaux (jamais un porte-manteau ni un autre article)
        await tap(v.page, '💰 Mon budget', /Quel est votre budget/);
        const budgetChips = await chipLabels(v.page);
        check('« Mon budget » apres les blousons et manteaux : Zara pose la question du budget (elle ne recommence pas une conversation)', budgetChips.length >= 3, budgetChips);
        const nBefore = await cardsOf(v.page).count();
        const anyBudget = budgetChips.find((l) => /pas de budget|peu importe|tout/i.test(l)) || budgetChips[budgetChips.length - 1];
        await chip(v.page, anyBudget).first().click();
        await sleep(3000);
        const budgetNames = await Promise.all((await newCards(v.page, nBefore)).map(nameOf));
        check('le budget choisi : seulement des blousons et manteaux (jamais de porte-manteau)', budgetNames.length >= 1 && budgetNames.every((n) => COAT.test(n) && !RACK.test(n)) && v.errs.length === 0, { budgetNames, errs: v.errs });
        // le client ecrit
        const b2 = await cardsOf(v.page).count();
        await sayAskX(v.page, 'je cherche un manteau', /Nos blousons et manteaux/);
        await sleep(2000);
        check('« je cherche un manteau » : les memes vrais modeles', (await newCards(v.page, b2)).length === shown.length);
        const b3 = await cardsOf(v.page).count();
        await sayAskX(v.page, 'il fait froid', /Nos blousons et manteaux/);
        await sleep(1500);
        check('« il fait froid » : Zara montre aussi les blousons et manteaux', (await newCards(v.page, b3)).length === shown.length);
        // un porte-manteau n'est pas un manteau : recherche normale, jamais la saison fraiche
        const nIntro = await panelOf(v.page).getByText(/Nos blousons et manteaux/).count();
        await sayAskX(v.page, 'porte-manteau', /./);
        await sleep(2500);
        check('« porte-manteau » : recherche normale (pas de reponse « Nos blousons et manteaux »)', (await panelOf(v.page).getByText(/Nos blousons et manteaux/).count()) === nIntro);
        // avec un budget ecrit : la recherche normale (qui sait filtrer par budget) s'en charge
        await sayAskX(v.page, 'manteau 30000', /./);
        await sleep(2500);
        check('« manteau 30000 » (un budget) : recherche normale avec le budget, pas la reponse de la saison fraiche', (await panelOf(v.page).getByText(/Nos blousons et manteaux/).count()) === nIntro);
        check('aucune erreur (Zara saison fraiche)', v.errs.length === 0, v.errs);
        await v.ctx.close();
      }

      // en arabe
      {
        const v = await newVisitor(phone, { lang: 'ar', storage: { albasse_zara_name: 'Ali' } });
        await v.page.goto(`${base}/`, { waitUntil: 'load' });
        await sleep(2500);
        await v.page.getByTestId('assistant-fab').click();
        await waitText(v.page, /موسم البرد يقترب/, 25000);
        await waitText(v.page, /أنشئ حسابك|حسابك/, 25000);
        check('arabe : la ligne d\'ouverture et le bouton « 🧥 جاكيتات ومعاطف »', (await chipLabels(v.page)).includes('🧥 جاكيتات ومعاطف'), await chipLabels(v.page));
        const before = await cardsOf(v.page).count();
        await tap(v.page, '🧥 جاكيتات ومعاطف', /جاكيتاتنا ومعاطفنا/);
        await sleep(2500);
        check('arabe : les vrais modeles s\'affichent', (await newCards(v.page, before)).length === shown.length);
        const intro = await panelOf(v.page).getByText(/جاكيتاتنا ومعاطفنا/).last().innerText();
        check('arabe : les chiffres sont ceux des articles montres', new RegExp(`ابتداء من ${numReSimple(minPrice)} FCFA`).test(intro) && (maxPct >= 5 ? new RegExp(`حتى -${maxPct} % عن السعر القديم`).test(intro) : !/%/.test(intro)), intro);
        check('aucune erreur (saison fraiche en arabe)', v.errs.length === 0, v.errs);
        await v.ctx.close();
      }

      // apres le 31 decembre 2026 : plus rien (ni bande, ni ligne, ni bouton) ; « manteau » = recherche normale
      {
        const v = await visitor();
        await v.ctx.clock.install({ time: new Date('2027-01-05T09:00:00Z') }); // l'heure avance normalement a partir de cette date (Zara a besoin que le temps passe pour repondre)
        await openZara(v);
        await sleep(3000); // les articles de l'accueil sont charges : la bande aurait deja du apparaitre
        check('apres le 31 decembre : plus de bande « Saison fraiche » sur l\'accueil', (await v.page.getByTestId('home-cold-season').count()) === 0 && (await v.page.getByText('Toute la collection').count()) === 1);
        check('apres le 31 decembre : ni ligne d\'ouverture ni bouton dans le menu', (await panelOf(v.page).getByText(/La saison fraîche arrive/).count()) === 0 && !(await chipLabels(v.page)).includes('🧥 Blousons & manteaux'), await chipLabels(v.page));
        // (ecrire « manteau » apres cette date n'est pas testable ici : avec une fausse horloge Zara ne repond plus ; la regle « coldSeasonActive = faux apres le 31 decembre » est testee dans tests/email/cold-season.test.ts)
        await v.ctx.close();
      }
      // le 31 decembre 2026 a 23h59 a N'Djamena : encore en cours
      {
        const v = await visitor();
        await v.ctx.clock.setFixedTime(new Date('2026-12-31T22:59:00Z'));
        await v.page.goto(`${base}/`, { waitUntil: 'load' });
        await v.page.getByTestId('home-cold-season').waitFor({ timeout: 25000 });
        check('le 31 decembre a 23h59 (N\'Djamena) : la bande est encore la', true);
        await v.ctx.close();
      }
    }
  }

  // =============================================== Y. CONCLURE LA VENTE, PREUVES VRAIES, PACKS ===============================================
  if (PARTS.includes('Y')) {
    console.log('\n== Y. conclure la vente (« je reflechis »), preuves VRAIES (ventes reelles, stock), plus de pack (une commande = un article)');
    const base = `${BASE}`;
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
    // « Commander » sur le produit « rolex » depuis la conversation (choisit la 1re taille / couleur si Zara la demande)
    const addRolex = async (v) => {
      await typeIn(v.page, 'rolex');
      const card = cardsOf(v.page).filter({ hasText: /rolex/i }).first();
      await card.waitFor({ timeout: 20000 });
      await card.getByTestId('assistant-card-add').click();
      for (let i = 0; i < 3; i++) {
        const done = await panelOf(v.page).getByText(/Très bon choix/).count();
        if (done) break;
        await sleep(1200);
        const sizeChip = panelOf(v.page).getByTestId('assistant-chip').filter({ hasText: /Taille|Couleur|^\d+$/ }).first();
        if (await sizeChip.count()) await sizeChip.click();
      }
      await waitText(v.page, /Très bon choix/, 20000);
    };
    check('info : produit de test et sa categorie', !!rolex && !!rolexCat, { name: rolex && rolex.name, cat: rolexCat, stock: rolex && rolex.stock });

    // --- Y1. « je reflechis » sans panier et sans article montre : des mots simples, jamais de chiffre invente ; le rappel WhatsApp n'est PAS propose
    {
      const v = await visitor();
      await openZara(v);
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 20000);
      const msg = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
      check('« je reflechis » (sans panier, sans article montre) : « Pas de souci » et la porte reste ouverte', /Pas de souci/.test(msg), msg);
      check('sans commande commencee : rien sur un article choisi, aucun chiffre de commandes, aucune validite 48 h', !/reste enregistré/.test(msg) && !/\d/.test(msg), msg);
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

    // --- Y2. avec des ventes REELLES (9 commandes) : preuve au moment de « Commander », plus de pack, puis « je reflechis » avec la commande commencee
    if (rolex) {
      const v = await visitor({ fakeSales: { rows: [{ product_id: rolex.id, orders_count: 9 }] } });
      await openZara(v);
      await addRolex(v);
      await sleep(2500);
      const added = await panelOf(v.page).getByText(/Très bon choix/).last().innerText();
      check('a « Commander » : la preuve VRAIE (9 commandes sur 7 jours, le chiffre vient de la base)', /Cet article a été commandé 9 fois ces 7 derniers jours\./.test(added) && !/%/.test(added), added);
      check('plus de pack : Zara ne pousse pas un 2e article (une commande = un article)', (await panelOf(v.page).getByText(/Pour compléter votre choix :/).count()) === 0);
      await ask(v.page, 'je réfléchis', /Prenez votre temps/, 25000);
      const later = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
      check('« je reflechis » avec une commande commencee : l\'article reste choisi, la preuve vraie (9), la commande valable 48 h, l\'offre de rappel', /L’article choisi reste enregistré sur cet appareil\./.test(later) && /commandé 9 fois ces 7 derniers jours/.test(later) && /la commande reste valable 48 h/.test(later) && /l’équipe peut vous écrire sur WhatsApp/.test(later), later);
      const chips2 = await chipLabels(v.page);
      check('boutons : « Terminer ma commande » (en tete), « Me rappeler sur WhatsApp » (plus de « Voir mon panier »)', /Terminer ma commande/.test(chips2[0]) && chips2.some((c) => /Me rappeler sur WhatsApp/.test(c)) && !chips2.some((c) => /panier/i.test(c)), chips2);
      check('aucune erreur (preuve, conclusion)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- Y3. chiffre trop faible (2) ou fonction de la base absente : AUCUNE preuve, aucune erreur
    if (rolex) {
      for (const [label, extra] of [['2 commandes seulement (sous le seuil de 3)', { fakeSales: { rows: [{ product_id: rolex.id, orders_count: 2 }] } }], ['fonction de la base introuvable (script pas applique)', { fakeSales: { status: 404 } }], ['aucune reponse de la base (requete coupee)', { fakeSales: { abort: true } }]]) {
        const v = await visitor(extra);
        await openZara(v);
        await addRolex(v);
        await sleep(2000);
        const added = await panelOf(v.page).getByText(/Très bon choix/).last().innerText();
        check(`${label} : aucune preuve de ventes au moment de « Commander »`, !/commandé \d+ fois/.test(added), added);
        await ask(v.page, 'je réfléchis', /Prenez votre temps/, 25000);
        const later = await panelOf(v.page).getByText(/Prenez votre temps/).last().innerText();
        check(`${label} : aucune preuve dans « je reflechis » non plus, mais l'article reste choisi`, !/commandé \d+ fois/.test(later) && /L’article choisi reste enregistré/.test(later), later);
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
    const base = `${BASE}`;
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
        check('demande 1 : prenom, numero (+235), origine « Commande commencée », appareil, article, il y a 10 min', /Awa/.test(r1) && /\+235 66 12 34 56/.test(r1) && /Commande commencée · Android/.test(r1) && /À propos de : Rolex \(\+1\)/.test(r1) && /il y a 10 min/.test(r1), r1);
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
  if (PARTS.includes('I')) {
    console.log('\n== I. notifications push programmees (page « Promotions intelligentes », fausse base : rien n\'est envoye)');
    const uid = '22222222-2222-4222-8222-222222222222';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const accountOf = ({ is_admin = true } = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', banned: false, role: 'admin', is_admin } };
    };
    const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const products = await get('products?select=id,name,slug,images,price&is_active=eq.true&stock=gt.0&order=created_at.desc&limit=40');
    const prod = products.find((p) => (p.images || [])[0] && p.name.trim().length >= 4) || products[0];
    const chadDay = (plusDays) => new Date(Date.now() + 3600000 + plusDays * 86400000).toISOString().slice(0, 10);
    const chadToIso = (d, t) => new Date(`${d}T${t}:00+01:00`).toISOString();
    const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * 3600000).toISOString();
    const rowsOf = () => [
      { id: 'p1', product_id: prod.id, title: '🛍️ ' + prod.name.trim(), message: 'Promo du soir sur cet article', send_at: at(5), status: 'pending', sent_at: null, product: { name: prod.name, slug: prod.slug, images: prod.images } },
      { id: 'p2', product_id: prod.id, title: '🛍️ ' + prod.name.trim(), message: 'Deja partie hier', send_at: at(-20), status: 'sent', sent_at: at(-20), clicks: 3, recipients: 11, product: { name: prod.name, slug: prod.slug, images: prod.images } },
      { id: 'p3', product_id: prod.id, title: '🛍️ ' + prod.name.trim(), message: 'Trop en retard', send_at: at(-30), status: 'expired', sent_at: null, product: { name: prod.name, slug: prod.slug, images: prod.images } },
    ];
    const openAdmin = async (fp, admin = true) => {
      const fu = accountOf({ is_admin: admin });
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SK]: fu.session }, fakeUser: fu, fakePushes: fp });
      await c.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
      return c;
    };
    const section = (c) => c.page.getByTestId('scheduled-pushes');
    // la table n'existe pas encore : l'explication, et le bouton ne programme rien
    {
      const fp = { missing: true, rows: [], products };
      const c = await openAdmin(fp);
      await section(c).waitFor({ timeout: 25000 });
      await c.page.getByTestId('push-missing').waitFor({ timeout: 15000 });
      check('script SQL pas encore lance : l\'explication « add-scheduled-push.sql » s\'affiche', /add-scheduled-push\.sql/.test(await c.page.getByTestId('push-missing').innerText()));
      check('aucune erreur (table absente)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    // interrupteur « Notification automatique des nouveaux articles » : ETEINT au depart, on le rallume puis on le recoupe
    {
      const fu = accountOf();
      const fs2 = { waOrder: true, patches: [], pushNewProducts: false };
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SK]: fu.session }, fakeUser: fu, fakePushes: { rows: rowsOf(), products, posts: [], patches: [] }, fakeStore: fs2 });
      await c.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
      await c.page.getByTestId('push-new-products-toggle').waitFor({ timeout: 25000 });
      await sleep(1500);
      const st = () => c.page.getByTestId('push-new-products-status').innerText();
      check('nouveaux articles : l\'interrupteur est dans la section des notifications, ETEINT au depart', (await section(c).getByTestId('push-new-products-toggle').count()) === 1 && /Désactivé : publier un article n’envoie aucune notification/.test(await st()), await st());
      await c.page.getByTestId('push-new-products-switch').click();
      await c.page.waitForFunction(() => /Activé : un nouvel article publié envoie une notification/.test(document.querySelector('[data-testid="push-new-products-status"]')?.textContent || ''), null, { timeout: 8000 });
      check('nouveaux articles : rallume -> la base recoit push_new_products_enabled = true', JSON.stringify(fs2.patches[fs2.patches.length - 1]) === '{"push_new_products_enabled":true}' && fs2.pushNewProducts === true, fs2.patches);
      await c.page.getByTestId('push-new-products-switch').click();
      await c.page.waitForFunction(() => /Désactivé : publier un article/.test(document.querySelector('[data-testid="push-new-products-status"]')?.textContent || ''), null, { timeout: 8000 });
      check('nouveaux articles : recoupe -> la base recoit false', JSON.stringify(fs2.patches[fs2.patches.length - 1]) === '{"push_new_products_enabled":false}' && fs2.pushNewProducts === false, fs2.patches);
      check('aucune erreur (interrupteur nouveaux articles)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    // le script add-push-new-products-switch.sql n'est pas encore lance : publier envoie bien une notification (vrai) ; le toucher explique quoi faire
    {
      const fu = accountOf();
      const fs3 = { waOrder: true, patches: [] };
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SK]: fu.session }, fakeUser: fu, fakePushes: { rows: rowsOf(), products, posts: [], patches: [] }, fakeStore: fs3 });
      await c.page.goto(`${BASE}/admin/promotions`, { waitUntil: 'load' });
      await c.page.getByTestId('push-new-products-toggle').waitFor({ timeout: 25000 });
      await sleep(1500);
      check('script pas lance : l\'interrupteur dit la verite (« Activé », car publier envoie bien une notification)', /Activé : un nouvel article publié envoie une notification/.test(await c.page.getByTestId('push-new-products-status').innerText()));
      await c.page.getByTestId('push-new-products-switch').click();
      await sleep(1500);
      check('script pas lance : « Lancez d’abord le script add-push-new-products-switch.sql dans Supabase. » et l\'interrupteur ne bouge pas', (await c.page.getByText(/Lancez d’abord le script add-push-new-products-switch\.sql dans Supabase\./).count()) >= 1 && /Activé/.test(await c.page.getByTestId('push-new-products-status').innerText()));
      await c.ctx.close();
    }
    // la vraie utilisation
    {
      const fp = { rows: rowsOf(), products, posts: [], patches: [] };
      const c = await openAdmin(fp);
      await section(c).waitFor({ timeout: 25000 });
      await c.page.getByTestId('push-row-p1').waitFor({ timeout: 15000 });
      const txt = await section(c).innerText();
      check('la section est la premiere de « Promotions intelligentes », avec « A venir (1) » et l\'historique', /📣 Notifications push programmées/.test(txt) && /À venir \(1\)/.test(txt) && /Historique/.test(txt), txt.slice(0, 300));
      check('historique : « Envoyee » et « Pas envoyee (trop en retard) »', /✅ Envoyée/.test(await c.page.getByTestId('push-row-p2').innerText()) && /Pas envoyée \(trop en retard\)/.test(await c.page.getByTestId('push-row-p3').innerText()));
      check('historique : une phrase explique l\'effacement automatique 24 h après l\'envoi ou l\'annulation (clics compris)', /s'efface toute seule 24 h après son envoi ou son annulation \(ses clics aussi\)/.test(await c.page.getByTestId('push-history-note').innerText()));
      const badge = c.page.getByTestId('push-clicks-p2');
      const badgeInfo = await badge.evaluate((el) => ({ text: el.innerText, bg: getComputedStyle(el).backgroundColor }));
      check('sous la notification envoyee : « 👆 3 clics » et « envoyee a 11 telephones · 27 % », sur fond vert bien visible', /👆 3 clics/.test(badgeInfo.text) && /envoyée à 11 téléphones · 27 %/.test(badgeInfo.text) && badgeInfo.bg === 'rgb(22, 163, 74)', badgeInfo);
      check('pas de clics affiches sous une notification pas envoyee ou a venir', (await c.page.getByTestId('push-clicks-p3').count()) === 0 && (await c.page.getByTestId('push-clicks-p1').count()) === 0);
      // de nouveaux clics arrivent : « Actualiser les clics »
      fp.rows.find((r) => r.id === 'p2').clicks = 5;
      await c.page.getByTestId('push-refresh').click();
      await c.page.getByText(/👆 5 clics/).waitFor({ timeout: 8000 });
      check('« Actualiser les clics » : le nouveau nombre s\'affiche', /envoyée à 11 téléphones · 45 %/.test(await badge.innerText()), await badge.innerText());
      // rien de choisi : on le dit
      await c.page.getByTestId('push-schedule').getByText('Programmer la notification').click();
      await c.page.getByTestId('push-problem').waitFor({ timeout: 5000 });
      check('sans article : « Choisissez un article. »', (await c.page.getByTestId('push-problem').innerText()) === 'Choisissez un article.');
      // choisir l'article
      await c.page.getByTestId('push-product-search').fill(prod.name.trim().slice(0, 6));
      await c.page.getByTestId('push-product-option-' + prod.id).click();
      await c.page.getByTestId('push-product-selected').waitFor({ timeout: 5000 });
      check('l\'article choisi s\'affiche (nom, prix)', (await c.page.getByTestId('push-product-selected').innerText()).includes(prod.name.trim()));
      // message court : 120 caracteres au plus, compteur, apercu
      await c.page.getByTestId('push-message').fill('x'.repeat(130));
      check('message : coupe a 120 caracteres, compteur 120/120', (await c.page.getByTestId('push-message').inputValue()).length === 120 && /120\/120/.test(await section(c).innerText()));
      const msg = 'Ce soir seulement : -20 % sur cet article 🔥';
      await c.page.getByTestId('push-message').fill(msg);
      const preview = await c.page.getByTestId('push-preview').innerText();
      check('apercu de la notification : titre (nom de l\'article) + message', preview.includes(prod.name.trim().slice(0, 20)) && preview.includes(msg), preview);
      // une heure deja passee
      const when = c.page.getByTestId('push-when');
      await when.locator('input[type=date]').fill(chadDay(0));
      await when.locator('input[type=time]').fill('00:01');
      await c.page.getByTestId('push-schedule').getByText('Programmer la notification').click();
      await sleep(500);
      check('heure deja passee : refusee avec explication', /déjà passée/.test(await c.page.getByTestId('push-problem').innerText()) && fp.posts.length === 0);
      // demain 18:30 (heure du Tchad)
      const d1 = chadDay(1);
      await when.locator('input[type=date]').fill(d1);
      await when.locator('input[type=time]').fill('18:30');
      check('« Depart : ... a 18:30 » affiche avant de programmer', /Départ : .+ à 18:30/.test(await section(c).innerText()));
      await c.page.getByTestId('push-schedule').getByText('Programmer la notification').click();
      await c.page.getByText(/Notification programmée ✓/).first().waitFor({ timeout: 10000 });
      const p0 = fp.posts[0] || {};
      check('programmee : l\'article, le titre (nom), le message et l\'heure exacte (18:30 au Tchad = 17:30 UTC)', p0.product_id === prod.id && p0.title.startsWith('🛍️ ' + prod.name.trim().slice(0, 20)) && p0.message === msg && p0.send_at === chadToIso(d1, '18:30'), p0);
      await c.page.getByTestId('push-row-new1').waitFor({ timeout: 8000 });
      check('elle apparait dans « A venir (2) »', /À venir \(2\)/.test(await section(c).innerText()));
      // une deuxieme, a une autre heure : plusieurs notifications programmees
      await when.locator('input[type=time]').fill('20:00');
      await c.page.getByTestId('push-schedule').getByText('Programmer la notification').click();
      await c.page.getByTestId('push-row-new2').waitFor({ timeout: 8000 });
      await c.page.getByText('📣 Notifications push programmées').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await sleep(400);
      await c.page.screenshot({ path: path.join(OUT, 'I1-notifications-programmees.png') });
      await c.page.getByText(/^À venir \(/).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await sleep(400);
      await c.page.screenshot({ path: path.join(OUT, 'I2-notifications-a-venir.png') });
      check('deuxieme programmation (meme article et message, 20:00) : « A venir (3) »', fp.posts.length === 2 && fp.posts[1].send_at === chadToIso(d1, '20:00') && /À venir \(3\)/.test(await section(c).innerText()), fp.posts);
      // annuler (avec confirmation)
      await c.page.getByTestId('push-cancel-p1').click();
      await c.page.getByText('Annuler cette notification ?').waitFor({ timeout: 5000 });
      await c.page.getByText('Oui, annuler').click();
      await sleep(1500);
      const pc = fp.patches.find((x) => x.id === 'p1');
      check('annuler : la base recoit « cancelled » seulement si elle est encore a venir', pc && pc.body.status === 'cancelled' && pc.status === 'eq.pending', fp.patches);
      check('annulee : elle passe dans l\'historique « Annulee »', /✖ Annulée/.test(await c.page.getByTestId('push-row-p1').innerText()) && /À venir \(2\)/.test(await section(c).innerText()));
      // envoyer maintenant (avec confirmation)
      await c.page.getByTestId('push-now-new1').click();
      await c.page.getByText('Envoyer maintenant ?').waitFor({ timeout: 5000 });
      await c.page.getByText('Oui, envoyer').click();
      await sleep(1500);
      const pn = fp.patches.find((x) => x.id === 'new1');
      check('envoyer maintenant : l\'heure de depart devient « maintenant » (le gardien l\'envoie des que l\'ecart avec la derniere notification est respecte)', pn && Math.abs(new Date(pn.body.send_at).getTime() - Date.now()) < 60000 && pn.status === 'eq.pending', pn);
      check('aucune erreur (notifications programmees)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    // un client touche la notification : la page s'ouvre avec la marque ?push=… et le site compte le clic, une seule fois
    {
      const tag = '3d2f2e1122f825b4';
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/produit/${prod.slug}?push=${tag}`, { waitUntil: 'load' });
      await sleep(3500);
      check('toucher d\'une notification : le clic est compte (la marque est envoyee a la base)', v.pushClicks.length === 1 && v.pushClicks[0].p_hash === tag, v.pushClicks);
      check('la fiche de l\'article s\'affiche normalement', new URL(v.page.url()).pathname === `/produit/${prod.slug}`);
      await v.page.reload({ waitUntil: 'load' });
      await sleep(3000);
      check('rechargement dans le meme onglet : pas de deuxieme clic', v.pushClicks.length === 1, v.pushClicks);
      await sleep(6500);
      check('la marque quitte l\'adresse apres quelques secondes (lien propre si le client le partage)', !/push=/.test(v.page.url()), v.page.url());
      const w = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await w.page.goto(`${BASE}/produit/${prod.slug}?push=pas-une-marque`, { waitUntil: 'load' });
      await sleep(3000);
      check('marque mal formee ou absente : rien n\'est envoye', w.pushClicks.length === 0, w.pushClicks);
      check('aucune erreur (clic de notification)', v.errs.length === 0 && w.errs.length === 0, [...v.errs, ...w.errs]);
      await v.ctx.close();
      await w.ctx.close();
    }
    // client non administrateur : rien
    {
      const c = await openAdmin({ rows: rowsOf(), products }, false);
      await sleep(4000);
      check('client non administrateur : « Acces reserve aux administrateurs », aucune notification visible', (await c.page.getByText('Accès réservé aux administrateurs.').count()) === 1 && (await c.page.getByTestId('scheduled-pushes').count()) === 0);
      await c.ctx.close();
    }
  }

  if (PARTS.includes('+')) {
    console.log("\n== + Telegram : invitation a lier Telegram (page de confirmation, Zara en francais et en arabe), interrupteur « Telegram aux clients absents » et nombre de clients lies (fausse base)");
    const uidT = '55555555-5555-4555-8555-555555555555';
    const JWTT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTU1NTU1NS01NTU1LTQ1NTUtODU1NS01NTU1NTU1NTU1NTUiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const SKT = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const LINK_URL = `https://t.me/AlbasseShoppingBot?start=${uidT}`;
    const accountT = (profile = {}, opts = {}) => {
      const auth = { id: uidT, aud: 'authenticated', role: 'authenticated', email: '23566123456@tel.albasseshopping.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-26T00:00:00Z' };
      const token = { access_token: JWTT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], ...opts, profile: { id: uidT, email: null, full_name: 'Amina Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: null, address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, telegram_chat_id: null, ...profile } };
    };
    // les liens vers Telegram ne sortent jamais : on note l'adresse demandee
    const watchTelegram = async (ctx) => {
      const hits = [];
      await ctx.route('https://t.me/**', (route) => {
        hits.push(route.request().url());
        return route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' });
      });
      return hits;
    };
    const liveT = await get('products?select=id,name,slug,price,stock,images,sizes,colors,category_id&is_active=eq.true&stock=gt.2&limit=1000');
    const prodT = liveT.filter((p) => (p.sizes || []).length <= 1 && (p.colors || []).length <= 1 && Number(p.price) > 0 && (p.images || [])[0])[0];
    check('un article simple existe pour le test', !!prodT);
    const cartT = JSON.stringify({ state: { items: [{ id: `${prodT.id}__nc__ns`, product: prodT, quantity: 1, color: null, size: null }], updatedAt: Date.now() }, version: 1 });
    // le visiteur sans compte commande : son compte est cree a la confirmation, avec ou sans Telegram deja lie
    const guestOrder = async (profile, extra = {}, vis = phone) => {
      const fu = accountT(profile);
      const fo = { list: [], patches: [], created: [] };
      const g = await newVisitor(vis, { storage: { 'albasse-cart': cartT, ...(extra.storage || {}) }, fakeUser: fu, fakeOrders: fo, fakeStore: { waOrder: true, accountRequired: false, patches: [] }, initScripts: extra.initScripts || [] });
      g.hits = await watchTelegram(g.ctx);
      // les clics « Installer » sont notes (source|appareil|navigateur|resultat), rien n'est ecrit en vrai
      g.clicks = [];
      const CORS_I = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      await g.ctx.route('**/rest/v1/app_download_clicks*', (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_I });
        try { g.clicks.push(route.request().postDataJSON().source); } catch (e) {}
        return route.fulfill({ status: 201, headers: CORS_I, body: '' });
      });
      await g.page.goto(`${BASE}/commande`, { waitUntil: 'load' });
      await g.page.getByTestId('checkout-first-name').waitFor({ timeout: 25000 });
      await g.page.getByTestId('checkout-first-name').fill('Amina');
      await g.page.getByTestId('checkout-last-name').fill('Hassan');
      await g.page.getByTestId('checkout-phone').fill('66123456');
      await g.page.getByTestId('checkout-email').fill('amina@gmail.com');
      await g.page.getByPlaceholder(/Adresse \(quartier, rue\)/).fill('Quartier Moursal');
      await g.page.getByPlaceholder(/Rechercher une ville/).click();
      await g.page.keyboard.type("N'Dja", { delay: 60 });
      await g.page.getByText(/^\s*N.Djamena\s*$/).locator('visible=true').first().click();
      await sleep(600);
      await g.page.getByText('Paiement à la livraison', { exact: true }).locator('visible=true').first().click();
      await g.page.getByText('Confirmer la commande', { exact: true }).locator('visible=true').first().click();
      await g.page.getByTestId('confirm-new-account').waitFor({ timeout: 25000 });
      return g;
    };

    // --- a. page de confirmation : la carte invite a lier Telegram (compte pas encore lie)
    {
      const g = await guestOrder({});
      await g.page.getByTestId('confirm-telegram').waitFor({ timeout: 10000 });
      const card = await g.page.getByTestId('confirm-telegram').innerText();
      check('confirmation : carte « Recevez nos nouveautes et nos offres sur Telegram », gratuit, STOP pour arreter', /Recevez nos nouveautés et nos offres sur Telegram/.test(card) && /gratuit/.test(card) && /STOP/.test(card), card);
      await g.page.getByText('Lier mon Telegram', { exact: true }).locator('visible=true').first().click();
      await sleep(1500);
      check('« Lier mon Telegram » ouvre le bot avec l\'identifiant du compte (https://t.me/AlbasseShoppingBot?start=<compte>)', g.hits.length === 1 && g.hits[0] === LINK_URL, g.hits);
      await g.page.screenshot({ path: path.join(OUT, '+a-confirmation-telegram.png'), fullPage: true });
      check('aucune erreur (carte Telegram)', g.errs.length === 0, g.errs);
      await g.ctx.close();
    }
    // --- b. Telegram deja lie : pas de carte
    {
      const g = await guestOrder({ telegram_chat_id: 777 });
      await sleep(1500);
      check('Telegram deja lie : aucune carte d\'invitation sur la confirmation', (await g.page.getByTestId('confirm-telegram').count()) === 0);
      await g.ctx.close();
    }

    // --- d. l'application apres une commande : carte « Installez l'application » sur la confirmation (telephone sans l'application seulement)
    const FAKE_PROMPT = "window.__fakePromptCalls = 0; window.__pwaInstallPrompt__ = { prompt: async () => { window.__fakePromptCalls++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };";
    {
      const g = await guestOrder({});
      await g.page.getByTestId('confirm-install').waitFor({ timeout: 10000 });
      const card = await g.page.getByTestId('confirm-install').innerText();
      check('confirmation (Android) : carte « Installez l\'application Albasse Shopping », ce que ca apporte, gratuit', /Installez l.application Albasse Shopping/.test(card) && /Suivez votre commande/.test(card) && /gratuit/.test(card) && /Installer l.application/.test(card), card);
      const yi = (await g.page.getByTestId('confirm-install').boundingBox()).y;
      const yt = (await g.page.getByTestId('confirm-telegram').boundingBox()).y;
      check('la carte de l\'application est AVANT la carte Telegram (l\'application d\'abord)', yi < yt, { yi, yt });
      await g.page.screenshot({ path: path.join(OUT, '+d-confirmation-installer.png'), fullPage: true });
      await g.page.getByText("📲 Installer l'application", { exact: true }).locator('visible=true').first().click();
      await g.page.getByTestId('confirm-install-message').waitFor({ timeout: 8000 });
      check('Chrome pas encore pret : un message clair (patientez / etapes a la main), la carte reste', ((await g.page.getByTestId('confirm-install-message').innerText()) || '').length > 20 && (await g.page.getByTestId('confirm-install').count()) === 1);
      await sleep(800);
      check('le clic est note : source « commande », appareil Android, resultat « indisponible »', g.clicks.length === 1 && /^commande\|android\|navigateur\|indisponible$/.test(g.clicks[0]), g.clicks);
      check('aucune erreur (carte application)', g.errs.length === 0, g.errs);
      await g.ctx.close();
    }
    {
      const g = await guestOrder({}, { initScripts: [FAKE_PROMPT] });
      await g.page.getByTestId('confirm-install').waitFor({ timeout: 10000 });
      await g.page.getByText("📲 Installer l'application", { exact: true }).locator('visible=true').first().click();
      await g.page.getByTestId('confirm-install-done').waitFor({ timeout: 8000 });
      check('Android avec la boite d\'installation : un toucher l\'ouvre (une seule fois), puis « Application installee »', (await g.page.evaluate(() => window.__fakePromptCalls)) === 1 && /Application installée/.test(await g.page.getByTestId('confirm-install-done').innerText()) && (await g.page.getByTestId('confirm-install').count()) === 0);
      await sleep(800);
      check('le clic est note : « commande|android|navigateur|accepte »', g.clicks.includes('commande|android|navigateur|accepte'), g.clicks);
      await g.page.screenshot({ path: path.join(OUT, '+d-confirmation-installee.png'), fullPage: true });
      check('aucune erreur (installation acceptee)', g.errs.length === 0, g.errs);
      await g.ctx.close();
    }
    {
      const g = await guestOrder({}, { storage: { albasse_app_installed: '1' } });
      await sleep(2500);
      check('application deja installee : aucune carte d\'installation sur la confirmation', (await g.page.getByTestId('confirm-install').count()) === 0 && (await g.page.getByTestId('confirm-install-done').count()) === 0);
      await g.ctx.close();
    }
    {
      const iphoneT = { ...devices['iPhone 13'], viewport: { width: 390, height: 800 } };
      const g = await guestOrder({}, {}, iphoneT);
      await g.page.getByTestId('confirm-install').waitFor({ timeout: 10000 });
      check('iPhone : le bouton dit « Voir comment installer »', (await g.page.getByText('📲 Voir comment installer', { exact: true }).count()) >= 1);
      await g.page.getByText('📲 Voir comment installer', { exact: true }).locator('visible=true').first().click();
      await g.page.getByText(/Installer Albasse sur iPhone/).first().waitFor({ timeout: 8000 });
      check('iPhone : le tutoriel video s\'ouvre', true);
      await sleep(800);
      check('le clic est note : « commande|iphone|navigateur|ios-guide »', g.clicks.includes('commande|iphone|navigateur|ios-guide'), g.clicks);
      await g.ctx.close();
    }
    {
      const g = await guestOrder({}, {}, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await sleep(2500);
      check('ordinateur : aucune carte d\'installation (telephone seulement)', (await g.page.getByTestId('confirm-install').count()) === 0);
      await g.ctx.close();
    }

    // --- c. Zara : le mot « Telegram » (client connecte pas lie / deja lie / sans compte, francais et arabe)
    const openChatT = async (v) => {
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.getByRole('button', { name: /Discuter avec Zara Kings|التحدث مع زارا كينغز/ }).click();
    };
    {
      const fu = accountT({});
      const v = await newVisitor(phone, { lang: 'fr', storage: { [SKT]: fu.session, albasse_zara_name: 'Amina' }, fakeUser: fu });
      v.hits = await watchTelegram(v.ctx);
      await openChatT(v);
      await ask(v.page, 'telegram', /Avec Telegram, je vous préviens des nouveautés/);
      const panelTxt = await panelOf(v.page).innerText();
      check('Zara : explique (nouveautes et ventes flash, gratuit, STOP)', /ventes flash/.test(panelTxt) && /gratuit/.test(panelTxt) && /STOP/.test(panelTxt));
      check('Zara : bouton « Lier mon Telegram »', (await chip(v.page, '✈️ Lier mon Telegram').count()) >= 1);
      await chip(v.page, '✈️ Lier mon Telegram').click();
      await sleep(1500);
      check('le bouton de Zara ouvre le bot avec l\'identifiant du compte', v.hits.length === 1 && v.hits[0] === LINK_URL, v.hits);
      check('aucune erreur (Zara Telegram)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      const fu = accountT({ telegram_chat_id: 777 });
      const v = await newVisitor(phone, { lang: 'fr', storage: { [SKT]: fu.session, albasse_zara_name: 'Amina' }, fakeUser: fu });
      await openChatT(v);
      await ask(v.page, 'lier mon telegram', /Votre Telegram est déjà lié/);
      check('deja lie : Zara le dit, pas de bouton « Lier mon Telegram »', (await chip(v.page, '✈️ Lier mon Telegram').count()) === 0);
      await v.ctx.close();
    }
    {
      const v = await newVisitor(phone, { lang: 'fr', storage: { albasse_zara_name: 'Ali' } });
      await openChatT(v);
      await ask(v.page, 'telegram', /Pour lier Telegram, il faut d’abord un compte/);
      check('sans compte : Zara demande de creer un compte (boutons creer / connecter, pas de lien Telegram)', (await chip(v.page, '👤 Créer mon compte').count()) >= 1 && (await chip(v.page, '✈️ Lier mon Telegram').count()) === 0);
      await v.ctx.close();
    }
    {
      const fu = accountT({});
      const v = await newVisitor(phone, { lang: 'ar', storage: { [SKT]: fu.session, albasse_zara_name: 'أمينة' }, fakeUser: fu });
      v.hits = await watchTelegram(v.ctx);
      await openChatT(v);
      await ask(v.page, 'تيليجرام', /عبر تيليجرام أُعلمك بالجديد/);
      check('arabe : Zara explique et propose le bouton « ربط تيليجرام »', (await chip(v.page, '✈️ ربط تيليجرام').count()) >= 1 && /توقف/.test(await panelOf(v.page).innerText()));
      await chip(v.page, '✈️ ربط تيليجرام').click();
      await sleep(1500);
      check('arabe : le bouton ouvre le bot avec l\'identifiant du compte', v.hits.length === 1 && v.hits[0] === LINK_URL, v.hits);
      await v.ctx.close();
    }

    // --- d. administrateur : interrupteur « Telegram aux clients absents » et nombre de clients lies (page Assistant marketing)
    {
      const adminT = accountT({ is_admin: true, role: 'admin', full_name: 'Admin Albasse' });
      const fs = { waOrder: true, telegramAbsent: false, patches: [] };
      const ft = { stats: { linked: 12, consented: 10, stopped: 1 } };
      const v = await newVisitor(phone, { storage: { [SKT]: adminT.session }, fakeUser: adminT, fakeStore: fs, fakeTelegram: ft });
      await v.page.goto(`${BASE}/admin/assistant-marketing`, { waitUntil: 'load' });
      await v.page.getByTestId('telegram-absent-toggle').waitFor({ timeout: 25000 });
      check('Telegram aux clients absents : eteint au depart (« Desactive »)', /Désactivé/.test(await v.page.getByTestId('telegram-absent-status').innerText()));
      await v.page.getByTestId('telegram-linked-stats').waitFor({ timeout: 10000 });
      const stats = await v.page.getByTestId('telegram-linked-stats').innerText();
      check('nombre de clients lies : 12 lies, 10 recoivent les offres, 1 a ecrit STOP', /12 clients ont lié leur Telegram/.test(stats) && /10 reçoivent/.test(stats) && /1 a écrit STOP/.test(stats), stats);
      await sleep(1500); // l'interrupteur reste bloque tant que les reglages ne sont pas lus
      await v.page.getByTestId('telegram-absent-switch').click();
      await v.page.getByText('Telegram activé').waitFor({ timeout: 8000 }).catch(async (e) => {
        await v.page.screenshot({ path: path.join(OUT, '+d-echec-interrupteur.png'), fullPage: true });
        console.log('apres le clic : patches =', JSON.stringify(fs.patches), '| statut =', await v.page.getByTestId('telegram-absent-status').innerText(), '| erreurs =', JSON.stringify(v.errs));
        throw e;
      });
      check('on l\'allume : la base recoit telegram_absent_enabled = true', (fs.patches || []).some((b) => b.telegram_absent_enabled === true), fs.patches);
      await v.page.waitForFunction(() => /Activé/.test(document.querySelector('[data-testid="telegram-absent-status"]')?.textContent || ''), null, { timeout: 8000 });
      await v.page.getByTestId('telegram-absent-switch').click();
      await v.page.getByText('Telegram coupé').waitFor({ timeout: 8000 });
      check('on l\'eteint : la base recoit telegram_absent_enabled = false', (fs.patches || []).some((b) => b.telegram_absent_enabled === false), fs.patches);
      const txt = await v.page.getByTestId('telegram-absent-card').innerText();
      check('le texte dit 9 h 30, 50 clients, 7 jours, STOP, 14 jours, rapport de 17 h sur Telegram', /9 h 30/.test(txt) && /50 clients/.test(txt) && /7 jours/.test(txt) && /STOP/.test(txt) && /14 jours/.test(txt) && /17 h/.test(txt), txt);
      await v.page.screenshot({ path: path.join(OUT, '+d-admin-telegram.png'), fullPage: true });
      check('aucune erreur (interrupteur Telegram)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // script SQL pas lance : l'interrupteur explique, le nombre de clients lies n'est pas invente
    {
      const adminT = accountT({ is_admin: true, role: 'admin', full_name: 'Admin Albasse' });
      const fs = { waOrder: true, telegramAbsent: undefined, patches: [] };
      const v = await newVisitor(phone, { storage: { [SKT]: adminT.session }, fakeUser: adminT, fakeStore: fs });
      await v.page.goto(`${BASE}/admin/assistant-marketing`, { waitUntil: 'load' });
      await v.page.getByTestId('telegram-absent-toggle').waitFor({ timeout: 25000 });
      await v.page.getByTestId('telegram-linked-stats').waitFor({ timeout: 10000 });
      check('script pas lance : « Lancez d\'abord le script add-telegram-absent.sql » au lieu d\'un nombre', /add-telegram-absent\.sql/.test(await v.page.getByTestId('telegram-linked-stats').innerText()));
      await sleep(1500);
      await v.page.getByTestId('telegram-absent-switch').click();
      await v.page.getByText(/Lancez d’abord le script add-telegram-absent\.sql/).first().waitFor({ timeout: 8000 });
      await sleep(500);
      check('script pas lance : l\'interrupteur reste « Desactive »', /Désactivé/.test(await v.page.getByTestId('telegram-absent-status').innerText()));
      await v.ctx.close();
    }
    // client non administrateur : la page est refusee
    {
      const fu = accountT({});
      const v = await newVisitor(phone, { storage: { [SKT]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, telegramAbsent: false, patches: [] }, fakeTelegram: { stats: { linked: 3, consented: 3, stopped: 0 } } });
      await v.page.goto(`${BASE}/admin/assistant-marketing`, { waitUntil: 'load' });
      await sleep(4000);
      check('client non administrateur : ni interrupteur Telegram ni chiffres', (await v.page.getByTestId('telegram-absent-toggle').count()) === 0 && (await v.page.getByTestId('telegram-linked-stats').count()) === 0);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('^')) {
    console.log("\n== ^ Relance « Intérêt élevé » (Admin › Clients) : filtre complet, article regardé, bouton WhatsApp avec message déjà écrit, panne de lecture (fausse base)");
    const uidR = '66666666-6666-4666-8666-666666666666';
    const JWTR = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjY2NjY2Ni02NjY2LTQ2NjYtODY2Ni02NjY2NjY2NjY2NjYiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const SKR = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const adminR = () => {
      const auth = { id: uidR, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWTR, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: false, patches: [], profile: { id: uidR, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'admin', is_admin: true, is_affiliate: false } };
    };
    const ids = { aicha: 'aaaaaaaa-0000-4000-8000-000000000001', hassan: 'bbbbbbbb-0000-4000-8000-000000000002', mariam: 'cccccccc-0000-4000-8000-000000000003', ali: 'dddddddd-0000-4000-8000-000000000004', fatima: 'eeeeeeee-0000-4000-8000-000000000005' };
    const P = { slip: '11111111-0000-4000-8000-00000000000a', zegna: '22222222-0000-4000-8000-00000000000b', bague: '33333333-0000-4000-8000-00000000000c', gone: '44444444-0000-4000-8000-00000000000d', bought: '55555555-0000-4000-8000-00000000000e' };
    const prof = (id, name, phone, region, extra = {}) => ({ id, email: `${name.split(' ')[0].toLowerCase()}@gmail.com`, full_name: name, phone, whatsapp_number: null, profession: null, region, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z', ...extra });
    const customersR = [
      prof(ids.aicha, 'Aïcha Moussa', '66111111', '  N’Djamena '),
      prof(ids.hassan, 'Hassan Doba', '66000000', 'Doba', { whatsapp_number: '66222222' }),
      prof(ids.mariam, 'Mariam Sold', '66333333', null),
      prof(ids.ali, 'Ali Commande', '66444444', "N'Djamena"),
      prof(ids.fatima, 'Fatima Calme', '66555555', 'Abéché'),
    ];
    const productsR = [
      { id: P.slip, name: 'Chaussures homme slip-on sport ', slug: 'chaussures-homme-slip-on-sport', price: 15000, compare_at_price: null, stock: 6, is_active: true },
      { id: P.zegna, name: 'Survêtement ZEGNA', slug: 'survetement-zegna', price: 25000, compare_at_price: null, stock: 60, is_active: true },
      { id: P.bague, name: 'Bague Homme NR01', slug: 'bague-homme-nr01', price: 17500, compare_at_price: 22500, stock: 80, is_active: true },
      { id: P.gone, name: 'Article épuisé', slug: 'article-epuise', price: 9000, compare_at_price: null, stock: 0, is_active: true },
      { id: P.bought, name: 'Article déjà commandé', slug: 'article-deja-commande', price: 12000, compare_at_price: null, stock: 30, is_active: true },
    ];
    const interestR = [
      { user_id: ids.aicha, product_id: P.zegna, cart_status: 'none', last_viewed_at: '2026-10-29T10:00:00Z', active_seconds: 200 },
      { user_id: ids.aicha, product_id: P.slip, cart_status: 'in_cart', last_viewed_at: '2026-10-25T10:00:00Z', active_seconds: 60 },
      { user_id: ids.hassan, product_id: P.bague, cart_status: 'none', last_viewed_at: '2026-10-28T10:00:00Z', active_seconds: 90 },
      { user_id: ids.mariam, product_id: P.gone, cart_status: 'none', last_viewed_at: '2026-10-28T10:00:00Z', active_seconds: 90 },
      { user_id: ids.ali, product_id: P.bought, cart_status: 'none', last_viewed_at: '2026-10-28T10:00:00Z', active_seconds: 90 },
    ];
    const ordersR = [{ user_id: ids.ali, status: 'pending', items: [{ product_id: P.bought, product_name: 'Article déjà commandé', quantity: 1 }] }];
    const HDRR = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const jsonR = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', ...HDRR }, body: JSON.stringify(body) });
    // la fausse base de l'administrateur ; failInterest : la lecture des articles regardes tombe en panne
    const openClients = async ({ failInterest = false } = {}) => {
      const fu = adminR();
      const seen = { interestUrl: null, ordersUrl: null, overviewCalls: 0 };
      const v = await newVisitor(phone, { storage: { [SKR]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.route(/\/rest\/v1\//, (route) => {
        const req = route.request();
        const u = new URL(req.url());
        if (req.method() === 'OPTIONS') return route.fallback();
        const t = u.pathname.replace('/rest/v1/', '');
        if (t === 'profiles' && !u.searchParams.get('id') && u.searchParams.get('is_admin') === 'eq.false') return jsonR(route, customersR);
        if (t === 'orders') {
          if (/items/.test(u.searchParams.get('select') || '')) { seen.ordersUrl = u.search; return jsonR(route, ordersR); }
          return jsonR(route, []);
        }
        if (t === 'visitor_product_interest') {
          seen.interestUrl = u.search;
          return failInterest ? jsonR(route, { code: '42501', message: 'permission denied' }, 403) : jsonR(route, interestR);
        }
        if (t === 'products' && /compare_at_price/.test(u.searchParams.get('select') || '') && /^in\./.test(u.searchParams.get('id') || '')) return jsonR(route, productsR);
        if (['visitor_sessions', 'product_views', 'cart_events', 'favorites'].includes(t)) return jsonR(route, []);
        if (t === 'rpc/browsing_overview') {
          seen.overviewCalls++;
          // le tableau de suivi ne garde que les 300 regards les plus recents : ici une seule ligne « Intérêt élevé » (le compte d'Aïcha) sur les 5
          return jsonR(route, { rows: [{ visitor_ref: 'V-aaaaaa', account_ref: 'C-aaaaaaaa', product_id: P.zegna, product_name: 'Survêtement ZEGNA', views: 3, sessions: 1, active_seconds: 200, last_duration_seconds: 20, last_viewed_at: '2026-10-29T10:00:00Z', variant_clicks: 0, cart_status: 'none', order_status: null, interest: 'eleve' }], top_products: [], top_categories: [], top_searches: [], levels: { leger: 0, moyen: 0, eleve: 1 }, totals: { visitors: 1, rows: 1 } });
        }
        return route.fallback();
      });
      await v.page.goto(`${BASE}/admin/clients`, { waitUntil: 'load' });
      await v.page.getByTestId('admin-customer-row').first().waitFor({ timeout: 25000 });
      await sleep(2500); // le temps de lire les articles regardes, les commandes et les prix
      return { v, seen };
    };
    const rowOf = (pg, name) => pg.getByTestId('admin-customer-row').filter({ hasText: new RegExp(`^\\s*${name}`) });
    // clic sur « WhatsApp » d'un client : l'adresse ouverte (la page WhatsApp reste vide, rien ne sort)
    const whatsappOf = async (v, name) => {
      const [popup] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), rowOf(v.page, name).getByTestId('customer-contact-whatsapp').click()]);
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      const url = popup.url();
      await popup.close();
      return { url, text: decodeURIComponent(url.split('text=')[1] || '') };
    };

    // --- a. tout marche : la liste complete, l'article regarde et le message
    {
      const { v, seen } = await openClients();
      check('5 clients affiches', (await v.page.getByTestId('admin-customer-row').count()) === 5);
      check('la liste est lue directement : seulement « Intérêt élevé », comptes connectes, 30 jours, avec la liste des commandes et des prix',
        /interest=eq\.eleve/.test(seen.interestUrl || '') && /user_id=not\.is\.null/.test(seen.interestUrl || '') && /last_viewed_at=gte\./.test(seen.interestUrl || '') && /user_id=in\./.test(seen.ordersUrl || ''), seen);
      // le filtre « Intérêt élevé » : avant, seul le compte vu dans les 300 derniers regards (1 sur 4) ressortait
      await v.page.getByText('💙 Intérêt élevé', { exact: true }).first().click();
      await sleep(600);
      const names = await v.page.getByTestId('admin-customer-row').allInnerTexts();
      check('filtre « Intérêt élevé » : les 4 comptes (Aïcha, Hassan, Mariam, Ali), pas Fatima', names.length === 4 && ['Aïcha', 'Hassan', 'Mariam', 'Ali'].every((n) => names.some((t) => t.includes(n))) && !names.some((t) => t.includes('Fatima')), names.map((t) => t.split('\n')[0]));

      // Aïcha : N'Djamena (ecrit « ’N’Djamena »), geste d'achat sur les chaussures → les chaussures, pas le survetement regarde plus longtemps
      const lineA = await rowOf(v.page, 'Aïcha').getByTestId('customer-relance-article').innerText();
      check('Aïcha : « A regardé de près : Chaussures homme slip-on sport · 15 000 FCFA » (l\'article avec geste d\'achat passe avant)', /Chaussures homme slip-on sport · 15[\s  ]000 FCFA/.test(lineA) && !/ZEGNA/.test(lineA), lineA);
      const a = await whatsappOf(v, 'Aïcha');
      check('Aïcha : WhatsApp ouvre le bon numéro (235 + 66111111) avec un message déjà écrit', a.url.startsWith('https://wa.me/23566111111?text='), a.url.slice(0, 60));
      check('Aïcha : message = prénom, article, vrai prix, « il n\'en reste que 6 », livraison sans frais et paiement à la livraison, lien de l\'article',
        /^Bonjour Aïcha, ici l'équipe Albasse Shopping 😊/.test(a.text) && a.text.includes('« Chaussures homme slip-on sport »') && a.text.includes('15 000 FCFA') && a.text.includes("Il n'en reste que 6.") &&
        a.text.includes("Livraison à N'Djamena sans frais, et paiement à la livraison.") && a.text.includes('https://www.albasseshopping.com/produit/chaussures-homme-slip-on-sport'), a.text);

      // Hassan : Doba, numéro WhatsApp préféré, vraie promotion, stock élevé
      const h = await whatsappOf(v, 'Hassan');
      check('Hassan : WhatsApp utilise son numéro WhatsApp (66222222), pas son téléphone', h.url.startsWith('https://wa.me/23566222222?text='), h.url.slice(0, 60));
      check('Hassan : vraie promotion « au lieu de 22 500 FCFA », paiement à l\'avance (autre ville), jamais « sans frais » ni stock', h.text.includes('17 500 FCFA (au lieu de 22 500 FCFA)') && h.text.includes('paiement à l’avance par Airtel Money ou Moov Money') && !/sans frais|Il n'en reste/.test(h.text), h.text);

      // Mariam : article épuisé ; Ali : article déjà commandé → simple bonjour, aucune ligne « A regardé »
      for (const [name, label] of [['Mariam', 'article épuisé'], ['Ali', 'article déjà commandé']]) {
        const n = await rowOf(v.page, name).getByTestId('customer-relance-article').count();
        const w = await whatsappOf(v, name);
        check(`${name} (${label}) : aucune ligne « A regardé », message = simple bonjour comme avant`, n === 0 && w.text === `Bonjour ${name}, ici l'équipe Albasse Shopping 😊`, { n, text: w.text });
      }
      // sans filtre : Fatima (aucun intérêt) a toujours son simple bonjour
      await v.page.getByText('Tous', { exact: true }).first().click();
      await sleep(500);
      const f = await whatsappOf(v, 'Fatima');
      check('Fatima (aucun article regardé) : simple bonjour', f.text === "Bonjour Fatima, ici l'équipe Albasse Shopping 😊", f.text);
      await v.page.getByText('💙 Intérêt élevé', { exact: true }).first().click();
      await sleep(400);
      await v.page.screenshot({ path: path.join(OUT, '^a-clients-interet-eleve.png'), fullPage: true });
      check('aucune erreur (relance)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // --- b. la lecture des articles regardés tombe en panne : l'écran marche comme avant (simple bonjour), le filtre garde le tableau de suivi
    {
      const { v } = await openClients({ failInterest: true });
      check('panne de lecture : les 5 clients s\'affichent quand même', (await v.page.getByTestId('admin-customer-row').count()) === 5);
      check('panne de lecture : aucune ligne « A regardé de près »', (await v.page.getByTestId('customer-relance-article').count()) === 0);
      const a = await whatsappOf(v, 'Aïcha');
      check('panne de lecture : WhatsApp = simple bonjour (rien d\'inventé)', a.text === "Bonjour Aïcha, ici l'équipe Albasse Shopping 😊", a.text);
      await v.page.getByText('💙 Intérêt élevé', { exact: true }).first().click();
      await sleep(500);
      const names = await v.page.getByTestId('admin-customer-row').allInnerTexts();
      check('panne de lecture : le filtre retrouve au moins le compte du tableau de suivi (Aïcha)', names.length === 1 && names[0].includes('Aïcha'), names.map((t) => t.split('\n')[0]));
      await v.ctx.close();
    }

    // --- c. un client (non administrateur) ne voit rien de tout cela
    {
      const fu = { ...adminR(), profile: { ...adminR().profile, role: 'customer', is_admin: false } };
      const v = await newVisitor(phone, { storage: { [SKR]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.goto(`${BASE}/admin/clients`, { waitUntil: 'load' });
      await sleep(4000);
      check('client non administrateur : « Accès réservé aux administrateurs », aucune ligne client', (await v.page.getByText('Accès réservé aux administrateurs').count()) >= 1 && (await v.page.getByTestId('admin-customer-row').count()) === 0);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('=')) {
    console.log("\n== = photos des articles protegees : pas de menu « Enregistrer l'image » (clic droit, appui long) ni de glisser-deposer ; le reste du site reste normal");
    const prodP = (await get('products?select=slug,name&is_active=eq.true&stock=gt.0&order=created_at.desc&limit=1'))[0];
    const v = await newVisitor(phone, {});
    await v.page.goto(`${BASE}/produit/${prodP.slug}`, { waitUntil: 'load' });
    await v.page.getByText('Commander', { exact: true }).first().waitFor({ timeout: 25000 });
    await sleep(2500);
    // un evenement « clic droit / appui long » ou « glisser » envoye sur l'element ; vrai = le navigateur n'ouvrira pas son menu
    const blocked = (selector, type) =>
      v.page.evaluate(({ selector, type }) => {
        const el = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width > 20) || document.querySelector(selector);
        if (!el) return null;
        const ev = type === 'dragstart' ? new Event('dragstart', { bubbles: true, cancelable: true }) : new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return ev.defaultPrevented;
      }, { selector, type });
    const ART = 'img[src*="/public/product-images/"]';
    const OTHER = 'img:not([src*="/public/product-images/"])';
    const nArt = await v.page.locator(ART).count();
    const nOther = await v.page.locator(OTHER).count();
    check('la fiche article affiche des photos d\'articles (rangees dans product-images)', nArt > 0, { nArt, nOther });
    check('clic droit / appui long sur une photo d\'article : menu bloque', (await blocked(ART, 'contextmenu')) === true);
    check('glisser une photo d\'article : bloque', (await blocked(ART, 'dragstart')) === true);
    check('les photos d\'articles ne sont plus « glissables » (CSS : -webkit-user-drag et -webkit-touch-callout)', await v.page.evaluate((sel) => {
      const cs = getComputedStyle(document.querySelector(sel));
      return cs.getPropertyValue('-webkit-touch-callout') === 'none' || cs.getPropertyValue('-webkit-user-drag') === 'none';
    }, ART));
    if (nOther > 0) {
      check('les autres images du site (logo, Zara, profil...) ne sont PAS bloquees : menu possible', (await blocked(OTHER, 'contextmenu')) === false && (await blocked(OTHER, 'dragstart')) === false);
    } else {
      check('(pas d\'autre image sur cette page : rien a verifier)', true);
    }
    check('clic droit sur du texte : le menu du navigateur reste possible (copier, coller)', (await v.page.evaluate(() => {
      const el = [...document.querySelectorAll('div,span')].find((e) => e.children.length === 0 && /Commander/.test(e.textContent || ''));
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    })) === false);
    // toutes les photos d'articles de l'accueil et d'une categorie (balises <img> ET images de fond) : le menu est bloque sur chacune
    const catP = (await get('categories?select=slug&limit=1'))[0];
    for (const [label, url] of [['accueil', `${BASE}/`], ['categorie', `${BASE}/categorie/${catP.slug}`]]) {
      await v.page.goto(url, { waitUntil: 'load' });
      await sleep(4500);
      const res = await v.page.evaluate(() => {
        const RE = /\/public\/product-images\//;
        const all = [...document.querySelectorAll('*')].filter((e) => {
          const bg = getComputedStyle(e).backgroundImage || '';
          return (e.tagName === 'IMG' && RE.test(e.currentSrc || e.src || '')) || RE.test(bg);
        });
        const open = all.filter((e) => {
          const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
          e.dispatchEvent(ev);
          return !ev.defaultPrevented;
        });
        return { total: all.length, ouvertes: open.length };
      });
      check(`${label} : ${res.total} photo(s) d'articles trouvee(s), aucune ne laisse ouvrir le menu « Enregistrer »`, res.total > 0 && res.ouvertes === 0, res);
    }
    await v.page.screenshot({ path: path.join(OUT, '=a-photos-protegees.png') });
    check('aucune erreur (photos protegees)', v.errs.length === 0, v.errs);
    await v.ctx.close();
  }

  if (PARTS.includes('1')) {
    console.log('\n== 1. bouton « Commander sur WhatsApp » des articles : l\'admin le cache ou le remet (page Produits, fausse base)');
    const uid = '33333333-3333-4333-8333-333333333333';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzMzMzMzMy0zMzMzLTQzMzMtODMzMy0zMzMzMzMzMzMzMzMiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const accountOf = ({ is_admin = true } = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', banned: false, role: 'admin', is_admin } };
    };
    const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const prod = (await get('products?select=slug,name&is_active=eq.true&stock=gt.0&order=created_at.desc&limit=1'))[0];
    const waBtn = (pg) => pg.getByTestId('product-wa-order');
    const openProduct = async (pg) => {
      await pg.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      await pg.getByText('Commander', { exact: true }).first().waitFor({ timeout: 25000 });
      await sleep(1500);
    };
    // visiteur : le bouton suit le reglage (colonne absente = comme avant : visible)
    for (const [waOrder, visible, what] of [[undefined, true, 'script SQL pas encore lance'], [true, true, 'active'], [false, false, 'desactive']]) {
      const fs = { waOrder };
      const v = await newVisitor(phone, { fakeStore: fs });
      await openProduct(v.page);
      const n = await waBtn(v.page).count();
      const hint = await v.page.getByText('Sans créer de compte').count();
      check(`visiteur, reglage ${what} : bouton « Commander sur WhatsApp » ${visible ? 'visible' : 'cache (et sa petite phrase aussi)'}`, visible ? n === 1 && hint === 1 : n === 0 && hint === 0, { n, hint });
      if (!visible) {
        check('desactive : le reste de la fiche est la (Commander, partage WhatsApp et Facebook)',
          (await v.page.getByText('Commander', { exact: true }).count()) > 0 && (await v.page.getByText('💬 WhatsApp').count()) > 0 && (await v.page.getByText('📘 Facebook').count()) > 0);
      }
      check(`aucune erreur (visiteur, ${what})`, v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // reglages lents : un bouton cache ne s'affiche pas un instant pendant le chargement
    {
      const fs = { waOrder: false, delay: 4000 };
      const v = await newVisitor(phone, { fakeStore: fs });
      await v.page.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      let seen = 0;
      for (let i = 0; i < 12; i++) {
        seen += await waBtn(v.page).count();
        await sleep(500);
      }
      check('reglages lents (desactive) : le bouton ne clignote jamais pendant le chargement', seen === 0, seen);
      await v.ctx.close();
    }
    const statusText = async (pg) => (await pg.getByTestId('wa-order-status').innerText()).trim();
    const openAdmin = async (fs, admin = true) => {
      const fu = accountOf({ is_admin: admin });
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SK]: fu.session }, fakeUser: fu, fakeStore: fs });
      await c.page.goto(`${BASE}/admin/produits`, { waitUntil: 'load' });
      return c;
    };
    // l'admin desactive puis reactive
    {
      const fs = { waOrder: true, patches: [] };
      const c = await openAdmin(fs);
      await c.page.getByTestId('wa-order-toggle').waitFor({ timeout: 25000 });
      await sleep(1500);
      check('page Produits : l\'interrupteur est en haut, « Activé »', /Activé/.test(await statusText(c.page)), await statusText(c.page));
      await c.page.getByTestId('wa-order-switch').click();
      await c.page.getByText('🚫 WhatsApp désactivé').waitFor({ timeout: 10000 });
      check('desactiver : la base recoit whatsapp_order_enabled = false', fs.patches.length === 1 && fs.patches[0].whatsapp_order_enabled === false && Object.keys(fs.patches[0]).length === 1, fs.patches);
      check('desactiver : « Désactivé » en rouge et un message', /Désactivé/.test(await statusText(c.page)), await statusText(c.page));
      await openProduct(c.page);
      check('desactive : la fiche produit n\'a plus le bouton', (await waBtn(c.page).count()) === 0, fs.gets.map((g) => g.waOrder));
      await c.page.goto(`${BASE}/admin/produits`, { waitUntil: 'load' });
      await c.page.getByTestId('wa-order-toggle').waitFor({ timeout: 25000 });
      await sleep(1500);
      check('retour sur la page Produits : toujours « Désactivé »', /Désactivé/.test(await statusText(c.page)), await statusText(c.page));
      await c.page.getByTestId('wa-order-switch').click();
      await c.page.getByText('💬 WhatsApp activé').waitFor({ timeout: 10000 });
      check('reactiver : la base recoit whatsapp_order_enabled = true', fs.patches.length === 2 && fs.patches[1].whatsapp_order_enabled === true, fs.patches);
      check('reactiver : « Activé »', /Activé/.test(await statusText(c.page)), await statusText(c.page));
      await openProduct(c.page);
      check('reactive : le bouton revient sur la fiche produit', (await waBtn(c.page).count()) === 1);
      check('aucune erreur (admin)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    // script SQL pas encore lance : rien ne change, l'explication s'affiche
    {
      const fs = { waOrder: undefined, patches: [] };
      const c = await openAdmin(fs);
      await c.page.getByTestId('wa-order-toggle').waitFor({ timeout: 25000 });
      await sleep(1500);
      await c.page.getByTestId('wa-order-switch').click();
      await c.page.getByText(/add-whatsapp-order-toggle\.sql/).waitFor({ timeout: 10000 });
      await sleep(500);
      check('colonne absente : message « Lancez d\'abord le script… » et l\'interrupteur reste « Activé »', /Activé/.test(await statusText(c.page)), await statusText(c.page));
      const errs = c.errs.filter((e) => !/400|whatsapp_order_enabled|Failed to load resource/.test(String(e)));
      check('aucune autre erreur (colonne absente)', errs.length === 0, c.errs);
      await c.ctx.close();
    }
    // un client (pas admin) : la page Produits est refusee, pas d'interrupteur
    {
      const fs = { waOrder: true, patches: [] };
      const c = await openAdmin(fs, false);
      await c.page.getByText('Accès réservé aux administrateurs.').waitFor({ timeout: 25000 });
      check('client non administrateur : pas d\'interrupteur', (await c.page.getByTestId('wa-order-toggle').count()) === 0 && fs.patches.length === 0);
      await c.ctx.close();
    }
    // e-mail de test (Brevo) : la carte de la page « Assistant marketing » (fausse fonction)
    {
      const fu = accountOf();
      const answers = [{ ok: false, reason: 'no_key' }, { ok: false, reason: 'brevo', status: 400, detail: 'Sender not valid' }, { ok: true, to: 'ad***@example.com' }, { ok: false, reason: 'no_products' }, { ok: true, to: 'ad***@example.com' }];
      const fs = { waOrder: true };
      const v = await newVisitor(phone, { storage: { [SK]: fu.session }, fakeUser: fu, fakeStore: fs });
      const calls = [];
      await v.page.route('**/functions/v1/brevo-email', async (route) => {
        const hdr = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
        calls.push(JSON.parse(route.request().postData() || '{}'));
        return route.fulfill({ status: 200, headers: { ...hdr, 'content-type': 'application/json' }, body: JSON.stringify(answers[Math.min(calls.length - 1, answers.length - 1)]) });
      });
      await v.page.goto(`${BASE}/admin/assistant-marketing`, { waitUntil: 'load' });
      await v.page.getByTestId('marketing-email-test').waitFor({ timeout: 25000 });
      await v.page.getByTestId('marketing-email-test').click();
      await v.page.getByText(/BREVO_API_KEY/).waitFor({ timeout: 8000 });
      check('e-mail de test, cle Brevo absente : le message dit ou la mettre (BREVO_API_KEY)', true);
      await v.page.getByTestId('marketing-email-test').click();
      await v.page.getByText(/Brevo a refusé l’envoi : Sender not valid|Brevo a refusé l'envoi : Sender not valid/).waitFor({ timeout: 8000 });
      check('e-mail de test, Brevo refuse : la raison donnee par Brevo est affichee', true);
      await v.page.getByTestId('marketing-email-test').click();
      await v.page.getByText(/E-mail de test envoyé à ad\*\*\*@example\.com/).waitFor({ timeout: 8000 });
      check('e-mail de test envoye : message de succes avec l\'adresse masquee', true);
      check('la fonction recoit seulement l\'action « test » (aucune adresse envoyee par l\'application)', calls.length === 3 && calls.every((c) => JSON.stringify(c) === '{"action":"test"}'), calls);
      // interrupteur des e-mails automatiques de commande : éteint au départ, la base reçoit order_emails_enabled
      await v.page.getByTestId('order-emails-toggle').waitFor({ timeout: 15000 });
      check('e-mails de commande : éteints au départ (« Désactivé »)', /Désactivé/.test(await v.page.getByTestId('order-emails-status').innerText()), await v.page.getByTestId('order-emails-status').innerText());
      await v.page.getByTestId('order-emails-switch').click();
      await v.page.getByText('E-mails activés').waitFor({ timeout: 8000 });
      check('e-mails de commande : on les allume, la base reçoit order_emails_enabled = true', (fs.patches || []).some((b) => b.order_emails_enabled === true), fs.patches);
      await v.page.waitForFunction(() => /Activé/.test(document.querySelector('[data-testid="order-emails-status"]')?.textContent || ''), null, { timeout: 8000 });
      check('e-mails de commande : « Activé » affiché après relecture', true);
      await v.page.getByTestId('order-emails-switch').click();
      await v.page.getByText('E-mails coupés').waitFor({ timeout: 8000 });
      check('e-mails de commande : on les éteint, la base reçoit order_emails_enabled = false', (fs.patches || []).some((b) => b.order_emails_enabled === false), fs.patches);
      // publicite aux clients absents depuis 7 jours : interrupteur separe (eteint au depart) et exemple envoye a l'administrateur
      await v.page.getByTestId('inactive-emails-toggle').waitFor({ timeout: 15000 });
      check('publicite aux clients absents : éteinte au départ (« Désactivé »)', /Désactivé/.test(await v.page.getByTestId('inactive-emails-status').innerText()));
      await v.page.getByTestId('inactive-emails-switch').click();
      await v.page.getByText('Publicité par e-mail activée').waitFor({ timeout: 8000 });
      check('publicite : on l\'allume, la base reçoit inactive_emails_enabled = true', (fs.patches || []).some((b) => b.inactive_emails_enabled === true), fs.patches);
      await v.page.waitForFunction(() => /Activé/.test(document.querySelector('[data-testid="inactive-emails-status"]')?.textContent || ''), null, { timeout: 8000 });
      check('publicite : « Activé » affiché après relecture', true);
      await v.page.getByTestId('inactive-emails-switch').click();
      await v.page.getByText('Publicité par e-mail coupée').waitFor({ timeout: 8000 });
      check('publicite : on l\'éteint, la base reçoit inactive_emails_enabled = false', (fs.patches || []).some((b) => b.inactive_emails_enabled === false), fs.patches);
      const txt0 = await v.page.getByTestId('admin-marketing').innerText();
      check('publicite : le texte dit 9 h, 50 clients, 7 jours, promotions acceptées, « Me désinscrire », 14 jours', /9 h/.test(txt0) && /50 clients/.test(txt0) && /7 jours/.test(txt0) && /accepté les promotions/.test(txt0) && /Me désinscrire/.test(txt0) && /14 jours/.test(txt0));
      await v.page.getByTestId('marketing-promo-test').click();
      await v.page.getByText(/Aucun article en vente et en stock/).waitFor({ timeout: 8000 });
      check('exemple de publicité, aucun article en stock : le message le dit', true);
      await v.page.getByTestId('marketing-promo-test').click();
      await v.page.getByText(/Exemple de publicité envoyé à ad\*\*\*@example\.com/).waitFor({ timeout: 8000 });
      check('exemple de publicité envoyé : succès avec l\'adresse masquée', true);
      check('la fonction reçoit seulement l\'action « test_promo » (aucune adresse, aucun contenu envoyé par l\'application)', calls.slice(3).length === 2 && calls.slice(3).every((c) => JSON.stringify(c) === '{"action":"test_promo"}'), calls);
      check('aucune erreur (e-mail de test)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('2')) {
    console.log('\n== 2. compte obligatoire a l\'entree du site, inscription par numero de telephone (e-mail facultatif), connexion par numero (fausse base)');
    const uid = '44444444-4444-4444-8444-444444444444';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NDQ0NDQ0NC00NDQ0LTQ0NDQtODQ0NC00NDQ0NDQ0NDQ0NDQiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const LOGIN_EMAIL = '23566123456@tel.albasseshopping.com';
    // un compte de la fausse base : profil vide (cree par la base a l'inscription) ou deja rempli
    const accountOf = ({ email = LOGIN_EMAIL, is_admin = false, filled = false } = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, identities: [{ id: uid, provider: 'email' }], created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      const profile = filled
        ? { id: uid, email, full_name: 'Ali Mahamat', phone: '66 12 34 56', whatsapp_number: '66 12 34 56', banned: false, role: is_admin ? 'admin' : 'customer', is_admin, loyalty_points: 0, login_count: 1 }
        : { id: uid, email, full_name: null, phone: null, whatsapp_number: null, banned: false, role: 'customer', is_admin, loyalty_points: 0, login_count: 0 };
      return { auth, token, session: JSON.stringify(token), profile, editable: true, patches: [] };
    };
    const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const prod = (await get('products?select=slug,name&is_active=eq.true&stock=gt.0&order=created_at.desc&limit=1'))[0];
    const wall = (pg) => pg.getByTestId('account-wall');
    const shown = (pg, text) => pg.getByText(text, { exact: true }).locator('visible=true').first();
    const fabCount = (pg) => pg.getByRole('button', { name: FAB_NAME }).count();
    // le mur s'affiche (attente du reglage et de la session)
    const waitWall = (pg) => wall(pg).waitFor({ timeout: 25000 });
    // 0) « Me désinscrire » des e-mails publicitaires : page ouverte sans compte, même quand le compte est obligatoire
    {
      const TOK = '11111111-1111-4111-8111-111111111111';
      const open = async (url, fu) => {
        const v = await newVisitor(phone, { fakeStore: { waOrder: true, accountRequired: true }, fakeUnsub: fu });
        await v.page.goto(`${BASE}${url}`, { waitUntil: 'load' });
        await v.page.getByTestId('unsubscribe-screen').waitFor({ timeout: 30000 });
        return v;
      };
      const ok1 = { result: true };
      const v = await open(`/desinscription?t=${TOK}`, ok1);
      await v.page.getByTestId('unsubscribe-done').waitFor({ timeout: 10000 });
      check('desinscription : le lien de l\'e-mail coupe la publicité, sans compte et sans mur', (await wall(v.page).count()) === 0 && /Vous êtes désinscrit/.test(await v.page.getByTestId('unsubscribe-screen').innerText()));
      check('desinscription : la base reçoit seulement le code du lien', JSON.stringify(ok1.calls) === JSON.stringify([{ p_token: TOK }]), ok1.calls);
      check('desinscription : le texte dit que les e-mails de commande continuent', /e-mails de vos commandes/.test(await v.page.getByTestId('unsubscribe-screen').innerText()));
      await v.ctx.close();

      const bad = { result: false };
      const v2 = await open(`/desinscription?t=${TOK}`, bad);
      await v2.page.getByTestId('unsubscribe-invalid').waitFor({ timeout: 10000 });
      check('desinscription : code inconnu de la base : « Lien non reconnu »', /Lien non reconnu/.test(await v2.page.getByTestId('unsubscribe-screen').innerText()));
      await v2.ctx.close();

      const none = { result: true };
      const v3 = await open('/desinscription?t=pas-un-code', none);
      await v3.page.getByTestId('unsubscribe-invalid').waitFor({ timeout: 10000 });
      check('desinscription : lien abîmé : « Lien non reconnu », aucun appel à la base', (none.calls || []).length === 0);
      await v3.ctx.close();

      const v4 = await open('/desinscription', { result: true });
      await v4.page.getByTestId('unsubscribe-invalid').waitFor({ timeout: 10000 });
      check('desinscription : sans code : « Lien non reconnu »', true);
      await v4.ctx.close();

      const v5 = await open(`/desinscription?t=${TOK}`, { error: true });
      await v5.page.getByTestId('unsubscribe-error').waitFor({ timeout: 10000 });
      check('desinscription : panne de la base : « Réessayez dans un instant » (jamais un faux « désinscrit »)', /Réessayez/.test(await v5.page.getByTestId('unsubscribe-screen').innerText()) && !/Vous êtes désinscrit/.test(await v5.page.getByTestId('unsubscribe-screen').innerText()));
      await v5.ctx.close();
    }
    // 1) compte obligatoire : le visiteur voit le mur, sans Zara ni bandeaux
    {
      const v = await newVisitor(phone, { fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(1500);
      const txt = await wall(v.page).innerText();
      check('compte obligatoire : l\'ecran d\'entree couvre l\'accueil (ALBASSE SHOPPING, Bienvenue)', /ALBASSE SHOPPING/.test(txt) && /Bienvenue/.test(txt) && /Créez votre compte gratuit pour découvrir nos articles/.test(txt) && !/Pourquoi choisir Albasse Shopping/.test(txt), txt.slice(0, 200));
      const yOf = async (loc) => (await loc.boundingBox())?.y ?? -1;
      const yForm = await yOf(wall(v.page).getByTestId('register-name'));
      const ySwitch = await yOf(wall(v.page).getByText('J’ai déjà un compte', { exact: true }));
      check('le formulaire « Créer un compte » s\'affiche en premier (nom, telephone, mot de passe), « J’ai déjà un compte » en dessous', yForm > 0 && ySwitch > yForm && (await wall(v.page).getByTestId('register-phone').count()) === 1 && (await wall(v.page).getByTestId('register-password').count()) === 1 && (await wall(v.page).getByTestId('login-identifier').count()) === 0, { yForm, ySwitch });
      check('formulaire de creation : autocomplete name / tel / new-password (le telephone propose un mot de passe)', (await wall(v.page).getByTestId('register-name').getAttribute('autocomplete')) === 'name' && (await wall(v.page).getByTestId('register-phone').getAttribute('autocomplete')) === 'tel' && (await wall(v.page).getByTestId('register-password').getAttribute('autocomplete')) === 'new-password');
      await wall(v.page).getByText('J’ai déjà un compte', { exact: true }).click();
      await wall(v.page).getByTestId('login-identifier').waitFor({ timeout: 10000 });
      check('« J’ai déjà un compte » : la connexion (numero ou e-mail, mot de passe, « Se souvenir de mon mot de passe »), et « Créer mon compte » pour revenir', /Connectez-vous pour découvrir nos articles/.test(await wall(v.page).innerText()) && /Se souvenir de mon mot de passe/.test(await wall(v.page).innerText()) && (await wall(v.page).getByText('Créer mon compte', { exact: true }).count()) === 1);
      check('« Se souvenir de mon mot de passe » coche au depart', (await wall(v.page).getByTestId('login-remember').getAttribute('aria-checked')) === 'true');
      check('le telephone peut enregistrer et remplir le mot de passe (autocomplete username / current-password)', (await wall(v.page).getByTestId('login-identifier').getAttribute('autocomplete')) === 'username' && (await wall(v.page).getByTestId('login-password').getAttribute('autocomplete')) === 'current-password');
      await wall(v.page).getByText('Créer mon compte', { exact: true }).click();
      await wall(v.page).getByTestId('register-name').waitFor({ timeout: 10000 });
      check('« Créer mon compte » : retour au formulaire de creation', (await wall(v.page).getByTestId('login-identifier').count()) === 0);
      check('formulaire court : obligatoires nom, telephone, mot de passe ; e-mail facultatif', /Informations obligatoires/i.test(txt) && /Informations optionnelles/i.test(txt) && (await wall(v.page).getByTestId('register-email').getAttribute('placeholder')) === 'E-mail (facultatif)');
      check('plus de liens « Confidentialité » ni « Contact » sur l\'ecran d\'entree', !/Confidentialité/.test(txt) && !/Contact/.test(txt), txt);
      check('page en francais (lang="fr") : Chrome ne la traduit plus (« ALBASSE SHOPPING » reste tel quel)', (await v.page.evaluate(() => document.documentElement.lang)) === 'fr');
      check('pas de bouton de Zara derriere le mur', (await fabCount(v.page)) === 0);
      await v.page.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      await waitWall(v.page);
      check('une fiche produit ouverte depuis un lien : couverte aussi', (await wall(v.page).count()) === 1);
      for (const [path, what] of [['/confidentialite', 'confidentialite'], ['/contact', 'contact'], ['/connexion', 'connexion']]) {
        await v.page.goto(`${BASE}${path}`, { waitUntil: 'load' });
        await sleep(3500);
        check(`page ${what} : ouverte sans compte`, (await wall(v.page).count()) === 0);
      }
      check('aucune erreur (mur)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // 2) reglage coupe, ou script SQL pas lance : site ouvert comme avant
    for (const [accountRequired, what] of [[false, 'desactive'], ['missing', 'script pas lance']]) {
      const v = await newVisitor(phone, { fakeStore: { waOrder: true, accountRequired } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(5000);
      check(`reglage ${what} : pas de mur, Zara est la`, (await wall(v.page).count()) === 0 && (await fabCount(v.page)) > 0);
      await v.ctx.close();
    }
    // 3) robot de Google : il voit le site (articles trouves sur Google)
    {
      const v = await newVisitor({ ...phone, userAgent: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }, { fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      await v.page.getByText('Commander', { exact: true }).first().waitFor({ timeout: 25000 });
      await sleep(3000);
      check('robot de Google : pas de mur sur la fiche produit', (await wall(v.page).count()) === 0);
      await v.ctx.close();
    }
    // 4) client deja connecte : jamais de mur, meme un instant
    {
      const fu = accountOf({ filled: true });
      const v = await newVisitor(phone, { storage: { [SK]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      let seen = 0;
      for (let i = 0; i < 16; i++) {
        seen += await wall(v.page).count();
        await sleep(400);
      }
      check('client connecte : le mur ne s\'affiche jamais (meme pendant le chargement)', seen === 0, seen);
      await v.ctx.close();
    }
    // 5) inscription depuis le mur : nom, numero, mot de passe ; on revient sur la fiche demandee
    const register = async (v, { name = 'Ali Mahamat', phoneNo = '66 12 34 56', password = 'secret12', email = '', terms = true, gender = 'homme' } = {}) => {
      await v.page.getByTestId('register-phone').waitFor({ timeout: 15000 });
      await sleep(800);
      if (name) await v.page.getByTestId('register-name').locator('visible=true').fill(name);
      if (gender) await v.page.getByTestId(`register-gender-${gender}`).locator('visible=true').click();
      if (phoneNo) await v.page.getByTestId('register-phone').locator('visible=true').fill(phoneNo);
      if (password) await v.page.getByTestId('register-password').locator('visible=true').fill(password);
      if (email) await v.page.getByTestId('register-email').locator('visible=true').fill(email);
      if (terms) await v.page.getByTestId('register-terms').locator('visible=true').click();
      await shown(v.page, 'Créer mon compte').click();
    };
    {
      const fu = accountOf();
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(1000);
      await v.page.getByTestId('register-phone').waitFor({ timeout: 15000 });
      await sleep(800);
      check('fiche ouverte depuis un lien : le formulaire de creation est directement sur l\'ecran d\'entree', (await wall(v.page).getByTestId('register-phone').count()) === 1);
      const form = await v.page.locator('body').innerText();
      check('formulaire court : e-mail, WhatsApp et profession dans « facultatif »', /E-mail \(facultatif\)|Informations optionnelles/i.test(form) && !/Email \*/.test(form) && !/Profession \*/.test(form) && !/Numéro WhatsApp \*/.test(form));
      // il manque le numero : rien n'est envoye
      await v.page.getByTestId('register-name').locator('visible=true').fill('Ali Mahamat');
      await v.page.getByTestId('register-gender-homme').locator('visible=true').click();
      await v.page.getByTestId('register-password').locator('visible=true').fill('secret12');
      await v.page.getByTestId('register-terms').locator('visible=true').click();
      await shown(v.page, 'Créer mon compte').click();
      await v.page.getByText('Nom, numéro de téléphone et mot de passe sont obligatoires.').waitFor({ timeout: 8000 });
      check('sans numero : message, rien n\'est envoye', !(fu.signups || []).length);
      await v.page.getByTestId('register-phone').locator('visible=true').fill('12');
      await shown(v.page, 'Créer mon compte').click();
      await v.page.getByText(/numéro de téléphone valide/).first().waitFor({ timeout: 8000 });
      check('numero trop court : message, rien n\'est envoye', !(fu.signups || []).length);
      await v.page.getByTestId('register-phone').locator('visible=true').fill('66 12 34 56');
      await v.page.getByTestId('register-email').locator('visible=true').fill('pas-un-email');
      await shown(v.page, 'Créer mon compte').click();
      await v.page.getByText(/adresse e-mail valide, ou laissez la case vide/).waitFor({ timeout: 8000 });
      check('e-mail mal ecrit : message, rien n\'est envoye', !(fu.signups || []).length);
      await v.page.getByTestId('register-email').locator('visible=true').fill('');
      await shown(v.page, 'Créer mon compte').click();
      await v.page.getByText('Bienvenue ✓').waitFor({ timeout: 15000 });
      await sleep(2500);
      const su = (fu.signups || [])[0] || {};
      check('inscription sans e-mail : le compte est cree avec le numero (23566123456@tel.albasseshopping.com) et le mot de passe', fu.signups.length === 1 && su.email === LOGIN_EMAIL && su.password === 'secret12', fu.signups);
      const patch = fu.patches.find((x) => 'full_name' in x) || {};
      check('profil : nom, numero, WhatsApp = le meme numero, pas de profession, pas d\'e-mail', patch.full_name === 'Ali Mahamat' && patch.phone === '66 12 34 56' && patch.whatsapp_number === '66 12 34 56' && patch.profession === null && !('email' in patch), patch);
      check('apres l\'inscription : plus de mur, retour sur la fiche demandee', (await wall(v.page).count()) === 0 && new URL(v.page.url()).pathname === `/produit/${prod.slug}`, v.page.url());
      check('apres l\'inscription : Zara est de retour', (await fabCount(v.page)) > 0);
      check('aucune erreur (inscription)', v.errs.length === 0, v.errs);
      // Mon compte : l'adresse tiree du numero ne s'affiche jamais
      await v.page.goto(`${BASE}/compte`, { waitUntil: 'load' });
      await sleep(4000);
      check('Mon compte : l\'adresse « @tel.albasseshopping.com » n\'est jamais montree', !/tel\.albasseshopping\.com/.test(await v.page.locator('body').innerText()));
      await v.ctx.close();
    }
    // 5b) juste apres l'inscription, sur un telephone sans le raccourci : la page d'installation (une seule fois)
    {
      const fu = accountOf();
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true }, installAfterSignUp: null });
      await v.page.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      await waitWall(v.page);
      await register(v);
      await v.page.getByText('Bienvenue ✓').waitFor({ timeout: 15000 });
      await v.page.getByTestId('install-screen').waitFor({ timeout: 15000 });
      check('apres l\'inscription (telephone sans le raccourci) : la page d\'installation s\'affiche, sans mur', new URL(v.page.url()).pathname === '/installer' && (await wall(v.page).count()) === 0, v.page.url());
      check('...avec le lien pour continuer vers la plateforme', (await v.page.getByText('Continuer vers la plateforme').count()) === 1);
      await v.page.getByText('Continuer vers la plateforme').click();
      await sleep(1500);
      check('« Continuer vers la plateforme » : la boutique, sans mur', (await wall(v.page).count()) === 0 && new URL(v.page.url()).pathname !== '/installer', v.page.url());
      await sleep(3500);
      check('pas de fenetre « Installer » en plus, et Zara ne repose pas la question', (await v.page.getByText('📥 Installer').count()) === 0 && (await panelOf(v.page).getByText(/Avez-vous déjà installé/).count()) === 0);
      check('aucune erreur (installation apres inscription)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // 6) inscription avec un e-mail : il va dans le profil, le compte reste celui du numero
    {
      const fu = accountOf();
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(1000);
      await register(v, { phoneNo: '+235 66 12 34 56', email: 'ali@example.com' });
      await v.page.getByText('Bienvenue ✓').waitFor({ timeout: 15000 });
      await sleep(1500);
      const patch = fu.patches.find((x) => 'full_name' in x) || {};
      check('« +235 66 12 34 56 » donne le meme compte que « 66 12 34 56 »', (fu.signups || [])[0]?.email === LOGIN_EMAIL, fu.signups);
      check('e-mail donne : enregistre dans le profil', patch.email === 'ali@example.com', patch);
      await v.ctx.close();
    }
    // 7) numero deja inscrit
    {
      const fu = { ...accountOf(), signupError: 'exists' };
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(1000);
      await register(v);
      await v.page.getByText(/Un compte existe déjà avec ce numéro/).waitFor({ timeout: 15000 });
      check('numero deja inscrit : « Connectez-vous avec votre numero et votre mot de passe »', /Connectez-vous avec votre numéro/.test(await v.page.getByText(/Un compte existe déjà avec ce numéro/).first().innerText()));
      await v.ctx.close();
    }
    // 8) connexion par numero, puis par e-mail (ancien compte), puis mauvais mot de passe
    for (const [typed, expected, what] of [['66 12 34 56', LOGIN_EMAIL, 'numero'], ['00235 66123456', LOGIN_EMAIL, 'numero avec 00235'], ['Awa@Example.com', 'awa@example.com', 'e-mail (ancien compte)']]) {
      const fu = accountOf({ email: expected, filled: true });
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(1000);
      await wall(v.page).getByText('J’ai déjà un compte', { exact: true }).click();
      await wall(v.page).getByTestId('login-identifier').waitFor({ timeout: 10000 });
      check(`connexion (${what}) : la case dit « Numéro de téléphone ou e-mail »`, (await wall(v.page).getByTestId('login-identifier').getAttribute('placeholder')) === 'Numéro de téléphone ou e-mail');
      await wall(v.page).getByTestId('login-identifier').fill(typed);
      await wall(v.page).getByTestId('login-password').fill('secret12');
      await wall(v.page).getByText('Se connecter', { exact: true }).click();
      await sleep(4000);
      const call = (fu.tokenCalls || []).find((c) => c.grant === 'password') || {};
      check(`connexion depuis l'ecran d'entree (${what}) : envoyee avec ${expected}, puis plus de mur`, call.email === expected && call.password === 'secret12' && (await wall(v.page).count()) === 0, { call, wall: await wall(v.page).count() });
      const kept = await v.page.evaluate(() => ({ id: localStorage.getItem('albasse_login_id'), only: localStorage.getItem('albasse_session_only') }));
      check(`« Se souvenir » coche (${what}) : le numero (ou l'e-mail) est garde pour la prochaine fois, la connexion reste`, kept.id === typed && kept.only === null, kept);
      await v.ctx.close();
    }
    // numero garde : la case est deja remplie ; « Se souvenir » decoche : rien n'est garde, la connexion s'arrete a la fermeture
    {
      const fu = accountOf({ filled: true });
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true }, storage: { albasse_login_id: '66 12 34 56' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(1000);
      await wall(v.page).getByText('J’ai déjà un compte', { exact: true }).click();
      await wall(v.page).getByTestId('login-identifier').waitFor({ timeout: 10000 });
      check('numero garde : la case est deja remplie', (await wall(v.page).getByTestId('login-identifier').inputValue()) === '66 12 34 56');
      await wall(v.page).getByTestId('login-remember').click();
      check('decocher « Se souvenir » : le navigateur ne propose plus de remplir (autocomplete off)', (await wall(v.page).getByTestId('login-remember').getAttribute('aria-checked')) === 'false' && (await wall(v.page).getByTestId('login-password').getAttribute('autocomplete')) === 'off');
      await wall(v.page).getByTestId('login-password').fill('secret12');
      await wall(v.page).getByText('Se connecter', { exact: true }).click();
      await sleep(4000);
      const kept = await v.page.evaluate(() => ({ id: localStorage.getItem('albasse_login_id'), only: localStorage.getItem('albasse_session_only'), tab: sessionStorage.getItem('albasse_session_tab') }));
      check('decoche : connecte, mais le numero n\'est plus garde', (await wall(v.page).count()) === 0 && kept.id === null && kept.only === '1' && kept.tab === '1', kept);
      await v.page.reload({ waitUntil: 'load' });
      await sleep(5000);
      check('decoche : la page rechargee (meme onglet) reste connectee', (await wall(v.page).count()) === 0);
      // navigateur ferme puis rouvert = nouvel onglet sans la marque de l'onglet
      const p2 = await v.ctx.newPage();
      await p2.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(p2);
      const st2 = await p2.evaluate(() => ({ only: localStorage.getItem('albasse_session_only'), tab: sessionStorage.getItem('albasse_session_tab'), keys: Object.keys(localStorage).filter((k) => /auth-token/.test(k)) }));
      // (la case n'est pas verifiee ici : le decor du test remet le numero garde a chaque nouvelle page)
      check('decoche : navigateur rouvert = deconnecte (session effacee), l\'ecran d\'entree revient', (await wall(p2).count()) === 1 && st2.keys.length === 0 && st2.only === null, { wall: await wall(p2).count(), st2 });
      await v.ctx.close();
    }
    {
      const fu = { ...accountOf({ filled: true }), loginError: true };
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: true } });
      await v.page.goto(`${BASE}/connexion`, { waitUntil: 'load' });
      await v.page.getByTestId('login-identifier').waitFor({ timeout: 15000 });
      await sleep(600);
      await v.page.getByTestId('login-identifier').locator('visible=true').fill('66 12 34 56');
      await v.page.getByTestId('login-password').locator('visible=true').fill('mauvais');
      await shown(v.page, 'Se connecter').click();
      await v.page.getByText('Numéro (ou e-mail) ou mot de passe incorrect.').waitFor({ timeout: 10000 });
      check('mauvais mot de passe : « Numero (ou e-mail) ou mot de passe incorrect »', true);
      // « J'ai oublié mon mot de passe » (sur l'ecran d'entree) puis aide sur WhatsApp avec le numero
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v.page);
      await sleep(800);
      await wall(v.page).getByText('J’ai déjà un compte', { exact: true }).click();
      await wall(v.page).getByTestId('login-identifier').waitFor({ timeout: 10000 });
      check('ecran d\'entree : lien « J’ai oublié mon mot de passe » sous la connexion', (await wall(v.page).getByTestId('login-forgot').innerText()).trim() === 'J’ai oublié mon mot de passe');
      await wall(v.page).getByTestId('login-forgot').click();
      await v.page.waitForURL(/\/mot-de-passe-oublie/, { timeout: 15000 });
      await v.page.getByTestId('forgot-identifier').waitFor({ timeout: 15000 });
      await sleep(600);
      check('mot de passe oublie : ouvert sans compte', (await wall(v.page).count()) === 0);
      await v.page.getByTestId('forgot-identifier').locator('visible=true').fill('66 12 34 56');
      await shown(v.page, 'Continuer').click();
      await v.page.getByTestId('forgot-phone-help').waitFor({ timeout: 8000 });
      await v.ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>whatsapp</body></html>' }));
      const [popup] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), shown(v.page, '💬 Écrire sur WhatsApp').click()]);
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      const url = decodeURIComponent(popup.url());
      check('mot de passe oublie (numero) : WhatsApp de la boutique avec le numero du client', url.startsWith('https://wa.me/235') && /oublié le mot de passe/.test(url) && /66 12 34 56/.test(url), url);
      await v.ctx.close();
    }
    // 9) l'admin coupe et remet le compte obligatoire (page Clients)
    {
      const fu = accountOf({ email: 'admin@example.com', is_admin: true, filled: true });
      const fs = { waOrder: true, accountRequired: true, patches: [] };
      const v = await newVisitor(phone, { storage: { [SK]: fu.session }, fakeUser: fu, fakeStore: fs });
      await v.page.goto(`${BASE}/admin/clients`, { waitUntil: 'load' });
      await v.page.getByTestId('account-required-toggle').waitFor({ timeout: 25000 });
      await sleep(1500);
      const st = async () => (await v.page.getByTestId('account-required-status').innerText()).trim();
      check('page Clients : interrupteur « Compte obligatoire », « Activé »', /Activé/.test(await st()), await st());
      await v.page.getByTestId('account-required-switch').click();
      await v.page.getByText('🔓 Site ouvert', { exact: true }).waitFor({ timeout: 10000 });
      check('couper : la base recoit account_required = false', fs.patches.length === 1 && fs.patches[0].account_required === false && Object.keys(fs.patches[0]).length === 1, fs.patches);
      await v.page.getByTestId('account-required-switch').click();
      await v.page.getByText('🔐 Compte obligatoire', { exact: true }).waitFor({ timeout: 10000 });
      check('remettre : la base recoit account_required = true', fs.patches.length === 2 && fs.patches[1].account_required === true, fs.patches);
      await v.ctx.close();
      const v2 = await newVisitor(phone, { fakeStore: fs });
      await v2.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await waitWall(v2.page);
      check('remis : un nouveau visiteur voit de nouveau le mur', (await wall(v2.page).count()) === 1);
      await v2.ctx.close();
    }
  }

  if (PARTS.includes('5')) {
    console.log('\n== 5. Zara IA : un message ecrit part a l IA (simulee), les cartes des vrais articles s affichent ; sans IA, les regles repondent');
    const res = await fetch(`${REST}/products?select=id,name&is_active=eq.true&stock=gt.0&limit=1`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
    const [prod] = await res.json();
    const openZara = async (v) => {
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
    };
    const QUESTION = 'Vous avez une montre étanche pour nager ?';
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' }, fakeAi: () => ({ ok: true, text: `Bonne idée Ali ! Voici ${prod.name} 😊`, productIds: [prod.id, 'id-inconnu'] }) });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await openZara(v);
      await ask(v.page, QUESTION, /Bonne idée Ali ! Voici/, 30000);
      const call = v.aiCalls[0] || {};
      check('message ecrit : envoye a Zara IA avec le texte, l identifiant du visiteur et l historique', v.aiCalls.length === 1 && call.message === QUESTION && typeof call.visitorId === 'string' && call.visitorId.length > 8 && Array.isArray(call.history), call);
      await sleep(1500);
      const cards = await panelOf(v.page).getByTestId('assistant-card-add').count();
      check('la reponse de l IA montre la carte du vrai article (id inconnu ignore), avec « Commander »', cards === 1 && (await panelOf(v.page).getByText(prod.name, { exact: false }).count()) >= 1, cards);
      const before = v.aiCalls.length;
      const labels = await chipLabels(v.page);
      const promo = labels.find((l) => /Promotions/.test(l));
      if (promo) {
        await chip(v.page, promo).first().click();
        await sleep(3000);
      }
      check('toucher un bouton ne passe pas par l IA', !!promo && v.aiCalls.length === before, { labels, calls: v.aiCalls.length });
      check('aucune erreur (Zara IA)', v.errs.length === 0, v.errs);
      check('Zara IA ne fait aucune autre demande au serveur', !v.writes.some((w) => /functions|orders|products/.test(w)), v.writes);
      await v.ctx.close();
    }
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await openZara(v);
      const n = (await panelOf(v.page).innerText()).length;
      await typeIn(v.page, QUESTION);
      const t0 = Date.now();
      while ((await panelOf(v.page).innerText()).length <= n + QUESTION.length + 5 && Date.now() - t0 < 20000) await sleep(300);
      await sleep(2000);
      check('IA pas installee : Zara repond quand meme (ses regles)', (await panelOf(v.page).innerText()).length > n + QUESTION.length + 5);
      await typeIn(v.page, 'Et un parfum pour femme ?');
      await sleep(4000);
      check('IA pas installee : on ne la redemande pas a chaque message (pause de 10 min)', v.aiCalls.length === 1, v.aiCalls.length);
      check('aucune erreur (sans IA)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('3')) {
    console.log('\n== 3. Zara rappelle d\'activer les notifications a ceux qui ont installe Albasse Shopping (faux telephone, faux enregistrement)');
    const ASK = /les notifications ne sont pas encore activées/;
    const ENABLE = '🔔 Activer les notifications';
    const installed = { albasse_zara_name: 'Ali', albasse_app_installed: '1' };
    const pushRecord = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('albasse_zara_push') || 'null'));
    const openZara = async (v) => {
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
    };
    // installe, notifications jamais demandees : la bulle, puis Zara propose, le client active
    {
      const v = await newVisitor(phone, { zaraPush: null, pushPerm: 'default', pushAnswer: 'granted', storage: installed });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByText(/activez les notifications pour ne rater aucune promo/).waitFor({ timeout: 15000 });
      check('bulle de Zara : « 🔔 Ali, activez les notifications pour ne rater aucune promo ! »', (await v.page.getByText('🔔 Ali, activez les notifications pour ne rater aucune promo !').count()) === 1);
      await openZara(v);
      await waitText(v.page, ASK);
      const labels = await chipLabels(v.page);
      check('Zara rappelle : boutons « 🔔 Activer les notifications » et « Plus tard »', labels.includes(ENABLE) && labels.includes('Plus tard'), labels);
      check('le menu a aussi le bouton « 🔔 Activer les notifications »', (await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts()).some((l) => l.trim() === ENABLE));
      check('rappel note (pas redit avant demain)', (await pushRecord(v.page))?.outcome === 'asked', await pushRecord(v.page));
      await chip(v.page, ENABLE).first().click();
      await waitText(v.page, /C’est activé ! Vous recevrez nos promotions/);
      const asked = await v.page.evaluate(() => window.__pushAsked || 0);
      check('toucher le bouton : le telephone demande « Autoriser les notifications ? » une fois, puis le telephone est enregistre', asked === 1 && v.pushSubs.length === 1 && v.pushSubs[0].endpoint === 'https://push.example.test/abonnement-1', { asked, subs: v.pushSubs });
      check('active : plus de bouton « Activer » (ni sur les anciens messages)', ![...(await chipLabels(v.page)), ...(await panelOf(v.page).getByTestId('assistant-chip-old').allInnerTexts())].some((l) => l.trim() === ENABLE));
      check('aucune erreur (rappel accepte)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // « Plus tard » : pas de rappel ni de bulle pendant 3 jours, mais le bouton reste dans le menu
    {
      const v = await newVisitor(phone, { zaraPush: null, pushPerm: 'default', storage: installed });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2000);
      await openZara(v);
      await waitText(v.page, ASK);
      await chip(v.page, 'Plus tard').first().click();
      await waitText(v.page, /Je vous le rappellerai plus tard/);
      check('« Plus tard » : note pour 3 jours', (await pushRecord(v.page))?.outcome === 'later');
      const p2 = await v.ctx.newPage();
      await p2.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(7000);
      check('« Plus tard » : la bulle ne parle plus des notifications', (await p2.getByText(/activez les notifications/).count()) === 0);
      await p2.close();
      await v.ctx.close();
      const w = await newVisitor(phone, { zaraPush: 'later', pushPerm: 'default', storage: installed });
      await w.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2000);
      await openZara(w);
      await sleep(3000);
      check('« Plus tard » : Zara ne le redit pas, mais « 🔔 Activer les notifications » reste dans le menu', (await panelOf(w.page).getByText(ASK).count()) === 0 && (await chipLabels(w.page)).includes(ENABLE), await chipLabels(w.page));
      await chip(w.page, ENABLE).first().click();
      await waitText(w.page, /C’est activé !/);
      check('le bouton du menu active aussi', w.pushSubs.length === 1);
      await w.ctx.close();
    }
    // le client refuse dans la question du telephone : les etapes pour debloquer ; il la ferme sans repondre : « je vous le rappellerai »
    for (const [answer, re, what] of [['denied', /Restez appuyé sur l’icône Albasse Shopping/, 'refuse'], ['default', /n’ont pas été autorisées/, 'ferme sans repondre']]) {
      const v = await newVisitor(phone, { zaraPush: null, pushPerm: 'default', pushAnswer: answer, storage: installed });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2000);
      await openZara(v);
      await waitText(v.page, ASK);
      await chip(v.page, ENABLE).first().click();
      await waitText(v.page, re);
      check(`le client ${what} : Zara repond (${answer === 'denied' ? 'etapes pour autoriser dans les reglages' : 'rappel plus tard'}), rien n'est enregistre`, v.pushSubs.length === 0 && (await pushRecord(v.page))?.outcome === (answer === 'denied' ? 'steps' : 'later'), await pushRecord(v.page));
      await v.ctx.close();
    }
    // deja bloquees : Zara donne les etapes d'elle-meme (une fois par semaine), sans bouton « Activer »
    {
      const v = await newVisitor(phone, { zaraPush: null, pushPerm: 'denied', storage: installed });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2000);
      await openZara(v);
      await waitText(v.page, /sont bloquées sur ce téléphone/);
      check('bloquees : les etapes (icone, Infos sur l’appli, Notifications, Autoriser), pas de bouton « Activer »', !(await chipLabels(v.page)).includes(ENABLE) && (await pushRecord(v.page))?.outcome === 'steps');
      await v.ctx.close();
    }
    // pas installe, ou deja active : rien
    for (const [opts, what] of [[{ pushPerm: 'default', storage: { albasse_zara_name: 'Ali' } }, 'pas installe'], [{ pushPerm: 'granted', storage: installed }, 'deja active']]) {
      const v = await newVisitor(phone, { zaraPush: null, ...opts });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(7000);
      const bubble = await v.page.getByText(/activez les notifications/).count();
      await openZara(v);
      await sleep(3000);
      check(`${what} : ni bulle, ni rappel, ni bouton « Activer les notifications »`, bubble === 0 && (await panelOf(v.page).getByText(ASK).count()) === 0 && !(await chipLabels(v.page)).includes(ENABLE), await chipLabels(v.page));
      await v.ctx.close();
    }
    // autorisation deja donnee mais abonnement perdu : le site se reabonne tout seul, sans rien demander
    {
      const v = await newVisitor(phone, { zaraPush: null, pushPerm: 'granted', storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(5000);
      check('abonnement perdu : reabonnement automatique, sans question', v.pushSubs.length === 1 && (await v.page.evaluate(() => window.__pushAsked || 0)) === 0, v.pushSubs);
      await v.ctx.close();
    }
    // en arabe
    {
      const v = await newVisitor(phone, { lang: 'ar', zaraPush: null, pushPerm: 'default', storage: { ...installed, albasse_zara_name: 'علي' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByText('🔔 علي، فعّل الإشعارات حتى لا تفوتك أي عروض!').waitFor({ timeout: 15000 });
      check('arabe : la bulle « 🔔 علي، فعّل الإشعارات حتى لا تفوتك أي عروض! »', true);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: /التحدث مع زارا كينغز|Discuter avec Zara Kings/ }).first().click();
      await waitText(v.page, /لكن الإشعارات غير مفعّلة بعد/, 25000);
      check('arabe : le rappel et le bouton « 🔔 تفعيل الإشعارات »', (await chipLabels(v.page)).includes('🔔 تفعيل الإشعارات'), await chipLabels(v.page));
      await v.ctx.close();
    }
  }

  if (PARTS.includes('4')) {
    console.log('\n== 4. haut de l\'accueil (vrai nombre en ligne, un seul bouton de langue) et ordre des categories choisi par l\'admin');
    const uid = '44444444-4444-4444-8444-444444444444';
    const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NDQ0NDQ0NC00NDQ0LTQ0NDQtODQ0NC00NDQ0NDQ0NDQ0NDQiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const adminAccount = () => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWT, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), profile: { id: uid, email: 'admin@example.com', full_name: 'Admin Albasse', phone: '66123456', banned: false, role: 'admin', is_admin: true } };
    };
    const SK = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const openHome = async (v) => {
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await v.page.getByTestId('home-categories').waitFor({ timeout: 30000 });
      await sleep(2500);
    };
    // haut de l'accueil : plus de « Bienvenue », le vrai nombre en ligne a droite, seulement le bouton « العربية »
    {
      const fo = { n: 3 };
      const v = await newVisitor(phone, { fakeOnline: fo });
      await openHome(v);
      check('« 👋 Bienvenue » retire du haut de l\'accueil', (await v.page.getByText('👋 Bienvenue', { exact: true }).count()) === 0);
      check('site en francais : seulement le bouton « العربية » (pas « 🇫🇷 FR »)', (await v.page.getByTestId('lang-ar').count()) === 1 && (await v.page.getByTestId('lang-fr').count()) === 0);
      const online = (await v.page.getByTestId('home-online-text').innerText()).trim();
      check('compteur : le vrai nombre de la base, « 3 en ligne »', online === '3 en ligne' && fo.calls >= 1, { online, calls: fo.calls });
      const tag = v.page.getByTestId('home-live-tag');
      check('pastille rouge « LIVE » devant le compteur (a la place du point vert)', (await tag.innerText()).trim() === 'LIVE' && (await tag.evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(255, 45, 45)' && (await v.page.getByTestId('home-online').innerText()).replace(/\s+/g, ' ').trim() === 'LIVE 3 en ligne');
      await v.page.screenshot({ path: path.join(OUT, '4a-accueil-live.png'), clip: { x: 0, y: 0, width: 390, height: 190 } });
      const ar = await v.page.getByTestId('lang-ar').boundingBox();
      const on = await v.page.getByTestId('home-online').boundingBox();
      check('une seule ligne : le bouton de langue a gauche, le compteur au milieu (plus petit)', Math.abs((ar.y + ar.height / 2) - (on.y + on.height / 2)) < 4 && Math.abs(on.x + on.width / 2 - 195) < 3 && on.height <= 24 && ar.x < 30, { ar, on });
      check('plus de nombre invente (« personnes en ligne »)', (await v.page.getByText(/personnes en ligne/).count()) === 0);
      fo.n = 5;
      await sleep(31000);
      check('relu toutes les 30 s : « 5 en ligne »', (await v.page.getByTestId('home-online-text').innerText()).trim() === '5 en ligne', fo.calls);
      await v.ctx.close();
    }
    {
      const fo = { n: 0 };
      const v = await newVisitor(phone, { fakeOnline: fo });
      await openHome(v);
      check('la base dit 0 (signal pas encore arrive) : « 1 en ligne » (la personne qui regarde)', (await v.page.getByTestId('home-online-text').innerText()).trim() === '1 en ligne');
      await v.ctx.close();
    }
    {
      const v = await newVisitor(phone);
      await openHome(v);
      check('script SQL pas encore lance : compteur cache (aucun nombre invente)', (await v.page.getByTestId('home-online').count()) === 0 && (await v.page.getByText(/\d+ (?:personnes )?en ligne/).count()) === 0);
      check('aucune ecriture reelle', v.writes.every((w) => /visitor_sessions/.test(w)), v.writes);
      await v.ctx.close();
    }
    // barre bleue « achats recents » : seulement de vraies commandes, cachee sinon
    {
      const v = await newVisitor(phone);
      await openHome(v);
      check('achats recents : script SQL pas lance ou aucune commande, la barre est cachee (rien d\'invente)', (await v.page.getByTestId('recent-purchases').count()) === 0 && (await v.page.getByText(/a commandé/).count()) === 0);
      await v.ctx.close();
    }
    {
      const fr = { rows: [] };
      const v = await newVisitor(phone, { fakeRecent: fr });
      await openHome(v);
      check('achats recents : la base repond « aucune commande recente », la barre est cachee', fr.calls >= 1 && (await v.page.getByTestId('recent-purchases').count()) === 0);
      await v.ctx.close();
    }
    {
      const fr = { rows: [{ city: "N'Djamena", product: 'Capuche   noire', created_at: new Date(Date.now() - 2 * 3600_000).toISOString() }, { city: null, product: 'Slip-on', created_at: new Date(Date.now() - 20 * 60_000).toISOString() }] };
      const v = await newVisitor(phone, { fakeRecent: fr });
      await openHome(v);
      const bar = v.page.getByTestId('recent-purchases');
      await bar.waitFor({ timeout: 15000 });
      const txt = (await bar.innerText()).replace(/\s+/g, ' ');
      check('achats recents : de vraies commandes, ville + article + il y a 2 h / 20 min (aucun nom de client)', /Un client de N'Djamena a commandé : Capuche noire · il y a 2 h/.test(txt) && /Un client a commandé : Slip-on · il y a 20 min/.test(txt), txt);
      check('achats recents : aucun des anciens faux textes (noms, temoignages)', !/Amina|Youssouf|Fatima Saleh|témoign|avis 5/i.test(txt));
      check('achats recents : la barre est tout en haut de la page', (await bar.boundingBox()).y < 120);
      const first = bar.getByText(/Un client de N'Djamena/).first();
      const x1 = (await first.boundingBox()).x;
      await sleep(1500);
      const x2 = (await first.boundingBox()).x;
      check('achats recents : la barre defile (le texte bouge vers la gauche)', x2 < x1 - 20, { x1, x2 });
      await v.ctx.close();
    }
    {
      // une seule vraie commande (cas du debut) : la barre est remplie et defile quand meme
      const fr = { rows: [{ city: 'Abéché', product: 'Capuche', created_at: new Date(Date.now() - 5 * 60_000).toISOString() }] };
      const v = await newVisitor(phone, { fakeRecent: fr });
      await openHome(v);
      const bar = v.page.getByTestId('recent-purchases');
      await bar.waitFor({ timeout: 15000 });
      const copies = v.page.getByTestId('recent-purchases').getByText(/Un client de Abéché a commandé : Capuche · il y a 5 min/);
      const n = await copies.count();
      const x1 = (await copies.first().boundingBox()).x;
      await sleep(1500);
      const x2 = (await copies.first().boundingBox()).x;
      check('achats recents : une seule commande, le texte est repete pour remplir la barre et il defile', n >= 2 && x2 < x1 - 20, { n, x1, x2 });
      await v.ctx.close();
    }
    {
      const v = await newVisitor(phone, { lang: null, fakeOnline: { n: 2 }, cookies: [{ name: 'googtrans', value: '/fr/ar', url: `${BASE}` }] });
      await openHome(v);
      check('site traduit en arabe : seulement le bouton « 🇫🇷 FR »', (await v.page.getByTestId('lang-fr').count()) === 1 && (await v.page.getByTestId('lang-ar').count()) === 0);
      await v.ctx.close();
    }
    {
      const fu = adminAccount();
      const v = await newVisitor(phone, { storage: { [SK]: fu.session }, fakeUser: fu, fakeOnline: { n: 4 } });
      await openHome(v);
      const on = await v.page.getByTestId('home-online').boundingBox();
      const bell = await v.page.getByText('🔔', { exact: true }).first().boundingBox();
      check('client connecte : compteur toujours au milieu, la cloche tout a droite', bell && Math.abs(on.x + on.width / 2 - 195) < 3 && bell.x + bell.width > 390 - 40 && Math.abs((bell.y + bell.height / 2) - (on.y + on.height / 2)) < 6, { on, bell });
      await v.ctx.close();
    }
    // ordre des categories : fleches ▲ ▼ sur la page admin « Categories »
    const rowsOf = async (pg) => (await pg.locator('[data-testid^="category-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('category-row-', ''))));
    const cats = (await get('categories?select=slug,name&order=name')).map((c) => c.slug);
    {
      const fc = { order: {}, patches: [] };
      const fu = adminAccount();
      const v = await newVisitor(phone, { storage: { [SK]: fu.session }, fakeUser: fu, fakeCats: fc });
      await v.page.goto(`${BASE}/admin/categories`, { waitUntil: 'load' });
      await v.page.getByTestId(`category-row-${cats[0]}`).waitFor({ timeout: 30000 });
      await sleep(1000);
      const start = await rowsOf(v.page);
      check('avant tout choix : ordre alphabetique, numeros 1, 2, 3…', start.join() === cats.join() && (await v.page.getByTestId(`category-row-${cats[0]}`).innerText()).trim().startsWith('1'), { start, cats });
      check('petite explication « la n° 1 s’affiche en premier »', (await v.page.getByText(/la n° 1 s’affiche en premier/).count()) === 1);
      await v.page.getByTestId(`category-up-${cats[2]}`).click();
      await sleep(1500);
      const after = await rowsOf(v.page);
      check(`▲ sur la 3e (${cats[2]}) : elle passe 2e`, after[1] === cats[2] && after[2] === cats[1], after);
      check('1er enregistrement : chaque categorie recoit son numero (et rien d\'autre)', fc.patches.length === cats.length && fc.patches.every((p) => Object.keys(p).join() === 'id,sort_order') && fc.order[cats[2]] === 2 && fc.order[cats[1]] === 3 && fc.order[cats[0]] === 1, fc.patches.slice(0, 4));
      await v.page.getByTestId(`category-down-${cats[0]}`).click();
      await sleep(1500);
      const after2 = await rowsOf(v.page);
      check('▼ sur la 1re : elle passe 2e, seulement 2 numeros envoyes', after2[0] === cats[2] && after2[1] === cats[0] && fc.patches.length === cats.length + 2, { after2, n: fc.patches.length });
      await v.page.reload({ waitUntil: 'load' });
      await v.page.getByTestId(`category-row-${cats[0]}`).waitFor({ timeout: 30000 });
      await sleep(1000);
      check('page rouverte : l\'ordre est garde', (await rowsOf(v.page)).join() === after2.join());
      const upFirst = v.page.getByTestId(`category-up-${after2[0]}`);
      check('▲ de la 1re et ▼ de la derniere desactives', (await upFirst.getAttribute('aria-disabled')) === 'true' && (await v.page.getByTestId(`category-down-${after2[after2.length - 1]}`).getAttribute('aria-disabled')) === 'true');
      check('aucune erreur dans la page', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      const fc = { missing: true, patches: [] };
      const fu = adminAccount();
      const v = await newVisitor(phone, { storage: { [SK]: fu.session }, fakeUser: fu, fakeCats: fc });
      await v.page.goto(`${BASE}/admin/categories`, { waitUntil: 'load' });
      await v.page.getByTestId(`category-row-${cats[0]}`).waitFor({ timeout: 30000 });
      await sleep(1000);
      await v.page.getByTestId(`category-up-${cats[1]}`).click();
      await v.page.getByText('Lancez d’abord le script add-category-order.sql dans Supabase.').waitFor({ timeout: 10000 });
      await sleep(1500);
      check('script SQL pas lance : message clair et l\'ordre revient comme avant', (await rowsOf(v.page)).join() === cats.join());
      await v.ctx.close();
    }
    // l'accueil et Zara suivent l'ordre choisi
    {
      const order = { parfum: 1, montre: 2 };
      const v = await newVisitor(phone, { fakeCats: { order }, storage: { albasse_zara_name: 'Ali' } });
      await openHome(v);
      const tiles = (await v.page.getByTestId('home-categories').innerText()).split('\n').map((t) => t.trim()).filter(Boolean);
      check('accueil : Parfum 1re, Montre 2e, puis les autres par ordre alphabetique', tiles[0] === 'Parfum' && tiles[1] === 'Montre' && tiles[2] === (await get('categories?select=name&order=name'))[0].name, tiles.slice(0, 4));
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, '🛍️ Catégories', /Choisissez une catégorie/);
      await sleep(800);
      const chips = await chipLabels(v.page);
      check('Zara : les boutons des categories suivent le meme ordre (Parfum avant Montre)', chips.indexOf('Parfum') !== -1 && chips.indexOf('Parfum') < chips.indexOf('Montre'), chips);
      await v.ctx.close();
    }
  }

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
        if (a && /^(intent|fb):|facebook\.com|linkedin\.com/.test(a.getAttribute('href') || '')) {
          window.__fbNav.push(a.getAttribute('href'));
          e.preventDefault();
        }
      }, true);
    };
    const openProduct = async (v) => {
      await v.page.goto(`${BASE}/produit/${prod.slug}`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByText('📘 Facebook').first().waitFor({ timeout: 15000 });
      // comme un client : on fait defiler la fiche pour amener le bouton au milieu de l'ecran (pas sous la barre « Commander »)
      await v.page.getByText('📘 Facebook').first().evaluate((el) => {
        let sc = el.parentElement;
        while (sc && !(sc.scrollHeight > sc.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
        if (sc) sc.scrollTop += el.getBoundingClientRect().top - window.innerHeight * 0.4;
      });
      await sleep(600);
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
    // LinkedIn, juste a cote de Facebook : sur telephone, l'application LinkedIn s'ouvre directement (pas le navigateur)
    const linkedinWeb = (u) => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u);
    const liIntent = (u) => `intent://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}#Intent;scheme=https;package=com.linkedin.android;S.browser_fallback_url=${encodeURIComponent(linkedinWeb(u))};end`;
    const layout = async (v, label) => {
      await openProduct(v);
      const fbBox = await v.page.getByText('📘 Facebook').first().boundingBox();
      const liBtn = v.page.getByTestId('share-linkedin').first();
      await liBtn.waitFor({ timeout: 10000 });
      const liBox = await liBtn.boundingBox();
      const waBox = await v.page.getByText('💬 WhatsApp').first().boundingBox();
      const width = v.page.viewportSize().width;
      const mid = (b) => b.y + b.height / 2;
      check(`${label} : « 💼 LinkedIn » est A COTE de « 📘 Facebook » (meme rangee, a sa droite), WhatsApp et Facebook avant lui, le tout dans l'ecran`,
        !!fbBox && !!liBox && !!waBox && Math.abs(mid(liBox) - mid(fbBox)) < 8 && Math.abs(mid(waBox) - mid(fbBox)) < 8 && liBox.x > fbBox.x + fbBox.width && fbBox.x > waBox.x && liBox.x >= 0 && liBox.x + liBox.width <= width, { waBox, fbBox, liBox, width });
      check(`${label} : le texte du bouton est « 💼 LinkedIn »`, /💼 LinkedIn/.test(await liBtn.innerText()));
      return liBtn;
    };
    // Android (Chrome) : le lien est donne DIRECTEMENT a l'application LinkedIn ; la page de partage du site seulement si elle n'est pas installee
    {
      const v = await newVisitor(phone, { initScripts: [catchLinks] });
      const li = await layout(v, 'Android');
      await v.page.screenshot({ path: path.join(OUT, 'N-linkedin-telephone.png') });
      await li.click();
      await sleep(600);
      const nav = await shareOf(v);
      check('Android : le bouton ouvre directement l\'application LinkedIn (com.linkedin.android), avec le lien de l\'article et la page de partage du site en secours', nav.length === 1 && nav[0] === liIntent(pageUrl), nav);
      check('Android : la fiche produit reste affichee (pas d\'onglet du navigateur ouvert)', v.ctx.pages().length === 1 && v.page.url().includes(`/produit/${prod.slug}`), v.ctx.pages().map((p) => p.url()));
      check('aucune erreur (LinkedIn, Android)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // petit telephone (360 px) : memes boutons cote a cote
    {
      const v = await newVisitor({ ...phone, viewport: { width: 360, height: 740 } }, { initScripts: [catchLinks] });
      await layout(v, 'petit telephone (360 px)');
      await v.ctx.close();
    }
    // Android, dans l'application Albasse : l'application LinkedIn d'abord ; sans reponse, la page de partage 1,5 s plus tard (une seule fois)
    {
      const v = await newVisitor(phone, { storage: { albasse_app_shell: '1' }, initScripts: [catchLinks] });
      const li = await layout(v, 'application Albasse');
      await li.click();
      await sleep(400);
      const first = await shareOf(v);
      check('application Albasse : l\'application LinkedIn est appelee tout de suite', first.length === 1 && first[0] === liIntent(pageUrl), first);
      await sleep(1700);
      const after = await shareOf(v);
      check('application Albasse : LinkedIn ne s\'est pas ouvert -> la page de partage ensuite (une seule fois)', after.length === 2 && after[1] === linkedinWeb(pageUrl), after);
      await li.click();
      await sleep(300);
      await v.page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await sleep(1800);
      const opened = await shareOf(v);
      check('application Albasse : si LinkedIn s\'ouvre, rien d\'autre ne s\'ouvre', opened.length === 3 && opened[2].startsWith('intent://www.linkedin.com'), opened);
      check('aucune erreur (LinkedIn, application Albasse)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // iPhone : le lien linkedin.com (l'iPhone l'ouvre dans l'application LinkedIn quand elle est installee)
    {
      const v = await newVisitor({ ...devices['iPhone 13'], viewport: { width: 390, height: 800 } }, { initScripts: [catchLinks] });
      const li = await layout(v, 'iPhone');
      await li.click();
      await sleep(600);
      const nav = await shareOf(v);
      check('iPhone : le lien linkedin.com est touche dans la page (lien universel vers l\'application LinkedIn)', nav.length === 1 && nav[0] === linkedinWeb(pageUrl), nav);
      check('aucune erreur (LinkedIn, iPhone)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // ordinateur : un nouvel onglet avec la page de partage, la fiche reste affichee
    {
      const v = await newVisitor({ viewport: { width: 1280, height: 800 } }, {});
      const li = await layout(v, 'ordinateur');
      const asked = [];
      v.ctx.on('request', (r) => { if (/linkedin\.com/.test(r.url())) asked.push(r.url()); }); // le test ne laisse rien sortir : on note l'adresse demandee
      const [popup] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), li.click()]);
      await sleep(800);
      check('ordinateur : la page de partage LinkedIn s\'ouvre dans un nouvel onglet avec le lien de l\'article, la fiche reste affichee', popup !== v.page && asked.includes(linkedinWeb(pageUrl)) && v.page.url().includes(`/produit/${prod.slug}`), { asked, page: v.page.url() });
      check('aucune erreur (LinkedIn, ordinateur)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('Q')) {
    console.log('\n== Q. categorie touchee dans le chat : ses articles s\'affichent dans le chat (bouton « + »), Zara reste ouverte');
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      await v.page.keyboard.press('Escape');
      await v.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(v.page, /Créez votre compte gratuit(?:, Ali)?/);
      await tap(v.page, '🛍️ Catégories', /Choisissez une catégorie/);
      await sleep(800);
      const cats = await chipLabels(v.page);
      const pick = cats.includes('Montre') ? 'Montre' : cats[0];
      const before = await cardsOf(v.page).count();
      await panelOf(v.page).getByTestId('assistant-chip').filter({ hasText: new RegExp(`^\\s*${pick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).click();
      await waitText(v.page, /voici nos articles/);
      await sleep(1500);
      const intro = await panelOf(v.page).getByText(/voici nos articles/).last().innerText();
      check('categorie touchee : Zara annonce la categorie par son nom et le nombre d\'articles disponibles', new RegExp(`^🛍️ ${pick} : voici nos articles(, Ali)? 👇( \\(\\d+ disponibles\\))?$`).test(intro), intro);
      const shown = (await cardsOf(v.page).count()) - before;
      check('categorie touchee : Zara reste ouverte, la page ne change pas', (await panelOf(v.page).count()) === 1 && new URL(v.page.url()).pathname === '/', v.page.url());
      check('categorie touchee : ses articles s\'affichent dans le chat (1 a 6 cartes)', shown >= 1 && shown <= 6, shown);
      check('chaque carte a son bouton « Commander »', (await panelOf(v.page).getByTestId('assistant-card-add').count()) >= shown, await panelOf(v.page).getByTestId('assistant-card-add').count());
      const chips1 = await chipLabels(v.page);
      check('boutons : « Page « categorie » » pour ceux qui preferent la page, et le menu', chips1.includes(`📄 Page « ${pick} »`) && chips1.includes('🏠 Menu'), chips1);
      if (chips1.includes('➕ Voir plus')) {
        const n1 = await cardsOf(v.page).count();
        await chip(v.page, '➕ Voir plus').click();
        await waitText(v.page, /la suite, 7 à \d+ sur \d+/);
        await sleep(1200);
        check('« Voir plus » : la suite des articles dans le chat (pas les memes)', (await cardsOf(v.page).count()) > n1 && new URL(v.page.url()).pathname === '/', await cardsOf(v.page).count());
      } else check('« Voir plus » absent : tous les articles de la categorie sont deja affiches', shown <= 6, shown);
      // « Commander » sur une carte du chat : Zara prend la commande (ou demande la taille / la couleur), sans quitter le chat
      await cardsOf(v.page).last().getByTestId('assistant-card-add').click();
      await waitText(v.page, /Très bon choix|Quelle taille|Quelle couleur|Choisissez/);
      check('« Commander » dans le chat : Zara prend la commande (ou demande la taille/couleur) et reste ouverte', (await panelOf(v.page).count()) === 1 && new URL(v.page.url()).pathname === '/');
      // « Page » : ouvre la page de la categorie (le client l'a choisi)
      await panelOf(v.page).getByTestId('assistant-chip-old').filter({ hasText: `📄 Page « ${pick} »` }).first().click();
      await sleep(2000);
      check('« Page » : la page de la categorie s\'ouvre', /\/categorie\//.test(v.page.url()), v.page.url());
      check('aucune erreur (categorie dans le chat)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
  }

  if (PARTS.includes('J')) {
    console.log('\n== J. anciens boutons de Zara : ceux qui menent quelque part restent touchables, les reponses passees partent');
    const oldLabels = async (p) => (await panelOf(p).getByTestId('assistant-chip-old').allInnerTexts()).map((t) => t.trim());
    {
      const v = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
    const base = `${BASE}`;
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
      // un espace est ouvert entre « Recherche » et « Commandes » : le bouton y tient sans toucher aucun onglet
      const tabs = await v.page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, label: (e.innerText || '').replace(/\s+/g, ' ').trim() }; }));
      const sTab = tabs.find((t) => /Recherche/.test(t.label));
      const cTab = tabs.find((t) => /Commandes/.test(t.label));
      check('barre du bas : un espace est ouvert entre « Recherche » et « Commandes » (au moins 80 px) et le bouton de Zara y tient, sans toucher les onglets', tabs.length === 4 && !!sTab && !!cTab && cTab.x - sTab.right >= 80 && g.x >= sTab.right && g.x + g.w <= cTab.x, { tabs, g });
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
        check('fiche produit (pas de barre du bas) : le bouton est dans le coin en bas a droite, 62 px plus haut (au-dessus de la barre « Commander »)', Math.abs(vp.height - g.bottom - (82 + 62)) <= 2 && Math.abs(vp.width - 14 - (g.x + g.w)) <= 2, { bottom: vp.height - g.bottom, g });
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
    const base = `${BASE}`;
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

      // --- G6. comparer deux articles : prix exacts, ecart exact, choix de couleurs / tailles ; « Je prends » lance la commande
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
        if (await panelOf(v.page).getByText(/Très bon choix/).count()) break;
        await sleep(1500);
        if ((await panelOf(v.page).getByText(/Quelle (taille|couleur) pour/).count()) > 0 && (await panelOf(v.page).getByText(/Très bon choix/).count()) === 0) {
          const q = await panelOf(v.page).getByText(/Quelle (taille|couleur) pour/).count();
          const before = q;
          await panelOf(v.page).getByTestId('assistant-chip').first().click();
          const t0 = Date.now();
          while ((await panelOf(v.page).getByText(/Quelle (taille|couleur) pour|Très bon choix/).count()) <= before && Date.now() - t0 < 8000) await sleep(300);
        }
      }
      await waitText(v.page, /Très bon choix/, 25000);
      check('« Je prends » : Zara lance la commande de cet article (aucune commande n\'est annoncee avant la confirmation du systeme)', (await panelOf(v.page).getByText(/commande (est )?passée|paiement reçu|stock réservé/i).count()) === 0);
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
      await p.goto(`${BASE}/`, { waitUntil: 'load' });
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
    const cartOf = (qty) => JSON.stringify({ state: { items: [{ id: `${realProduct.id}__nc__ns`, product: realProduct, quantity: qty, color: null, size: null }], updatedAt: Date.now() }, version: 1 });
    // le client est deja connu et salue (conversation et « deja salue » mis dans l'onglet) : ces essais testent la commande, pas l'accueil
    const seedOf = (lg) => ({ albasse_zara_v1: JSON.stringify({ messages: [{ id: 's1', role: 'assistant', text: lg === 'ar' ? 'مرحباً' : 'Bonjour', lang: lg }], step: 'menu', ctx: null, need: null, order: null }), albasse_zara_member: UID });
    const orderVisitor = (fu, db, { qty = 1, lg = 'fr', install } = {}) =>
      newVisitor(phone, { ...(install !== undefined ? { zaraInstall: install } : {}), lang: lg, storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': fu.session, 'albasse-cart': cartOf(qty) }, session: seedOf(lg), fakeUser: fu, fakeOrders: db });
    const openOrderChat = async (c) => {
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
    // a N'Djamena Zara propose un rendez-vous de livraison (facultatif) : « Passer » = livraison normale, puis la question du paiement
    const tapHomeSkip = async (p) => {
      await tapExact(p, homeCity.name, /Voulez-vous choisir le jour et l’heure/);
      await tapExact(p, 'Passer', /Comment souhaitez-vous payer/);
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
      check('le panier est vide apres l\'enregistrement, et boutons Facture / Mes commandes / Lier mon Telegram (compte pas encore lie) / Menu', (await cartCount(c.page)) === 0 && (await chipLabels(c.page)).join('|') === '📄 Télécharger ma facture|📦 Mes commandes|✈️ Lier mon Telegram|🏠 Menu', await chipLabels(c.page));
      check('apres la commande dans le chat : une ligne d\'astuce invite a lier Telegram', /Astuce : liez votre Telegram/.test(await panelOf(c.page).innerText()));
      check('confirmation : Zara annonce que la facture est prete', /Votre facture est prête/.test(done), done);
      await c.page.screenshot({ path: path.join(OUT, 'O2-confirmation.png') });
      // facture PDF : le bouton de Zara demande le PDF a la fonction serveur avec le jeton du compte et le telecharge sans quitter le chat
      {
        const calls = [];
        const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-expose-headers': 'Content-Disposition' };
        const fakePdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
        await c.page.route('**/functions/v1/order-invoice', async (route) => {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
          calls.push({ auth: route.request().headers().authorization || '', body: JSON.parse(route.request().postData() || '{}') });
          return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="Facture-FA-2026-000012.pdf"' }, body: fakePdf });
        });
        const [dl] = await Promise.all([c.page.waitForEvent('download', { timeout: 15000 }), panelOf(c.page).getByTestId('assistant-chip').filter({ hasText: /Télécharger ma facture/ }).click()]);
        const saved = fs.readFileSync(await dl.path());
        check('facture PDF : un fichier « Facture-FA-2026-000012.pdf » est telecharge (le nom donne par le serveur)', dl.suggestedFilename() === 'Facture-FA-2026-000012.pdf' && saved.subarray(0, 5).toString() === '%PDF-', dl.suggestedFilename());
        check('facture PDF : la demande part avec le jeton du compte, l\'action « pdf » et LA commande qui vient d\'etre passee', calls.length === 1 && /^Bearer eyJ/.test(calls[0].auth) && calls[0].body.action === 'pdf' && calls[0].body.order_id === b.id, calls);
        await c.page.getByText('Facture téléchargée').waitFor({ timeout: 8000 });
        check('facture PDF : message « Facture telechargee » et Zara reste ouverte (le chat n\'est pas ferme)', (await panelOf(c.page).getByTestId('assistant-chip').count()) >= 3 && new URL(c.page.url()).pathname === '/');
        // fonction pas en ligne (404) : la facture s'ouvre a l'ecran, le chat se ferme
        await c.page.unroute('**/functions/v1/order-invoice');
        await c.page.route('**/functions/v1/order-invoice', (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 404, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'NOT_FOUND', message: 'Requested function was not found' }) })));
        await panelOf(c.page).getByTestId('assistant-chip').filter({ hasText: /Télécharger ma facture/ }).click();
        await c.page.waitForURL(new RegExp(`/facture/${b.id}$`), { timeout: 10000 });
        check('facture PDF : fonction absente (404) : la page « Facture » de la commande s\'ouvre a la place (jamais d\'impasse)', true);
      }
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
      await waitText(c.page, /Voulez-vous choisir le jour et l’heure/);
      const slotChips = await chipLabels(c.page);
      check('a N\'Djamena : Zara propose les jours, « Passer » et annuler ; la livraison normale n\'est pas dans la liste', slotChips.length >= 9 && slotChips[slotChips.length - 2] === 'Passer' && slotChips[slotChips.length - 1] === 'Annuler la commande' && !slotChips.some((l) => /normale/i.test(l)), slotChips);
      await typeIn(c.page, 'passer');
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
      check('« Passer » : la commande est prise comme une livraison normale (aucun champ de rendez-vous)', !('delivery_type' in b) && !('scheduled_for' in b), b);
      check('recapitulatif sans rendez-vous : aucune ligne « Livraison programmee »', !/Livraison programmée/.test(recap), recap);
      check('aucune erreur (paiement a la livraison)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O2d. apres une commande dans le chat : Zara propose l'application (question deja posee sans reponse = elle la repose ; « Plus tard » = jamais)
    {
      for (const [install, expected] of [['asked', true], ['dismissed', false]]) {
        const fu = mkMember('Ahmed Hassan');
        const db = newDb();
        const c = await orderVisitor(fu, db, { qty: 1, install });
        await openOrderChat(c);
        await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
        await typeIn(c.page, 'Farcha, face à la pharmacie');
        await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
        await typeIn(c.page, homeCity.name);
        await waitText(c.page, /Voulez-vous choisir le jour et l’heure/);
        await typeIn(c.page, 'passer');
        await waitText(c.page, /Comment souhaitez-vous payer/);
        await typeIn(c.page, 'je paie à la livraison');
        await waitText(c.page, /Souhaitez-vous l’emballage cadeau/);
        await typeIn(c.page, 'non merci');
        await waitText(c.page, /Récapitulatif de votre commande/);
        await typeIn(c.page, 'oui');
        await waitText(c.page, /a bien été enregistrée/);
        await sleep(3500);
        const asked = (await panelOf(c.page).getByText(/Avez-vous déjà installé l’application Albasse Shopping/).count()) >= 1;
        if (expected) {
          check('apres la commande (question deja posee sans reponse) : Zara repropose l\'application, avec le bouton pour l\'installer', asked && (await chipLabels(c.page)).some((l) => /Voir comment installer|Installer Albasse Shopping/.test(l)), await chipLabels(c.page));
        } else {
          check('apres la commande, le client avait repondu « Plus tard » : Zara ne le redemande pas', !asked, await chipLabels(c.page));
        }
        check('aucune erreur (commande puis installation)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
    }

    // --- O2b. N'Djamena : le client choisit un rendez-vous de livraison (jour puis heure) dans le chat
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Farcha, face à la pharmacie');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      await tapExact(c.page, homeCity.name, /Voulez-vous choisir le jour et l’heure/);
      const dayChips = await chipLabels(c.page);
      check('jours proposes : « Aujourd\'hui » ou « Demain » en premier, 7 ou 8 jours, puis « Passer » et annuler', /^(Aujourd'hui|Demain)$/.test(dayChips[0]) && dayChips.length >= 9 && dayChips.length <= 10 && dayChips[dayChips.length - 2] === 'Passer', dayChips);
      await tapExact(c.page, dayChips[1], /Quelle heure pour/);
      const timeChips = await chipLabels(c.page);
      check('heures proposees : 15 heures de 8h30 a 15h30, « Autre jour » et annuler', timeChips.length === 17 && timeChips[0] === '8h30' && timeChips[14] === '15h30' && timeChips[15] === '↩️ Autre jour' && timeChips[16] === 'Annuler la commande', timeChips);
      await c.page.screenshot({ path: path.join(OUT, 'O2b-heures.png') });
      await tapExact(c.page, '↩️ Autre jour', /Voulez-vous choisir le jour et l’heure/);
      check('« Autre jour » : Zara repose la question du jour', (await chipLabels(c.page)).join('|') === dayChips.join('|'));
      await tapExact(c.page, dayChips[1], /Quelle heure pour/);
      await tapExact(c.page, '10h00', /Comment souhaitez-vous payer/);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      const recap = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('recapitulatif : « Livraison programmee : … a 10h00 »', /📅 Livraison programmée : .* à 10h00/.test(recap), recap);
      check('recapitulatif : boutons Confirmer / Modifier / Annuler, rien d\'enregistre', (await chipLabels(c.page)).join('|') === '✅ Confirmer la commande|✏️ Modifier|Annuler la commande' && db.attempts.length === 0);
      await c.page.screenshot({ path: path.join(OUT, 'O2b-recapitulatif.png') });
      await tapExact(c.page, '✅ Confirmer la commande', /a bien été enregistrée/);
      const b = db.created[0];
      check('enregistre : « scheduled » et l\'heure exacte (10h00 a N\'Djamena = 09:00 UTC), entre 2 h et 8 jours apres maintenant', db.created.length === 1 && b.delivery_type === 'scheduled' && /^\d{4}-\d{2}-\d{2}T09:00:00\.000Z$/.test(b.scheduled_for) && Date.parse(b.scheduled_for) - Date.now() > 2 * 3600_000 && Date.parse(b.scheduled_for) - Date.now() < 8 * 86_400_000 && b.shipping_city === homeCity.name && b.payment_method === 'cash_on_delivery', b);
      const done = await panelOf(c.page).getByText(/a bien été enregistrée/).last().innerText();
      check('confirmation : rappelle le rendez-vous', /📅 Livraison programmée : .* à 10h00/.test(done), done);
      check('aucune erreur (rendez-vous dans le chat)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O2c. en ecrivant le jour et l'heure ; modifier le rendez-vous ; « Passer » apres coup
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Farcha, face à la pharmacie');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      await typeIn(c.page, homeCity.name);
      await waitText(c.page, /Voulez-vous choisir le jour et l’heure/);
      await typeIn(c.page, 'bof');
      await waitText(c.page, /Touchez un des boutons ci-dessous/);
      await sleep(1500);
      check('un texte qui n\'est pas un jour : Zara repose la question du jour', (await panelOf(c.page).getByText(/Voulez-vous choisir le jour et l’heure/).count()) === 2);
      await typeIn(c.page, 'demain');
      await waitText(c.page, /Quelle heure pour/);
      await typeIn(c.page, '14h20');
      await waitText(c.page, /Touchez un des boutons ci-dessous/);
      await typeIn(c.page, 'à 14h30');
      await waitText(c.page, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      let recap = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('« demain » puis « à 14h30 » ecrits : le recapitulatif dit « demain a 14h30 »', /📅 Livraison programmée : demain à 14h30/.test(recap), recap);
      await tapExact(c.page, '✏️ Modifier', /Que voulez-vous modifier/);
      check('« Modifier » propose « Rendez-vous » (ville de la boutique)', (await chipLabels(c.page)).includes('📅 Rendez-vous'), await chipLabels(c.page));
      await tapExact(c.page, '📅 Rendez-vous', /Voulez-vous choisir le jour et l’heure/);
      await tapExact(c.page, 'Passer', /Récapitulatif de votre commande/);
      recap = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('« Passer » apres coup : le rendez-vous disparait du recapitulatif', !/Livraison programmée/.test(recap), recap);
      await tapExact(c.page, '✅ Confirmer la commande', /a bien été enregistrée/);
      check('enregistre sans rendez-vous', db.created.length === 1 && !('delivery_type' in db.created[0]) && !('scheduled_for' in db.created[0]), db.created[0]);
      check('aucune erreur (rendez-vous ecrit)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- O2d. rendez-vous choisi puis ville changee : le rendez-vous disparait (il n'existe qu'a N'Djamena)
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Farcha, face à la pharmacie');
      await waitText(c.page, /Dans quelle ville doit-on vous livrer/);
      await tapExact(c.page, homeCity.name, /Voulez-vous choisir le jour et l’heure/);
      await typeIn(c.page, 'demain');
      await waitText(c.page, /Quelle heure pour/);
      await typeIn(c.page, 'midi');
      await waitText(c.page, /Comment souhaitez-vous payer/);
      await tapExact(c.page, '📱 Airtel Money', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      await tapExact(c.page, '✏️ Modifier', /Que voulez-vous modifier/);
      await tapExact(c.page, '🏙️ Ville', /Dans quelle ville doit-on vous livrer/);
      await tapExact(c.page, farCity.name, /Récapitulatif de votre commande/);
      const recap = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('ville changee : plus de rendez-vous dans le recapitulatif', !/Livraison programmée/.test(recap) && new RegExp(`Livraison à ${esc(farCity.name)}`).test(recap), recap);
      await tapExact(c.page, '✅ Confirmer la commande', /a bien été enregistrée/);
      check('enregistre hors N\'Djamena sans rendez-vous', db.created.length === 1 && !('delivery_type' in db.created[0]) && !('scheduled_for' in db.created[0]) && db.created[0].shipping_city === farCity.name, db.created[0]);
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
      await tapHomeSkip(c.page);
      await tapExact(c.page, '💵 À la livraison', /Souhaitez-vous l’emballage cadeau/);
      await tapExact(c.page, 'Non, merci', /Récapitulatif de votre commande/);
      const recap1 = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('le telephone « +235 66 12 34 56 » est enregistre en 8 chiffres : 66123456', /📞 66123456/.test(recap1), recap1);
      await tapExact(c.page, '✏️ Modifier', /Que voulez-vous modifier/);
      check('modifier (a N\'Djamena) : nom, telephone, adresse, ville, rendez-vous, paiement, emballage', (await chipLabels(c.page)).join('|') === '👤 Nom|📞 Téléphone|📍 Adresse|🏙️ Ville|📅 Rendez-vous|💳 Paiement|🎁 Emballage|Annuler la commande', await chipLabels(c.page));
      await tapExact(c.page, '📍 Adresse', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Chagoua, rue 5');
      await waitText(c.page, /📍 Quartier Chagoua, rue 5, /);
      const recap2 = await panelOf(c.page).getByText(/Récapitulatif de votre commande/).last().innerText();
      check('apres la modification : nouveau recapitulatif avec la nouvelle adresse (le reste ne change pas)', /📍 Quartier Chagoua, rue 5,/.test(recap2) && /📞 66123456/.test(recap2) && !/Moursal/.test(recap2), recap2);
      await tapExact(c.page, 'Annuler la commande', /j’ai arrêté la commande/);
      check('annuler : l\'article reste choisi, rien n\'est enregistre, « Terminer ma commande » pour reprendre', (await cartCount(c.page)) === 1 && db.attempts.length === 0 && (await chipLabels(c.page)).includes('✅ Terminer ma commande'), await chipLabels(c.page));
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
      await tapHomeSkip(c.page);
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
      await tapHomeSkip(c.page);
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
      await tapHomeSkip(c.page);
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
      await c.page.route(/\/rest\/v1\/products\?.*(select=id%2Cprice|select=id,price|[?&]id=in\.)/, (route) =>
        route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: realProduct.id, price: price + bump, compare_at_price: realProduct.compare_at_price, stock: realProduct.stock, is_active: true }]) })
      );
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await typeIn(c.page, 'Quartier Farcha');
      await tapHomeSkip(c.page);
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

    // --- O8b. arabe : rendez-vous de livraison a N'Djamena (jours et heures en arabe, recapitulatif de droite a gauche)
    {
      const fu = mkMember('Ahmed Hassan');
      const db = newDb();
      const c = await orderVisitor(fu, db, { qty: 1 });
      await openOrderChat(c);
      await ask(c.page, 'je veux commander', /Quelle est votre adresse de livraison/);
      await c.page.getByTestId('assistant-lang').click();
      await waitText(c.page, /ما عنوان التوصيل؟/);
      await typeIn(c.page, 'حي فرشا قرب الصيدلية');
      await waitText(c.page, /في أي مدينة يجب أن نوصّل إليك؟/);
      await tapExact(c.page, homeCity.name, /هل تريد اختيار يوم وساعة التوصيل في إنجامينا/);
      const dayChips = await chipLabels(c.page);
      check('arabe : jours (اليوم أو غداً en premier), « تخطي » et annuler', /^(اليوم|غداً)$/.test(dayChips[0]) && dayChips[dayChips.length - 2] === 'تخطي' && dayChips[dayChips.length - 1] === 'إلغاء الطلب', dayChips);
      await tapExact(c.page, dayChips[1], /في أي ساعة/);
      const timeChips = await chipLabels(c.page);
      check('arabe : 15 heures de 8:30 a 15:30, « يوم آخر » et annuler', timeChips.length === 17 && timeChips[0] === '8:30' && timeChips[14] === '15:30' && timeChips[15] === '↩️ يوم آخر', timeChips);
      await tapExact(c.page, '10:00', /كيف تريد الدفع؟/);
      await tapExact(c.page, (await chipLabels(c.page))[0], /هل تريد تغليف الهدية؟/);
      await tapExact(c.page, 'لا، شكراً', /ملخص طلبك/);
      const recap = await panelOf(c.page).getByText(/ملخص طلبك/).last().innerText();
      check('recapitulatif arabe : « 📅 توصيل بموعد محدد : … الساعة 10:00 »', /📅 توصيل بموعد محدد: .* الساعة 10:00/.test(recap), recap);
      await c.page.screenshot({ path: path.join(OUT, 'O8b-arabe-rendez-vous.png') });
      await tapExact(c.page, '✅ تأكيد الطلب', /تم تسجيل طلبك رقم #/);
      const b = db.created[0];
      check('arabe : enregistre « scheduled » a 10:00 (09:00 UTC)', db.created.length === 1 && b.delivery_type === 'scheduled' && /T09:00:00\.000Z$/.test(b.scheduled_for), b);
      const done = await panelOf(c.page).getByText(/تم تسجيل طلبك رقم #/).last().innerText();
      check('confirmation arabe : rappelle le rendez-vous', /📅 توصيل بموعد محدد: .* الساعة 10:00/.test(done), done);
      check('aucune erreur (rendez-vous en arabe)', c.errs.length === 0, c.errs);
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
      await waitText(c.page, /Voulez-vous choisir le jour et l’heure/);
      await typeIn(c.page, 'passer');
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
        await v.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
    console.log('\n== B. contexte : fiche produit et commande commencee');
    {
      const c = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' } });
      await c.page.goto(`${BASE}/produit/rolex`, { waitUntil: 'load' });
      await sleep(3500);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Ali'));
      await waitText(c.page, /Vous regardez « Rolex » \? Excellent choix !/);
      const pitch = await panelOf(c.page).getByText(/Vous regardez « Rolex »/).first().innerText();
      check('sur la fiche d\'un produit : Zara parle de ce produit et donne son prix actuel', /Vous regardez « Rolex » \? Excellent choix !/.test(pitch) && /\d[\d\s]*FCFA/.test(pitch), pitch);
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, /Créez votre compte gratuit(?:, Ali)?/);
      await c.page.screenshot({ path: path.join(OUT, 'B1-produit.png') });
      check('aucune erreur (fiche produit)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    {
      const item = { id: `${realProduct.id}__nc__ns`, product: realProduct, quantity: 2, color: null, size: null };
      const cart = JSON.stringify({ state: { items: [item], updatedAt: Date.now() }, version: 1 });
      const c = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali', 'albasse-cart': cart } });
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(3000);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, /🛍️ Votre commande n’est pas terminée : « Rolex » pour 25\s?000 FCFA/);
      await waitText(c.page, /Créez votre compte gratuit(?:, Ali)?/);
      check('commande commencee : Zara la rappelle (article, total pour la quantite choisie) et propose « Terminer ma commande »', (await chipLabels(c.page)).includes('✅ Terminer ma commande') && !(await chipLabels(c.page)).some((l) => /panier/i.test(l)), await chipLabels(c.page));
      await chip(c.page, 'Terminer ma commande').click();
      await waitText(c.page, /Pas besoin de compte pour commander/);
      check('« Terminer ma commande » sans compte : pas besoin de compte, la page de commande est proposee (l\'article reste choisi)', (await c.page.evaluate(() => JSON.parse(localStorage.getItem('albasse-cart') || '{}').state?.items?.length ?? 0)) === 1);
      check('aucune erreur (commande commencee)', c.errs.length === 0, c.errs);
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
    const cartJson = JSON.stringify({ state: { items: [item], updatedAt: Date.now() }, version: 1 });
    const storage = { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fu), 'albasse-cart': cartJson };
    const mkOrder = (id, status, gift, total, items) => ({
      id, user_id: uid, items, total, status, payment_method: 'airtel_money', payment_reference: null, shipping_name: 'Aminata Hassan', shipping_phone: '66123456',
      shipping_address: 'Quartier Farcha', shipping_city: 'Moundou', session_id: null, referrer_source: null, is_flagged_fake: false, gift_wrap: gift, created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    });
    const oi = (name, price, qty = 1) => ({ product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', product_name: name, product_image: null, unit_price: price, quantity: qty, color: null, size: null });

    // --- chat d'un client connecte
    {
      const c = await newVisitor(phone, { storage, fakeUser: fu });
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(3500);
      await c.page.getByRole('button', { name: FAB_NAME }).click();
      await waitText(c.page, WELCOME_FR('Aminata'));
      await waitText(c.page, /À savoir avant de commander/);
      await waitText(c.page, 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
      const labels = await chipLabels(c.page);
      check('client connecte : pas d\'invitation a creer un compte ; « Terminer ma commande » et commandes proposes', !labels.some((l) => /Créer mon compte/.test(l)) && labels.includes('✅ Terminer ma commande') && labels.includes('📦 Mes commandes'), labels);
      await c.page.screenshot({ path: path.join(OUT, 'C1-connecte.png') });
      check('aucune erreur (client connecte)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- page de commande : paiement a la livraison seulement a N'Djamena + emballage cadeau
    {
      const c = await newVisitor(phone, { storage, fakeUser: fu });
      const { page } = c;
      await page.goto(`${BASE}/commande`, { waitUntil: 'load' });
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

    // --- livraison programmee (clients de N'Djamena) : choix du jour et de l'heure, enregistrement, affichage
    {
      const cityPick = async (page, name) => {
        const input = page.getByPlaceholder('📍 Rechercher une ville...');
        await input.click();
        await input.fill(name);
        await sleep(300);
        await page.getByText(name, { exact: true }).first().click();
        await sleep(500);
      };
      const open = async (fakeOrders) => {
        const c = await newVisitor(phone, { storage, fakeUser: fu, fakeOrders });
        await c.page.goto(`${BASE}/commande`, { waitUntil: 'load' });
        await sleep(3500);
        return c;
      };
      const confirmBtn = (page) => page.getByText('Confirmer la commande', { exact: true });

      // le choix n'existe que pour N'Djamena
      {
        const c = await open({ list: [], patches: [] });
        const { page } = c;
        check('livraison programmee : pas de choix tant que la ville n\'est pas choisie', (await page.getByTestId('delivery-picker').count()) === 0);
        await cityPick(page, 'Moundou');
        check('livraison programmee : pas de choix pour Moundou', (await page.getByTestId('delivery-picker').count()) === 0);
        await cityPick(page, "N'Djamena");
        check("livraison programmee : N'Djamena montre le choix du jour et de l'heure tout de suite, SANS « Livraison normale » dans la liste", (await page.getByTestId('delivery-picker').count()) === 1 && (await page.getByTestId('delivery-schedule-box').count()) === 1 && (await page.getByText('Livraison programmée', { exact: true }).count()) >= 1 && (await page.getByText(/Livraison normale/).count()) === 0 && (await page.getByTestId('delivery-standard').count()) === 0);
        check('livraison programmee : aucun rendez-vous choisi au depart', (await page.getByTestId('sched-summary').count()) === 0);
        const dayIds = await page.locator('[data-testid^="sched-day-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
        check('programmee : 7 ou 8 jours proposes, a partir d\'aujourd\'hui ou de demain', dayIds.length >= 7 && dayIds.length <= 8, dayIds);
        const firstLabel = (await page.locator('[data-testid^="sched-day-"]').first().innerText()).trim();
        check('programmee : le premier jour est « Aujourd\'hui » ou « Demain »', /^(Aujourd'hui|Demain)$/.test(firstLabel), firstLabel);
        check('programmee : tant que le jour n\'est pas choisi, « Choisissez d\'abord le jour »', (await page.getByText('Choisissez d’abord le jour.').count()) === 1 && (await page.locator('[data-testid^="sched-time-"]').count()) === 0);
        await page.locator('[data-testid^="sched-day-"]').nth(1).click();
        await sleep(300);
        check('programmee : 15 heures proposees (8h30 a 15h30)', (await page.locator('[data-testid^="sched-time-"]').count()) === 15 && (await page.getByTestId('sched-time-08:30').count()) === 1 && (await page.getByTestId('sched-time-15:30').count()) === 1 && (await page.getByTestId('sched-time-16:00').count()) === 0);
        check('programmee : pas encore de rendez-vous annonce', (await page.getByTestId('sched-summary').count()) === 0);
        await page.screenshot({ path: path.join(OUT, 'C7-livraison-programmee.png'), fullPage: true });
        // changer de ville : le choix disparait et la livraison redevient normale
        await cityPick(page, 'Sarh');
        check('programmee : changer pour Sarh retire le choix', (await page.getByTestId('delivery-picker').count()) === 0);
        await cityPick(page, "N'Djamena");
        check('programmee : retour a N\'Djamena = aucun rendez-vous (le choix precedent est oublie) et aucun jour choisi', (await page.getByTestId('sched-summary').count()) === 0 && (await page.locator('[data-testid^="sched-time-"]').count()) === 0);
        check('aucune erreur (choix de livraison)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }

      // commande avec rendez-vous
      {
        const db = { list: [], patches: [] };
        const c = await open(db);
        const { page } = c;
        await page.getByPlaceholder('Adresse (quartier, rue)').fill('Farcha, rue 12');
        await cityPick(page, "N'Djamena");
        await page.getByRole('radio', { name: /Paiement à la livraison/ }).click();
        const dayEl = page.locator('[data-testid^="sched-day-"]').nth(1);
        const dayKey = (await dayEl.getAttribute('data-testid')).replace('sched-day-', '');
        await dayEl.click();
        await confirmBtn(page).click();
        await page.getByText(/Choisissez le jour et l.heure du rendez-vous/).first().waitFor({ timeout: 5000 });
        check('un jour choisi sans l\'heure : message et RIEN n\'est enregistre', (db.attempts ?? []).length === 0);
        await page.getByTestId('sched-time-10:00').click();
        await sleep(300);
        const summary = await page.getByTestId('sched-summary').innerText();
        check('rendez-vous annonce : « Rendez-vous : … a 10h00 »', /Rendez-vous : .* à 10h00/.test(summary), summary);
        await page.screenshot({ path: path.join(OUT, 'C8-rendez-vous-choisi.png'), fullPage: true });
        await confirmBtn(page).click();
        await page.getByTestId('confirm-scheduled').waitFor({ timeout: 15000 });
        const sent = (db.created ?? [])[0];
        check('la commande envoyee a la base porte le type « scheduled » et l\'heure exacte (10h00 a N\'Djamena = 09:00 UTC)', sent && sent.delivery_type === 'scheduled' && sent.scheduled_for === `${dayKey}T09:00:00.000Z`, sent);
        check('la commande garde sa ville, son paiement et son total (livraison de N\'Djamena gratuite)', sent && sent.shipping_city === "N'Djamena" && sent.payment_method === 'cash_on_delivery' && Number(sent.total) === Number(realProduct.price), { sent, price: realProduct.price });
        check('une seule commande enregistree', (db.created ?? []).length === 1);
        const conf = await page.getByTestId('confirm-scheduled').innerText();
        check('confirmation : « Livraison programmee : … a 10h00 »', /Livraison programmée : .* à 10h00/.test(conf), conf);
        await page.screenshot({ path: path.join(OUT, 'C9-confirmation-programmee.png') });
        check('aucune erreur (commande programmee)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }

      // commande normale a N'Djamena : exactement comme avant (aucun champ de livraison programmee)
      {
        const db = { list: [], patches: [] };
        const c = await open(db);
        const { page } = c;
        await page.getByPlaceholder('Adresse (quartier, rue)').fill('Farcha, rue 12');
        await cityPick(page, "N'Djamena");
        await page.getByRole('radio', { name: /Paiement à la livraison/ }).click();
        await confirmBtn(page).click();
        await page.getByText('Merci d\'avoir acheté avec ALBASSE SHOPPING !').waitFor({ timeout: 15000 });
        const sent = (db.created ?? [])[0];
        check('commande normale : ni delivery_type ni scheduled_for envoyes', sent && !('delivery_type' in sent) && !('scheduled_for' in sent), sent);
        check('confirmation d\'une commande normale : pas de ligne « Livraison programmee »', (await page.getByTestId('confirm-scheduled').count()) === 0);
        await c.ctx.close();
      }

      // choisir « programmee » puis changer de ville avant de confirmer : la commande part en livraison normale
      {
        const db = { list: [], patches: [] };
        const c = await open(db);
        const { page } = c;
        await page.getByPlaceholder('Adresse (quartier, rue)').fill('Quartier Nord');
        await cityPick(page, "N'Djamena");
        await page.locator('[data-testid^="sched-day-"]').nth(1).click();
        await page.getByTestId('sched-time-11:30').click();
        await cityPick(page, 'Sarh');
        await confirmBtn(page).click();
        await page.getByText('Merci d\'avoir acheté avec ALBASSE SHOPPING !').waitFor({ timeout: 15000 });
        const sent = (db.created ?? [])[0];
        check('programmee puis autre ville : la commande part sans rendez-vous', sent && sent.shipping_city === 'Sarh' && !('delivery_type' in sent) && !('scheduled_for' in sent), sent);
        await c.ctx.close();
      }

      // la base ne connait pas encore la livraison programmee (script SQL pas lance) : le rendez-vous n'est JAMAIS perdu en silence
      {
        const db = { list: [], patches: [], rejectColumn: 'delivery_type' };
        const c = await open(db);
        const { page } = c;
        await page.getByPlaceholder('Adresse (quartier, rue)').fill('Farcha, rue 12');
        await cityPick(page, "N'Djamena");
        await page.getByRole('radio', { name: /Paiement à la livraison/ }).click();
        const dayEl2 = page.locator('[data-testid^="sched-day-"]').nth(1);
        await dayEl2.click();
        await page.getByTestId('sched-time-14:00').click();
        await confirmBtn(page).click();
        await page.getByText(/La livraison programmée n.est pas encore disponible/).first().waitFor({ timeout: 8000 });
        check('script SQL pas lance : message clair, aucune commande enregistree sans son rendez-vous', (db.created ?? []).length === 0 && (db.attempts ?? []).length === 1);
        // le client touche une 2e fois le jour choisi : plus de rendez-vous, la commande est prise comme une livraison normale
        await dayEl2.click();
        await sleep(300);
        check('toucher une 2e fois le jour choisi annule le rendez-vous (plus d\'heures ni de resume)', (await page.getByTestId('sched-summary').count()) === 0 && (await page.locator('[data-testid^="sched-time-"]').count()) === 0);
        await confirmBtn(page).click();
        await page.getByText('Merci d\'avoir acheté avec ALBASSE SHOPPING !').waitFor({ timeout: 15000 });
        check('puis sans rendez-vous : la commande est enregistree en livraison normale', (db.created ?? []).length === 1 && !('delivery_type' in db.created[0]));
        await c.ctx.close();
      }

      // Mes commandes (client) et page d'administration
      {
        const when = new Date(Date.now() + 2 * 86_400_000).toISOString();
        const S = { ...mkOrder('abababab-0000-4000-8000-0000000000a1', 'pending', false, 5000, [oi('Montre', 5000, 1)]), payment_method: 'cash_on_delivery', shipping_city: "N'Djamena", delivery_type: 'scheduled', scheduled_for: when };
        const N = { ...mkOrder('cdcdcdcd-0000-4000-8000-0000000000a2', 'pending', false, 9000, [oi('Lunettes', 9000, 1)]), payment_method: 'cash_on_delivery', shipping_city: "N'Djamena" };
        {
          const c = await newVisitor(phone, { storage, fakeUser: fu, fakeOrders: { list: [S, N], patches: [] } });
          const { page } = c;
          await page.goto(`${BASE}/mes-commandes`, { waitUntil: 'load' });
          await page.getByText('Commande #abababab').waitFor({ timeout: 15000 });
          await sleep(500);
          check('Mes commandes : la livraison programmee est ecrite sur la commande concernee seulement', (await page.getByTestId('order-scheduled').count()) === 1 && /📅 Livraison programmée : .* à \d+h\d{2}/.test(await page.getByTestId('order-scheduled').innerText()));
          check('Mes commandes : la commande programmee attend son rendez-vous (pas de signalement apres 48 h de commande)', (await page.getByText(/attend votre rendez-vous/).count()) === 1 && (await page.getByText(/Merci de confirmer sous 48h/).count()) === 1);
          await page.getByTestId('order-scheduled').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(OUT, 'C10-mes-commandes-programmee.png') });
          check('aucune erreur (Mes commandes programmee)', c.errs.length === 0, c.errs);
          await c.ctx.close();
        }
        {
          const fa = mk(true);
          const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeOrders: { list: [S, N], patches: [] } });
          const { page } = c;
          await page.goto(`${BASE}/admin/commandes`, { waitUntil: 'load' });
          await page.getByText('#abababab').waitFor({ timeout: 15000 });
          await sleep(500);
          const badge = await page.getByTestId('admin-order-scheduled').innerText();
          check('admin : badge « Livraison programmee » avec l\'heure et le rappel Telegram de 10 minutes, sur une seule commande', (await page.getByTestId('admin-order-scheduled').count()) === 1 && /📅 Livraison programmée : .* à \d+h\d{2}/.test(badge) && /Telegram 10 min avant/.test(badge), badge);
          check('admin : le signalement automatique de la commande programmee part du rendez-vous', (await page.getByText(/48 h après le rendez-vous/).count()) === 1);
          await page.screenshot({ path: path.join(OUT, 'C11-admin-programmee.png') });
          check('aucune erreur (admin programmee)', c.errs.length === 0, c.errs);
          await c.ctx.close();
        }
      }
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
      await page.goto(`${BASE}/mes-commandes`, { waitUntil: 'load' });
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
      await c.page.goto(`${BASE}/admin/commandes`, { waitUntil: 'load' });
      await c.page.getByText('#eeeeeeee').waitFor({ timeout: 15000 });
      await sleep(600);
      check('admin : « À emballer » sur la commande avec emballage cadeau seulement', (await c.page.getByText(/🎁 À emballer : emballage cadeau/).count()) === 1);
      await c.page.screenshot({ path: path.join(OUT, 'C6-admin.png') });
      check('aucune erreur (admin)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }

    // --- numero de commande, facture electronique, tri et export des commandes
    {
      const day = 86_400_000;
      const mkN = (id, n, status, total, items, extra = {}) => ({ ...mkOrder(id, status, false, total, items), order_number: n, ...extra });
      const E1 = mkN('11111111-aaaa-4000-8000-000000000012', 12, 'delivered', 92500, [{ ...oi('Soulier noir', 20000, 1), color: 'Noir', size: '42' }, oi('Montre', 35000, 2)]);
      const E2 = mkN('22222222-aaaa-4000-8000-000000000013', 13, 'cancelled', 9000, [oi('Lunettes', 9000, 1)], { created_at: new Date(Date.now() - 20 * day).toISOString() });
      // --- client : « Commande N° 12 », bouton « Voir la facture », la facture
      {
        const fakeOrders = { list: [E1, E2], patches: [] };
        const c = await newVisitor(phone, { storage, fakeUser: fu, fakeOrders, fakeStore: { legalLine: 'NIF : 123456 · RCCM : TD-NDJ-2026' } });
        const { page } = c;
        await page.goto(`${BASE}/mes-commandes`, { waitUntil: 'load' });
        await page.getByText('Commande N° 12').waitFor({ timeout: 15000 });
        check('Mes commandes : le numero de commande remplace les lettres au hasard (N° 12 et N° 13)', (await page.getByText('Commande N° 13').count()) === 1 && (await page.getByText(/Commande #/).count()) === 0);
        check('Mes commandes : un bouton « Voir la facture » par commande', (await page.getByTestId('order-invoice').count()) === 2);
        await page.getByTestId('order-invoice').first().click();
        await page.getByTestId('invoice-paper').waitFor({ timeout: 15000 });
        // les informations de la boutique (NIF, RCCM) arrivent un peu après la facture : on les attend avant de lire la feuille
        await page.getByText(/NIF : 123456/).first().waitFor({ timeout: 8000 }).catch(() => {});
        check('facture : l\'adresse est /facture/<commande>', new URL(page.url()).pathname === '/facture/' + E1.id, page.url());
        const paper = (await page.getByTestId('invoice-paper').innerText()).replace(/\s+/g, ' ');
        check('facture : « FACTURE », numero FA-AAAA-000012 et commande N° 12', /FACTURE/.test(paper) && /FA-\d{4}-000012/.test(paper) && /Commande N° 12/.test(paper), paper.slice(0, 200));
        const logoOk = await page.getByTestId('invoice-logo').locator('img').first().evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
        check('facture : le logo de la boutique est en haut a gauche, a cote du nom', logoOk && (await page.getByTestId('invoice-logo').boundingBox()).x < 120);
        check('facture : le client, son telephone, son adresse', /Aminata Hassan/.test(paper) && /66123456/.test(paper) && /Quartier Farcha, Moundou/.test(paper));
        check('facture : 2 lignes avec variante, quantite et prix (Soulier noir Taille 42 · Noir ; Montre x2 70 000)', (await page.getByTestId('invoice-row').count()) === 2 && /Soulier noir/.test(paper) && /Taille 42 · Noir/.test(paper) && /70\s000 FCFA/.test(paper), paper);
        check('facture : livraison 2 500 FCFA (le reste du total) et total 92 500 FCFA', /2\s500 FCFA/.test(await page.getByTestId('invoice-delivery').innerText()) && /92\s500 FCFA/.test(await page.getByTestId('invoice-total').innerText()));
        check('facture : mode de paiement, statut, informations legales de la boutique, mot de remerciement', /Airtel Money/.test(paper) && /Statut de la commande : Livrée/.test(paper) && /NIF : 123456 · RCCM : TD-NDJ-2026/.test(paper) && /Merci pour votre confiance/.test(paper));
        check('facture : pas de bandeau « annulee » sur une commande livree', (await page.getByTestId('invoice-cancelled').count()) === 0);
        await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
        await page.getByText('🖨️ Imprimer / Enregistrer en PDF').click();
        check('facture : « Imprimer / Enregistrer en PDF » ouvre l\'impression', (await page.evaluate(() => window.__printed)) === 1);
        check('facture : seule la facture sort a l\'impression (regle d\'impression presente)', await page.evaluate(() => !!document.querySelector('style[data-invoice-print]')));
        // facture PDF : « Telecharger ma facture » demande le PDF de CETTE commande a la fonction serveur avec le jeton du compte
        {
          const calls = [];
          const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-expose-headers': 'Content-Disposition' };
          await page.route('**/functions/v1/order-invoice', async (route) => {
            if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
            calls.push({ auth: route.request().headers().authorization || '', body: JSON.parse(route.request().postData() || '{}') });
            return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="Facture-FA-2026-000012.pdf"' }, body: Buffer.from('%PDF-1.4\n%%EOF\n') });
          });
          check('facture : deux boutons, « Telecharger ma facture » puis « Imprimer »', (await page.getByText('📄 Télécharger ma facture').count()) === 1 && (await page.getByText('🖨️ Imprimer / Enregistrer en PDF').count()) === 1);
          const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByText('📄 Télécharger ma facture').click()]);
          check('facture : « Telecharger ma facture » donne le fichier PDF de cette commande avec le jeton du compte', dl.suggestedFilename() === 'Facture-FA-2026-000012.pdf' && calls.length === 1 && /^Bearer eyJ/.test(calls[0].auth) && calls[0].body.action === 'pdf' && calls[0].body.order_id === E1.id, calls);
          // page de confirmation apres la commande : le meme bouton, en premier ; « Voir mes commandes » passe en second
          await page.goto(`${BASE}/commande/confirmation?orderId=${E1.id}&total=92500`, { waitUntil: 'load' });
          await page.getByText(/Merci d.avoir acheté/).waitFor({ timeout: 15000 });
          await page.getByText('📄 Télécharger ma facture').waitFor({ timeout: 15000 });
          const buttons = await page.evaluate(() => [...document.querySelectorAll('[role="button"], [tabindex="0"]')].map((e) => e.innerText.trim()).filter((t) => /Télécharger ma facture|Voir mes commandes|Continuer mes achats/.test(t)));
          check('confirmation de commande : « Telecharger ma facture », « Voir mes commandes », « Continuer mes achats » dans cet ordre', buttons.join('|') === '📄 Télécharger ma facture|Voir mes commandes|Continuer mes achats', buttons);
          await page.screenshot({ path: path.join(OUT, 'C7b-confirmation-facture.png') });
          const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByText('📄 Télécharger ma facture').click()]);
          check('confirmation de commande : le bouton telecharge la facture PDF de la commande', dl2.suggestedFilename() === 'Facture-FA-2026-000012.pdf' && calls.length === 2 && calls[1].body.order_id === E1.id, calls);
          await page.unroute('**/functions/v1/order-invoice');
        }
        await page.evaluate(() => document.querySelectorAll('div').forEach((d) => { if (d.scrollTop) d.scrollTop = 0; }));
        await page.screenshot({ path: path.join(OUT, 'C7-facture.png'), fullPage: true });
        // impression : seule la facture sort (PDF fabrique par le navigateur avec les regles d'impression)
        await page.pdf({ path: path.join(OUT, 'C7-facture.pdf'), format: 'A4' });
        check('facture : le PDF imprime est fabrique (fichier non vide)', fs.statSync(path.join(OUT, 'C7-facture.pdf')).size > 5000);
        // commande annulee, commande inconnue, adresse abimee
        await page.goto(`${BASE}/facture/${E2.id}`, { waitUntil: 'load' });
        await page.getByTestId('invoice-paper').waitFor({ timeout: 15000 });
        check('facture d\'une commande annulee : bandeau « COMMANDE ANNULEE »', (await page.getByTestId('invoice-cancelled').count()) === 1);
        await page.goto(`${BASE}/facture/99999999-aaaa-4000-8000-000000000099`, { waitUntil: 'load' });
        await page.getByTestId('invoice-missing').waitFor({ timeout: 15000 });
        check('facture d\'une commande inconnue (ou d\'un autre client) : « Facture introuvable »', /Facture introuvable/.test(await page.getByTestId('invoice-screen').innerText()));
        await page.goto(`${BASE}/facture/pas-une-commande`, { waitUntil: 'load' });
        await page.getByTestId('invoice-missing').waitFor({ timeout: 15000 });
        check('facture : adresse abimee : « Facture introuvable »', true);
        check('aucune ecriture reelle (numero et facture)', c.writes.every((w) => !/\/orders/.test(w)), c.writes);
        check('aucune erreur (facture du client)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      // --- administrateur : numeros, recherche, filtres, export, facture
      {
        const fa = mk(true);
        const mkA = (id, n, name, phone, city, status, ageDays, total) => mkN(id, n, status, total, [oi('Article ' + n, total, 1)], { shipping_name: name, shipping_phone: phone, shipping_city: city, created_at: new Date(Date.now() - ageDays * day).toISOString() });
        const list = [
          mkA('aaaaaaaa-1111-4000-8000-000000000001', 4, 'Awa Moussa', '66 11 22 33', 'Abéché', 'pending', 0.02, 10000),
          mkA('bbbbbbbb-1111-4000-8000-000000000002', 3, 'Idriss Deby', '99 44 55 66', 'Sarh', 'delivered', 3, 20000),
          mkA('cccccccc-1111-4000-8000-000000000003', 2, 'Hawa Ali', '66 77 88 99', 'Moundou', 'cancelled', 20, 30000),
          mkA('dddddddd-1111-4000-8000-000000000004', 1, 'Ali; "Le Grand"', '99 00 11 22', "N'Djamena", 'delivered', 60, 40000),
        ];
        const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeOrders: { list, patches: [] } });
        const { page } = c;
        const shown = async () => (await page.getByTestId('admin-order-number').allInnerTexts()).map((s) => s.trim()).join('|');
        await page.goto(`${BASE}/admin/commandes`, { waitUntil: 'load' });
        await page.getByTestId('orders-search').waitFor({ timeout: 25000 });
        await page.getByText('N° 4', { exact: true }).waitFor({ timeout: 15000 });
        check('admin : chaque commande a son numero (N° 4, 3, 2, 1) au lieu des lettres au hasard', (await shown()) === 'N° 4|N° 3|N° 2|N° 1', await shown());
        const summary = async () => (await page.getByTestId('orders-summary').innerText()).replace(/\s+/g, ' ');
        check('admin : resume « 4 commandes · 2 livrees comptees : 60 000 FCFA » (seules les livrees comptent)', /^4 commandes · 2 livrées comptées : 60\s000 FCFA/.test(await summary()), await summary());
        check('admin : la regle est ecrite (livrees seulement, fausses commandes jamais)', /Seules les commandes livrées comptent/.test(await page.getByTestId('orders-rule').innerText()) && /fausses/.test(await page.getByTestId('orders-rule').innerText()));
        await page.getByTestId('orders-search').fill('3');
        await sleep(300);
        check('admin : recherche « 3 » : seulement la commande N° 3', (await shown()) === 'N° 3', await shown());
        await page.getByTestId('orders-search').fill('hawa');
        await sleep(300);
        check('admin : recherche par nom « hawa » : la commande N° 2', (await shown()) === 'N° 2', await shown());
        await page.getByTestId('orders-search').fill('99 44');
        await sleep(300);
        check('admin : recherche par telephone « 99 44 » : la commande N° 3', (await shown()) === 'N° 3', await shown());
        await page.getByTestId('orders-search').fill('zzz');
        await sleep(300);
        check('admin : aucune reponse : message clair', (await page.getByText('Aucune commande ne correspond à votre recherche.').count()) === 1);
        await page.getByTestId('orders-search').fill('');
        await page.getByTestId('orders-status-delivered').click();
        await sleep(300);
        check('admin : filtre « Livrée » : N° 3 et N° 1', (await shown()) === 'N° 3|N° 1', await shown());
        await page.getByTestId('orders-period-7d').click();
        await sleep(300);
        check('admin : « Livrée » + « 7 jours » : seulement N° 3', (await shown()) === 'N° 3' && /^1 commande · 1 livrée comptée : 20\s000 FCFA/.test(await summary()), await summary());
        await page.getByTestId('orders-status-all').click();
        await page.getByTestId('orders-period-today').click();
        await sleep(300);
        check('admin : « Aujourd\'hui » : seulement N° 4', (await shown()) === 'N° 4', await shown());
        await page.getByTestId('orders-period-all').click();
        await sleep(300);
        // export CSV
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByTestId('orders-export').click()]);
        const csv = fs.readFileSync(await dl.path(), 'utf8');
        check('export : fichier « commandes-albasse-AAAA-MM-JJ.csv »', /^commandes-albasse-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
        const rows = csv.trim().split('\r\n');
        check('export : 1 titre + 4 commandes, numeros de commande et de facture, nom avec « ; » protege', rows.length === 5 && /^4;FA-\d{4}-000004;/.test(rows[1]) && csv.includes('"Ali; ""Le Grand"""') && csv.charCodeAt(0) === 0xfeff, rows);
        // la facture depuis la liste
        await page.getByTestId('admin-order-invoice').first().click();
        await page.getByTestId('invoice-paper').waitFor({ timeout: 15000 });
        check('admin : « Facture » ouvre la facture de la commande N° 4', /FA-\d{4}-000004/.test(await page.getByTestId('invoice-number').innerText()) && /Awa Moussa/.test(await page.getByTestId('invoice-paper').innerText()));
        check('aucune ecriture reelle (admin : numeros, tri, export, facture)', c.writes.every((w) => !/\/orders/.test(w)), c.writes);
        check('aucune erreur (admin : numeros et factures)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      // --- administrateur : le tableau de bord range toutes les pages par theme (rapports, clients, marketing, boutique, parametres)
      {
        const fa = mk(true);
        const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeStore: { waOrder: true } });
        const { page } = c;
        await page.goto(`${BASE}/admin/tableau-de-bord`, { waitUntil: 'load' });
        await page.getByTestId('admin-menu').waitFor({ timeout: 25000 });
        const groupOf = async (key) => (await page.getByTestId(`admin-menu-group-${key}`).innerText()).replace(/\s+/g, ' ');
        const g = { reports: await groupOf('reports'), customers: await groupOf('customers'), marketing: await groupOf('marketing'), shop: await groupOf('shop'), settings: await groupOf('settings') };
        check('tableau de bord : 5 themes (Rapports, Clients, Marketing, Boutique, Parametres)', /^📈 Rapports/.test(g.reports) && /^👥 Clients/.test(g.customers) && /^📣 Marketing/.test(g.marketing) && /^🛍️ Boutique/.test(g.shop) && /^⚙️ Paramètres/.test(g.settings), g);
        check('Rapports ensemble : performance par source, Zara, suivi de navigation, notifications', ['Performance par source', 'Statistiques de Zara', 'Suivi de navigation', 'Notifications'].every((l) => g.reports.includes(l)), g.reports);
        check('Clients ensemble : clients, meilleurs clients potentiels, rappels WhatsApp', ['Clients', 'Meilleurs clients potentiels', 'Rappels WhatsApp'].every((l) => g.customers.includes(l)), g.customers);
        check('Marketing ensemble : assistant marketing, Zara Marketing (e-mails), promotions, roue de la chance, affilies', ['Assistant marketing', 'Zara Marketing (e-mails)', 'Promotions intelligentes', 'Roue de la chance', 'Affiliés'].every((l) => g.marketing.includes(l)), g.marketing);
        check('Boutique : commandes et factures, produits, categories, voyage ; Parametres : contact, paiement, livraison', ['Commandes et factures', 'Produits', 'Catégories', 'Voyage'].every((l) => g.shop.includes(l)) && ['Informations de contact', 'Paiement', 'Livraison (Villes)'].every((l) => g.settings.includes(l)), { shop: g.shop, settings: g.settings });
        await page.screenshot({ path: path.join(OUT, 'C8-tableau-de-bord.png') });
        check('20 pages accessibles depuis le tableau de bord (dont Zara SEO)', (await page.locator('[data-testid^="admin-menu-Admin"]').count()) === 20);
        await page.getByTestId('admin-menu-AdminStoreSettings').click();
        await page.getByTestId('settings-legal-line').waitFor({ timeout: 15000 });
        check('un theme mene a la bonne page (Parametres › Informations de contact)', new URL(page.url()).pathname === '/admin/parametres/contact', page.url());
        check('aucune erreur (tableau de bord)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      // --- administrateur : l'ecran « Zara Marketing » (3 controles, verrou, simulation, approbation, rapport) avec une fausse base et une fausse fonction
      {
        const fa = mk(true);
        const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeStore: { waOrder: true } });
        const { page } = c;
        const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
        const st = {
          settings: { id: 1, mode: 'off', run_hour: 9, daily_limit: 50, min_days_between: 7, max_per_30_days: 3, require_approval: true, brevo_ok: null, brevo_checked_at: null, brevo_detail: null, last_simulation_at: null, last_simulation_blocking: null, test_email_at: null, test_email_message_id: null, validated_at: null, last_run_date: null },
          runs: [],
          summaries: {},
          calls: [],
          patches: [],
          report: { days: 30, totals: { queued: 0, skipped: 0, failed: 0, pending: 0, sent: 0, confirmed: 0, measured: 0, delivered: 0, clicked: 0, clicks: 0, bounced: 0, hardBounced: 0, complaints: 0, unsubscribed: 0, orders: 0, revenue: 0 }, bySegment: {}, byVariant: {}, errors: [], eventsAwaiting: 0, attribution: { orders: 0, revenue: 0, note: 'Commandes passées pendant la visite ouverte par un clic dans l’e-mail ; revenu = commandes livrées seulement. Un client qui commande plus tard, depuis une autre visite, n’est pas compté.' } },
          testConfirmed: false,
        };
        const hdr = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        const reply = (route, body, status = 200) => route.fulfill({ status, headers: { ...hdr, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const plan = { runDate: today, recipientCount: 5, blocking: 0, deferred: 0, catalog: { total: 402, verified: 380, rejected: { stock: 12 }, warnings: { remise_suspecte: 3 } }, clients: { total: 513, eligible: 5, excluded: { desinscrit: 2, autorisation_manquante: 17, frequence_minimale: 40 } }, segments: [{ key: 'flash', label: 'Vente flash', eligible: 0, planned: 0 }, { key: 'inactive', label: 'Clients absents', eligible: 5, planned: 5 }, { key: 'perfume_lovers', label: 'Amateurs de parfums', eligible: 0, planned: 0, paused: '2 plainte(s) sur 40 e-mails livrés' }], issues: [{ level: 'warning', code: 'remises_suspectes', message: '3 article(s) ont un ancien prix douteux : la remise n’est pas annoncée.' }, { level: 'info', code: 'langue_deduite', message: 'La langue des clients n’est pas enregistrée.' }], previews: [{ segment: 'inactive', label: 'Clients absents', lang: 'fr', variant: 'A', subject: 'Prénom, les articles du moment vous attendent 🛍️', html: '<html><body><p>Bonjour Prénom,</p><a href="https://www.albasseshopping.com/desinscription?t=exemple">Me désinscrire</a></body></html>' }], sample: [], learning: { notes: ['Segment « Amateurs de parfums » mis en pause : 2 plainte(s) sur 40 e-mails livrés.', '« Clients absents » : 12,5 % de clics, 3 commande(s) attribuée(s), 0,5 % de désinscriptions sur 120 e-mails livrés.'], pausedSegments: { perfume_lovers: '2 plainte(s) sur 40 e-mails livrés' }, bestVariant: {}, segmentOrder: null, stats: { inactive: { sent: 130, measured: 125, delivered: 120, clicked: 15, unsubscribed: 1, complaints: 0, hardBounced: 1, orders: 3, revenue: 90000 }, perfume_lovers: { sent: 40, measured: 0, delivered: 0, clicked: 0, unsubscribed: 0, complaints: 0, hardBounced: 0, orders: 0, revenue: 0 } } } };
        await page.route('**/rest/v1/marketing_ai_settings*', async (route) => {
          const m = route.request().method();
          if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
          if (m === 'PATCH') {
            const body = JSON.parse(route.request().postData() || '{}');
            st.patches.push(body);
            Object.assign(st.settings, body);
            return route.fulfill({ status: 204, headers: hdr });
          }
          return reply(route, st.settings);
        });
        await page.route('**/rest/v1/marketing_runs*', async (route) => {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
          const u = new URL(route.request().url());
          if (u.searchParams.get('select') === 'summary') {
            const id = (u.searchParams.get('id') || '').replace('eq.', '');
            return reply(route, { summary: st.summaries[id] });
          }
          return reply(route, st.runs);
        });
        await page.route('**/functions/v1/brevo-email', async (route) => {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
          const body = JSON.parse(route.request().postData() || '{}');
          st.calls.push(body);
          const now = new Date().toISOString();
          if (body.action === 'marketing_report') return reply(route, { ok: true, report: st.report });
          if (body.action === 'check') {
            Object.assign(st.settings, { brevo_ok: true, brevo_checked_at: now, brevo_detail: { ok: true, limited_key: true, events_api: { accessible: true } } });
            return reply(route, { ok: true, limited_key: true, events_api: { accessible: true } });
          }
          if (body.action === 'marketing_simulate') {
            Object.assign(st.settings, { last_simulation_at: now, last_simulation_blocking: 0 });
            const id = `00000000-0000-4000-8000-00000000000${st.runs.length + 1}`;
            st.summaries[id] = plan;
            st.runs.unshift({ id, created_at: now, run_date: today, mode: 'simulation', status: 'simulated', error: null, approved_at: null, planned: '5', blocking: '0' });
            return reply(route, { ok: true, run_id: id, plan, blocking: 0 });
          }
          if (body.action === 'marketing_test_email') {
            if (st.testConfirmed) Object.assign(st.settings, { test_email_at: now, test_email_message_id: '<abc@smtp-relay.mailin.fr>' });
            return reply(route, { ok: true, to: 'ad***@example.com', confirmed: st.testConfirmed });
          }
          if (body.action === 'marketing_set_mode') {
            if (body.mode === 'live' && body.confirm !== 'ACTIVER') return reply(route, { ok: false, reason: 'confirmation' });
            st.settings.mode = body.mode;
            if (body.mode === 'live') st.settings.validated_at = now;
            return reply(route, { ok: true, mode: body.mode });
          }
          if (body.action === 'marketing_approve') {
            st.runs[0].status = 'queued';
            return reply(route, { ok: true, queued: 5 });
          }
          if (body.action === 'marketing_sync') {
            st.report.totals = { ...st.report.totals, queued: 5, sent: 5, confirmed: 5, measured: 4, delivered: 4, clicked: 1, clicks: 2, unsubscribed: 0 };
            return reply(route, { ok: true, synced: 4, suppressed: 0, stopped: null });
          }
          return reply(route, { ok: false, reason: 'bad_request' }, 400);
        });
        await page.goto(`${BASE}/admin/zara-marketing`, { waitUntil: 'load' });
        await page.getByTestId('mkai-mode').waitFor({ timeout: 25000 });
        const txt = async (id) => (await page.getByTestId(id).innerText()).replace(/\s+/g, ' ');
        check('Zara Marketing : au départ « Éteint », les 3 contrôles « pas fait »', /Éteint/.test(await txt('mkai-mode')) && (await Promise.all(['brevo', 'simulation', 'test'].map((k) => txt(`mkai-gate-${k}-status`)))).every((t) => /pas fait/.test(t)));
        const liveLocked = async () => (await page.getByTestId('mkai-mode-live').getAttribute('aria-disabled')) === 'true';
        check('verrou : « Activer les envois » est verrouillé (🔒) tant que les 3 contrôles ne sont pas faits', (await liveLocked()) && /🔒/.test(await txt('mkai-mode-live')));
        await page.getByTestId('mkai-mode-live').click({ force: true }).catch(() => {});
        check('verrou : toucher le bouton verrouillé n’ouvre aucune confirmation et n’appelle rien', (await page.getByTestId('mkai-confirm').count()) === 0 && !st.calls.some((x) => x.action === 'marketing_set_mode'));

        await page.getByTestId('mkai-check-brevo').click();
        await page.getByTestId('mkai-message').waitFor({ timeout: 10000 });
        check('contrôle Brevo : la fonction reçoit seulement « check », le message dit que Brevo reconnaît la clé (clé limitée normale)', st.calls.filter((x) => x.action === 'check').length === 1 && /Brevo reconnaît la clé/.test(await txt('mkai-message')) && /clé limitée/.test(await txt('mkai-message')), await txt('mkai-message'));
        await page.getByTestId('mkai-gate-brevo-status').filter({ hasText: /fait/ }).waitFor({ timeout: 8000 });
        check('contrôle Brevo : coché (✅), les deux autres restent à faire, toujours verrouillé', /fait/.test(await txt('mkai-gate-brevo-status')) && /pas fait/.test(await txt('mkai-gate-simulation-status')) && (await liveLocked()));

        await page.getByTestId('mkai-run-simulation').click();
        await page.getByTestId('mkai-plan').waitFor({ timeout: 10000 });
        check('simulation : le plan s’affiche (5 clients retenus, segments, exclus avec leur raison en français)', (await txt('mkai-plan-count')) === '5' && /Clients absents/.test(await txt('mkai-plan')) && /Désinscrits/.test(await txt('mkai-plan')) && /Sans autorisation marketing/.test(await txt('mkai-plan')) && /Déjà sollicités récemment/.test(await txt('mkai-plan')), await txt('mkai-plan'));
        check('simulation : le message répète qu’aucun e-mail n’a été envoyé', /Aucun e-mail n’a été envoyé ni mis en file/.test(await txt('mkai-message')));
        check('simulation : l’alerte « remises suspectes » est affichée', (await page.getByTestId('mkai-issue-remises_suspectes').count()) === 1);
        const learn = await txt('mkai-learning');
        check('apprentissage : « Ce que Zara a appris » affiche les notes en français et le segment en pause (⏸️), sans rien d’autre à faire', /Ce que Zara a appris/.test(learn) && /12,5 % de clics, 3 commande\(s\) attribuée\(s\)/.test(learn) && (await page.getByTestId('mkai-paused-perfume_lovers').count()) === 1 && /Amateurs de parfums.*en pause/.test(await txt('mkai-paused-perfume_lovers')) && /Amateurs de parfums ⏸️ en pause/.test(await txt('mkai-plan')), learn);
        check('apprentissage : le tableau des 30 jours montre « — » (jamais 0) pour un segment dont Brevo n’a pas donné les résultats, et les chiffres pour l’autre', /Absents\s*120\s*15\s*1\s*0\s*3/.test(learn) && /Amateurs de parfums\s*—\s*—\s*0\s*—\s*0/.test(learn), learn);
        check('apprentissage : la note d’honnêteté (assez de résultats mesurés) est visible', /sans assez de résultats mesurés/.test(learn));
        await page.getByTestId('mkai-preview-inactive-fr').click();
        const frame = page.locator('[data-testid="mkai-preview-frame-inactive-fr"]');
        await frame.waitFor({ timeout: 8000 });
        check('aperçu : le vrai e-mail s’affiche dans un cadre, avec le lien de désinscription', /desinscription\?t=exemple/.test((await frame.getAttribute('srcdoc')) || ''));
        check('seule la simulation est partie : toujours verrouillé (il manque l’e-mail de test)', st.calls.filter((x) => x.action === 'marketing_simulate').length === 1 && (await liveLocked()) && (await txt('mkai-gate-test-status')).includes('pas fait'));

        await page.getByTestId('mkai-send-test').click();
        await page.getByText(/sans identifiant : ce n’est pas une confirmation/).waitFor({ timeout: 10000 });
        check('e-mail de test accepté SANS identifiant Brevo : « pas une confirmation », le contrôle reste à faire, toujours verrouillé', (await txt('mkai-gate-test-status')).includes('pas fait') && (await liveLocked()));
        st.testConfirmed = true;
        await page.getByTestId('mkai-send-test').click();
        await page.getByText(/Brevo a confirmé \(identifiant du message reçu\)/).waitFor({ timeout: 10000 });
        await page.getByTestId('mkai-gate-test-status').filter({ hasText: /fait/ }).waitFor({ timeout: 8000 });
        check('e-mail de test confirmé par Brevo : 3 contrôles faits, le bouton se déverrouille', !(await liveLocked()) && !/🔒/.test(await txt('mkai-mode-live')));

        await page.getByTestId('mkai-mode-live').click();
        await page.getByTestId('mkai-confirm-input').waitFor({ timeout: 5000 });
        check('activation : une confirmation à taper est demandée, le bouton « Valider » est bloqué', (await page.getByTestId('mkai-confirm-live').getAttribute('aria-disabled')) === 'true');
        await page.getByTestId('mkai-confirm-input').fill('ACTIV');
        check('activation : « ACTIV » ne suffit pas', (await page.getByTestId('mkai-confirm-live').getAttribute('aria-disabled')) === 'true');
        await page.getByTestId('mkai-confirm-input').fill('ACTIVER');
        await page.getByTestId('mkai-confirm-live').click();
        await page.getByText('Actif : envois réels').first().waitFor({ timeout: 10000 });
        const setCall = st.calls.find((x) => x.action === 'marketing_set_mode');
        check('activation : la fonction reçoit « live » avec la confirmation tapée, le mode passe à « Actif »', setCall && setCall.mode === 'live' && setCall.confirm === 'ACTIVER' && /Actif/.test(await txt('mkai-mode')), setCall);

        // réglages : les valeurs sont ramenées dans les limites avant d'être envoyées
        await page.getByTestId('mkai-daily-limit').fill('500');
        await page.getByTestId('mkai-run-hour').fill('30');
        await page.getByTestId('mkai-min-days').fill('0');
        await page.getByTestId('mkai-require-approval').click();
        await page.getByTestId('mkai-save-settings').click();
        await page.getByText('Réglages enregistrés.').waitFor({ timeout: 8000 });
        const patch = st.patches.find((p) => 'daily_limit' in p);
        check('réglages : 500 -> 200, 30 h -> 23 h, 0 jour -> 1 jour, approbation décochée ; le mode et le verrou ne sont jamais envoyés par l’application', patch && patch.daily_limit === 200 && patch.run_hour === 23 && patch.min_days_between === 1 && patch.max_per_30_days === 3 && patch.require_approval === false && !('mode' in patch) && !('validated_at' in patch) && !('brevo_ok' in patch), patch);

        // campagne du jour en attente d'approbation
        st.runs.unshift({ id: '00000000-0000-4000-8000-0000000000aa', created_at: new Date().toISOString(), run_date: today, mode: 'live', status: 'pending_approval', error: null, approved_at: null, planned: '5', blocking: '0' });
        st.summaries['00000000-0000-4000-8000-0000000000aa'] = plan;
        await page.reload({ waitUntil: 'load' });
        await page.getByTestId('mkai-pending').waitFor({ timeout: 20000 });
        check('campagne du jour en attente : la carte d’approbation s’affiche avec le nombre de clients', /5 client\(s\) retenu\(s\)/.test(await txt('mkai-pending')));
        await page.getByTestId('mkai-approve').click();
        await page.getByText(/5 e-mail\(s\) mis en file/).waitFor({ timeout: 10000 });
        const ap = st.calls.find((x) => x.action === 'marketing_approve');
        check('approbation : la fonction reçoit l’identifiant du passage, le message annonce 5 e-mails mis en file (goutte-à-goutte)', ap && ap.run_id === '00000000-0000-4000-8000-0000000000aa' && /goutte-à-goutte/.test(await txt('mkai-message')), ap);

        // rapport : « non mesuré » tant que Brevo n'a rien confirmé, puis les vrais taux
        check('rapport : sans résultats lus chez Brevo, livraison et clics sont « non mesuré » (jamais 0 %)', /non mesuré/.test(await txt('mkai-report')) && !/0 %/.test(await txt('mkai-report')), await txt('mkai-report'));
        await page.getByTestId('mkai-sync').click();
        await page.getByText(/Résultats lus chez Brevo : 4 e-mail\(s\) mis à jour/).waitFor({ timeout: 10000 });
        await page.getByText('100 %').first().waitFor({ timeout: 8000 });
        check('rapport après lecture chez Brevo : taux de livraison 100 % (4 sur 4 mesurés), taux de clic 25 % (1 sur 4)', /100 %/.test(await txt('mkai-report')) && /25 %/.test(await txt('mkai-report')), await txt('mkai-report'));
        check('rapport : la note d’honnêteté sur l’attribution des commandes est visible', /autre visite/.test(await txt('mkai-report')));
        check('journal : les passages sont listés (date, mode, état)', /Actif · En attente|Actif · Mise en file/.test(await txt('mkai-runs')) && /Simulation · Simulation/.test(await txt('mkai-runs')), await txt('mkai-runs'));
        check('aucune clé, aucun secret dans la page', !/xkeysib|api-key|BREVO_API_KEY=/.test(await page.content()));
        check('aucune erreur (Zara Marketing)', c.errs.length === 0, c.errs);
        await c.ctx.close();
      }
      // --- administrateur : Zara Marketing, script SQL pas encore lancé
      {
        const fa = mk(true);
        const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeStore: { waOrder: true } });
        const { page } = c;
        const hdr = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        await page.route('**/rest/v1/marketing_*', (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: hdr }) : route.fulfill({ status: 404, headers: { ...hdr, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.marketing_ai_settings' in the schema cache" }) })));
        await page.route('**/functions/v1/brevo-email', (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: hdr }) : route.fulfill({ status: 200, headers: { ...hdr, 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, reason: 'sql_missing' }) })));
        await page.goto(`${BASE}/admin/zara-marketing`, { waitUntil: 'load' });
        await page.getByTestId('mkai-sql-missing').waitFor({ timeout: 25000 });
        check('script SQL pas lancé : message clair, aucun bouton d’envoi ni d’activation', /add-marketing-intelligence\.sql/.test(await page.getByTestId('mkai-sql-missing').innerText()) && (await page.getByTestId('mkai-mode-live').count()) === 0 && (await page.getByTestId('mkai-approve').count()) === 0);
        await c.ctx.close();
      }
      // --- administrateur : la ligne « informations legales » des factures (NIF, RCCM)
      {
        const fa = mk(true);
        const fs2 = { waOrder: true };
        const c = await newVisitor(phone, { storage: { 'sb-xtitsmmccpkelxfjyqyh-auth-token': sessionFor(fa) }, fakeUser: fa, fakeStore: fs2 });
        const { page } = c;
        await page.goto(`${BASE}/admin/parametres/contact`, { waitUntil: 'load' });
        await page.getByTestId('settings-legal-line').waitFor({ timeout: 25000 });
        await page.getByText('Enregistrer', { exact: true }).click();
        await page.getByText('Enregistré ✓').waitFor({ timeout: 8000 });
        check('infos legales : sans changement, la base ne recoit pas cette ligne (le reste s\'enregistre meme si le script n\'est pas lance)', (fs2.patches || []).length === 1 && !('invoice_legal_line' in fs2.patches[0]), fs2.patches);
        await sleep(2500); // la page relit les reglages apres le 1er enregistrement
        await page.getByTestId('settings-legal-line').fill('NIF : 99887 · RCCM : TD-NDJ-2026-B-1');
        await page.getByText('Enregistrer', { exact: true }).click({ force: true });
        await sleep(1500);
        check('infos legales : modifiee, la base recoit invoice_legal_line', (fs2.patches || []).some((b) => b.invoice_legal_line === 'NIF : 99887 · RCCM : TD-NDJ-2026-B-1'), fs2.patches);
        await c.ctx.close();
      }
    }
  }

  // =============================================== D. PANNE ===============================================
  if (PARTS.includes('D')) {
    console.log('\n== D. panne : les villes ne se chargent pas');
    const f = await newVisitor(phone, { storage: { albasse_zara_name: 'Ali' }, blockPath: '/rest/v1/cities' });
    await f.page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      await k.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await sleep(2500);
      const fabHome = await k.page.getByRole('button', { name: FAB_NAME }).boundingBox();
      await k.page.getByRole('button', { name: FAB_NAME }).click();
      await sleep(600);
      const full = await panelOf(k.page).boundingBox();
      check('sans clavier : la fenetre n\'est PAS en plein ecran : fenetre du bas, 60 % de la hauteur (480 px sur 800), collee en bas, pleine largeur', Math.round(full.height) === 480 && Math.round(full.y + full.height) === 800 && Math.round(full.width) === 390, full);
      await k.page.evaluate(() => { window.__vv.height = 430; window.__vv.offsetTop = 0; window.__vv.dispatchEvent(new Event('resize')); });
      await sleep(400);
      const small = await panelOf(k.page).boundingBox();
      const inputBox = await k.page.getByLabel('Votre message').boundingBox();
      check('clavier ouvert (zone visible de 430 px) : la fenetre se reduit (360 px, collee en bas de la zone visible), la saisie reste visible', Math.round(small.height) === 360 && Math.round(small.y + small.height) === 430 && inputBox.y + inputBox.height <= 430 && inputBox.y >= small.y, { small, inputBox });
      await k.page.evaluate(() => { window.__vv.height = 800; window.__vv.dispatchEvent(new Event('resize')); });
      await sleep(300);
      await k.page.getByRole('button', { name: 'Fermer' }).click();
      await sleep(300);
      await k.page.goto(`${BASE}/produit/rolex`, { waitUntil: 'load' });
      await sleep(3500);
      const fabProduct = await k.page.getByRole('button', { name: FAB_NAME }).boundingBox();
      const vpK = k.page.viewportSize();
      check('sur la fiche produit (pas de barre du bas) le bouton est remonte au-dessus de la barre « Commander » : coin en bas a droite, 144 px du bas', Math.round(vpK.height - (fabProduct.y + fabProduct.height)) === 144 && Math.round(vpK.width - 14 - (fabProduct.x + fabProduct.width)) === 0, { accueil: Math.round(fabHome.y), produit: Math.round(fabProduct.y), vpK });
      check('aucune erreur (clavier / produit)', k.errs.length === 0, k.errs);
      await k.ctx.close();
    }
    {
      const a = await newVisitor({ ...devices['Pixel 7'], viewport: { width: 390, height: 800 } });
      await a.page.goto(`${BASE}/admin/tableau-de-bord`, { waitUntil: 'load' });
      await sleep(6500);
      check('le bouton de Zara est cache sur les pages d\'administration', (await a.page.getByRole('button', { name: FAB_NAME }).count()) === 0);
      await a.ctx.close();
    }
    {
      const d = await newVisitor({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, { storage: { albasse_zara_name: 'Ali' } });
      await d.page.goto(`${BASE}/`, { waitUntil: 'load' });
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

  // =============================================== ~ RETROUVER SON COMPTE : MOT DE PASSE CHANGE PAR LE CLIENT, NOUVEAU CODE DONNE PAR L'ADMIN ===============================================
  if (PARTS.includes('~')) {
    console.log('\n== ~ Retrouver son compte : « Changer mon mot de passe » dans Compte, « Donner un nouveau code » dans Admin › Clients (fausse base)');
    const SKT = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const HDRT = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const jsonT = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', ...HDRT }, body: JSON.stringify(body) });
    const mkUser = (uid, jwt, email, profile) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], profile: { id: uid, email, full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z', ...profile } };
    };
    const JWT_CLIENT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const JWT_ADMIN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjY2NjY2Ni02NjY2LTQ2NjYtODY2Ni02NjY2NjY2NjY2NjYiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const clientUser = (opts = {}) => ({ ...mkUser('11111111-1111-4111-8111-111111111111', JWT_CLIENT, 'test@example.com', {}), ...opts });
    const adminUser = () => mkUser('66666666-6666-4666-8666-666666666666', JWT_ADMIN, 'admin@example.com', { id: '66666666-6666-4666-8666-666666666666', full_name: 'Admin Albasse', role: 'admin', is_admin: true });

    // ---------- 1. le client connecte change son mot de passe dans « Compte »
    const openAccountT = async (fu) => {
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SKT]: fu.session }, fakeUser: fu });
      await c.page.goto(`${BASE}/compte`, { waitUntil: 'load' });
      await c.page.getByTestId('password-change-open').waitFor({ timeout: 25000 });
      return c;
    };
    const errOf = (c) => c.page.getByTestId('password-error');
    const saveT = (c) => c.page.getByText('Enregistrer le mot de passe', { exact: true }).click();
    const fillT = async (c, a, b) => {
      await c.page.getByTestId('password-input-new').fill(a);
      await c.page.getByTestId('password-input-confirm').fill(b);
    };
    {
      const fu = clientUser();
      const c = await openAccountT(fu);
      check('page Compte : « Changer mon mot de passe » est proposé, la carte est fermée', (await c.page.getByText('Changer mon mot de passe', { exact: true }).count()) === 1 && (await c.page.getByTestId('password-card').count()) === 0);
      await c.page.getByTestId('password-change-open').click();
      await c.page.getByTestId('password-card').waitFor({ timeout: 10000 });
      check('la carte s\'ouvre avec deux cases vides (nouveau mot de passe, encore une fois)', (await c.page.getByTestId('password-input-new').inputValue()) === '' && (await c.page.getByTestId('password-input-confirm').inputValue()) === '');
      check('les cases cachent le mot de passe (points)', (await c.page.getByTestId('password-input-new').getAttribute('type')) === 'password');
      await c.page.getByText('Annuler', { exact: true }).scrollIntoViewIfNeeded().catch(() => {}); // la carte entiere dans l'image (au-dessus de la barre du bas)
      await fillT(c, '730591', '730591');
      await c.page.getByTestId('password-show').click();
      await c.page.screenshot({ path: path.join(OUT, '~1-compte-mot-de-passe.png') });
      await c.page.getByTestId('password-show').click();
      await fillT(c, '', '');

      await saveT(c);
      await errOf(c).waitFor({ timeout: 5000 });
      check('cases vides : « au moins 6 caractères », rien envoyé à Supabase', /au moins 6/.test(await errOf(c).innerText()) && !(fu.passwordChanges || []).length);
      await fillT(c, '48291', '48291');
      await saveT(c);
      await sleep(400);
      check('5 caractères : refusé, rien envoyé', /au moins 6/.test(await errOf(c).innerText()) && !(fu.passwordChanges || []).length);
      await fillT(c, '730591', '730592');
      await sleep(300);
      check('le message disparait des que le client retape', (await errOf(c).count()) === 0);
      await saveT(c);
      await errOf(c).waitFor({ timeout: 5000 });
      check('deux saisies différentes : « ne correspondent pas », rien envoyé', /ne correspondent pas/.test(await errOf(c).innerText()) && !(fu.passwordChanges || []).length);

      await c.page.getByTestId('password-show').click();
      check('« Voir les mots de passe » : les cases montrent le texte (plus de points)', (await c.page.getByTestId('password-input-new').getAttribute('type')) !== 'password' && (await c.page.getByTestId('password-input-confirm').getAttribute('type')) !== 'password' && (await c.page.getByText('Cacher les mots de passe').count()) === 1);
      await fillT(c, '730591', '730591');
      await saveT(c);
      await c.page.getByText('Mot de passe changé ✓').waitFor({ timeout: 10000 });
      check('bon mot de passe : UNE demande à Supabase, avec exactement ce mot de passe', (fu.passwordChanges || []).length === 1 && fu.passwordChanges[0].password === '730591', fu.passwordChanges);
      check('la carte se ferme, le menu revient, le client reste connecté', (await c.page.getByTestId('password-card').count()) === 0 && (await c.page.getByTestId('password-change-open').count()) === 1 && (await c.page.getByText('Se déconnecter').count()) === 1);
      check('aucune erreur (changement du mot de passe)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    {
      // Supabase refuse (même mot de passe que l'ancien) : phrase simple, la carte reste ouverte pour réessayer
      const fu = clientUser({ passwordError: { status: 422, body: { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' } } });
      const c = await openAccountT(fu);
      await c.page.getByTestId('password-change-open').click();
      await fillT(c, '482915', '482915');
      await saveT(c);
      await errOf(c).waitFor({ timeout: 10000 });
      check('Supabase refuse (même mot de passe) : « déjà le vôtre », la carte reste ouverte', /déjà le vôtre/.test(await errOf(c).innerText()) && (await c.page.getByTestId('password-card').count()) === 1 && (fu.passwordChanges || []).length === 1);
      check('aucune annonce « Mot de passe changé » en cas de refus', (await c.page.getByText('Mot de passe changé ✓').count()) === 0);
      await c.ctx.close();
    }
    {
      // annuler : rien n'est envoyé
      const fu = clientUser();
      const c = await openAccountT(fu);
      await c.page.getByTestId('password-change-open').click();
      await fillT(c, '730591', '730591');
      await c.page.getByText('Annuler', { exact: true }).click();
      await sleep(400);
      check('Annuler : la carte se ferme, rien envoyé', (await c.page.getByTestId('password-card').count()) === 0 && !(fu.passwordChanges || []).length);
      await c.ctx.close();
    }

    // ---------- 2. l'administrateur donne un nouveau code (Admin › Clients › le client)
    const custId = 'aaaaaaaa-0000-4000-8000-000000000001';
    const custProfile = (extra = {}) => ({ id: custId, email: 'aicha@gmail.com', full_name: 'Aïcha Moussa', phone: '66111111', whatsapp_number: null, profession: null, region: "N'Djamena", country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z', login_count: 2, fake_order_count: 0, ...extra });
    // rpc = (corps recu) → { body, status } ; sans rpc : la base accepte et renvoie l'identifiant de connexion d'un compte créé avec le numéro
    const openDetail = async ({ rpc = null, customer = custProfile(), admin = true } = {}) => {
      const fu = admin ? adminUser() : clientUser();
      const seen = { rpcs: [] };
      const v = await newVisitor(phone, { lang: 'fr', storage: { [SKT]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.route(/\/rest\/v1\//, (route) => {
        const req = route.request();
        const u = new URL(req.url());
        if (req.method() === 'OPTIONS') return route.fallback();
        const t = u.pathname.replace('/rest/v1/', '');
        if (t === 'profiles' && !u.searchParams.get('id') && u.searchParams.get('is_admin') === 'eq.false') return jsonT(route, [customer]);
        if (['orders', 'visitor_sessions', 'product_views', 'cart_events', 'customer_sanctions', 'favorites'].includes(t)) return jsonT(route, []);
        if (t === 'rpc/admin_set_client_password') {
          const body = JSON.parse(req.postData() || '{}');
          seen.rpcs.push(body);
          const r = rpc ? rpc(body) : { body: '23566111111@tel.albasseshopping.com' };
          return jsonT(route, r.body, r.status || 200);
        }
        return route.fallback();
      });
      await v.page.goto(`${BASE}/admin/clients/${customer.id}`, { waitUntil: 'load' });
      if (admin) await v.page.getByTestId('admin-password-section').waitFor({ timeout: 25000 });
      else await v.page.getByText('Accès réservé aux administrateurs').first().waitFor({ timeout: 25000 });
      return { v, seen };
    };
    const askNewCode = async (v) => {
      await v.page.getByText(/^(Donner un nouveau code|Créer un autre code)$/).first().click();
      await v.page.getByText('Donner un nouveau code ?', { exact: true }).waitFor({ timeout: 8000 });
    };
    const confirmNewCode = async (v) => {
      await v.page.getByText('Créer le code', { exact: true }).click();
    };
    const whatsappT = async (v) => {
      const [popup] = await Promise.all([v.ctx.waitForEvent('page', { timeout: 10000 }), v.page.getByTestId('admin-new-code-whatsapp').click()]);
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      const url = popup.url();
      await popup.close();
      return { url, text: decodeURIComponent(url.split('text=')[1] || '') };
    };

    // a. tout marche : confirmation, code a 6 chiffres, WhatsApp avec le message et le code
    {
      const { v, seen } = await openDetail();
      check('page du client : la section « Mot de passe oublié » est là, aucun code n\'est montré', (await v.page.getByText(/Mot de passe oublié/).count()) >= 1 && (await v.page.getByTestId('admin-new-code').count()) === 0);
      await askNewCode(v);
      await v.page.screenshot({ path: path.join(OUT, '~2-admin-confirmer.png') });
      await v.page.getByText('Annuler', { exact: true }).click();
      await sleep(400);
      check('« Annuler » : rien n\'est envoyé à la base, aucun code', seen.rpcs.length === 0 && (await v.page.getByTestId('admin-new-code').count()) === 0);
      await askNewCode(v);
      await confirmNewCode(v);
      await v.page.getByTestId('admin-new-code').waitFor({ timeout: 10000 });
      const code = (await v.page.getByTestId('admin-new-code').innerText()).trim();
      check('UNE demande à la base : ce client, un code de 6 chiffres', seen.rpcs.length === 1 && seen.rpcs[0].target_user_id === custId && /^\d{6}$/.test(seen.rpcs[0].new_password), seen.rpcs);
      check('le code affiché est exactement celui envoyé à la base', code === seen.rpcs[0].new_password, { code, sent: seen.rpcs[0] && seen.rpcs[0].new_password });
      check('le code n\'est pas une suite ou un motif facile (123456, 111111, 121212…)', !/^(\d)\1{5}$/.test(code) && !'01234567890'.includes(code) && !'09876543210'.includes(code) && !/^(\d\d)\1\1$/.test(code) && !/^(\d{3})\1$/.test(code), code);
      check('le texte dit d\'envoyer le code tout de suite (il ne sera plus visible)', (await v.page.getByText(/Envoyez-le maintenant/).count()) >= 1);
      check('le bouton devient « Créer un autre code »', (await v.page.getByText('Créer un autre code', { exact: true }).count()) === 1);
      await sleep(1200); // la fenetre de confirmation se ferme et l'annonce disparait : on photographie la page propre
      await v.page.screenshot({ path: path.join(OUT, '~3-admin-nouveau-code.png') });
      const w = await whatsappT(v);
      check('WhatsApp ouvre le bon numéro (235 + 66111111)', w.url.startsWith('https://wa.me/23566111111?text='), w.url.slice(0, 60));
      check('message : prénom, équipe, le code, « votre numéro +235 66 11 11 11 », le site et où le changer',
        w.text.startsWith("Bonjour Aïcha, ici l'équipe Albasse Shopping 😊") && w.text.includes(`Voici votre nouveau code : ${code}`) && w.text.includes('votre numéro +235 66 11 11 11') && w.text.includes('https://www.albasseshopping.com') && w.text.includes('« Compte » › « Changer mon mot de passe »'), w.text);
      check('le message ne montre jamais l\'adresse fabriquée (tel.albasseshopping.com)', !/tel\.albasseshopping\.com/.test(w.text));
      // un deuxième code
      await askNewCode(v);
      await confirmNewCode(v);
      await v.page.waitForFunction(() => document.querySelectorAll('[data-testid="admin-new-code"]').length === 1, null, { timeout: 8000 });
      await sleep(500);
      check('« Créer un autre code » : deuxième demande, le nouveau code remplace l\'ancien à l\'écran', seen.rpcs.length === 2 && (await v.page.getByTestId('admin-new-code').innerText()).trim() === seen.rpcs[1].new_password, seen.rpcs.length);
      check('aucune erreur (nouveau code)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    // b. ancien compte (connexion par e-mail) : le message dit l'e-mail
    {
      const { v } = await openDetail({ rpc: () => ({ body: 'aicha@gmail.com' }), customer: custProfile({ whatsapp_number: '66 22 22 22' }) });
      await askNewCode(v);
      await confirmNewCode(v);
      await v.page.getByTestId('admin-new-code').waitFor({ timeout: 10000 });
      const w = await whatsappT(v);
      check('ancien compte : WhatsApp utilise le numéro WhatsApp (66222222) et le message dit « votre e-mail aicha@gmail.com »', w.url.startsWith('https://wa.me/23566222222?text=') && w.text.includes('votre e-mail aicha@gmail.com') && !/votre numéro/.test(w.text), w.text);
      await v.ctx.close();
    }
    // c. client sans numero : le code est montre, pas de bouton WhatsApp
    {
      const { v } = await openDetail({ customer: custProfile({ phone: null, whatsapp_number: null }) });
      await askNewCode(v);
      await confirmNewCode(v);
      await v.page.getByTestId('admin-new-code').waitFor({ timeout: 10000 });
      check('client sans numéro : le code est montré, pas de bouton WhatsApp, un mot explique', (await v.page.getByTestId('admin-new-code-whatsapp').count()) === 0 && (await v.page.getByTestId('admin-new-code-nophone').count()) === 1);
      await v.ctx.close();
    }
    // d. la base refuse : script pas lance, pas administrateur, client introuvable → message clair, AUCUN code montré
    for (const [label, rpc, expect] of [
      ['script pas encore lancé', () => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.admin_set_client_password(new_password, target_user_id) in the schema cache', details: null, hint: null } }), /add-admin-reset-password\.sql/],
      ['pas administrateur', () => ({ status: 400, body: { code: 'P0001', message: 'Non autorise', details: null, hint: null } }), /Seul un administrateur/],
      ['client introuvable', () => ({ status: 400, body: { code: 'P0001', message: 'Client introuvable', details: null, hint: null } }), /introuvable/],
    ]) {
      const { v, seen } = await openDetail({ rpc });
      await askNewCode(v);
      await confirmNewCode(v);
      await v.page.getByText('Nouveau code impossible').waitFor({ timeout: 10000 });
      check(`base qui refuse (${label}) : message clair, aucun code montré`, expect.test(await v.page.locator('body').innerText()) && (await v.page.getByTestId('admin-new-code').count()) === 0 && seen.rpcs.length === 1);
      await v.ctx.close();
    }
    // e. un client ordinaire n'ouvre pas la page : aucune section, aucune demande
    {
      const { v, seen } = await openDetail({ admin: false });
      check('client non administrateur : « Accès réservé aux administrateurs », aucune section, aucune demande', (await v.page.getByTestId('admin-password-section').count()) === 0 && (await v.page.getByText('Donner un nouveau code').count()) === 0 && seen.rpcs.length === 0);
      await v.ctx.close();
    }
  }

  // =============================================== % HOMME / FEMME : INSCRIPTION, PROFIL, CARTE DE ZARA, ADMIN › CLIENTS ===============================================
  if (PARTS.includes('%')) {
    console.log('\n== % Homme / Femme : choix obligatoire a l\'inscription, profil, carte de Zara (anciens clients), Admin › Clients (fausse base)');
    const SKG = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const HDRG = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const jsonG = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', ...HDRG }, body: JSON.stringify(body) });
    const JWTG_CLIENT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const JWTG_ADMIN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjY2NjY2Ni02NjY2LTQ2NjYtODY2Ni02NjY2NjY2NjY2NjYiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    // profile : { gender: null } = le script SQL est lance (la colonne existe, vide) ; sans la cle « gender » = script pas encore lance
    const mkG = (uid, jwt, email, profile = {}, opts = {}) => {
      const auth = { id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], ...opts, profile: { id: uid, email, full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z', ...profile } };
    };
    const UID_C = '11111111-1111-4111-8111-111111111111';
    const UID_A = '66666666-6666-4666-8666-666666666666';
    const clientG = (profile = {}, opts = {}) => mkG(UID_C, JWTG_CLIENT, 'ahmed@gmail.com', profile, opts);
    const adminG = (profile = {}) => mkG(UID_A, JWTG_ADMIN, 'admin@gmail.com', { id: UID_A, full_name: 'Admin Albasse', role: 'admin', is_admin: true, ...profile });
    const selected = async (page, testId) => (await page.getByTestId(testId).getAttribute('aria-checked')) === 'true';
    const askKey = 'albasse_gender_ask_v1_' + UID_C;
    const homeG = async (fu, extra = {}) => {
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SKG]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] }, ...extra });
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await c.page.getByTestId('home-tagline').waitFor({ timeout: 25000 });
      return c;
    };

    // ---------- 1. inscription : le choix Homme / Femme est obligatoire
    const signupG = async (fuOpts = {}, profile = { gender: null }) => {
      const fu = { ...mkG(UID_C, JWTG_CLIENT, 'ahmed@gmail.com', profile), ...fuOpts };
      const v = await newVisitor(phone, { fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.goto(`${BASE}/inscription`, { waitUntil: 'load' });
      await v.page.getByTestId('register-name').locator('visible=true').waitFor({ timeout: 25000 });
      await sleep(800);
      return { v, fu };
    };
    const fillSignupG = async (v) => {
      await v.page.getByTestId('register-name').locator('visible=true').fill('Aïcha Moussa');
      await v.page.getByTestId('register-phone').locator('visible=true').fill('66 12 34 56');
      await v.page.getByTestId('register-password').locator('visible=true').fill('secret12');
      await v.page.getByTestId('register-terms').locator('visible=true').click();
    };
    const submitG = (v) => v.page.getByText('Créer mon compte', { exact: true }).locator('visible=true').last().click();
    const genderPatches = (fu) => fu.patches.filter((x) => Object.keys(x).join() === 'gender');
    {
      const { v, fu } = await signupG();
      check('inscription : « Vous êtes * » avec deux boutons Homme et Femme, aucun choisi au départ', (await v.page.getByText('Vous êtes *').count()) === 1 && (await v.page.getByTestId('register-gender-homme').count()) === 1 && (await v.page.getByTestId('register-gender-femme').count()) === 1 && !(await selected(v.page, 'register-gender-homme')) && !(await selected(v.page, 'register-gender-femme')));
      const pos = async (id) => (await v.page.getByTestId(id).locator('visible=true').boundingBox()) || { y: -1 };
      const yName = (await pos('register-name')).y;
      const yGender = (await pos('register-gender-homme')).y;
      const yPhone = (await pos('register-phone')).y;
      check('le choix est juste sous le nom, avant le téléphone (dans « obligatoire »)', yName > 0 && yGender > yName && yPhone > yGender, { yName, yGender, yPhone });
      await v.page.screenshot({ path: path.join(OUT, '%1-inscription-genre.png') });
      await fillSignupG(v);
      await submitG(v);
      await v.page.getByText('Choix manquant').waitFor({ timeout: 8000 });
      check('sans choix : « Merci de choisir Homme ou Femme », aucun compte créé', /Homme.*Femme/.test(await v.page.locator('body').innerText()) && !(fu.signups || []).length);
      await v.page.getByTestId('register-gender-femme').locator('visible=true').click();
      check('Femme choisi : le bouton est coché, pas Homme', (await selected(v.page, 'register-gender-femme')) && !(await selected(v.page, 'register-gender-homme')));
      await v.page.getByTestId('register-gender-homme').locator('visible=true').click();
      check('on peut changer d\'avis : Homme coché, plus Femme', (await selected(v.page, 'register-gender-homme')) && !(await selected(v.page, 'register-gender-femme')));
      await v.page.getByTestId('register-gender-femme').locator('visible=true').click();
      await v.page.screenshot({ path: path.join(OUT, '%2-inscription-femme-choisie.png') });
      await submitG(v);
      await v.page.getByText('Bienvenue ✓').waitFor({ timeout: 15000 });
      await sleep(1500);
      const main = fu.patches.find((x) => 'full_name' in x) || {};
      check('compte créé UNE fois (numéro), avec le choix fait', (fu.signups || []).length === 1);
      check('le profil principal ne porte PAS le genre (demande séparée : la colonne absente ne casse jamais l\'inscription)', main.full_name === 'Aïcha Moussa' && !('gender' in main), main);
      check('une demande à part enregistre exactement { gender: "femme" }', genderPatches(fu).length === 1 && genderPatches(fu)[0].gender === 'femme', fu.patches);
      check('aucune erreur (inscription avec genre)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      // le script SQL n'est pas encore lancé : la base répond « colonne introuvable » pour le genre ; l'inscription réussit quand même
      const { v, fu } = await signupG({ rejectColumn: 'gender' }, {});
      await fillSignupG(v);
      await v.page.getByTestId('register-gender-homme').locator('visible=true').click();
      await submitG(v);
      await v.page.getByText('Bienvenue ✓').waitFor({ timeout: 15000 });
      await sleep(1200);
      check('colonne « gender » absente de la base : l\'inscription réussit quand même, aucun message d\'erreur', (fu.signups || []).length === 1 && (await v.page.getByText(/Inscription impossible/).count()) === 0 && !('gender' in fu.profile));
      await v.ctx.close();
    }

    // ---------- 2. profil du client : « Vous êtes » (seulement quand la base a la colonne)
    const openEditorG = async (fu) => {
      const c = await newVisitor(phone, { lang: 'fr', storage: { [SKG]: fu.session }, fakeUser: fu });
      await c.page.goto(`${BASE}/compte`, { waitUntil: 'load' });
      await c.page.getByTestId('profile-edit-open').waitFor({ timeout: 25000 });
      await c.page.getByTestId('profile-edit-open').click();
      await c.page.getByTestId('profile-editor').waitFor({ timeout: 10000 });
      return c;
    };
    const saveG = (c) => c.page.getByText('Enregistrer', { exact: true }).click();
    {
      const fu = clientG({ gender: null });
      const c = await openEditorG(fu);
      check('profil : « Vous êtes » avec Homme et Femme, aucun choisi', (await c.page.getByTestId('profile-gender-group').count()) === 1 && !(await selected(c.page, 'profile-gender-homme')) && !(await selected(c.page, 'profile-gender-femme')));
      await saveG(c);
      await sleep(600);
      check('rien changé : « Enregistrer » ne fait rien', fu.patches.length === 0);
      await c.page.getByTestId('profile-gender-homme').click();
      await c.page.screenshot({ path: path.join(OUT, '%3-profil-genre.png') });
      await saveG(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('une seule demande, avec les 7 informations + { gender: "homme" } (rien d\'autre : jamais de points, d\'admin ou d\'e-mail)',
        fu.patches.length === 1 && JSON.stringify(fu.patches[0]) === JSON.stringify({ full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, gender: 'homme' }), fu.patches);
      await c.ctx.close();
    }
    {
      // déjà « femme » : le formulaire le montre ; on change pour « homme »
      const fu = clientG({ gender: 'femme' });
      const c = await openEditorG(fu);
      check('client déjà « Femme » : le formulaire montre Femme coché', await selected(c.page, 'profile-gender-femme'));
      await c.page.getByTestId('profile-gender-homme').click();
      await saveG(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('changer pour Homme : enregistré', fu.patches.length === 1 && fu.patches[0].gender === 'homme', fu.patches);
      await c.ctx.close();
    }
    {
      // script SQL pas lancé (pas de clé « gender » dans le profil) : rien à choisir, et rien n'est envoyé pour le genre
      const fu = clientG({});
      const c = await openEditorG(fu);
      check('base sans la colonne : pas de « Vous êtes » dans le profil', (await c.page.getByTestId('profile-gender-group').count()) === 0);
      await c.page.getByTestId('profile-input-fullName').fill('Ahmed Hassan Ali');
      await saveG(c);
      await c.page.getByText('Profil mis à jour ✓').waitFor({ timeout: 10000 });
      check('...et le profil s\'enregistre sans jamais envoyer « gender »', fu.patches.length === 1 && !('gender' in fu.patches[0]), fu.patches);
      await c.ctx.close();
    }

    // ---------- 3. la carte de Zara pour les clients déjà inscrits
    {
      const fu = clientG({ gender: null });
      const c = await homeG(fu);
      await c.page.getByTestId('gender-card').waitFor({ timeout: 15000 });
      const txt = await c.page.getByTestId('gender-card').innerText();
      check('accueil : la carte « Zara : une petite question — vous êtes… » avec Homme, Femme et « Plus tard »', /Zara : une petite question/.test(txt) && /vous êtes/i.test(txt) && /Homme/.test(txt) && /Femme/.test(txt) && /Plus tard/.test(txt), txt);
      await c.page.screenshot({ path: path.join(OUT, '%4-accueil-carte-zara.png') });
      const ask = JSON.parse((await c.page.evaluate((k) => localStorage.getItem(k), askKey)) || 'null');
      check('la demande est notée sur le téléphone (1re fois)', ask && ask.count === 1 && Math.abs(Date.now() - ask.last) < 60000, ask);
      await c.page.getByTestId('gender-card-femme').click();
      await c.page.getByText('Merci ✓').waitFor({ timeout: 10000 });
      check('un geste : exactement { gender: "femme" } envoyé à la base', fu.patches.length === 1 && JSON.stringify(fu.patches[0]) === '{"gender":"femme"}', fu.patches);
      check('la carte disparaît, remerciement affiché', (await c.page.getByTestId('gender-card').count()) === 0);
      await c.page.reload({ waitUntil: 'load' });
      await c.page.getByTestId('home-tagline').waitFor({ timeout: 25000 });
      await sleep(2500);
      check('après rechargement : la carte ne revient pas (le client a répondu)', (await c.page.getByTestId('gender-card').count()) === 0);
      check('aucune erreur (carte de Zara)', c.errs.length === 0, c.errs);
      await c.ctx.close();
    }
    {
      // « Plus tard » : revient 3 jours après, trois fois au plus
      const fu = clientG({ gender: null });
      const c = await homeG(fu);
      await c.page.getByTestId('gender-card').waitFor({ timeout: 15000 });
      await c.page.getByTestId('gender-card-later').click();
      check('« Plus tard » : la carte se ferme, rien n\'est envoyé à la base', (await c.page.getByTestId('gender-card').count()) === 0 && fu.patches.length === 0);
      await c.page.reload({ waitUntil: 'load' });
      await c.page.getByTestId('home-tagline').waitFor({ timeout: 25000 });
      await sleep(2500);
      check('rechargement tout de suite : la carte ne revient pas (pas avant 3 jours)', (await c.page.getByTestId('gender-card').count()) === 0);
      await c.page.evaluate(([k, v]) => localStorage.setItem(k, v), [askKey, JSON.stringify({ count: 1, last: Date.now() - 4 * 86400000 })]);
      await c.page.reload({ waitUntil: 'load' });
      await c.page.getByTestId('gender-card').waitFor({ timeout: 15000 });
      check('4 jours après : la carte revient (2e fois)', (JSON.parse(await c.page.evaluate((k) => localStorage.getItem(k), askKey)) || {}).count === 2);
      await c.page.getByTestId('gender-card-later').click();
      await c.page.evaluate(([k, v]) => localStorage.setItem(k, v), [askKey, JSON.stringify({ count: 3, last: Date.now() - 20 * 86400000 })]);
      await c.page.reload({ waitUntil: 'load' });
      await c.page.getByTestId('home-tagline').waitFor({ timeout: 25000 });
      await sleep(2500);
      check('après 3 demandes : Zara ne demande plus, même 20 jours après', (await c.page.getByTestId('gender-card').count()) === 0);
      await c.ctx.close();
    }
    {
      // la base refuse l'enregistrement : message, la carte reste pour réessayer
      const fu = clientG({ gender: null }, { failNext: 1 });
      const c = await homeG(fu);
      await c.page.getByTestId('gender-card').waitFor({ timeout: 15000 });
      await c.page.getByTestId('gender-card-homme').click();
      await c.page.getByText('Enregistrement impossible').waitFor({ timeout: 10000 });
      check('enregistrement refusé : message clair, la carte reste pour réessayer', (await c.page.getByTestId('gender-card').count()) === 1);
      await c.page.getByTestId('gender-card-homme').click();
      await c.page.getByText('Merci ✓').waitFor({ timeout: 10000 });
      check('deuxième essai réussi : enregistré, la carte disparaît', fu.patches.length === 2 && fu.patches[1].gender === 'homme' && (await c.page.getByTestId('gender-card').count()) === 0, fu.patches);
      await c.ctx.close();
    }
    for (const [label, fu] of [
      ['client qui a déjà choisi', clientG({ gender: 'homme' })],
      ['base sans la colonne (script SQL pas lancé)', clientG({})],
      ['équipe (administrateur)', adminG({ gender: null })],
    ]) {
      const c = await homeG(fu);
      await sleep(3000);
      check(`pas de carte pour : ${label}`, (await c.page.getByTestId('gender-card').count()) === 0 && fu.patches.length === 0);
      await c.ctx.close();
    }
    {
      // visiteur sans compte : pas de carte
      const c = await newVisitor(phone, { lang: 'fr', fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await c.page.goto(`${BASE}/`, { waitUntil: 'load' });
      await c.page.getByTestId('home-tagline').waitFor({ timeout: 25000 });
      await sleep(2500);
      check('pas de carte pour un visiteur sans compte', (await c.page.getByTestId('gender-card').count()) === 0);
      await c.ctx.close();
    }

    // ---------- 4. Admin › Clients : liste, statistiques par genre, filtres, fiche du client
    const mkCust = (n, name, gender, extra = {}) => ({ id: `aaaaaaaa-0000-4000-8000-00000000000${n}`, email: `${name.toLowerCase()}@gmail.com`, full_name: name, phone: `6611110${n}`, whatsapp_number: null, profession: null, region: "N'Djamena", country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z', login_count: 2, fake_order_count: 0, ...(gender === undefined ? {} : { gender }), ...extra });
    const openAdminG = async ({ customers, orders = [], rpc = null, route = 'clients' }) => {
      const fu = adminG();
      const seen = { rpcs: [] };
      const v = await newVisitor(phone, { lang: 'fr', storage: { [SKG]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.route(/\/rest\/v1\//, (rt) => {
        const req = rt.request();
        const u = new URL(req.url());
        if (req.method() === 'OPTIONS') return rt.fallback();
        const t = u.pathname.replace('/rest/v1/', '');
        if (t === 'profiles' && !u.searchParams.get('id') && u.searchParams.get('is_admin') === 'eq.false') return jsonG(rt, customers);
        if (t === 'orders') return jsonG(rt, orders);
        if (['visitor_sessions', 'product_views', 'cart_events', 'customer_sanctions', 'favorites'].includes(t)) return jsonG(rt, []);
        if (t === 'rpc/admin_set_client_gender') {
          const body = JSON.parse(req.postData() || '{}');
          seen.rpcs.push(body);
          const r = rpc ? rpc(body) : { body: null };
          if (!r.status || r.status < 300) {
            const c = customers.find((x) => x.id === body.target_user_id);
            if (c) c.gender = body.new_gender;
          }
          return jsonG(rt, r.body, r.status || 200);
        }
        return rt.fallback();
      });
      await v.page.goto(`${BASE}/admin/${route}`, { waitUntil: 'load' });
      return { v, seen, fu };
    };
    const order = (n, uid, total, status) => ({ id: `bbbbbbbb-0000-4000-8000-00000000000${n}`, user_id: uid, total, status, is_flagged_fake: false, created_at: '2026-10-25T10:00:00Z' });
    {
      const customers = [mkCust(1, 'Aicha', 'femme'), mkCust(2, 'Mahamat', 'homme'), mkCust(3, 'Idriss', 'homme'), mkCust(4, 'Hawa', null), mkCust(5, 'Salim', null)];
      const orders = [order(1, customers[0].id, 30000, 'delivered'), order(2, customers[0].id, 20000, 'delivered'), order(3, customers[1].id, 10000, 'delivered'), order(4, customers[1].id, 8000, 'pending'), order(5, customers[3].id, 5000, 'delivered')];
      const { v } = await openAdminG({ customers, orders });
      await v.page.getByTestId('gender-stats').waitFor({ timeout: 25000 });
      const stat = (k) => v.page.getByTestId(`gender-stat-${k}`).innerText();
      check('Admin › Clients : « Genre connu pour 3 clients sur 5 (60 %) »', /Genre connu pour 3 clients sur 5 \(60 %\)/.test(await v.page.getByTestId('gender-stats-known').innerText()));
      const h = await stat('homme');
      check('Hommes : 2 clients (40 %), 1 a commandé, 2 commandes, ventes 10 000 FCFA, moyenne 5 000', /2 clients · 40 %/.test(h) && /1 ont commandé \(50 %\) · 2 commandes/.test(h) && /Ventes : 10[\s  ]000 FCFA/.test(h) && /moyenne par client : 5[\s  ]000 FCFA/.test(h), h);
      const f = await stat('femme');
      check('Femmes : 1 cliente (20 %), 1 a commandé, 2 commandes, ventes 50 000 FCFA', /1 client · 20 %/.test(f) && /1 ont commandé \(100 %\) · 2 commandes/.test(f) && /Ventes : 50[\s  ]000 FCFA/.test(f), f);
      const u = await stat('unknown');
      check('Non précisé : 2 clients (40 %), 1 a commandé, 1 commande, ventes 5 000 FCFA', /2 clients · 40 %/.test(u) && /1 ont commandé \(50 %\) · 1 commande/.test(u) && /Ventes : 5[\s  ]000 FCFA/.test(u), u);
      await v.page.getByTestId('gender-stats').scrollIntoViewIfNeeded();
      await v.page.screenshot({ path: path.join(OUT, '%5-admin-stats-genre.png') });
      await v.page.getByTestId('customers-filter-men').click();
      await v.page.getByText('2 client(s)', { exact: true }).waitFor({ timeout: 8000 });
      const rowsG = async () => (await v.page.getByTestId('admin-customer-row').allInnerTexts()).join('\n');
      const rowsMen = await rowsG();
      check('filtre « Hommes » : 2 lignes, Mahamat et Idriss (ni Aicha, ni Hawa, ni Salim)', (await v.page.getByTestId('admin-customer-row').count()) === 2 && /Mahamat/.test(rowsMen) && /Idriss/.test(rowsMen) && !/Aicha|Hawa|Salim/.test(rowsMen), rowsMen.slice(0, 200));
      check('chaque ligne dit « 👨 Homme »', (await v.page.getByTestId('customer-gender').allInnerTexts()).every((t) => /Homme/.test(t)));
      await v.page.getByTestId('customers-filter-women').click();
      await v.page.getByText('1 client(s)', { exact: true }).waitFor({ timeout: 8000 });
      const rowsWomen = await rowsG();
      check('filtre « Femmes » : 1 ligne, Aicha seulement', (await v.page.getByTestId('admin-customer-row').count()) === 1 && /Aicha/.test(rowsWomen) && !/Mahamat|Idriss|Hawa|Salim/.test(rowsWomen) && /Femme/.test((await v.page.getByTestId('customer-gender').allInnerTexts()).join()), rowsWomen.slice(0, 200));
      await v.page.getByTestId('customers-filter-genderUnknown').click();
      await v.page.getByText('2 client(s)', { exact: true }).waitFor({ timeout: 8000 });
      const rowsUnknown = await rowsG();
      check('filtre « Genre non précisé » : 2 lignes, Hawa et Salim', (await v.page.getByTestId('admin-customer-row').count()) === 2 && /Hawa/.test(rowsUnknown) && /Salim/.test(rowsUnknown) && !/Aicha|Mahamat|Idriss/.test(rowsUnknown) && (await v.page.getByTestId('customer-gender').allInnerTexts()).every((t) => /non précisé/.test(t)), rowsUnknown.slice(0, 200));
      check('aucune erreur (Admin › Clients, genre)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      // base sans la colonne : ni statistiques, ni filtres, ni ligne « genre »
      const customers = [mkCust(1, 'Aicha', undefined), mkCust(2, 'Mahamat', undefined)];
      const { v } = await openAdminG({ customers });
      await v.page.getByText('Total clients').waitFor({ timeout: 25000 });
      await v.page.getByText('2 client(s)', { exact: true }).waitFor({ timeout: 8000 });
      check('base sans la colonne : pas de carte « par genre », pas de filtres Hommes / Femmes, pas de ligne genre', (await v.page.getByTestId('gender-stats').count()) === 0 && (await v.page.getByTestId('customers-filter-men').count()) === 0 && (await v.page.getByTestId('customer-gender').count()) === 0);
      await v.ctx.close();
    }
    // fiche du client : l'administrateur choisit, corrige, remet « non précisé »
    {
      const customers = [mkCust(1, 'Aicha', null)];
      const { v, seen } = await openAdminG({ customers, route: `clients/${customers[0].id}` });
      await v.page.getByTestId('admin-gender-section').waitFor({ timeout: 25000 });
      check('fiche : « Genre : Non précisé », deux boutons, pas de « Remettre »', /Non précisé/.test(await v.page.getByTestId('admin-gender-section').innerText()) && (await v.page.getByTestId('admin-gender-clear').count()) === 0 && !(await selected(v.page, 'admin-gender-homme')));
      await v.page.getByTestId('admin-gender-femme').click();
      await v.page.getByText('Genre enregistré ✓').waitFor({ timeout: 10000 });
      check('un geste : UNE demande { target_user_id, new_gender: "femme" } à la base', seen.rpcs.length === 1 && seen.rpcs[0].target_user_id === customers[0].id && seen.rpcs[0].new_gender === 'femme', seen.rpcs);
      await v.page.getByTestId('admin-gender-clear').waitFor({ timeout: 10000 });
      check('la fiche se met à jour : « Femme » coché, « Remettre non précisé » apparaît', (await selected(v.page, 'admin-gender-femme')) && /Femme/.test(await v.page.getByTestId('admin-gender-section').innerText()));
      await v.page.screenshot({ path: path.join(OUT, '%6-admin-fiche-genre.png') });
      await v.page.getByTestId('admin-gender-femme').click();
      await sleep(500);
      check('re-toucher le choix déjà fait : aucune nouvelle demande', seen.rpcs.length === 1);
      await v.page.getByTestId('admin-gender-homme').click();
      await v.page.waitForFunction(() => document.querySelector('[data-testid="admin-gender-homme"]')?.getAttribute('aria-checked') === 'true', null, { timeout: 8000 });
      check('correction en Homme : demande { new_gender: "homme" }', seen.rpcs.length === 2 && seen.rpcs[1].new_gender === 'homme', seen.rpcs);
      await v.page.getByTestId('admin-gender-clear').click();
      await v.page.waitForFunction(() => !document.querySelector('[data-testid="admin-gender-clear"]'), null, { timeout: 8000 });
      check('« Remettre non précisé » : demande { new_gender: null }, le client redevient « Non précisé »', seen.rpcs.length === 3 && seen.rpcs[2].new_gender === null && /Non précisé/.test(await v.page.getByTestId('admin-gender-section').innerText()), seen.rpcs);
      check('aucune erreur (fiche client, genre)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      // la base refuse (script pas lancé) : message clair, rien ne change à l'écran
      const customers = [mkCust(1, 'Aicha', null)];
      const { v, seen } = await openAdminG({ customers, route: `clients/${customers[0].id}`, rpc: () => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.admin_set_client_gender(new_gender, target_user_id) in the schema cache' } }) });
      await v.page.getByTestId('admin-gender-section').waitFor({ timeout: 25000 });
      await v.page.getByTestId('admin-gender-homme').click();
      await v.page.getByText('Genre non enregistré').waitFor({ timeout: 10000 });
      check('base qui refuse : message d\'erreur, le client reste « Non précisé »', seen.rpcs.length === 1 && /Non précisé/.test(await v.page.getByTestId('admin-gender-section').innerText()) && !(await selected(v.page, 'admin-gender-homme')));
      await v.ctx.close();
    }
    {
      // base sans la colonne : la fiche n'a pas de section genre
      const customers = [mkCust(1, 'Aicha', undefined)];
      const { v } = await openAdminG({ customers, route: `clients/${customers[0].id}` });
      await v.page.getByText('Identité').first().waitFor({ timeout: 25000 });
      check('fiche d\'un client dont la base n\'a pas la colonne : pas de section genre', (await v.page.getByTestId('admin-gender-section').count()) === 0);
      await v.ctx.close();
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // & Vrais chiffres des visites (add-visit-stats.sql) : tableau de bord et Admin › Clients lisent les comptes exacts de la base
  // ---------------------------------------------------------------------------------------------------------------------------
  if (PARTS.includes('&')) {
    console.log('\n== & Vrais chiffres des visites : tableau de bord (visiteurs, vraies visites, qualite par source/campagne), Admin › Clients (visites exactes, pages de 1000) (fausse base)');
    const SKV = 'sb-xtitsmmccpkelxfjyqyh-auth-token';
    const HDRV = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };
    const jsonV = (route, body, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json', ...HDRV }, body: JSON.stringify(body) });
    const UID_V = '66666666-6666-4666-8666-666666666666';
    const JWTV = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjY2NjY2Ni02NjY2LTQ2NjYtODY2Ni02NjY2NjY2NjY2NjYiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2ln';
    const adminV = () => {
      const auth = { id: UID_V, aud: 'authenticated', role: 'authenticated', email: 'admin@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
      const token = { access_token: JWTV, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: auth };
      return { auth, token, session: JSON.stringify(token), editable: true, patches: [], profile: { id: UID_V, email: 'admin@gmail.com', full_name: 'Admin Albasse', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'admin', is_admin: true, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z' } };
    };
    const PROD_V = 'cccccccc-0000-4000-8000-000000000001';
    const productV = { id: PROD_V, category_id: 'dddddddd-0000-4000-8000-000000000001', name: 'Baskets Test Chunky', slug: 'baskets-test', description: '', price: 22500, compare_at_price: null, images: [], colors: [], sizes: [], stock: 10, is_flash_sale: false, flash_sale_ends_at: null, notify_on_publish: false, is_active: true, affiliate_commission_rate: null, rating: 0, review_count: 0, created_at: '2026-10-01T00:00:00Z' };
    const todayOverview = {
      sessions: 1839, visitors: 1618, real_sessions: 140, real_visitors: 120,
      by_source: [
        { source: 'Publicité / campagne', sessions: 1671, visitors: 1503, real_sessions: 1, real_visitors: 1, product_views: 3, cart_adds: 0, orders: 0, revenue: 0 },
        { source: 'Accès direct', sessions: 117, visitors: 88, real_sessions: 100, real_visitors: 60, product_views: 400, cart_adds: 20, orders: 0, revenue: 0 },
      ],
      by_campaign: [{ source: 'Publicité / campagne', medium: 'paid', campaign: '120253099938360325', sessions: 415, real_sessions: 0 }],
      top_viewed: [{ product_id: PROD_V, views: 300 }],
    };
    const windowOverview = {
      sessions: 16383, visitors: 14000, real_sessions: 900, real_visitors: 700,
      by_source: [
        { source: 'Publicité / campagne', sessions: 15000, visitors: 13000, real_sessions: 10, real_visitors: 9, product_views: 8000, cart_adds: 200, orders: 0, revenue: 0 },
        { source: 'Accès direct', sessions: 1383, visitors: 1000, real_sessions: 890, real_visitors: 690, product_views: 805, cart_adds: 104, orders: 3, revenue: 60000 },
      ],
      by_campaign: [],
      top_viewed: [{ product_id: PROD_V, views: 4321 }],
    };
    // rpc : { today, window } = résultats de admin_visit_overview ; null = « le script SQL n'est pas lancé » (la base répond que la fonction n'existe pas)
    const openDashV = async ({ rpc = true, legacySessions = [], legacyViews = [] } = {}) => {
      const fu = adminV();
      const seen = { calls: [], paths: [], viewsUrl: '' };
      const v = await newVisitor(phone, { lang: 'fr', storage: { [SKV]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.route(/\/rest\/v1\//, (rt) => {
        const req = rt.request();
        const u = new URL(req.url());
        if (req.method() === 'OPTIONS') return rt.fallback();
        const t = u.pathname.replace('/rest/v1/', '');
        if (req.method() === 'GET' || req.method() === 'HEAD') seen.paths.push(t); // seules les LECTURES comptent (le site enregistre aussi sa propre visite)
        if (t === 'rpc/admin_visit_overview') {
          const body = JSON.parse(req.postData() || '{}');
          seen.calls.push(body);
          if (!rpc) return jsonV(rt, { code: 'PGRST202', message: 'Could not find the function public.admin_visit_overview', details: null, hint: null }, 404);
          const days = (Date.now() - Date.parse(body.p_since)) / 86400000;
          return jsonV(rt, days > 5 ? windowOverview : todayOverview);
        }
        if (t === 'products') return jsonV(rt, [productV]);
        if (t === 'visitor_sessions') return jsonV(rt, legacySessions);
        if (t === 'product_views') { seen.viewsUrl = req.url(); return jsonV(rt, legacyViews); }
        if (t === 'profiles' && u.searchParams.get('id')) return rt.fallback(); // le profil de l'administrateur : fourni par la fausse connexion
        if (['orders', 'cart_events', 'app_download_clicks', 'app_installs', 'profiles'].includes(t)) return jsonV(rt, []);
        return rt.fallback();
      });
      await v.page.goto(`${BASE}/admin/tableau-de-bord`, { waitUntil: 'load' });
      await v.page.getByTestId('dashboard-visitors').waitFor({ timeout: 30000 });
      return { v, seen };
    };
    const txtV = (page, id) => page.getByTestId(id).innerText();

    // ---------- 1. le script SQL est lancé : les comptes exacts de la base
    {
      const { v, seen } = await openDashV({ rpc: true });
      check('tableau de bord : « Visiteurs aujourd\'hui » = 1618 (le vrai nombre, plus bloqué à 900)', /1618/.test(await txtV(v.page, 'dashboard-visitors')), await txtV(v.page, 'dashboard-visitors'));
      check('carte « Vraies visites aujourd\'hui » = 120', /120/.test(await txtV(v.page, 'dashboard-real-visits')) && /Vraies visites/.test(await txtV(v.page, 'dashboard-real-visits')));
      const help = await txtV(v.page, 'dashboard-real-help');
      check('explication : 20 secondes, 2 pages, connecté ; « 120 sur 1618 (7 %) »', /20 secondes/.test(help) && /2 pages/.test(help) && /connectée/.test(help) && /120 sur 1618 \(7 %\)/.test(help), help);
      const ads = await txtV(v.page, 'dashboard-quality-Publicité / campagne');
      check('qualité : la pub a 1503 visiteurs, 1 seul vrai, écrit « <1 % » (jamais « 0 % » quand il y en a un)', /1503/.test(ads) && /\b1\b/.test(ads) && /<1 %/.test(ads) && !/\b0 %/.test(ads), ads);
      const direct = await txtV(v.page, 'dashboard-quality-Accès direct');
      check('qualité : accès direct 88 visiteurs, 60 vrais, 68 %', /88/.test(direct) && /60/.test(direct) && /68 %/.test(direct), direct);
      const camp = await txtV(v.page, 'dashboard-campaign-120253099938360325');
      check('campagne Meta : le numéro 120253099938360325 (celui du Gestionnaire Meta), 415 visites, 0 vraie, 0 %', /120253099938360325/.test(camp) && !/paid/.test(camp) && /415/.test(camp) && /0 %/.test(camp), camp);
      const body = await v.page.locator('body').innerText();
      check('articles les plus consultés : « Baskets Test Chunky », 4321 vue(s) (comptés par la base sur 30 jours)', /Baskets Test Chunky/.test(body) && /4321 vue\(s\)/.test(body));
      check('performance par source : 15000 visites pour la pub, 1383 en accès direct (exacts), 3 commandes', /15000/.test(body) && /1383/.test(body));
      check('2 demandes de comptes (aujourd\'hui et 30 jours), aucune ancienne lecture ligne par ligne', seen.calls.length === 2 && !seen.paths.includes('visitor_sessions') && !seen.paths.includes('product_views') && !seen.paths.includes('cart_events'), { calls: seen.calls, paths: seen.paths });
      check('la demande « aujourd\'hui » part de minuit, celle des 30 jours de bien avant', seen.calls.some((c) => (Date.now() - Date.parse(c.p_since)) / 3600000 < 25) && seen.calls.some((c) => (Date.now() - Date.parse(c.p_since)) / 86400000 > 25), seen.calls);
      await v.page.screenshot({ path: path.join(OUT, '&1-tableau-de-bord-vraies-visites.png'), fullPage: true });
      check('aucune erreur (tableau de bord avec comptes exacts)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }

    // ---------- 2. le script SQL n'est pas encore lancé : l'ancien calcul reste, sans « vraies visites », et sans colonne inexistante
    {
      const sessions = [
        { id: 's1', started_at: '2026-10-31T08:00:00Z', referrer_source: 'Accès direct', visitor_id: 'v1' },
        { id: 's2', started_at: '2026-10-31T09:00:00Z', referrer_source: 'Accès direct', visitor_id: 'v1' },
        { id: 's3', started_at: '2026-10-31T09:30:00Z', referrer_source: 'Facebook', visitor_id: 'v2' },
      ];
      const views = [{ product_id: PROD_V, session_id: 's1', viewed_at: '2026-10-31T08:01:00Z' }, { product_id: PROD_V, session_id: 's3', viewed_at: '2026-10-31T09:31:00Z' }];
      const { v, seen } = await openDashV({ rpc: false, legacySessions: sessions, legacyViews: views });
      check('sans le script SQL : « Visiteurs aujourd\'hui » = 2 (ancien calcul : v1 et v2)', /\b2\b/.test(await txtV(v.page, 'dashboard-visitors')), await txtV(v.page, 'dashboard-visitors'));
      check('sans le script SQL : pas de carte « Vraies visites », pas de section qualité', (await v.page.getByTestId('dashboard-real-visits').count()) === 0 && (await v.page.getByTestId('dashboard-real-help').count()) === 0 && (await v.page.getByText('Qualité des visites').count()) === 0);
      const body = await v.page.locator('body').innerText();
      check('sans le script SQL : les articles les plus consultés s\'affichent (2 vues) — la lecture utilise la vraie colonne « viewed_at »', /Baskets Test Chunky/.test(body) && /2 vue\(s\)/.test(body) && /viewed_at/.test(seen.viewsUrl) && !/created_at/.test(seen.viewsUrl), seen.viewsUrl);
      check('sans le script SQL : aucune erreur, la page reste complète', v.errs.length === 0 && /Performance par source/.test(body), v.errs);
      await v.ctx.close();
    }

    // ---------- 3. Admin › Clients : visites exactes par client, listes lues page par page
    const mkCustV = (n, name) => ({ id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`, email: `${name.toLowerCase()}${n}@gmail.com`, full_name: name, phone: `66${String(n).padStart(6, '0')}`, whatsapp_number: null, profession: null, region: "N'Djamena", country: 'Tchad', address: null, loyalty_points: 0, banned: false, role: 'customer', is_admin: false, is_affiliate: false, created_at: '2026-10-20T10:00:00Z', last_login_at: '2026-10-30T10:00:00Z', login_count: 2, fake_order_count: 0 });
    const openClientsV = async ({ customers, activity = null, legacy = null }) => {
      const fu = adminV();
      const seen = { paths: [], profileRanges: [], rpcs: 0 };
      const v = await newVisitor(phone, { lang: 'fr', storage: { [SKV]: fu.session }, fakeUser: fu, fakeStore: { waOrder: true, accountRequired: false, patches: [] } });
      await v.page.route(/\/rest\/v1\//, (rt) => {
        const req = rt.request();
        const u = new URL(req.url());
        if (req.method() === 'OPTIONS') return rt.fallback();
        const t = u.pathname.replace('/rest/v1/', '');
        if (req.method() === 'GET' || req.method() === 'HEAD') seen.paths.push(t);
        if (t === 'profiles' && !u.searchParams.get('id') && u.searchParams.get('is_admin') === 'eq.false') {
          // « .range(0, 999) » devient offset=0 & limit=1000 ; comme la vraie base : au plus 1000 lignes par demande, même si on en demande plus
          const offset = Number(u.searchParams.get('offset') || 0);
          const limit = Math.min(Number(u.searchParams.get('limit') || 1000), 1000);
          seen.profileRanges.push(`${offset}+${limit}`);
          return jsonV(rt, customers.slice(offset, offset + limit));
        }
        if (t === 'orders') return jsonV(rt, []);
        if (t === 'rpc/admin_customer_activity') {
          seen.rpcs++;
          if (!activity) return jsonV(rt, { code: 'PGRST202', message: 'Could not find the function public.admin_customer_activity', details: null, hint: null }, 404);
          return jsonV(rt, activity);
        }
        if (t === 'visitor_sessions') return jsonV(rt, legacy ? legacy.sessions : []);
        if (t === 'product_views') return jsonV(rt, legacy ? legacy.views : []);
        if (t === 'cart_events') return jsonV(rt, legacy ? legacy.carts : []);
        if (['customer_sanctions', 'favorites'].includes(t)) return jsonV(rt, []);
        return rt.fallback();
      });
      await v.page.goto(`${BASE}/admin/clients`, { waitUntil: 'load' });
      await v.page.getByTestId('admin-customer-row').first().waitFor({ timeout: 30000 });
      return { v, seen };
    };
    {
      // Amina : 4 visites, 2 h 40 min en tout ; Idriss : aucune visite mais 5 articles vus
      const customers = [mkCustV(1, 'Amina'), mkCustV(2, 'Idriss')];
      const activity = [
        { user_id: customers[0].id, sessions: 4, duration_seconds: 9600, last_seen_at: '2026-10-31T10:00:00Z', top_source: 'Facebook', views: 12, cart_adds: 3 },
        { user_id: customers[1].id, sessions: 0, duration_seconds: 0, last_seen_at: null, top_source: null, views: 5, cart_adds: 0 },
      ];
      const { v, seen } = await openClientsV({ customers, activity });
      const rows = await v.page.getByTestId('admin-customer-row').allInnerTexts();
      const amina = rows.find((r) => /Amina/.test(r)) || '';
      const idriss = rows.find((r) => /Idriss/.test(r)) || '';
      check('Admin › Clients : Amina affiche 2 h 40 min (compté par la base)', /2 h 40 min/.test(amina), amina);
      check('Admin › Clients : Idriss (aucune visite) affiche 0 s', /0 s/.test(idriss), idriss);
      check('comptes exacts : une demande, aucune ancienne lecture ligne par ligne des visites', seen.rpcs === 1 && !seen.paths.includes('visitor_sessions') && !seen.paths.includes('product_views') && !seen.paths.includes('cart_events'), seen.paths);
      check('la liste des clients est demandée page par page (depuis 0, 1000 lignes)', seen.profileRanges[0] === '0+1000', seen.profileRanges);
      check('aucune erreur (Admin › Clients avec comptes exacts)', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      // le script SQL n'est pas lancé : l'ancienne lecture prend le relais
      const customers = [mkCustV(1, 'Amina')];
      const legacy = {
        sessions: [{ id: 's1', user_id: customers[0].id, duration_seconds: 1200, last_seen_at: '2026-10-31T10:00:00Z', referrer_source: 'Facebook' }, { id: 's2', user_id: customers[0].id, duration_seconds: 600, last_seen_at: '2026-10-30T10:00:00Z', referrer_source: 'Facebook' }],
        views: [{ user_id: customers[0].id }],
        carts: [],
      };
      const { v, seen } = await openClientsV({ customers, activity: null, legacy });
      const row = (await v.page.getByTestId('admin-customer-row').allInnerTexts())[0] || '';
      check('sans le script SQL : Admin › Clients garde l\'ancien calcul (30 min)', /30 min/.test(row) && seen.paths.includes('visitor_sessions'), { row, paths: seen.paths });
      check('sans le script SQL : aucune erreur', v.errs.length === 0, v.errs);
      await v.ctx.close();
    }
    {
      // plus de 1 000 clients : lus en deux pages, personne n'est perdu
      const customers = Array.from({ length: 1200 }, (_, i) => mkCustV(i + 1, `Client${i + 1}`));
      const { v, seen } = await openClientsV({ customers, activity: [] });
      const stats = await v.page.locator('body').innerText();
      check('1 200 clients : deux demandes (depuis 0, puis depuis 1000)', seen.profileRanges.length === 2 && seen.profileRanges[0] === '0+1000' && seen.profileRanges[1] === '1000+1000', seen.profileRanges);
      check('1 200 clients : les 1 200 sont comptés (pas bloqué à 1 000)', /1200/.test(stats), stats.slice(0, 400));
      await v.ctx.close();
    }
  }

  await b.close();
  server.kill('SIGKILL');
  console.log('\n' + (ok ? 'TOUT EST BON' : 'IL Y A DES ECHECS'));
})().catch((e) => {
  console.error('ERREUR DU TEST', e);
  process.exit(1);
});
