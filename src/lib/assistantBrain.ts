import { HOME_CITY, PAYMENT } from '../constants/assistant';

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
]);

// Mots qui precisent un produit sans dire de quoi il s'agit : ils comptent moins dans le classement.
const MODIFIERS = new Set(['homme', 'femme', 'enfant', 'bebe', 'fille', 'garcon', 'mixte', 'unisexe', 'adulte', 'dame', 'monsieur']);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
  colors: string[] | null;
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
    compareAt: compare !== null && compare > price ? compare : null,
    stock: Number(p.stock ?? 0),
    category: p.category,
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

const discount = (p: CatalogProduct) => (p.compareAt ? 1 - p.price / p.compareAt : 0);

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

const NO_NAME = /^(non|no|passer|plus tard|rien|aucun|skip|pas maintenant|jamais|merci)$/;

// « Fatimé », « je m'appelle Fatimé Ali », « moi c'est Ali » -> « Fatimé » / « Ali ». Renvoie null si ce
// n'est pas un prenom (phrase, chiffres, refus).
export function firstNameFrom(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 40) return null;
  if (NO_NAME.test(normalize(t))) return null;
  let s = t
    .replace(/^(bonjour|bonsoir|salut|salam)[ ,!]*/i, '')
    .replace(/^(je m'appelle|je m’appelle|je me nomme|mon nom est|mon prénom est|mon prenom est|moi c'est|moi c’est|c'est|c’est|je suis|appelez[- ]moi|appelle[- ]moi|moi)\s+/i, '')
    .replace(/[.!?,;:]+$/g, '')
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
  | 'search';

const has = (tokens: string[], words: string[]) => words.some((w) => tokens.includes(w));

export function detectIntent(text: string): Intent {
  const tokens = normalize(text).split(' ').filter(Boolean);
  if (tokens.length === 0) return 'search';
  if (has(tokens, ['robot', 'bot', 'ia', 'intelligence', 'artificielle', 'humain', 'humaine', 'machine', 'automatique']) || /vraie? personne|vrai humain|une personne/.test(normalize(text))) return 'bot';
  if (has(tokens, ['merci', 'shukran', 'thanks'])) return 'thanks';
  if (has(tokens, ['bonjour', 'bonsoir', 'salut', 'salam', 'coucou', 'hello', 'slt', 'hi']) && tokens.length <= 3) return 'greeting';
  if (has(tokens, ['compte', 'inscription', 'inscrire', 'inscris', 'connexion', 'connecter'])) return 'account';
  if (has(tokens, ['suivre', 'suivi']) || /mes commandes/.test(normalize(text))) return 'orders';
  if (has(tokens, ['livraison', 'livrer', 'livre', 'livrez', 'frais', 'expedition', 'delai', 'agence', 'paiement', 'payer', 'paye', 'payez', 'airtel', 'moov', 'cash', 'espece', 'especes', 'mobile', 'argent'])) return 'delivery';
  if (has(tokens, ['promo', 'promos', 'promotion', 'promotions', 'solde', 'soldes', 'reduction', 'reductions', 'remise', 'remises', 'offre', 'offres', 'flash', 'rabais'])) return 'promo';
  if (has(tokens, ['nouveaute', 'nouveautes', 'nouveau', 'nouveaux', 'recent', 'recents', 'derniere', 'dernieres'])) return 'new';
  if (has(tokens, ['categorie', 'categories', 'catalogue', 'rayon', 'rayons'])) return 'categories';
  if (has(tokens, ['commande', 'commander', 'panier', 'passer'])) return 'order';
  if (has(tokens, ['whatsapp', 'contact', 'contacter', 'appeler', 'telephone', 'numero', 'joindre', 'equipe', 'conseiller', 'horaire', 'horaires', 'adresse', 'boutique', 'magasin'])) return 'contact';
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

export function isHomeCity(name: string): boolean {
  const c = compact(name);
  return c === 'ndjamena' || c === 'djamena' || c === 'ndjam';
}

// Retrouve la ville ecrite dans le texte (« livraison a moundou », « Ndjamena », « abeche »...).
// Les noms courts (Bol, Ati, Mao...) doivent etre ecrits seuls pour eviter les faux positifs.
export function matchCity(cities: City[], text: string): City | null {
  const n = normalize(text);
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

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Livraison et paiement pour une ville.
export function cityReply(city: City): string {
  if (isHomeCity(city.name)) {
    return `À ${HOME_CITY}, la livraison est gratuite 🚚 et vous payez à la livraison 💵 : vous ne payez qu'en recevant votre commande.`;
  }
  const delivery =
    city.fee == null
      ? `Pour ${city.name}, le tarif de livraison est à confirmer avec notre équipe sur WhatsApp.`
      : `Pour ${city.name}, la livraison coûte ${fcfa(city.fee)}${city.agency ? `, par l'agence ${city.agency}` : ''}. 🚚`;
  return `${delivery}\nLe paiement se fait à l'avance :\n📱 Airtel Money ${PAYMENT.airtel}\n📲 Moov Money ${PAYMENT.moov}`;
}

// ---------------------------------------------------------------------------------------------
// Phrases pour donner envie d'acheter (tournent pour ne pas se repeter)
// ---------------------------------------------------------------------------------------------

const ENCOURAGEMENTS = [
  'Touchez « Voir le produit » puis « Acheter » : c’est simple et rapide ! 🛍️',
  'À N’Djamena, la livraison est gratuite et vous payez à la livraison : commandez sans risque 😉',
  'Les bonnes affaires partent vite : ne les laissez pas passer ! 🔥',
  'Une belle occasion de vous faire plaisir (ou d’offrir) ! 🎁',
];

export function encouragement(seed: number): string {
  return ENCOURAGEMENTS[Math.abs(seed) % ENCOURAGEMENTS.length];
}
