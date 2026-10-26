// Publicités de Zara à l'écran (accueil et fenêtre de promotion) : elle choisit l'article et écrit le message, avec des faits VRAIS seulement.
// Des fonctions pures, sans réseau ni base : testées dans tests/email/zara-ads.test.ts.
//
// Règles d'honnêteté (les mêmes que partout chez Zara, voir assistantPersona.ts) :
//  - « Beaucoup de clients ont acheté » seulement avec de VRAIES commandes de cet article (au moins 3 ces 7 derniers jours, « beaucoup » à partir de 5) ;
//  - « Article rare » seulement avec un VRAI petit stock (5 au plus) : jamais pour un article dont le stock est confortable ;
//  - le métier du client (compte) ne change que l'ordre et les mots : le client haut placé lit d'abord « Article rare » (si c'est vrai),
//    les autres lisent d'abord les commandes (si elles existent) ou « Plus que N en stock » : les faits sont les mêmes pour tous ;
//  - sans fait vrai, aucun message (jamais de phrase inventée).

import { normalize } from './assistantBrain';
import { LOW_STOCK_MAX, SALES_WINDOW_DAYS, provenSales, type SalesMap } from './assistantSales';

// À partir de ce nombre de vraies commandes, on dit « beaucoup de clients ont acheté » ; en dessous : le chiffre seul.
export const MANY_SALES = 5;

// Les métiers « haut placés », écrits par le client dans son compte (champ libre) ; mots entiers, accents et arabe pliés comme normalize().
const SENIOR_WORDS = [
  'directeur', 'directrice', 'dg', 'pdg', 'dga', 'president', 'presidente', 'ministre', 'depute', 'senateur', 'gouverneur', 'prefet', 'maire',
  'colonel', 'general', 'commandant', 'magistrat', 'juge', 'notaire', 'avocat', 'avocate', 'juriste',
  'ingenieur', 'ingenieure', 'architecte', 'consultant', 'consultante', 'cadre', 'gestionnaire', 'comptable',
  'medecin', 'docteur', 'chirurgien', 'chirurgienne', 'pharmacien', 'pharmacienne',
  'banquier', 'banquiere', 'entrepreneur', 'entrepreneure', 'businessman', 'professeur',
  'مدير', 'مديره', 'رئيس', 'وزير', 'نائب', 'محافظ', 'قاضي', 'محامي', 'مهندس', 'مهندسه', 'طبيب', 'طبيبه', 'دكتور', 'دكتوره', 'صيدلي', 'محاسب', 'بنكي', 'استاذ',
];
const SENIOR_PHRASES = ['homme d affaires', 'femme d affaires', 'chef d entreprise', 'business man', 'رجل اعمال', 'سيده اعمال'];
const SENIOR_RE = new RegExp(`(?:^|\\s)(?:${SENIOR_WORDS.join('|')})(?:\\s|$)`);

// Le métier du compte est-il un métier haut placé (directeur, ingénieur, médecin…) ? Faux pour un champ vide ou un métier inconnu.
export function isSeniorProfession(profession: string | null | undefined): boolean {
  const n = normalize(profession ?? '');
  if (!n || n.split(' ').length > 8) return false;
  return SENIOR_PHRASES.some((p) => n.includes(p)) || SENIOR_RE.test(n);
}

export interface AdView {
  id: string;
  name: string;
  price: number;
  stock: number;
  hasImage: boolean;
}

export interface AdFacts {
  sales: number; // vraies commandes ces 7 derniers jours (0 : rien de solide à dire)
  stock: number; // stock réel quand il est petit, sinon 0 (pas de rareté)
}

// Ce qu'il y a de VRAI à dire de cet article : les commandes (si au moins 3) et le stock (s'il est petit).
export function adFacts(view: Pick<AdView, 'id' | 'stock'>, sales: SalesMap | null | undefined): AdFacts {
  const stock = Number.isFinite(view.stock) ? Math.floor(view.stock) : 0;
  return { sales: provenSales(sales, view.id), stock: stock >= 1 && stock <= LOW_STOCK_MAX ? stock : 0 };
}

const salesSentence = (n: number) =>
  n >= MANY_SALES
    ? `Beaucoup de clients ont acheté cet article : ${n} commandes ces ${SALES_WINDOW_DAYS} derniers jours.`
    : `${n} clients ont commandé cet article ces ${SALES_WINDOW_DAYS} derniers jours.`;

const rareSentence = (stock: number) => (stock === 1 ? "Article rare : il n'en reste qu'un seul." : `Article rare : il n'en reste que ${stock}.`);
const lowStockSentence = (stock: number) => (stock === 1 ? "Plus qu'un seul en stock." : `Plus que ${stock} en stock.`);

// Le message de Zara pour cet article, ou null s'il n'y a aucun fait vrai à dire.
export function adLine(facts: AdFacts, senior: boolean): string | null {
  const proof = facts.sales > 0 ? salesSentence(facts.sales) : null;
  const rare = facts.stock > 0 ? (senior ? rareSentence(facts.stock) : lowStockSentence(facts.stock)) : null;
  const parts = senior ? [rare, proof] : [proof, rare];
  const text = parts.filter((p): p is string => !!p).join(' ');
  return text || null;
}

// Le message d'un article précis (fenêtre de promotion) : null si rien de vrai à dire.
export function productAdLine(view: Pick<AdView, 'id' | 'stock'>, sales: SalesMap | null | undefined, senior: boolean): string | null {
  return adLine(adFacts(view, sales), senior);
}

export interface Ad<T> {
  item: T;
  line: string;
}

// Les articles que Zara met en avant : en vente, en stock, avec une photo et au moins un fait vrai.
// Client haut placé : les articles rares d'abord, le plus cher (le plus haut de gamme) en premier ; les autres : les plus commandés d'abord, puis
// le plus petit stock (les plus commandés restent toujours en tête). `seed` fait tourner les autres choix (par exemple l'heure) pour ne pas montrer
// toujours les mêmes ; sans fait vrai : liste vide.
export function pickAds<T>(items: T[], view: (item: T) => AdView, sales: SalesMap | null | undefined, opts: { senior?: boolean; limit?: number; seed?: number } = {}): Ad<T>[] {
  const senior = !!opts.senior;
  const limit = opts.limit ?? 3;
  const scored = items
    .map((item) => ({ item, v: view(item) }))
    .filter(({ v }) => v.price > 0 && v.stock > 0 && v.hasImage)
    .map(({ item, v }) => {
      const facts = adFacts(v, sales);
      return { item, v, facts, line: adLine(facts, senior) };
    })
    .filter((x): x is typeof x & { line: string } => x.line !== null);
  scored.sort((a, b) => {
    const rareA = a.facts.stock > 0 ? 1 : 0;
    const rareB = b.facts.stock > 0 ? 1 : 0;
    if (senior) return rareB - rareA || b.v.price - a.v.price || b.facts.sales - a.facts.sales || a.v.name.localeCompare(b.v.name);
    return b.facts.sales - a.facts.sales || rareB - rareA || a.facts.stock - b.facts.stock || a.v.name.localeCompare(b.v.name);
  });
  // les plus commandés (vraies commandes) restent toujours en tête pour un client ordinaire ; on tourne seulement parmi les autres (9 au plus)
  const fixed = senior ? [] : scored.filter((x) => x.facts.sales > 0).slice(0, limit);
  const rest = scored.filter((x) => !fixed.includes(x));
  const pool = rest.slice(0, Math.max(limit, 9));
  const start = pool.length > 0 ? ((Math.floor(opts.seed ?? 0) % pool.length) + pool.length) % pool.length : 0;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return [...fixed, ...rotated].slice(0, limit).map(({ item, line }) => ({ item, line }));
}
