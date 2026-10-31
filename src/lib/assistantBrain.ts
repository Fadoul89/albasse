import { isHomeCity } from './deliveryRules';
import { arabicCityToLatin, arabicDigits, foldArabic, hasArabic, type GoodbyeKind, type GreetingKind, type Lang, type PayMethodKey, type PersonalKind } from './assistantLang';
import { fcfa, texts } from './assistantText';
import { BULK_MIN_QTY } from '../constants/shopRules';
import { isColdSeasonName, wantsColdSeason } from './coldSeason';

export { isHomeCity, fcfa };

// Cerveau de Zara : fonctions simples (sans IA) qui comprennent quelques mots-cles et preparent
// les reponses. Aucune dependance a l'ecran ni a la base : facile a tester.

// ---------------------------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'et', 'ou', 'pour', 'avec', 'sans', 'sur', 'en', 'au', 'aux',
  'a', 'je', 'j', 'veux', 'voudrais', 'cherche', 'cherch', 'achete', 'acheter', 'produit', 'produits', 'prix', 'svp', 'stp',
  's', 'il', 'elle', 'vous', 'plait', 'quel', 'quels', 'quelle', 'quelles', 'que', 'qui', 'est', 'sont', 'y', 'avez', 'avoir',
  'vendez', 'vend', 'tu', 'as', 'moi', 'mon', 'ma', 'mes', 'ce', 'cette', 'ces', 'bonjour', 'salut', 'merci',
  'moins', 'plus', 'entre', 'max', 'maximum', 'minimum', 'fcfa', 'cfa', 'franc', 'francs', 'budget', 'mille',
  'faire', 'fais', 'fait', 'besoin', 'quelque', 'chose', 'voir', 'trouver', 'donner', 'envie', 'aimerais', 'souhaite', 'souhaiterais',
  'pouvez', 'pourriez', 'ton', 'ta', 'son', 'sa', 'notre', 'votre', 'leur',
]);

// Mots qui precisent un produit sans dire de quoi il s'agit : ils comptent moins dans le classement.
const MODIFIERS = new Set(['homme', 'femme', 'enfant', 'bebe', 'fille', 'garcon', 'mixte', 'unisexe', 'adulte', 'dame', 'monsieur']);

export function normalize(text: string): string {
  return foldArabic(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC') // « ئ » (décomposée par NFD) redevient une seule lettre, comme dans les mots de la liste
    .replace(/[^a-z0-9؀-ۿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const compact = (text: string) => normalize(text).replace(/ /g, '');

function stem(word: string): string {
  if (word.length > 4 && (word.endsWith('s') || word.endsWith('x'))) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
}

// ---------------------------------------------------------------------------------------------
// Catalogue : recherche par mots-cles, promotions, nouveautes
// ---------------------------------------------------------------------------------------------

export interface RawProduct {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  compare_at_price: number | string | null;
  stock: number | null;
  category: string;
  category_slug?: string | null;
  colors: string[] | null;
  sizes?: string[] | null;
  description: string | null;
  image: string | null;
  created_at: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  stock: number;
  category: string;
  categorySlug: string;
  colors: string[];
  sizes: string[];
  image: string | null;
  createdAt: number;
  nameTokens: string[];
  catTokens: string[];
  colorTokens: string[];
  descTokens: string[];
}

export function buildProduct(p: RawProduct): CatalogProduct {
  const price = Number(p.price);
  const compare = p.compare_at_price == null ? null : Number(p.compare_at_price);
  const colors = p.colors ?? [];
  return {
    id: p.id,
    name: p.name.trim(),
    slug: p.slug,
    price,
    // un ancien prix plus de 10 fois superieur est une erreur de saisie : on ne l'affiche pas
    compareAt: compare !== null && compare > price && price / compare >= 0.1 ? compare : null,
    stock: Number(p.stock ?? 0),
    category: p.category,
    categorySlug: p.category_slug ?? '',
    colors: colors.map((c) => String(c).trim()).filter(Boolean),
    sizes: (p.sizes ?? []).map((z) => String(z).trim()).filter(Boolean),
    image: p.image,
    createdAt: Date.parse(p.created_at) || 0,
    nameTokens: tokenize(p.name),
    catTokens: tokenize(p.category),
    colorTokens: colors.flatMap(tokenize),
    descTokens: tokenize((p.description ?? '').slice(0, 400)),
  };
}

function tokenMatch(q: string, field: string[]): 'exact' | 'prefix' | null {
  for (const t of field) if (t === q) return 'exact';
  if (q.length >= 4) {
    for (const t of field) if (t.length >= 4 && (t.startsWith(q) || q.startsWith(t))) return 'prefix';
  }
  return null;
}

export function searchCatalog(products: CatalogProduct[], query: string, limit = 4): CatalogProduct[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const scored: { p: CatalogProduct; score: number }[] = [];
  // le client cherche un manteau ou un blouson : jamais un « porte-manteau » (le meuble) ni un article qui n'est pas un vêtement chaud
  const coatsOnly = wantsColdSeason(query);
  for (const p of products) {
    if (!(p.price > 0) || p.stock <= 0) continue;
    if (coatsOnly && !isColdSeasonName(p.name)) continue;
    let score = 0;
    let matched = 0;
    queryTokens.forEach((q, position) => {
      const inName = tokenMatch(q, p.nameTokens);
      const inCat = tokenMatch(q, p.catTokens);
      const inColor = tokenMatch(q, p.colorTokens);
      const inDesc = tokenMatch(q, p.descTokens);
      let s = (inName === 'exact' ? 5 : inName ? 3.5 : 0) + (inCat ? 5 : 0) + (inColor ? 2 : 0) + (inDesc ? 1 : 0);
      if (s > 0) {
        // le premier mot de la phrase est en general le type de produit (« chaussures homme noir »)
        s *= Math.max(0.6, 1 - 0.15 * position) * (MODIFIERS.has(q) ? 0.5 : 1);
        matched++;
        score += s;
      }
    });
    if (matched === 0) continue;
    score += matched * 100; // plus de mots trouves = toujours devant
    if (p.compareAt) score += 0.3;
    scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}

export const discount = (p: CatalogProduct) => (p.compareAt ? 1 - p.price / p.compareAt : 0);

// Plus fortes remises, en stock, avec photo.
export function promotions(products: CatalogProduct[], limit = 4): CatalogProduct[] {
  return products
    .filter((p) => p.price > 0 && p.stock > 0 && p.compareAt && p.image && discount(p) >= 0.05 && discount(p) <= 0.9)
    .sort((a, b) => discount(b) - discount(a))
    .slice(0, limit);
}

export function newest(products: CatalogProduct[], limit = 4): CatalogProduct[] {
  return products
    .filter((p) => p.price > 0 && p.stock > 0 && p.image)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Prenom du visiteur
// ---------------------------------------------------------------------------------------------

const NO_NAME = /^(non|no|passer|plus tard|rien|aucun|skip|pas maintenant|jamais|merci|لا|تخطي|لاحقا|بعدين|شكرا|ليس الان)$/;

// Le texte sans les formules du début (« bonjour », « je m'appelle »...) ni la ponctuation de fin.
function stripNameIntro(text: string): string {
  return text
    .replace(/^(bonjour|bonsoir|salut|salam|مرحبا|مرحباً|أهلا|اهلا|السلام عليكم|سلام)[ ,!،]*/i, '')
    .replace(/^(اسمي|أنا|انا|ناديني|نادني|يسمونني)\s+/, '')
    .replace(/^(je m'appelle|je m’appelle|je me nomme|mon nom est|mon prénom est|mon prenom est|moi c'est|moi c’est|c'est|c’est|je suis|appelez[- ]moi|appelle[- ]moi|moi)\s+/i, '')
    .replace(/[.!?,;:،؛؟]+$/g, '')
    .trim();
}

// « MAHAMAT » écrit tout en majuscules -> « Mahamat » (et « JEAN-PIERRE » -> « Jean-Pierre ») ; sinon on met seulement la 1re lettre en majuscule.
function properName(word: string): string {
  if (word === word.toLocaleUpperCase('fr-FR') && word !== word.toLocaleLowerCase('fr-FR')) {
    return word.toLocaleLowerCase('fr-FR').replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase('fr-FR'));
  }
  return word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1);
}

// « Fatimé », « je m'appelle Fatimé Ali », « moi c'est Ali » -> « Fatimé » / « Ali ». Renvoie null si ce
// n'est pas un prenom (phrase, chiffres, refus).
export function firstNameFrom(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 40) return null;
  if (NO_NAME.test(normalize(t))) return null;
  const s = stripNameIntro(t);
  if (!s || /\d/.test(s)) return null;
  const words = s.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 3) return null;
  const first = words[0];
  if (!/^[\p{L}][\p{L}'’-]{1,19}$/u.test(first)) return null;
  return properName(first);
}

// Nom complet pour la livraison : « ahmed hassan », « Mahamat Saleh Idriss » -> mots avec majuscules. Null si ce n'est pas un nom
// (chiffres, question, « merci »...).
export function fullNameFrom(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 60 || /[?؟]/.test(t)) return null;
  if (NO_NAME.test(normalize(t))) return null;
  const s = stripNameIntro(t);
  if (!s || /\d/.test(s)) return null;
  const words = s.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 5) return null;
  if (!words.every((w) => /^[\p{L}][\p{L}'’.-]{0,29}$/u.test(w))) return null;
  if (s.replace(/[^\p{L}]/gu, '').length < 2) return null;
  // une demande (« je veux commander », « merci ») n'est pas un nom : seul un texte sans autre sens est accepté
  const intent = detectIntent(t);
  if (intent !== 'search' && intent !== 'greeting') return null;
  return words.map(properName).join(' ');
}

// Numéro de téléphone du Tchad : 8 chiffres commençant par 6 ou 9 (comme sur la page de commande). « +235 66 12 34 56 » est accepté.
export function phoneFrom(text: string): string | null {
  const digits = arabicDigits(text).replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('235') ? digits.slice(3) : digits.length === 13 && digits.startsWith('00235') ? digits.slice(5) : digits;
  return /^[69]\d{7}$/.test(d) ? d : null;
}

// Adresse de livraison : quartier, rue, repère (4 à 150 caractères, pas un lien).
export function addressFrom(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length < 4 || t.length > 150 || !/\p{L}/u.test(t) || /https?:\/\//i.test(t)) return null;
  // « merci », « bonjour », « oui » ne sont pas une adresse (un quartier qui parle de « la boutique » reste accepté)
  if (['thanks', 'goodbye', 'smalltalk', 'compliment', 'greeting', 'personal', 'bot'].includes(detectIntent(t)) || yesNo(t)) return null;
  return t;
}

const YES_WORDS = new Set(['oui', 'ouais', 'yes', 'ok', 'okay', 'daccord', 'volontiers', 'parfait', 'exact', 'ouai', 'نعم', 'ايوه', 'اي', 'اجل', 'تمام', 'حسنا', 'موافق', 'اكيد']);
const NO_WORDS = new Set(['non', 'no', 'nan', 'pas', 'jamais', 'لا', 'كلا']);

// « oui », « non merci », « ok », « نعم », « لا »... ; null si ce n'est pas clair.
export function yesNo(text: string): 'yes' | 'no' | null {
  const tokens = normalize(text).replace(/d accord/g, 'daccord').split(' ').filter(Boolean);
  const yes = tokens.some((t) => YES_WORDS.has(t));
  const no = tokens.some((t) => NO_WORDS.has(t));
  return yes && !no ? 'yes' : no && !yes ? 'no' : null;
}

export type { PayMethodKey };

// « airtel », « moov money », « à la livraison », « كاش »... -> mode de paiement
export function paymentFrom(text: string): PayMethodKey | null {
  const n = normalize(text);
  if (/airtel|ايرتل/.test(n)) return 'airtel_money';
  if (/moov|موف/.test(n)) return 'moov_money';
  if (/livraison|cash|espece|especes|sur place|a la reception|عند الاستلام|نقدا|كاش|نقد/.test(n)) return 'cash_on_delivery';
  return null;
}

// Arrêter la commande (« annuler », « stop », « laisse tomber »...), la confirmer (« je confirme »), la modifier (« changer »).
export const wantsCancelOrder = (text: string): boolean => /(^| )(annule|annuler|annulation|stop|stoppe|quitter|abandonner|laisse tomber|laisser tomber|الغاء|الغي|توقف|اوقف)( |$)/.test(normalize(text));
export const wantsConfirmOrder = (text: string): boolean => /(^| )(confirme|confirmer|valide|valider|je confirme|اكد|تاكيد|اتمام)( |$)/.test(normalize(text)) || yesNo(text) === 'yes';
export const wantsEditOrder = (text: string): boolean => /(^| )(modifier|modifie|changer|change|corriger|corrige|erreur|faux|تعديل|عدل|غير|خطا)( |$)/.test(normalize(text));

// Titres de politesse écrits devant un prénom (« Mr Ali », « Mme Fatimé ») : ce ne sont pas des prénoms.
const NAME_TITLES = new Set(['m', 'mr', 'mme', 'mlle', 'dr', 'pr', 'prof', 'madame', 'monsieur', 'mademoiselle', 'السيد', 'السيده', 'الاستاذ', 'الاستاذه', 'الدكتور', 'الدكتوره']);

// Prenom a partir du nom complet d'un compte.
export function firstNameOfFullName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  while (words.length > 0 && NAME_TITLES.has(normalize(words[0]))) words.shift();
  return firstNameFrom(words[0] ?? '');
}

// ---------------------------------------------------------------------------------------------
// Ce que veut le visiteur
// ---------------------------------------------------------------------------------------------

// « Rappelez-moi », « écrivez-moi sur WhatsApp » : le client demande que l'équipe le recontacte (jamais « comment vous contacter »).
const CALLBACK_RE =
  /\brappel\w* moi\b|\bme rappel\w*|\bappel\w* moi\b|\bcontacte\w* moi\b|\brecontacte\w* moi\b|\bme (re)?contacter\b|\becri\w* moi\b|\bme joindre\b|\bjoignez moi\b|\bwhatsapp moi\b|اتصلوا بي|اتصل بي|اتصلو بي|كلموني|كلمني|راسلوني|راسلني|تواصلوا معي|تواصل معي|ذكروني|ارجو الاتصال بي/;

export function wantsCallback(text: string): boolean {
  return CALLBACK_RE.test(normalize(text));
}

export type Intent =
  | 'bot'
  | 'compliment'
  | 'goodbye'
  | 'thanks'
  | 'smalltalk'
  | 'greeting'
  | 'personal'
  | 'loyalty'
  | 'account'
  | 'orders'
  | 'delivery'
  | 'promo'
  | 'new'
  | 'categories'
  | 'order'
  | 'contact'
  | 'advice'
  | 'wrap'
  | 'gift'
  | 'budget'
  | 'price'
  | 'trust'
  | 'later'
  | 'rules'
  | 'info'
  | 'returns'
  | 'about'
  | 'cart'
  | 'add'
  | 'install'
  | 'telegram'
  | 'tracking'
  | 'wholesale'
  | 'callback'
  | 'ranges'
  | 'compare'
  | 'search';

const has = (tokens: string[], words: string[]) => words.some((w) => tokens.includes(w));

// « الهدية » -> « هديه » : on enleve l'article et les petits prefixes pour retrouver le mot de la liste.
const stemAr = (token: string) => (hasArabic(token) ? token.replace(/^(وال|بال|فال|كال|لل|ال)/, (m) => (m === 'لل' ? 'ل' : '')) : token);

// ---------------------------------------------------------------------------------------------
// Politesse et conversation : salutations, merci, au revoir, compliments, questions sur la vie de Zara
// ---------------------------------------------------------------------------------------------

// Les motifs arabes sont écrits normalement puis passés par le même « lissage » que le texte du visiteur.
const ar = (pattern: string) => new RegExp(foldArabic(pattern));

const tokensOf = (text: string): string[] => {
  const base = normalize(text).split(' ').filter(Boolean);
  return [...base, ...base.map(stemAr).filter((t, i) => t !== base[i])];
};

// Comment le visiteur salue : Zara répond sur le même ton (bonsoir -> bonsoir, salam -> salam).
export function greetingKind(text: string): GreetingKind | null {
  const tokens = tokensOf(text);
  if (has(tokens, ['salam', 'salaam', 'assalam', 'assalamou', 'سلام'])) return 'salam';
  if (has(tokens, ['bonsoir', 'مساء'])) return 'evening';
  if (has(tokens, ['صباح'])) return 'morning';
  if (has(tokens, ['salut', 'coucou', 'hello', 'hey', 'hi', 'slt', 'هلا', 'هاي'])) return 'hi';
  if (has(tokens, ['bonjour', 'bjr', 'مرحبا', 'اهلا'])) return 'hello';
  return null;
}

// « merci » seul (ou avec « beaucoup », le prénom de Zara, « ok »...) : si le visiteur ajoute une demande, on répond à la demande.
const THANK_WORDS = ['merci', 'shukran', 'thanks', 'thank', 'شكرا', 'مشكور', 'مشكوره', 'جزاك'];
const THANK_FILLER = new Set([
  ...THANK_WORDS, 'beaucoup', 'infiniment', 'mille', 'enormement', 'vraiment', 'zara', 'kings', 'pour', 'tout', 'votre', 'ton', 'ta', 'aide', 'le', 'la', 'les',
  'de', 'du', 'des', 'et', 'a', 'vous', 'toi', 'info', 'infos', 'information', 'informations', 'reponse', 'reponses', 'conseil', 'conseils', 'explication',
  'explications', 'you', 'very', 'much', 'so', 'جزيلا', 'لك', 'لكم', 'كثيرا', 'جدا', 'على', 'علي', 'مساعدتك', 'مساعدتكم', 'زارا', 'كينغز', 'يا', 'الله', 'خيرا',
  'بارك', 'فيك', 'فيكم', 'الف', 'مره',
]);
const ACK_WORDS = new Set(['ok', 'okay', 'd', 'accord', 'daccord', 'compris', 'parfait', 'super', 'genial', 'top', 'nickel', 'cool', 'oui', 'bien', 'recu', 'entendu', 'bravo', 'excellent', 'تمام', 'حسنا', 'ممتاز', 'واضح', 'فهمت']);

function isThanksOnly(base: string[], tokens: string[]): boolean {
  if (!has(tokens, THANK_WORDS)) return false;
  const rest = base.filter((w) => !THANK_FILLER.has(w) && !THANK_FILLER.has(stemAr(w)));
  return rest.every((w) => ACK_WORDS.has(w));
}

export const thanksKind = (text: string): 'much' | 'plain' =>
  has(tokensOf(text), ['beaucoup', 'infiniment', 'mille', 'enormement', 'vraiment', 'much', 'جزيلا', 'الف', 'كثيرا', 'جدا']) ? 'much' : 'plain';

// Au revoir, bonne nuit, bonne journée... (« a plus » seulement en fin de phrase : « a plus de 10 000 FCFA » est un budget)
const BYE_NIGHT = ar('bonne nuit|beaux reves|dors bien|تصبح على خير|تصبحين على خير|تصبحون على خير|ليلة سعيدة');
const BYE_EVENING = /bonne soiree|passe une bonne soiree/;
const BYE_DAY = ar('bonne journee|يوم سعيد|نهارك سعيد');
const BYE_PLAIN = ar('au revoir|(^| )(a bientot|a demain|a la prochaine|a plus tard|a plus|bye|ciao|adieu)( zara| kings)*$|bonne continuation|je dois partir|مع السلامة|إلى اللقاء|وداعا|بالسلامة|في أمان الله|الله يسلمك');

export function goodbyeKind(text: string): GoodbyeKind | null {
  const n = normalize(text);
  if (BYE_NIGHT.test(n)) return 'night';
  if (BYE_EVENING.test(n)) return 'evening';
  if (BYE_DAY.test(n)) return 'day';
  if (BYE_PLAIN.test(n)) return 'plain';
  return null;
}

// « Tu es belle », « bravo », « je t'aime »... : Zara remercie avec chaleur (sans se vanter et sans changer de sujet).
const COMPLIMENT = ar(
  '(^| )(tu es|t es|tes|vous etes) ((tres|trop|vraiment|si|tellement|super) )?(belle|jolie|magnifique|superbe|gentille|mignonne|charmante|adorable|intelligente|merveilleuse|sublime|parfaite|geniale|canon|top|forte|sympa|incroyable|formidable|excellente|la meilleure)( |$)' +
    '|(^| )(bravo|felicitations|bien joue|bon travail|beau travail|super travail|excellent travail)( |$)|(^| )je (t|vous) (aime|adore|kiffe)( |$)' +
    '|(انت|انتي) (جميلة|حلوة|رائعة|لطيفة|ذكية|مبدعة|ممتازة|مذهلة|قمر|طيبة|كريمة)|احبك|بحبك|اعشقك|ماشاء الله|ما شاء الله|بارك الله فيك|يعطيك العافية'
);

// « Ça va ? » (avec ou sans « bonjour » devant) : seulement si c'est tout ce qu'il écrit
const SMALLTALK = ar(
  '^((bonjour|bonsoir|salut|coucou|hello|slt|salam|hi|hey) )?(zara )?(kings )?(et )?(comment )?(ca va|vas tu|tu vas|allez vous|vous allez|va tu|la forme)( bien| aujourd hui| ce matin| ce soir)?( et toi| et vous| zara| kings)*$' +
    '|^((السلام عليكم|مرحبا|اهلا|سلام|هلا) )?(زارا )?(كيف حالك|كيف حالكم|كيفك|كيف الحال|شلونك|اخبارك|شخبارك|لاباس|لا باس)( عليك| يا زارا| زارا)*$'
);

// Ce que le visiteur demande sur la vie de Zara : son numéro, son adresse, sa famille... Elle reste une assistante virtuelle.
export function personalKind(text: string): PersonalKind | null {
  const n = normalize(text);
  if (/(^| )(ton|ta|tes) (whatsapp|watsap|wasap|watsapp)( |$)/.test(n) || ar('واتسابك|واتساب الخاص بك').test(n)) return 'whatsapp';
  if (/(^| )(t appeler|te joindre|te contacter|te telephoner|appeler toi)( |$)/.test(n) || ar('اتصل بك|اتصل عليك|اكلمك|اتصل عليكي').test(n)) return 'call';
  if (/(^| )(ton|ta|tes) (numero|num|telephone|tel|contact|portable|cellulaire|phone|email|mail|facebook|instagram|snap|snapchat|tiktok)( |$)/.test(n) || ar('رقمك|هاتفك|جوالك|ارقامك').test(n)) return 'phone';
  if (/(^| )(ton|ta|tes) (adresse|domicile|quartier)( |$)/.test(n) || ar('عنوانك').test(n)) return 'address';
  if (/(^| )(ton|ta|tes) (maison|ville|pays)( |$)|(^| )(tu|t|vous) (habite|habites|habitez)( |$)|(^| )ou (tu |vous )?(habite|habites|habitez|vis|vivez|demeures?|restes?)( |$)|(^| )(tu|vous) (vis|vivez|restes?|demeures?) (ou|a|dans)( |$)/.test(n) || ar('(اين|وين) (تسكن|تعيش|ساكن|بيتك|منزلك)|بيتك|منزلك|سكنك').test(n)) return 'live';
  if (
    /(^| )(quel age (as tu|tu as|avez vous|vous avez)|tu as quel age|ton age|vous avez quel age|tu as \d+ ans)( |$)|(^| )(tu es|t es|vous etes) (mariee|marie|celibataire|en couple|enceinte|fiancee|divorcee)( |$)|(^| )tu as (un|une|des) (mari|femme|copain|copine|petit ami|petite amie|enfant|enfants|bebe|famille|frere|freres|soeur|soeurs|fiance|amoureux)( |$)|(^| )(ta famille|tes parents|tes enfants|tes freres|tes soeurs|ton mari|ton copain|ton fiance)( |$)|(^| )(tu es|t es) (d ou|de quel(le)? (pays|ville))( |$)|(^| )(tu viens|d ou (viens|venez) (tu|vous))( |$)|(^| )ta nationalite( |$)|(^| )tu es (une |un )?(fille|femme|homme|garcon)( |$)|(^| )(te voir|te rencontrer|on se voit|on se rencontre|sortir avec (moi|toi)|rendez vous avec toi|ta photo|une photo de toi|ton visage)( |$)|(^| )tu (manges|dors|as faim|as soif|fais quoi|travailles ou|pleures)( |$)/.test(n) ||
    ar('كم عمرك|عمرك|متزوجة|هل انت متزوج|عندك اولاد|عائلتك|اهلك|زوجك|اخوتك|حبيبك|خطيبك|من اين انت|من وين انت|جنسيتك|صورتك|اريد رؤيتك|نتقابل|الخروج معك').test(n)
  )
    return 'life';
  return null;
}

// Suivi de navigation (en arrière-plan) : seule une demande explicite d'arrêt écrite par le client est reconnue. Elle passe AVANT « suivre ma commande ».
const TRACK_STOP_RE = ar(
  'ne me (suis|suit|suivez|suivras|traque|traquez|surveille|surveillez|espionne|espionnez) (plus|pas)|(arrete|arretez|stop|stoppe|cesse|cessez) (de |d )?(me )?(suivre|tracer|traquer|surveiller|espionner)|(plus|pas) me (suivre|tracer|traquer)|(refuse|refuser|desactive|desactiver|coupe|couper|annule|annuler|arrete|arreter|stop|stoppe|supprime|supprimer) (le |mon |ce )?(suivi(?! de (ma|mon|mes|la|le|ce|cette|commande|colis))|tracking|tracage)|ne retiens (plus|pas)|ne garde (plus|pas) (ce que|mes)|ne memorise (plus|pas)|(efface|effacer|supprime|supprimer|vide|vider) (tout |toute )?(mon |ma |mes |l )?(historique|memoire|donnees)|je ne veux pas (etre )?(suivi|suivie|trace|tracee|espionne|espionnee|surveille|surveillee)|pas d espionnage' +
    '|لا (تتبعني|تتابعني|تراقبني|تحفظ|تتجسس)|توقف عن (تتبعي|متابعتي|مراقبتي)|(ايقاف|الغاء|رفض) (التتبع|المتابعه|المراقبه)|لا اريد (ان )?(اتتبع|اتابع|تتبعي|متابعتي|مراقبتي)|(امسح|احذف|اشطب) (سجل|ما شاهدت|بياناتي)'
);
export type TrackingKind = 'stop';

// Seule une demande écrite et explicite du client (« ne me suis plus ») est reconnue : Zara la respecte. Elle ne parle jamais du suivi d'elle-même.
export function trackingKind(text: string): TrackingKind | null {
  const n = normalize(text);
  return n && TRACK_STOP_RE.test(n) ? 'stop' : null;
}

// Achat en gros : prix de gros, cartons, grandes quantités, revente. Zara ne donne aucun prix de gros : elle passe la main à l'équipe (WhatsApp).
// « en gros » tout seul (« en gros je cherche un parfum ») ne compte pas.
const WHOLESALE_RE = ar(
  '(acheter|achat|achats|vente|vendre|vendez|commande|commander|prix|tarif|tarifs) (en|au) gros|(^| )en gros (prix|tarif|tarifs|quantite|commande|commandes)|(^| )(prix|tarif|tarifs) (de |du )?gros|(^| )grossistes?( |$)|(^| )(demi|semi) gros|(^| )cartons?( |$)|(^| )revend(re|eur|eurs|s|ons|ez)?( |$)|(^| )revente( |$)|grosses? commandes?|grandes? quantites?|quantites? importantes?|commande en quantite' +
    '|بالجمله|سعر الجمله|(^| )جمله( |$)|كرتون|كراتين|كميه كبيره|كميات كبيره|اعاده البيع|(^| )تاجر( |$)'
);
const BULK_UNITS_RE = /(^| )(\d{2,4}) (pieces?|cartons?|unites?|paires?|exemplaires?|packs?|boites?|flacons?|bouteilles?|parfums?|montres?|chaussures?|chemises?|robes?|pantalons?|articles?)( |$)/;

export function wantsWholesale(text: string): boolean {
  const n = normalize(text);
  if (!n) return false;
  if (WHOLESALE_RE.test(n)) return true;
  const m = BULK_UNITS_RE.exec(n);
  return !!m && Number(m[2]) >= BULK_MIN_QTY;
}

// Programme de fidélité : le grade, les points, les paliers. Les noms de métaux (« or », « argent », « ذهبي ») ne comptent pas seuls :
// ce sont aussi des produits ou de l'argent.
const LOYALTY_RE = ar(
  'fidelite|(^| )grades?( |$)|(^| )paliers?( |$)|mes points|mon nombre de points|combien de points|gagner (des |les )?points|points? de (fidelite|loyaute)|mon niveau|bronze|platine|diamond|diamant|loyalty' +
    '|نقاطي|نقاط الولاء|نقاط|الولاء|ولاء|رتبتي|درجتي|مستواي|درجه الولاء|بلاتيني|دايموند|برونزي'
);
const EARN_RE = ar('gagner|cumuler|accumuler|comment (avoir|obtenir|recuperer)|اكسب|اجمع|احصل|اربح|كيف.*(نقاط)');
const TIERS_RE = ar('(^| )(les |quels sont les |quelles sont les |liste des )(grades|paliers|niveaux)|(grades|paliers) (du|de) (programme|fidelite)|الدرجات|الرتب|المستويات');

// Ce que le client veut savoir : son grade (mine), comment gagner des points (earn), la liste des grades (tiers).
export function loyaltyKind(text: string): 'mine' | 'earn' | 'tiers' {
  const n = normalize(text);
  if (EARN_RE.test(n)) return 'earn';
  if (TIERS_RE.test(n)) return 'tiers';
  return 'mine';
}

// « trois options », « plusieurs gammes de prix » : le client veut des idées à plusieurs niveaux de prix.
const RANGES_RE = /\b(trois|3) (options|choix|idees|gammes|propositions|niveaux)\b|\b(plusieurs|differentes|differents) (gammes|options|choix|prix|niveaux)\b|\bgammes? de prix\b|\bbon plan et premium\b|\bdifferents prix\b|ثلاث(ه)? (خيارات|افكار|اقتراحات)|3 (خيارات|افكار)|خيارات بأسعار مختلفه|فئات سعريه|عده فئات/;
// « comparer », « quelle différence entre », « lequel choisir » : le client veut aider son choix entre des articles.
const COMPARE_RE = /\bcompar(e|er|ez|ons|aison|aisons)\b|\bdifferences? entre\b|\bquelle difference\b|\blequel (choisir|prendre|est (mieux|meilleur|le mieux))\b|\blaquelle (choisir|prendre|est (mieux|meilleure|la mieux))\b|\blequel des deux\b|قارن|مقارنه|الفرق بين|ايهما|ايهم/;
export const wantsRanges = (text: string) => RANGES_RE.test(normalize(text));
export const wantsCompare = (text: string) => COMPARE_RE.test(normalize(text));

export function detectIntent(text: string): Intent {
  const n = normalize(text);
  const base = n.split(' ').filter(Boolean);
  if (base.length === 0) return 'search';
  const tokens = [...base, ...base.map(stemAr).filter((t, i) => t !== base[i])];
  // « lier Telegram », « Telegram » : Zara explique et donne le bouton pour lier son compte (avant « bot » : le mot fait partie de « bot Telegram »)
  if (has(tokens, ['telegram', 'telegramme', 'telegrame', 'تيليجرام', 'تيليغرام', 'تلغرام', 'تليجرام', 'تلجرام'])) return 'telegram';
  if (has(tokens, ['robot', 'bot', 'ia', 'intelligence', 'artificielle', 'humain', 'humaine', 'machine', 'automatique', 'روبوت', 'بوت', 'ذكاء', 'اصطناعي', 'اله']) || /vraie? personne|vrai humain|une personne|شخص حقيقي|انسان حقيقي/.test(n)) return 'bot';
  if (COMPLIMENT.test(n)) return 'compliment';
  if (goodbyeKind(text)) return 'goodbye';
  if (isThanksOnly(base, tokens)) return 'thanks';
  if (SMALLTALK.test(n)) return 'smalltalk';
  if (greetingKind(text) && base.length <= 3) return 'greeting';
  // le suivi de navigation passe avant « suivre ma commande » et les autres sujets
  if (trackingKind(text)) return 'tracking';
  if (wantsWholesale(text)) return 'wholesale';
  if (wantsCallback(text)) return 'callback';
  if (wantsRanges(text)) return 'ranges';
  if (wantsCompare(text)) return 'compare';
  if (personalKind(text)) return 'personal';
  if (LOYALTY_RE.test(n)) return 'loyalty';
  // installer l'application / ajouter à l'écran d'accueil
  if (has(tokens, ['installer', 'installe', 'installation', 'telecharger', 'raccourci', 'pwa', 'appli', 'application', 'تثبيت', 'ثبت', 'تحميل', 'تطبيق']) || /ecran d accueil|ecran accueil|الشاشه الرئيسيه/.test(n)) return 'install';
  // « mon panier », le total : il n'y a plus de panier, Zara reprend la commande commencée (« comment ... » reste une question d'aide)
  const how = has(tokens, ['comment', 'كيف']);
  if (!how && has(tokens, ['ajoute', 'ajouter', 'ajoutez', 'rajoute', 'rajouter', 'mets', 'mettre', 'prends', 'prend', 'prendre', 'اضف', 'اضيفي', 'ضيف', 'ضع', 'خذ'])) return 'add';
  if (!how && (has(tokens, ['panier', 'سلتي', 'سله']) || /combien (ca|cela) fait|montant total|le total|mon total|combien je dois|المجموع|الاجمالي/.test(n))) return 'cart';
  if (has(tokens, ['compte', 'inscription', 'inscrire', 'inscris', 'connexion', 'connecter', 'حساب', 'حسابي', 'تسجيل', 'اشتراك', 'سجل', 'اسجل', 'دخول'])) return 'account';
  if (has(tokens, ['suivre', 'suivi', 'طلباتي', 'تتبع', 'متابعه']) || /mes commandes/.test(n)) return 'orders';
  if (has(tokens, ['retour', 'retourner', 'retourne', 'rembourse', 'remboursement', 'rembourser', 'echange', 'echanger', 'defectueux', 'defectueuse', 'abime', 'abimee', 'ارجاع', 'استرجاع', 'ارجع', 'استبدال', 'تبديل', 'معيب', 'تالف', 'استرداد'])) return 'returns';
  if (tokens.includes('48') || tokens.includes('48h') || has(tokens, ['valable', 'validite', 'expire', 'expiree', 'expiration', 'fausse', 'fausses', 'صالح', 'صلاحيه', 'وهميه', 'وهمي'])) return 'rules';
  if (has(tokens, ['infos', 'info', 'informations', 'important', 'importante', 'importantes', 'conditions', 'regles', 'معلومات', 'شروط', 'قواعد'])) return 'info';
  if (/qui etes vous|a propos|presentation|votre histoire|votre experience|depuis quand|2013|site officiel|(adresse|lien|nom|url) (du|de votre|de ton) site|من انتم|عن الشركه|عنكم|رابط الموقع|رابط موقعكم|موقعكم الرسمي/.test(n)) return 'about';
  if (has(tokens, ['emballage', 'emballer', 'emballe', 'emballee', 'empaqueter', 'تغليف', 'غلاف', 'تغلف', 'مغلف', 'اغلف'])) return 'wrap';
  if (has(tokens, ['cadeau', 'cadeaux', 'offrir', 'anniversaire', 'mariage', 'tabaski', 'ramadan', 'eid', 'هديه', 'هدايا', 'هديتي', 'اهداء', 'اهدي', 'ميلاد', 'زواج', 'عرس', 'رمضان', 'عيد', 'مناسبه'])) return 'gift';
  if (has(tokens, ['arnaque', 'arnaques', 'confiance', 'fiable', 'fiables', 'serieux', 'serieuse', 'securise', 'securisee', 'securite', 'garantie', 'escroquerie', 'escroc', 'peur', 'risque', 'نصب', 'احتيال', 'ثقه', 'موثوق', 'موثوقين', 'موثوقون', 'موثوقه', 'ضمان', 'خوف', 'خايف', 'مصداقيه', 'امان'])) return 'trust';
  if (has(tokens, ['cher', 'chere', 'chers', 'cheres', 'couteux', 'couteuse', 'negocier', 'marchander', 'baisser', 'diminuer', 'غالي', 'غال', 'غاليه', 'باهظ', 'مكلف', 'مساومه', 'تفاوض', 'ارخص'])) return 'price';
  if (/plus tard|reflechi|je verrai|on verra|pas maintenant|je reviendrai|je reviens|لاحقا|بعدين|سافكر|افكر|ليس الان/.test(n)) return 'later';
  if (has(tokens, ['livraison', 'livrer', 'livre', 'livrez', 'frais', 'expedition', 'delai', 'agence', 'paiement', 'payer', 'paye', 'payez', 'airtel', 'moov', 'cash', 'espece', 'especes', 'mobile', 'توصيل', 'شحن', 'دفع', 'ادفع', 'تسليم', 'رسوم', 'وكاله', 'ايرتل', 'موف', 'كاش', 'نقدا', 'تكلفه', 'مصاريف'])) return 'delivery';
  if (has(tokens, ['promo', 'promos', 'promotion', 'promotions', 'solde', 'soldes', 'reduction', 'reductions', 'remise', 'remises', 'offre', 'offres', 'flash', 'rabais', 'عروض', 'عرض', 'تخفيضات', 'تخفيض', 'خصم', 'خصومات', 'تنزيلات', 'تنزيل'])) return 'promo';
  if (has(tokens, ['nouveaute', 'nouveautes', 'nouveau', 'nouveaux', 'recent', 'recents', 'derniere', 'dernieres', 'جديد', 'جديده', 'احدث', 'حديثا'])) return 'new';
  if (has(tokens, ['categorie', 'categories', 'catalogue', 'rayon', 'rayons', 'فئات', 'اقسام', 'تصنيفات', 'كتالوج', 'فئه', 'قسم'])) return 'categories';
  if (has(tokens, ['commande', 'commander', 'panier', 'passer', 'طلب', 'اطلب', 'شراء', 'اشتري', 'سله', 'سلتي'])) return 'order';
  if (has(tokens, ['conseil', 'conseils', 'conseille', 'recommande', 'recommandez', 'suggere', 'choisir', 'idee', 'idees', 'نصيحه', 'انصحني', 'انصح', 'اقتراح', 'اقترح', 'ساعدني', 'مساعده', 'اختيار', 'اختار'])) return 'advice';
  if (has(tokens, ['budget', 'ميزانيه', 'ميزانيتي', 'ميزانتي'])) return 'budget';
  if (has(tokens, ['whatsapp', 'contact', 'contacter', 'appeler', 'telephone', 'numero', 'joindre', 'equipe', 'conseiller', 'horaire', 'horaires', 'adresse', 'boutique', 'magasin', 'واتساب', 'واتس', 'اتصال', 'اتصل', 'تواصل', 'هاتف', 'رقم', 'عنوان', 'متجر', 'محل', 'فريق']) || /ساعات العمل|اوقات العمل|مواعيد/.test(n)) return 'contact';
  return 'search';
}

// ---------------------------------------------------------------------------------------------
// Villes : livraison et paiement
// ---------------------------------------------------------------------------------------------

export interface City {
  name: string;
  fee: number | null;
  agency: string | null;
}

// Retrouve la ville ecrite dans le texte (« livraison a moundou », « Ndjamena », « abeche »...).
// Les noms courts (Bol, Ati, Mao...) doivent etre ecrits seuls pour eviter les faux positifs.
export function matchCity(cities: City[], text: string): City | null {
  const latin = hasArabic(text) ? arabicCityToLatin(text) : null;
  const n = normalize(latin ?? text);
  if (!n) return null;
  const tokens = n.split(' ');
  const flat = n.replace(/ /g, '');
  let best: { city: City; len: number } | null = null;
  for (const city of cities) {
    const cn = compact(city.name);
    if (!cn) continue;
    let hit = false;
    if (cn.length <= 4) hit = tokens.includes(cn) || flat === cn;
    else hit = flat.includes(cn) || (flat.length >= 4 && cn.startsWith(flat));
    if (isHomeCity(city.name) && (flat.includes('djamena') || flat.includes('ndjam'))) hit = true;
    if (hit && (!best || cn.length > best.len)) best = { city, len: cn.length };
  }
  return best ? best.city : null;
}

// Livraison et paiement pour une ville.
export function cityReply(city: City, lang: Lang = 'fr'): string {
  const t = texts(lang);
  if (isHomeCity(city.name)) return t.cityHome;
  const agency = city.agency?.trim() || null;
  const delivery = city.fee == null ? t.cityNoFee(city.name, agency) : t.cityFee(city.name, fcfa(city.fee), agency);
  return `${delivery}\n${t.cityPay}`;
}

// Horaires de livraison et duree d'une commande : rappeles apres chaque reponse sur la livraison.
export const serviceNote = (home: boolean, lang: Lang = 'fr'): string => texts(lang).serviceNote(home);

// Les trois choses importantes, dites a chaque client au debut de la conversation.
export const importantInfo = (lang: Lang = 'fr'): string => texts(lang).info;

export const rulesReply = (lang: Lang = 'fr'): string => texts(lang).rules;

// ---------------------------------------------------------------------------------------------
// Phrases pour donner envie d'acheter (tournent pour ne pas se repeter)
// ---------------------------------------------------------------------------------------------

// Phrase qui donne envie d'acheter : tourne parmi plusieurs pour ne pas se repeter.
export function encouragement(seed: number, lang: Lang = 'fr'): string {
  const lines = texts(lang).encouragements;
  return lines[Math.abs(seed) % lines.length];
}
