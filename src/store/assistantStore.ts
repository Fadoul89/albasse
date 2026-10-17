import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASSISTANT_NAME, ASSISTANT_ROLE, HOME_CITY } from '../constants/assistant';
import {
  cityReply,
  detectIntent,
  encouragement,
  firstNameFrom,
  firstNameOfFullName,
  matchCity,
  newest,
  normalize,
  promotions,
  searchCatalog,
  tokenize,
  type CatalogProduct,
  type City,
} from '../lib/assistantBrain';
import { getCatalog, getCategories, getCities, getStoreInfo, toCard, type AssistantProduct } from '../lib/assistantData';
import { useAuthStore } from './authStore';

// Zara Kings, assistante marketing (sans IA) : elle suit un scenario et comprend quelques mots-cles.
// La conversation est gardee dans l'onglet (sessionStorage), le prenom du visiteur sur l'appareil.

export interface ChatAction {
  label: string;
  kind: 'say' | 'whatsapp' | 'register' | 'login' | 'orders' | 'category' | 'skip' | 'city' | 'menu';
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

export type Step = 'ask_name' | 'menu' | 'ask_city';

interface AssistantState {
  open: boolean;
  messages: ChatMessage[];
  loading: boolean;
  step: Step;
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

function load(): { messages: ChatMessage[]; step: Step } {
  if (Platform.OS !== 'web') return { messages: [], step: 'menu' };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const messages = Array.isArray(parsed?.messages)
      ? (parsed.messages as ChatMessage[]).filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
      : [];
    const step: Step = parsed?.step === 'ask_name' || parsed?.step === 'ask_city' ? parsed.step : 'menu';
    return { messages, step };
  } catch {
    return { messages: [], step: 'menu' };
  }
}

function save(messages: ChatMessage[], step: Step) {
  if (Platform.OS !== 'web') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-MAX_SAVED), step }));
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
      save(messages, s.step);
      return { messages };
    });
  };
  const setStep = (step: Step) => {
    set({ step });
    save(get().messages, step);
  };

  async function say(text: string, extra: { products?: AssistantProduct[]; actions?: ChatAction[] } = {}) {
    set({ loading: true });
    await sleep(typingDelay(text));
    push({ id: newId(), role: 'assistant', text, ...extra });
    set({ loading: false });
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
      { label: '🔥 Promotions', kind: 'say' },
      { label: '🆕 Nouveautés', kind: 'say' },
      { label: '🛍️ Catégories', kind: 'say' },
      { label: '🚚 Livraison et paiement', kind: 'say' }
    );
    if (!isGuest()) actions.push({ label: '📦 Mes commandes', kind: 'orders' });
    actions.push({ label: '💬 WhatsApp', kind: 'whatsapp' });
    return actions;
  };

  const afterAnswerActions = (): ChatAction[] => [
    { label: '🔥 Promotions', kind: 'say' },
    { label: '🛍️ Catégories', kind: 'say' },
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
    if (isGuest()) await accountInvitation();
    else await showMenu('Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
  }

  async function afterName(name: string) {
    set({ name });
    try {
      await AsyncStorage.setItem(NAME_KEY, name);
    } catch {
      // ignore : le prenom ne sera pas retenu pour la prochaine visite
    }
    await say(`Enchantée ${name} ! 😊`);
    if (isGuest()) await accountInvitation();
    else await showMenu('Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
  }

  async function showProducts(intro: string, products: CatalogProduct[]) {
    await say(intro, { products: products.map(toCard) });
    await say(encouragement(get().messages.length), { actions: afterAnswerActions() });
  }

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
      const home = city.name === HOME_CITY || /djamena/i.test(city.name);
      await say(cityReply(city), { actions: home ? afterAnswerActions() : [{ label: '💬 WhatsApp', kind: 'whatsapp' }, ...afterAnswerActions().filter((a) => a.kind !== 'whatsapp')] });
    } catch {
      // Base injoignable : N'Djamena (livraison gratuite, paiement a la livraison) ne depend pas de la base.
      if (/djamena|ndjam/.test(normalize(cityName).replace(/ /g, ''))) {
        setStep('menu');
        await say(cityReply({ name: HOME_CITY, fee: 0, agency: null }), { actions: afterAnswerActions() });
        return;
      }
      await dataError();
    }
  }

  async function dataError() {
    await say('Je n’arrive pas à charger ces informations pour le moment. Réessayez dans un instant, ou écrivez-nous sur WhatsApp.', {
      actions: [{ label: '💬 WhatsApp', kind: 'whatsapp' }, { label: '🏠 Menu', kind: 'menu' }],
    });
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

  async function searchReply(query: string) {
    try {
      const results = searchCatalog(await getCatalog(), query, 4);
      if (results.length > 0) {
        await showProducts(withName(`Voici ce que j’ai trouvé pour « ${query} »{nom} :`), results);
      } else {
        await say(`Je n’ai rien trouvé pour « ${query} » 😕 Essayez un autre mot (par exemple : chaussures, montre, parfum, sac), ou parcourez nos catégories.`, {
          actions: [{ label: '🛍️ Catégories', kind: 'say' }, { label: '🔥 Promotions', kind: 'say' }, { label: '💬 WhatsApp', kind: 'whatsapp' }],
        });
      }
    } catch {
      await dataError();
    }
  }

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
      case 'promo': {
        try {
          const promos = promotions(await getCatalog(), 4);
          if (promos.length) await showProducts(withName('🔥 Voici nos meilleures promotions du moment{nom} ! Les stocks partent vite.'), promos);
          else await say('Pas de promotion en ce moment, mais découvrez nos nouveautés !', { actions: [{ label: '🆕 Nouveautés', kind: 'say' }, { label: '🏠 Menu', kind: 'menu' }] });
        } catch {
          await dataError();
        }
        return;
      }
      case 'new': {
        try {
          const fresh = newest(await getCatalog(), 4);
          await showProducts(withName('🆕 Voici nos dernières nouveautés{nom} !'), fresh);
        } catch {
          await dataError();
        }
        return;
      }
      case 'categories':
        await categoriesReply();
        return;
      case 'order':
        await say('Commander est simple 👇\n1. Ouvrez le produit qui vous plaît\n2. Choisissez la couleur ou la taille\n3. Touchez « Ajouter au panier » ou « Acheter »\n4. Indiquez votre nom, téléphone, ville et adresse\nÀ N’Djamena, la livraison est gratuite et vous payez à la livraison !', {
          actions: [{ label: '🔥 Promotions', kind: 'say' }, { label: '🚚 Livraison et paiement', kind: 'say' }, { label: '💬 WhatsApp', kind: 'whatsapp' }],
        });
        return;
      case 'contact': {
        let lines = 'Notre équipe vous répond sur WhatsApp 👇';
        try {
          const info = await getStoreInfo();
          const where = [info.address, info.city].filter(Boolean).join(', ');
          if (where || info.hours) lines = `${where ? `📍 ${where}\n` : ''}${info.hours ? `🕗 ${info.hours}\n` : ''}Pour une question, écrivez-nous sur WhatsApp 👇`;
        } catch {
          // message simple
        }
        await say(lines, { actions: [{ label: '💬 WhatsApp', kind: 'whatsapp' }, { label: '🏠 Menu', kind: 'menu' }] });
        return;
      }
      default: {
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
  }

  async function handleText(raw: string, shown?: string) {
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text || get().loading) return;
    push({ id: newId(), role: 'user', text: shown ?? text });
    set({ loading: true });
    try {
      const step = get().step;
      if (step === 'ask_name') {
        const name = firstNameFrom(text);
        set({ loading: false });
        if (name) {
          await afterName(name);
          return;
        }
        setStep('menu'); // ce n'etait pas un prenom : on repond a ce qu'il a ecrit
      } else if (step === 'ask_city') {
        let cities = null as Awaited<ReturnType<typeof getCities>> | null;
        try {
          cities = await getCities();
        } catch {
          cities = null;
        }
        set({ loading: false });
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
      }
      set({ loading: false });
      await route(text);
    } finally {
      set({ loading: false });
    }
  }

  return {
    open: false,
    messages: saved.messages,
    loading: false,
    step: saved.step,
    name: null,
    teaserDismissed: false,
    openChat: () => {
      set({ open: true, teaserDismissed: true });
      if (get().messages.length === 0 && !get().loading) begin();
    },
    closeChat: () => set({ open: false }),
    dismissTeaser: () => set({ teaserDismissed: true }),
    send: (text) => handleText(text),
    choose: async (action) => {
      if (get().loading) return;
      if (action.kind === 'skip') {
        push({ id: newId(), role: 'user', text: action.label });
        if (isGuest()) await accountInvitation();
        else await showMenu('Que souhaitez-vous découvrir aujourd’hui ? 🛍️');
        return;
      }
      if (action.kind === 'menu') {
        await showMenu(withName('Que souhaitez-vous découvrir{nom} ? 🛍️'));
        return;
      }
      if (action.kind === 'city') {
        push({ id: newId(), role: 'user', text: action.label });
        await answerCity(action.payload ?? action.label);
        return;
      }
      if (action.kind === 'say') await handleText(action.payload ?? action.label, action.label);
    },
    reset: () => {
      if (get().loading) return;
      save([], 'menu');
      set({ messages: [], loading: false, step: 'menu' });
      begin();
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
