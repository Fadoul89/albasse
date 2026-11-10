// « Annonce » de Zara dans l'accueil : une publicité qui ressemble à une vraie pub (photo, nom, prix, bouton) et qui est CIBLÉE sur le client.
// Des fonctions pures, sans réseau : testées dans tests/email/ad-targeting.test.ts. Voir docs/zara-annonce-ciblee.md.
//
// Le ciblage utilise seulement ce que le site sait VRAIMENT du client (rien n'est deviné, rien n'est inventé) :
//   - ce qu'il a regardé de près sur ce téléphone (suivi de navigation : browsingInsights) et qu'il n'a pas commandé ;
//   - les catégories qu'il explore (au moins 2 articles regardés dans la catégorie) ;
//   - les VRAIES promotions en cours (ancien prix barré seulement pendant une vente flash ou une promotion, lib/promotions) ;
//   - son genre, seulement s'il l'a choisi (Homme / Femme) : on ne lui montre pas un article d'une catégorie réservée à l'autre genre, et on lui montre en
//     priorité les articles de la catégorie de son genre (« Vêtements pour femmes », « Vitalité & Énergie Homme ») ;
//   - son métier, seulement s'il l'a écrit dans son compte (lib/adAudiences) : élève ou étudiant = un article parmi les moins chers de la boutique ;
//     administrateur ou cadre = un article parmi les plus haut de gamme ;
//   - sa ville (profil), pour dire la vraie livraison (tarif de la table des villes).
// Chaque annonce dit POURQUOI on la voit (« Vous avez regardé… ») : sans raison vraie, aucune annonce.
// Jamais de fausse rareté, de faux compte à rebours ni de faux pourcentage, et jamais un article marqué pour adultes (18+).

import { normalize, matchCity, type City } from './assistantBrain';
import { estimateInterest, topCategories, type BrowsingProfile, type ProductRecord } from './browsingInsights';
import { genderOf, type Gender } from './clientGender';
import { professionAudience, AUDIENCES, FORCES_PRODUCT_SLUGS, type Audience } from './adAudiences';
import { isHomeCity } from './deliveryRules';
import { studentDeal } from './studentOffer';
import { MOBILE_MONEY_ENABLED } from '../constants/shopRules';
import { isVitalityCategory, vitalityAllowed } from './adSensitive';
import { inFamily, rootOf } from './subCategories';
import { flashActive, promoActive, realDiscountPct, shownOldPrice, type PromoFields } from './promotions';

export type AdLang = 'fr' | 'ar';

export interface AdProduct extends PromoFields {
  id: string;
  slug: string;
  name: string;
  stock: number | null;
  images?: string[] | null;
  category_id: string | null;
  is_active?: boolean;
  created_at?: string | null;
  description?: string | null;
}
export interface AdCategory {
  id: string;
  slug: string;
  name: string;
  parent_id?: string | null; // sous-catégorie (lib/subCategories) : elle hérite du public et du « Vitalité & Énergie » de sa catégorie principale
}

export type AdReason =
  | { kind: 'viewed'; productName: string }
  | { kind: 'category'; categoryName: string }
  | { kind: 'promo'; pct: number; endsAt: number | null }
  | { kind: 'gender'; gender: Gender; categoryName: string }
  | { kind: 'liked'; productName: string } // un article mis en favori (❤️), sans autre signal fort
  | { kind: 'interest'; names: string[]; liked: number } // l'affiche « Vos articles préférés » : 2 ou 3 articles « Intérêt élevé » (regardés de près ou aimés)
  | { kind: 'student'; level: 'eleve' | 'etudiant' }
  | { kind: 'studentOffer'; level: 'eleve' | 'etudiant'; code: string; price: number; listPrice: number; pct: number } // la grande affiche : URBANSOLE à 12 500 FCFA, réservé aux élèves et étudiants (lib/studentOffer)
  | { kind: 'executive' }
  | { kind: 'forces' }
  | { kind: 'new'; days: number }; // seulement pour l'annonce qui suit un « ✕ » : un article vraiment ajouté à la boutique il y a `days` jours

export interface TargetedAd {
  product: AdProduct;
  reason: AdReason;
  more?: AdProduct[]; // les autres articles « Intérêt élevé » de la même affiche (au plus 2), seulement pour la raison « interest »
}

const DAY_MS = 24 * 3600 * 1000;
export const VIEWED_WITHIN_DAYS = 30; // un article regardé de près il y a plus d'un mois n'est plus rappelé
export const AD_CLOSED_HOURS = 24; // « ✕ » : un article fermé n'est plus proposé pendant 24 h (et on compte les « ✕ » sur 24 h)
export const AD_NEXT_SECONDS = 15; // « ✕ » : Zara propose un AUTRE article 15 secondes plus tard
export const NEW_WITHIN_DAYS = 30; // « Nouveauté » : un article ajouté à la boutique depuis moins de 30 jours (date vraie de la base)
export const AD_MAX_CLOSES = 3; // …mais au plus 3 fois sur 24 h : au 3ᵉ « ✕ » Zara s'arrête (pas d'harcèlement), elle reprend quand le plus ancien « ✕ » a 24 h
export const AD_ROTATE_HOURS = 6; // Zara change les annonces 4 fois par jour, jour et nuit (24 h sur 24)
export const POOL_SIZE = 5; // parmi les 5 meilleurs choix, un par jour (les choix tournent sans jamais sortir de la liste vraie)

// « Maison & Mobilier » proposé BEAUCOUP plus aux femmes qu'aux hommes (demande du patron, 8 novembre 2026). Seulement d'après le genre que le client a CHOISI dans son compte
// (jamais d'après le prénom). Sur 6 tranches de 6 heures qui se suivent : une femme reçoit « Maison & Mobilier » 4 fois (les 2 autres : sa catégorie, « Vêtements pour femmes »),
// un homme 1 fois (les 5 autres : sa catégorie), soit environ 4 fois plus pour les femmes. Un client sans genre choisi n'est pas concerné. Les raisons vraies (article regardé,
// catégorie explorée, métier) passent toujours avant.
export const HOME_CATEGORY_SLUG = 'maison-mobilier';
export const HOME_SLOTS_OF_6: Record<Gender, number> = { femme: 4, homme: 1 };
export const homeLeanSlot = (gender: Gender, seed: number): boolean => ((Math.floor(seed) % 6) + 6) % 6 < HOME_SLOTS_OF_6[gender];

// Le numéro de la « tranche de 6 heures » en cours : le choix de Zara reste le même pendant 6 heures, puis change tout seul.
// Les tranches suivent l'heure du Tchad (UTC+1, sans changement d'heure) : changement à 00 h, 06 h, 12 h et 18 h à N'Djamena.
const ZONE_OFFSET_MS = 3600 * 1000;
const SLOT_MS = AD_ROTATE_HOURS * 3600 * 1000;
export const adSeed = (now: number): number => Math.floor((now + ZONE_OFFSET_MS) / SLOT_MS);
// Le prochain changement d'annonces (pour l'écran de l'administrateur)
export const nextAdChange = (now: number): number => (adSeed(now) + 1) * SLOT_MS - ZONE_OFFSET_MS;

// --- le genre : une catégorie « pour femmes » n'est pas montrée à un homme (et l'inverse) -------------------------------------------------
// L'audience d'un article se lit dans le nom de sa catégorie (« Vêtements pour femmes », « Vitalité & Énergie Homme ») ; sans mot clair : tout le monde.
export function audienceOf(categoryText: string | null | undefined): Gender | null {
  const n = normalize(categoryText ?? '');
  if (!n) return null;
  const women = /(?:^|\s)(?:femme|femmes|dame|dames|fille|filles|madame)(?:\s|$)|نساء|نسائي|امرأة|بنات/.test(n);
  const men = /(?:^|\s)(?:homme|hommes|monsieur|messieurs|garcon|garcons)(?:\s|$)|رجال|رجالي|ولاد/.test(n);
  if (women && !men) return 'femme';
  if (men && !women) return 'homme';
  return null;
}
export const audienceAllows = (customerGender: unknown, audience: Gender | null): boolean => {
  const g = genderOf(customerGender);
  return !g || !audience || g === audience;
};

// --- les échéances réelles d'une promotion ----------------------------------------------------------------------------------------------------
const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};
// La fin de la promotion en cours (vente flash ou promotion de Zara), ou null s'il n'y a pas d'échéance connue.
export function promoEndsAt(p: PromoFields, now: number): number | null {
  const ends = [flashActive(p, now) ? ms(p.flash_sale_ends_at) : 0, promoActive(p, now) ? ms(p.promo_ends_at) : 0].filter((t) => t > now);
  return ends.length ? Math.min(...ends) : null;
}
// La vraie remise (5 à 60 %) d'un article en promotion en cours, ou null.
export function realPromoPct(p: PromoFields, now: number): number | null {
  const old = shownOldPrice(p, now);
  return old === null ? null : realDiscountPct(p.price, old);
}

export interface AdInput {
  products: AdProduct[];
  categories: AdCategory[];
  customer?: { gender?: unknown; profession?: string | null; birth_date?: unknown; marital_status?: unknown } | null; // birth_date + marital_status : seulement pour les articles « Vitalité & Énergie » (lib/adSensitive)
  browsing?: BrowsingProfile | null; // le suivi de navigation de ce téléphone (null : suivi coupé ou rien encore)
  favorites?: readonly string[]; // les articles mis en favori (❤️) par le client connecté (ils suivent son compte, sur tous ses téléphones)
  interest?: readonly InterestRecordInput[]; // l'intérêt déjà enregistré dans la base pour ce client (fiche « Zara a étudié ce client », docs/zara-etude-client.md), en plus du suivi de ce téléphone
  orderedProductIds?: readonly string[]; // les articles que ce client a déjà commandés (jamais reproposés)
  now?: number;
  seed?: number; // fait tourner les choix (par défaut : la tranche de 6 heures en cours)
  exclude?: readonly string[]; // les articles à ne PAS proposer (ceux que le visiteur vient de fermer avec « ✕ »)
}

// Un article marqué pour adultes (« 🔞 », « 18+ », « +18 », « 18 ans », « adulte », « delay spray ») n'est JAMAIS utilisé dans une annonce de l'accueil :
// l'annonce est vue par tout le monde, élèves compris. (Il reste en vente normalement dans sa catégorie.)
export function isAdultItem(p: Pick<AdProduct, 'name' | 'slug' | 'description'>): boolean {
  const text = `${p.name ?? ''} ${p.slug ?? ''} ${p.description ?? ''}`.toLowerCase();
  return /🔞/.test(text) || /(^|[^0-9])18\s?\+/.test(text) || /\+\s?18([^0-9]|$)/.test(text) || /(^|[^0-9])18\s?ans/.test(text) || /adulte/.test(text) || /delay[\s-]*spray/.test(text);
}

const eligible = (p: AdProduct): boolean => p.is_active !== false && Number(p.stock ?? 0) > 0 && Number(p.price) > 0 && !!p.images?.[0] && !isAdultItem(p);

// --- « Intérêt élevé » : les articles que CE client regarde de près ou aime (demande du patron, 10 novembre 2026) ---------------------------------------------------
// Zara analyse ce que le client a fait (consultations, signaux forts, commande commencée) et ce qu'il a aimé (favoris ❤️), et montre sur l'affiche les articles
// d'intérêt le plus élevé, jusqu'à 3. Un article déjà commandé n'est jamais proposé. Rien n'est deviné : un favori ou des regards VRAIS, chaque fois.
export const INTEREST_MAX = 3; // au plus 3 articles sur l'affiche
// Un article regardé par le client, tel que le suivi (ce téléphone ou la base) l'a noté
export interface InterestRecordInput {
  id: string;
  level: 'eleve' | 'moyen' | 'leger';
  views: number;
  lastViewedAt: number;
  purchased: boolean;
}
const LEVEL_RANK = { leger: 0, moyen: 1, eleve: 2 } as const;
// Deux notes du même article (ce téléphone et la base) : on garde la plus forte, jamais de doublon
export function mergeInterestRecords(...lists: readonly (readonly InterestRecordInput[])[]): InterestRecordInput[] {
  const out = new Map<string, InterestRecordInput>();
  for (const list of lists) {
    for (const r of list) {
      const prev = out.get(r.id);
      out.set(r.id, prev ? { id: r.id, level: LEVEL_RANK[r.level] > LEVEL_RANK[prev.level] ? r.level : prev.level, views: Math.max(prev.views, r.views), lastViewedAt: Math.max(prev.lastViewedAt, r.lastViewedAt), purchased: prev.purchased || r.purchased } : r);
    }
  }
  return [...out.values()];
}
export interface InterestCandidate {
  id: string;
  score: number;
  liked: boolean;
  viewed: boolean; // regardé de près (« Intérêt élevé », ou « moyen » avec au moins 2 consultations)
  lastViewedAt: number;
}
// Le classement : un favori compte 3, un article « Intérêt élevé » compte 3, un article regardé au moins 2 fois (« moyen ») compte 1, chaque consultation en plus compte un peu ;
// à égalité : le plus récemment regardé, puis le nom.
export function rankInterest(
  records: readonly { id: string; level: 'eleve' | 'moyen' | 'leger'; views: number; lastViewedAt: number; purchased: boolean }[],
  likedIds: readonly string[],
  allowed: (id: string) => boolean
): InterestCandidate[] {
  const liked = new Set(likedIds);
  const byId = new Map<string, InterestCandidate>();
  for (const r of records) {
    if (r.purchased || !allowed(r.id)) continue;
    const strong = r.level === 'eleve' || (r.level === 'moyen' && r.views >= 2);
    const isLiked = liked.has(r.id);
    if (!strong && !isLiked) continue;
    byId.set(r.id, { id: r.id, liked: isLiked, viewed: strong, lastViewedAt: r.lastViewedAt, score: (isLiked ? 3 : 0) + (r.level === 'eleve' ? 3 : strong ? 1 : 0) + Math.min(r.views, 10) * 0.1 });
  }
  for (const id of liked) {
    if (byId.has(id) || !allowed(id)) continue;
    const rec = records.find((r) => r.id === id);
    if (rec?.purchased) continue;
    byId.set(id, { id, liked: true, viewed: false, lastViewedAt: rec?.lastViewedAt ?? 0, score: 3 });
  }
  return [...byId.values()].sort((a, b) => b.score - a.score || b.lastViewedAt - a.lastViewedAt || a.id.localeCompare(b.id));
}

// Le choix de Zara pour ce client, ou null (aucune raison vraie : aucune annonce).
export function pickTargetedAd(input: AdInput): TargetedAd | null {
  const now = input.now ?? Date.now();
  const seed = Math.floor(input.seed ?? adSeed(now));
  const catById = new Map(input.categories.map((c) => [c.id, c]));
  const catBySlug = new Map(input.categories.map((c) => [c.slug, c]));
  // une sous-catégorie sans public à elle (« Chemises ») prend celui de sa catégorie principale (« Vêtements pour hommes »)
  const audienceOfCategory = (c: AdCategory | undefined) => (c ? audienceOf(c.name ?? c.slug ?? '') : null);
  const audienceOfProduct = (p: AdProduct) => {
    const own = catById.get(p.category_id ?? '');
    return audienceOfCategory(own) ?? audienceOfCategory(rootOf(input.categories, p.category_id) ?? undefined);
  };
  const excluded = new Set(input.exclude ?? []);
  // « Vitalité & Énergie » : jamais dans une annonce, sauf pour un client marié de 32 ans et plus (lib/adSensitive)
  const vitalityOk = vitalityAllowed(input.customer, now);
  const vitalityHidden = (p: AdProduct) => !vitalityOk && (isVitalityCategory(catById.get(p.category_id ?? '')) || isVitalityCategory(rootOf(input.categories, p.category_id)));
  const ok = (p: AdProduct) => eligible(p) && !excluded.has(p.id) && !vitalityHidden(p) && audienceAllows(input.customer?.gender, audienceOfProduct(p));
  const pool = input.products.filter(ok);
  const byId = new Map(pool.map((p) => [p.id, p]));
  const rotate = <T,>(list: T[], offset = 0): T | null => {
    if (list.length === 0) return null;
    const n = Math.min(list.length, POOL_SIZE);
    return list[(((seed + offset) % n) + n) % n];
  };
  const profile = input.browsing ?? null;

  // 0. élève ou étudiant : la grande affiche de l'offre du patron (lib/studentOffer) passe en premier, tant que l'article est en vente et que le client ne l'a pas déjà commandé.
  //    Jamais aux autres clients. Un client qui ferme l'annonce (« ✕ ») n'a plus cet article pendant 24 h : `pool` l'exclut, les autres annonces reprennent.
  const level = professionAudience(input.customer?.profession);
  if (level === 'eleve' || level === 'etudiant') {
    const offerProduct = pool.find((p) => studentDeal({ slug: p.slug, price: p.price }, input.customer) !== null);
    const rec = offerProduct ? profile?.products?.[offerProduct.id] : undefined;
    const bought = !!rec && (rec.cartStatus === 'purchased' || !!rec.orderedAt);
    const deal = offerProduct && !bought ? studentDeal({ slug: offerProduct.slug, price: offerProduct.price }, input.customer) : null;
    if (offerProduct && deal) return { product: offerProduct, reason: { kind: 'studentOffer', level, code: deal.code, price: deal.price, listPrice: deal.listPrice, pct: deal.pct } };
  }

  // 1. « Intérêt élevé » : les articles que le client regarde de près (pas commandés) ou qu'il a aimés (❤️). Un seul : on le rappelle ; deux ou trois : l'affiche « Vos articles préférés ».
  {
    const since = now - VIEWED_WITHIN_DAYS * DAY_MS;
    const fromPhone: InterestRecordInput[] = profile
      ? Object.values(profile.products)
          .filter((r: ProductRecord) => r.lastViewedAt >= since && r.views > 0)
          .map((r) => ({ id: r.id, level: estimateInterest(r).level, views: r.views, lastViewedAt: r.lastViewedAt, purchased: r.cartStatus === 'purchased' || !!r.orderedAt }))
      : [];
    const fromBase = (input.interest ?? []).filter((r) => r.lastViewedAt >= since && r.views > 0);
    const records = mergeInterestRecords(fromPhone, fromBase);
    // un article aimé et déjà commandé n'est plus proposé non plus
    const orderedIds = new Set([
      ...(profile ? Object.values(profile.products).filter((r: ProductRecord) => r.cartStatus === 'purchased' || !!r.orderedAt).map((r) => r.id) : []),
      ...(input.orderedProductIds ?? []),
      ...records.filter((r) => r.purchased).map((r) => r.id),
    ]);
    const ranked = rankInterest(records, input.favorites ?? [], (id) => byId.has(id) && !orderedIds.has(id)).slice(0, INTEREST_MAX);
    if (ranked.length >= 2) {
      const list = ranked.map((c) => byId.get(c.id)!);
      return { product: list[0], more: list.slice(1), reason: { kind: 'interest', names: list.map((p) => p.name.trim()), liked: ranked.filter((c) => c.liked).length } };
    }
    if (ranked.length === 1) {
      const p = byId.get(ranked[0].id)!;
      return { product: p, reason: ranked[0].viewed ? { kind: 'viewed', productName: p.name.trim() } : { kind: 'liked', productName: p.name.trim() } };
    }
  }
  if (profile) {
    // 2. une catégorie que le client explore (au moins 2 articles regardés) : un article de cette catégorie qu'il n'a pas encore vu, une vraie promotion d'abord
    for (const top of topCategories(profile, 3)) {
      const cat = catBySlug.get(top.key) ?? input.categories.find((c) => c.id === top.key);
      if (!cat) continue;
      const fresh = pool
        .filter((p) => inFamily(input.categories, p.category_id, cat.id) && !profile.products[p.id])
        .sort((a, b) => (realPromoPct(b, now) ?? 0) - (realPromoPct(a, now) ?? 0) || ms(b.created_at) - ms(a.created_at) || a.name.localeCompare(b.name));
      const p = rotate(fresh);
      if (p) return { product: p, reason: { kind: 'category', categoryName: cat.name.trim() } };
    }
  }
  // 3. le public du client (ce qu'il a écrit dans son compte) : métier puis genre
  const prices = pool.map((p) => Number(p.price)).sort((a, b) => a - b);
  const byPromo = (a: AdProduct, b: AdProduct) => (realPromoPct(b, now) ?? 0) - (realPromoPct(a, now) ?? 0);
  const pro = professionAudience(input.customer?.profession);
  if ((pro === 'eleve' || pro === 'etudiant') && prices.length > 0) {
    // élève : le quart le moins cher de la boutique ; étudiant : les 40 % les moins chers (deux annonces différentes pour deux publics différents)
    const cut = prices[Math.max(0, Math.ceil(prices.length * (pro === 'eleve' ? 0.25 : 0.4)) - 1)];
    const cheap = pool.filter((p) => Number(p.price) <= cut).sort((a, b) => byPromo(a, b) || Number(a.price) - Number(b.price) || a.name.localeCompare(b.name));
    const p = rotate(cheap, pro === 'etudiant' ? 1 : 0);
    if (p) return { product: p, reason: { kind: 'student', level: pro } };
  }
  if (pro === 'forces') {
    // militaire, policier, gendarme… : les articles choisis par le patron pour eux (lib/adAudiences, FORCES_PRODUCT_SLUGS), s'ils sont en vente
    const mine = pool.filter((p) => FORCES_PRODUCT_SLUGS.includes(p.slug)).sort((a, b) => a.name.localeCompare(b.name));
    const p = rotate(mine);
    if (p) return { product: p, reason: { kind: 'forces' } };
  }
  if (pro === 'admin' && prices.length > 0) {
    // administrateur, cadre : le quart le plus haut de gamme de la boutique (les plus chers d'abord)
    const cut = prices[Math.min(prices.length - 1, Math.floor(prices.length * 0.75))];
    const premium = pool.filter((p) => Number(p.price) >= cut).sort((a, b) => Number(b.price) - Number(a.price) || a.name.localeCompare(b.name));
    const p = rotate(premium);
    if (p) return { product: p, reason: { kind: 'executive' } };
  }
  const g = genderOf(input.customer?.gender);
  if (g) {
    // la catégorie de son genre (« Vêtements pour femmes », « Vitalité & Énergie Homme »), une vraie promotion d'abord, puis le plus récent
    const byRecent = (a: AdProduct, b: AdProduct) => byPromo(a, b) || ms(b.created_at) - ms(a.created_at) || a.name.localeCompare(b.name);
    const mine = pool.filter((p) => audienceOfProduct(p) === g).sort(byRecent);
    // « Maison & Mobilier » (et ses sous-catégories) : beaucoup plus souvent aux femmes (HOME_SLOTS_OF_6). Une femme qui n'a pas d'article de sa catégorie en reçoit toujours un de la maison ;
    // un homme n'en reçoit que pendant sa tranche (jamais en remplacement).
    const homeCat = input.categories.find((c) => c.slug === HOME_CATEGORY_SLUG);
    const home = homeCat ? pool.filter((p) => inFamily(input.categories, p.category_id, homeCat.id)).sort(byRecent) : [];
    const homeNow = homeLeanSlot(g, seed);
    const order = g === 'femme' ? (homeNow ? [home, mine] : [mine, home]) : homeNow ? [home, mine] : [mine];
    for (const list of order) {
      const p = rotate(list);
      if (p) return { product: p, reason: { kind: 'gender', gender: g, categoryName: (catById.get(p.category_id ?? '')?.name ?? '').trim() } };
    }
  }
  // 4. une vraie promotion en cours (la plus forte remise d'abord) : l'ancien prix barré n'existe que pendant la promotion
  const promos = pool
    .map((p) => ({ p, pct: realPromoPct(p, now) }))
    .filter((x): x is { p: AdProduct; pct: number } => x.pct !== null)
    .sort((a, b) => b.pct - a.pct || a.p.name.localeCompare(b.p.name));
  const chosen = rotate(promos);
  if (chosen) return { product: chosen.p, reason: { kind: 'promo', pct: chosen.pct, endsAt: promoEndsAt(chosen.p, now) } };
  // 5. seulement APRÈS un « ✕ » (le visiteur a fermé une annonce : Zara lui en propose une autre) et sans autre raison : une vraie nouveauté de la boutique
  if (excluded.size > 0) {
    const fresh = pool
      .filter((p) => {
        const t = ms(p.created_at);
        return t > 0 && t <= now && now - t < NEW_WITHIN_DAYS * DAY_MS;
      })
      .sort((a, b) => ms(b.created_at) - ms(a.created_at) || a.name.localeCompare(b.name));
    const p = rotate(fresh);
    if (p) return { product: p, reason: { kind: 'new', days: Math.floor((now - ms(p.created_at)) / DAY_MS) } };
  }
  return null;
}

// --- les textes (français et arabe) -----------------------------------------------------------------------------------------------------------
export const AD_LABEL: Record<AdLang, string> = { fr: 'Annonce', ar: 'إعلان' };
export const AD_ADVERTISER = 'Albasse Shopping';
export const AD_CTA: Record<AdLang, { buy: string; ask: string; close: string }> = {
  fr: { buy: 'Acheter maintenant', ask: 'Demander à Zara', close: 'Masquer cette annonce' },
  ar: { buy: 'اشترِ الآن', ask: 'اسأل زارا', close: 'إخفاء هذا الإعلان' },
};

const dateLabel = (at: number, lang: AdLang) => new Date(at).toLocaleDateString(lang === 'ar' ? 'ar' : 'fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Ndjamena' });

// La phrase d'accroche (vraie) de l'annonce
export function adHeadline(reason: AdReason, lang: AdLang = 'fr'): string {
  if (reason.kind === 'viewed') return lang === 'ar' ? 'شاهدتَ هذا المنتج. ما زال ينتظرك.' : 'Vous avez regardé cet article. Il vous attend toujours.';
  if (reason.kind === 'liked') return lang === 'ar' ? 'أعجبك هذا المنتج ❤️ وما زال ينتظرك.' : 'Vous avez aimé cet article ❤️ Il vous attend.';
  if (reason.kind === 'interest') return lang === 'ar' ? 'منتجاتك المفضلة تنتظرك.' : 'Vos articles préférés vous attendent.';
  if (reason.kind === 'category') return lang === 'ar' ? `تحب «${reason.categoryName}»؟ إليك منتجاً لتكتشفه.` : `Vous aimez « ${reason.categoryName} » ? Voici un article à découvrir.`;
  if (reason.kind === 'gender') return lang === 'ar' ? `اخترنا ${reason.gender === 'femme' ? 'لكِ' : 'لك'}: «${reason.categoryName}».` : `Choisi pour vous : « ${reason.categoryName} ».`;
  if (reason.kind === 'student') return lang === 'ar' ? `${reason.level === 'eleve' ? 'للتلاميذ' : 'للطلاب'}: منتج بسعر صغير.` : `Pour les ${reason.level === 'eleve' ? 'élèves' : 'étudiants'} : un article à petit prix.`;
  if (reason.kind === 'studentOffer') return lang === 'ar' ? `عرض حصري لل${reason.level === 'eleve' ? 'تلاميذ' : 'طلاب'}: ${fcfa(reason.price)} فقط` : `Offre uniquement pour les élèves et étudiants : ${fcfa(reason.price)}`;
  if (reason.kind === 'executive') return lang === 'ar' ? 'مجموعة راقية مختارة لك.' : 'Une sélection haut de gamme pour vous.';
  if (reason.kind === 'forces') return lang === 'ar' ? 'مصمم للعسكريين وقوات الأمن.' : 'Pensé pour les militaires et les forces de l’ordre.';
  if (reason.kind === 'new') return lang === 'ar' ? 'جديد يستحق الاكتشاف.' : 'Une nouveauté à découvrir.';
  const end = reason.endsAt ? (lang === 'ar' ? ` حتى ${dateLabel(reason.endsAt, lang)}` : ` jusqu’au ${dateLabel(reason.endsAt, lang)}`) : '';
  return lang === 'ar' ? `سعر مخفّض: -${reason.pct}%${end}` : `Prix réduit : -${reason.pct} %${end}`;
}

// « Pourquoi cette annonce ? » : la vraie raison, dite au client
export function adWhy(reason: AdReason, lang: AdLang = 'fr'): string {
  if (lang === 'ar') {
    if (reason.kind === 'viewed') return `لماذا هذا الإعلان؟ لأنك شاهدت «${reason.productName}» مؤخراً.`;
    if (reason.kind === 'liked') return `لماذا هذا الإعلان؟ لأنك أضفت «${reason.productName}» إلى مفضلتك.`;
    if (reason.kind === 'interest') return `لماذا هذا الإعلان؟ لأنك شاهدت هذه المنتجات عن قرب أو أعجبتك: ${namesList(reason.names, 'ar')}.`;
    if (reason.kind === 'category') return `لماذا هذا الإعلان؟ لأنك شاهدت عدة منتجات من «${reason.categoryName}».`;
    if (reason.kind === 'gender') return `لماذا هذا الإعلان؟ لأنك اخترت «${reason.gender === 'femme' ? 'أنثى' : 'ذكر'}» في حسابك: هذا منتج من «${reason.categoryName}».`;
    if (reason.kind === 'student') return `لماذا هذا الإعلان؟ لأنك كتبت «${reason.level === 'eleve' ? 'تلميذ' : 'طالب'}» في حسابك، وهذا المنتج من الأقل سعراً في المتجر.`;
    if (reason.kind === 'studentOffer') return `لماذا هذا الإعلان؟ لأنك كتبت «${reason.level === 'eleve' ? 'تلميذ' : 'طالب'}» في حسابك، وهذا العرض (الكود ${reason.code}) خاص بالتلاميذ والطلاب فقط. السعر العادي ${fcfa(reason.listPrice)}.`;
    if (reason.kind === 'executive') return 'لماذا هذا الإعلان؟ لأنك كتبت مهنة إدارية أو قيادية في حسابك، وهذا المنتج من الأرقى في المتجر.';
    if (reason.kind === 'forces') return 'لماذا هذا الإعلان؟ لأنك كتبت مهنة عسكرية أو أمنية في حسابك، وهذا المنتج مصمم للعسكريين وقوات الأمن.';
    if (reason.kind === 'new') return `لماذا هذا الإعلان؟ أُضيف هذا المنتج إلى المتجر ${reason.days === 0 ? 'اليوم' : reason.days === 1 ? 'أمس' : `منذ ${reason.days} ${reason.days <= 10 ? 'أيام' : 'يوماً'}`}.`;
    return 'لماذا هذا الإعلان؟ إنه تخفيض حقيقي جارٍ الآن (السعر القديم مشطوب).';
  }
  if (reason.kind === 'viewed') return `Pourquoi cette annonce ? Vous avez regardé « ${reason.productName} » récemment.`;
  if (reason.kind === 'liked') return `Pourquoi cette annonce ? Vous avez ajouté « ${reason.productName} » à vos favoris.`;
  if (reason.kind === 'interest') return `Pourquoi cette annonce ? Vous avez regardé de près ou aimé ces articles : ${namesList(reason.names, 'fr')}.`;
  if (reason.kind === 'category') return `Pourquoi cette annonce ? Vous avez regardé plusieurs articles de « ${reason.categoryName} ».`;
  if (reason.kind === 'gender') return `Pourquoi cette annonce ? Vous avez choisi « ${reason.gender === 'femme' ? 'Femme' : 'Homme'} » dans votre compte : voici un article de « ${reason.categoryName} ».`;
  if (reason.kind === 'student') return `Pourquoi cette annonce ? Vous avez indiqué « ${reason.level === 'eleve' ? 'élève' : 'étudiant'} » dans votre compte, et cet article fait partie des moins chers de la boutique.`;
  if (reason.kind === 'studentOffer') return `Pourquoi cette annonce ? Vous avez indiqué « ${reason.level === 'eleve' ? 'élève' : 'étudiant'} » dans votre compte : cette offre (code ${reason.code}) est réservée aux élèves et étudiants. Le prix normal est ${fcfa(reason.listPrice)}.`;
  if (reason.kind === 'executive') return 'Pourquoi cette annonce ? Vous avez indiqué un métier d’administration ou de direction dans votre compte, et cet article fait partie des plus haut de gamme de la boutique.';
  if (reason.kind === 'forces') return 'Pourquoi cette annonce ? Vous avez indiqué un métier militaire ou de sécurité (armée, police, gendarmerie…) dans votre compte, et cet article est conçu pour les militaires et les forces de l’ordre.';
  if (reason.kind === 'new') return `Pourquoi cette annonce ? Cet article a été ajouté à la boutique ${reason.days === 0 ? 'aujourd’hui' : reason.days === 1 ? 'hier' : `il y a ${reason.days} jours`}.`;
  return 'Pourquoi cette annonce ? C’est une vraie promotion en cours (l’ancien prix est barré).';
}

// « A », « B » et « C »
const namesList = (names: readonly string[], lang: AdLang): string => {
  const q = names.map((n) => `« ${n} »`);
  if (q.length <= 1) return q.join('');
  const and = lang === 'ar' ? ' و' : ' et ';
  return `${q.slice(0, -1).join(lang === 'ar' ? '، ' : ', ')}${and}${q[q.length - 1]}`;
};

const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

// La vraie livraison vers la ville du client (profil), ou null si on ne la connaît pas : N'Djamena = gratuite, paiement à la réception ;
// ailleurs = le tarif de la ville, paiement à l'avance (règles de la boutique).
export function deliveryLine(region: string | null | undefined, cities: City[] | null | undefined, lang: AdLang = 'fr'): string | null {
  if (!region || !cities || cities.length === 0) return null;
  const city = matchCity(cities, region);
  if (!city || city.fee === null || !Number.isFinite(city.fee)) return null;
  const home = isHomeCity(city.name);
  if (lang === 'ar') {
    if (home) return city.fee === 0 ? `🚚 التوصيل إلى ${city.name}: مجاني · تدفع عند الاستلام.` : `🚚 التوصيل إلى ${city.name}: ${fcfa(city.fee)} · تدفع عند الاستلام.`;
    return MOBILE_MONEY_ENABLED
      ? `🚚 التوصيل إلى ${city.name}: ${fcfa(city.fee)} · الدفع مسبقاً (Airtel Money أو Moov Money).`
      : `🚚 التوصيل إلى ${city.name}: ${fcfa(city.fee)} · الطلب عبر واتساب.`;
  }
  if (home) return city.fee === 0 ? `🚚 Livraison à ${city.name} : gratuite · vous payez à la réception.` : `🚚 Livraison à ${city.name} : ${fcfa(city.fee)} · vous payez à la réception.`;
  return MOBILE_MONEY_ENABLED
    ? `🚚 Livraison à ${city.name} : ${fcfa(city.fee)} · paiement à l’avance (Airtel Money ou Moov Money).`
    : `🚚 Livraison à ${city.name} : ${fcfa(city.fee)} · commande sur WhatsApp.`;
}

// --- « ✕ » : Zara propose un AUTRE article 15 secondes plus tard ---------------------------------------------------------------------------------
// Chaque « ✕ » est noté sur le téléphone (l'article fermé et l'heure). L'article fermé n'est plus proposé pendant 24 h ; 15 secondes après le « ✕ »
// Zara en montre un autre (toujours avec de vraies raisons : rien n'est inventé pour remplir). Au plus 3 « ✕ » sur 24 h, puis Zara s'arrête.
export interface ClosedAd {
  id: string; // l'article fermé
  at: number; // quand (millisecondes)
}

// Ce que le téléphone a gardé (texte JSON) : seulement les « ✕ » des dernières 24 h et valides ; tout ce qui n'est pas clair est ignoré.
export function parseClosedAds(raw: string | null | undefined, now: number = Date.now()): ClosedAd[] {
  try {
    const list = JSON.parse(String(raw ?? ''));
    if (!Array.isArray(list)) return [];
    const out: ClosedAd[] = [];
    for (const x of list) {
      const id = typeof x?.id === 'string' ? x.id : '';
      const at = Number(x?.at);
      if (id && Number.isFinite(at) && now - at >= 0 && now - at < AD_CLOSED_HOURS * 3600 * 1000) out.push({ id, at });
    }
    return out.sort((a, b) => a.at - b.at).slice(-AD_MAX_CLOSES * 4);
  } catch {
    return [];
  }
}

// Où en est le visiteur ? stopped : 3 « ✕ » sur 24 h, Zara ne montre plus rien ; waitMs : temps à attendre avant l'annonce suivante (0 : on peut la montrer) ;
// excluded : les articles à ne pas remontrer.
export interface ClosedState {
  stopped: boolean;
  waitMs: number;
  excluded: string[];
}
export function closedState(closed: readonly ClosedAd[], now: number = Date.now()): ClosedState {
  const recent = closed.filter((c) => Number.isFinite(c.at) && now - c.at >= 0 && now - c.at < AD_CLOSED_HOURS * 3600 * 1000);
  const excluded = [...new Set(recent.map((c) => c.id))];
  // l'affiche « Vos articles préférés » fermée note TOUS ses articles à la même heure : c'est UN seul « ✕ » (on compte les heures différentes)
  if (new Set(recent.map((c) => c.at)).size >= AD_MAX_CLOSES) return { stopped: true, waitMs: 0, excluded };
  const last = recent.reduce((m, c) => Math.max(m, c.at), 0);
  const waitMs = last > 0 ? Math.max(0, last + AD_NEXT_SECONDS * 1000 - now) : 0;
  return { stopped: false, waitMs, excluded };
}

// Le « ✕ » qui vient d'être touché : ajouté à la liste (les plus anciens hors des 24 h partent)
export const addClosedAd = (closed: readonly ClosedAd[], id: string, now: number = Date.now()): ClosedAd[] =>
  [...closed.filter((c) => now - c.at >= 0 && now - c.at < AD_CLOSED_HOURS * 3600 * 1000), { id, at: now }].slice(-AD_MAX_CLOSES * 4);

// Le « ✕ » d'une affiche qui montre plusieurs articles : tous sont fermés pour 24 h, à la même heure (un seul « ✕ » compté)
export const addClosedAds = (closed: readonly ClosedAd[], ids: readonly string[], now: number = Date.now()): ClosedAd[] =>
  [...closed.filter((c) => now - c.at >= 0 && now - c.at < AD_CLOSED_HOURS * 3600 * 1000), ...ids.map((id) => ({ id, at: now }))].slice(-AD_MAX_CLOSES * 4);

// L'annonce que Zara montre en ce moment à chaque public (écran de l'administrateur) : un client « type » par public, sans historique de navigation.
// Un public sans annonce vraie vaut null (Zara n'invente rien).
export function previewAudiences(input: { products: AdProduct[]; categories: AdCategory[]; now?: number; seed?: number }): Record<Audience, TargetedAd | null> {
  const customers: Record<Audience, { gender?: unknown; profession?: string | null }> = {
    femme: { gender: 'femme' },
    homme: { gender: 'homme' },
    eleve: { profession: 'élève' },
    etudiant: { profession: 'étudiant' },
    admin: { profession: 'administrateur' },
    forces: { profession: 'militaire' },
  };
  const out = {} as Record<Audience, TargetedAd | null>;
  for (const a of AUDIENCES) out[a] = pickTargetedAd({ products: input.products, categories: input.categories, customer: customers[a], browsing: null, now: input.now, seed: input.seed });
  return out;
}
