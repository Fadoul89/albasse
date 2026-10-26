import { ASSISTANT_NAME, ASSISTANT_ROLE } from '../constants/assistant';
import { DEFAULT_AGENCIES, DELIVERY_HOURS, GIFT_WRAP_FEE, HOME_CITY, ORDER_VALIDITY_HOURS, PAYMENT } from '../constants/shopRules';
import { LOYALTY_FCFA_PER_POINT, LOYALTY_TIERS, type LoyaltyTier } from './loyalty';
import { CATEGORY_AR, type GoodbyeKind, type GreetingKind, type Lang, type PayMethodKey, type PersonalKind, type Who } from './assistantLang';

// Tous les textes que Zara dit ou affiche, en français et en arabe. Un « {nom} » dans un texte devient
// « , Prénom » (ou « ، Prénom » en arabe) quand on connaît le prénom du visiteur.
// Les deux langues suivent la même interface : TypeScript vérifie qu'aucun texte ne manque.

// Psychologie commerciale : ce que le client dit aimer (jamais déduit de son métier) et le ton de Zara qui en découle.
export type StyleKey = 'elegant' | 'trend' | 'sport' | 'budget';
export type ToneKey = StyleKey | 'hesitant' | 'loyal' | 'neutral';

export const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// 1 -> 1ᵉʳ, 3 -> 3ᵉ
export const ordinalFr = (n: number) => (n === 1 ? '1ᵉʳ' : `${n}ᵉ`);

export interface Range {
  min: number;
  max: number; // Infinity : pas de plafond
}

// Ce que le récapitulatif de commande montre (tout vient de l'article vérifié et des réponses du client)
export interface RecapData {
  lines: { name: string; variant: string; qty: number; subtotal: number }[];
  city: string;
  fee: number | null; // null : frais à confirmer par l'équipe
  gift: boolean;
  discount?: number; // remise fidélité (FCFA) déjà déduite du total
  slot?: string | null; // livraison programmée (N'Djamena) : « mardi 27/10 à 10h00 » ; sans valeur : livraison normale
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
  // bulle pour ceux qui ont installé Albasse Shopping sans activer les notifications
  teaserPush(name: string | null): string;
  teaserInstall(name: string | null): string;
  askName: string;
  askNameGuest: string;
  askNameMember: string;
  nice(name: string): string;
  footer: string;
  placeholder: { message: string; name: string; city: string; amount: string; fullName: string; phone: string; address: string; day: string; time: string };
  ui: { writing: string; close: string; reset: string; send: string; input: string; whatsappPill: string; whatsappAria: string; closeTeaser: string; otherLang: string };
  chooseLang: string;
  fabLabel: string;
  openLabel: string;
  card: { see: string; soldOut: string; last: string; only(n: number): string; addLabel(name: string): string; order: string };
  langSwitched: string;
  chip: {
    skip: string;
    createAccount: string;
    login: string;
    promotions: string;
    coldSeason: string;
    news: string;
    advice: string;
    categories: string;
    delivery: string;
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
    editSlot: string;
    otherDay: string;
    skipSlot: string;
    useAddress(address: string): string;
    orderPage: string;
    invoice: string;
    retry: string;
    points: string;
    earnPoints: string;
    myAccount: string;
    giftIdea: string;
    wrap: string;
    policy: string;
    otherLang: string;
    checkout: string;
    seeMore: string;
    categoryPage(category: string): string;
    openChrome: string;
    cancel: string;
    installApp: string;
    installHelp: string;
    enablePush: string;
    alreadyInstalled: string;
    tutorial: string;
    notNow: string;
    callback: string;
    callbackYes: string;
    callbackFix: string;
    callbackDayFix: string;
    styleElegant: string;
    styleTrend: string;
    styleSport: string;
    styleBudget: string;
    myStyle: string;
    ranges: string;
    compare: string;
    newForMe: string;
    take(name: string): string;
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
    askDay: string;
    askTime(day: string): string;
    slotLost: string;
    slotLine(label: string): string;
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
    invoiceReady: string;
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
  // une catégorie touchée dans le chat : ses articles s'affichent dans le chat (le chat reste ouvert)
  categoryIntro(category: string, total: number): string;
  categoryMore(category: string, from: number, to: number, total: number): string;
  categoryEmpty: string;
  foundFor(q: string, range: string | null): string;
  fallbackFor(q: string, range: string): string;
  nothingFor(text: string): string;
  // un mot mal écrit (« parfun ») : Zara propose le mot de la boutique le plus proche et montre déjà ses articles
  didYouMean(q: string, fixed: string): string;
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
  // commande commencée (article choisi) mais pas confirmée
  orderReminder(name: string, total: number): string;
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
  // l'article commandé dans la conversation (plus de panier : une commande = un article)
  cart: {
    picked(name: string, variant: string, price: string): string;
    current(name: string, variant: string, qty: number, total: string): string;
    askSize(name: string): string;
    askColor(name: string): string;
    sizeLabel(size: string): string;
    cancelled: string;
    unavailable(name: string): string;
    unavailableAlt: string;
    addError: string;
    empty: string;
    needLogin: string;
    guestOrder: string;
    priceChanged(name: string, from: string, to: string): string;
    blocked(name: string, stock: number): string;
    askWhich: string;
    addWhat: string;
    foundToAdd: string;
    tapPlus: string;
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
    androidOpenChrome: string;
    androidSamsung: string;
    desktop: string;
    productNudge: string;
  };
  // rappel d'activer les notifications (installé mais notifications pas encore autorisées)
  push: {
    ask: string;
    done: string;
    later: string;
    notGranted: string;
    failed: string;
    blockedAndroid: string;
    blockedIos: string;
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
  // saison fraîche : blousons et manteaux mis en avant jusqu'à fin décembre (seulement les vrais articles ; la remise annoncée est la vraie, aucune date limite d'offre)
  season: {
    cold: string;
    coldIntro(count: number, minPrice: string, maxPct: number | null): string;
    coldNone: string;
  };
  // conclure la vente : le client hésite (« je réfléchis »), Zara répond avec des faits vrais puis propose de l'aide
  closing: {
    later: string;
    favorites: string;
    cartKept: string;
    callbackOffer: string;
    validity: string;
    proof(n: number): string;
  };
  // un clic sur la publicité « Zara vous conseille » : Zara prend le relais dans le chat, comme vendeuse
  advise: {
    intro(name: string, price: string): string;
    ask: string;
    gone: string;
    chipOrder: string;
    chipOthers: string;
  };
  // rappel WhatsApp : prénom, numéro, accord du client ; ensuite la demande part à l'équipe (liste dans l'admin)
  callback: {
    askName: string;
    askPhone(name: string): string;
    badPhone: string;
    askDay: string;
    badDay: string;
    confirm(name: string, phone: string, note: string, day: string): string;
    done(day: string): string;
    failed: string;
    cancelled: string;
  };
  // psychologie commerciale et vente émotionnelle : valoriser le client, jamais de fausse rareté ni d'urgence, seulement les vrais prix et stocks
  persona: {
    askStyle: string;
    compareOffer: string;
    jobAck: Record<'pro' | 'student', string>;
    styleSet: Record<StyleKey, string>;
    tone: Record<ToneKey, string[]>;
    ranges: {
      intro: string;
      deal(name: string, price: string): string;
      favorite(name: string, price: string): string;
      premium(name: string, price: string): string;
      closing: string;
      tooClose: string;
    };
    compare: {
      intro: string;
      line(name: string, price: string, extras: string[]): string;
      cheaper(name: string, diff: string): string;
      samePrice: string;
      moreChoice(name: string): string;
      ask: string;
      needTwo: string;
      colors(n: number): string;
      sizes(list: string): string;
    };
    loyal: {
      intro: string;
      points(points: number, tier: LoyaltyTier['key'], missing: number, next: LoyaltyTier['key'] | null): string;
    };
  };
  // achat en gros : Zara ne donne aucun prix de gros, elle passe la main à l'équipe sur WhatsApp
  wholesale: {
    ask: string;
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
    `${greeted ? '' : `Salut${name ? ` ${name}` : ''} ! 😍👋 `}Bienvenue chez Albasse Shopping ! ${rank ? `Vous êtes mon ${ordinalFr(rank)} client aujourd’hui, ça` : 'Ça'} me fait plaisir de vous accueillir ! 🥰🛍️\n🇹🇩 Nous sommes une plateforme 100 % TCHADIENNE !\nDites-moi, qu’est-ce qui vous ferait plaisir aujourd’hui ? Je suis là pour vous aider à trouver les meilleurs articles ! ❤️`,
  teaser: (name) => `Bonjour${name ? ` ${name}` : ''} ! Je suis ${ASSISTANT_NAME}, l'${ASSISTANT_ROLE} d'Albasse Shopping. 😊`,
  hello: (name) => `Salut ${name} ! 😍👋`,
  memberBack: (name) => `Salut ${name} ! 😍👋 Vous êtes bien connecté(e), ça me fait plaisir de vous retrouver ! 🥰`,
  teaserMember: (name) => `Salut ${name} ! 😍👋 ${ASSISTANT_NAME} est à votre service 🛍️`,
  teaserPush: (name) => `🔔 ${name ? `${name}, activez` : 'Activez'} les notifications pour ne rater aucune promo !`,
  teaserInstall: (name) => `📲 ${name ? `${name}, installez` : 'Installez'} l'application Albasse : promos en avant-première et suivi de vos commandes !`,
  askName: 'Comment puis-je vous appeler ?',
  askNameGuest: 'Comment puis-je vous appeler ? Si vous avez déjà un compte, connectez-vous : je vous reconnaîtrai 😊',
  askNameMember: 'Je vois que vous êtes connecté(e) 😊 Votre compte n’a pas encore de prénom : comment puis-je vous appeler ?',
  nice: (name) => `Enchantée ${name} ! 😊`,
  footer: `${ASSISTANT_NAME} est une assistante automatique. Pour une commande ou un souci, écrivez-nous sur WhatsApp.`,
  placeholder: { message: 'Écrivez votre message…', name: 'Écrivez votre prénom…', city: 'Écrivez votre ville…', amount: 'Écrivez un montant…', fullName: 'Écrivez votre nom complet…', phone: 'Ex. 66123456', address: 'Quartier, rue, repère…', day: 'Ou écrivez le jour (ex. jeudi)…', time: 'Ou écrivez l’heure (ex. 14h30)…' },
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
  card: { see: 'Voir le produit ›', soldOut: 'Épuisé', last: 'Dernier en stock', only: (n) => `Plus que ${n} en stock`, addLabel: (name) => `Commander : ${name}`, order: 'Commander' },
  langSwitched: 'Très bien, on continue en français 😊',
  chip: {
    skip: 'Passer',
    createAccount: '👤 Créer mon compte',
    login: 'Me connecter',
    promotions: '🔥 Promotions',
    coldSeason: '🧥 Blousons & manteaux',
    news: '🆕 Nouveautés',
    advice: '🎯 Conseil',
    categories: '🛍️ Catégories',
    delivery: '🚚 Livraison et paiement',
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
    editSlot: '📅 Rendez-vous',
    otherDay: '↩️ Autre jour',
    skipSlot: 'Passer',
    useAddress: (address) => `📍 Utiliser : ${address.length > 26 ? `${address.slice(0, 25).trimEnd()}…` : address}`,
    orderPage: '📄 Page de commande',
    invoice: '📄 Télécharger ma facture',
    retry: '🔄 Réessayer',
    points: '🏆 Mes points',
    earnPoints: '🎁 Gagner des points',
    myAccount: '👤 Mon compte',
    giftIdea: '🎁 Idée cadeau',
    wrap: '🎁 Emballage cadeau',
    policy: '📄 Conditions de retour',
    otherLang: '🌐 العربية',
    checkout: '✅ Terminer ma commande',
    seeMore: '➕ Voir plus',
    openChrome: '🌐 Ouvrir dans Chrome',
    categoryPage: (category) => `📄 Page « ${category} »`,
    cancel: 'Annuler',
    installApp: '📲 Installer Albasse Shopping',
    installHelp: '📲 Voir comment installer',
    enablePush: '🔔 Activer les notifications',
    alreadyInstalled: '✅ Oui, déjà installée',
    tutorial: '🎬 Voir le tutoriel',
    notNow: 'Plus tard',
    callback: '📲 Me rappeler sur WhatsApp',
    callbackYes: 'Oui, d’accord',
    callbackFix: 'Changer le numéro',
    callbackDayFix: 'Changer le jour',
    styleElegant: '✨ Élégant / premium',
    styleTrend: '🔥 Moderne et tendance',
    styleSport: '👟 Sportif',
    styleBudget: '💰 Petit prix',
    myStyle: '🎨 Mon style',
    ranges: '🎯 3 gammes de prix',
    compare: '⚖️ Comparer',
    newForMe: '🆕 Nouveautés pour moi',
    take: (name) => `✅ Je prends : ${name}`,
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
    askDay: '📅 Voulez-vous choisir le jour et l’heure de votre livraison à N’Djamena ? Touchez un jour, ou « Passer ».',
    askTime: (day) => `⏰ Quelle heure pour ${day} ? Les rendez-vous vont de 8h30 à 15h30 (au moins 2 h après votre commande).`,
    slotLost: 'Ce rendez-vous n’est plus possible (il doit avoir lieu au moins 2 h après votre commande). Choisissons un autre jour et une autre heure 📅',
    slotLine: (label) => `📅 Livraison programmée : ${label}`,
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
        ...(d.slot ? [`📅 Livraison programmée : ${d.slot}`] : []),
        ...(d.gift ? [`🎁 Emballage cadeau : ${fcfa(GIFT_WRAP_FEE)}`] : []),
        ...(d.discount ? [`⭐ Remise fidélité −10 % (vous êtes un client fidèle, merci !) : −${fcfa(d.discount)}`] : []),
        `💰 Total : ${fcfa(d.total)}`,
        `👤 ${d.name} · 📞 ${d.phone}`,
        `📍 ${d.address}, ${d.city}`,
        d.method === 'cash_on_delivery' ? '💵 Paiement à la livraison, en espèces' : `📱 Paiement à l’avance par ${d.method === 'airtel_money' ? 'Airtel Money' : 'Moov Money'}`,
        'Tout est correct ? Touchez « Confirmer la commande » pour l’enregistrer 👇',
      ].join('\n'),
    pickButton: 'Touchez un des boutons ci-dessous pour continuer 👇',
    editWhat: 'Que voulez-vous modifier ? ✏️',
    cancelled: 'D’accord, j’ai arrêté la commande. L’article reste choisi : touchez « Terminer ma commande » quand vous voulez 🙂',
    resumeLost: 'Je ne retrouve plus les informations de cette commande. Touchez « Terminer ma commande » pour la reprendre 🙂',
    priceChanged: 'Les prix ou le stock ont changé : voici le nouveau récapitulatif. Vérifiez, puis confirmez à nouveau 👇',
    codOnlyHome: `Le paiement à la livraison est possible seulement à ${HOME_CITY}. Choisissez Airtel Money ou Moov Money 📱`,
    placed: (name, id) => `🎉 Merci ${name} ! Votre commande #${id} a bien été enregistrée.`,
    invoiceReady: '🧾 Votre facture est prête : touchez « Télécharger ma facture ».',
    totalToPay: (total) => `💰 Total à régler : ${fcfa(total)}`,
    giftIncluded: `🎁 Emballage cadeau inclus (${fcfa(GIFT_WRAP_FEE)})`,
    payCash: '💵 Vous payez en espèces directement à la livraison.',
    payInitiated: (label, message) => `📱 Paiement ${label} initié. ${message}`,
    payUrl: (url) => `📱 Payez ici : ${url}`,
    payNumber: (amount, number, label) => `📱 Envoyez ${fcfa(amount)} au ${number} (${label}).`,
    payTeam: (phone, label) => `📞 Notre équipe vous contactera au ${phone} pour finaliser le paiement ${label}.`,
    failed: '😕 Je n’ai pas pu enregistrer votre commande pour le moment. Vous pouvez réessayer, finaliser sur la page de commande, ou nous écrire sur WhatsApp.',
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
  categoryIntro: (category, total) => `🛍️ ${category} : voici nos articles{nom} 👇${total > 1 ? ` (${total} disponibles)` : ''}`,
  categoryMore: (category, from, to, total) => `🛍️ ${category} : la suite, ${from} à ${to} sur ${total} 👇`,
  categoryEmpty: 'Pas d’article disponible dans cette catégorie pour le moment 😔 Voici d’autres idées :',
  foundFor: (q, range) => `Voici ce que j’ai trouvé pour « ${q} »${range ? ` ${range}` : ''}{nom} :`,
  fallbackFor: (q, range) => `Je n’ai rien ${range} pour « ${q} ». Voici ce qui s’en approche le plus :`,
  nothingFor: (text) => `Je n’ai rien trouvé pour « ${text} » 😕 Dites-moi ce que vous aimez, je vous conseille, ou parcourez nos catégories.`,
  didYouMean: (q, fixed) => `Je n’ai rien trouvé pour « ${q} » 😕 Vouliez-vous dire « ${fixed} » ? Voici ce que j’ai trouvé{nom} :`,
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
    `Vous regardez « ${name} » ? Excellent choix ! ${price}.${n === null ? '' : `\n${n === 1 ? 'Il n’en reste qu’un en stock' : `Plus que ${n} en stock`} : ne tardez pas !`}\nPour le commander, touchez « Commander » en bas de l’écran 👇`,
  orderReminder: (name, total) => `🛍️ Votre commande n’est pas terminée : « ${name} » pour ${fcfa(total)}. Terminez-la en quelques secondes !`,
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
    'Touchez « Commander » sous l’article : c’est simple et rapide ! 🛍️',
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
  howToOrder: `Commander est simple 👇\n💬 Je peux finaliser votre commande avec vous, ici : touchez « Commander » sous l’article qui vous plaît.\nOu sur le site :\n1. Ouvrez le produit qui vous plaît\n2. Choisissez la couleur, la taille et la quantité\n3. Touchez « Commander »\n4. Indiquez votre nom, téléphone, ville et adresse\n5. Payez : à la livraison à N’Djamena, à l’avance (Airtel Money ou Moov Money) dans les autres villes\n🎁 En option : emballage cadeau, ${fcfa(GIFT_WRAP_FEE)} (touchez l’image cadeau)\n⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h.`,

  cart: {
    picked: (name, variant, price) => `✅ Très bon choix : « ${name} »${variant} · ${price}`,
    current: (name, variant, qty, total) => `🛍️ Votre commande : « ${name} »${variant}${qty > 1 ? ` × ${qty}` : ''} · ${total}`,
    askSize: (name) => `Quelle taille pour « ${name} » ?`,
    askColor: (name) => `Quelle couleur pour « ${name} » ?`,
    sizeLabel: (size) => `Taille ${size}`,
    cancelled: 'D’accord, on ne commande rien pour le moment 😊',
    unavailable: (name) => `Désolé, « ${name} » n’est plus disponible pour le moment.`,
    unavailableAlt: 'Voici des articles proches, disponibles :',
    addError: 'Je n’arrive pas à préparer la commande de cet article pour le moment. Réessayez dans un instant, ou touchez le produit pour l’ouvrir.',
    empty: 'Vous n’avez pas encore choisi d’article 🛍️ Dites-moi ce que vous cherchez : touchez « Commander » sous l’article voulu, je m’occupe du reste.',
    needLogin: 'Pour valider votre commande, créez votre compte ou connectez-vous (c’est gratuit). L’article reste choisi 🛍️',
    guestOrder: 'Pas besoin de compte pour commander 😊 Je vous ouvre la page de commande : écrivez votre prénom, votre nom, votre téléphone et votre e-mail, et votre compte se crée tout seul quand vous confirmez. L’article reste choisi 🛍️',
    priceChanged: (name, from, to) => `ℹ️ Le prix de « ${name} » a changé : ${from} → ${to}.`,
    blocked: (name, stock) => (stock > 0 ? `⚠️ Il ne reste que ${stock} « ${name} » : choisissez une quantité plus petite pour commander.` : `⚠️ « ${name} » n’est plus disponible : choisissez un autre article.`),
    askWhich: 'Lequel voulez-vous commander ?',
    addWhat: 'Bien sûr ! Dites-moi ce que vous cherchez : je vous montre les articles avec un bouton « Commander » 👇',
    foundToAdd: 'Voici ce que j’ai trouvé : touchez « Commander » sous l’article voulu 👇',
    tapPlus: 'Astuce : touchez « Commander » sous un article, je prends votre commande ici même 🛍️',
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
    androidOpenChrome: '⚠️ Vous êtes dans le navigateur de TikTok, Facebook, WhatsApp ou Instagram : l’installation n’y marche pas.\n1. Touchez « Ouvrir dans Chrome » ci-dessous (ou les trois points ⋮ puis « Ouvrir dans le navigateur »)\n2. Dans Chrome, touchez les trois points (⋮) en haut à droite, puis « Installer l’application » ou « Ajouter à l’écran d’accueil »',
    androidSamsung: 'Pour installer : touchez le menu (☰) en bas de Samsung Internet, puis « Ajouter la page à » et « Écran d’accueil ».',
    desktop: 'Pour installer : cliquez sur l’icône d’installation ⊕ dans la barre d’adresse de Chrome, ou sur les trois points (⋮) puis « Installer Albasse Shopping ».',
    productNudge: '📲 Astuce : installez Albasse Shopping sur votre écran d’accueil pour retrouver nos articles en un toucher.',
  },
  push: {
    ask: '🔔 Vous avez installé Albasse Shopping, mais les notifications ne sont pas encore activées.\nActivez-les pour recevoir en premier nos promotions, nos ventes flash et nos nouveautés !',
    done: '🎉 C’est activé ! Vous recevrez nos promotions et nos nouveautés directement sur votre téléphone.',
    later: 'D’accord 😊 Je vous le rappellerai plus tard. Vous pouvez aussi les activer à tout moment depuis le menu.',
    notGranted: 'Les notifications n’ont pas été autorisées 😊 Je vous le rappellerai plus tard.',
    failed: 'Je n’ai pas pu activer les notifications cette fois 😕 Réessayez dans un instant.',
    blockedAndroid:
      '🔔 Les notifications d’Albasse Shopping sont bloquées sur ce téléphone. Pour les autoriser :\n1. Restez appuyé sur l’icône Albasse Shopping de votre écran d’accueil\n2. Touchez « Infos sur l’appli » (ⓘ), puis « Notifications »\n3. Activez « Autoriser les notifications »\nDans Chrome : touchez le cadenas à gauche de l’adresse, puis « Autorisations », « Notifications » et « Autoriser ».',
    blockedIos: '🔔 Les notifications sont bloquées. Sur iPhone : ouvrez « Réglages », puis « Notifications », « Albasse Shopping », et activez « Autoriser les notifications ».',
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
    sizesReply: (name, sizes) => `Voici les tailles proposées pour « ${name} » : ${sizes.join(', ')} 😊 Touchez « Commander » sous l’article pour le commander.`,
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
  season: {
    cold: '🧥 La saison fraîche arrive : nos blousons et manteaux sont là ! Touchez « Blousons & manteaux » (ou écrivez « manteau ») et je vous montre les vrais modèles, avec les vrais prix et les vrais stocks.',
    coldIntro: (n, min, pct) => `🧥 Nos blousons et manteaux{nom} : ${n} modèle${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''}, à partir de ${min}${pct ? ` (jusqu’à -${pct} % sur l’ancien prix)` : ''} 👇`,
    coldNone: 'Je n’ai pas de blouson ni de manteau en stock pour le moment 😕 Découvrez nos autres vêtements ou nos promotions.',
  },
  closing: {
    later: 'Pas de souci{nom} 😊 Prenez votre temps.',
    favorites: '❤️ Touchez le cœur sur un produit pour le retrouver dans vos favoris (avec un compte gratuit).',
    cartKept: '🛍️ L’article choisi reste enregistré sur cet appareil.',
    callbackOffer: 'Si vous préférez, l’équipe peut vous écrire sur WhatsApp quand vous serez prêt(e) 📲',
    validity: `⏳ Si vous commandez, la commande reste valable ${ORDER_VALIDITY_HOURS} h.`,
    proof: (n) => `👍 Cet article a été commandé ${n} fois ces 7 derniers jours.`,
  },
  advise: {
    intro: (name, price) => `Bonjour{nom} 😊 Je suis Zara, votre conseillère. J’ai choisi pour vous « ${name} » : ${price}.`,
    ask: 'Je peux m’occuper de votre commande tout de suite 🛍️ Une question sur cet article ? Écrivez-la ici, je vous réponds.',
    gone: 'Cet article n’est plus disponible pour le moment{nom} 🙏 Voulez-vous voir d’autres idées ?',
    chipOrder: '🛒 Commander cet article',
    chipOthers: '🔎 D’autres idées',
  },
  callback: {
    askName: 'Avec plaisir 😊 Quel est votre prénom ?',
    askPhone: (name) => `Merci ${name} 🙏 Quel est votre numéro WhatsApp ? (exemple : 66 12 34 56)`,
    badPhone: 'Je n’ai pas bien compris ce numéro 🙏 Il faut 8 chiffres (exemple : 66 12 34 56).',
    askDay: 'Quel jour voulez-vous que l’équipe vous écrive ? 📅',
    badDay: 'Je n’ai pas compris le jour 🙏 Touchez un des jours ci-dessous.',
    confirm: (name, phone, note, day) => `Je transmets à l’équipe : ${name}, WhatsApp ${phone}${note ? ` (à propos de : ${note})` : ''}.\n📅 Elle vous écrira sur WhatsApp : ${day}\nC’est d’accord ?`,
    done: (day) => `C’est noté ✅ L’équipe vous écrira sur WhatsApp : ${day}\nMerci de votre confiance 🙏`,
    failed: 'Je n’ai pas pu enregistrer votre demande 😕 Écrivez-nous directement sur WhatsApp : l’équipe vous répondra.',
    cancelled: 'D’accord, je n’enregistre rien 😊',
  },
  persona: {
    compareOffer: '⚖️ Je peux aussi vous montrer les différences entre ces modèles pour vous aider à choisir 😊',
    askStyle: 'Avec plaisir ! 😊 Pour bien vous conseiller, qu’est-ce qui vous ferait le plus plaisir : un style élégant, quelque chose de moderne et tendance, un look sportif, ou un petit prix ?',
    jobAck: {
      pro: 'Enchanté ! 😊 Merci de me parler de vous. Pour bien vous conseiller, qu’est-ce qui vous ferait le plus plaisir : un style élégant, quelque chose de moderne et tendance, un look sportif, ou un petit prix ?',
      student: 'Super ! 😊 Merci de me parler de vous. Pour bien vous conseiller, qu’est-ce qui vous ferait le plus plaisir : quelque chose de moderne et tendance, un petit prix, un look sportif, ou un style plus élégant ?',
    },
    styleSet: {
      elegant: 'Très bon choix ✨ Je vous montre des pièces élégantes, avec une belle allure.',
      trend: 'Parfait 🔥 Du moderne, facile à associer avec d’autres pièces : je vous montre ça.',
      sport: 'Super 👟 Un look sportif et confortable : je vous montre ce qui va bien ensemble.',
      budget: 'Pas de souci 😊 On peut trouver quelque chose de stylé à un prix accessible ! Je vous montre les meilleures options.',
    },
    tone: {
      elegant: [
        'Ce modèle pourrait vraiment compléter votre style ! 😎 Regardez les photos : on y voit bien les détails.',
        'Si vous aimez les tenues soignées, ces pièces peuvent donner une belle allure sans en faire trop. ✨',
        'Dites-moi laquelle vous parle le plus, et je vous donne les tailles et couleurs disponibles. 😊',
      ],
      trend: [
        'Moderne et facile à associer avec d’autres pièces : un bon moyen de renouveler votre style ! 🔥',
        'Si vous aimez les looks actuels, celles-ci devraient vous plaire. Voulez-vous voir ce qui va avec ? 😊',
        'Dites-moi laquelle vous plaît, je vérifie les tailles et les couleurs pour vous. 👟',
      ],
      sport: [
        'Pour un look sportif et confortable, ces pièces sont pratiques au quotidien. 👟',
        'Je peux aussi vous montrer des chaussures ou des accessoires assortis pour compléter l’ensemble. 🔥',
        'Dites-moi laquelle vous plaît, et je vous donne les tailles disponibles. 😊',
      ],
      budget: [
        'L’objectif : trouver un article qui vous plaît, qui vous va bien et qui respecte votre budget. ❤️',
        'On peut avoir un look stylé sans trop dépenser. Dites-moi votre budget et je vous montre les meilleures options. 🛍️',
        'Les prix affichés sont ceux du site. Dites-moi laquelle vous plaît, je vérifie les tailles. 😊',
      ],
      hesitant: ['Pas de pression 😊 Je peux vous montrer les différences entre ces modèles pour vous aider à choisir celui qui vous convient le mieux.'],
      loyal: ['Merci pour votre fidélité ! ❤️ Je peux vous présenter des nouveautés qui correspondent à vos préférences.'],
      neutral: [],
    },
    ranges: {
      intro: 'J’ai trois idées pour vous ! 😊',
      deal: (name, price) => `💰 Bon plan : ${name} — ${price}`,
      favorite: (name, price) => `❤️ Coup de cœur : ${name} — ${price}`,
      premium: (name, price) => `✨ Style premium : ${name} — ${price} (le plus haut de gamme de cette sélection)`,
      closing: 'Les prix et les stocks sont ceux du site. Laquelle de ces idées vous plaît le plus ? 😊',
      tooClose: 'Dans cette sélection, les prix sont très proches : je vous montre simplement les meilleurs choix.',
    },
    compare: {
      intro: 'Comparons-les ensemble 😊',
      line: (name, price, extras) => `• ${name} : ${price}${extras.length > 0 ? ` · ${extras.join(' · ')}` : ''}`,
      cheaper: (name, diff) => `💰 Le plus accessible : ${name} (${diff} de moins).`,
      samePrice: 'Ils sont au même prix : le choix se fait surtout selon vos goûts. 😊',
      moreChoice: (name) => `🎨 Le plus de choix en couleurs ou en tailles : ${name}.`,
      ask: 'Dites-moi ce qui compte le plus pour vous (le prix, le style, les couleurs) et je vous aide à choisir. 😊',
      needTwo: 'Pour comparer, il me faut deux articles. Dites-moi lesquels, ou voulez-vous que je vous en montre quelques-uns ?',
      colors: (n) => `${n} couleur${n > 1 ? 's' : ''}`,
      sizes: (list) => `tailles ${list}`,
    },
    loyal: {
      intro: 'Merci pour votre fidélité ! ❤️ Voici quelques nouveautés qui peuvent vous plaire.',
      points: (points, tier, missing, next) => `⭐ Vos points : ${points} (grade ${tierOf(tier).label} ${tierOf(tier).icon})${next && missing > 0 ? ` · il vous manque ${FR_POINTS(missing)} pour le grade ${tierOf(next).label}` : ''}.`,
    },
  },
  wholesale: {
    ask: '📦 Pour les achats en gros (cartons, grandes quantités), les prix sont donnés directement par notre équipe 😊 Écrivez-nous sur WhatsApp avec : l’article, la quantité (ou le nombre de cartons) et votre ville.',
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
    `${greeted ? '' : `مرحباً${name ? ` ${name}` : ''}! 😍👋 `}أهلاً بك في Albasse Shopping! ${rank ? `أنت رقم ${rank} بين عملائي اليوم، ويسعدني` : 'يسعدني'} استقبالك! 🥰🛍️\n🇹🇩 نحن منصة تشادية 100%!\nما الذي يسعدك اليوم؟ أنا هنا لمساعدتك في إيجاد أفضل المنتجات! ❤️`,
  teaser: (name) => `مرحبا${name ? ` ${name}` : ''}! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping. 😊`,
  hello: (name) => `مرحباً ${name}! 😍👋`,
  memberBack: (name) => `مرحباً ${name}! 😍👋 تم تسجيل دخولك، ويسعدني لقاؤك من جديد! 🥰`,
  teaserMember: (name) => `مرحباً ${name}! 😍👋 زارا كينغز في خدمتك 🛍️`,
  teaserPush: (name) => `🔔 ${name ? `${name}، ` : ''}فعّل الإشعارات حتى لا تفوتك أي عروض!`,
  teaserInstall: (name) => `📲 ${name ? `${name}، ` : ''}ثبّت تطبيق Albasse: العروض أولاً ومتابعة طلباتك!`,
  askName: 'كيف يمكنني أن أناديك؟',
  askNameGuest: 'كيف يمكنني أن أناديك؟ إذا كان لديك حساب، سجّل الدخول وسأتعرف عليك 😊',
  askNameMember: 'أرى أنك مسجّل الدخول 😊 حسابك لا يحتوي على اسم بعد، فكيف يمكنني أن أناديك؟',
  nice: (name) => `سعدت بمعرفتك يا ${name}! 😊`,
  footer: 'زارا كينغز مساعدة آلية. لأي طلب أو مشكلة، راسلنا على واتساب.',
  placeholder: { message: 'اكتب رسالتك…', name: 'اكتب اسمك الأول…', city: 'اكتب مدينتك…', amount: 'اكتب مبلغا…', fullName: 'اكتب اسمك الكامل…', phone: 'مثال: 66123456', address: 'الحي، الشارع، معلم قريب…', day: 'أو اكتب اليوم (مثال: الخميس)…', time: 'أو اكتب الساعة (مثال: 14:30)…' },
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
  card: { see: 'عرض المنتج ›', soldOut: 'نفد', last: 'آخر قطعة', only: (n) => `بقي ${n} فقط`, addLabel: (name) => `اطلب: ${name}`, order: 'اطلب' },
  langSwitched: 'حسنا، نكمل بالعربية 😊',
  chip: {
    skip: 'تخطي',
    createAccount: '👤 إنشاء حسابي',
    login: 'تسجيل الدخول',
    promotions: '🔥 العروض',
    coldSeason: '🧥 جاكيتات ومعاطف',
    news: '🆕 الجديد',
    advice: '🎯 نصيحة',
    categories: '🛍️ الفئات',
    delivery: '🚚 التوصيل والدفع',
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
    editSlot: '📅 الموعد',
    otherDay: '↩️ يوم آخر',
    skipSlot: 'تخطي',
    useAddress: (address) => `📍 استخدم: ${address.length > 26 ? `${address.slice(0, 25).trimEnd()}…` : address}`,
    orderPage: '📄 صفحة الطلب',
    invoice: '📄 تحميل فاتورتي',
    retry: '🔄 إعادة المحاولة',
    points: '🏆 نقاطي',
    earnPoints: '🎁 اكسب نقاطاً',
    myAccount: '👤 حسابي',
    giftIdea: '🎁 فكرة هدية',
    wrap: '🎁 تغليف الهدايا',
    policy: '📄 شروط الإرجاع',
    otherLang: '🌐 Français',
    checkout: '✅ أكمل طلبي',
    seeMore: '➕ عرض المزيد',
    openChrome: '🌐 افتح في Chrome',
    categoryPage: (category) => `📄 صفحة «${category}»`,
    cancel: 'إلغاء',
    installApp: '📲 تثبيت Albasse Shopping',
    installHelp: '📲 شاهد كيفية التثبيت',
    enablePush: '🔔 تفعيل الإشعارات',
    alreadyInstalled: '✅ نعم، مثبّت بالفعل',
    tutorial: '🎬 عرض الشرح',
    notNow: 'لاحقا',
    callback: '📲 تواصلوا معي على واتساب',
    callbackYes: 'نعم، موافق',
    callbackFix: 'تغيير الرقم',
    callbackDayFix: 'تغيير اليوم',
    styleElegant: '✨ أنيق / فاخر',
    styleTrend: '🔥 عصري وموضة',
    styleSport: '👟 رياضي',
    styleBudget: '💰 سعر مناسب',
    myStyle: '🎨 ذوقي',
    ranges: '🎯 3 فئات سعرية',
    compare: '⚖️ قارن',
    newForMe: '🆕 جديد لي',
    take: (name) => `✅ آخذ: ${name}`,
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
    askDay: '📅 هل تريد اختيار يوم وساعة التوصيل في إنجامينا؟ اختر يوماً، أو اضغط «تخطي».',
    askTime: (day) => `⏰ في أي ساعة (${day})؟ المواعيد من 8:30 إلى 15:30 (بعد ساعتين على الأقل من طلبك).`,
    slotLost: 'لم يعد هذا الموعد ممكناً (يجب أن يكون بعد ساعتين على الأقل من طلبك). لنختر يوماً وساعة أخرى 📅',
    slotLine: (label) => `📅 توصيل بموعد محدد: ${label}`,
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
        ...(d.slot ? [`📅 توصيل بموعد محدد: ${d.slot}`] : []),
        ...(d.gift ? [`🎁 تغليف الهدية: ${fcfa(GIFT_WRAP_FEE)}`] : []),
        ...(d.discount ? [`⭐ خصم الوفاء 10% (أنت زبون وفي، شكراً!): -${fcfa(d.discount)}`] : []),
        `💰 المجموع: ${fcfa(d.total)}`,
        `👤 ${d.name} · 📞 ${d.phone}`,
        `📍 ${d.address}، ${d.city}`,
        d.method === 'cash_on_delivery' ? '💵 الدفع عند الاستلام نقداً' : `📱 الدفع مسبقاً عبر ${d.method === 'airtel_money' ? 'Airtel Money' : 'Moov Money'}`,
        'هل كل شيء صحيح؟ اضغط «تأكيد الطلب» لتسجيله 👇',
      ].join('\n'),
    pickButton: 'اضغط على أحد الأزرار أدناه للمتابعة 👇',
    editWhat: 'ماذا تريد أن تعدّل؟ ✏️',
    cancelled: 'حسناً، أوقفت الطلب. المنتج الذي اخترته محفوظ: اضغط «أكمل طلبي» متى شئت 🙂',
    resumeLost: 'لم أعد أجد معلومات هذا الطلب. اضغط «أكمل طلبي» للمتابعة 🙂',
    priceChanged: 'تغيّرت الأسعار أو المخزون: هذا هو الملخص الجديد. راجعه ثم أكّد من جديد 👇',
    codOnlyHome: 'الدفع عند الاستلام ممكن فقط في إنجامينا. اختر Airtel Money أو Moov Money 📱',
    placed: (name, id) => `🎉 شكراً ${name}! تم تسجيل طلبك رقم #${id} بنجاح.`,
    invoiceReady: '🧾 فاتورتك جاهزة: اضغط على «تحميل فاتورتي».',
    totalToPay: (total) => `💰 المبلغ المطلوب: ${fcfa(total)}`,
    giftIncluded: `🎁 تغليف الهدية مُضمَّن (${fcfa(GIFT_WRAP_FEE)})`,
    payCash: '💵 تدفع نقداً عند الاستلام مباشرة.',
    payInitiated: (label, message) => `📱 تم بدء الدفع عبر ${label}. ${message}`,
    payUrl: (url) => `📱 ادفع من هنا: ${url}`,
    payNumber: (amount, number, label) => `📱 أرسل ${fcfa(amount)} إلى الرقم ${number} (${label}).`,
    payTeam: (phone, label) => `📞 سيتصل بك فريقنا على ${phone} لإتمام الدفع عبر ${label}.`,
    failed: '😕 لم أستطع تسجيل طلبك الآن. يمكنك المحاولة من جديد، أو الإتمام من صفحة الطلب، أو مراسلتنا على واتساب.',
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
  categoryIntro: (category, total) => `🛍️ ${category}: إليك منتجاتنا{nom} 👇${total > 1 ? ` (${total} متوفرة)` : ''}`,
  categoryMore: (category, from, to, total) => `🛍️ ${category}: البقية، من ${from} إلى ${to} من ${total} 👇`,
  categoryEmpty: 'لا توجد منتجات متوفرة في هذه الفئة حاليا 😔 إليك أفكارا أخرى:',
  foundFor: (q, range) => `إليك ما وجدته من أجل «${q}»${range ? ` ${range}` : ''}{nom}:`,
  fallbackFor: (q, range) => `لم أجد شيئا ${range} من أجل «${q}». إليك الأقرب إلى طلبك:`,
  nothingFor: (text) => `لم أجد شيئا من أجل «${text}» 😕 أخبرني بما تحب فأنصحك، أو تصفح فئاتنا.`,
  didYouMean: (q, fixed) => `لم أجد شيئا من أجل «${q}» 😕 هل تقصد «${fixed}»؟ إليك ما وجدته{nom}:`,
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
    `هل تنظر إلى «${name}»؟ اختيار ممتاز! ${price}.${n === null ? '' : `\n${n === 1 ? 'بقيت قطعة واحدة فقط' : `بقي ${n} فقط في المخزون`}: لا تتأخر!`}\nللطلب، اضغط على «Commander» (اطلب) أسفل الشاشة 👇`,
  orderReminder: (name, total) => `🛍️ طلبك لم يكتمل بعد: «${name}» بقيمة ${fcfa(total)}. أكمله في ثوانٍ!`,
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
    'اضغط «اطلب» تحت المنتج: الأمر سهل وسريع! 🛍️',
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
  howToOrder: `الطلب سهل 👇\n💬 يمكنني إتمام طلبك معك هنا: اضغط «اطلب» تحت المنتج الذي يعجبك.\nأو من الموقع:\n1. افتح المنتج الذي يعجبك\n2. اختر اللون والمقاس والكمية\n3. اضغط على «Commander» (اطلب)\n4. اكتب اسمك وهاتفك ومدينتك وعنوانك\n5. ادفع: عند الاستلام في إنجامينا، ومسبقا (Airtel Money أو Moov Money) في المدن الأخرى\n🎁 اختياري: تغليف الهدايا بـ ${fcfa(GIFT_WRAP_FEE)} (اضغط على صورة الهدية)\n⏳ لتجنب الطلبات الوهمية، كل طلب صالح لمدة ${ORDER_VALIDITY_HOURS} ساعة.`,

  cart: {
    picked: (name, variant, price) => `✅ اختيار ممتاز: «${name}»${variant} · ${price}`,
    current: (name, variant, qty, total) => `🛍️ طلبك: «${name}»${variant}${qty > 1 ? ` × ${qty}` : ''} · ${total}`,
    askSize: (name) => `ما المقاس المناسب لـ «${name}»؟`,
    askColor: (name) => `ما اللون المناسب لـ «${name}»؟`,
    sizeLabel: (size) => `المقاس ${size}`,
    cancelled: 'حسنا، لن نطلب شيئا الآن 😊',
    unavailable: (name) => `عذرا، «${name}» غير متوفر حاليا.`,
    unavailableAlt: 'إليك منتجات قريبة منه ومتوفرة:',
    addError: 'لا أستطيع تجهيز طلب هذا المنتج الآن. حاول بعد قليل، أو افتح المنتج مباشرة.',
    empty: 'لم تختر أي منتج بعد 🛍️ أخبرني بما تبحث عنه: اضغط «اطلب» تحت المنتج المطلوب وأتكفل بالباقي.',
    needLogin: 'لإتمام طلبك، أنشئ حسابك أو سجل الدخول (مجاني). المنتج الذي اخترته محفوظ 🛍️',
    guestOrder: 'لا حاجة إلى حساب لإتمام الطلب 😊 سأفتح لك صفحة الطلب: اكتب اسمك الأول واسم العائلة ورقم هاتفك وبريدك الإلكتروني، وسيُنشأ حسابك تلقائياً عند التأكيد. المنتج الذي اخترته محفوظ 🛍️',
    priceChanged: (name, from, to) => `ℹ️ تغير سعر «${name}»: ${from} ← ${to}.`,
    blocked: (name, stock) => (stock > 0 ? `⚠️ لم يبق سوى ${stock} من «${name}»: اختر كمية أقل لإتمام الطلب.` : `⚠️ «${name}» لم يعد متوفرا: اختر منتجا آخر.`),
    askWhich: 'أي منتج تريد أن تطلب؟',
    addWhat: 'بالتأكيد! أخبرني بما تبحث عنه: أعرض عليك المنتجات مع زر «اطلب» 👇',
    foundToAdd: 'إليك ما وجدته: اضغط «اطلب» تحت المنتج المطلوب 👇',
    tapPlus: 'نصيحة: اضغط «اطلب» تحت أي منتج، وأسجل طلبك هنا مباشرة 🛍️',
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
    androidOpenChrome: '⚠️ أنت في متصفح تيك توك أو فيسبوك أو واتساب أو إنستغرام: التثبيت لا يعمل فيه.\n1. اضغط «افتح في Chrome» بالأسفل (أو النقاط الثلاث ⋮ ثم «فتح في المتصفح»)\n2. في Chrome، اضغط على النقاط الثلاث (⋮) أعلى اليمين، ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»',
    androidSamsung: 'للتثبيت: اضغط على القائمة (☰) أسفل متصفح Samsung Internet، ثم «إضافة الصفحة إلى» ثم «الشاشة الرئيسية».',
    desktop: 'للتثبيت: اضغط على أيقونة التثبيت ⊕ في شريط عنوان Chrome، أو على النقاط الثلاث (⋮) ثم «تثبيت Albasse Shopping».',
    productNudge: '📲 نصيحة: ثبّت Albasse Shopping على شاشتك الرئيسية لتجد منتجاتنا بلمسة واحدة.',
  },
  push: {
    ask: '🔔 لقد ثبّت Albasse Shopping، لكن الإشعارات غير مفعّلة بعد.\nفعّلها لتصلك عروضنا وتخفيضاتنا السريعة ومنتجاتنا الجديدة أولاً!',
    done: '🎉 تم التفعيل! ستصلك عروضنا ومنتجاتنا الجديدة مباشرة على هاتفك.',
    later: 'حسناً 😊 سأذكّرك لاحقاً. يمكنك أيضاً تفعيلها في أي وقت من القائمة.',
    notGranted: 'لم يتم السماح بالإشعارات 😊 سأذكّرك لاحقاً.',
    failed: 'لم أتمكن من تفعيل الإشعارات هذه المرة 😕 حاول مرة أخرى بعد لحظة.',
    blockedAndroid:
      '🔔 إشعارات Albasse Shopping محظورة على هذا الهاتف. للسماح بها:\n1. اضغط مطولاً على أيقونة Albasse Shopping في شاشتك الرئيسية\n2. اضغط «معلومات التطبيق» (ⓘ) ثم «الإشعارات»\n3. فعّل «السماح بالإشعارات»\nفي Chrome: اضغط على القفل بجانب العنوان، ثم «الأذونات» و«الإشعارات» و«سماح».',
    blockedIos: '🔔 الإشعارات محظورة. على الآيفون: افتح «الإعدادات» ثم «الإشعارات» ثم «Albasse Shopping» وفعّل «السماح بالإشعارات».',
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
    sizesReply: (name, sizes) => `هذه المقاسات المعروضة لـ «${name}»: ${sizes.join('، ')} 😊 اضغط «اطلب» تحت المنتج لطلبه.`,
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
  season: {
    cold: '🧥 موسم البرد يقترب: جاكيتاتنا ومعاطفنا وصلت! اضغط «جاكيتات ومعاطف» (أو اكتب «معطف») وأعرض عليك الموديلات الحقيقية بأسعارها ومخزونها الحقيقيين.',
    coldIntro: (n, min, pct) => `🧥 جاكيتاتنا ومعاطفنا{nom}: ${n === 1 ? 'موديل واحد متوفر' : n === 2 ? 'موديلان متوفران' : `${n} موديلات متوفرة`}، ابتداء من ${min}${pct ? ` (حتى -${pct} % عن السعر القديم)` : ''} 👇`,
    coldNone: 'لا يوجد جاكيت أو معطف في المخزون الآن 😕 اكتشف ملابسنا الأخرى أو عروضنا.',
  },
  closing: {
    later: 'لا مشكلة{nom} 😊 خذ وقتك.',
    favorites: '❤️ اضغط على القلب في أي منتج لتجده في مفضلتك (بحساب مجاني).',
    cartKept: '🛍️ المنتج الذي اخترته محفوظ على هذا الجهاز.',
    callbackOffer: 'إذا أحببت، يمكن للفريق أن يراسلك على واتساب عندما تكون جاهزا 📲',
    validity: `⏳ إذا طلبت، يبقى الطلب صالحا لمدة ${ORDER_VALIDITY_HOURS} ساعة.`,
    proof: (n) => `👍 تم طلب هذا المنتج ${n} مرات خلال الأيام السبعة الأخيرة.`,
  },
  advise: {
    intro: (name, price) => `مرحبا{nom} 😊 أنا زارا، مستشارتك. اخترت لك «${name}»: ${price}.`,
    ask: 'يمكنني تجهيز طلبك الآن 🛍️ هل لديك سؤال عن هذا المنتج؟ اكتبه هنا وسأجيبك.',
    gone: 'هذا المنتج غير متوفر حاليا{nom} 🙏 هل تريد أن أعرض عليك أفكارا أخرى؟',
    chipOrder: '🛒 اطلب هذا المنتج',
    chipOthers: '🔎 أفكار أخرى',
  },
  callback: {
    askName: 'بكل سرور 😊 ما اسمك الأول؟',
    askPhone: (name) => `شكرا ${name} 🙏 ما رقم واتساب الخاص بك؟ (مثال: 66 12 34 56)`,
    badPhone: 'لم أفهم هذا الرقم جيدا 🙏 يجب أن يكون 8 أرقام (مثال: 66 12 34 56).',
    askDay: 'في أي يوم تريد أن يراسلك الفريق؟ 📅',
    badDay: 'لم أفهم اليوم 🙏 اضغط على أحد الأيام أدناه.',
    confirm: (name, phone, note, day) => `أحول إلى الفريق: ${name}، واتساب ${phone}${note ? ` (بخصوص: ${note})` : ''}.\n📅 سيراسلك الفريق على واتساب: ${day}\nهل أنت موافق؟`,
    done: (day) => `تم التسجيل ✅ سيراسلك الفريق على واتساب: ${day}\nشكرا لثقتك 🙏`,
    failed: 'لم أتمكن من تسجيل طلبك 😕 راسلنا مباشرة على واتساب وسيرد عليك الفريق.',
    cancelled: 'حسنا، لن أسجل شيئا 😊',
  },
  persona: {
    compareOffer: '⚖️ يمكنني أيضا أن أوضح لك الفروق بين هذه الموديلات لتختار الأنسب 😊',
    askStyle: 'بكل سرور! 😊 لأنصحك جيدا، ماذا يسعدك أكثر: أسلوب أنيق، أو شيء عصري ومواكب للموضة، أو إطلالة رياضية، أو سعر مناسب؟',
    jobAck: {
      pro: 'تشرفت بمعرفتك! 😊 شكرا لأنك حدثتني عن نفسك. لأنصحك جيدا، ماذا يسعدك أكثر: أسلوب أنيق، أو شيء عصري ومواكب للموضة، أو إطلالة رياضية، أو سعر مناسب؟',
      student: 'رائع! 😊 شكرا لأنك حدثتني عن نفسك. لأنصحك جيدا، ماذا يسعدك أكثر: شيء عصري ومواكب للموضة، أو سعر مناسب، أو إطلالة رياضية، أو أسلوب أكثر أناقة؟',
    },
    styleSet: {
      elegant: 'اختيار ممتاز ✨ سأعرض عليك قطعا أنيقة بمظهر جميل.',
      trend: 'ممتاز 🔥 عصري وسهل التنسيق مع قطع أخرى: سأعرض عليك ذلك.',
      sport: 'رائع 👟 إطلالة رياضية ومريحة: سأعرض عليك ما ينسجم معا.',
      budget: 'لا مشكلة 😊 يمكننا إيجاد شيء أنيق بسعر مناسب! سأعرض عليك أفضل الخيارات.',
    },
    tone: {
      elegant: [
        'هذا الموديل قد يكمل أسلوبك فعلا! 😎 انظر إلى الصور: التفاصيل ظاهرة فيها.',
        'إذا كنت تحب الملابس المرتبة، فهذه القطع تعطي مظهرا جميلا دون مبالغة. ✨',
        'قل لي أيها يعجبك أكثر وسأعطيك المقاسات والألوان المتوفرة. 😊',
      ],
      trend: [
        'عصري وسهل التنسيق مع قطع أخرى: طريقة جميلة لتجديد أسلوبك! 🔥',
        'إذا كنت تحب الإطلالات العصرية فهذه القطع ستعجبك. هل تريد أن ترى ما ينسجم معها؟ 😊',
        'قل لي أيها يعجبك وسأتحقق لك من المقاسات والألوان. 👟',
      ],
      sport: [
        'للإطلالة الرياضية والمريحة، هذه القطع عملية في كل يوم. 👟',
        'يمكنني أيضا أن أعرض عليك أحذية أو إكسسوارات منسجمة لتكتمل الإطلالة. 🔥',
        'قل لي أيها يعجبك وسأعطيك المقاسات المتوفرة. 😊',
      ],
      budget: [
        'الهدف: أن نجد شيئا يعجبك ويناسبك ويحترم ميزانيتك. ❤️',
        'يمكنك أن تكون أنيقا دون إنفاق كثير. أخبرني بميزانيتك وسأعرض عليك أفضل الخيارات. 🛍️',
        'الأسعار المعروضة هي أسعار الموقع. قل لي أيها يعجبك وسأتحقق من المقاسات. 😊',
      ],
      hesitant: ['دون ضغط 😊 يمكنني أن أوضح لك الفروق بين هذه الموديلات لتختار الأنسب لك.'],
      loyal: ['شكرا على وفائك! ❤️ يمكنني أن أعرض عليك جديدا يناسب ما تحب.'],
      neutral: [],
    },
    ranges: {
      intro: 'عندي ثلاث أفكار لك! 😊',
      deal: (name, price) => `💰 صفقة جيدة: ${name} — ${price}`,
      favorite: (name, price) => `❤️ اختيار القلب: ${name} — ${price}`,
      premium: (name, price) => `✨ أسلوب فاخر: ${name} — ${price} (الأعلى فئة في هذه المجموعة)`,
      closing: 'الأسعار والمخزون هي نفسها في الموقع. أي فكرة تعجبك أكثر؟ 😊',
      tooClose: 'في هذه المجموعة الأسعار متقاربة جدا: سأعرض عليك أفضل الخيارات فقط.',
    },
    compare: {
      intro: 'لنقارن بينهما معا 😊',
      line: (name, price, extras) => `• ${name}: ${price}${extras.length > 0 ? ` · ${extras.join(' · ')}` : ''}`,
      cheaper: (name, diff) => `💰 الأقل سعرا: ${name} (أرخص بـ ${diff}).`,
      samePrice: 'السعر نفسه: الاختيار يكون حسب ذوقك أساسا. 😊',
      moreChoice: (name) => `🎨 الأكثر تنوعا في الألوان أو المقاسات: ${name}.`,
      ask: 'قل لي ما الأهم عندك (السعر، الأسلوب، الألوان) وسأساعدك على الاختيار. 😊',
      needTwo: 'للمقارنة أحتاج إلى منتجين. قل لي أيهما تريد، أو هل تريد أن أعرض عليك بعضها؟',
      colors: (n) => (n === 1 ? 'لون واحد' : n === 2 ? 'لونان' : n <= 10 ? `${n} ألوان` : `${n} لونا`),
      sizes: (list) => `المقاسات ${list}`,
    },
    loyal: {
      intro: 'شكرا على وفائك! ❤️ إليك بعض الجديد الذي قد يعجبك.',
      points: (points, tier, missing, next) => `⭐ نقاطك: ${AR_POINTS(points)} (الدرجة ${TIER_AR[tier]} ${tierOf(tier).icon})${next && missing > 0 ? ` · ينقصك ${AR_POINTS(missing)} للوصول إلى الدرجة ${TIER_AR[next]}` : ''}.`,
    },
  },
  wholesale: {
    ask: '📦 لمشتريات الجملة (كراتين وكميات كبيرة) يقدم فريقنا الأسعار مباشرة 😊 راسلنا على واتساب مع: المنتج والكمية (أو عدد الكراتين) ومدينتك.',
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

