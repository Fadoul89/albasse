// Règles d'affichage de la Vente flash et des Promotions (fonctions pures, testées dans tests/email/zara-promotions.test.ts).
//   - Une Vente flash dure 24 h : passé ce délai elle DISPARAÎT (même si le nettoyage automatique de la base n'est pas encore passé).
//   - L'ancien prix barré n'est montré QUE pour une vraie promotion : une vente flash en cours ou une promotion de Zara en cours,
//     avec une vraie remise (5 % à 60 % ; au-delà, c'est une erreur de saisie). Rien n'est effacé : la base garde l'ancien prix de côté.
export const MIN_REAL_DISCOUNT_PCT = 5;
export const MAX_REAL_DISCOUNT_PCT = 60;

export interface PromoFields {
  price: number;
  compare_at_price: number | null;
  is_flash_sale?: boolean;
  flash_sale_ends_at?: string | null;
  promo_ends_at?: string | null; // absent tant que add-zara-promotions.sql n'est pas lancé
}

const ends = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

export const flashActive = (p: PromoFields, now: number = Date.now()): boolean => !!p.is_flash_sale && ends(p.flash_sale_ends_at) > now;
export const promoActive = (p: PromoFields, now: number = Date.now()): boolean => ends(p.promo_ends_at) > now;

// la remise en pourcentage entier si elle est vraie (5 à 60 %), sinon null
export function realDiscountPct(price: number, oldPrice: number | null | undefined): number | null {
  const p = Number(price);
  const o = Number(oldPrice);
  if (!Number.isFinite(p) || !Number.isFinite(o) || p <= 0 || o <= p) return null;
  const pct = Math.round((1 - p / o) * 100);
  const exact = (1 - p / o) * 100;
  return exact >= MIN_REAL_DISCOUNT_PCT && exact <= MAX_REAL_DISCOUNT_PCT ? pct : null;
}

// l'ancien prix à barrer, ou null : seulement pendant une vente flash ou une promotion, et seulement si la remise est vraie
export function shownOldPrice(p: PromoFields, now: number = Date.now()): number | null {
  if (!p.compare_at_price) return null;
  if (!flashActive(p, now) && !promoActive(p, now)) return null;
  return realDiscountPct(p.price, p.compare_at_price) === null ? null : p.compare_at_price;
}

// l'article tel que le client doit le voir : vente flash finie = plus de vente flash ; ancien prix seulement en vraie promotion
export function applyPromotionRules<T extends PromoFields>(p: T, now: number = Date.now()): T {
  const flash = flashActive(p, now);
  return { ...p, is_flash_sale: flash, flash_sale_ends_at: flash ? (p.flash_sale_ends_at ?? null) : null, compare_at_price: shownOldPrice(p, now) };
}

// les articles de la Vente flash en cours, et la fin la plus proche (pour le compte à rebours)
export function activeFlash<T extends PromoFields>(products: T[], now: number = Date.now()): { items: T[]; endsAt: string | null } {
  const items = products.filter((p) => flashActive(p, now));
  const soonest = items.reduce<string | null>((best, p) => (best === null || ends(p.flash_sale_ends_at) < ends(best) ? (p.flash_sale_ends_at ?? null) : best), null);
  return { items, endsAt: soonest };
}

// les articles en promotion de Zara en cours (hors vente flash), avec la date de fin la plus proche
export function activePromotions<T extends PromoFields>(products: T[], now: number = Date.now()): { items: T[]; endsAt: string | null } {
  const items = products.filter((p) => promoActive(p, now) && !flashActive(p, now) && shownOldPrice(p, now) !== null);
  const soonest = items.reduce<string | null>((best, p) => (best === null || ends(p.promo_ends_at) < ends(best) ? (p.promo_ends_at ?? null) : best), null);
  return { items, endsAt: soonest };
}

// quand il faut recalculer l'affichage : à la prochaine fin de vente flash ou de promotion (millisecondes depuis 1970), ou null
export function nextPromoChange(products: PromoFields[], now: number = Date.now()): number | null {
  let next: number | null = null;
  for (const p of products) {
    for (const t of [p.is_flash_sale ? ends(p.flash_sale_ends_at) : 0, ends(p.promo_ends_at)]) {
      if (t > now && (next === null || t < next)) next = t;
    }
  }
  return next;
}
