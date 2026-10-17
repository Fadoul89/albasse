import { isHomeCity } from './deliveryRules';
import { arabicCityToLatin, foldArabic, hasArabic, type Lang } from './assistantLang';
import { fcfa, texts } from './assistantText';

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
  for (const p of products) {
    if (!(p.price > 0) || p.stock <= 0) continue;
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

// « Fatimé », « je m'appelle Fatimé Ali », « moi c'est Ali » -> « Fatimé » / « Ali ». Renvoie null si ce
// n'est pas un prenom (phrase, chiffres, refus).
export function firstNameFrom(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 40) return null;
  if (NO_NAME.test(normalize(t))) return null;
  let s = t
    .replace(/^(bonjour|bonsoir|salut|salam|مرحبا|مرحباً|أهلا|اهلا|السلام عليكم|سلام)[ ,!،]*/i, '')
    .replace(/^(اسمي|أنا|انا|ناديني|نادني|يسمونني)\s+/, '')
    .replace(/^(je m'appelle|je m’appelle|je me nomme|mon nom est|mon prénom est|mon prenom est|moi c'est|moi c’est|c'est|c’est|je suis|appelez[- ]moi|appelle[- ]moi|moi)\s+/i, '')
    .replace(/[.!?,;:،؛؟]+$/g, '')
    .trim();
  if (!s || /\d/.test(s)) return null;
  const words = s.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 3) return null;
  const first = words[0];
  if (!/^[\p{L}][\p{L}'’-]{1,19}$/u.test(first)) return null;
  return first.charAt(0).toLocaleUpperCase('fr-FR') + first.slice(1);
}

// Prenom a partir du nom complet d'un compte.
export function firstNameOfFullName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  return firstNameFrom(fullName.split(' ')[0] ?? '');
}

// ---------------------------------------------------------------------------------------------
// Ce que veut le visiteur
// ---------------------------------------------------------------------------------------------

export type Intent =
  | 'bot'
  | 'thanks'
  | 'greeting'
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
  | 'search';

const has = (tokens: string[], words: string[]) => words.some((w) => tokens.includes(w));

// « الهدية » -> « هديه » : on enleve l'article et les petits prefixes pour retrouver le mot de la liste.
const stemAr = (token: string) => (hasArabic(token) ? token.replace(/^(وال|بال|فال|كال|لل|ال)/, (m) => (m === 'لل' ? 'ل' : '')) : token);

export function detectIntent(text: string): Intent {
  const n = normalize(text);
  const base = n.split(' ').filter(Boolean);
  if (base.length === 0) return 'search';
  const tokens = [...base, ...base.map(stemAr).filter((t, i) => t !== base[i])];
  if (has(tokens, ['robot', 'bot', 'ia', 'intelligence', 'artificielle', 'humain', 'humaine', 'machine', 'automatique', 'روبوت', 'بوت', 'ذكاء', 'اصطناعي', 'اله']) || /vraie? personne|vrai humain|une personne|شخص حقيقي|انسان حقيقي/.test(n)) return 'bot';
  if (has(tokens, ['merci', 'shukran', 'thanks', 'شكرا', 'مشكور', 'مشكوره', 'جزاك'])) return 'thanks';
  if (has(tokens, ['bonjour', 'bonsoir', 'salut', 'salam', 'coucou', 'hello', 'slt', 'hi', 'مرحبا', 'اهلا', 'سلام', 'صباح', 'مساء', 'هلا', 'هاي']) && base.length <= 3) return 'greeting';
  // installer l'application / ajouter à l'écran d'accueil
  if (has(tokens, ['installer', 'installe', 'installation', 'telecharger', 'raccourci', 'pwa', 'appli', 'application', 'تثبيت', 'ثبت', 'تحميل', 'تطبيق']) || /ecran d accueil|ecran accueil|الشاشه الرئيسيه/.test(n)) return 'install';
  // panier : ajouter un article, voir le panier ou le total (« comment ... » reste une question d'aide)
  const how = has(tokens, ['comment', 'كيف']);
  if (!how && has(tokens, ['ajoute', 'ajouter', 'ajoutez', 'rajoute', 'rajouter', 'mets', 'mettre', 'prends', 'prend', 'prendre', 'اضف', 'اضيفي', 'ضيف', 'ضع', 'خذ'])) return 'add';
  if (!how && (has(tokens, ['panier', 'سلتي', 'سله']) || /combien (ca|cela) fait|montant total|le total|mon total|combien je dois|المجموع|الاجمالي/.test(n))) return 'cart';
  if (has(tokens, ['compte', 'inscription', 'inscrire', 'inscris', 'connexion', 'connecter', 'حساب', 'حسابي', 'تسجيل', 'اشتراك', 'سجل', 'اسجل', 'دخول'])) return 'account';
  if (has(tokens, ['suivre', 'suivi', 'طلباتي', 'تتبع', 'متابعه']) || /mes commandes/.test(n)) return 'orders';
  if (has(tokens, ['retour', 'retourner', 'retourne', 'rembourse', 'remboursement', 'rembourser', 'echange', 'echanger', 'defectueux', 'defectueuse', 'abime', 'abimee', 'ارجاع', 'استرجاع', 'ارجع', 'استبدال', 'تبديل', 'معيب', 'تالف', 'استرداد'])) return 'returns';
  if (tokens.includes('48') || tokens.includes('48h') || has(tokens, ['valable', 'validite', 'expire', 'expiree', 'expiration', 'fausse', 'fausses', 'صالح', 'صلاحيه', 'وهميه', 'وهمي'])) return 'rules';
  if (has(tokens, ['infos', 'info', 'informations', 'important', 'importante', 'importantes', 'conditions', 'regles', 'معلومات', 'شروط', 'قواعد'])) return 'info';
  if (/qui etes vous|a propos|presentation|votre histoire|votre experience|depuis quand|2013|من انتم|عن الشركه|عنكم/.test(n)) return 'about';
  if (has(tokens, ['emballage', 'emballer', 'emballe', 'emballee', 'empaqueter', 'تغليف', 'غلاف', 'تغلف', 'مغلف', 'اغلف'])) return 'wrap';
  if (has(tokens, ['cadeau', 'cadeaux', 'offrir', 'anniversaire', 'mariage', 'tabaski', 'ramadan', 'eid', 'هديه', 'هدايا', 'هديتي', 'اهداء', 'اهدي', 'ميلاد', 'زواج', 'عرس', 'رمضان', 'عيد', 'مناسبه'])) return 'gift';
  if (has(tokens, ['arnaque', 'arnaques', 'confiance', 'fiable', 'fiables', 'serieux', 'serieuse', 'securise', 'securisee', 'securite', 'garantie', 'escroquerie', 'escroc', 'peur', 'risque', 'نصب', 'احتيال', 'ثقه', 'موثوق', 'موثوقين', 'موثوقون', 'موثوقه', 'ضمان', 'خوف', 'خايف', 'مصداقيه', 'امان'])) return 'trust';
  if (has(tokens, ['cher', 'chere', 'chers', 'cheres', 'couteux', 'couteuse', 'negocier', 'marchander', 'baisser', 'diminuer', 'غالي', 'غال', 'غاليه', 'باهظ', 'مكلف', 'مساومه', 'تفاوض', 'ارخص'])) return 'price';
  if (/plus tard|reflechi|je verrai|on verra|pas maintenant|je reviendrai|je reviens|لاحقا|بعدين|سافكر|افكر|ليس الان/.test(n)) return 'later';
  if (has(tokens, ['livraison', 'livrer', 'livre', 'livrez', 'frais', 'expedition', 'delai', 'agence', 'paiement', 'payer', 'paye', 'payez', 'airtel', 'moov', 'cash', 'espece', 'especes', 'mobile', 'argent', 'توصيل', 'شحن', 'دفع', 'ادفع', 'تسليم', 'رسوم', 'وكاله', 'ايرتل', 'موف', 'كاش', 'نقدا', 'تكلفه', 'مصاريف'])) return 'delivery';
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
