import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_CITY } from '../constants/shopRules';
import {
  cityReply,
  detectIntent,
  firstNameFrom,
  firstNameOfFullName,
  isHomeCity,
  matchCity,
  newest,
  normalize,
  promotions,
  searchCatalog,
  tokenize,
  type CatalogProduct,
  type City,
} from '../lib/assistantBrain';
import { hasArabic, type Lang, type Who } from '../lib/assistantLang';
import { categoryLabel, fcfa, texts, withName as applyName, type Texts } from '../lib/assistantText';
import {
  ANY_BUDGET,
  aboutReply,
  alternativesFor,
  budgetOfRange,
  budgetOptions,
  candidatesFor,
  cartReminder,
  cheaperOptions,
  crossSellTarget,
  decodeRange,
  dominantSlug,
  encodeRange,
  formatPhone,
  giftWrapPitch,
  giftWrapReply,
  isBroad,
  laterReply,
  lowStockLine,
  maxDiscountPct,
  nextQuestion,
  parseBudget,
  parseNeed,
  pickInBudget,
  priceReply,
  productPitch,
  rangeOfNeed,
  returnsReply,
  stripBudget,
  trustReply,
  typeChoices,
  whyAdvice,
  whyReasons,
  type Context,
  type Need,
  type Parsed,
  type Range,
} from '../lib/assistantMarketing';
import { fetchCartStatus, fetchProductForCart, getCatalog, getCategories, getCities, getStoreInfo, toCard, type AssistantProduct } from '../lib/assistantData';
import {
  installNotReadyMessage,
  isAndroidDevice,
  isIosDevice,
  isPwaInstallPromptAvailable,
  isRunningAsInstalledPwa,
  triggerPwaInstallPrompt,
} from '../lib/pwaInstallPrompt';
import { isRunningInsideApp } from '../lib/runningInApp';
import type { Product } from '../types';
import { navigationRef } from '../navigation/navigationRef';
import { useAuthStore } from './authStore';
import { useCartStore } from './cartStore';
import { useInstallGuideStore } from './installGuideStore';

// Zara Kings, assistante marketing (sans IA) : elle suit un scénario et comprend des mots-clés, en français et en arabe.
// Comme une bonne vendeuse : elle comprend le besoin (UNE question à la fois), recommande avec des raisons vraies,
// propose ce qui se complète, puis guide vers la commande.
// La conversation est gardée dans l'onglet (sessionStorage), le prénom et la langue sur l'appareil.

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
    | 'policy'
    | 'lang'
    | 'who'
    | 'type'
    | 'budget'
    | 'pair'
    | 'size'
    | 'color'
    | 'add'
    | 'cancel'
    | 'checkout'
    | 'install'
    | 'installHelp'
    | 'iosGuide'
    | 'installLater';
  payload?: string;
  highlight?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  lang?: Lang; // langue du message de Zara (sens d'écriture) ; sans valeur : français
  cart?: boolean; // affiche le panier (en direct, le même que celui du site) sous le message
  products?: AssistantProduct[];
  actions?: ChatAction[];
}

export type Step = 'ask_lang' | 'ask_name' | 'menu' | 'ask_city' | 'ask_who' | 'ask_type' | 'ask_budget';

interface AssistantState {
  open: boolean;
  messages: ChatMessage[];
  loading: boolean;
  step: Step;
  // Ce dont on parle (produit cherché, catégorie, cadeau...) : sert à affiner par budget.
  ctx: Context | null;
  // Ce que veut le visiteur pendant que Zara pose ses questions (pour qui, quel article, quel budget).
  need: Need | null;
  lang: Lang;
  // Dernière ville dont le client a parlé : les frais de livraison ne sont affichés dans le panier que s'ils sont connus.
  deliveryCity: { name: string; fee: number | null } | null;
  name: string | null;
  teaserDismissed: boolean;
  openChat: () => void;
  closeChat: () => void;
  dismissTeaser: () => void;
  send: (text: string) => Promise<void>;
  choose: (action: ChatAction) => Promise<void>;
  toggleLang: () => void;
  // bouton « + » d'une fiche produit : ajoute au vrai panier du site sans fermer la conversation
  addToCart: (slug: string) => void;
  openCart: () => void;
  // vérifie le panier (prix, stock, compte) avant d'ouvrir la page de commande officielle
  prepareCheckout: () => Promise<'ok' | 'login' | 'empty' | 'issues'>;
  reset: () => void;
}

const STORAGE_KEY = 'albasse_zara_v1';
const NAME_KEY = 'albasse_zara_name';
const LANG_KEY = 'albasse_zara_lang';
const MAX_SAVED = 40;
const STEPS: Step[] = ['ask_lang', 'ask_name', 'menu', 'ask_city', 'ask_who', 'ask_type', 'ask_budget'];
const CTX_KINDS = ['query', 'category', 'gift', 'who', 'promo', 'new'];

interface Saved {
  messages: ChatMessage[];
  step: Step;
  ctx: Context | null;
  need: Need | null;
}

function load(): Saved {
  const empty: Saved = { messages: [], step: 'menu', ctx: null, need: null };
  if (Platform.OS !== 'web') return empty;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const messages = Array.isArray(parsed?.messages)
      ? (parsed.messages as ChatMessage[]).filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
      : [];
    const step: Step = STEPS.includes(parsed?.step) ? parsed.step : 'menu';
    const ctx: Context | null = parsed?.ctx && CTX_KINDS.includes(parsed.ctx.kind) ? parsed.ctx : null;
    const need: Need | null = parsed?.need && typeof parsed.need === 'object' ? parsed.need : null;
    return { messages, step, ctx, need };
  } catch {
    return empty;
  }
}

function save(messages: ChatMessage[], step: Step, ctx: Context | null, need: Need | null) {
  if (Platform.OS !== 'web') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-MAX_SAVED), step, ctx, need }));
  } catch {
    // ignore : la conversation ne sera simplement pas gardée
  }
}

// Langue déjà choisie par le visiteur : celle retenue sur l'appareil, ou l'arabe si le site est traduit en arabe.
function chosenLang(): Lang | null {
  if (Platform.OS !== 'web') return null;
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved === 'ar' || saved === 'fr') return saved;
    if (/(?:^|;\s*)googtrans=\/[a-z-]+\/ar/.test(document.cookie)) return 'ar';
  } catch {
    // ignore : pas de langue retenue
  }
  return null;
}

function saveLang(lang: Lang) {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore : la langue ne sera pas retenue
  }
}

// « arabe », « en français »... : le visiteur demande une langue (et seulement ça : « parfum arabe » reste une recherche).
const LANG_FILLER = new Set(['en', 'parler', 'parle', 'parlez', 'passer', 'passe', 'passez', 'je', 'veux', 'voudrais', 'la', 'le', 'langue', 'in', 'please', 'svp', 'stp', 'merci', 'speak', 'switch', 'to']);

function langRequest(text: string): Lang | null {
  const words = normalize(text)
    .split(' ')
    .filter((w) => w && !LANG_FILLER.has(w));
  if (words.length !== 1) return null;
  if (/^(arabe|arabic|عربي|العربيه|بالعربيه)$/.test(words[0])) return 'ar';
  if (/^(francais|french|فرنسي|الفرنسيه|بالفرنسيه|فرنسيه)$/.test(words[0])) return 'fr';
  return null;
}

// « je ne sais pas », « peu importe »...
const WORD_IDK = /ne sais pas|sais pas|peu importe|n importe|nimporte|aucune idee|لا اعرف|لا يهم|ما اعرف|ما ادري|مدري/;

let counter = 0;
const newId = () => `${Date.now()}-${counter++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Très courte pause avant chaque message (les trois points s'affichent) : elle ne grandit pas avec la longueur du texte.
const typingDelay = (text: string) => 250 + Math.min(text.length, 120) * 2;

// Ajouts au panier : un double clic ne compte qu'une fois, et les ajouts se font l'un après l'autre.
const DOUBLE_TAP_MS = 1200;
const lastAddAt = new Map<string, number>();
const pendingAdds = new Set<string>();
let addChain: Promise<void> = Promise.resolve();
interface PendingAdd {
  product: Product;
  size: string | null;
  color: string | null;
}
let pendingVariant: PendingAdd | null = null;

// Proposition d'installer le raccourci : une seule fois, puis pause de 14 jours.
const INSTALL_KEY = 'albasse_zara_install';
const INSTALL_PAUSE_MS = 14 * 24 * 3600 * 1000;

// Mots qui ne désignent pas un produit dans « ajoute aussi ce parfum ».
const ADD_NOISE = new Set([
  'ajoute', 'ajouter', 'ajoutez', 'rajoute', 'rajouter', 'mets', 'mettre', 'prends', 'prend', 'prendre', 'aussi', 'encore', 'panier',
  'celui', 'celle', 'ceci', 'cela', 'ci', 'la', 'article', 'svp', 'stp', 'اضف', 'اضيفي', 'ضيف', 'ضع', 'خذ', 'ايضا', 'كذلك',
]);
const ORDINALS: [RegExp, number][] = [
  [/\b(premier|premiere|1er)\b/, 0],
  [/\b(deuxieme|second|seconde|2eme)\b/, 1],
  [/\b(troisieme|3eme)\b/, 2],
  [/\b(quatrieme|4eme)\b/, 3],
  [/\b(dernier|derniere)\b/, -1],
];

const saved = load();

export const useAssistantStore = create<AssistantState>((set, get) => {
  const push = (message: ChatMessage) => {
    set((s) => {
      const messages = [...s.messages, message];
      save(messages, s.step, s.ctx, s.need);
      return { messages };
    });
  };
  const persist = () => save(get().messages, get().step, get().ctx, get().need);
  const setStep = (step: Step) => {
    set({ step });
    persist();
  };
  const setCtx = (ctx: Context | null) => {
    set({ ctx });
    persist();
  };
  const setNeed = (need: Need | null) => {
    set({ need });
    persist();
  };

  const T = (): Texts => texts(get().lang);
  // Le prénom n'est pas répété à chaque message : seulement s'il n'a pas été dit dans les derniers messages de Zara.
  const withName = (text: string) => {
    const name = get().name;
    const recent = name ? get().messages.filter((m) => m.role === 'assistant').slice(-6).some((m) => m.text.includes(name)) : false;
    return applyName(get().lang, text, recent ? null : name);
  };

  // Tout ce que Zara fait passe par run() : les trois points restent affichés du début à la fin,
  // et le visiteur ne peut pas écrire entre deux de ses messages.
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
        text: T().errorOops,
        lang: get().lang,
        actions: [{ label: T().chip.whatsapp, kind: 'whatsapp' }, { label: T().chip.menu, kind: 'menu' }],
      });
    } finally {
      depth--;
      if (depth === 0) set({ loading: false });
    }
  }

  async function say(text: string, extra: { products?: AssistantProduct[]; actions?: ChatAction[]; lang?: Lang; cart?: boolean; fast?: boolean } = {}) {
    const { lang, fast, ...rest } = extra;
    await sleep(fast ? 120 : typingDelay(text));
    push({ id: newId(), role: 'assistant', text, lang: lang ?? get().lang, ...rest });
  }

  const userSays = (text: string) => push({ id: newId(), role: 'user', text });

  // Ne pas répéter les mêmes arguments : une phrase déjà dite récemment n'est pas redite.
  const recentTexts = (n: number) =>
    get()
      .messages.filter((m) => m.role === 'assistant')
      .slice(-n)
      .map((m) => m.text);
  const freshLine = (lines: string[]) => {
    const recent = recentTexts(8).join('\n');
    const unused = lines.filter((l) => !recent.includes(l));
    const pool = unused.length ? unused : lines;
    return pool[get().messages.length % pool.length];
  };

  const isGuest = () => !useAuthStore.getState().isAuthenticated;
  const otherLang = (): Lang => (get().lang === 'fr' ? 'ar' : 'fr');

  const langAction = (): ChatAction => ({ label: T().chip.otherLang, kind: 'lang', payload: otherLang() });
  const wa = (): ChatAction => ({ label: T().chip.whatsapp, kind: 'whatsapp' });
  const menuBtn = (): ChatAction => ({ label: T().chip.menu, kind: 'menu' });
  const sayBtn = (label: string, payload: string): ChatAction => ({ label, kind: 'say', payload });

  const menuActions = (): ChatAction[] => {
    const c = T().chip;
    const actions: ChatAction[] = [];
    if (isGuest()) actions.push({ label: c.createAccount, kind: 'register', highlight: true });
    actions.push(sayBtn(c.promotions, 'promotions'), sayBtn(c.news, 'nouveautés'), sayBtn(c.advice, 'conseil'), sayBtn(c.categories, 'catégories'), sayBtn(c.delivery, 'livraison'));
    if (useCartStore.getState().items.length > 0) actions.push({ label: c.cart, kind: 'cart' });
    if (!isGuest()) actions.push({ label: c.orders, kind: 'orders' });
    actions.push(wa(), langAction());
    return actions;
  };

  const afterAnswerActions = (): ChatAction[] => [sayBtn(T().chip.promotions, 'promotions'), sayBtn(T().chip.categories, 'catégories'), menuBtn(), wa()];

  async function showMenu(intro: string) {
    setStep('menu');
    await say(intro, { actions: menuActions() });
  }

  async function accountInvitation() {
    // Seulement pour les visiteurs sans compte : les avantages d'un compte, avec le bouton pour le créer.
    setStep('menu');
    await say(withName(T().accountInvite), { actions: menuActions() });
  }

  // Si le visiteur regarde un produit, ou a un panier : Zara commence par là.
  async function contextMessages() {
    try {
      const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
      if (route?.name === 'Product') {
        const slug = (route.params as { slug?: string } | undefined)?.slug;
        if (slug) {
          const product = (await getCatalog()).find((p) => p.slug === slug);
          if (product && product.stock > 0) {
            await say(productPitch(product, get().lang));
            return;
          }
        }
      }
      const items = useCartStore.getState().items;
      if (items.length > 0) {
        const count = items.reduce((n, i) => n + i.quantity, 0);
        const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
        await say(cartReminder(count, total, get().lang));
      }
    } catch {
      // pas de message de contexte : on continue avec la suite
    }
  }

  // Après la présentation : le contexte (produit regardé, panier), les informations importantes,
  // puis l'invitation à créer un compte (visiteur) ou le menu (client connecté).
  async function onboarding() {
    await contextMessages();
    await say(T().info);
    if (isGuest()) await accountInvitation();
    else await showMenu(T().menuIntro);
  }

  // Après le bonjour : on demande le prénom (une seule fois), sinon on enchaîne.
  async function afterWelcome() {
    if (!get().name) {
      setStep('ask_name');
      await say(T().askName, { actions: [{ label: T().chip.skip, kind: 'skip' }, langAction()] });
      return;
    }
    await onboarding();
  }

  async function rememberedName(): Promise<string | null> {
    const fromProfile = firstNameOfFullName(useAuthStore.getState().profile?.full_name);
    if (fromProfile) return fromProfile;
    try {
      return firstNameFrom((await AsyncStorage.getItem(NAME_KEY)) ?? '');
    } catch {
      return null;
    }
  }

  async function begin() {
    const name = await rememberedName();
    set({ name });
    if (!chosenLang()) {
      // Première visite : le tout premier message de Zara demande la langue (français / arabe).
      setStep('ask_lang');
      await say(`${texts('fr').chooseLang} / ${texts('ar').chooseLang} 🌐`, {
        lang: 'fr',
        actions: [
          { label: 'Français', kind: 'lang', payload: 'fr' },
          { label: 'العربية', kind: 'lang', payload: 'ar' },
        ],
      });
      return;
    }
    // Message de bienvenue : seulement le nom et le rôle.
    await say(T().welcome(name));
    await afterWelcome();
  }

  async function afterName(name: string) {
    set({ name });
    try {
      await AsyncStorage.setItem(NAME_KEY, name);
    } catch {
      // ignore : le prénom ne sera pas retenu pour la prochaine visite
    }
    setStep('menu');
    await say(T().nice(name));
    await onboarding();
  }

  async function dataError() {
    await say(T().errorData, { actions: [wa(), menuBtn()] });
  }

  // -------------------------------------------------------------------------------------------
  // Produits : fiches, puis un conseil avec des raisons vraies et des boutons pour avancer
  // -------------------------------------------------------------------------------------------

  const whoOf = (ctx: Context | null): Who | undefined => (ctx && (ctx.kind === 'gift' || ctx.kind === 'who' || ctx.kind === 'category') ? ctx.who : undefined);

  // « Avec : ... » seulement si la plupart des produits montrés sont de la même catégorie.
  function pairFor(products: CatalogProduct[], catalog: CatalogProduct[]) {
    const slug = dominantSlug(products);
    if (!slug) return null;
    const same = products.filter((p) => p.categorySlug === slug).length;
    if (same < Math.ceil(products.length * 0.75)) return null;
    return crossSellTarget(catalog, slug, get().lang);
  }

  async function showProducts(
    intro: string,
    products: CatalogProduct[],
    ctx: Context | null,
    catalog: CatalogProduct[],
    opts: { range?: Range; cheapest?: boolean } = {}
  ) {
    setCtx(ctx);
    const lang = get().lang;
    await say(intro, { products: products.map(toCard) });
    const gift = ctx?.kind === 'gift';
    const pair = pairFor(products, catalog);
    const actions: ChatAction[] = [sayBtn(T().chip.budget, 'budget')];
    if (pair) actions.push({ label: T().chip.withCategory(pair.name), kind: 'pair', payload: `${pair.slug}|${whoOf(ctx) ?? ''}` });
    if (gift) actions.push(sayBtn(T().chip.wrap, 'emballage'));
    if (ctx?.kind !== 'promo') actions.push(sayBtn(T().chip.promotions, 'promotions'));
    actions.push(menuBtn(), wa());
    // Une raison vraie pour le premier produit (remise, stock, budget, couleurs, tailles), puis une seule phrase de plus :
    // l'emballage cadeau (une fois), la rareté vraie d'un autre produit, ou un encouragement différent des précédents.
    const range = opts.range ?? ANY_BUDGET;
    const first = products[0];
    const lines: string[] = [];
    if (first) {
      const reasons = whyReasons(first, range, lang, !!opts.cheapest);
      if (!(reasons.length === 1 && reasons[0] === T().why.inStock)) lines.push(withName(whyAdvice(first, range, lang, !!opts.cheapest)));
    }
    const wrap = giftWrapPitch(lang);
    if (gift && !recentTexts(12).some((t) => t.includes(wrap))) lines.push(wrap);
    else lines.push(lowStockLine(products.slice(1), lang) ?? freshLine(T().encouragements));
    // une seule fois : le bouton + des fiches produits
    if (!get().messages.some((m) => m.role === 'assistant' && m.text.includes(T().cart.tapPlus))) lines.push(T().cart.tapPlus);
    await say(lines.join('\n'), { actions });
  }

  async function promoReply() {
    try {
      const catalog = await getCatalog();
      const promos = promotions(catalog, 4);
      if (promos.length > 0) {
        await showProducts(withName(T().promoIntro(maxDiscountPct(catalog))), promos, { kind: 'promo' }, catalog);
      } else {
        await say(T().noPromo, { actions: [sayBtn(T().chip.news, 'nouveautés'), menuBtn()] });
      }
    } catch {
      await dataError();
    }
  }

  async function newReply() {
    try {
      const catalog = await getCatalog();
      await showProducts(withName(T().newIntro), newest(catalog, 4), { kind: 'new' }, catalog);
    } catch {
      await dataError();
    }
  }

  async function categoriesReply() {
    try {
      const cats = await getCategories();
      await say(T().chooseCategory, {
        actions: cats.map((c) => ({ label: categoryLabel(get().lang, c.slug, c.name), kind: 'category' as const, payload: c.slug })),
      });
    } catch {
      await dataError();
    }
  }

  // Demande précise (« rolex », « chaussures noires moins de 20000 ») : on montre tout de suite.
  // Le budget écrit dans la phrase est pris en compte ; l'arabe est ramené au français pour chercher.
  async function searchReply(text: string, parsed: Parsed = parseNeed(text)) {
    try {
      const catalog = await getCatalog();
      const range = parseBudget(text);
      const hasWords = tokenize(parsed.query).length > 0;
      if (range && !hasWords) {
        // un montant seul (« 20000 ») : c'est le budget de ce dont on parle, ou on demande ce que cherche le visiteur
        if (get().ctx) await budgetReply(range);
        else await startNeed({ lang: get().lang, gift: false, rest: [], query: '' }, range);
        return;
      }
      const shown = hasWords ? stripBudget(text) : text;
      const ctx: Context = { kind: 'query', query: hasWords ? parsed.query : text };
      if (range) {
        const { items, fallback } = pickInBudget(catalog, ctx, range, 4);
        if (items.length > 0) {
          const rt = T().rangeText(range);
          await showProducts(withName(fallback ? T().fallbackFor(shown, rt) : T().foundFor(shown, rt)), items, ctx, catalog, { range });
          return;
        }
      } else {
        const results = searchCatalog(catalog, ctx.query, 4);
        if (results.length > 0) {
          await showProducts(withName(T().foundFor(shown, null)), results, ctx, catalog);
          return;
        }
      }
      await say(T().nothingFor(text), { actions: [sayBtn(T().chip.advice, 'conseil'), sayBtn(T().chip.categories, 'catégories'), sayBtn(T().chip.promotions, 'promotions'), wa()] });
    } catch {
      await dataError();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Conseil : pour qui ? quel article ? quel budget ? -> meilleurs choix ; cadeaux ; produits qui se complètent
  // Une seule question à la fois, jamais la même deux fois.
  // -------------------------------------------------------------------------------------------

  async function startNeed(parsed: Parsed, budget?: Range | null) {
    setNeed({ gift: parsed.gift, who: parsed.who, slug: parsed.slug, budget: budget ? budgetOfRange(budget) : null });
    await continueNeed();
  }

  async function continueNeed() {
    const need = get().need;
    if (!need) return;
    switch (nextQuestion(need)) {
      case 'who':
        await askWho(need);
        return;
      case 'type':
        await askType(need);
        return;
      case 'budget':
        await askBudgetQuestion();
        return;
      default:
        await recommend(need);
    }
  }

  async function askWho(need: Need) {
    setStep('ask_who');
    const chips = need.gift ? T().chip.giftWho : T().chip.shopWho;
    const order: Who[] = need.gift ? ['elle', 'lui', 'enfant'] : ['lui', 'elle', 'enfant'];
    await say(withName(T().askWho(need.gift)), { actions: order.map((w) => ({ label: chips[w], kind: 'who' as const, payload: w })) });
  }

  async function askType(need: Need) {
    setStep('ask_type');
    try {
      const catalog = await getCatalog();
      const choices = typeChoices(catalog, need.who, need.gift, get().lang);
      const actions: ChatAction[] = choices.map((c) => ({ label: c.name, kind: 'type' as const, payload: c.slug }));
      if (need.who) actions.push({ label: T().chip.idk, kind: 'type', payload: '' });
      else actions.push(sayBtn(T().chip.giftIdea, 'idée cadeau'));
      await say(withName(need.who ? T().askType(need.who, need.gift) : T().askNeed), { actions });
    } catch {
      setNeed(null);
      setStep('menu');
      await dataError();
    }
  }

  // Question du budget (pendant les questions) ou pour affiner ce qu'on vient de montrer.
  async function askBudgetQuestion() {
    setStep('ask_budget');
    await say(withName(T().askBudget), {
      actions: [
        ...budgetOptions(get().lang).map((b) => ({ label: b.label, kind: 'budget' as const, payload: encodeRange(b.range) })),
        { label: T().chip.anyBudget, kind: 'budget', payload: encodeRange(ANY_BUDGET) },
      ],
    });
  }

  async function askBudget() {
    if (!get().ctx && !get().need) {
      await startNeed({ lang: get().lang, gift: false, rest: [], query: '' });
      return;
    }
    await askBudgetQuestion();
  }

  const contextOfNeed = (need: Need): Context | null => {
    if (need.gift) return { kind: 'gift', who: need.who ?? 'elle', slug: need.slug };
    if (need.slug) return { kind: 'category', slug: need.slug, who: need.who };
    if (need.who) return { kind: 'who', who: need.who };
    return null;
  };

  async function recommend(need: Need) {
    setStep('menu');
    try {
      const catalog = await getCatalog();
      const range = rangeOfNeed(need);
      const ctx = contextOfNeed(need);
      const { items, fallback } = pickInBudget(catalog, ctx, range, 4);
      setNeed(null);
      if (items.length === 0) {
        await say(T().budgetNothing, { actions: [sayBtn(T().chip.advice, 'conseil'), sayBtn(T().chip.promotions, 'promotions'), wa()] });
        return;
      }
      const any = range.min <= 0 && !Number.isFinite(range.max);
      const rt = T().rangeText(range);
      const intro = fallback ? T().budgetFallback(rt) : need.gift ? T().giftIntro(need.who ?? 'elle') : any ? T().bestPicks : T().budgetBest(rt);
      await showProducts(withName(intro), items, ctx, catalog, { range });
    } catch {
      setNeed(null);
      await dataError();
    }
  }

  // Affiner ce qu'on vient de montrer avec un budget (bouton « Mon budget » après les produits).
  async function budgetReply(range: Range) {
    setStep('menu');
    try {
      const catalog = await getCatalog();
      const ctx = get().ctx;
      const { items, fallback } = pickInBudget(catalog, ctx, range, 4);
      if (items.length === 0) {
        await say(T().budgetNothing, { actions: [sayBtn(T().chip.advice, 'conseil'), sayBtn(T().chip.promotions, 'promotions'), wa()] });
        return;
      }
      const any = range.min <= 0 && !Number.isFinite(range.max);
      const rt = T().rangeText(range);
      await showProducts(withName(fallback ? T().budgetFallback(rt) : any ? T().bestPicks : T().budgetBest(rt)), items, ctx, catalog, { range });
    } catch {
      await dataError();
    }
  }

  // Le visiteur donne son budget : réponse à la question en cours, ou affinage de ce qu'on vient de montrer.
  async function handleBudget(range: Range) {
    const need = get().need;
    if (need && nextQuestion(need) === 'budget') {
      setNeed({ ...need, budget: budgetOfRange(range) });
      await continueNeed();
      return;
    }
    if (need) setNeed(null); // une ancienne question restée sans réponse : on l'abandonne
    await budgetReply(range);
  }

  async function pairReply(payload: string) {
    try {
      const [slug, whoRaw] = payload.split('|');
      const who: Who | undefined = whoRaw === 'lui' || whoRaw === 'elle' || whoRaw === 'enfant' ? whoRaw : undefined;
      const catalog = await getCatalog();
      const ctx: Context = { kind: 'category', slug, who };
      const items = candidatesFor(catalog, ctx).slice(0, 4);
      if (items.length === 0) {
        await dataError();
        return;
      }
      const name = categoryLabel(get().lang, slug, items[0].category);
      await showProducts(withName(T().pairIntro(get().lang === 'ar' ? name : name.toLowerCase())), items, ctx, catalog);
    } catch {
      await dataError();
    }
  }

  // « C'est cher » : si on vient de montrer des produits, des alternatives moins chères quand il y en a.
  async function priceObjection() {
    const lastShown = [...get().messages].reverse().find((m) => m.role === 'assistant' && m.products && m.products.length > 0);
    const actions = () => [sayBtn(T().chip.promotions, 'promotions'), sayBtn(T().chip.budget, 'budget'), wa()];
    try {
      const catalog = await getCatalog();
      if (lastShown?.products) {
        const alts = cheaperOptions(catalog, get().ctx, lastShown.products.map((p) => p.price), 3);
        if (alts.length > 0) {
          await showProducts(withName(T().cheaperIntro), alts, get().ctx, catalog, { cheapest: true });
          return;
        }
        await say(T().noCheaper, { actions: actions() });
        return;
      }
      await say(priceReply(maxDiscountPct(catalog), get().lang), { actions: actions() });
    } catch {
      await say(priceReply(null, get().lang), { actions: actions() });
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
    await say(T().askCity, { actions: popular.map((name) => ({ label: name, kind: 'city' as const, payload: name })) });
  }

  async function answerCity(cityName: string) {
    const lang = get().lang;
    // Les horaires et les 48 h ne sont pas redits juste après les avoir dits.
    const sayReply = async (reply: string, home: boolean, actions: ChatAction[]) => {
      const note = T().serviceNote(home);
      const repeated = recentTexts(6).includes(note);
      await say(reply, repeated ? { actions } : {});
      if (!repeated) await say(note, { actions });
    };
    try {
      const cities = await getCities();
      const city = matchCity(cities, cityName);
      if (!city) {
        const list = cities.slice(0, 10).map((c) => c.name);
        await say(T().cityNotFound(cityName), { actions: [...list.map((name) => ({ label: name, kind: 'city' as const, payload: name })), wa()] });
        return;
      }
      setStep('menu');
      const home = isHomeCity(city.name);
      set({ deliveryCity: { name: city.name, fee: home ? 0 : city.fee } });
      await sayReply(cityReply(city, lang), home, home ? afterAnswerActions() : [wa(), ...afterAnswerActions().filter((a) => a.kind !== 'whatsapp')]);
    } catch {
      // Base injoignable : N'Djamena (livraison gratuite, paiement à la livraison) ne dépend pas de la base.
      if (isHomeCity(cityName) || /djamena|ndjam/.test(normalize(cityName).replace(/ /g, ''))) {
        setStep('menu');
        set({ deliveryCity: { name: HOME_CITY, fee: 0 } });
        await sayReply(cityReply({ name: HOME_CITY, fee: 0, agency: null }, lang), true, afterAnswerActions());
        return;
      }
      await dataError();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Langue
  // -------------------------------------------------------------------------------------------

  async function switchLang(next: Lang) {
    set({ lang: next });
    saveLang(next);
    const step = get().step;
    if (step === 'ask_lang') {
      // premier choix de langue : Zara se présente dans cette langue
      setStep('menu');
      await say(T().welcome(get().name));
      await afterWelcome();
      return;
    }
    await say(T().langSwitched);
    // la question en cours est reposée dans la nouvelle langue
    if (step === 'ask_name') {
      await say(T().askName, { actions: [{ label: T().chip.skip, kind: 'skip' }, langAction()] });
      return;
    }
    if (step === 'ask_city') {
      await askCity();
      return;
    }
    if (step === 'ask_budget') {
      await askBudgetQuestion();
      return;
    }
    if ((step === 'ask_who' || step === 'ask_type') && get().need) {
      await continueNeed();
      return;
    }
    await showMenu(withName(T().menuIntroNamed));
  }

  // -------------------------------------------------------------------------------------------
  // Panier dans la conversation : ajouter (bouton +), choisir la taille / la couleur, voir, commander.
  // C'est le panier du site (même magasin de données) : il reste identique partout. Le prix, le stock et les
  // variantes sont relus dans la base au moment de l'ajout ; la commande passe par la page officielle.
  // -------------------------------------------------------------------------------------------

  const shortName = (name: string) => (name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name);
  const variantText = (size: string | null, color: string | null) => {
    const parts = [size ? T().cart.sizeLabel(size) : null, color].filter(Boolean);
    return parts.length ? ` (${parts.join(' · ')})` : '';
  };
  const cartTotals = () => {
    const items = useCartStore.getState().items;
    return { count: items.reduce((n, i) => n + i.quantity, 0), total: items.reduce((sum, i) => sum + i.product.price * i.quantity, 0) };
  };
  const checkoutChip = (): ChatAction => ({ label: T().chip.checkout, kind: 'checkout', highlight: true });
  const cartActions = (): ChatAction[] => [{ label: T().chip.viewCart, kind: 'cart' }, checkoutChip(), sayBtn(T().chip.moreItems, 'conseil')];

  // Compare le panier à la base : prix mis à jour, produit épuisé ou retiré, quantité au-dessus du stock.
  async function verifyCart(): Promise<{ notes: string[]; blocked: boolean; checked: boolean }> {
    const items = useCartStore.getState().items;
    const ids = [...new Set(items.map((i) => i.product.id))];
    if (ids.length === 0) return { notes: [], blocked: false, checked: true };
    let rows: Awaited<ReturnType<typeof fetchCartStatus>>;
    try {
      rows = await fetchCartStatus(ids);
    } catch {
      return { notes: [], blocked: false, checked: false }; // pas de vérification possible : on ne dit pas que les prix sont vérifiés
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const qtyOf = (id: string) => items.filter((i) => i.product.id === id).reduce((n, i) => n + i.quantity, 0);
    const notes: string[] = [];
    const noted = new Set<string>();
    let blocked = false;
    let changed = false;
    const updated = items.map((i) => {
      const r = byId.get(i.product.id);
      const name = shortName(i.product.name);
      const stop = (stock: number) => {
        blocked = true;
        if (!noted.has(`b${i.product.id}`)) {
          noted.add(`b${i.product.id}`);
          notes.push(T().cart.blocked(name, stock));
        }
      };
      if (!r || !r.is_active) {
        stop(0);
        return i;
      }
      if (r.price !== i.product.price && !noted.has(`p${i.product.id}`)) {
        noted.add(`p${i.product.id}`);
        notes.push(T().cart.priceChanged(name, fcfa(i.product.price), fcfa(r.price)));
      }
      if (r.stock <= 0 || qtyOf(i.product.id) > r.stock) stop(Math.max(0, r.stock));
      if (r.price !== i.product.price || r.stock !== i.product.stock || r.compare_at_price !== i.product.compare_at_price) {
        changed = true;
        return { ...i, product: { ...i.product, price: r.price, compare_at_price: r.compare_at_price, stock: r.stock } };
      }
      return i;
    });
    if (changed) useCartStore.setState({ items: updated });
    return { notes, blocked, checked: true };
  }

  async function showCart() {
    if (useCartStore.getState().items.length === 0) {
      await say(T().cart.empty, { fast: true, actions: [sayBtn(T().chip.advice, 'conseil'), sayBtn(T().chip.promotions, 'promotions'), menuBtn()] });
      return;
    }
    const check = await verifyCart();
    const lines = [T().cart.show, ...check.notes];
    if (check.checked) lines.push(T().cart.verified);
    await say(lines.join('\n'), { fast: true, cart: true, actions: [checkoutChip(), sayBtn(T().chip.moreItems, 'conseil'), menuBtn()] });
  }

  // « Je veux commander » avec un panier plein : Zara guide vers la page de commande officielle.
  async function checkoutGuide() {
    const check = await verifyCart();
    await say([T().cart.checkoutGuide, ...check.notes].join('\n'), { fast: true, cart: true, actions: [checkoutChip(), sayBtn(T().chip.moreItems, 'conseil'), menuBtn()] });
  }

  async function checkoutCheck(): Promise<'ok' | 'login' | 'empty' | 'issues'> {
    if (useCartStore.getState().items.length === 0) {
      await say(T().cart.empty, { fast: true, actions: [sayBtn(T().chip.advice, 'conseil'), sayBtn(T().chip.promotions, 'promotions'), menuBtn()] });
      return 'empty';
    }
    // comme sur la page du panier : il faut un compte pour passer commande (le panier est gardé)
    if (!useAuthStore.getState().profile) {
      await say(T().cart.needLogin, { fast: true, actions: [{ label: T().chip.createAccount, kind: 'register', highlight: true }, { label: T().chip.login, kind: 'login' }, menuBtn()] });
      return 'login';
    }
    const check = await verifyCart();
    if (check.notes.length > 0 || check.blocked) {
      await say([T().cart.show, ...check.notes].join('\n'), { fast: true, cart: true, actions: [checkoutChip(), menuBtn()] });
      return 'issues';
    }
    return 'ok';
  }

  async function unavailable(slug: string, name?: string) {
    let catalog: CatalogProduct[] = [];
    try {
      catalog = await getCatalog();
    } catch {
      // sans alternatives
    }
    const label = shortName(name ?? catalog.find((p) => p.slug === slug)?.name ?? slug);
    const alts = alternativesFor(catalog, slug, 3);
    await say(T().cart.unavailable(label), alts.length ? { fast: true } : { fast: true, actions: [sayBtn(T().chip.advice, 'conseil'), menuBtn()] });
    if (alts.length > 0) await say(T().cart.unavailableAlt, { products: alts.map(toCard), actions: [menuBtn(), wa()] });
  }

  async function finishAdd(p: PendingAdd) {
    const { product, size, color } = p;
    const name = shortName(product.name);
    const cart = useCartStore.getState();
    const already = cart.items.filter((i) => i.product.id === product.id).reduce((n, i) => n + i.quantity, 0);
    if (already + 1 > product.stock) {
      await say(T().cart.noMoreStock(name, product.stock), { fast: true, actions: cartActions() });
      return;
    }
    cart.addItem(product, 1, color, size);
    const { count, total } = cartTotals();
    await say(T().cart.added(name, variantText(size, color), count, total), { fast: true, actions: cartActions() });
    await maybeOfferInstall(cartActions());
  }

  // Taille et couleur : demandées seulement s'il y a un vrai choix (une seule option = choisie d'office).
  async function continueAdd(p: PendingAdd) {
    const { product } = p;
    const name = shortName(product.name);
    if (!p.size && product.sizes.length > 0) {
      if (product.sizes.length === 1) p.size = product.sizes[0];
      else {
        pendingVariant = p;
        await say(T().cart.askSize(name), {
          fast: true,
          actions: [...product.sizes.slice(0, 14).map((sz) => ({ label: T().cart.sizeLabel(sz), kind: 'size' as const, payload: sz })), { label: T().chip.cancel, kind: 'cancel' as const }],
        });
        return;
      }
    }
    if (!p.color && product.colors.length > 0) {
      if (product.colors.length === 1) p.color = product.colors[0];
      else {
        pendingVariant = p;
        await say(T().cart.askColor(name), {
          fast: true,
          actions: [...product.colors.slice(0, 12).map((c) => ({ label: c, kind: 'color' as const, payload: c })), { label: T().chip.cancel, kind: 'cancel' as const }],
        });
        return;
      }
    }
    pendingVariant = null;
    await finishAdd(p);
  }

  async function addFlow(slug: string) {
    let product: Product | null = null;
    try {
      product = await fetchProductForCart(slug);
    } catch {
      await say(T().cart.addError, { fast: true, actions: [menuBtn(), wa()] });
      return;
    }
    if (!product || product.stock <= 0) {
      await unavailable(slug, product?.name);
      return;
    }
    await continueAdd({ product, size: null, color: null });
  }

  function enqueueAdd(slug: string) {
    if (!slug) return;
    const now = Date.now();
    if (pendingAdds.has(slug) || now - (lastAddAt.get(slug) ?? 0) < DOUBLE_TAP_MS) return; // double clic : un seul ajout
    lastAddAt.set(slug, now);
    pendingAdds.add(slug);
    addChain = addChain
      .then(() => addFlow(slug))
      .catch(() => undefined)
      .then(() => {
        pendingAdds.delete(slug);
      });
  }

  // « Ajoute aussi ce parfum » : on ajoute seulement si le produit est clair parmi ceux qu'on vient de montrer.
  async function addByText(text: string) {
    const shown = [...get().messages].reverse().find((m) => m.role === 'assistant' && m.products && m.products.length > 0)?.products ?? [];
    const catalog = await getCatalog().catch(() => [] as CatalogProduct[]);
    const words = tokenize(parseNeed(text).query).filter((w) => !ADD_NOISE.has(w));
    const norm = normalize(text);
    let picks: AssistantProduct[] = [];
    if (shown.length > 0) {
      const ord = ORDINALS.find(([re]) => re.test(norm));
      if (ord) {
        const one = ord[1] === -1 ? shown[shown.length - 1] : shown[ord[1]];
        if (one) picks = [one];
      } else if (words.length === 0) {
        picks = shown; // « ajoute-le »
      } else {
        const scored = shown
          .map((p) => {
            const c = catalog.find((x) => x.slug === p.slug);
            const fields = c ? [...c.nameTokens, ...c.catTokens] : tokenize(p.name);
            const score = words.filter((w) => fields.some((f) => f === w || (w.length >= 4 && (f.startsWith(w) || w.startsWith(f))))).length;
            return { p, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);
        if (scored.length > 0) picks = scored.filter((x) => x.score === scored[0].score).map((x) => x.p);
      }
    }
    if (picks.length === 1) {
      enqueueAdd(picks[0].slug);
      return;
    }
    if (picks.length > 1) {
      await say(T().cart.askWhich, {
        fast: true,
        actions: [...picks.slice(0, 4).map((p) => ({ label: shortName(p.name), kind: 'add' as const, payload: p.slug })), menuBtn()],
      });
      return;
    }
    // rien de précis dans ce qu'on vient de montrer : on cherche, sans rien ajouter au hasard
    if (words.length > 0) {
      const found = searchCatalog(catalog, words.join(' '), 3);
      if (found.length > 0) {
        await say(T().cart.foundToAdd, { products: found.map(toCard), actions: [menuBtn(), wa()] });
        return;
      }
    }
    await say(T().cart.addWhat, { actions: [sayBtn(T().chip.advice, 'conseil'), sayBtn(T().chip.promotions, 'promotions'), menuBtn()] });
  }

  // -------------------------------------------------------------------------------------------
  // Installer le raccourci (PWA) : proposé au bon moment, une seule fois, jamais imposé
  // -------------------------------------------------------------------------------------------

  function recordInstall(outcome: 'asked' | 'accepted' | 'dismissed') {
    if (Platform.OS !== 'web') return;
    try {
      window.localStorage.setItem(INSTALL_KEY, JSON.stringify({ at: Date.now(), outcome }));
    } catch {
      // ignore : la proposition pourra revenir
    }
  }
  function installPaused(): boolean {
    try {
      const raw = window.localStorage.getItem(INSTALL_KEY);
      return raw ? Date.now() - Number(JSON.parse(raw).at) < INSTALL_PAUSE_MS : false;
    } catch {
      return false;
    }
  }
  const alreadyInstalled = () => isRunningAsInstalledPwa() || isRunningInsideApp();
  // L'installation d'iPhone ne marche que depuis Safari (pas depuis Chrome, Facebook, Instagram...).
  const isSafariIos = () => !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
  const installChips = (ios: boolean): ChatAction[] => [
    ios ? { label: T().chip.installHelp, kind: 'installHelp', highlight: true } : { label: T().chip.installApp, kind: 'install', highlight: true },
    { label: T().chip.notNow, kind: 'installLater' },
  ];

  // `extra` : les boutons déjà affichés (ex. ceux du panier) restent disponibles sous la proposition.
  async function maybeOfferInstall(extra: ChatAction[] = []) {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (alreadyInstalled() || installPaused()) return;
    const ios = isIosDevice();
    // iPhone : l'aide pas à pas ; Android : le bouton seulement quand Chrome permet réellement l'installation
    if (!ios && !(isAndroidDevice() && isPwaInstallPromptAvailable())) return;
    recordInstall('asked'); // on ne le redit pas, même si le client l'ignore
    await say(T().install.offer, { actions: [...extra, ...installChips(ios)] });
  }

  // Le visiteur le demande lui-même (« comment installer l'application ? ») : réponse tout de suite.
  async function installReply() {
    if (alreadyInstalled()) {
      await say(T().install.already, { actions: afterAnswerActions() });
      return;
    }
    if (isIosDevice()) {
      await installSteps();
      return;
    }
    if (isAndroidDevice()) {
      if (isPwaInstallPromptAvailable()) await say(T().install.offer, { actions: installChips(false) });
      else await say(T().install.androidManual, { actions: afterAnswerActions() });
      return;
    }
    await say(T().install.desktop, { actions: afterAnswerActions() });
  }

  async function installSteps() {
    await say(T().install.iosSteps(isSafariIos()), { actions: [{ label: T().chip.tutorial, kind: 'iosGuide' }, menuBtn()] });
  }

  // Appelée directement par le toucher du client : la boîte d'installation de Chrome n'apparaît qu'après un geste volontaire.
  async function installNow() {
    userSays(T().chip.installApp);
    const outcome = await triggerPwaInstallPrompt();
    if (outcome === 'accepted') {
      recordInstall('accepted');
      await say(T().install.accepted, { fast: true });
      return;
    }
    if (outcome === 'dismissed') {
      recordInstall('dismissed');
      await say(T().install.declined, { fast: true });
      return;
    }
    await say(get().lang === 'ar' ? T().install.androidManual : installNotReadyMessage(), { fast: true });
  }

  // -------------------------------------------------------------------------------------------
  // Aiguillage
  // -------------------------------------------------------------------------------------------

  async function route(text: string) {
    const intent = detectIntent(text);
    const t = T();
    switch (intent) {
      case 'bot':
        await say(t.bot, { actions: [wa(), menuBtn()] });
        return;
      case 'thanks':
        await say(withName(t.thanks), { actions: afterAnswerActions() });
        return;
      case 'greeting':
        await showMenu(withName(t.greeting));
        return;
      case 'account':
        if (isGuest()) {
          await say(t.accountExplain, { actions: [{ label: t.chip.createAccount, kind: 'register', highlight: true }, { label: t.chip.login, kind: 'login' }, menuBtn()] });
        } else {
          await say(withName(t.alreadyMember), { actions: [{ label: t.chip.orders, kind: 'orders' }, menuBtn()] });
        }
        return;
      case 'orders':
        await say(t.ordersLink, {
          actions: isGuest() ? [{ label: t.chip.login, kind: 'login' }, { label: t.chip.createAccount, kind: 'register' }] : [{ label: t.chip.orders, kind: 'orders' }, menuBtn()],
        });
        return;
      case 'rules':
        await say(t.rules, { actions: afterAnswerActions() });
        return;
      case 'info':
        await say(t.info, { actions: afterAnswerActions() });
        return;
      case 'returns':
        await say(returnsReply(get().lang), { actions: [{ label: t.chip.policy, kind: 'policy' }, wa(), menuBtn()] });
        return;
      case 'about':
        await say(aboutReply(get().lang), { actions: afterAnswerActions() });
        return;
      case 'delivery': {
        let cities: City[] | null = null;
        try {
          cities = await getCities();
        } catch {
          cities = null; // on demande la ville quand même
        }
        const city = cities ? matchCity(cities, text) : null;
        if (city) {
          await answerCity(city.name);
          return;
        }
        await askCity(cities);
        return;
      }
      case 'install':
        await installReply();
        return;
      case 'cart':
        await showCart();
        return;
      case 'add':
        await addByText(text);
        return;
      case 'promo':
        await promoReply();
        return;
      case 'new':
        await newReply();
        return;
      case 'categories':
        await categoriesReply();
        return;
      case 'advice': {
        // « conseille-moi un parfum pour homme » : on garde ce qu'il a déjà dit et on ne pose que les questions qui manquent
        const parsed = parseNeed(text);
        if (parsed.rest.length > 0) {
          await searchReply(text, parsed);
          return;
        }
        await startNeed(parsed, parseBudget(text));
        return;
      }
      case 'gift': {
        const parsed = parseNeed(text);
        if (parsed.rest.length > 0) {
          await searchReply(text, parsed); // « cadeau rolex » : un produit précis
          return;
        }
        await startNeed({ ...parsed, gift: true }, parseBudget(text));
        return;
      }
      case 'wrap':
        await say(giftWrapReply(get().lang), {
          actions: [
            sayBtn(t.chip.giftIdea, 'idée cadeau'),
            isGuest() ? { label: t.chip.createAccount, kind: 'register' } : { label: t.chip.orders, kind: 'orders' },
            wa(),
          ],
        });
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
      case 'price':
        await priceObjection();
        return;
      case 'trust': {
        let info = { address: null as string | null, city: null as string | null, phone: null as string | null, mapsUrl: null as string | null };
        try {
          info = await getStoreInfo();
        } catch {
          // message de confiance sans l'adresse
        }
        const actions: ChatAction[] = [];
        if (info.mapsUrl) actions.push({ label: t.chip.seeShop, kind: 'link', payload: info.mapsUrl });
        actions.push(sayBtn(t.chip.promotions, 'promotions'), wa());
        await say(trustReply(info, get().lang), { actions });
        return;
      }
      case 'later':
        await say(withName(laterReply(get().lang)), {
          actions: isGuest()
            ? [{ label: t.chip.createAccount, kind: 'register', highlight: true }, sayBtn(t.chip.promotions, 'promotions'), menuBtn()]
            : [sayBtn(t.chip.promotions, 'promotions'), menuBtn()],
        });
        return;
      case 'order': {
        // « Je veux commander » avec un panier plein : on guide vers la commande ; « comment commander ? » : l'explication
        if (!/comment|كيف/.test(normalize(text)) && useCartStore.getState().items.length > 0) {
          await checkoutGuide();
          return;
        }
        await say(t.howToOrder, { actions: [sayBtn(t.chip.promotions, 'promotions'), sayBtn(t.chip.delivery, 'livraison'), wa()] });
        return;
      }
      case 'contact': {
        const lines: string[] = [];
        try {
          const info = await getStoreInfo();
          const where = [info.address, info.city].filter(Boolean).join(', ');
          if (where) lines.push(`📍 ${where}`);
          if (info.hours) lines.push(t.contact.hours(info.hours));
          const phone = formatPhone(info.phone);
          if (phone) lines.push(`📞 ${phone}`);
        } catch {
          // on garde les horaires de livraison et WhatsApp
        }
        lines.splice(Math.min(lines.length, 2), 0, t.contact.delivery);
        lines.push(t.contact.ask);
        await say(lines.join('\n'), { actions: [wa(), menuBtn()] });
        return;
      }
      default: {
        // Un nom de ville écrit seul (« et à Sarh ? ») est une question de livraison, pas une recherche de produit.
        try {
          const city = matchCity(await getCities(), text);
          if (city && tokenize(text).length <= 2) {
            await answerCity(city.name);
            return;
          }
        } catch {
          // pas de villes : on cherche un produit
        }
        // Demande large (« chaussures », « pour homme ») : on pose les questions avant de montrer.
        // Demande précise (« rolex ») : on montre tout de suite.
        const parsed = parseNeed(text);
        if (isBroad(parsed)) {
          await startNeed(parsed, parseBudget(text));
          return;
        }
        await searchReply(text, parsed);
      }
    }
  }

  // Ce que dit le visiteur (écrit, ou bouton qui parle à sa place).
  async function respondTo(raw: string, shown?: string) {
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) return;
    if (!shown) {
      // il demande une langue, ou il écrit en arabe : Zara passe à l'arabe
      const wanted = langRequest(text);
      if (wanted) {
        userSays(text);
        await switchLang(wanted);
        return;
      }
      if (hasArabic(text) && get().lang !== 'ar') {
        set({ lang: 'ar' });
        saveLang('ar');
      }
    }
    userSays(shown ?? text);
    const step = get().step;
    const need = get().need;
    if (step === 'ask_lang') {
      // il écrit au lieu de toucher un bouton : l'arabe s'il écrit en arabe, sinon le français ; on répond à ce qu'il a écrit
      const lang: Lang = hasArabic(text) ? 'ar' : 'fr';
      set({ lang });
      saveLang(lang);
      setStep('menu');
    } else if (step === 'ask_name') {
      const name = firstNameFrom(text);
      if (name) {
        await afterName(name);
        return;
      }
      setStep('menu'); // ce n'était pas un prénom : on répond à ce qu'il a écrit
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
        await handleBudget(range);
        return;
      }
      if (WORD_IDK.test(normalize(text))) {
        await handleBudget(ANY_BUDGET);
        return;
      }
      setStep('menu');
      setNeed(null);
    } else if (step === 'ask_who' && need) {
      const parsed = parseNeed(text);
      if (parsed.who && parsed.rest.length === 0) {
        setNeed({ ...need, who: parsed.who, slug: need.slug ?? parsed.slug });
        await continueNeed();
        return;
      }
      setStep('menu');
      setNeed(null);
    } else if (step === 'ask_type' && need) {
      const parsed = parseNeed(text);
      if ((parsed.slug || parsed.who) && parsed.rest.length === 0) {
        setNeed({ ...need, who: need.who ?? parsed.who, slug: parsed.slug ?? need.slug, typeAsked: true });
        await continueNeed();
        return;
      }
      if (WORD_IDK.test(normalize(text))) {
        setNeed({ ...need, typeAsked: true });
        await continueNeed();
        return;
      }
      setStep('menu');
      setNeed(null);
    }
    await route(text);
  }

  async function handleChoice(action: ChatAction) {
    switch (action.kind) {
      case 'skip':
        userSays(action.label);
        setStep('menu');
        await onboarding();
        return;
      case 'menu':
        setNeed(null);
        await showMenu(withName(T().menuIntroNamed));
        return;
      case 'lang':
        userSays(action.label);
        await switchLang(action.payload === 'ar' ? 'ar' : 'fr');
        return;
      case 'city':
        userSays(action.label);
        await answerCity(action.payload ?? action.label);
        return;
      case 'who': {
        userSays(action.label);
        const need = get().need ?? { gift: false };
        setNeed({ ...need, who: (action.payload as Who) ?? 'elle' });
        await continueNeed();
        return;
      }
      case 'type': {
        userSays(action.label);
        const need = get().need ?? { gift: false };
        setNeed({ ...need, slug: action.payload || need.slug, typeAsked: true });
        await continueNeed();
        return;
      }
      case 'budget': {
        userSays(action.label);
        const range = decodeRange(action.payload);
        if (range) await handleBudget(range);
        return;
      }
      case 'pair':
        userSays(action.label);
        await pairReply(action.payload ?? '');
        return;
      case 'size':
      case 'color': {
        userSays(action.label);
        const p = pendingVariant;
        if (!p) {
          await say(T().cart.addError, { fast: true, actions: [menuBtn()] }); // la question n'est plus en mémoire (page rechargée)
          return;
        }
        if (action.kind === 'size') p.size = action.payload ?? null;
        else p.color = action.payload ?? null;
        await continueAdd(p);
        return;
      }
      case 'add':
        userSays(action.label);
        enqueueAdd(action.payload ?? '');
        return;
      case 'cancel':
        userSays(action.label);
        pendingVariant = null;
        await say(T().cart.cancelled, { fast: true, actions: [menuBtn()] });
        return;
      case 'install':
        await installNow();
        return;
      case 'installHelp':
        userSays(action.label);
        await installSteps();
        return;
      case 'iosGuide':
        useInstallGuideStore.getState().show();
        return;
      case 'installLater':
        userSays(action.label);
        recordInstall('dismissed');
        await say(T().install.later, { fast: true });
        return;
      case 'say':
        await respondTo(action.payload ?? action.label, action.label);
        return;
      default:
        return;
    }
  }

  // Après six messages du client, si ce n'est pas déjà fait : la proposition d'installer le raccourci (une seule fois).
  async function afterTurn() {
    if (get().messages.filter((m) => m.role === 'user').length >= 6) await maybeOfferInstall();
  }

  return {
    open: false,
    messages: saved.messages,
    loading: false,
    step: saved.step,
    ctx: saved.ctx,
    need: saved.need,
    lang: chosenLang() ?? 'fr',
    deliveryCity: null,
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
      await run(async () => {
        await respondTo(text);
        await afterTurn();
      });
    },
    choose: async (action) => {
      if (get().loading) return;
      await run(async () => {
        await handleChoice(action);
        await afterTurn();
      });
    },
    addToCart: (slug) => enqueueAdd(slug),
    openCart: () => {
      void run(showCart);
    },
    prepareCheckout: async () => {
      let result: 'ok' | 'login' | 'empty' | 'issues' = 'ok';
      userSays(T().chip.checkout);
      await run(async () => {
        result = await checkoutCheck();
      });
      return result;
    },
    toggleLang: () => {
      if (get().loading) return;
      void run(() => switchLang(otherLang()));
    },
    reset: () => {
      if (get().loading) return;
      save([], 'menu', null, null);
      set({ messages: [], step: 'menu', ctx: null, need: null });
      void run(begin);
    },
  };
});

// Le prénom retenu sur l'appareil sert aussi à la bulle de bienvenue du bouton : on le charge dès le début.
AsyncStorage.getItem(NAME_KEY)
  .then((value) => {
    const name = firstNameFrom(value ?? '');
    if (name && !useAssistantStore.getState().name) useAssistantStore.setState({ name });
  })
  .catch(() => {});
