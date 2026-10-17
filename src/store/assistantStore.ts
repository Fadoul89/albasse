import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASSISTANT_NAME, ASSISTANT_ROLE } from '../constants/assistant';
import { DELIVERY_HOURS, HOME_CITY } from '../constants/shopRules';
import {
  cityReply,
  detectIntent,
  encouragement,
  firstNameFrom,
  firstNameOfFullName,
  importantInfo,
  isHomeCity,
  matchCity,
  newest,
  normalize,
  promotions,
  rulesReply,
  searchCatalog,
  serviceNote,
  tokenize,
  type CatalogProduct,
  type City,
} from '../lib/assistantBrain';
import {
  ANY_BUDGET,
  BUDGETS,
  GIFT_LABELS,
  adviceCategories,
  candidatesFor,
  cartReminder,
  crossSellTarget,
  decodeRange,
  describeRange,
  dominantSlug,
  encodeRange,
  formatPhone,
  giftPicks,
  giftWrapPitch,
  giftWrapReply,
  laterReply,
  lowStockLine,
  maxDiscountPct,
  parseBudget,
  pickInBudget,
  priceReply,
  productPitch,
  stripBudget,
  trustReply,
  type Context,
  type GiftTarget,
  type Range,
} from '../lib/assistantMarketing';
import { getCatalog, getCategories, getCities, getStoreInfo, toCard, type AssistantProduct } from '../lib/assistantData';
import { navigationRef } from '../navigation/navigationRef';
import { useAuthStore } from './authStore';
import { useCartStore } from './cartStore';

// Zara Kings, assistante marketing (sans IA) : elle suit un scenario et comprend des mots-cles.
// La conversation est gardee dans l'onglet (sessionStorage), le prenom du visiteur sur l'appareil.

export interface ChatAction {
  label: string;
  kind:
    | 'say'
    | 'whatsapp'
    | 'register'
    | 'login'
    | 'orders'
    | 'category'
    | 'skip'
    | 'city'
    | 'menu'
    | 'cart'
    | 'link'
    | 'need'
    | 'budget'
    | 'pair'
    | 'gift';
  payload?: string;
  highlight?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: AssistantProduct[];
  actions?: ChatAction[];
}

export type Step = 'ask_name' | 'menu' | 'ask_city' | 'ask_budget';

interface AssistantState {
  open: boolean;
  messages: ChatMessage[];
  loading: boolean;
  step: Step;
  // Ce dont on parle (produit cherche, categorie, cadeau...) : sert a affiner par budget.
  ctx: Context | null;
  name: string | null;
  teaserDismissed: boolean;
  openChat: () => void;
  closeChat: () => void;
  dismissTeaser: () => void;
  send: (text: string) => Promise<void>;
  choose: (action: ChatAction) => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = 'albasse_zara_v1';
const NAME_KEY = 'albasse_zara_name';
const MAX_SAVED = 40;
const STEPS: Step[] = ['ask_name', 'menu', 'ask_city', 'ask_budget'];
const CTX_KINDS = ['query', 'category', 'gift', 'promo', 'new'];

interface Saved {
  messages: ChatMessage[];
  step: Step;
  ctx: Context | null;
}

function load(): Saved {
  const empty: Saved = { messages: [], step: 'menu', ctx: null };
  if (Platform.OS !== 'web') return empty;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const messages = Array.isArray(parsed?.messages)
      ? (parsed.messages as ChatMessage[]).filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
      : [];
    const step: Step = STEPS.includes(parsed?.step) ? parsed.step : 'menu';
    const ctx: Context | null = parsed?.ctx && CTX_KINDS.includes(parsed.ctx.kind) ? parsed.ctx : null;
    return { messages, step, ctx };
  } catch {
    return empty;
  }
}

function save(messages: ChatMessage[], step: Step, ctx: Context | null) {
  if (Platform.OS !== 'web') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-MAX_SAVED), step, ctx }));
  } catch {
    // ignore : la conversation ne sera simplement pas gardee
  }
}

let counter = 0;
const newId = () => `${Date.now()}-${counter++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Petite pause avant chaque message pour que ce soit agreable a lire (les trois points s'affichent).
const typingDelay = (text: string) => 450 + Math.min(text.length * 6, 650);

const saved = load();

export const useAssistantStore = create<AssistantState>((set, get) => {
  const push = (message: ChatMessage) => {
    set((s) => {
      const messages = [...s.messages, message];
      save(messages, s.step, s.ctx);
      return { messages };
    });
  };
  const setStep = (step: Step) => {
    set({ step });
    save(get().messages, step, get().ctx);
  };
  const setCtx = (ctx: Context | null) => {
    set({ ctx });
    save(get().messages, get().step, ctx);
  };

  // Tout ce que Zara fait passe par run() : les trois points restent affiches du debut a la fin,
  // et le visiteur ne peut pas ecrire entre deux de ses messages.
  let depth = 0;
  async function run(task: () => Promise<void>) {
    depth++;
    set({ loading: true });
    try {
      await task();
    } catch {
      push({
        id: newId(),
        role: 'assistant',
        text: 'Oups, un petit souci de mon côté 😅 Réessayez dans un instant, ou écrivez-nous sur WhatsApp.',
        actions: [{ label: '💬 WhatsApp', kind: 'whatsapp' }, { label: '🏠 Menu', kind: 'menu' }],
      });
    } finally {
      depth--;
      if (depth === 0) set({ loading: false });
    }
  }

  async function say(text: string, extra: { products?: AssistantProduct[]; actions?: ChatAction[] } = {}) {
    await sleep(typingDelay(text));
    push({ id: newId(), role: 'assistant', text, ...extra });
  }

  const isGuest = () => !useAuthStore.getState().isAuthenticated;
  const withName = (text: string) => {
    const n = get().name;
    return n ? text.replace('{nom}', `, ${n}`) : text.replace('{nom}', '');
  };

  const menuActions = (): ChatAction[] => {
    const actions: ChatAction[] = [];
    if (isGuest()) actions.push({ label: '👤 Créer mon compte', kind: 'register', highlight: true });
    actions.push(
      { label: '🔥 Promotions', kind: 'say', payload: 'promotions' },
      { label: '🆕 Nouveautés', kind: 'say', payload: 'nouveautés' },
      { label: '🎯 Conseil', kind: 'say', payload: 'conseil' },
      { label: '🛍️ Catégories', kind: 'say', payload: 'catégories' },
      { label: '🚚 Livraison et paiement', kind: 'say', payload: 'livraison' }
    );
    if (useCartStore.getState().items.length > 0) actions.push({ label: '🛒 Mon panier', kind: 'cart' });
    if (!isGuest()) actions.push({ label: '📦 Mes commandes', kind: 'orders' });
    actions.push({ label: '💬 WhatsApp', kind: 'whatsapp' });
    return actions;
  };

  const afterAnswerActions = (): ChatAction[] => [
    { label: '🔥 Promotions', kind: 'say', payload: 'promotions' },
    { label: '🛍️ Catégories', kind: 'say', payload: 'catégories' },
    { label: '🏠 Menu', kind: 'menu' },
    { label: '💬 WhatsApp', kind: 'whatsapp' },
  ];

  async function showMenu(intro: string) {
    setStep('menu');
    await say(intro, { actions: menuActions() });
  }

  async function accountInvitation() {
    // Seulement pour les visiteurs sans compte : les avantages d'un compte, avec le bouton pour le creer.
    setStep('menu');
    await say(
      withName(
        'Créez votre compte gratuit{nom} : suivez vos commandes, retrouvez vos favoris ❤️, gagnez des points fidélité et tournez la roue de la chance 🎡 !'
      ),
      { actions: menuActions() }
    );
  }

  // Si le visiteur regarde un produit, ou a un panier : Zara commence par la.
  async function contextMessages() {
    try {
      const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
      if (route?.name === 'Product') {
        const slug = (route.params as { slug?: string } | undefined)?.slug;
        if (slug) {
          const product = (await getCatalog()).find((p) => p.slug === slug);
          if (product && product.stock > 0) {
            await say(productPitch(product));
            return;
          }
        }
      }
      const items = useCartStore.getState().items;
      if (items.length > 0) {
        const count = items.reduce((n, i) => n + i.quantity, 0);
        const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
        await say(cartReminder(count, total));
      }
    } catch {
      // pas de message de contexte : on continue avec la suite
    }
  }

  // Apres la presentation : le contexte (produit regarde, panier), les informations importantes,
  // puis l'invitation a creer un compte (visiteur) ou le menu (client connecte).
  async function onboarding() {
    await contextMessages();
    await say(importantInfo());
    if (isGuest()) await accountInvitation();
    else await showMenu('Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
  }

  async function begin() {
    let name = firstNameOfFullName(useAuthStore.getState().profile?.full_name);
    if (!name) {
      try {
        name = firstNameFrom((await AsyncStorage.getItem(NAME_KEY)) ?? '');
      } catch {
        name = null;
      }
    }
    set({ name });
    // Message de bienvenue : seulement le nom et le role.
    await say(`Bonjour${name ? ` ${name}` : ''} ! Je suis ${ASSISTANT_NAME}, l'${ASSISTANT_ROLE} d'Albasse Shopping.`);
    if (!name) {
      setStep('ask_name');
      await say('Comment puis-je vous appeler ?', { actions: [{ label: 'Passer', kind: 'skip' }] });
      return;
    }
    await onboarding();
  }

  async function afterName(name: string) {
    set({ name });
    try {
      await AsyncStorage.setItem(NAME_KEY, name);
    } catch {
      // ignore : le prenom ne sera pas retenu pour la prochaine visite
    }
    setStep('menu');
    await say(`Enchantée ${name} ! 😊`);
    await onboarding();
  }

  async function dataError() {
    await say('Je n’arrive pas à charger ces informations pour le moment. Réessayez dans un instant, ou écrivez-nous sur WhatsApp.', {
      actions: [{ label: '💬 WhatsApp', kind: 'whatsapp' }, { label: '🏠 Menu', kind: 'menu' }],
    });
  }

  // -------------------------------------------------------------------------------------------
  // Produits : fiches, puis une phrase qui pousse a l'achat et des boutons pour avancer
  // -------------------------------------------------------------------------------------------

  async function showProducts(intro: string, products: CatalogProduct[], ctx: Context | null, catalog: CatalogProduct[]) {
    setCtx(ctx);
    await say(intro, { products: products.map(toCard) });
    const pair = ctx && ctx.kind !== 'gift' ? crossSellTarget(catalog, dominantSlug(products)) : null;
    const actions: ChatAction[] = [{ label: '💰 Mon budget', kind: 'say', payload: 'budget' }];
    if (pair) actions.push({ label: `➕ Avec : ${pair.name}`, kind: 'pair', payload: pair.slug });
    if (ctx?.kind !== 'promo') actions.push({ label: '🔥 Promotions', kind: 'say', payload: 'promotions' });
    actions.push({ label: '🏠 Menu', kind: 'menu' }, { label: '💬 WhatsApp', kind: 'whatsapp' });
    const closing =
      ctx?.kind === 'gift'
        ? [lowStockLine(products), giftWrapPitch()].filter(Boolean).join('\n')
        : (lowStockLine(products) ?? encouragement(get().messages.length));
    await say(closing, { actions });
  }

  async function promoReply() {
    try {
      const catalog = await getCatalog();
      const promos = promotions(catalog, 4);
      if (promos.length > 0) {
        const pct = maxDiscountPct(catalog);
        await showProducts(withName(`🔥 Voici nos meilleures promotions du moment${pct ? ` (jusqu’à -${pct} %)` : ''}{nom} !`), promos, { kind: 'promo' }, catalog);
      } else {
        await say('Pas de promotion en ce moment, mais découvrez nos nouveautés !', {
          actions: [{ label: '🆕 Nouveautés', kind: 'say', payload: 'nouveautés' }, { label: '🏠 Menu', kind: 'menu' }],
        });
      }
    } catch {
      await dataError();
    }
  }

  async function newReply() {
    try {
      const catalog = await getCatalog();
      await showProducts(withName('🆕 Voici nos dernières nouveautés{nom} !'), newest(catalog, 4), { kind: 'new' }, catalog);
    } catch {
      await dataError();
    }
  }

  async function categoriesReply() {
    try {
      const cats = await getCategories();
      await say('Choisissez une catégorie 👇', {
        actions: cats.map((c) => ({ label: c.name, kind: 'category' as const, payload: c.slug })),
      });
    } catch {
      await dataError();
    }
  }

  // « chaussures homme », « parfum moins de 20000 » : le budget ecrit dans la phrase est pris en compte.
  async function searchReply(text: string) {
    try {
      const catalog = await getCatalog();
      const range = parseBudget(text);
      const query = stripBudget(text);
      const hasWords = tokenize(query).length > 0;
      if (range && !hasWords) {
        // un montant seul (« 20000 ») : c'est le budget de ce dont on parle, ou on demande ce que cherche le visiteur
        if (get().ctx) await budgetReply(range);
        else await askNeed();
        return;
      }
      const q = hasWords ? query : text;
      const ctx: Context = { kind: 'query', query: q };
      if (range) {
        const { items, fallback } = pickInBudget(catalog, ctx, range, 4);
        if (items.length > 0) {
          const intro = fallback
            ? `Je n’ai rien ${describeRange(range)} pour « ${q} ». Voici ce qui s’en approche le plus :`
            : `Voici ce que j’ai trouvé pour « ${q} » ${describeRange(range)}{nom} :`;
          await showProducts(withName(intro), items, ctx, catalog);
          return;
        }
      } else {
        const results = searchCatalog(catalog, q, 4);
        if (results.length > 0) {
          await showProducts(withName(`Voici ce que j’ai trouvé pour « ${q} »{nom} :`), results, ctx, catalog);
          return;
        }
      }
      await say(`Je n’ai rien trouvé pour « ${text} » 😕 Dites-moi ce que vous aimez, je vous conseille, ou parcourez nos catégories.`, {
        actions: [
          { label: '🎯 Conseil', kind: 'say', payload: 'conseil' },
          { label: '🛍️ Catégories', kind: 'say', payload: 'catégories' },
          { label: '🔥 Promotions', kind: 'say', payload: 'promotions' },
          { label: '💬 WhatsApp', kind: 'whatsapp' },
        ],
      });
    } catch {
      await dataError();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Conseil : besoin -> budget -> meilleurs choix ; cadeaux ; produits qui se completent
  // -------------------------------------------------------------------------------------------

  async function askNeed() {
    try {
      const cats = adviceCategories(await getCatalog());
      await say(withName('Avec plaisir{nom} ! Je suis là pour vous conseiller. Que cherchez-vous ?'), {
        actions: [
          ...cats.map((c) => ({ label: c.name, kind: 'need' as const, payload: c.slug })),
          { label: '🎁 Idée cadeau', kind: 'say' as const, payload: 'idée cadeau' },
        ],
      });
    } catch {
      await dataError();
    }
  }

  async function askBudget() {
    if (!get().ctx) {
      await askNeed();
      return;
    }
    setStep('ask_budget');
    await say(withName('Quel est votre budget{nom} ? Touchez une option ou écrivez un montant (ex. 20 000) 💰'), {
      actions: [
        ...BUDGETS.map((b) => ({ label: b.label, kind: 'budget' as const, payload: encodeRange(b.range) })),
        { label: 'Peu importe', kind: 'budget' as const, payload: encodeRange(ANY_BUDGET) },
      ],
    });
  }

  async function budgetReply(range: Range) {
    setStep('menu');
    try {
      const catalog = await getCatalog();
      const ctx = get().ctx;
      const { items, fallback } = pickInBudget(catalog, ctx, range, 4);
      if (items.length === 0) {
        await say('Je n’ai rien trouvé pour cette sélection 😕 Essayons autre chose ?', {
          actions: [{ label: '🎯 Conseil', kind: 'say', payload: 'conseil' }, { label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '💬 WhatsApp', kind: 'whatsapp' }],
        });
        return;
      }
      const intro = fallback
        ? `Je n’ai rien ${describeRange(range)} pour cette sélection. Voici ce qui s’en approche le plus :`
        : `Voici mes meilleurs choix ${describeRange(range)}{nom} :`;
      await showProducts(withName(intro), items, ctx, catalog);
    } catch {
      await dataError();
    }
  }

  async function askGift() {
    await say(withName('Quelle belle idée{nom} ! 🎁 Pour qui est le cadeau ?'), {
      actions: [
        { label: '👩 Pour elle', kind: 'gift', payload: 'elle' },
        { label: '👨 Pour lui', kind: 'gift', payload: 'lui' },
        { label: '👶 Pour un enfant', kind: 'gift', payload: 'enfant' },
      ],
    });
  }

  async function giftReply(who: GiftTarget) {
    try {
      const catalog = await getCatalog();
      const items = giftPicks(catalog, who, ANY_BUDGET, 4);
      if (items.length === 0) {
        await say('Je n’ai pas encore d’idée pour ce cadeau. Voyons nos promotions ?', {
          actions: [{ label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '💬 WhatsApp', kind: 'whatsapp' }],
        });
        return;
      }
      await showProducts(withName(`Voici mes idées cadeaux pour ${GIFT_LABELS[who]}{nom} 🎁`), items, { kind: 'gift', who }, catalog);
    } catch {
      await dataError();
    }
  }

  async function pairReply(slug: string) {
    try {
      const catalog = await getCatalog();
      const ctx: Context = { kind: 'category', slug };
      const items = candidatesFor(catalog, ctx).slice(0, 4);
      if (items.length === 0) {
        await dataError();
        return;
      }
      await showProducts(withName(`Pour compléter votre achat{nom}, voici nos ${items[0].category.toLowerCase()} 👇`), items, ctx, catalog);
    } catch {
      await dataError();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Livraison et paiement
  // -------------------------------------------------------------------------------------------

  async function askCity(known?: City[] | null) {
    setStep('ask_city');
    let popular: string[] = [HOME_CITY];
    try {
      const cities = known ?? (await getCities());
      popular = cities.slice(0, 6).map((c) => c.name);
    } catch {
      // on garde N'Djamena seulement
    }
    await say('Dans quelle ville souhaitez-vous être livré(e) ? Touchez votre ville ou écrivez-la :', {
      actions: popular.map((name) => ({ label: name, kind: 'city' as const, payload: name })),
    });
  }

  async function answerCity(cityName: string) {
    try {
      const cities = await getCities();
      const city = matchCity(cities, cityName);
      if (!city) {
        const list = cities.slice(0, 10).map((c) => c.name);
        await say(`Je ne trouve pas « ${cityName} » parmi nos villes de livraison. Voici les principales, ou écrivez-nous sur WhatsApp :`, {
          actions: [...list.map((name) => ({ label: name, kind: 'city' as const, payload: name })), { label: '💬 WhatsApp', kind: 'whatsapp' as const }],
        });
        return;
      }
      setStep('menu');
      const home = isHomeCity(city.name);
      await say(cityReply(city));
      await say(serviceNote(home), {
        actions: home ? afterAnswerActions() : [{ label: '💬 WhatsApp', kind: 'whatsapp' }, ...afterAnswerActions().filter((a) => a.kind !== 'whatsapp')],
      });
    } catch {
      // Base injoignable : N'Djamena (livraison gratuite, paiement a la livraison) ne depend pas de la base.
      if (isHomeCity(cityName) || /djamena|ndjam/.test(normalize(cityName).replace(/ /g, ''))) {
        setStep('menu');
        await say(cityReply({ name: HOME_CITY, fee: 0, agency: null }));
        await say(serviceNote(true), { actions: afterAnswerActions() });
        return;
      }
      await dataError();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Aiguillage
  // -------------------------------------------------------------------------------------------

  async function route(text: string) {
    const intent = detectIntent(text);
    switch (intent) {
      case 'bot':
        await say('Je suis l’assistante virtuelle d’Albasse Shopping : une assistante automatique, pas une personne. Pour parler à quelqu’un de l’équipe, écrivez-nous sur WhatsApp 👇', {
          actions: [{ label: '💬 WhatsApp', kind: 'whatsapp' }, { label: '🏠 Menu', kind: 'menu' }],
        });
        return;
      case 'thanks':
        await say(withName('Avec plaisir{nom} ! 😊 Profitez bien de nos promotions.'), { actions: afterAnswerActions() });
        return;
      case 'greeting':
        await showMenu(withName('Bonjour{nom} ! Que souhaitez-vous découvrir ? 🛍️'));
        return;
      case 'account':
        if (isGuest()) {
          await say('Créer un compte est gratuit et rapide : vous suivez vos commandes, retrouvez vos favoris ❤️, gagnez des points fidélité et tournez la roue de la chance 🎡.', {
            actions: [{ label: '👤 Créer mon compte', kind: 'register', highlight: true }, { label: 'Me connecter', kind: 'login' }, { label: '🏠 Menu', kind: 'menu' }],
          });
        } else {
          await say(withName('Vous êtes déjà connecté(e){nom} ✅ Retrouvez vos commandes à tout moment.'), {
            actions: [{ label: '📦 Mes commandes', kind: 'orders' }, { label: '🏠 Menu', kind: 'menu' }],
          });
        }
        return;
      case 'orders':
        await say('Retrouvez et suivez toutes vos commandes ici 👇', {
          actions: isGuest()
            ? [{ label: 'Me connecter', kind: 'login' }, { label: '👤 Créer mon compte', kind: 'register' }]
            : [{ label: '📦 Mes commandes', kind: 'orders' }, { label: '🏠 Menu', kind: 'menu' }],
        });
        return;
      case 'rules':
        await say(rulesReply(), { actions: afterAnswerActions() });
        return;
      case 'info':
        await say(importantInfo(), { actions: afterAnswerActions() });
        return;
      case 'delivery': {
        let cities: City[] | null = null;
        try {
          cities = await getCities();
        } catch {
          cities = null; // on demande la ville quand meme
        }
        const city = cities ? matchCity(cities, text) : null;
        if (city) {
          await answerCity(city.name);
          return;
        }
        await askCity(cities);
        return;
      }
      case 'promo':
        await promoReply();
        return;
      case 'new':
        await newReply();
        return;
      case 'categories':
        await categoriesReply();
        return;
      case 'advice':
        await askNeed();
        return;
      case 'wrap':
        await say(giftWrapReply(), {
          actions: [
            { label: '🎁 Idée cadeau', kind: 'say', payload: 'idée cadeau' },
            isGuest() ? { label: '👤 Créer mon compte', kind: 'register' } : { label: '📦 Mes commandes', kind: 'orders' },
            { label: '💬 WhatsApp', kind: 'whatsapp' },
          ],
        });
        return;
      case 'gift':
        await askGift();
        return;
      case 'budget': {
        const range = parseBudget(text);
        if (range && get().ctx) {
          await budgetReply(range);
          return;
        }
        await askBudget();
        return;
      }
      case 'price': {
        let pct: number | null = null;
        try {
          pct = maxDiscountPct(await getCatalog());
        } catch {
          pct = null;
        }
        await say(priceReply(pct), {
          actions: [{ label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '💰 Mon budget', kind: 'say', payload: 'budget' }, { label: '💬 WhatsApp', kind: 'whatsapp' }],
        });
        return;
      }
      case 'trust': {
        let info = { address: null as string | null, city: null as string | null, phone: null as string | null, mapsUrl: null as string | null };
        try {
          info = await getStoreInfo();
        } catch {
          // message de confiance sans l'adresse
        }
        const actions: ChatAction[] = [];
        if (info.mapsUrl) actions.push({ label: '📍 Voir la boutique', kind: 'link', payload: info.mapsUrl });
        actions.push({ label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '💬 WhatsApp', kind: 'whatsapp' });
        await say(trustReply(info), { actions });
        return;
      }
      case 'later':
        await say(withName(laterReply()), {
          actions: isGuest()
            ? [{ label: '👤 Créer mon compte', kind: 'register', highlight: true }, { label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '🏠 Menu', kind: 'menu' }]
            : [{ label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '🏠 Menu', kind: 'menu' }],
        });
        return;
      case 'order':
        await say('Commander est simple 👇\n1. Ouvrez le produit qui vous plaît\n2. Choisissez la couleur ou la taille\n3. Touchez « Ajouter au panier » ou « Acheter »\n4. Indiquez votre nom, téléphone, ville et adresse\n5. Payez : à la livraison à N’Djamena, à l’avance (Airtel Money ou Moov Money) dans les autres villes\n🎁 En option : emballage cadeau, 2 000 FCFA (touchez l’image cadeau)\n⏳ Pour éviter les fausses commandes, chaque commande est valable 48 h.', {
          actions: [{ label: '🔥 Promotions', kind: 'say', payload: 'promotions' }, { label: '🚚 Livraison et paiement', kind: 'say', payload: 'livraison' }, { label: '💬 WhatsApp', kind: 'whatsapp' }],
        });
        return;
      case 'contact': {
        const lines: string[] = [];
        try {
          const info = await getStoreInfo();
          const where = [info.address, info.city].filter(Boolean).join(', ');
          if (where) lines.push(`📍 ${where}`);
          if (info.hours) lines.push(`🕗 Boutique : ${info.hours}`);
          const phone = formatPhone(info.phone);
          if (phone) lines.push(`📞 ${phone}`);
        } catch {
          // on garde les horaires de livraison et WhatsApp
        }
        lines.splice(Math.min(lines.length, 2), 0, `🚚 Livraison : de ${DELIVERY_HOURS}`);
        lines.push('Pour une question, écrivez-nous sur WhatsApp 👇');
        await say(lines.join('\n'), { actions: [{ label: '💬 WhatsApp', kind: 'whatsapp' }, { label: '🏠 Menu', kind: 'menu' }] });
        return;
      }
      default:
        // Un nom de ville ecrit seul (« et a Sarh ? ») est une question de livraison, pas une recherche de produit.
        try {
          const city = matchCity(await getCities(), text);
          if (city && tokenize(text).length <= 2) {
            await answerCity(city.name);
            return;
          }
        } catch {
          // pas de villes : on cherche un produit
        }
        await searchReply(text);
    }
  }

  // Ce que dit le visiteur (ecrit, ou bouton qui parle a sa place).
  async function respondTo(raw: string, shown?: string) {
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) return;
    push({ id: newId(), role: 'user', text: shown ?? text });
    const step = get().step;
    if (step === 'ask_name') {
      const name = firstNameFrom(text);
      if (name) {
        await afterName(name);
        return;
      }
      setStep('menu'); // ce n'etait pas un prenom : on repond a ce qu'il a ecrit
    } else if (step === 'ask_city') {
      let cities: City[] | null = null;
      try {
        cities = await getCities();
      } catch {
        cities = null;
      }
      const intent = detectIntent(text);
      if (cities && matchCity(cities, text)) {
        await answerCity(text);
        return;
      }
      if (intent === 'search' || intent === 'delivery') {
        await answerCity(text); // ville inconnue : on propose la liste
        return;
      }
      setStep('menu');
    } else if (step === 'ask_budget') {
      const range = parseBudget(text);
      if (range) {
        await budgetReply(range);
        return;
      }
      setStep('menu');
    }
    await route(text);
  }

  async function handleChoice(action: ChatAction) {
    switch (action.kind) {
      case 'skip':
        push({ id: newId(), role: 'user', text: action.label });
        setStep('menu');
        await onboarding();
        return;
      case 'menu':
        await showMenu(withName('Que souhaitez-vous découvrir{nom} ? 🛍️'));
        return;
      case 'city':
        push({ id: newId(), role: 'user', text: action.label });
        await answerCity(action.payload ?? action.label);
        return;
      case 'need': {
        push({ id: newId(), role: 'user', text: action.label });
        setCtx({ kind: 'category', slug: action.payload ?? '' });
        await askBudget();
        return;
      }
      case 'budget': {
        push({ id: newId(), role: 'user', text: action.label });
        const range = decodeRange(action.payload);
        if (range) await budgetReply(range);
        return;
      }
      case 'gift':
        push({ id: newId(), role: 'user', text: action.label });
        await giftReply((action.payload as GiftTarget) ?? 'elle');
        return;
      case 'pair':
        push({ id: newId(), role: 'user', text: action.label });
        await pairReply(action.payload ?? '');
        return;
      case 'say':
        await respondTo(action.payload ?? action.label, action.label);
        return;
      default:
        return;
    }
  }

  return {
    open: false,
    messages: saved.messages,
    loading: false,
    step: saved.step,
    ctx: saved.ctx,
    name: null,
    teaserDismissed: false,
    openChat: () => {
      set({ open: true, teaserDismissed: true });
      if (get().messages.length === 0 && !get().loading) void run(begin);
    },
    closeChat: () => set({ open: false }),
    dismissTeaser: () => set({ teaserDismissed: true }),
    send: async (text) => {
      if (get().loading) return;
      await run(() => respondTo(text));
    },
    choose: async (action) => {
      if (get().loading) return;
      await run(() => handleChoice(action));
    },
    reset: () => {
      if (get().loading) return;
      save([], 'menu', null);
      set({ messages: [], step: 'menu', ctx: null });
      void run(begin);
    },
  };
});

// Le prenom retenu sur l'appareil sert aussi a la bulle de bienvenue du bouton : on le charge des le debut.
AsyncStorage.getItem(NAME_KEY)
  .then((value) => {
    const name = firstNameFrom(value ?? '');
    if (name && !useAssistantStore.getState().name) useAssistantStore.setState({ name });
  })
  .catch(() => {});
