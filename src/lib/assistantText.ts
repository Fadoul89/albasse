import { ASSISTANT_NAME, ASSISTANT_ROLE } from '../constants/assistant';
import { DEFAULT_AGENCIES, DELIVERY_HOURS, GIFT_WRAP_FEE, HOME_CITY, ORDER_VALIDITY_HOURS, PAYMENT } from '../constants/shopRules';
import { CATEGORY_AR, type Lang, type Who } from './assistantLang';

// Tous les textes que Zara dit ou affiche, en français et en arabe. Un « {nom} » dans un texte devient
// « , Prénom » (ou « ، Prénom » en arabe) quand on connaît le prénom du visiteur.
// Les deux langues suivent la même interface : TypeScript vérifie qu'aucun texte ne manque.

export const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export interface Range {
  min: number;
  max: number; // Infinity : pas de plafond
}

export interface Texts {
  dir: 'ltr' | 'rtl';
  roleTitle: string;
  welcome(name: string | null): string;
  teaser(name: string | null): string;
  askName: string;
  nice(name: string): string;
  footer: string;
  placeholder: { message: string; name: string; city: string; amount: string };
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
  greeting: string;
  thanks: string;
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
    checkoutGuide: string;
    needLogin: string;
    priceChanged(name: string, from: string, to: string): string;
    blocked(name: string, stock: number): string;
    askWhich: string;
    addWhat: string;
    foundToAdd: string;
    tapPlus: string;
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
    offer: string;
    accepted: string;
    declined: string;
    later: string;
    already: string;
    iosSteps(safari: boolean): string;
    androidManual: string;
    desktop: string;
  };
}

// ---------------------------------------------------------------------------------------------
// Français
// ---------------------------------------------------------------------------------------------

const FR: Texts = {
  dir: 'ltr',
  roleTitle: 'Assistante marketing',
  welcome: (name) => `Bonjour${name ? ` ${name}` : ''} ! Je suis ${ASSISTANT_NAME}, l'${ASSISTANT_ROLE} d'Albasse Shopping.`,
  teaser: (name) => `Bonjour${name ? ` ${name}` : ''} ! Je suis ${ASSISTANT_NAME}, l'${ASSISTANT_ROLE} d'Albasse Shopping. 😊`,
  askName: 'Comment puis-je vous appeler ?',
  nice: (name) => `Enchantée ${name} ! 😊`,
  footer: `${ASSISTANT_NAME} est une assistante automatique. Pour une commande ou un souci, écrivez-nous sur WhatsApp.`,
  placeholder: { message: 'Écrivez votre message…', name: 'Écrivez votre prénom…', city: 'Écrivez votre ville…', amount: 'Écrivez un montant…' },
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
    giftIdea: '🎁 Idée cadeau',
    wrap: '🎁 Emballage cadeau',
    policy: '📄 Conditions de retour',
    otherLang: '🌐 العربية',
    viewCart: '🛒 Voir mon panier',
    checkout: '✅ Commander',
    moreItems: '🛍️ Autres articles',
    cancel: 'Annuler',
    installApp: '📲 Installer AlbasseShopping',
    installHelp: '📲 Ajouter à l’écran d’accueil',
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
  greeting: 'Bonjour{nom} ! Que souhaitez-vous découvrir ? 🛍️',
  thanks: 'Avec plaisir{nom} ! 😊 Profitez bien de nos promotions.',
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
  about: 'Albasse Shopping est la première plateforme de vente en ligne du Tchad. Nous sommes dans ce domaine depuis 2013 : Service, Qualité, Garantie 🤝',
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
  howToOrder: `Commander est simple 👇\n1. Ouvrez le produit qui vous plaît\n2. Choisissez la couleur ou la taille\n3. Touchez « Ajouter au panier » ou « Acheter »\n4. Indiquez votre nom, téléphone, ville et adresse\n5. Payez : à la livraison à N’Djamena, à l’avance (Airtel Money ou Moov Money) dans les autres villes\n🎁 En option : emballage cadeau, ${fcfa(GIFT_WRAP_FEE)} (touchez l’image cadeau)\n⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h.`,

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
    checkoutGuide: 'Parfait ! 🛒 Voici votre panier. Touchez « Commander » : vous indiquerez votre nom, votre téléphone, votre ville et votre adresse, puis le paiement (à la livraison à N’Djamena ; ailleurs, à l’avance par Airtel Money ou Moov Money).',
    needLogin: 'Pour valider votre commande, créez votre compte ou connectez-vous (c’est gratuit). Votre panier est gardé 🛒',
    priceChanged: (name, from, to) => `ℹ️ Le prix de « ${name} » a changé : ${from} → ${to}.`,
    blocked: (name, stock) => (stock > 0 ? `⚠️ Il ne reste que ${stock} « ${name} » : baissez la quantité pour commander.` : `⚠️ « ${name} » n’est plus disponible : retirez-le de votre panier pour commander.`),
    askWhich: 'Lequel voulez-vous ajouter ?',
    addWhat: 'Bien sûr ! Dites-moi ce que vous cherchez : je vous montre les articles avec un bouton + pour les ajouter 👇',
    foundToAdd: 'Voici ce que j’ai trouvé : touchez + sur l’article voulu pour l’ajouter au panier 👇',
    tapPlus: 'Astuce : touchez + sur un article pour l’ajouter au panier 🛒',
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
    offer: 'Pour retrouver facilement AlbasseShopping, vous pouvez ajouter notre boutique à l’écran d’accueil de votre téléphone 📲',
    accepted: '🎉 C’est installé ! Retrouvez AlbasseShopping sur votre écran d’accueil.',
    declined: 'Pas de souci 😊 Vous pourrez le faire plus tard : le site reste utilisable comme maintenant.',
    later: 'D’accord, je ne vous le propose plus pour le moment 😊',
    already: 'AlbasseShopping est déjà installé sur votre téléphone 🎉',
    iosSteps: (safari) =>
      `${safari ? '' : '⚠️ Ouvrez d’abord albasseshopping.com dans Safari (l’installation ne marche pas depuis ce navigateur).\n'}Sur iPhone :\n1. Touchez « Partager » (le carré avec une flèche) en bas de l’écran\n2. Faites défiler et touchez « Sur l’écran d’accueil »\n3. Touchez « Ajouter »`,
    androidManual: 'Pour installer : touchez les trois points (⋮) en haut à droite de Chrome, puis « Installer l’application » ou « Ajouter à l’écran d’accueil » (selon votre version).',
    desktop: 'Pour installer : cliquez sur l’icône d’installation ⊕ dans la barre d’adresse de Chrome, ou sur les trois points (⋮) puis « Installer Albasse Shopping ».',
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
  welcome: (name) => `مرحبا${name ? ` ${name}` : ''}! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping.`,
  teaser: (name) => `مرحبا${name ? ` ${name}` : ''}! أنا زارا كينغز، مساعدة التسويق في Albasse Shopping. 😊`,
  askName: 'كيف يمكنني أن أناديك؟',
  nice: (name) => `سعدت بمعرفتك يا ${name}! 😊`,
  footer: 'زارا كينغز مساعدة آلية. لأي طلب أو مشكلة، راسلنا على واتساب.',
  placeholder: { message: 'اكتب رسالتك…', name: 'اكتب اسمك الأول…', city: 'اكتب مدينتك…', amount: 'اكتب مبلغا…' },
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
    giftIdea: '🎁 فكرة هدية',
    wrap: '🎁 تغليف الهدايا',
    policy: '📄 شروط الإرجاع',
    otherLang: '🌐 Français',
    viewCart: '🛒 عرض سلتي',
    checkout: '✅ إتمام الطلب',
    moreItems: '🛍️ منتجات أخرى',
    cancel: 'إلغاء',
    installApp: '📲 تثبيت AlbasseShopping',
    installHelp: '📲 إضافة إلى الشاشة الرئيسية',
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
  greeting: 'مرحبا{nom}! ماذا تريد أن تكتشف؟ 🛍️',
  thanks: 'على الرحب والسعة{nom}! 😊 استفد جيدا من عروضنا.',
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
  about: 'Albasse Shopping هي أول منصة للبيع عبر الإنترنت في تشاد. نعمل في هذا المجال منذ عام 2013: خدمة، جودة، ضمان 🤝',
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
  howToOrder: `الطلب سهل 👇\n1. افتح المنتج الذي يعجبك\n2. اختر اللون أو المقاس\n3. اضغط على «Ajouter au panier» (أضف إلى السلة) أو «Acheter» (اشترِ)\n4. اكتب اسمك وهاتفك ومدينتك وعنوانك\n5. ادفع: عند الاستلام في إنجامينا، ومسبقا (Airtel Money أو Moov Money) في المدن الأخرى\n🎁 اختياري: تغليف الهدايا بـ ${fcfa(GIFT_WRAP_FEE)} (اضغط على صورة الهدية)\n⏳ لتجنب الطلبات الوهمية، كل طلب صالح لمدة ${ORDER_VALIDITY_HOURS} ساعة.`,

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
    checkoutGuide: 'ممتاز! 🛒 إليك سلتك. اضغط «إتمام الطلب»: ستكتب اسمك وهاتفك ومدينتك وعنوانك، ثم طريقة الدفع (عند الاستلام في إنجامينا؛ وفي المدن الأخرى مسبقا عبر Airtel Money أو Moov Money).',
    needLogin: 'لإتمام طلبك، أنشئ حسابك أو سجل الدخول (مجاني). سلتك محفوظة 🛒',
    priceChanged: (name, from, to) => `ℹ️ تغير سعر «${name}»: ${from} ← ${to}.`,
    blocked: (name, stock) => (stock > 0 ? `⚠️ لم يبق سوى ${stock} من «${name}»: قلل الكمية لإتمام الطلب.` : `⚠️ «${name}» لم يعد متوفرا: احذفه من سلتك لإتمام الطلب.`),
    askWhich: 'أي منتج تريد إضافته؟',
    addWhat: 'بالتأكيد! أخبرني بما تبحث عنه: أعرض عليك المنتجات مع زر + لإضافتها 👇',
    foundToAdd: 'إليك ما وجدته: اضغط + على المنتج المطلوب لإضافته إلى السلة 👇',
    tapPlus: 'نصيحة: اضغط + على أي منتج لإضافته إلى السلة 🛒',
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
    offer: 'لتجد AlbasseShopping بسهولة، يمكنك إضافة متجرنا إلى الشاشة الرئيسية لهاتفك 📲',
    accepted: '🎉 تم التثبيت! ستجد AlbasseShopping على شاشتك الرئيسية.',
    declined: 'لا مشكلة 😊 يمكنك فعل ذلك لاحقا، والموقع يبقى قابلا للاستخدام كما هو.',
    later: 'حسنا، لن أقترح عليك ذلك الآن 😊',
    already: 'AlbasseShopping مثبت بالفعل على هاتفك 🎉',
    iosSteps: (safari) =>
      `${safari ? '' : '⚠️ افتح أولا albasseshopping.com في متصفح Safari (التثبيت لا يعمل من هذا المتصفح).\n'}على الآيفون:\n1. اضغط «مشاركة» (المربع مع السهم) أسفل الشاشة\n2. مرر لأسفل واضغط «إضافة إلى الشاشة الرئيسية»\n3. اضغط «إضافة»`,
    androidManual: 'للتثبيت: اضغط على النقاط الثلاث (⋮) أعلى يمين Chrome ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» حسب إصدارك.',
    desktop: 'للتثبيت: اضغط على أيقونة التثبيت ⊕ في شريط عنوان Chrome، أو على النقاط الثلاث (⋮) ثم «تثبيت Albasse Shopping».',
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

