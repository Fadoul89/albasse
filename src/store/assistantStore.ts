import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GIFT_WRAP_FEE, HOME_CITY, PAYMENT } from '../constants/shopRules';
import {
  addressFrom,
  cityReply,
  detectIntent,
  firstNameFrom,
  firstNameOfFullName,
  fullNameFrom,
  goodbyeKind,
  greetingKind,
  loyaltyKind,
  isHomeCity,
  matchCity,
  newest,
  normalize,
  paymentFrom,
  personalKind,
  phoneFrom,
  promotions,
  searchCatalog,
  thanksKind,
  tokenize,
  wantsCancelOrder,
  wantsConfirmOrder,
  wantsEditOrder,
  yesNo,
  type CatalogProduct,
  type City,
} from '../lib/assistantBrain';
import { hasArabic, type Lang, type PayMethodKey, type Who } from '../lib/assistantLang';
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
import { fetchCartStatus, fetchLoyaltyPoints, fetchPaymentNumbers, fetchProductForCart, getCatalog, getCategories, getCities, getStoreInfo, startChatToday, toCard, type AssistantProduct } from '../lib/assistantData';
import { createOrder, generateOrderId } from '../lib/orders';
import { trackTikTokEvent } from '../lib/tiktokPixel';
import { initiatePayment } from '../lib/payments';
import { getLoyaltyStatus, LOYALTY_FCFA_PER_POINT } from '../lib/loyalty';
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
    | 'installYes'
    | 'installHelp'
    | 'iosGuide'
    | 'installLater'
    | 'orderCity'
    | 'orderPay'
    | 'orderGift'
    | 'orderConfirm'
    | 'orderEdit'
    | 'orderCancel'
    | 'orderAddress'
    | 'orderPage'
    | 'account';
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
  image?: ChatImage; // une photo sous le message (ex. comment installer sur iPhone)
  actions?: ChatAction[];
}

export interface ChatImage {
  src: string;
  alt: string;
  ratio: number; // largeur / hauteur
}

export type Step =
  | 'ask_lang'
  | 'ask_name'
  | 'menu'
  | 'ask_city'
  | 'ask_who'
  | 'ask_type'
  | 'ask_budget'
  | 'co_name'
  | 'co_phone'
  | 'co_address'
  | 'co_city'
  | 'co_pay'
  | 'co_gift'
  | 'co_confirm';

// Commande en cours dans la conversation. Le numéro est choisi une fois : si l'enregistrement est refait après une coupure, la
// même commande n'est pas enregistrée deux fois.
export interface OrderDraft {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  city: { name: string; fee: number | null; agency: string | null } | null;
  method: PayMethodKey | null;
  giftWrap: boolean | null;
}

interface AssistantState {
  open: boolean;
  messages: ChatMessage[];
  loading: boolean;
  step: Step;
  // Ce dont on parle (produit cherché, catégorie, cadeau...) : sert à affiner par budget.
  ctx: Context | null;
  // Ce que veut le visiteur pendant que Zara pose ses questions (pour qui, quel article, quel budget).
  need: Need | null;
  order: OrderDraft | null;
  lang: Lang;
  // Dernière ville dont le client a parlé : les frais de livraison ne sont affichés dans le panier que s'ils sont connus.
  deliveryCity: { name: string; fee: number | null } | null;
  name: string | null;
  teaserDismissed: boolean;
  openChat: () => void;
  // client qui vient de se connecter pendant la conversation : Zara le reconnaît à son prénom (une seule fois par visite)
  greetMember: () => void;
  closeChat: () => void;
  dismissTeaser: () => void;
  send: (text: string) => Promise<void>;
  choose: (action: ChatAction) => Promise<void>;
  toggleLang: () => void;
  // bouton « + » d'une fiche produit : ajoute au vrai panier du site sans fermer la conversation
  addToCart: (slug: string) => void;
  openCart: () => void;
  // « Commander » : Zara vérifie le panier (prix, stock, compte) puis finalise la commande avec le client, dans la conversation
  startCheckout: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = 'albasse_zara_v1';
const NAME_KEY = 'albasse_zara_name';
const LANG_KEY = 'albasse_zara_lang';
const MEMBER_KEY = 'albasse_zara_member';
const RANK_KEY = 'albasse_zara_rank';
// Le client connecté est salué 10 secondes après sa connexion (arrivée avec son compte ouvert, ou connexion pendant la visite),
// jamais avant : s'il ouvre Zara plus tôt, elle « écrit » (les trois points) jusqu'à la fin des 10 secondes.
const GREETING_WAIT_MS = 10000;
let connectedAt: number | null = null;
const MAX_SAVED = 40;
const STEPS: Step[] = ['ask_lang', 'ask_name', 'menu', 'ask_city', 'ask_who', 'ask_type', 'ask_budget', 'co_name', 'co_phone', 'co_address', 'co_city', 'co_pay', 'co_gift', 'co_confirm'];
const CTX_KINDS = ['query', 'category', 'gift', 'who', 'promo', 'new'];

interface Saved {
  messages: ChatMessage[];
  step: Step;
  ctx: Context | null;
  need: Need | null;
  order: OrderDraft | null;
}

function load(): Saved {
  const empty: Saved = { messages: [], step: 'menu', ctx: null, need: null, order: null };
  if (Platform.OS !== 'web') return empty;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const messages = Array.isArray(parsed?.messages)
      ? (parsed.messages as ChatMessage[]).filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
      : [];
    const ctx: Context | null = parsed?.ctx && CTX_KINDS.includes(parsed.ctx.kind) ? parsed.ctx : null;
    const need: Need | null = parsed?.need && typeof parsed.need === 'object' ? parsed.need : null;
    const order: OrderDraft | null = parsed?.order && typeof parsed.order === 'object' && typeof parsed.order.id === 'string' ? (parsed.order as OrderDraft) : null;
    const savedStep: Step = STEPS.includes(parsed?.step) ? parsed.step : 'menu';
    // une commande en cours sans ses informations (onglet recopié...) : on revient au menu
    const step: Step = savedStep.startsWith('co_') && !order ? 'menu' : savedStep;
    return { messages, step, ctx, need, order };
  } catch {
    return empty;
  }
}

function save(messages: ChatMessage[], step: Step, ctx: Context | null, need: Need | null, order: OrderDraft | null) {
  if (Platform.OS !== 'web') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-MAX_SAVED), step, ctx, need, order }));
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

// Le jour, à l'heure du Tchad (la fonction de la base compte aussi par jour tchadien).
function chadDay(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Ndjamena' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Rang du jour de ce visiteur (« mon 3ᵉ client aujourd'hui »), donné par la base. Retenu sur l'appareil pour la journée :
// il n'est compté qu'une fois, et reste le même s'il rouvre Zara. Sans réponse de la base : null (pas de nombre).
async function todayRank(): Promise<number | null> {
  if (Platform.OS !== 'web') return null;
  const day = chadDay();
  try {
    const saved = JSON.parse(window.localStorage.getItem(RANK_KEY) ?? 'null');
    if (saved && saved.day === day && Number.isInteger(saved.n) && saved.n > 0) return saved.n as number;
  } catch {
    // pas de rang retenu
  }
  const n = await startChatToday();
  if (n) {
    try {
      window.localStorage.setItem(RANK_KEY, JSON.stringify({ day, n }));
    } catch {
      // ignore : il pourrait être compté une deuxième fois s'il rouvre Zara
    }
  }
  return n;
}

// Client avec compte déjà salué par son prénom : Zara ne le salue qu'une fois par visite (le compte est noté dans l'onglet).
let greetedMemberId: string | null = null;

function memberGreeted(id: string): boolean {
  if (greetedMemberId === id) return true;
  if (Platform.OS !== 'web') return false;
  try {
    return window.sessionStorage.getItem(MEMBER_KEY) === id;
  } catch {
    return false;
  }
}

function markMemberGreeted(id: string) {
  greetedMemberId = id;
  if (Platform.OS !== 'web') return;
  try {
    window.sessionStorage.setItem(MEMBER_KEY, id);
  } catch {
    // ignore : après un rechargement, il pourra être salué une deuxième fois
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

// Proposition d'installer le raccourci : une seule fois, puis pause de 14 jours. Elle vient après deux messages du client
// (il a commencé à discuter), jamais dès l'accueil ; entre-temps, un bouton du menu reste là pour ceux qui veulent.
const INSTALL_KEY = 'albasse_zara_install';
const INSTALL_PAUSE_MS = 14 * 24 * 3600 * 1000;
const INSTALL_OFFER_AFTER_MESSAGES = 2;
// La photo « comment installer sur iPhone » : 4 images du tutoriel vidéo (Partager, En voir plus, Sur l'écran d'accueil, C'est prêt).
const IOS_INSTALL_PHOTO = { src: '/ios-installer-photo.jpg', ratio: 1120 / 1960 };

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
      save(messages, s.step, s.ctx, s.need, s.order);
      return { messages };
    });
  };
  const persist = () => save(get().messages, get().step, get().ctx, get().need, get().order);
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
  const setOrder = (order: OrderDraft | null) => {
    set({ order });
    persist();
  };
  const patchOrder = (patch: Partial<OrderDraft>) => {
    const current = get().order;
    if (current) setOrder({ ...current, ...patch });
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
      if (depth === 0) {
        set({ loading: false });
        // le compte du client a pu arriver pendant que Zara écrivait : elle le salue dès qu'elle a fini
        if (get().open) get().greetMember();
      }
    }
  }

  async function say(text: string, extra: { products?: AssistantProduct[]; image?: ChatImage; actions?: ChatAction[]; lang?: Lang; cart?: boolean; fast?: boolean } = {}) {
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

  // Une phrase parmi plusieurs (le prénom mis si besoin) : Zara ne dit pas deux fois la même de suite.
  const pickLine = (lines: string[]) => freshLine(lines.map(withName));
  const lastAssistantIn = (lines: string[]) => {
    const last = [...get().messages].reverse().find((m) => m.role === 'assistant');
    return !!last && lines.includes(last.text);
  };

  const isGuest = () => !useAuthStore.getState().isAuthenticated;
  // Le client connecté, reconnu à son prénom (celui de son profil, relu sur le serveur) ; sinon null.
  const memberIdentity = (): { id: string; name: string } | null => {
    const auth = useAuthStore.getState();
    const name = auth.isAuthenticated ? firstNameOfFullName(auth.profile?.full_name) : null;
    return name && auth.profile ? { id: auth.profile.id, name } : null;
  };
  // Temps restant avant de pouvoir saluer le client connecté (0 pour un visiteur sans compte : il est salué tout de suite).
  const greetingWaitLeft = () => (memberIdentity() && connectedAt ? Math.max(0, connectedAt + GREETING_WAIT_MS - Date.now()) : 0);
  const otherLang = (): Lang => (get().lang === 'fr' ? 'ar' : 'fr');

  const langAction = (): ChatAction => ({ label: T().chip.otherLang, kind: 'lang', payload: otherLang() });
  const wa = (): ChatAction => ({ label: T().chip.whatsapp, kind: 'whatsapp' });
  const menuBtn = (): ChatAction => ({ label: T().chip.menu, kind: 'menu' });
  const sayBtn = (label: string, payload: string): ChatAction => ({ label, kind: 'say', payload });

  const menuActions = (): ChatAction[] => {
    const c = T().chip;
    const actions: ChatAction[] = [];
    if (isGuest()) actions.push({ label: c.createAccount, kind: 'register', highlight: true }, { label: c.login, kind: 'login' });
    actions.push(sayBtn(c.promotions, 'promotions'), sayBtn(c.news, 'nouveautés'), sayBtn(c.advice, 'conseil'), sayBtn(c.categories, 'catégories'), sayBtn(c.delivery, 'livraison'));
    if (useCartStore.getState().items.length > 0) actions.push({ label: c.cart, kind: 'cart' });
    if (!isGuest()) actions.push({ label: c.orders, kind: 'orders' }, sayBtn(c.points, T().loyalty.mineQuery));
    const install = installMenuChip();
    if (install) actions.push(install);
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

  // Le prénom est demandé une seule fois. Un visiteur qui a déjà un compte peut se connecter : Zara le reconnaîtra.
  // Un client déjà connecté dont le compte n'a pas de prénom est reconnu comme connecté (jamais invité à « se connecter »).
  async function askName() {
    setStep('ask_name');
    const guest = isGuest();
    const actions: ChatAction[] = [{ label: T().chip.skip, kind: 'skip' }];
    if (guest) actions.push({ label: T().chip.login, kind: 'login' });
    actions.push(langAction());
    await say(guest ? T().askNameGuest : memberIdentity() ? T().askName : T().askNameMember, { actions });
  }

  // Après le bonjour : on demande le prénom (une seule fois), sinon on enchaîne.
  async function afterWelcome() {
    if (!get().name) {
      await askName();
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
    const wait = greetingWaitLeft();
    if (wait > 0) await sleep(wait);
    const name = await rememberedName();
    set({ name });
    const member = memberIdentity();
    if (member) markMemberGreeted(member.id);
    if (!chosenLang()) {
      // Première visite : le tout premier message de Zara salue par le prénom (s'il est connu) et demande la langue (français / arabe).
      setStep('ask_lang');
      const hello = name ? `${texts('fr').hello(name)}\n${texts('ar').hello(name)}\n` : '';
      await say(`${hello}${texts('fr').chooseLang} / ${texts('ar').chooseLang} 🌐`, {
        lang: 'fr',
        actions: [
          { label: 'Français', kind: 'lang', payload: 'fr' },
          { label: 'العربية', kind: 'lang', payload: 'ar' },
        ],
      });
      return;
    }
    // Accueil chaleureux : prénom, vrai rang du jour (si la base le donne), invitation.
    await say(T().welcome(name, await todayRank(), false));
    await afterWelcome();
  }

  // Un client qui se connecte pendant la conversation : Zara le reconnaît à son prénom (une seule fois par visite).
  const shouldGreetMember = () => {
    const member = memberIdentity();
    return !!member && !memberGreeted(member.id) && get().step !== 'ask_lang' && get().messages.length > 0;
  };

  async function greetMember() {
    let member = memberIdentity();
    if (!member || memberGreeted(member.id) || get().step === 'ask_lang') return;
    markMemberGreeted(member.id);
    const wait = greetingWaitLeft();
    if (wait > 0) {
      await sleep(wait);
      member = memberIdentity();
      if (!member) return; // il s'est déconnecté pendant l'attente
    }
    set({ name: member.name });
    if (get().step === 'ask_name') {
      // il n'a plus à donner son prénom : on continue comme après la présentation
      setStep('menu');
      await say(T().memberBack(member.name));
      await onboarding();
      return;
    }
    await say(T().memberBack(member.name), get().step === 'menu' ? { actions: menuActions() } : {});
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
      // premier choix de langue : Zara se présente dans cette langue (sans redire « Bonjour » si elle a déjà salué par le prénom)
      setStep('menu');
      const name = get().name;
      const greeted = !!name && get().messages.some((m) => m.role === 'assistant' && m.text.includes(name));
      const member = memberIdentity();
      if (member) markMemberGreeted(member.id);
      await say(T().welcome(name, await todayRank(), greeted));
      await afterWelcome();
      return;
    }
    await say(T().langSwitched);
    // la question en cours est reposée dans la nouvelle langue
    if (step === 'ask_name') {
      await askName();
      return;
    }
    if (step.startsWith('co_')) {
      await nextCheckoutStep();
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

  const shortName = (raw: string) => {
    const name = raw.trim();
    return name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name;
  };
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

  // -------------------------------------------------------------------------------------------
  // Commande dans la conversation : Zara pose les questions de la page de commande (nom, téléphone, adresse, ville, paiement,
  // emballage cadeau), récapitule, puis enregistre la commande avec le MÊME code que la page de commande (createOrder) et les
  // mêmes règles. Elle ne dit « enregistrée » qu'après la réponse de la base ; en cas d'échec le panier est gardé.
  // -------------------------------------------------------------------------------------------

  const cancelOrderChip = (): ChatAction => ({ label: T().chip.cancelOrder, kind: 'orderCancel' });

  function orderTotals(d: OrderDraft) {
    const items = useCartStore.getState().items;
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    return { items, subtotal, total: subtotal + (d.city?.fee ?? 0) + (d.giftWrap ? GIFT_WRAP_FEE : 0) };
  }

  async function startCheckoutFlow() {
    const result = await checkoutCheck(); // panier vide, pas de compte, ou prix / stock à revoir : Zara l'explique et s'arrête
    if (result !== 'ok') return;
    const profile = useAuthStore.getState().profile;
    let city: OrderDraft['city'] = null;
    const known = get().deliveryCity;
    if (known) {
      try {
        const found = matchCity(await getCities(), known.name);
        if (found) city = { name: found.name, fee: found.fee, agency: found.agency };
      } catch {
        // la ville sera demandée
      }
    }
    setOrder({ id: generateOrderId(), name: fullNameFrom(profile?.full_name ?? ''), phone: phoneFrom(profile?.phone ?? ''), address: null, city, method: null, giftWrap: null });
    // comme à l'ouverture de la page de commande : le début de la commande est signalé à TikTok (publicités)
    const cartItems = useCartStore.getState().items;
    trackTikTokEvent('InitiateCheckout', { value: cartTotals().total, currency: 'XAF', content_id: cartItems.map((i) => i.product.id), contents: cartItems.map((i) => ({ content_id: i.product.id, quantity: i.quantity })) });
    await say(T().checkout.intro, { fast: true });
    await nextCheckoutStep();
  }

  // La première information qui manque est demandée ; quand tout est là : le récapitulatif.
  async function nextCheckoutStep() {
    const d = get().order;
    if (!d) return;
    const c = T().checkout;
    if (!d.name) {
      setStep('co_name');
      await say(c.askName, { fast: true, actions: [cancelOrderChip()] });
      return;
    }
    if (!d.phone) {
      setStep('co_phone');
      await say(c.askPhone, { fast: true, actions: [cancelOrderChip()] });
      return;
    }
    if (!d.address) {
      setStep('co_address');
      const saved = useAuthStore.getState().profile?.address?.trim();
      const actions: ChatAction[] = [];
      if (saved && addressFrom(saved)) actions.push({ label: T().chip.useAddress(saved), kind: 'orderAddress', payload: saved });
      actions.push(cancelOrderChip());
      await say(c.askAddress, { fast: true, actions });
      return;
    }
    if (!d.city) {
      await askOrderCity();
      return;
    }
    if (!d.method) {
      await askPayment();
      return;
    }
    if (d.giftWrap === null) {
      setStep('co_gift');
      await say(c.askGift, {
        fast: true,
        actions: [{ label: T().chip.giftYes, kind: 'orderGift', payload: 'yes' }, { label: T().chip.giftNo, kind: 'orderGift', payload: 'no' }, cancelOrderChip()],
      });
      return;
    }
    await showRecap();
  }

  async function askOrderCity(known?: City[] | null) {
    setStep('co_city');
    let popular: string[] = [HOME_CITY];
    try {
      const cities = known ?? (await getCities());
      popular = cities.slice(0, 8).map((x) => x.name);
    } catch {
      // N'Djamena seulement : il peut écrire sa ville
    }
    await say(T().checkout.askCity, { fast: true, actions: [...popular.map((name) => ({ label: name, kind: 'orderCity' as const, payload: name })), cancelOrderChip()] });
  }

  async function askPayment() {
    const d = get().order;
    if (!d?.city) return;
    setStep('co_pay');
    const home = isHomeCity(d.city.name);
    const chips = T().chip;
    const actions: ChatAction[] = [];
    if (home) actions.push({ label: chips.payCash, kind: 'orderPay', payload: 'cash_on_delivery' });
    actions.push({ label: chips.payAirtel, kind: 'orderPay', payload: 'airtel_money' }, { label: chips.payMoov, kind: 'orderPay', payload: 'moov_money' }, cancelOrderChip());
    await say(T().checkout.askPay(home), { fast: true, actions });
  }

  async function setOrderCity(text: string) {
    let cities: City[] | null = null;
    try {
      cities = await getCities();
    } catch {
      cities = null;
    }
    const found = cities ? matchCity(cities, text) : null;
    if (found) {
      patchOrder({ city: { name: found.name, fee: found.fee, agency: found.agency } });
    } else if (cities) {
      await say(T().cityNotFound(text), { fast: true, actions: [...cities.slice(0, 10).map((x) => ({ label: x.name, kind: 'orderCity' as const, payload: x.name })), cancelOrderChip()] });
      return;
    } else {
      patchOrder({ city: { name: text.slice(0, 40), fee: null, agency: null } }); // villes indisponibles : l'équipe confirmera les frais
    }
    const d = get().order;
    if (d?.city && d.method === 'cash_on_delivery' && !isHomeCity(d.city.name)) {
      patchOrder({ method: null });
      await say(T().checkout.codOnlyHome, { fast: true });
    }
    await nextCheckoutStep();
  }

  async function showRecap() {
    const d = get().order;
    if (!d || !d.name || !d.phone || !d.address || !d.city || !d.method || d.giftWrap === null) return;
    setStep('co_confirm');
    const { items, total } = orderTotals(d);
    const chips = T().chip;
    await say(
      T().checkout.recap({
        lines: items.map((i) => ({ name: shortName(i.product.name), variant: variantText(i.size, i.color), qty: i.quantity, subtotal: i.product.price * i.quantity })),
        city: d.city.name,
        fee: d.city.fee,
        gift: d.giftWrap,
        total,
        name: d.name,
        phone: d.phone,
        address: d.address,
        method: d.method,
      }),
      { actions: [{ label: chips.confirmOrder, kind: 'orderConfirm', highlight: true }, { label: chips.editOrder, kind: 'orderEdit', payload: '?' }, cancelOrderChip()] }
    );
  }

  async function cancelOrder() {
    setOrder(null);
    setStep('menu');
    await say(T().checkout.cancelled, { fast: true, actions: cartActions() });
  }

  async function placeOrder() {
    const d = get().order;
    const profile = useAuthStore.getState().profile;
    const c = T().checkout;
    if (!d || !d.name || !d.phone || !d.address || !d.city || !d.method || d.giftWrap === null || !profile) {
      setOrder(null);
      setStep('menu');
      await say(c.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
      return;
    }
    if (useCartStore.getState().items.length === 0) {
      setOrder(null);
      setStep('menu');
      await say(T().cart.empty, { fast: true, actions: [sayBtn(T().chip.advice, 'conseil'), menuBtn()] });
      return;
    }
    // le prix et le stock sont relus dans la base juste avant d'enregistrer : un prix changé n'est jamais appliqué en silence
    const check = await verifyCart();
    if (check.blocked) {
      setStep('menu');
      await say([T().cart.show, ...check.notes].join('\n'), { fast: true, cart: true, actions: [checkoutChip(), menuBtn()] });
      return;
    }
    if (check.notes.length > 0) {
      await say([c.priceChanged, ...check.notes].join('\n'), { fast: true });
      await showRecap();
      return;
    }
    if (d.method === 'cash_on_delivery' && !isHomeCity(d.city.name)) {
      patchOrder({ method: null });
      await say(c.codOnlyHome, { fast: true });
      await askPayment();
      return;
    }
    const { items, total } = orderTotals(d);
    const label = c.methodLabel(d.method);
    let created: Awaited<ReturnType<typeof createOrder>>;
    try {
      created = await createOrder({
        id: d.id,
        userId: profile.id,
        items,
        total,
        paymentMethod: d.method,
        shippingName: d.name,
        shippingPhone: d.phone,
        shippingAddress: d.address,
        shippingCity: d.city.name,
        giftWrap: d.giftWrap,
      });
    } catch (e) {
      created = { order: null, error: e instanceof Error ? e.message : String(e) };
    }
    if (created.error || !created.order) {
      console.error('Erreur création commande (Zara):', created.error);
      // la commande n'est PAS enregistrée : le panier et les réponses sont gardés, et on peut réessayer (même numéro de commande)
      await say(c.failed, { actions: [{ label: T().chip.retry, kind: 'orderConfirm' }, { label: T().chip.orderPage, kind: 'orderPage' }, wa()] });
      return;
    }
    // instructions de paiement : les mêmes que sur la page de commande (numéro et lien réglés par la boutique)
    let instructions: string;
    if (d.method === 'cash_on_delivery') {
      instructions = c.payCash;
    } else {
      let message: string | null = null;
      try {
        const pay = await initiatePayment({ method: d.method, amount: total, phone: d.phone, orderId: created.order.id });
        if (pay.success) message = pay.message;
      } catch {
        // paiement automatique pas encore branché : instructions à la main, comme sur la page de commande
      }
      if (message) {
        instructions = c.payInitiated(label, message);
      } else {
        const numbers = await fetchPaymentNumbers().catch(() => null);
        const url = d.method === 'airtel_money' ? numbers?.airtelUrl : numbers?.moovUrl;
        const number = (d.method === 'airtel_money' ? numbers?.airtelNumber : numbers?.moovNumber) || (d.method === 'airtel_money' ? PAYMENT.airtel : PAYMENT.moov);
        instructions = url ? c.payUrl(url) : c.payNumber(total, number, label);
      }
    }
    const home = isHomeCity(d.city.name);
    const lines = [c.placed(firstNameOfFullName(d.name) ?? d.name, created.order.id.slice(0, 8)), c.totalToPay(total), instructions];
    if (d.giftWrap) lines.push(c.giftIncluded);
    const points = Math.floor(total / LOYALTY_FCFA_PER_POINT); // la base ajoute floor(total / 5000) points quand la commande est livrée
    if (points >= 1) lines.push(T().loyalty.orderPoints(points));
    lines.push(T().serviceNote(home));
    useCartStore.getState().clear();
    setOrder(null);
    setStep('menu');
    await say(lines.join('\n'), { actions: [{ label: T().chip.orders, kind: 'orders' }, menuBtn()] });
  }

  // Ce que le client écrit pendant la commande. Vrai : Zara a traité le message ; faux : on laisse le routage normal répondre.
  async function handleOrderText(text: string, step: Step): Promise<boolean> {
    const c = T().checkout;
    if (!get().order) {
      setStep('menu');
      await say(c.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
      return true;
    }
    if (wantsCancelOrder(text)) {
      await cancelOrder();
      return true;
    }
    // une vraie question (« c'est combien la livraison ? ») : Zara répond, puis repose sa question (la commande reste ouverte)
    if (/[?؟]/.test(text) && step !== 'co_confirm') {
      await route(text);
      await nextCheckoutStep();
      return true;
    }
    switch (step) {
      case 'co_name': {
        const name = fullNameFrom(text);
        if (name) patchOrder({ name });
        await nextCheckoutStep();
        return true;
      }
      case 'co_phone': {
        const phone = phoneFrom(text);
        if (phone) patchOrder({ phone });
        else await say(c.badPhone, { fast: true, actions: [cancelOrderChip()] });
        if (phone) await nextCheckoutStep();
        return true;
      }
      case 'co_address': {
        const address = addressFrom(text);
        if (address) patchOrder({ address });
        await nextCheckoutStep();
        return true;
      }
      case 'co_city':
        await setOrderCity(text);
        return true;
      case 'co_pay': {
        const method = paymentFrom(text);
        if (!method) {
          await say(c.pickButton, { fast: true });
          await askPayment();
          return true;
        }
        await choosePayment(method);
        return true;
      }
      case 'co_gift': {
        const answer = yesNo(text);
        if (!answer) {
          await say(c.pickButton, { fast: true });
          await nextCheckoutStep();
          return true;
        }
        patchOrder({ giftWrap: answer === 'yes' });
        await nextCheckoutStep();
        return true;
      }
      case 'co_confirm':
        if (wantsEditOrder(text) || yesNo(text) === 'no') await editChooser();
        else if (wantsConfirmOrder(text)) await placeOrder();
        else {
          await say(c.pickButton, { fast: true });
          await showRecap();
        }
        return true;
      default:
        return false;
    }
  }

  async function choosePayment(method: PayMethodKey) {
    const d = get().order;
    if (d?.city && method === 'cash_on_delivery' && !isHomeCity(d.city.name)) {
      await say(T().checkout.codOnlyHome, { fast: true });
      await askPayment();
      return;
    }
    patchOrder({ method });
    await nextCheckoutStep();
  }

  async function editChooser() {
    const chips = T().chip;
    await say(T().checkout.editWhat, {
      fast: true,
      actions: [
        { label: chips.editName, kind: 'orderEdit', payload: 'name' },
        { label: chips.editPhone, kind: 'orderEdit', payload: 'phone' },
        { label: chips.editAddress, kind: 'orderEdit', payload: 'address' },
        { label: chips.editCity, kind: 'orderEdit', payload: 'city' },
        { label: chips.editPay, kind: 'orderEdit', payload: 'method' },
        { label: chips.editGift, kind: 'orderEdit', payload: 'giftWrap' },
        cancelOrderChip(),
      ],
    });
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
  function installRecord(): { at: number; outcome: string } | null {
    try {
      const raw = window.localStorage.getItem(INSTALL_KEY);
      return raw ? (JSON.parse(raw) as { at: number; outcome: string }) : null;
    } catch {
      return null;
    }
  }
  function installPaused(): boolean {
    const record = installRecord();
    return record ? Date.now() - Number(record.at) < INSTALL_PAUSE_MS : false;
  }
  // Le client a dit « Plus tard » (pendant 14 jours) ou a déjà installé : on ne lui remet pas le bouton dans le menu.
  function installDeclined(): boolean {
    const record = installRecord();
    if (!record) return false;
    return record.outcome === 'accepted' || (record.outcome === 'dismissed' && Date.now() - Number(record.at) < INSTALL_PAUSE_MS);
  }
  const alreadyInstalled = () => isRunningAsInstalledPwa() || isRunningInsideApp();
  // L'installation d'iPhone ne marche que depuis Safari (pas depuis Chrome, Facebook, Instagram...).
  const isSafariIos = () => !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
  const installChips = (ios: boolean): ChatAction[] => [
    ios ? { label: T().chip.installHelp, kind: 'installHelp', highlight: true } : { label: T().chip.installApp, kind: 'install', highlight: true },
    { label: T().chip.notNow, kind: 'installLater' },
  ];

  // Le bouton du menu pour les clients qui n'ont pas encore installé : iPhone (aide pas à pas) ; Android seulement quand Chrome permet
  // réellement l'installation (il ne la permet plus une fois l'application installée) ; jamais sur ordinateur ni dans l'application.
  function installMenuChip(): ChatAction | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    if (alreadyInstalled() || installDeclined()) return null;
    if (isIosDevice()) return { label: T().chip.installHelp, kind: 'installHelp' };
    if (isAndroidDevice() && isPwaInstallPromptAvailable()) return { label: T().chip.installApp, kind: 'install' };
    return null;
  }

  // `extra` : les boutons déjà affichés (ex. ceux du panier) restent disponibles sous la proposition.
  async function maybeOfferInstall(extra: ChatAction[] = []) {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (alreadyInstalled() || installPaused()) return;
    const ios = isIosDevice();
    // iPhone : l'aide pas à pas ; Android : le bouton seulement quand Chrome permet réellement l'installation
    if (!ios && !(isAndroidDevice() && isPwaInstallPromptAvailable())) return;
    recordInstall('asked'); // on ne le redit pas, même si le client l'ignore
    // « Avez-vous déjà installé l'application ? » : le bouton pour installer, « Oui, déjà installée », « Plus tard »
    const [install, later] = installChips(ios);
    await say(T().install.ask, { actions: [...extra, install, { label: T().chip.alreadyInstalled, kind: 'installYes' }, later] });
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

  // iPhone : les étapes écrites, avec la photo « comment installer » juste dessous (touchée, elle s'ouvre en grand).
  async function installSteps() {
    const image: ChatImage | undefined = Platform.OS === 'web' ? { ...IOS_INSTALL_PHOTO, alt: T().install.photoAlt } : undefined;
    const text = `${T().install.iosSteps(isSafariIos())}${image ? `\n\n${T().install.photoHint}` : ''}`;
    await say(text, { image, actions: [{ label: T().chip.tutorial, kind: 'iosGuide' }, menuBtn()] });
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
      // Politesse : Zara répond à ce qui est dit, simplement, sans transformer chaque message en publicité.
      case 'thanks': {
        const lines = lastAssistantIn(t.talk.compliment) ? t.talk.afterCompliment : thanksKind(text) === 'much' ? t.talk.thanksMuch : t.talk.thanks;
        await say(pickLine(lines), { actions: [menuBtn()] });
        return;
      }
      case 'greeting':
        await showMenu(pickLine(t.talk.hello(greetingKind(text) ?? 'hello', !!get().name)));
        return;
      case 'smalltalk': {
        const kind = greetingKind(text);
        const word = kind ? t.talk.helloWord(kind) : '';
        await showMenu(`${word ? `${word} ` : ''}${pickLine(t.talk.fine)}`);
        return;
      }
      case 'goodbye':
        await say(pickLine(t.talk.goodbye(goodbyeKind(text) ?? 'plain')));
        return;
      case 'compliment':
        await say(pickLine(t.talk.compliment), { actions: [menuBtn()] });
        return;
      case 'personal': {
        // Zara n'a ni adresse, ni numéro, ni famille : elle reste une assistante virtuelle. Seuls les contacts officiels de la boutique sont proposés.
        const kind = personalKind(text) ?? 'life';
        const actions: ChatAction[] = [];
        if (kind === 'address') actions.push({ label: t.chip.shopAddress, kind: 'say' });
        if (kind === 'phone' || kind === 'whatsapp' || kind === 'call') actions.push(wa());
        actions.push(menuBtn());
        await say(pickLine(t.talk.personal(kind)), { actions });
        return;
      }
      case 'loyalty': {
        const kind = loyaltyKind(text);
        const earnChip = sayBtn(t.chip.earnPoints, t.loyalty.earnQuery);
        if (kind === 'earn' || kind === 'tiers') {
          await say(kind === 'earn' ? t.loyalty.earn : t.loyalty.tiers, { actions: isGuest() ? [{ label: t.chip.createAccount, kind: 'register', highlight: true }, { label: t.chip.login, kind: 'login' }, menuBtn()] : [sayBtn(t.chip.points, t.loyalty.mineQuery), menuBtn()] });
          return;
        }
        // son grade : relu dans SON compte ; sans compte connecté, ou si la lecture échoue, Zara n'invente rien
        const profile = useAuthStore.getState().profile;
        if (!profile) {
          await say(t.loyalty.needLogin, { actions: [{ label: t.chip.createAccount, kind: 'register', highlight: true }, { label: t.chip.login, kind: 'login' }, earnChip, menuBtn()] });
          return;
        }
        const points = await fetchLoyaltyPoints(profile.id);
        if (points === null) {
          await say(t.loyalty.unavailable, { actions: [{ label: t.chip.myAccount, kind: 'account' }, earnChip, menuBtn()] });
          return;
        }
        const status = getLoyaltyStatus(points);
        await say(t.loyalty.mine({ points, tier: status.current.key, next: status.next ? { key: status.next.key, missing: status.pointsToNext } : null }), {
          actions: [earnChip, { label: t.chip.orders, kind: 'orders' }, menuBtn()],
        });
        return;
      }
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
        // « Je veux commander » avec un panier plein : Zara finalise la commande ici ; « comment commander ? » : l'explication
        if (!/comment|كيف/.test(normalize(text)) && useCartStore.getState().items.length > 0) {
          await startCheckoutFlow();
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
    } else if (step.startsWith('co_')) {
      if (await handleOrderText(text, step)) return;
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
      // --- commande dans la conversation
      case 'orderCity':
        userSays(action.label);
        if (get().order) await setOrderCity(action.payload ?? action.label);
        else await say(T().checkout.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
        return;
      case 'orderPay':
        userSays(action.label);
        if (get().order) await choosePayment((action.payload as PayMethodKey) ?? 'airtel_money');
        else await say(T().checkout.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
        return;
      case 'orderGift':
        userSays(action.label);
        if (get().order) {
          patchOrder({ giftWrap: action.payload === 'yes' });
          await nextCheckoutStep();
        } else await say(T().checkout.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
        return;
      case 'orderAddress':
        userSays(action.label);
        if (get().order) {
          const address = addressFrom(action.payload ?? '');
          if (address) patchOrder({ address });
          await nextCheckoutStep();
        } else await say(T().checkout.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
        return;
      case 'orderEdit': {
        userSays(action.label);
        if (!get().order) {
          await say(T().checkout.resumeLost, { fast: true, actions: [checkoutChip(), menuBtn()] });
          return;
        }
        const field = action.payload;
        if (field === 'name' || field === 'phone' || field === 'address' || field === 'city' || field === 'method' || field === 'giftWrap') {
          patchOrder({ [field]: null } as Partial<OrderDraft>);
          await nextCheckoutStep();
        } else await editChooser();
        return;
      }
      case 'orderConfirm':
        userSays(action.label);
        await placeOrder();
        return;
      case 'orderCancel':
        userSays(action.label);
        await cancelOrder();
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
      case 'installYes':
        userSays(action.label);
        recordInstall('accepted'); // il l'a déjà : on ne lui propose plus rien, ni le bouton dans le menu
        await say(T().install.yes, { fast: true, actions: afterAnswerActions() });
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

  // Après deux messages du client, si ce n'est pas déjà fait : la proposition d'installer le raccourci (une seule fois).
  async function afterTurn() {
    if (get().step.startsWith('co_')) return; // jamais au milieu d'une commande
    if (get().messages.filter((m) => m.role === 'user').length >= INSTALL_OFFER_AFTER_MESSAGES) await maybeOfferInstall();
  }

  return {
    open: false,
    messages: saved.messages,
    loading: false,
    step: saved.step,
    ctx: saved.ctx,
    need: saved.need,
    order: saved.order,
    lang: chosenLang() ?? 'fr',
    deliveryCity: null,
    name: null,
    teaserDismissed: false,
    openChat: () => {
      set({ open: true, teaserDismissed: true });
      if (get().loading) return;
      if (get().messages.length === 0) void run(begin);
      else get().greetMember();
    },
    greetMember: () => {
      if (get().loading || !shouldGreetMember()) return;
      void run(greetMember);
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
    startCheckout: async () => {
      if (get().loading) return;
      userSays(T().chip.checkout);
      await run(startCheckoutFlow);
    },
    toggleLang: () => {
      if (get().loading) return;
      void run(() => switchLang(otherLang()));
    },
    reset: () => {
      if (get().loading) return;
      save([], 'menu', null, null, null);
      set({ messages: [], step: 'menu', ctx: null, need: null, order: null });
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

// Le prénom du compte suit la connexion : le client connecté est reconnu à son prénom. À la déconnexion, on ne garde pas
// ce prénom (un autre visiteur peut utiliser le même appareil) : on revient au prénom retenu sur l'appareil, s'il y en a un.
useAuthStore.subscribe((state, prev) => {
  // l'heure de la connexion : les 10 secondes d'attente avant la salutation partent de là
  if (state.isAuthenticated && !prev.isAuthenticated) connectedAt = Date.now();
  else if (!state.isAuthenticated) connectedAt = null;
  const assistant = useAssistantStore.getState();
  const account = state.isAuthenticated ? firstNameOfFullName(state.profile?.full_name) : null;
  if (account) {
    if (assistant.name !== account) useAssistantStore.setState({ name: account });
    // le chat est ouvert : Zara salue tout de suite (une seule fois par visite, elle note qu'elle l'a déjà fait)
    if (assistant.open) assistant.greetMember();
    return;
  }
  if (prev.isAuthenticated && !state.isAuthenticated) {
    AsyncStorage.getItem(NAME_KEY)
      .then((value) => useAssistantStore.setState({ name: firstNameFrom(value ?? '') }))
      .catch(() => useAssistantStore.setState({ name: null }));
  }
});
