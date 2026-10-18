import { ASSISTANT_NAME, ASSISTANT_ROLE } from '../constants/assistant';
import { DEFAULT_AGENCIES, DELIVERY_HOURS, GIFT_WRAP_FEE, HOME_CITY, ORDER_VALIDITY_HOURS, PAYMENT } from '../constants/shopRules';
import { LOYALTY_FCFA_PER_POINT, LOYALTY_TIERS, type LoyaltyTier } from './loyalty';
import { CATEGORY_AR, type GoodbyeKind, type GreetingKind, type Lang, type PayMethodKey, type PersonalKind, type Who } from './assistantLang';

// Tous les textes que Zara dit ou affiche, en français et en arabe. Un « {nom} » dans un texte devient
// « , Prénom » (ou « ، Prénom » en arabe) quand on connaît le prénom du visiteur.
// Les deux langues suivent la même interface : TypeScript vérifie qu'aucun texte ne manque.

export const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// 1 -> 1ᵉʳ, 3 -> 3ᵉ
export const ordinalFr = (n: number) => (n === 1 ? '1ᵉʳ' : `${n}ᵉ`);

export interface Range {
  min: number;
  max: number; // Infinity : pas de plafond
}

// Ce que le récapitulatif de commande montre (tout vient du panier vérifié et des réponses du client)
export interface RecapData {
  lines: { name: string; variant: string; qty: number; subtotal: number }[];
  city: string;
  fee: number | null; // null : frais à confirmer par l'équipe
  gift: boolean;
  total: number;
  name: string;
  phone: string;
  address: string;
  method: PayMethodKey;
}

// Programme de fidélité : les paliers et la règle des points viennent de lib/loyalty.ts (les mêmes que la page « Mon compte »).
export interface LoyaltyAnswer {
  points: number;
  tier: LoyaltyTier['key'];
  next: { key: LoyaltyTier['key']; missing: number } | null;
}
const TIER_AR: Record<LoyaltyTier['key'], string> = { bronze: 'البرونزية', argent: 'الفضية', or: 'الذهبية', platine: 'البلاتينية', diamond: 'الماسية' };
const tierOf = (key: LoyaltyTier['key']) => LOYALTY_TIERS.find((t) => t.key === key) ?? LOYALTY_TIERS[0];
const FR_POINTS = (n: number) => `${n} point${n > 1 ? 's' : ''}`;
const AR_POINTS = (n: number) => (n === 1 ? 'نقطة واحدة' : n === 2 ? 'نقطتان' : n >= 3 && n <= 10 ? `${n} نقاط` : `${n} نقطة`);
// « presque au grade suivant » : le ton change quand il ne manque pas beaucoup de points
const CLOSE_TO_NEXT = 15;
const fcfaGroup = (n: number) => Math.round(n).toLocaleString('fr-FR');

export interface Texts {
  dir: 'ltr' | 'rtl';
  roleTitle: string;
  // Accueil chaleureux : prénom, VRAI rang du jour (rank : null si on ne le connaît pas, jamais inventé), invitation.
  // greeted : le prénom a déjà été dit dans le tout premier message (celui de la langue), on ne redit pas le bonjour.
  welcome(name: string | null, rank: number | null, greeted: boolean): string;
  teaser(name: string | null): string;
  // première ligne du tout premier message (avant le choix de la langue) quand on connaît le prénom
  hello(name: string): string;
  // client qui vient de se connecter pendant la conversation
  memberBack(name: string): string;
  teaserMember(name: string): string;
  askName: string;
  askNameGuest: string;
  askNameMember: string;
  nice(name: string): string;
  footer: string;
  placeholder: { message: string; name: string; city: string; amount: string; fullName: string; phone: string; address: string };
  ui: { writing: string; close: string; reset: string; send: string; input: string; whatsappPill: string; whatsappAria: string; closeTeaser: string; otherLang: string };
  chooseLang: string;
  fabLabel: string;
  openLabel: string;
  card: { see: string; soldOut: string; last: string; only(n: number): string; addLabel(name: string): string };
  langSwitched: string;
  chip: {
    skip: string;
    createAccount: string;
    login: string;
    promotions: string;
    news: string;
    advice: string;
    categories: string;
    delivery: string;
    cart: string;
    orders: string;
    whatsapp: string;
    menu: string;
    budget: string;
    withCategory(name: string): string;
    seeShop: string;
    shopAddress: string;
    payCash: string;
    payAirtel: string;
    payMoov: string;
    giftYes: string;
    giftNo: string;
    confirmOrder: string;
    editOrder: string;
    cancelOrder: string;
    editName: string;
    editPhone: string;
    editAddress: string;
    editCity: string;
    editPay: string;
    editGift: string;
    useAddress(address: string): string;
    orderPage: string;
    retry: string;
    points: string;
    earnPoints: string;
    myAccount: string;
    giftIdea: string;
    wrap: string;
    policy: string;
    otherLang: string;
    viewCart: string;
    checkout: string;
    moreItems: string;
    cancel: string;
    installApp: string;
    installHelp: string;
    alreadyInstalled: string;
    tutorial: string;
    notNow: string;
    idk: string;
    anyBudget: string;
    giftWho: Record<Who, string>;
    shopWho: Record<Who, string>;
    budgets: string[];
  };
  // accueil et menu
  info: string;
  accountInvite: string;
  accountExplain: string;
  menuIntro: string;
  menuIntroNamed: string;
  // politesse et conversation : plusieurs phrases par situation (Zara ne dit pas deux fois la même de suite)
  talk: {
    hello(kind: GreetingKind, known: boolean): string[];
    helloWord(kind: GreetingKind): string;
    fine: string[];
    thanks: string[];
    thanksMuch: string[];
    afterCompliment: string[];
    compliment: string[];
    goodbye(kind: GoodbyeKind): string[];
    personal(kind: PersonalKind): string[];
  };
  // programme de fidélité : le grade et les points viennent du compte du client (relus dans la base) ; rien n'est inventé
  loyalty: {
    mine(d: LoyaltyAnswer): string;
    earn: string;
    tiers: string;
    needLogin: string;
    unavailable: string;
    orderPoints(n: number): string;
    mineQuery: string;
    earnQuery: string;
  };
  // commande finalisée dans la conversation : mêmes règles et même enregistrement que la page de commande du site
  checkout: {
    intro: string;
    askName: string;
    askPhone: string;
    badPhone: string;
    askAddress: string;
    askCity: string;
    askPay(home: boolean): string;
    askGift: string;
    methodLabel(method: PayMethodKey): string;
    recap(d: RecapData): string;
    pickButton: string;
    editWhat: string;
    cancelled: string;
    resumeLost: string;
    priceChanged: string;
    codOnlyHome: string;
    placed(name: string, id: string): string;
    totalToPay(total: number): string;
    giftIncluded: string;
    payCash: string;
    payInitiated(label: string, message: string): string;
    payUrl(url: string): string;
    payNumber(amount: number, number: string, label: string): string;
    payTeam(phone: string, label: string): string;
    failed: string;
  };
  bot: string;
  alreadyMember: string;
  ordersLink: string;
  errorData: string;
  errorOops: string;
  // produits
  promoIntro(pct: number | null): string;
  noPromo: string;
  newIntro: string;
  chooseCategory: string;
  foundFor(q: string, range: string | null): string;
  fallbackFor(q: string, range: string): string;
  nothingFor(text: string): string;
  // conseil
  askNeed: string;
  askBudget: string;
  bestPicks: string;
  budgetBest(range: string): string;
  budgetFallback(range: string): string;
  budgetNothing: string;
  askGift: string;
  askWho(gift: boolean): string;
  askType(who: Who, gift: boolean): string;
  giftIntro(who: Who): string;
  noGift: string;
  pairIntro(category: string): string;
  // marché
  rangeText(r: Range): string;
  lowStock(name: string, n: number): string;
  pitch(name: string, price: string, n: number | null): string;
  cartReminder(count: number, total: number): string;
  priceReply(maxPct: number | null): string;
  cheaperIntro: string;
  noCheaper: string;
  trust(where: string, phone: string | null): string;
  later: string;
  about: string;
  returns: string;
  wrapReply: string;
  wrapPitch: string;
  encouragements: string[];
  whyAdvice(name: string, reasons: string[]): string;
  why: {
    discount(pct: number, price: number, old: number): string;
    budget: string;
    lowStock(n: number): string;
    colors(list: string): string;
    sizes(list: string): string;
    inStock: string;
    cheapest: string;
  };
  // livraison, règles
  askCity: string;
  cityNotFound(name: string): string;
  cityHome: string;
  cityFee(city: string, fee: string, agency: string | null): string;
  cityNoFee(city: string, agency: string | null): string;
  cityPay: string;
  serviceNote(home: boolean): string;
  rules: string;
  contact: { hours(h: string): string; delivery: string; ask: string };
  howToOrder: string;
  // panier dans la conversation
  cart: {
    added(name: string, variant: string, count: number, total: number): string;
    askSize(name: string): string;
    askColor(name: string): string;
    sizeLabel(size: string): string;
    cancelled: string;
    unavailable(name: string): string;
    unavailableAlt: string;
    noMoreStock(name: string, stock: number): string;
    addError: string;
    empty: string;
    show: string;
    verified: string;
    needLogin: string;
    priceChanged(name: string, from: string, to: string): string;
    blocked(name: string, stock: number): string;
    askWhich: string;
    addWhat: string;
    foundToAdd: string;
    tapPlus: string;
    wrapNudge: string;
    ui: {
      view: string;
      subtotal: string;
      saved: string;
      delivery: string;
      deliveryLater: string;
      deliveryTo(city: string): string;
      free: string;
      toConfirm: string;
      total: string;
      totalWithDelivery: string;
      checkout: string;
      openFull: string;
      remove(name: string): string;
      more(name: string): string;
      less(name: string): string;
      items(n: number): string;
      unitPrice: string;
    };
  };
  // installation de l'application (raccourci sur l'écran d'accueil)
  install: {
    ask: string;
    yes: string;
    photoHint: string;
    photoAlt: string;
    offer: string;
    accepted: string;
    declined: string;
    later: string;
    already: string;
    iosSteps(safari: boolean): string;
    androidManual: string;
    desktop: string;
  };
  // suggestions discrètes d'après les articles regardés (jamais à chaque clic, jamais sans raison vraie)
  interest: {
    shoes: string;
    clothing: string;
    perfumeOne: string;
    perfumeBrowse: string;
    other: string;
    category: string;
    chip: { sizes: string; colors: string; similar: string; similarPerfume: string; more: string; noThanks: string; family: Record<'fresh' | 'woody' | 'sweet' | 'intense', string> };
    familyLabel: Record<'fresh' | 'woody' | 'sweet' | 'intense', string>;
    sizesReply(name: string, sizes: string[]): string;
    noSizes(name: string): string;
    colorsReply(name: string, colors: string[], sizes: string[]): string;
    similarIntro: string;
    similarNone: string;
    familyIntro(label: string): string;
    familyNone(label: string): string;
    moreIntro(category: string): string;
    moreNone: string;
    no: string;
    gone: string;
  };
  // les moments forts (aucune remise annoncée : seulement des idées, et les vraies promotions pour le Black Friday)
  occasion: {
    tabaski: string;
    ramadan: string;
    korite: string;
    wedding: string;
    mothersDay: string;
    valentine: string;
    blackFriday: string;
  };
  // achat en gros : Zara ne donne aucun prix de gros, elle passe la main à l'équipe sur WhatsApp
  wholesale: {
    ask: string;
    nudge: string;
    chip: string;
    prefill(product: string | null): string;
  };
  // un client qui écrit lui-même « ne me suis plus » : Zara obéit (le suivi n'est jamais mis en avant)
  tracking: {
    stopped: string;
    stoppedAlready: string;
    unavailable: string;
  };
}

// ---------------------------------------------------------------------------------------------
// Français
// ---------------------------------------------------------------------------------------------

const FR: Texts = {
  dir: 'ltr',
  roleTitle: 'Assistante marketing',
  welcome: (name, rank, greeted) =>
    `${greeted ? '' : `Salut${name ? ` ${name}` : ''} ! 😍👋 `}Bienvenue chez Albasse Shopping ! ${rank ? `Vous êtes mon ${ordinalFr(rank)} client aujourd’hui, ça` : 'Ça'} me fait plaisir de vous accueillir ! 🥰🛍️\nDites-moi, qu’est-ce qui vous ferait plaisir aujourd’hui ? Je suis là pour vous aider à trouver les meilleurs articles ! ❤️`,
  teaser: (name) => `Bonjour${name ? ` ${name}` : ''} ! Je suis ${ASSISTANT_NAME}, l'${ASSISTANT_ROLE} d'Albasse Shopping. 😊`,
  hello: (name) => `Salut ${name} ! 😍👋`,
  memberBack: (name) => `Salut ${name} ! 😍👋 Vous êtes bien connecté(e), ça me fait plaisir de vous retrouver ! 🥰`,
  teaserMember: (name) => `Salut ${name} ! 😍👋 ${ASSISTANT_NAME} est à votre service 🛍️`,
  askName: 'Comment puis-je vous appeler ?',
  askNameGuest: 'Comment puis-je vous appeler ? Si vous avez déjà un compte, connectez-vous : je vous reconnaîtrai 😊',
  askNameMember: 'Je vois que vous êtes connecté(e) 😊 Votre compte n’a pas encore de prénom : comment puis-je vous appeler ?',
  nice: (name) => `Enchantée ${name} ! 😊`,
  footer: `${ASSISTANT_NAME} est une assistante automatique. Pour une commande ou un souci, écrivez-nous sur WhatsApp.`,
  placeholder: { message: 'Écrivez votre message…', name: 'Écrivez votre prénom…', city: 'Écrivez votre ville…', amount: 'Écrivez un montant…', fullName: 'Écrivez votre nom complet…', phone: 'Ex. 66123456', address: 'Quartier, rue, repère…' },
  ui: {
    writing: 'Zara est en train d’écrire…',
    close: 'Fermer',
    reset: 'Recommencer la conversation',
    send: 'Envoyer',
    input: 'Votre message',
    whatsappPill: 'WhatsApp',
    whatsappAria: 'Parler à l’équipe sur WhatsApp',
    closeTeaser: 'Fermer la bulle',
    otherLang: 'العربية',
  },
  chooseLang: 'Choisissez votre langue',
  fabLabel: `Discuter avec ${ASSISTANT_NAME}, l'${ASSISTANT_ROLE}`,
  openLabel: `Ouvrir la discussion avec ${ASSISTANT_NAME}`,
  card: { see: 'Voir le produit ›', soldOut: 'Épuisé', last: 'Dernier en stock', only: (n) => `Plus que ${n} en stock`, addLabel: (name) => `Ajouter au panier : ${name}` },
  langSwitched: 'Très bien, on continue en français 😊',
  chip: {
    skip: 'Passer',
    createAccount: '👤 Créer mon compte',
    login: 'Me connecter',
    promotions: '🔥 Promotions',
    news: '🆕 Nouveautés',
    advice: '🎯 Conseil',
    categories: '🛍️ Catégories',
    delivery: '🚚 Livraison et paiement',
    cart: '🛒 Mon panier',
    orders: '📦 Mes commandes',
    whatsapp: '💬 WhatsApp',
    menu: '🏠 Menu',
    budget: '💰 Mon budget',
    withCategory: (name) => `➕ Avec : ${name}`,
    seeShop: '📍 Voir la boutique',
    shopAddress: '📍 Adresse de la boutique',
    payCash: '💵 À la livraison',
    payAirtel: '📱 Airtel Money',
    payMoov: '📲 Moov Money',
    giftYes: `🎁 Oui (+${fcfa(GIFT_WRAP_FEE)})`,
    giftNo: 'Non, merci',
    confirmOrder: '✅ Confirmer la commande',
    editOrder: '✏️ Modifier',
    cancelOrder: 'Annuler la commande',
    editName: '👤 Nom',
    editPhone: '📞 Téléphone',
    editAddress: '📍 Adresse',
    editCity: '🏙️ Ville',
    editPay: '💳 Paiement',
    editGift: '🎁 Emballage',
    useAddress: (address) => `📍 Utiliser : ${address.length > 26 ? `${address.slice(0, 25).trimEnd()}…` : address}`,
    orderPage: '📄 Page de commande',
    retry: '🔄 Réessayer',
    points: '🏆 Mes points',
    earnPoints: '🎁 Gagner des points',
    myAccount: '👤 Mon compte',
    giftIdea: '🎁 Idée cadeau',
    wrap: '🎁 Emballage cadeau',
    policy: '📄 Conditions de retour',
    otherLang: '🌐 العربية',
    viewCart: '🛒 Voir mon panier',
    checkout: '✅ Commander',
    moreItems: '🛍️ Autres articles',
    cancel: 'Annuler',
    installApp: '📲 Installer Albasse Shopping',
    installHelp: '📲 Voir comment installer',
    alreadyInstalled: '✅ Oui, déjà installée',
    tutorial: '🎬 Voir le tutoriel',
    notNow: 'Plus tard',
    idk: '🤷 Je ne sais pas',
    anyBudget: 'Peu importe',
    giftWho: { elle: '👩 Pour elle', lui: '👨 Pour lui', enfant: '👶 Pour un enfant' },
    shopWho: { lui: '👨 Pour un homme', elle: '👩 Pour une femme', enfant: '👶 Pour un enfant' },
    budgets: ['💰 Moins de 10 000 FCFA', '💰 10 000 à 30 000 FCFA', '💰 30 000 à 100 000 FCFA', '💰 Plus de 100 000 FCFA'],
  },
  info: [
    'ℹ️ À savoir avant de commander :',
    `🚚 Nos services de livraison sont ouverts de ${DELIVERY_HOURS}.`,
    `💵 Paiement à la livraison : seulement à ${HOME_CITY}. Dans les autres villes, le paiement se fait à l'avance (Airtel Money ou Moov Money).`,
    `⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h.`,
  ].join('\n'),
  accountInvite: 'Créez votre compte gratuit{nom} : suivez vos commandes, retrouvez vos favoris ❤️, gagnez des points fidélité et tournez la roue de la chance 🎡 !',
  accountExplain: 'Créer un compte est gratuit et rapide : vous suivez vos commandes, retrouvez vos favoris ❤️, gagnez des points fidélité et tournez la roue de la chance 🎡.',
  menuIntro: 'Que souhaitez-vous découvrir aujourd’hui ? 🛍️',
  menuIntroNamed: 'Que souhaitez-vous découvrir{nom} ? 🛍️',
  talk: {
    hello: (kind, known) => {
      switch (kind) {
        case 'evening':
          return ['Bonsoir{nom} 😊 Bienvenue chez Albasse Shopping ! Comment puis-je vous aider ?', 'Bonsoir{nom} ! 🌙 Ravie de vous voir. Que recherchez-vous ce soir ?'];
        case 'hi':
          return known
            ? ['Salut{nom} 😊 Ravie de vous retrouver ! Que recherchez-vous aujourd’hui ?', 'Salut{nom} ! 😊 Contente de vous revoir. Comment puis-je vous aider ?']
            : ['Salut{nom} 😊 Ravie de vous voir ! Que recherchez-vous aujourd’hui ?', 'Salut{nom} ! 😊 Bienvenue chez Albasse Shopping. Comment puis-je vous aider ?'];
        case 'salam':
          return ['Wa alaykoum salam{nom} 😊 Bienvenue chez Albasse Shopping ! Comment puis-je vous aider ?', 'Salam{nom} ! 😊 Ravie de vous accueillir. Que puis-je faire pour vous ?'];
        default:
          return ['Bonjour{nom} 😊 Bienvenue chez Albasse Shopping ! Comment puis-je vous aider aujourd’hui ?', 'Bonjour{nom} ! 😊 Ravie de vous accueillir. Que puis-je faire pour vous aujourd’hui ?'];
      }
    },
    helloWord: (kind) => (kind === 'evening' ? 'Bonsoir !' : kind === 'hi' ? 'Salut !' : kind === 'salam' ? 'Salam !' : 'Bonjour !'),
    fine: [
      'Très bien, merci 😊 Et vous ? Que puis-je faire pour vous aujourd’hui ?',
      'Je vais très bien, merci ! 😊 J’espère que vous aussi. Comment puis-je vous aider ?',
      'Ça va très bien, merci ! 😊 Et de votre côté ? Dites-moi ce qui vous ferait plaisir aujourd’hui 🛍️',
    ],
    thanks: [
      'Avec plaisir{nom} 😊 Je suis là pour vous aider !',
      'Je vous en prie{nom} 😊 N’hésitez pas si vous avez besoin de quoi que ce soit.',
      'Avec plaisir ! ❤️ Je reste là si vous avez d’autres questions.',
    ],
    thanksMuch: [
      'C’est avec plaisir{nom} ! ❤️ N’hésitez pas si vous avez besoin d’autre chose.',
      'Merci à vous{nom} ! 😊 Je suis là dès que vous avez besoin de moi.',
      'Avec grand plaisir{nom} ! ❤️ Je suis toujours là pour vous aider.',
    ],
    afterCompliment: [
      'Avec grand plaisir ! 😊❤️ Je suis toujours là pour vous aider. Dites-moi, qu’est-ce qui vous ferait plaisir aujourd’hui ? 🛍️',
      'Avec plaisir ! 😊 Je suis là quand vous voulez. Que puis-je faire pour vous aujourd’hui ? 🛍️',
    ],
    compliment: [
      'Oh, merci beaucoup ! 🥰 Vous êtes adorable ! Je suis votre assistante virtuelle Zara, toujours là pour vous aider 😊❤️🛍️',
      'Oh, c’est très gentil, merci ! 🥰 Je suis Zara, votre assistante virtuelle : je suis là pour vous aider 😊❤️',
      'Merci beaucoup, c’est adorable ! 😊❤️ Zara, votre assistante virtuelle, est toujours là pour vous aider 🛍️',
    ],
    goodbye: (kind) => {
      switch (kind) {
        case 'night':
          return ['Bonne nuit à vous aussi 🌙 Merci pour votre visite !', 'Bonne nuit 🌙 Merci pour votre visite, à très bientôt sur Albasse Shopping !'];
        case 'evening':
          return ['Bonne soirée à vous aussi 🌙 Merci pour votre visite !', 'Bonne soirée ! 🌙 Au plaisir de vous revoir sur Albasse Shopping.'];
        case 'day':
          return ['Bonne journée à vous aussi ☀️ Merci pour votre visite !', 'Bonne journée ! ☀️ Au plaisir de vous revoir sur Albasse Shopping.'];
        default:
          return ['Au plaisir de vous revoir sur Albasse Shopping ! 😊', 'Au revoir ! 😊 Merci pour votre visite, à très bientôt.'];
      }
    },
    personal: (kind) => {
      const shop = '\nPour l’adresse de la boutique, touchez le bouton ci-dessous 👇';
      const team = '\nPour joindre l’équipe de la boutique, touchez le bouton WhatsApp ci-dessous 👇';
      switch (kind) {
        case 'address':
          return [
            `😊 Je suis votre assistante virtuelle, disponible en ligne pour vous aider ! Vous pouvez me retrouver ici sur Albasse Shopping.${shop}`,
            `😊 Je n’ai pas d’adresse comme une personne : je suis une assistante virtuelle, je travaille en ligne, ici, sur Albasse Shopping, et je suis là pour vous aider à tout moment !${shop}`,
          ];
        case 'live':
          return [
            'Haha 😊 Je n’ai pas de domicile comme une personne. Je suis votre assistante virtuelle en ligne, toujours prête à vous aider à découvrir nos articles !',
            'Haha 😊 Je n’ai pas de maison : je suis une assistante virtuelle, toujours disponible ici pour vous aider dans vos achats !',
          ];
        case 'whatsapp':
          return [
            `Haha 😊 Je n’ai pas de WhatsApp personnel. Je suis votre assistante virtuelle en ligne. Vous pouvez continuer à discuter avec moi ici pour découvrir nos articles et préparer votre commande.${team}`,
            `😊 Je n’ai pas de WhatsApp à moi : je suis une assistante virtuelle en ligne. Posez-moi vos questions ici, je vous aide avec plaisir !${team}`,
          ];
        case 'call':
          return [
            `😊 Je comprends ! Je suis une assistante virtuelle qui travaille en ligne et je n’ai pas de numéro personnel. Je peux toutefois vous aider ici pour vos achats.${team}`,
            `😊 Je ne peux pas recevoir d’appels : je suis une assistante virtuelle en ligne. Mais je suis là, ici, pour vous aider dans vos achats !${team}`,
          ];
        case 'life':
          return [
            '😊 Je suis une assistante virtuelle : je n’ai pas de vie personnelle comme une personne. Mais je suis toujours là pour vous aider à trouver ce qu’il vous faut !',
            'Haha 😊 Je suis une assistante virtuelle, sans famille ni vie privée ! Ma mission : vous aider à bien acheter sur Albasse Shopping 🛍️',
          ];
        default:
          return [
            `😊 Je n’ai pas de numéro personnel. Je travaille en ligne comme assistante virtuelle de marketing digital chez Albasse Shopping. Je suis là pour vous aider directement ici !${team}`,
            `😊 Je n’ai pas de téléphone personnel : je suis une assistante virtuelle en ligne. Posez-moi vos questions ici, je suis là pour vous aider !${team}`,
          ];
      }
    },
  },
  loyalty: {
    mine: (d) => {
      const cur = tierOf(d.tier);
      const nxt = d.next ? tierOf(d.next.key) : null;
      const pts = `⭐ Vos points : ${d.points}`;
      if (!nxt || !d.next) return `Félicitations ! 🎉 Votre grade actuel chez Albasse Shopping est ${cur.label} ${cur.icon} : c’est le plus haut grade du programme ! Merci pour votre fidélité 🛍️❤️\n${pts}`;
      if (d.tier === 'bronze')
        return `Bienvenue dans notre programme de fidélité ! ${cur.icon} Vous êtes actuellement au grade ${cur.label}. Chaque achat éligible sur albasseshopping.com vous permet de gagner des points. Continuez vos achats pour vous rapprocher du grade ${nxt.label} ! 🎁\n${pts}\nIl vous manque ${FR_POINTS(d.next.missing)} pour atteindre le grade ${nxt.label} ${nxt.icon}.`;
      if (d.next.missing <= CLOSE_TO_NEXT)
        return `Bonne nouvelle ! 😍 Vous êtes au grade ${cur.label} ${cur.icon} et il ne vous manque que ${FR_POINTS(d.next.missing)} pour atteindre le grade ${nxt.label} ${nxt.icon} ! Continuez à profiter de nos articles sur albasseshopping.com. Chaque achat éligible vous rapproche de votre objectif ! 🎁\n${pts}`;
      return `Félicitations ! 🎉 Votre grade actuel chez Albasse Shopping est ${cur.label} ${cur.icon}.\n${pts}\nIl vous manque ${FR_POINTS(d.next.missing)} pour atteindre le grade ${nxt.label} ${nxt.icon}.\nContinuez à acheter sur albasseshopping.com pour gagner des points de fidélité et progresser vers le grade supérieur ! 🛍️❤️`;
    },
    earn: `C’est simple ! 😊 Achetez vos articles sur https://albasseshopping.com et gagnez des points de fidélité selon les règles du programme. Plus vous progressez, plus vous vous rapprochez des grades supérieurs ! 🛍️💎\n📌 La règle : 1 point pour chaque tranche de ${fcfaGroup(LOYALTY_FCFA_PER_POINT)} FCFA du total d’une commande livrée (les points arrivent une fois la commande livrée).\n🏆 Les grades : ${LOYALTY_TIERS.map((t) => `${t.icon} ${t.label} (${t.min === 0 ? 'au départ' : FR_POINTS(t.min)})`).join(' · ')}`,
    tiers: `Voici les ${LOYALTY_TIERS.length} grades de notre programme de fidélité : ${LOYALTY_TIERS.map((t) => `${t.icon} ${t.label} (${t.min === 0 ? 'au départ' : FR_POINTS(t.min)})`).join(' · ')}.\n📌 La règle : 1 point pour chaque tranche de ${fcfaGroup(LOYALTY_FCFA_PER_POINT)} FCFA du total d’une commande livrée.`,
    needLogin: 'Pour connaître votre grade et vos points de fidélité, connectez-vous à votre compte sur albasseshopping.com 😊 Pas encore de compte ? Créez-le gratuitement : chaque achat éligible vous fait gagner des points ! 🎁',
    unavailable: 'Je n’arrive pas à lire vos points pour le moment 😕 Vous pouvez consulter votre grade et vos points dans votre compte sur albasseshopping.com, ou réessayer dans un instant.',
    orderPoints: (n) => `🎁 Fidélité : cette commande vous rapportera ${FR_POINTS(n)} une fois livrée.`,
    mineQuery: 'mes points de fidélité',
    earnQuery: 'comment gagner des points',
  },
  checkout: {
    intro: 'Très bien, finalisons votre commande ensemble 🛍️ Quelques questions rapides, et c’est fait !',
    askName: 'Quel est le nom complet de la personne qui va recevoir la commande ? 👤',
    askPhone: 'Quel est votre numéro de téléphone ? 8 chiffres, commençant par 6 ou 9 (ex. 66123456) 📞',
    badPhone: 'Le numéro doit contenir 8 chiffres et commencer par 6 ou 9 (ex. 66123456). Pouvez-vous le réécrire ? 📞',
    askAddress: 'Quelle est votre adresse de livraison ? Quartier, rue, repère… 📍',
    askCity: 'Dans quelle ville doit-on vous livrer ? 🚚',
    askPay: (home) =>
      home
        ? `Comment souhaitez-vous payer ? 💳\n💵 À la livraison (${HOME_CITY}), ou à l’avance par Airtel Money ou Moov Money.`
        : 'Dans votre ville, le paiement se fait à l’avance par Mobile Money 📱 Choisissez Airtel Money ou Moov Money.',
    askGift: `🎁 Souhaitez-vous l’emballage cadeau ? C’est ${fcfa(GIFT_WRAP_FEE)}.`,
    methodLabel: (m) => (m === 'airtel_money' ? 'Airtel Money' : m === 'moov_money' ? 'Moov Money' : 'Paiement à la livraison'),
    recap: (d) =>
      [
        '📝 Récapitulatif de votre commande :',
        ...d.lines.map((l) => `• ${l.name}${l.variant} × ${l.qty} : ${fcfa(l.subtotal)}`),
        `🚚 Livraison à ${d.city} : ${d.fee === null ? 'à confirmer par l’équipe' : d.fee === 0 ? 'gratuite' : fcfa(d.fee)}`,
        ...(d.gift ? [`🎁 Emballage cadeau : ${fcfa(GIFT_WRAP_FEE)}`] : []),
        `💰 Total : ${fcfa(d.total)}`,
        `👤 ${d.name} · 📞 ${d.phone}`,
        `📍 ${d.address}, ${d.city}`,
        d.method === 'cash_on_delivery' ? '💵 Paiement à la livraison, en espèces' : `📱 Paiement à l’avance par ${d.method === 'airtel_money' ? 'Airtel Money' : 'Moov Money'}`,
        'Tout est correct ? Touchez « Confirmer la commande » pour l’enregistrer 👇',
      ].join('\n'),
    pickButton: 'Touchez un des boutons ci-dessous pour continuer 👇',
    editWhat: 'Que voulez-vous modifier ? ✏️',
    cancelled: 'D’accord, j’ai arrêté la commande. Votre panier est gardé 🛒 Vous pouvez la reprendre quand vous voulez.',
    resumeLost: 'Je ne retrouve plus les informations de cette commande. Touchez « Commander » pour la reprendre 🙂',
    priceChanged: 'Les prix ou le stock ont changé : voici le nouveau récapitulatif. Vérifiez, puis confirmez à nouveau 👇',
    codOnlyHome: `Le paiement à la livraison est possible seulement à ${HOME_CITY}. Choisissez Airtel Money ou Moov Money 📱`,
    placed: (name, id) => `🎉 Merci ${name} ! Votre commande #${id} a bien été enregistrée.`,
    totalToPay: (total) => `💰 Total à régler : ${fcfa(total)}`,
    giftIncluded: `🎁 Emballage cadeau inclus (${fcfa(GIFT_WRAP_FEE)})`,
    payCash: '💵 Vous payez en espèces directement à la livraison.',
    payInitiated: (label, message) => `📱 Paiement ${label} initié. ${message}`,
    payUrl: (url) => `📱 Payez ici : ${url}`,
    payNumber: (amount, number, label) => `📱 Envoyez ${fcfa(amount)} au ${number} (${label}).`,
    payTeam: (phone, label) => `📞 Notre équipe vous contactera au ${phone} pour finaliser le paiement ${label}.`,
    failed: '😕 Je n’ai pas pu enregistrer votre commande pour le moment. Votre panier est gardé. Vous pouvez réessayer, finaliser sur la page de commande, ou nous écrire sur WhatsApp.',
  },
  bot: 'Je suis l’assistante virtuelle d’Albasse Shopping : une assistante automatique, pas une personne. Pour parler à quelqu’un de l’équipe, écrivez-nous sur WhatsApp 👇',
  alreadyMember: 'Vous êtes déjà connecté(e){nom} ✅ Retrouvez vos commandes à tout moment.',
  ordersLink: 'Retrouvez et suivez toutes vos commandes ici 👇',
  errorData: 'Je n’arrive pas à charger ces informations pour le moment. Réessayez dans un instant, ou écrivez-nous sur WhatsApp.',
  errorOops: 'Oups, un petit souci de mon côté 😅 Réessayez dans un instant, ou écrivez-nous sur WhatsApp.',
  promoIntro: (pct) => `🔥 Voici nos meilleures promotions du moment${pct ? ` (jusqu’à -${pct} %)` : ''}{nom} !`,
  noPromo: 'Pas de promotion en ce moment, mais découvrez nos nouveautés !',
  newIntro: '🆕 Voici nos dernières nouveautés{nom} !',
  chooseCategory: 'Choisissez une catégorie 👇',
  foundFor: (q, range) => `Voici ce que j’ai trouvé pour « ${q} »${range ? ` ${range}` : ''}{nom} :`,
  fallbackFor: (q, range) => `Je n’ai rien ${range} pour « ${q} ». Voici ce qui s’en approche le plus :`,
  nothingFor: (text) => `Je n’ai rien trouvé pour « ${text} » 😕 Dites-moi ce que vous aimez, je vous conseille, ou parcourez nos catégories.`,
  askNeed: 'Avec plaisir{nom} ! Je suis là pour vous conseiller. Que cherchez-vous ?',
  askBudget: 'Quel est votre budget{nom} ? Touchez une option ou écrivez un montant (ex. 20 000) 💰',
  bestPicks: 'Voici mes meilleurs choix{nom} :',
  budgetBest: (range) => `Voici mes meilleurs choix ${range}{nom} :`,
  budgetFallback: (range) => `Je n’ai rien ${range} pour cette sélection. Voici ce qui s’en approche le plus :`,
  budgetNothing: 'Je n’ai rien trouvé pour cette sélection 😕 Essayons autre chose ?',
  askGift: 'Quelle belle idée{nom} ! 🎁 Pour qui est le cadeau ?',
  askWho: (gift) => (gift ? 'Avec plaisir{nom} ! 🎁 C’est pour qui ?' : 'Très bien{nom} ! C’est pour qui ?'),
  askType: (who, gift) => {
    const to = who === 'lui' ? 'lui' : who === 'elle' ? 'elle' : 'un enfant';
    return gift ? `Quel genre de cadeau pour ${to} ?` : `Quel type d’article pour ${to} ?`;
  },
  giftIntro: (who) => `Voici mes idées cadeaux pour ${who === 'lui' ? 'lui' : who === 'elle' ? 'elle' : 'un enfant'}{nom} 🎁`,
  noGift: 'Je n’ai pas encore d’idée pour ce cadeau. Voyons nos promotions ?',
  pairIntro: (category) => `Pour compléter votre achat{nom}, voici nos ${category.toLowerCase()} 👇`,
  rangeText: (r) => {
    if (!Number.isFinite(r.max)) return r.min > 0 ? `à partir de ${fcfa(r.min)}` : 'sans limite de budget';
    if (r.min <= 0) return `à moins de ${fcfa(r.max)}`;
    return `entre ${fcfa(r.min)} et ${fcfa(r.max)}`;
  },
  lowStock: (name, n) => (n === 1 ? `⚠️ « ${name} » : il n’en reste qu’un en stock !` : `⚠️ « ${name} » : plus que ${n} en stock !`),
  pitch: (name, price, n) =>
    `Vous regardez « ${name} » ? Excellent choix ! ${price}.${n === null ? '' : `\n${n === 1 ? 'Il n’en reste qu’un en stock' : `Plus que ${n} en stock`} : ne tardez pas !`}\nPour le commander, touchez « Acheter » en bas de l’écran 👇`,
  cartReminder: (count, total) => `🛒 Votre panier vous attend : ${count} article${count > 1 ? 's' : ''} pour ${fcfa(total)}. Terminez votre commande en quelques secondes !`,
  priceReply: (pct) =>
    [
      'Je comprends 😊 Un bon achat, c’est la qualité au bon prix. Voici comment payer moins :',
      `🔥 profitez de nos promotions${pct ? ` (jusqu’à -${pct} %)` : ''}`,
      '💰 dites-moi votre budget : je vous montre mes meilleurs choix',
      `🚚 à ${HOME_CITY}, la livraison est gratuite`,
    ].join('\n'),
  cheaperIntro: 'Je comprends{nom}. Voici des alternatives moins chères :',
  noCheaper: 'C’est déjà le prix le plus bas de cette sélection. Je peux vous montrer nos promotions, ou chercher dans un autre budget 😊',
  trust: (where, phone) =>
    [
      'Votre confiance compte pour nous 🤝 Albasse Shopping, c’est la première plateforme de vente en ligne du Tchad, depuis 2013 : Service, Qualité, Garantie.',
      `💵 À ${HOME_CITY}, vous ne payez qu’en recevant votre commande.`,
      where ? `📍 Boutique : ${where}` : null,
      phone ? `📞 ${phone}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  later: 'Pas de souci{nom} 😊 Prenez votre temps. Touchez le cœur ❤️ sur un produit pour le retrouver dans vos favoris (avec un compte gratuit). Je reste là si vous avez une question !',
  about: 'Albasse Shopping est la première plateforme de vente en ligne du Tchad. Nous sommes dans ce domaine depuis 2013 : Service, Qualité, Garantie 🤝\nNotre site officiel : https://albasseshopping.com',
  returns: [
    '↩️ Nos conditions de retour :',
    '• Article incorrect ou défectueux : contactez-nous dans les 72 h après la réception, avec une photo ou une vidéo. Après vérification, les frais de retour sont à notre charge.',
    '• Erreur de taille : échange possible (article non porté, non lavé, avec ses étiquettes). Les frais de retour sont alors à votre charge.',
    '• Dans tous les cas, gardez l’article et son emballage d’origine jusqu’à la confirmation du retour.',
  ].join('\n'),
  wrapReply: `🎁 Emballage cadeau : pour ${fcfa(GIFT_WRAP_FEE)} par commande, votre colis arrive joliment emballé. Touchez l’image cadeau au moment de commander, ou dans « Mes commandes » tant que votre commande est en attente.`,
  wrapPitch: `🎁 Offrez-le joliment emballé : emballage cadeau à ${fcfa(GIFT_WRAP_FEE)} par commande (touchez l’image cadeau en commandant).`,
  encouragements: [
    'Touchez « Voir le produit » puis « Acheter » : c’est simple et rapide ! 🛍️',
    'À N’Djamena, la livraison est gratuite et vous payez à la livraison : commandez sans risque 😉',
    'Profitez-en tant qu’il y a du stock ! 🔥',
    'Une belle occasion de vous faire plaisir (ou d’offrir) ! 🎁',
    'Besoin d’un coup de main pour choisir ? Dites-moi votre budget, je vous guide 😊',
    'Un doute ? Je suis là pour répondre, sans engagement 🤝',
    'Votre commande se suit ensuite dans « Mes commandes » 📦',
    `Nos services de livraison sont ouverts de ${DELIVERY_HOURS} 🚚`,
  ],
  whyAdvice: (name, reasons) => `Mon conseil{nom} : « ${name} » — ${reasons.join(' · ')}.`,
  why: {
    discount: (pct, price, old) => `${pct} % de remise : ${fcfa(price)} au lieu de ${fcfa(old)}`,
    budget: 'dans votre budget',
    lowStock: (n) => (n === 1 ? 'le dernier en stock' : `plus que ${n} en stock`),
    colors: (list) => `disponible en ${list}`,
    sizes: (list) => `tailles : ${list}`,
    inStock: 'en stock',
    cheapest: 'le plus abordable de la sélection',
  },
  askCity: 'Dans quelle ville souhaitez-vous être livré(e) ? Touchez votre ville ou écrivez-la :',
  cityNotFound: (name) => `Je ne trouve pas « ${name} » parmi nos villes de livraison. Voici les principales, ou écrivez-nous sur WhatsApp :`,
  cityHome: `À ${HOME_CITY}, la livraison est gratuite 🚚 et vous payez à la livraison 💵 : vous ne payez qu'en recevant votre commande.`,
  cityFee: (city, fee, agency) => `Pour ${city}, la livraison coûte ${fee}, ${agency ? `par l'agence ${agency}` : `par agence de transport (${DEFAULT_AGENCIES})`}. 🚚`,
  cityNoFee: (city, agency) => `Pour ${city}, le tarif de livraison est à confirmer avec notre équipe sur WhatsApp${agency ? `, par l'agence ${agency}` : ''}.`,
  cityPay: `Le paiement se fait à l'avance :\n📱 Airtel Money ${PAYMENT.airtel}\n📲 Moov Money ${PAYMENT.moov}`,
  serviceNote: (home) =>
    `🕗 Nos services de livraison sont ouverts de ${DELIVERY_HOURS}.\n⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h${home ? '.' : ' : réglez dans ce délai.'}`,
  rules: `⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h. Passé ce délai, une commande restée en attente (non réglée) est signalée comme fausse commande.\nHors ${HOME_CITY}, réglez à l'avance : Airtel Money ${PAYMENT.airtel} ou Moov Money ${PAYMENT.moov}.`,
  contact: { hours: (h) => `🕗 Boutique : ${h}`, delivery: `🚚 Livraison : de ${DELIVERY_HOURS}`, ask: 'Pour une question, écrivez-nous sur WhatsApp 👇' },
  howToOrder: `Commander est simple 👇\n💬 Je peux finaliser votre commande avec vous, ici : ajoutez vos articles avec le bouton « + », puis touchez « Commander ».\nOu sur le site :\n1. Ouvrez le produit qui vous plaît\n2. Choisissez la couleur ou la taille\n3. Touchez « Ajouter au panier » ou « Acheter »\n4. Indiquez votre nom, téléphone, ville et adresse\n5. Payez : à la livraison à N’Djamena, à l’avance (Airtel Money ou Moov Money) dans les autres villes\n🎁 En option : emballage cadeau, ${fcfa(GIFT_WRAP_FEE)} (touchez l’image cadeau)\n⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h.`,

  cart: {
    added: (name, variant, count, total) => `✅ « ${name} »${variant} ajouté au panier.\nVotre panier : ${count} article${count > 1 ? 's' : ''} · ${fcfa(total)}`,
    askSize: (name) => `Quelle taille pour « ${name} » ?`,
    askColor: (name) => `Quelle couleur pour « ${name} » ?`,
    sizeLabel: (size) => `Taille ${size}`,
    cancelled: 'D’accord, je n’ajoute rien 😊',
    unavailable: (name) => `Désolé, « ${name} » n’est plus disponible pour le moment.`,
    unavailableAlt: 'Voici des articles proches, disponibles :',
    noMoreStock: (name, stock) => `Il ne reste que ${stock} « ${name} » en stock, et ${stock > 1 ? 'vous les avez' : 'vous l’avez'} déjà dans votre panier.`,
    addError: 'Je n’arrive pas à ajouter cet article pour le moment. Réessayez dans un instant, ou touchez le produit pour l’ouvrir.',
    empty: 'Votre panier est vide pour le moment 🛒 Dites-moi ce que vous cherchez, je vous aide à choisir.',
    show: 'Voici votre panier 🛒',
    verified: '✓ Prix et stock vérifiés à l’instant.',
    needLogin: 'Pour valider votre commande, créez votre compte ou connectez-vous (c’est gratuit). Votre panier est gardé 🛒',
    priceChanged: (name, from, to) => `ℹ️ Le prix de « ${name} » a changé : ${from} → ${to}.`,
    blocked: (name, stock) => (stock > 0 ? `⚠️ Il ne reste que ${stock} « ${name} » : baissez la quantité pour commander.` : `⚠️ « ${name} » n’est plus disponible : retirez-le de votre panier pour commander.`),
    askWhich: 'Lequel voulez-vous ajouter ?',
    addWhat: 'Bien sûr ! Dites-moi ce que vous cherchez : je vous montre les articles avec un bouton + pour les ajouter 👇',
    foundToAdd: 'Voici ce que j’ai trouvé : touchez + sur l’article voulu pour l’ajouter au panier 👇',
    tapPlus: 'Astuce : touchez + sur un article pour l’ajouter au panier 🛒',
    wrapNudge: `🎁 Pour offrir : l’emballage cadeau est à ${fcfa(GIFT_WRAP_FEE)} par commande (je vous le proposerai au moment de commander).`,
    ui: {
      view: 'Voir',
      subtotal: 'Sous-total',
      saved: 'Vous économisez',
      delivery: 'Livraison',
      deliveryLater: 'calculée à la commande selon votre ville',
      deliveryTo: (city) => `Livraison à ${city}`,
      free: 'gratuite',
      toConfirm: 'à confirmer',
      total: 'Total',
      totalWithDelivery: 'Total avec livraison',
      checkout: '✅ Commander',
      openFull: 'Ouvrir le panier complet ›',
      remove: (name) => `Retirer du panier : ${name}`,
      more: (name) => `Ajouter un exemplaire : ${name}`,
      less: (name) => `Retirer un exemplaire : ${name}`,
      items: (n) => `${n} article${n > 1 ? 's' : ''}`,
      unitPrice: 'l’unité',
    },
  },
  install: {
    ask: 'Avez-vous déjà installé l’application Albasse Shopping sur votre téléphone ? 📲\nElle s’ajoute à votre écran d’accueil : commandez plus vite et suivez vos commandes en un toucher.',
    yes: 'Parfait, merci ! 🎉 Vous faites déjà partie de la famille Albasse Shopping 😊',
    photoHint: '📸 Voici la photo pas à pas. Touchez-la pour l’agrandir.',
    photoAlt: 'Comment installer Albasse Shopping sur iPhone : 1. Touchez Partager, 2. Touchez En voir plus, 3. Touchez Sur l’écran d’accueil, puis l’application est prête',
    offer: 'Pour retrouver facilement Albasse Shopping, vous pouvez ajouter notre boutique à l’écran d’accueil de votre téléphone 📲',
    accepted: '🎉 C’est installé ! Retrouvez Albasse Shopping sur votre écran d’accueil.',
    declined: 'Pas de souci 😊 Vous pourrez le faire plus tard : le site reste utilisable comme maintenant.',
    later: 'D’accord, je ne vous le propose plus pour le moment 😊',
    already: 'Albasse Shopping est déjà installé sur votre téléphone 🎉',
    iosSteps: (safari) =>
      `${safari ? '' : '⚠️ Ouvrez d’abord albasseshopping.com dans Safari (l’installation ne marche pas depuis ce navigateur).\n'}Sur iPhone :\n1. Touchez « Partager » (le carré avec une flèche) en bas de l’écran\n2. Faites défiler et touchez « Sur l’écran d’accueil »\n3. Touchez « Ajouter »`,
    androidManual: 'Pour installer : touchez les trois points (⋮) en haut à droite de Chrome, puis « Installer l’application » ou « Ajouter à l’écran d’accueil » (selon votre version).',
    desktop: 'Pour installer : cliquez sur l’icône d’installation ⊕ dans la barre d’adresse de Chrome, ou sur les trois points (⋮) puis « Installer Albasse Shopping ».',
  },
  interest: {
    shoes: '😊 Cette paire semble vous intéresser ! Voulez-vous revoir les tailles disponibles ou découvrir des modèles similaires ?',
    clothing: 'Ce modèle vous plaît ? 👕 Je peux vous présenter les couleurs et les tailles disponibles.',
    perfumeOne: 'Ce parfum semble vous intéresser ! 🥰 Voulez-vous découvrir des parfums du même genre ?',
    perfumeBrowse: '🥰 Vous découvrez plusieurs parfums. Préférez-vous une fragrance fraîche, boisée, sucrée ou intense ? Je peux vous aider à choisir.',
    other: 'Cet article semble vous intéresser ! 😊 Voulez-vous voir ses détails (tailles, couleurs) ou des modèles similaires ?',
    category: 'J’ai quelques suggestions qui pourraient vous plaire ! 🛍️ Voulez-vous voir d’autres articles dans cette catégorie ?',
    chip: {
      sizes: '📏 Voir les tailles',
      colors: '🎨 Couleurs et tailles',
      similar: '✨ Modèles similaires',
      similarPerfume: '✨ Parfums du même genre',
      more: '🛍️ Voir d’autres articles',
      noThanks: 'Non merci',
      family: { fresh: '🌿 Fraîche', woody: '🌳 Boisée', sweet: '🍯 Sucrée', intense: '🔥 Intense' },
    },
    familyLabel: { fresh: 'fraîche', woody: 'boisée', sweet: 'sucrée', intense: 'intense' },
    sizesReply: (name, sizes) => `Voici les tailles proposées pour « ${name} » : ${sizes.join(', ')} 😊 Touchez le bouton + de la fiche pour l’ajouter à votre panier.`,
    noSizes: (name) => `« ${name} » n’a pas de taille à choisir 😊`,
    colorsReply: (name, colors, sizes) =>
      [`Voici ce que propose « ${name} » 😊`, colors.length ? `🎨 Couleurs : ${colors.join(', ')}` : '', sizes.length ? `📏 Tailles proposées : ${sizes.join(', ')}` : ''].filter(Boolean).join('\n'),
    similarIntro: 'Voici des modèles similaires, disponibles en ce moment 😊',
    similarNone: 'Je n’ai pas d’autre modèle disponible dans cette catégorie pour le moment 😊',
    familyIntro: (label) => `Voici les parfums dont la fiche annonce une fragrance ${label} 😊`,
    familyNone: (label) => `Je ne trouve pas de parfum « ${label} » indiqué sur nos fiches, et je préfère ne rien inventer 😊 Voici les parfums disponibles en ce moment :`,
    moreIntro: (category) => `Voici d’autres articles de la catégorie ${category} 😊`,
    moreNone: 'Vous avez déjà vu tous les articles disponibles de cette catégorie 😊',
    no: 'D’accord, pas de souci 😊 Je reste là si vous avez besoin d’aide, sans insister.',
    gone: 'Cet article n’est plus disponible pour le moment 😕',
  },
  occasion: {
    tabaski: '🐑 Tabaski : un beau moment en famille ! Tenues, chaussures, parfums, cadeaux… je vous aide à choisir, avec les vrais prix et les vrais stocks.',
    ramadan: '🌙 Ramadan Karim ! Tenues, parfums, cadeaux… je vous aide à choisir, avec les vrais prix et les vrais stocks.',
    korite: '🌙 Aïd Moubarak ! Pour la fête : tenues, chaussures, parfums, cadeaux… je vous aide à choisir, avec les vrais prix et les vrais stocks.',
    wedding: '💍 Un mariage ! Tenues, montres, parfums, bijoux, cadeaux pour les mariés ou les invités… je vous conseille. L’emballage cadeau est possible (2 000 FCFA par commande).',
    mothersDay: '💐 Fête des mères : une belle attention pour elle ! Parfums, bijoux, tenues… je vous propose des idées. L’emballage cadeau est possible (2 000 FCFA par commande).',
    valentine: '❤️ Saint-Valentin : une belle idée pour la personne qui compte ! Parfums, montres, bijoux… je vous conseille. L’emballage cadeau est possible (2 000 FCFA par commande).',
    blackFriday: '🖤 Black Friday : je vous montre les vraies promotions en cours dans la boutique, avec les prix et les stocks réels.',
  },
  wholesale: {
    ask: '📦 Pour les achats en gros (cartons, grandes quantités), les prix sont donnés directement par notre équipe 😊 Écrivez-nous sur WhatsApp avec : l’article, la quantité (ou le nombre de cartons) et votre ville.',
    nudge: '📦 Grosse commande ? Notre équipe peut vous faire un prix et organiser la livraison : écrivez-nous sur WhatsApp. Vous pouvez aussi continuer ici.',
    chip: '💬 Parler à l’équipe (gros)',
    prefill: (product) => `Bonjour, je souhaite un prix de gros${product ? ` pour « ${product} »` : ''}. Quantité (ou nombre de cartons) : … Ville : …`,
  },
  tracking: {
    stopped: 'C’est noté 😊 Je ne retiens plus les articles que vous regardez, et ce qui était retenu sur cet appareil est effacé.',
    stoppedAlready: 'C’est déjà le cas 😊 Le suivi est refusé : rien n’est retenu.',
    unavailable: 'Le suivi n’existe que sur le site web : ici, je ne retiens rien 😊',
  },
};

// ---------------------------------------------------------------------------------------------
// Arabe
// ---------------------------------------------------------------------------------------------

const AR_HOURS = 'من 8:30 إلى 16:00';

const arWho = (who: Who) => (who === 'lui' ? 'له' : who === 'elle' ? 'لها' : 'لطفل');

const AR: Texts = {
  dir: 'rtl',
  roleTitle: 'مساعدة التسويق',
  welcome: (name, rank, greeted) =>
    `${greeted ? '' : `مرحباً${name ? ` ${name}` : ''}! 😍👋 `}أهلاً بك في Albasse Shopping! ${rank ? `أنت رقم ${rank} بين عملائي اليوم، ويسعدني` : 'يسعدني'} استقبالك! 🥰🛍️\nما الذي يسعدك اليوم؟ أنا هنا لمساعدتك في إيجاد أفضل المنتجات! ❤️`,
  teaser: (name) => `مرحبا${name ? ` ${name}` : ''}! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping. 😊`,
  hello: (name) => `مرحباً ${name}! 😍👋`,
  memberBack: (name) => `مرحباً ${name}! 😍👋 تم تسجيل دخولك، ويسعدني لقاؤك من جديد! 🥰`,
  teaserMember: (name) => `مرحباً ${name}! 😍👋 زارا كينغز في خدمتك 🛍️`,
  askName: 'كيف يمكنني أن أناديك؟',
  askNameGuest: 'كيف يمكنني أن أناديك؟ إذا كان لديك حساب، سجّل الدخول وسأتعرف عليك 😊',
  askNameMember: 'أرى أنك مسجّل الدخول 😊 حسابك لا يحتوي على اسم بعد، فكيف يمكنني أن أناديك؟',
  nice: (name) => `سعدت بمعرفتك يا ${name}! 😊`,
  footer: 'زارا كينغز مساعدة آلية. لأي طلب أو مشكلة، راسلنا على واتساب.',
  placeholder: { message: 'اكتب رسالتك…', name: 'اكتب اسمك الأول…', city: 'اكتب مدينتك…', amount: 'اكتب مبلغا…', fullName: 'اكتب اسمك الكامل…', phone: 'مثال: 66123456', address: 'الحي، الشارع، معلم قريب…' },
  ui: {
    writing: 'زارا تكتب الآن…',
    close: 'إغلاق',
    reset: 'ابدأ المحادثة من جديد',
    send: 'إرسال',
    input: 'رسالتك',
    whatsappPill: 'واتساب',
    whatsappAria: 'التحدث مع الفريق على واتساب',
    closeTeaser: 'إغلاق الفقاعة',
    otherLang: 'Français',
  },
  chooseLang: 'اختر لغتك',
  fabLabel: 'التحدث مع زارا كينغز، مساعدة التسويق',
  openLabel: 'فتح المحادثة مع زارا كينغز',
  card: { see: 'عرض المنتج ›', soldOut: 'نفد', last: 'آخر قطعة', only: (n) => `بقي ${n} فقط`, addLabel: (name) => `أضف إلى السلة: ${name}` },
  langSwitched: 'حسنا، نكمل بالعربية 😊',
  chip: {
    skip: 'تخطي',
    createAccount: '👤 إنشاء حسابي',
    login: 'تسجيل الدخول',
    promotions: '🔥 العروض',
    news: '🆕 الجديد',
    advice: '🎯 نصيحة',
    categories: '🛍️ الفئات',
    delivery: '🚚 التوصيل والدفع',
    cart: '🛒 سلتي',
    orders: '📦 طلباتي',
    whatsapp: '💬 واتساب',
    menu: '🏠 القائمة',
    budget: '💰 ميزانيتي',
    withCategory: (name) => `➕ مع: ${name}`,
    seeShop: '📍 عرض المتجر',
    shopAddress: '📍 عنوان المتجر',
    payCash: '💵 عند الاستلام',
    payAirtel: '📱 Airtel Money',
    payMoov: '📲 Moov Money',
    giftYes: `🎁 نعم (+${fcfa(GIFT_WRAP_FEE)})`,
    giftNo: 'لا، شكراً',
    confirmOrder: '✅ تأكيد الطلب',
    editOrder: '✏️ تعديل',
    cancelOrder: 'إلغاء الطلب',
    editName: '👤 الاسم',
    editPhone: '📞 الهاتف',
    editAddress: '📍 العنوان',
    editCity: '🏙️ المدينة',
    editPay: '💳 الدفع',
    editGift: '🎁 التغليف',
    useAddress: (address) => `📍 استخدم: ${address.length > 26 ? `${address.slice(0, 25).trimEnd()}…` : address}`,
    orderPage: '📄 صفحة الطلب',
    retry: '🔄 إعادة المحاولة',
    points: '🏆 نقاطي',
    earnPoints: '🎁 اكسب نقاطاً',
    myAccount: '👤 حسابي',
    giftIdea: '🎁 فكرة هدية',
    wrap: '🎁 تغليف الهدايا',
    policy: '📄 شروط الإرجاع',
    otherLang: '🌐 Français',
    viewCart: '🛒 عرض سلتي',
    checkout: '✅ إتمام الطلب',
    moreItems: '🛍️ منتجات أخرى',
    cancel: 'إلغاء',
    installApp: '📲 تثبيت Albasse Shopping',
    installHelp: '📲 شاهد كيفية التثبيت',
    alreadyInstalled: '✅ نعم، مثبّت بالفعل',
    tutorial: '🎬 عرض الشرح',
    notNow: 'لاحقا',
    idk: '🤷 لا أعرف',
    anyBudget: 'لا يهم',
    giftWho: { elle: '👩 لها', lui: '👨 له', enfant: '👶 لطفل' },
    shopWho: { lui: '👨 لرجل', elle: '👩 لامرأة', enfant: '👶 لطفل' },
    budgets: ['💰 أقل من 10 000 FCFA', '💰 من 10 000 إلى 30 000 FCFA', '💰 من 30 000 إلى 100 000 FCFA', '💰 أكثر من 100 000 FCFA'],
  },
  info: [
    'ℹ️ معلومات مهمة قبل الطلب:',
    `🚚 خدمات التوصيل لدينا تعمل ${AR_HOURS}.`,
    '💵 الدفع عند الاستلام فقط في إنجامينا. في المدن الأخرى، الدفع مسبقا (Airtel Money أو Moov Money).',
    `⏳ لتجنب الطلبات الوهمية، كل طلب صالح لمدة ${ORDER_VALIDITY_HOURS} ساعة.`,
  ].join('\n'),
  accountInvite: 'أنشئ حسابك المجاني{nom}: تابع طلباتك، احتفظ بمفضلاتك ❤️، اجمع نقاط الولاء وأدر عجلة الحظ 🎡!',
  accountExplain: 'إنشاء الحساب مجاني وسريع: تتابع طلباتك، وتحتفظ بمفضلاتك ❤️، وتجمع نقاط الولاء وتدير عجلة الحظ 🎡.',
  menuIntro: 'ماذا تريد أن تكتشف اليوم؟ 🛍️',
  menuIntroNamed: 'ماذا تريد أن تكتشف{nom}؟ 🛍️',
  talk: {
    hello: (kind, known) => {
      switch (kind) {
        case 'evening':
          return ['مساء النور{nom} 😊 أهلاً بك في Albasse Shopping! كيف أساعدك؟', 'مساء الخير{nom}! 🌙 يسعدني رؤيتك. عن ماذا تبحث هذا المساء؟'];
        case 'morning':
          return ['صباح النور{nom} ☀️ أهلاً بك في Albasse Shopping! كيف أساعدك اليوم؟', 'صباح الخير{nom}! ☀️ يسعدني استقبالك. ماذا يمكنني أن أفعل لك؟'];
        case 'hi':
          return known
            ? ['هلا{nom} 😊 يسعدني أن أراك من جديد! عن ماذا تبحث اليوم؟', 'أهلاً{nom}! 😊 سعيدة برؤيتك مجدداً. كيف أساعدك؟']
            : ['هلا{nom} 😊 يسعدني أن أراك! عن ماذا تبحث اليوم؟', 'أهلاً{nom}! 😊 أهلاً بك في Albasse Shopping. كيف أساعدك؟'];
        case 'salam':
          return ['وعليكم السلام ورحمة الله وبركاته{nom} 😊 أهلاً بك في Albasse Shopping! كيف أساعدك؟', 'وعليكم السلام{nom}! 😊 يسعدني استقبالك. ماذا يمكنني أن أفعل لك؟'];
        default:
          return ['مرحباً{nom} 😊 أهلاً بك في Albasse Shopping! كيف أساعدك اليوم؟', 'مرحباً{nom}! 😊 يسعدني استقبالك. ماذا يمكنني أن أفعل لك اليوم؟'];
      }
    },
    helloWord: (kind) => (kind === 'evening' ? 'مساء الخير!' : kind === 'morning' ? 'صباح الخير!' : kind === 'hi' ? 'أهلاً!' : kind === 'salam' ? 'وعليكم السلام!' : 'مرحباً!'),
    fine: [
      'بخير، شكراً لك 😊 وأنت؟ ماذا يمكنني أن أفعل لك اليوم؟',
      'أنا بخير، شكراً! 😊 أتمنى أن تكون بخير أيضاً. كيف أساعدك؟',
      'الحمد لله، بخير 😊 وأنت؟ أخبرني بما يسعدك اليوم 🛍️',
    ],
    thanks: [
      'على الرحب والسعة{nom} 😊 أنا هنا لمساعدتك!',
      'العفو{nom} 😊 لا تتردد إذا احتجت أي شيء.',
      'بكل سرور! ❤️ أنا هنا إذا كانت لديك أسئلة أخرى.',
    ],
    thanksMuch: [
      'بكل سرور{nom}! ❤️ لا تتردد إذا احتجت أي شيء آخر.',
      'الشكر لك{nom}! 😊 أنا هنا متى احتجت إلي.',
      'بكل سرور{nom}! ❤️ أنا دائماً هنا لمساعدتك.',
    ],
    afterCompliment: [
      'بكل سرور! 😊❤️ أنا دائماً هنا لمساعدتك. أخبرني، ما الذي يسعدك اليوم؟ 🛍️',
      'على الرحب والسعة! 😊 أنا هنا متى شئت. ماذا يمكنني أن أفعل لك اليوم؟ 🛍️',
    ],
    compliment: [
      'شكراً جزيلاً! 🥰 كلامك جميل جداً! أنا زارا، مساعدتك الافتراضية، وأنا دائماً هنا لمساعدتك بكل سرور ❤️🛍️',
      'ما أجمل كلامك، شكراً لك! 🥰 أنا زارا، مساعدتك الافتراضية، وهنا لمساعدتك دائماً 😊❤️',
      'شكراً لك، هذا لطف منك! 😊❤️ زارا، مساعدتك الافتراضية، دائماً هنا لمساعدتك 🛍️',
    ],
    goodbye: (kind) => {
      switch (kind) {
        case 'night':
          return ['وأنتم من أهل الخير 🌙 شكراً على زيارتكم!', 'تصبحون على خير 🌙 إلى اللقاء قريباً في Albasse Shopping!'];
        case 'evening':
          return ['مساء الخير عليك أيضاً 🌙 شكراً على زيارتك!', 'أتمنى لك مساءً سعيداً 🌙 إلى اللقاء قريباً في Albasse Shopping.'];
        case 'day':
          return ['أتمنى لك يوماً سعيداً ☀️ شكراً على زيارتك!', 'يوماً سعيداً لك أيضاً ☀️ إلى اللقاء قريباً في Albasse Shopping.'];
        default:
          return ['إلى اللقاء! 😊 يسعدنا رؤيتك مجدداً في Albasse Shopping.', 'مع السلامة! 😊 شكراً على زيارتك، وإلى لقاء قريب.'];
      }
    },
    personal: (kind) => {
      const shop = '\nلعنوان المتجر، اضغط على الزر أدناه 👇';
      const team = '\nللتحدث مع فريق المتجر، اضغط على زر واتساب أدناه 👇';
      switch (kind) {
        case 'address':
          return [
            `😊 أنا مساعدتك الافتراضية، متاحة عبر الإنترنت لمساعدتك! يمكنك أن تجدني هنا في Albasse Shopping.${shop}`,
            `😊 ليس لدي عنوان مثل الأشخاص: أنا مساعدة افتراضية، أعمل عبر الإنترنت هنا في Albasse Shopping، وأنا موجودة دائماً لمساعدتك!${shop}`,
          ];
        case 'live':
          return [
            'هاها 😊 ليس لدي منزل مثل الأشخاص. أنا مساعدتك الافتراضية عبر الإنترنت، وجاهزة دائماً لمساعدتك في اكتشاف منتجاتنا!',
            'هاها 😊 ليس لدي بيت: أنا مساعدة افتراضية، موجودة هنا دائماً لمساعدتك في مشترياتك!',
          ];
        case 'whatsapp':
          return [
            `هاها 😊 ليس لدي واتساب شخصي. أنا مساعدتك الافتراضية عبر الإنترنت. يمكنك متابعة الحديث معي هنا لاكتشاف منتجاتنا وتحضير طلبك.${team}`,
            `😊 ليس لدي واتساب خاص بي: أنا مساعدة افتراضية عبر الإنترنت. اطرح أسئلتك هنا وسأساعدك بكل سرور!${team}`,
          ];
        case 'call':
          return [
            `😊 أتفهم ذلك! أنا مساعدة افتراضية أعمل عبر الإنترنت وليس لدي رقم شخصي، لكن يمكنني مساعدتك هنا في مشترياتك.${team}`,
            `😊 لا أستطيع استقبال المكالمات: أنا مساعدة افتراضية عبر الإنترنت. لكنني هنا لمساعدتك في مشترياتك!${team}`,
          ];
        case 'life':
          return [
            '😊 أنا مساعدة افتراضية: ليست لدي حياة شخصية مثل الأشخاص. لكنني موجودة دائماً لمساعدتك في إيجاد ما تحتاجه!',
            'هاها 😊 أنا مساعدة افتراضية بلا عائلة ولا حياة خاصة! مهمتي مساعدتك على التسوق في Albasse Shopping 🛍️',
          ];
        default:
          return [
            `😊 ليس لدي رقم شخصي. أعمل عبر الإنترنت كمساعدة افتراضية للتسويق الرقمي في Albasse Shopping، وأنا هنا لمساعدتك مباشرة!${team}`,
            `😊 ليس لدي هاتف شخصي: أنا مساعدة افتراضية عبر الإنترنت. اطرح أسئلتك هنا وأنا هنا لمساعدتك!${team}`,
          ];
      }
    },
  },
  loyalty: {
    mine: (d) => {
      const cur = tierOf(d.tier);
      const nxt = d.next ? tierOf(d.next.key) : null;
      const pts = `⭐ نقاطك: ${d.points}`;
      if (!nxt || !d.next) return `تهانينا! 🎉 درجتك الحالية في Albasse Shopping هي ${TIER_AR[cur.key]} ${cur.icon}: أعلى درجة في البرنامج! شكراً لولائك 🛍️❤️\n${pts}`;
      if (d.tier === 'bronze')
        return `مرحباً بك في برنامج الولاء! ${cur.icon} أنت حالياً في الدرجة ${TIER_AR[cur.key]}. كل عملية شراء مؤهلة على albasseshopping.com تمنحك نقاطاً. واصل مشترياتك لتقترب من الدرجة ${TIER_AR[nxt.key]}! 🎁\n${pts}\nينقصك ${AR_POINTS(d.next.missing)} للوصول إلى الدرجة ${TIER_AR[nxt.key]} ${nxt.icon}.`;
      if (d.next.missing <= CLOSE_TO_NEXT)
        return `بشرى سارة! 😍 أنت في الدرجة ${TIER_AR[cur.key]} ${cur.icon} وينقصك ${AR_POINTS(d.next.missing)} فقط للوصول إلى الدرجة ${TIER_AR[nxt.key]} ${nxt.icon}! واصل الاستفادة من منتجاتنا على albasseshopping.com. كل عملية شراء مؤهلة تقربك من هدفك! 🎁\n${pts}`;
      return `تهانينا! 🎉 درجتك الحالية في Albasse Shopping هي ${TIER_AR[cur.key]} ${cur.icon}.\n${pts}\nينقصك ${AR_POINTS(d.next.missing)} للوصول إلى الدرجة ${TIER_AR[nxt.key]} ${nxt.icon}.\nواصل الشراء على albasseshopping.com لتجمع نقاط الولاء وتتقدم نحو الدرجة الأعلى! 🛍️❤️`;
    },
    earn: `الأمر بسيط! 😊 اشترِ منتجاتك على https://albasseshopping.com واجمع نقاط الولاء حسب قواعد البرنامج. كلما تقدمت، اقتربت من الدرجات الأعلى! 🛍️💎\n📌 القاعدة: نقطة واحدة لكل ${fcfaGroup(LOYALTY_FCFA_PER_POINT)} FCFA من مجموع الطلب بعد تسليمه (تُضاف النقاط بعد تسليم الطلب).\n🏆 الدرجات: ${LOYALTY_TIERS.map((t) => `${t.icon} ${TIER_AR[t.key]} (${t.min === 0 ? 'في البداية' : AR_POINTS(t.min)})`).join(' · ')}`,
    tiers: `إليك درجات برنامج الولاء الخمس: ${LOYALTY_TIERS.map((t) => `${t.icon} ${TIER_AR[t.key]} (${t.min === 0 ? 'في البداية' : AR_POINTS(t.min)})`).join(' · ')}.\n📌 القاعدة: نقطة واحدة لكل ${fcfaGroup(LOYALTY_FCFA_PER_POINT)} FCFA من مجموع الطلب بعد تسليمه.`,
    needLogin: 'لمعرفة درجتك ونقاط الولاء، سجّل الدخول إلى حسابك على albasseshopping.com 😊 ليس لديك حساب بعد؟ أنشئه مجاناً: كل عملية شراء مؤهلة تمنحك نقاطاً! 🎁',
    unavailable: 'لا أستطيع قراءة نقاطك الآن 😕 يمكنك الاطلاع على درجتك ونقاطك في حسابك على albasseshopping.com، أو المحاولة بعد قليل.',
    orderPoints: (n) => `🎁 الولاء: هذا الطلب سيمنحك ${AR_POINTS(n)} بعد تسليمه.`,
    mineQuery: 'نقاطي',
    earnQuery: 'كيف اكسب نقاط الولاء',
  },
  checkout: {
    intro: 'حسناً، لنُكمل طلبك معاً 🛍️ بضعة أسئلة سريعة وينتهي الأمر!',
    askName: 'ما الاسم الكامل للشخص الذي سيستلم الطلب؟ 👤',
    askPhone: 'ما رقم هاتفك؟ 8 أرقام تبدأ بـ 6 أو 9 (مثال: 66123456) 📞',
    badPhone: 'يجب أن يتكون الرقم من 8 أرقام ويبدأ بـ 6 أو 9 (مثال: 66123456). هل يمكنك كتابته من جديد؟ 📞',
    askAddress: 'ما عنوان التوصيل؟ الحي، الشارع، معلم قريب… 📍',
    askCity: 'في أي مدينة يجب أن نوصّل إليك؟ 🚚',
    askPay: (home) =>
      home
        ? 'كيف تريد الدفع؟ 💳\n💵 عند الاستلام (إنجامينا)، أو مسبقاً عبر Airtel Money أو Moov Money.'
        : 'في مدينتك، يتم الدفع مسبقاً عبر Airtel Money أو Moov Money 📱 اختر إحداهما.',
    askGift: `🎁 هل تريد تغليف الهدية؟ التكلفة ${fcfa(GIFT_WRAP_FEE)}.`,
    methodLabel: (m) => (m === 'airtel_money' ? 'Airtel Money' : m === 'moov_money' ? 'Moov Money' : 'الدفع عند الاستلام'),
    recap: (d) =>
      [
        '📝 ملخص طلبك:',
        ...d.lines.map((l) => `• ${l.name}${l.variant} × ${l.qty}: ${fcfa(l.subtotal)}`),
        `🚚 التوصيل إلى ${d.city}: ${d.fee === null ? 'سيؤكدها الفريق' : d.fee === 0 ? 'مجاني' : fcfa(d.fee)}`,
        ...(d.gift ? [`🎁 تغليف الهدية: ${fcfa(GIFT_WRAP_FEE)}`] : []),
        `💰 المجموع: ${fcfa(d.total)}`,
        `👤 ${d.name} · 📞 ${d.phone}`,
        `📍 ${d.address}، ${d.city}`,
        d.method === 'cash_on_delivery' ? '💵 الدفع عند الاستلام نقداً' : `📱 الدفع مسبقاً عبر ${d.method === 'airtel_money' ? 'Airtel Money' : 'Moov Money'}`,
        'هل كل شيء صحيح؟ اضغط «تأكيد الطلب» لتسجيله 👇',
      ].join('\n'),
    pickButton: 'اضغط على أحد الأزرار أدناه للمتابعة 👇',
    editWhat: 'ماذا تريد أن تعدّل؟ ✏️',
    cancelled: 'حسناً، أوقفت الطلب. سلتك محفوظة 🛒 يمكنك المتابعة متى شئت.',
    resumeLost: 'لم أعد أجد معلومات هذا الطلب. اضغط «إتمام الطلب» للمتابعة 🙂',
    priceChanged: 'تغيّرت الأسعار أو المخزون: هذا هو الملخص الجديد. راجعه ثم أكّد من جديد 👇',
    codOnlyHome: 'الدفع عند الاستلام ممكن فقط في إنجامينا. اختر Airtel Money أو Moov Money 📱',
    placed: (name, id) => `🎉 شكراً ${name}! تم تسجيل طلبك رقم #${id} بنجاح.`,
    totalToPay: (total) => `💰 المبلغ المطلوب: ${fcfa(total)}`,
    giftIncluded: `🎁 تغليف الهدية مُضمَّن (${fcfa(GIFT_WRAP_FEE)})`,
    payCash: '💵 تدفع نقداً عند الاستلام مباشرة.',
    payInitiated: (label, message) => `📱 تم بدء الدفع عبر ${label}. ${message}`,
    payUrl: (url) => `📱 ادفع من هنا: ${url}`,
    payNumber: (amount, number, label) => `📱 أرسل ${fcfa(amount)} إلى الرقم ${number} (${label}).`,
    payTeam: (phone, label) => `📞 سيتصل بك فريقنا على ${phone} لإتمام الدفع عبر ${label}.`,
    failed: '😕 لم أستطع تسجيل طلبك الآن. سلتك محفوظة. يمكنك المحاولة من جديد، أو الإتمام من صفحة الطلب، أو مراسلتنا على واتساب.',
  },
  bot: 'أنا المساعدة الافتراضية لـ Albasse Shopping: مساعدة آلية وليست شخصا. للتحدث مع أحد أفراد الفريق، راسلنا على واتساب 👇',
  alreadyMember: 'أنت مسجل بالفعل{nom} ✅ تجد طلباتك في أي وقت.',
  ordersLink: 'تابع كل طلباتك هنا 👇',
  errorData: 'لا أستطيع تحميل هذه المعلومات الآن. حاول بعد قليل، أو راسلنا على واتساب.',
  errorOops: 'عذرا، حدثت مشكلة صغيرة من جهتي 😅 حاول بعد قليل، أو راسلنا على واتساب.',
  promoIntro: (pct) => `🔥 إليك أفضل عروضنا الحالية${pct ? ` (حتى -${pct} %)` : ''}{nom}!`,
  noPromo: 'لا توجد عروض الآن، لكن اكتشف جديدنا!',
  newIntro: '🆕 إليك أحدث منتجاتنا{nom}!',
  chooseCategory: 'اختر فئة 👇',
  foundFor: (q, range) => `إليك ما وجدته من أجل «${q}»${range ? ` ${range}` : ''}{nom}:`,
  fallbackFor: (q, range) => `لم أجد شيئا ${range} من أجل «${q}». إليك الأقرب إلى طلبك:`,
  nothingFor: (text) => `لم أجد شيئا من أجل «${text}» 😕 أخبرني بما تحب فأنصحك، أو تصفح فئاتنا.`,
  askNeed: 'بكل سرور{nom}! أنا هنا لأنصحك. ماذا تبحث عنه؟',
  askBudget: 'ما هي ميزانيتك{nom}؟ اختر خيارا أو اكتب مبلغا (مثال 20 000) 💰',
  bestPicks: 'إليك أفضل اختياراتي{nom}:',
  budgetBest: (range) => `إليك أفضل اختياراتي ${range}{nom}:`,
  budgetFallback: (range) => `لم أجد شيئا ${range} في هذه المجموعة. إليك الأقرب:`,
  budgetNothing: 'لم أجد شيئا في هذه المجموعة 😕 هل نجرب شيئا آخر؟',
  askGift: 'فكرة جميلة{nom}! 🎁 لمن هذه الهدية؟',
  askWho: (gift) => (gift ? 'بكل سرور{nom}! 🎁 لمن هي؟' : 'حسنا{nom}! لمن هي؟'),
  askType: (who, gift) => (gift ? `أي نوع من الهدايا ${arWho(who)}؟` : `أي نوع من المنتجات ${arWho(who)}؟`),
  giftIntro: (who) => `إليك أفكاري لهدية ${arWho(who)}{nom} 🎁`,
  noGift: 'ليست لدي فكرة لهذه الهدية بعد. هل نرى عروضنا؟',
  pairIntro: (category) => `لإكمال مشترياتك{nom}، إليك ${category} 👇`,
  rangeText: (r) => {
    if (!Number.isFinite(r.max)) return r.min > 0 ? `ابتداء من ${fcfa(r.min)}` : 'دون حد للميزانية';
    if (r.min <= 0) return `بأقل من ${fcfa(r.max)}`;
    return `بين ${fcfa(r.min)} و ${fcfa(r.max)}`;
  },
  lowStock: (name, n) => (n === 1 ? `⚠️ «${name}»: بقيت قطعة واحدة فقط في المخزون!` : `⚠️ «${name}»: بقي ${n} فقط في المخزون!`),
  pitch: (name, price, n) =>
    `هل تنظر إلى «${name}»؟ اختيار ممتاز! ${price}.${n === null ? '' : `\n${n === 1 ? 'بقيت قطعة واحدة فقط' : `بقي ${n} فقط في المخزون`}: لا تتأخر!`}\nللطلب، اضغط على «Acheter» (اشترِ) أسفل الشاشة 👇`,
  cartReminder: (count, total) => `🛒 سلتك تنتظرك (عدد المنتجات: ${count}) بقيمة ${fcfa(total)}. أنهِ طلبك في ثوانٍ!`,
  priceReply: (pct) =>
    [
      'أفهمك 😊 الشراء الجيد هو الجودة بالسعر المناسب. إليك كيف تدفع أقل:',
      `🔥 استفد من عروضنا${pct ? ` (حتى -${pct} %)` : ''}`,
      '💰 أخبرني بميزانيتك: أعرض عليك أفضل الخيارات',
      '🚚 في إنجامينا، التوصيل مجاني',
    ].join('\n'),
  cheaperIntro: 'أفهمك{nom}. إليك بدائل أرخص:',
  noCheaper: 'هذا بالفعل أقل سعر في هذه المجموعة. يمكنني أن أعرض عليك عروضنا، أو أبحث في ميزانية أخرى 😊',
  trust: (where, phone) =>
    [
      'ثقتك تهمّنا 🤝 Albasse Shopping هي أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013: خدمة، جودة، ضمان.',
      '💵 في إنجامينا، لا تدفع إلا عند استلام طلبك.',
      where ? `📍 المتجر: ${where}` : null,
      phone ? `📞 ${phone}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  later: 'لا مشكلة{nom} 😊 خذ وقتك. اضغط على القلب ❤️ في أي منتج لتجده في مفضلتك (مع حساب مجاني). أنا هنا إن كان لديك سؤال!',
  about: 'Albasse Shopping هي أول منصة للبيع عبر الإنترنت في تشاد. نعمل في هذا المجال منذ عام 2013: خدمة، جودة، ضمان 🤝\nموقعنا الرسمي: https://albasseshopping.com',
  returns: [
    '↩️ شروط الإرجاع لدينا:',
    '• منتج خاطئ أو معيب: تواصل معنا خلال 72 ساعة من الاستلام مع صورة أو فيديو. بعد التحقق، تكاليف الإرجاع علينا.',
    '• خطأ في المقاس: يمكن الاستبدال (منتج غير مستعمل وغير مغسول مع بطاقاته). تكاليف الإرجاع حينها على العميل.',
    '• في جميع الحالات، احتفظ بالمنتج وعبوته الأصلية حتى تأكيد الإرجاع.',
  ].join('\n'),
  wrapReply: `🎁 تغليف الهدايا: مقابل ${fcfa(GIFT_WRAP_FEE)} لكل طلب، يصلك طردك مغلفا بأناقة. اضغط على صورة الهدية عند الطلب، أو في «طلباتي» ما دام طلبك قيد الانتظار.`,
  wrapPitch: `🎁 قدّمها مغلفة بأناقة: تغليف الهدايا بـ ${fcfa(GIFT_WRAP_FEE)} لكل طلب (اضغط على صورة الهدية عند الطلب).`,
  encouragements: [
    'اضغط على «Voir le produit» (عرض المنتج) ثم «Acheter» (اشترِ): الأمر سهل وسريع! 🛍️',
    'في إنجامينا، التوصيل مجاني والدفع عند الاستلام: اطلب بدون أي مخاطرة 😉',
    'استفد ما دام المخزون متوفرا! 🔥',
    'فرصة جميلة لتدليل نفسك (أو لتقديم هدية)! 🎁',
    'هل تحتاج مساعدة في الاختيار؟ أخبرني بميزانيتك وسأرشدك 😊',
    'هل لديك شك؟ أنا هنا للإجابة، دون أي التزام 🤝',
    'تتابع طلبك بعد ذلك في «طلباتي» 📦',
    `خدمات التوصيل لدينا تعمل ${AR_HOURS} 🚚`,
  ],
  whyAdvice: (name, reasons) => `نصيحتي{nom}: «${name}» — ${reasons.join(' · ')}.`,
  why: {
    discount: (pct, price, old) => `خصم ${pct} %: ${fcfa(price)} بدل ${fcfa(old)}`,
    budget: 'ضمن ميزانيتك',
    lowStock: (n) => (n === 1 ? 'آخر قطعة في المخزون' : `بقي ${n} فقط في المخزون`),
    colors: (list) => `متوفر بألوان: ${list}`,
    sizes: (list) => `المقاسات: ${list}`,
    inStock: 'متوفر في المخزون',
    cheapest: 'الأرخص في هذه المجموعة',
  },
  askCity: 'إلى أي مدينة تريد التوصيل؟ اختر مدينتك أو اكتبها:',
  cityNotFound: (name) => `لا أجد «${name}» بين مدن التوصيل لدينا. إليك أهمها، أو راسلنا على واتساب:`,
  cityHome: 'في إنجامينا، التوصيل مجاني 🚚 والدفع عند الاستلام 💵: لا تدفع إلا عند استلام طلبك.',
  cityFee: (city, fee, agency) => `إلى ${city}، التوصيل بـ ${fee}، ${agency ? `عبر وكالة ${agency}` : `عبر وكالة نقل (${DEFAULT_AGENCIES})`}. 🚚`,
  cityNoFee: (city, agency) => `تعرفة التوصيل إلى ${city} تُؤكَّد مع فريقنا عبر واتساب${agency ? `، عبر وكالة ${agency}` : ''}.`,
  cityPay: `الدفع مسبقا:\n📱 Airtel Money ${PAYMENT.airtel}\n📲 Moov Money ${PAYMENT.moov}`,
  serviceNote: (home) =>
    `🕗 خدمات التوصيل لدينا تعمل ${AR_HOURS}.\n⏳ لتجنب الطلبات الوهمية، كل طلب صالح لمدة ${ORDER_VALIDITY_HOURS} ساعة${home ? '.' : ': ادفع خلال هذه المدة.'}`,
  rules: `⏳ لتجنب الطلبات الوهمية، كل طلب صالح لمدة ${ORDER_VALIDITY_HOURS} ساعة. بعد هذه المدة، يُبلَّغ عن الطلب المتروك قيد الانتظار (غير المدفوع) على أنه طلب وهمي.\nخارج إنجامينا، ادفع مسبقا: Airtel Money ${PAYMENT.airtel} أو Moov Money ${PAYMENT.moov}.`,
  contact: { hours: (h) => `🕗 المتجر: ${h}`, delivery: `🚚 التوصيل: ${AR_HOURS}`, ask: 'لأي سؤال، راسلنا على واتساب 👇' },
  howToOrder: `الطلب سهل 👇\n💬 يمكنني إتمام طلبك معك هنا: أضف منتجاتك بزر «+» ثم اضغط «إتمام الطلب».\nأو من الموقع:\n1. افتح المنتج الذي يعجبك\n2. اختر اللون أو المقاس\n3. اضغط على «Ajouter au panier» (أضف إلى السلة) أو «Acheter» (اشترِ)\n4. اكتب اسمك وهاتفك ومدينتك وعنوانك\n5. ادفع: عند الاستلام في إنجامينا، ومسبقا (Airtel Money أو Moov Money) في المدن الأخرى\n🎁 اختياري: تغليف الهدايا بـ ${fcfa(GIFT_WRAP_FEE)} (اضغط على صورة الهدية)\n⏳ لتجنب الطلبات الوهمية، كل طلب صالح لمدة ${ORDER_VALIDITY_HOURS} ساعة.`,

  cart: {
    added: (name, variant, count, total) => `✅ «${name}»${variant} أضيف إلى السلة.\nسلتك: ${count} ${count > 1 ? 'منتجات' : 'منتج'} · ${fcfa(total)}`,
    askSize: (name) => `ما المقاس المناسب لـ «${name}»؟`,
    askColor: (name) => `ما اللون المناسب لـ «${name}»؟`,
    sizeLabel: (size) => `المقاس ${size}`,
    cancelled: 'حسنا، لن أضيف شيئا 😊',
    unavailable: (name) => `عذرا، «${name}» غير متوفر حاليا.`,
    unavailableAlt: 'إليك منتجات قريبة منه ومتوفرة:',
    noMoreStock: (name, stock) => `لم يبق سوى ${stock} من «${name}» في المخزون، وهي موجودة بالفعل في سلتك.`,
    addError: 'لا أستطيع إضافة هذا المنتج الآن. حاول بعد قليل، أو افتح المنتج مباشرة.',
    empty: 'سلتك فارغة حاليا 🛒 أخبرني بما تبحث عنه وأساعدك على الاختيار.',
    show: 'إليك سلتك 🛒',
    verified: '✓ تم التحقق من الأسعار والمخزون الآن.',
    needLogin: 'لإتمام طلبك، أنشئ حسابك أو سجل الدخول (مجاني). سلتك محفوظة 🛒',
    priceChanged: (name, from, to) => `ℹ️ تغير سعر «${name}»: ${from} ← ${to}.`,
    blocked: (name, stock) => (stock > 0 ? `⚠️ لم يبق سوى ${stock} من «${name}»: قلل الكمية لإتمام الطلب.` : `⚠️ «${name}» لم يعد متوفرا: احذفه من سلتك لإتمام الطلب.`),
    askWhich: 'أي منتج تريد إضافته؟',
    addWhat: 'بالتأكيد! أخبرني بما تبحث عنه: أعرض عليك المنتجات مع زر + لإضافتها 👇',
    foundToAdd: 'إليك ما وجدته: اضغط + على المنتج المطلوب لإضافته إلى السلة 👇',
    tapPlus: 'نصيحة: اضغط + على أي منتج لإضافته إلى السلة 🛒',
    wrapNudge: `🎁 للإهداء: تغليف الهدايا بـ ${fcfa(GIFT_WRAP_FEE)} لكل طلب (سأعرضه عليك عند إتمام الطلب).`,
    ui: {
      view: 'عرض',
      subtotal: 'المجموع الفرعي',
      saved: 'توفر',
      delivery: 'التوصيل',
      deliveryLater: 'يُحسب عند الطلب حسب مدينتك',
      deliveryTo: (city) => `التوصيل إلى ${city}`,
      free: 'مجاني',
      toConfirm: 'يُؤكَّد لاحقا',
      total: 'المجموع',
      totalWithDelivery: 'المجموع مع التوصيل',
      checkout: '✅ إتمام الطلب',
      openFull: 'فتح السلة كاملة ›',
      remove: (name) => `حذف من السلة: ${name}`,
      more: (name) => `زيادة قطعة: ${name}`,
      less: (name) => `إنقاص قطعة: ${name}`,
      items: (n) => `${n} ${n > 1 ? 'منتجات' : 'منتج'}`,
      unitPrice: 'للقطعة',
    },
  },
  install: {
    ask: 'هل قمت بتثبيت تطبيق Albasse Shopping على هاتفك؟ 📲\nيُضاف إلى شاشتك الرئيسية: اطلب أسرع وتابع طلباتك بلمسة واحدة.',
    yes: 'رائع، شكراً لك! 🎉 أنت بالفعل من عائلة Albasse Shopping 😊',
    photoHint: '📸 هذه صورة الخطوات. المسها لتكبيرها.',
    photoAlt: 'كيفية تثبيت Albasse Shopping على الآيفون: 1. اضغط مشاركة، 2. اضغط عرض المزيد، 3. اضغط إضافة إلى الشاشة الرئيسية، ثم يصبح التطبيق جاهزاً',
    offer: 'لتجد Albasse Shopping بسهولة، يمكنك إضافة متجرنا إلى الشاشة الرئيسية لهاتفك 📲',
    accepted: '🎉 تم التثبيت! ستجد Albasse Shopping على شاشتك الرئيسية.',
    declined: 'لا مشكلة 😊 يمكنك فعل ذلك لاحقا، والموقع يبقى قابلا للاستخدام كما هو.',
    later: 'حسنا، لن أقترح عليك ذلك الآن 😊',
    already: 'Albasse Shopping مثبت بالفعل على هاتفك 🎉',
    iosSteps: (safari) =>
      `${safari ? '' : '⚠️ افتح أولا albasseshopping.com في متصفح Safari (التثبيت لا يعمل من هذا المتصفح).\n'}على الآيفون:\n1. اضغط «مشاركة» (المربع مع السهم) أسفل الشاشة\n2. مرر لأسفل واضغط «إضافة إلى الشاشة الرئيسية»\n3. اضغط «إضافة»`,
    androidManual: 'للتثبيت: اضغط على النقاط الثلاث (⋮) أعلى يمين Chrome ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» حسب إصدارك.',
    desktop: 'للتثبيت: اضغط على أيقونة التثبيت ⊕ في شريط عنوان Chrome، أو على النقاط الثلاث (⋮) ثم «تثبيت Albasse Shopping».',
  },
  interest: {
    shoes: '😊 يبدو أن هذا الحذاء أعجبك! هل تريد مراجعة المقاسات المعروضة أو اكتشاف موديلات مشابهة؟',
    clothing: 'هل أعجبك هذا الموديل؟ 👕 يمكنني أن أعرض لك الألوان والمقاسات المتوفرة.',
    perfumeOne: 'يبدو أن هذا العطر أعجبك! 🥰 هل تريد اكتشاف عطور من النوع نفسه؟',
    perfumeBrowse: '🥰 أنت تكتشف عدة عطور. هل تفضل رائحة منعشة أم خشبية أم حلوة أم قوية؟ يمكنني مساعدتك في الاختيار.',
    other: 'يبدو أن هذا المنتج أعجبك! 😊 هل تريد رؤية تفاصيله (المقاسات والألوان) أو موديلات مشابهة؟',
    category: 'عندي بعض الاقتراحات التي قد تعجبك! 🛍️ هل تريد رؤية منتجات أخرى في هذا القسم؟',
    chip: {
      sizes: '📏 عرض المقاسات',
      colors: '🎨 الألوان والمقاسات',
      similar: '✨ موديلات مشابهة',
      similarPerfume: '✨ عطور من النوع نفسه',
      more: '🛍️ منتجات أخرى',
      noThanks: 'لا شكراً',
      family: { fresh: '🌿 منعشة', woody: '🌳 خشبية', sweet: '🍯 حلوة', intense: '🔥 قوية' },
    },
    familyLabel: { fresh: 'منعشة', woody: 'خشبية', sweet: 'حلوة', intense: 'قوية' },
    sizesReply: (name, sizes) => `هذه المقاسات المعروضة لـ «${name}»: ${sizes.join('، ')} 😊 المس زر + في البطاقة لإضافته إلى السلة.`,
    noSizes: (name) => `«${name}» ليس له مقاسات للاختيار 😊`,
    colorsReply: (name, colors, sizes) =>
      [`هذا ما يعرضه «${name}» 😊`, colors.length ? `🎨 الألوان: ${colors.join('، ')}` : '', sizes.length ? `📏 المقاسات المعروضة: ${sizes.join('، ')}` : ''].filter(Boolean).join('\n'),
    similarIntro: 'هذه موديلات مشابهة متوفرة الآن 😊',
    similarNone: 'لا يوجد موديل آخر متوفر في هذا القسم الآن 😊',
    familyIntro: (label) => `هذه العطور التي تذكر بطاقتها رائحة ${label} 😊`,
    familyNone: (label) => `لا أجد عطرا بوصف «${label}» في بطاقات منتجاتنا، وأفضّل ألا أخترع شيئا 😊 هذه العطور المتوفرة الآن:`,
    moreIntro: (category) => `هذه منتجات أخرى من قسم ${category} 😊`,
    moreNone: 'لقد شاهدت كل المنتجات المتوفرة في هذا القسم 😊',
    no: 'حسنا، لا مشكلة 😊 أنا هنا إذا احتجت إلى مساعدة، دون إلحاح.',
    gone: 'هذا المنتج غير متوفر حاليا 😕',
  },
  occasion: {
    tabaski: '🐑 عيد الأضحى لحظة جميلة مع العائلة! ملابس وأحذية وعطور وهدايا… أساعدك في الاختيار بالأسعار والمخزون الحقيقيين.',
    ramadan: '🌙 رمضان كريم! ملابس وعطور وهدايا… أساعدك في الاختيار بالأسعار والمخزون الحقيقيين.',
    korite: '🌙 عيد مبارك! للعيد: ملابس وأحذية وعطور وهدايا… أساعدك في الاختيار بالأسعار والمخزون الحقيقيين.',
    wedding: '💍 حفل زواج! ملابس وساعات وعطور ومجوهرات وهدايا للعروسين أو للضيوف… أنصحك. تغليف الهدايا متاح (2 000 FCFA لكل طلب).',
    mothersDay: '💐 عيد الأم: لفتة جميلة لها! عطور ومجوهرات وملابس… أقترح عليك أفكارا. تغليف الهدايا متاح (2 000 FCFA لكل طلب).',
    valentine: '❤️ عيد الحب: فكرة جميلة لمن يهمك أمره! عطور وساعات ومجوهرات… أنصحك. تغليف الهدايا متاح (2 000 FCFA لكل طلب).',
    blackFriday: '🖤 الجمعة السوداء: أعرض لك العروض الحقيقية الجارية في المتجر، بالأسعار والمخزون الحقيقيين.',
  },
  wholesale: {
    ask: '📦 لمشتريات الجملة (كراتين وكميات كبيرة) يقدم فريقنا الأسعار مباشرة 😊 راسلنا على واتساب مع: المنتج والكمية (أو عدد الكراتين) ومدينتك.',
    nudge: '📦 طلب كبير؟ يستطيع فريقنا تقديم سعر وتنظيم التوصيل: راسلنا على واتساب. ويمكنك أيضا المتابعة هنا.',
    chip: '💬 التحدث مع الفريق (جملة)',
    prefill: (product) => `مرحبا، أريد سعر الجملة${product ? ` لـ «${product}»` : ''}. الكمية (أو عدد الكراتين): … المدينة: …`,
  },
  tracking: {
    stopped: 'تم 😊 لن أحتفظ بعد الآن بالمنتجات التي تشاهدها، وما كان محفوظا على هذا الجهاز تم مسحه.',
    stoppedAlready: 'هذا هو الحال بالفعل 😊 المتابعة مرفوضة ولا شيء محفوظ.',
    unavailable: 'المتابعة موجودة فقط على موقع الويب: هنا لا أحتفظ بشيء 😊',
  },
};

const DICTIONARIES: Record<Lang, Texts> = { fr: FR, ar: AR };

export const texts = (lang: Lang): Texts => DICTIONARIES[lang] ?? FR;

// Nom d'une catégorie dans la langue de Zara (le nom de la base si on ne le connaît pas en arabe).
export function categoryLabel(lang: Lang, slug: string, name: string): string {
  return lang === 'ar' ? (CATEGORY_AR[slug] ?? name) : name;
}

// « , Prénom » (ou « ، Prénom ») pour remplacer {nom} ; rien si on ne connaît pas le prénom.
export function withName(lang: Lang, text: string, name: string | null): string {
  const sep = lang === 'ar' ? '، ' : ', ';
  return text.replace('{nom}', name ? `${sep}${name}` : '');
}

