// « Annonce » de Zara dans l'accueil : une publicité qui ressemble à une vraie pub (photo, nom, prix, bouton) et qui est CIBLÉE sur le client.
// Des fonctions pures, sans réseau : testées dans tests/email/ad-targeting.test.ts. Voir docs/zara-annonce-ciblee.md.
//
// Le ciblage utilise seulement ce que le site sait VRAIMENT du client (rien n'est deviné, rien n'est inventé) :
//   - ce qu'il a regardé de près sur ce téléphone (suivi de navigation : browsingInsights) et qu'il n'a pas commandé ;
//   - les catégories qu'il explore (au moins 2 articles regardés dans la catégorie) ;
//   - les VRAIES promotions en cours (ancien prix barré seulement pendant une vente flash ou une promotion, lib/promotions) ;
//   - son genre, seulement s'il l'a choisi (Homme / Femme) : on ne lui montre pas un article d'une catégorie réservée à l'autre genre ;
//   - sa ville (profil), pour dire la vraie livraison (tarif de la table des villes).
// Chaque annonce dit POURQUOI on la voit (« Vous avez regardé… ») : sans raison vraie, aucune annonce.
// Jamais de fausse rareté, de faux compte à rebours ni de faux pourcentage.

import { normalize, matchCity, type City } from './assistantBrain';
import { estimateInterest, topCategories, type BrowsingProfile, type ProductRecord } from './browsingInsights';
import { genderOf, type Gender } from './clientGender';
import { isHomeCity } from './deliveryRules';
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
}
export interface AdCategory {
  id: string;
  slug: string;
  name: string;
}

export type AdReason =
  | { kind: 'viewed'; productName: string }
  | { kind: 'category'; categoryName: string }
  | { kind: 'promo'; pct: number; endsAt: number | null };

export interface TargetedAd {
  product: AdProduct;
  reason: AdReason;
}

const DAY_MS = 24 * 3600 * 1000;
export const VIEWED_WITHIN_DAYS = 30; // un article regardé de près il y a plus d'un mois n'est plus rappelé
export const AD_CLOSED_HOURS = 24; // « ✕ » : plus d'annonce pendant 24 h
export const POOL_SIZE = 5; // parmi les 5 meilleurs choix, un par jour (les choix tournent sans jamais sortir de la liste vraie)

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
  customer?: { gender?: unknown } | null;
  browsing?: BrowsingProfile | null; // le suivi de navigation de ce téléphone (null : suivi coupé ou rien encore)
  now?: number;
  seed?: number; // fait tourner les choix (par exemple le jour)
}

const eligible = (p: AdProduct): boolean => p.is_active !== false && Number(p.stock ?? 0) > 0 && Number(p.price) > 0 && !!p.images?.[0];

// Le choix de Zara pour ce client, ou null (aucune raison vraie : aucune annonce).
export function pickTargetedAd(input: AdInput): TargetedAd | null {
  const now = input.now ?? Date.now();
  const seed = Math.floor(input.seed ?? Math.floor(now / DAY_MS));
  const catById = new Map(input.categories.map((c) => [c.id, c]));
  const catBySlug = new Map(input.categories.map((c) => [c.slug, c]));
  const audienceOfProduct = (p: AdProduct) => audienceOf(catById.get(p.category_id ?? '')?.name ?? catById.get(p.category_id ?? '')?.slug ?? '');
  const ok = (p: AdProduct) => eligible(p) && audienceAllows(input.customer?.gender, audienceOfProduct(p));
  const pool = input.products.filter(ok);
  const byId = new Map(pool.map((p) => [p.id, p]));
  const rotate = <T,>(list: T[]): T | null => (list.length === 0 ? null : list[((seed % Math.min(list.length, POOL_SIZE)) + Math.min(list.length, POOL_SIZE)) % Math.min(list.length, POOL_SIZE)]);
  const profile = input.browsing ?? null;

  if (profile) {
    // 1. un article regardé de près, pas commandé : on le rappelle (le plus fort intérêt d'abord, puis le plus récent)
    const since = now - VIEWED_WITHIN_DAYS * DAY_MS;
    const seen = Object.values(profile.products)
      .filter((r: ProductRecord) => r.lastViewedAt >= since && r.views > 0 && r.cartStatus !== 'purchased' && !r.orderedAt && byId.has(r.id))
      .map((r) => ({ r, level: estimateInterest(r).level }))
      .filter((x) => x.level === 'eleve' || (x.level === 'moyen' && x.r.views >= 2))
      .sort((a, b) => Number(b.level === 'eleve') - Number(a.level === 'eleve') || b.r.lastViewedAt - a.r.lastViewedAt);
    if (seen.length > 0) {
      const p = byId.get(seen[0].r.id)!;
      return { product: p, reason: { kind: 'viewed', productName: p.name.trim() } };
    }
    // 2. une catégorie que le client explore (au moins 2 articles regardés) : un article de cette catégorie qu'il n'a pas encore vu, une vraie promotion d'abord
    for (const top of topCategories(profile, 3)) {
      const cat = catBySlug.get(top.key) ?? input.categories.find((c) => c.id === top.key);
      if (!cat) continue;
      const fresh = pool
        .filter((p) => p.category_id === cat.id && !profile.products[p.id])
        .sort((a, b) => (realPromoPct(b, now) ?? 0) - (realPromoPct(a, now) ?? 0) || ms(b.created_at) - ms(a.created_at) || a.name.localeCompare(b.name));
      const p = rotate(fresh);
      if (p) return { product: p, reason: { kind: 'category', categoryName: cat.name.trim() } };
    }
  }
  // 3. une vraie promotion en cours (la plus forte remise d'abord) : l'ancien prix barré n'existe que pendant la promotion
  const promos = pool
    .map((p) => ({ p, pct: realPromoPct(p, now) }))
    .filter((x): x is { p: AdProduct; pct: number } => x.pct !== null)
    .sort((a, b) => b.pct - a.pct || a.p.name.localeCompare(b.p.name));
  const chosen = rotate(promos);
  if (chosen) return { product: chosen.p, reason: { kind: 'promo', pct: chosen.pct, endsAt: promoEndsAt(chosen.p, now) } };
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
  if (reason.kind === 'category') return lang === 'ar' ? `تحب «${reason.categoryName}»؟ إليك منتجاً لتكتشفه.` : `Vous aimez « ${reason.categoryName} » ? Voici un article à découvrir.`;
  const end = reason.endsAt ? (lang === 'ar' ? ` حتى ${dateLabel(reason.endsAt, lang)}` : ` jusqu’au ${dateLabel(reason.endsAt, lang)}`) : '';
  return lang === 'ar' ? `سعر مخفّض: -${reason.pct}%${end}` : `Prix réduit : -${reason.pct} %${end}`;
}

// « Pourquoi cette annonce ? » : la vraie raison, dite au client
export function adWhy(reason: AdReason, lang: AdLang = 'fr'): string {
  if (lang === 'ar') {
    if (reason.kind === 'viewed') return `لماذا هذا الإعلان؟ لأنك شاهدت «${reason.productName}» مؤخراً.`;
    if (reason.kind === 'category') return `لماذا هذا الإعلان؟ لأنك شاهدت عدة منتجات من «${reason.categoryName}».`;
    return 'لماذا هذا الإعلان؟ إنه تخفيض حقيقي جارٍ الآن (السعر القديم مشطوب).';
  }
  if (reason.kind === 'viewed') return `Pourquoi cette annonce ? Vous avez regardé « ${reason.productName} » récemment.`;
  if (reason.kind === 'category') return `Pourquoi cette annonce ? Vous avez regardé plusieurs articles de « ${reason.categoryName} ».`;
  return 'Pourquoi cette annonce ? C’est une vraie promotion en cours (l’ancien prix est barré).';
}

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
    return `🚚 التوصيل إلى ${city.name}: ${fcfa(city.fee)} · الدفع مسبقاً (Airtel Money أو Moov Money).`;
  }
  if (home) return city.fee === 0 ? `🚚 Livraison à ${city.name} : gratuite · vous payez à la réception.` : `🚚 Livraison à ${city.name} : ${fcfa(city.fee)} · vous payez à la réception.`;
  return `🚚 Livraison à ${city.name} : ${fcfa(city.fee)} · paiement à l’avance (Airtel Money ou Moov Money).`;
}

// « ✕ » : l'annonce reste cachée 24 h
export const adClosed = (closedAt: number | null | undefined, now: number = Date.now()): boolean =>
  typeof closedAt === 'number' && Number.isFinite(closedAt) && now - closedAt >= 0 && now - closedAt < AD_CLOSED_HOURS * 3600 * 1000;
