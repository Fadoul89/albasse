// Zara Marketing Intelligence : le moteur des campagnes e-mail. Des fonctions pures, sans réseau ni base : testées dans tests/email/marketing.test.ts.
// Chaque jour, à partir des données réelles (articles, clients ayant donné leur accord, commandes livrées, favoris, historique d'envoi), le moteur
//   1. vérifie chaque article (actif, en stock, prix, lien, photo, remise réelle, vente flash réellement en cours) ;
//   2. écarte les clients sans autorisation, désinscrits, en suppression, ou déjà sollicités trop souvent ;
//   3. range chaque client dans UN segment pertinent (le premier qui lui convient, par priorité) ;
//   4. choisit des articles vérifiés, jamais déjà achetés ni montrés récemment, et rédige l'e-mail (objet et texte adaptés au segment, 3 variantes,
//      français ou arabe) ;
//   5. applique la limite du jour et rend un plan complet : qui, quel segment, quels articles, pourquoi les autres sont écartés.
// Rien n'est envoyé ici : l'envoi est décidé et verrouillé ailleurs (marketingRun.ts, drain.ts). Aucune remise, aucun prix ni aucune urgence ne sont
// inventés : un chiffre n'apparaît que s'il est vrai d'après la base.
import { LOYALTY_MIN_DELIVERED, SITE, button, escapeHtml, firstName, fmt, layout, mask, para, realEmail } from "./orderEmails.ts";

export const DAY_MS = 86_400_000;
export const NDJAMENA_MS = 3_600_000; // UTC+1, sans heure d'été

export type Lang = "fr" | "ar";
export type Variant = "A" | "B" | "C";
export type SegmentKey = "flash" | "wishlist" | "loyalty" | "winback" | "new_arrivals" | "inactive" | "nurture";
// ordre de priorité : un client reçoit la campagne du premier segment qui lui convient
export const SEGMENT_PRIORITY: SegmentKey[] = ["flash", "wishlist", "loyalty", "winback", "new_arrivals", "inactive", "nurture"];
export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  flash: "Vente flash",
  wishlist: "Articles favoris",
  loyalty: "Fidélité",
  winback: "Clients à reconquérir",
  new_arrivals: "Nouveautés",
  inactive: "Clients absents",
  nurture: "Nouveaux comptes",
};
// l'accord du client (réglages du profil) dont chaque segment a besoin
export type ConsentKind = "promotions" | "new_products" | "flash_sale";
export const SEGMENT_CONSENT: Record<SegmentKey, ConsentKind> = {
  flash: "flash_sale",
  wishlist: "promotions",
  loyalty: "promotions",
  winback: "promotions",
  new_arrivals: "new_products",
  inactive: "promotions",
  nurture: "promotions",
};

// ---------------------------------------------------------------------------------------------
// Réglages (modifiables par l'administrateur, toujours ramenés dans des limites sûres)
// ---------------------------------------------------------------------------------------------

export interface MarketingSettings {
  runHour: number; // heure du passage quotidien, à N'Djamena (0 à 23)
  dailyLimit: number; // e-mails de campagne mis en file par jour
  minDaysBetween: number; // jours minimum entre deux e-mails publicitaires à un même client
  maxPer30Days: number; // e-mails publicitaires maximum à un même client sur 30 jours
}
export const DEFAULT_SETTINGS: MarketingSettings = { runHour: 9, dailyLimit: 50, minDaysBetween: 7, maxPer30Days: 3 };
const RANGES = { runHour: [0, 23], dailyLimit: [1, 200], minDaysBetween: [1, 60], maxPer30Days: [1, 15] } as const;
export function clampSettings(s: Partial<Record<keyof MarketingSettings, unknown>>): MarketingSettings {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(RANGES) as (keyof MarketingSettings)[]) {
    const v = Math.round(Number(s[k]));
    if (Number.isFinite(v)) out[k] = Math.min(RANGES[k][1], Math.max(RANGES[k][0], v));
  }
  return out;
}

// règles du moteur (voir chaque usage)
export const MIN_DISCOUNT_PCT = 5; // en dessous, ce n'est pas une promotion
export const MAX_DISCOUNT_PCT = 60; // au-dessus, c'est très probablement une erreur de saisie (ancien prix trop haut) : la remise n'est pas annoncée
export const LOW_STOCK_MAX = 3; // « plus que N en stock » seulement quand il en reste 3 ou moins
export const MAX_PRODUCTS = 4;
export const MAX_PER_CATEGORY = 2;
export const REPEAT_LOOKBACK_SENDS = 3; // les articles des 3 derniers e-mails de campagne ne sont pas remontrés
export const REPEAT_LOOKBACK_DAYS = 60;
export const RECENT_ORDER_DAYS = 3; // pas d'e-mail publicitaire à un client qui vient de commander
export const NEW_ARRIVAL_DAYS = 14;
export const WINBACK_AFTER_DAYS = 30;
export const INACTIVE_AFTER_DAYS = 7;
export const NURTURE_MIN_AGE_DAYS = 2;
export const NURTURE_MAX_AGE_DAYS = 14;
export const LOYALTY_FROM_DELIVERED = 4;
export const FLASH_MIN_GAP_DAYS = 2; // une vente flash dure peu : elle peut suivre un autre e-mail après 2 jours

// ---------------------------------------------------------------------------------------------
// Données d'entrée
// ---------------------------------------------------------------------------------------------

export interface CatalogProduct {
  id: string;
  name: string;
  slug?: string | null;
  price: number | string;
  compare_at_price?: number | string | null;
  images?: string[] | null;
  is_flash_sale?: boolean | null;
  flash_sale_ends_at?: string | null;
  created_at?: string | null;
  category_id?: string | null;
  stock?: number | string | null;
  is_active?: boolean | null;
}
export interface Client {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: number;
  lastActiveAt: number;
  notifyPromotions: boolean;
  notifyNewProducts: boolean;
  notifyFlash: boolean;
  banned: boolean;
  isAdmin: boolean;
  unsubscribedAt: number | null;
  suppressedAt: number | null;
  token: string | null;
  lang?: Lang | null;
}
export interface ClientOrder {
  userId: string;
  status: string;
  createdAt: number;
  isFake: boolean;
  loyaltyDiscount: number;
  productIds: string[];
}
export interface Favorite {
  userId: string;
  productId: string;
}
export interface SentRecord {
  userId: string;
  kind: string; // 'marketing' | 'promo_inactive' | …
  status: string;
  createdAt: number;
  segment?: string | null;
  variant?: string | null;
  productIds?: string[] | null;
}
export interface Snapshot {
  now: number;
  products: CatalogProduct[];
  clients: Client[];
  orders: ClientOrder[];
  favorites: Favorite[];
  sent: SentRecord[];
}

// ---------------------------------------------------------------------------------------------
// 1. Vérification des articles
// ---------------------------------------------------------------------------------------------

export interface VerifiedProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  compareAt: number | null; // l'ancien prix, seulement si la remise est réelle (5 à 60 %)
  discountPct: number; // 0 s'il n'y a pas de remise réelle
  flashEndsAt: string | null; // seulement si la vente flash est réellement en cours
  lowStock: number | null; // seulement s'il en reste 3 ou moins
  categoryId: string | null;
  createdAt: number;
  stock: number;
}
export interface ProductVerdict {
  ok: boolean;
  reasons: string[]; // pourquoi l'article est écarté
  warnings: string[]; // ce qui est suspect dans la base sans écarter l'article
  product?: VerifiedProduct;
}

export function verifyProduct(p: CatalogProduct, now: number): ProductVerdict {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!p || p.is_active !== true) reasons.push("inactif");
  const stock = Number(p?.stock);
  if (!Number.isFinite(stock) || stock <= 0) reasons.push("stock");
  const price = Number(p?.price);
  if (!Number.isFinite(price) || price <= 0) reasons.push("prix");
  const name = String(p?.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) reasons.push("nom");
  const slug = typeof p?.slug === "string" ? p.slug.trim() : "";
  if (!slug || /[\s/\\?#]/.test(slug)) reasons.push("lien");
  const image = (p?.images ?? []).find((i) => typeof i === "string" && /^https:\/\/[^\s"<>]+$/i.test(i)) ?? "";
  if (!image) reasons.push("photo");
  if (reasons.length) return { ok: false, reasons, warnings };

  let compareAt: number | null = null;
  let discountPct = 0;
  if (p.compare_at_price != null && Number(p.compare_at_price) > 0) {
    const cmp = Number(p.compare_at_price);
    if (cmp <= price) warnings.push("ancien_prix_inutile");
    else {
      const pct = Math.round((1 - price / cmp) * 100);
      if (pct > MAX_DISCOUNT_PCT) warnings.push("remise_suspecte");
      else if (pct >= MIN_DISCOUNT_PCT) {
        compareAt = cmp;
        discountPct = pct;
      }
    }
  }
  let flashEndsAt: string | null = null;
  if (p.is_flash_sale === true) {
    const end = Date.parse(String(p.flash_sale_ends_at ?? ""));
    if (Number.isFinite(end) && end > now) flashEndsAt = new Date(end).toISOString();
    else warnings.push("flash_expiree");
  }
  return {
    ok: true,
    reasons,
    warnings,
    product: {
      id: p.id,
      name,
      slug,
      image,
      price,
      compareAt,
      discountPct,
      flashEndsAt,
      lowStock: stock <= LOW_STOCK_MAX ? stock : null,
      categoryId: p.category_id ?? null,
      createdAt: Date.parse(String(p.created_at ?? "")) || 0,
      stock,
    },
  };
}

export interface CatalogReport {
  total: number;
  verified: number;
  rejected: Record<string, number>;
  warnings: Record<string, number>;
  flagged: { name: string; warning: string }[]; // les premiers articles suspects, pour que l'administrateur les corrige
}
export function verifyCatalog(products: CatalogProduct[], now: number): { verified: VerifiedProduct[]; report: CatalogReport } {
  const verified: VerifiedProduct[] = [];
  const report: CatalogReport = { total: products.length, verified: 0, rejected: {}, warnings: {}, flagged: [] };
  for (const p of products) {
    const v = verifyProduct(p, now);
    for (const r of v.reasons) report.rejected[r] = (report.rejected[r] ?? 0) + 1;
    for (const w of v.warnings) {
      report.warnings[w] = (report.warnings[w] ?? 0) + 1;
      if (w !== "ancien_prix_inutile" && report.flagged.length < 10) report.flagged.push({ name: String(p.name ?? "").slice(0, 60), warning: w });
    }
    if (v.ok && v.product) verified.push(v.product);
  }
  report.verified = verified.length;
  return { verified, report };
}

// ---------------------------------------------------------------------------------------------
// 2. Clients : autorisation, désinscription, fréquence
// ---------------------------------------------------------------------------------------------

export const hasConsent = (c: Client, kind: ConsentKind) => (kind === "flash_sale" ? c.notifyFlash : kind === "new_products" ? c.notifyNewProducts : c.notifyPromotions) === true;

// raison d'exclure le client de TOUTE campagne (null = rien ne s'y oppose)
export function baseExclusion(c: Client): string | null {
  if (!realEmail(c.email)) return "sans_adresse_reelle";
  if (c.banned) return "compte_bloque";
  if (c.isAdmin) return "administrateur";
  if (c.unsubscribedAt) return "desinscrit";
  if (c.suppressedAt) return "adresse_en_suppression";
  return null;
}

const COUNTS_AS_MARKETING = (h: SentRecord) => (h.kind === "marketing" || h.kind === "promo_inactive") && ["pending", "sending", "sent"].includes(h.status);

export function frequencyExclusion(history: SentRecord[], orders: ClientOrder[], now: number, s: MarketingSettings, segment: SegmentKey): string | null {
  if (orders.some((o) => !o.isFake && o.status !== "cancelled" && now - o.createdAt < RECENT_ORDER_DAYS * DAY_MS)) return "commande_recente";
  const sent = history.filter(COUNTS_AS_MARKETING);
  const gap = segment === "flash" ? Math.min(s.minDaysBetween, FLASH_MIN_GAP_DAYS) : s.minDaysBetween;
  const last = sent.reduce((m, h) => Math.max(m, h.createdAt), 0);
  if (last && now - last < gap * DAY_MS) return "frequence_minimale";
  if (sent.filter((h) => now - h.createdAt < 30 * DAY_MS).length >= s.maxPer30Days) return "plafond_30_jours";
  return null;
}

const hasArabic = (t: string) => /[؀-ۿ]/.test(t);
// la langue n'est pas enregistrée dans les comptes : elle vient du profil e-mail si elle y est, sinon de l'écriture du nom, sinon le français
export const langOf = (c: Client): Lang => c.lang ?? (hasArabic(String(c.fullName ?? "")) ? "ar" : "fr");

// ---------------------------------------------------------------------------------------------
// 3. Segments et choix des articles
// ---------------------------------------------------------------------------------------------

interface Facts {
  client: Client;
  history: SentRecord[];
  orders: ClientOrder[];
  delivered: number;
  lastDeliveredAt: number | null;
  lastOrderAt: number | null;
  loyaltyUsed: boolean;
  bought: Set<string>;
  favorites: string[];
  affinity: Map<string, number>;
  shown: Set<string>; // articles déjà montrés dans les derniers e-mails de campagne
}
interface Ctx {
  verified: VerifiedProduct[];
  byId: Map<string, VerifiedProduct>;
  flash: VerifiedProduct[];
  newArrivals: VerifiedProduct[];
  likes: Map<string, number>;
  now: number;
}

const group = <T>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return m;
};

function buildFacts(client: Client, orders: ClientOrder[], favs: Favorite[], history: SentRecord[], categoryOf: Map<string, string | null>, now: number): Facts {
  const real = orders.filter((o) => !o.isFake && o.status !== "cancelled");
  const delivered = real.filter((o) => o.status === "delivered");
  const bought = new Set(real.flatMap((o) => o.productIds));
  const affinity = new Map<string, number>();
  const bump = (productId: string, w: number) => {
    const cat = categoryOf.get(productId);
    if (cat) affinity.set(cat, (affinity.get(cat) ?? 0) + w);
  };
  for (const id of bought) bump(id, 2);
  for (const f of favs) bump(f.productId, 1);
  const marketing = history
    .filter((h) => h.kind === "marketing" && now - h.createdAt < REPEAT_LOOKBACK_DAYS * DAY_MS)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, REPEAT_LOOKBACK_SENDS);
  return {
    client,
    history,
    orders,
    delivered: delivered.length,
    lastDeliveredAt: delivered.reduce<number | null>((m, o) => (m === null ? o.createdAt : Math.max(m, o.createdAt)), null),
    lastOrderAt: real.reduce<number | null>((m, o) => (m === null ? o.createdAt : Math.max(m, o.createdAt)), null),
    loyaltyUsed: orders.some((o) => o.status !== "cancelled" && o.loyaltyDiscount > 0),
    bought,
    favorites: favs.map((f) => f.productId),
    affinity,
    shown: new Set(marketing.flatMap((h) => h.productIds ?? [])),
  };
}

const newestFirst = (a: VerifiedProduct, b: VerifiedProduct) => b.createdAt - a.createdAt;
const isNew = (p: VerifiedProduct, now: number, days = NEW_ARRIVAL_DAYS) => p.createdAt > 0 && now - p.createdAt <= days * DAY_MS;

// jamais deux fois la même catégorie de plus de MAX_PER_CATEGORY articles (sauf s'il manque d'articles)
function diversify(sorted: VerifiedProduct[], min: number): VerifiedProduct[] {
  const out: VerifiedProduct[] = [];
  const perCat = new Map<string, number>();
  for (const p of sorted) {
    const cat = p.categoryId ?? "?";
    if ((perCat.get(cat) ?? 0) >= MAX_PER_CATEGORY) continue;
    perCat.set(cat, (perCat.get(cat) ?? 0) + 1);
    out.push(p);
    if (out.length === MAX_PRODUCTS) return out;
  }
  if (out.length < min) for (const p of sorted) if (!out.includes(p) && out.length < min) out.push(p);
  return out;
}

const fresh = (list: VerifiedProduct[], f: Facts) => list.filter((p) => !f.bought.has(p.id) && !f.shown.has(p.id));
const aff = (p: VerifiedProduct, f: Facts) => (p.categoryId ? f.affinity.get(p.categoryId) ?? 0 : 0);
const byScore = (list: VerifiedProduct[], score: (p: VerifiedProduct) => number) => [...list].sort((a, b) => score(b) - score(a) || newestFirst(a, b));

// les favoris du client qui méritent un rappel : en vente flash, en vraie promotion, ou presque épuisés
function wishlistPicks(f: Facts, c: Ctx): VerifiedProduct[] {
  const favs = f.favorites.map((id) => c.byId.get(id)).filter((p): p is VerifiedProduct => !!p && !f.bought.has(p.id) && !f.shown.has(p.id) && !!(p.flashEndsAt || p.discountPct > 0 || p.lowStock));
  return byScore(favs, (p) => (p.flashEndsAt ? 100 : 0) + p.discountPct + (p.lowStock ? 10 : 0));
}

const MIN_PRODUCTS: Record<SegmentKey, number> = { flash: 1, wishlist: 1, loyalty: 2, winback: 2, new_arrivals: 2, inactive: 2, nurture: 2 };

function segmentApplies(seg: SegmentKey, f: Facts, c: Ctx): boolean {
  const { now } = c;
  switch (seg) {
    case "flash":
      return c.flash.length > 0;
    case "wishlist":
      return wishlistPicks(f, c).length > 0;
    case "loyalty":
      return f.delivered >= LOYALTY_FROM_DELIVERED && !f.loyaltyUsed;
    case "winback":
      return f.lastDeliveredAt !== null && now - f.lastDeliveredAt > WINBACK_AFTER_DAYS * DAY_MS && (f.lastOrderAt ?? 0) <= f.lastDeliveredAt;
    case "new_arrivals":
      return c.newArrivals.length >= 3;
    case "inactive":
      return now - f.client.lastActiveAt >= INACTIVE_AFTER_DAYS * DAY_MS;
    case "nurture": {
      const age = now - f.client.createdAt;
      return age >= NURTURE_MIN_AGE_DAYS * DAY_MS && age <= NURTURE_MAX_AGE_DAYS * DAY_MS && f.orders.every((o) => o.status === "cancelled" || o.isFake);
    }
  }
}

export function pickForSegment(seg: SegmentKey, f: Facts, c: Ctx): VerifiedProduct[] {
  const min = MIN_PRODUCTS[seg];
  if (seg === "wishlist") {
    const favs = wishlistPicks(f, c).slice(0, 3);
    const cats = new Set(favs.map((p) => p.categoryId));
    const similar = byScore(fresh(c.verified, f).filter((p) => !favs.includes(p) && p.discountPct > 0 && cats.has(p.categoryId)), (p) => p.discountPct);
    return diversify([...favs, ...similar], min).slice(0, MAX_PRODUCTS);
  }
  const pool = fresh(seg === "flash" ? c.flash : seg === "new_arrivals" ? c.newArrivals : c.verified, f);
  let sorted: VerifiedProduct[];
  switch (seg) {
    case "flash":
      sorted = [...pool].sort((a, b) => aff(b, f) - aff(a, f) || Date.parse(a.flashEndsAt!) - Date.parse(b.flashEndsAt!) || b.discountPct - a.discountPct);
      break;
    case "inactive":
      sorted = byScore(pool, (p) => (p.flashEndsAt ? 100 : 0) + p.discountPct + (isNew(p, c.now) ? 10 : 0) + aff(p, f) * 5);
      break;
    case "winback":
      sorted = byScore(pool, (p) => aff(p, f) * 20 + (isNew(p, c.now, 30) ? 10 : 0) + p.discountPct * 0.3);
      break;
    case "loyalty":
      sorted = byScore(pool, (p) => aff(p, f) * 20 + p.discountPct * 0.5 + (isNew(p, c.now) ? 5 : 0));
      break;
    case "new_arrivals":
      sorted = byScore(pool, (p) => aff(p, f) * 5);
      sorted = [...sorted].sort((a, b) => newestFirst(a, b) || aff(b, f) - aff(a, f));
      break;
    default: // nurture : les articles les plus aimés des clients (nombre de favoris), puis les plus récents
      sorted = byScore(pool, (p) => (c.likes.get(p.id) ?? 0) * 2 + (isNew(p, c.now) ? 5 : 0) + p.discountPct * 0.2);
  }
  return diversify(sorted, min);
}

// ---------------------------------------------------------------------------------------------
// 4. Rédaction : objets, textes et variantes (français et arabe)
// ---------------------------------------------------------------------------------------------

export type WishFact = "flash" | "promo" | "low_stock";
export const wishFactOf = (p: VerifiedProduct): WishFact => (p.flashEndsAt ? "flash" : p.discountPct > 0 ? "promo" : "low_stock");

export interface EmailContext {
  name: string;
  date: string | null; // « 28 octobre » : fin de la vente flash
  n: number | null; // articles restants en stock (favori presque épuisé)
  orders: string; // « 2 commandes livrées » (fidélité)
  rewardReady: boolean;
  fact: WishFact | null;
}
interface Copy {
  subjects: string[];
  intros: string[];
  cta: string;
}

const ordersLabel = (lang: Lang, n: number) =>
  lang === "ar" ? (n === 1 ? "طلب واحد مُسلَّم" : n === 2 ? "طلبان مُسلَّمان" : `${n} طلبات مُسلَّمة`) : `${n} commande${n > 1 ? "s" : ""} livrée${n > 1 ? "s" : ""}`;

function copyFor(seg: SegmentKey, lang: Lang, x: EmailContext): Copy {
  const fr = lang === "fr";
  switch (seg) {
    case "flash":
      return fr
        ? {
            subjects: ["🔥 Vente flash jusqu'au {date}", "{name}, la vente flash est ouverte 🔥", "Vente flash chez Albasse Shopping : les offres du moment"],
            intros: ["Une vente flash est en cours sur Albasse Shopping, jusqu'au {date}. Voici une sélection pour vous :", "Les prix de la vente flash sont disponibles jusqu'au {date}. Voici de quoi profiter :", "La vente flash est ouverte jusqu'au {date}. Nous avons choisi ces articles pour vous :"],
            cta: "Voir la vente flash",
          }
        : {
            subjects: ["🔥 تخفيضات خاطفة حتى {date}", "{name}، التخفيضات الخاطفة بدأت 🔥", "تخفيضات خاطفة في Albasse Shopping"],
            intros: ["تخفيضات خاطفة جارية في Albasse Shopping حتى {date}. إليك مجموعة مختارة لك:", "أسعار التخفيضات الخاطفة متاحة حتى {date}. إليك ما يمكنك الاستفادة منه:", "التخفيضات الخاطفة مفتوحة حتى {date}. اخترنا لك هذه المنتجات:"],
            cta: "شاهد التخفيضات الخاطفة",
          };
    case "wishlist": {
      const f = x.fact ?? "promo";
      if (fr)
        return {
          subjects:
            f === "flash"
              ? ["♥ Un de vos favoris est en vente flash", "{name}, un article de vos favoris est en vente flash 🔥", "Vente flash sur un de vos favoris"]
              : f === "promo"
                ? ["♥ Un de vos favoris est en promotion", "{name}, un article que vous aimez est en promotion", "Promotion sur un de vos favoris"]
                : ["♥ Plus que {n} en stock pour un de vos favoris", "{name}, il reste peu d'un de vos favoris", "Stock limité sur un de vos favoris"],
          intros:
            f === "flash"
              ? ["Un article de vos favoris est en vente flash. Le voici, avec d'autres articles qui peuvent vous plaire :", "Vous aviez aimé cet article : il est en vente flash en ce moment.", "Bonne nouvelle pour vos favoris : une vente flash est en cours sur cet article."]
              : f === "promo"
                ? ["Un article de vos favoris est en promotion. Le voici, avec d'autres articles qui peuvent vous plaire :", "Vous aviez aimé cet article : son prix a baissé.", "Bonne nouvelle pour vos favoris : cet article est en promotion."]
                : ["Il ne reste que {n} exemplaire(s) d'un article de vos favoris :", "Vous aviez aimé cet article : il reste très peu de stock.", "Un de vos favoris est presque épuisé : voici ce qu'il en reste."],
          cta: "Voir mes favoris",
        };
      return {
        subjects:
          f === "flash"
            ? ["♥ أحد منتجاتك المفضلة في التخفيضات الخاطفة", "{name}، منتج من مفضلاتك في التخفيضات الخاطفة 🔥", "تخفيضات خاطفة على أحد منتجاتك المفضلة"]
            : f === "promo"
              ? ["♥ أحد منتجاتك المفضلة عليه تخفيض", "{name}، منتج تحبه عليه تخفيض", "تخفيض على أحد منتجاتك المفضلة"]
              : ["♥ بقي {n} فقط من أحد منتجاتك المفضلة", "{name}، الكمية قليلة من أحد منتجاتك المفضلة", "مخزون محدود لأحد منتجاتك المفضلة"],
        intros:
          f === "flash"
            ? ["أحد منتجاتك المفضلة في التخفيضات الخاطفة. إليك مع منتجات أخرى قد تعجبك:", "أعجبك هذا المنتج: وهو الآن في التخفيضات الخاطفة.", "خبر سار لمفضلاتك: تخفيضات خاطفة على هذا المنتج."]
            : f === "promo"
              ? ["أحد منتجاتك المفضلة عليه تخفيض. إليك مع منتجات أخرى قد تعجبك:", "أعجبك هذا المنتج: انخفض سعره.", "خبر سار لمفضلاتك: هذا المنتج عليه تخفيض."]
              : ["بقي {n} فقط من أحد منتجاتك المفضلة:", "أعجبك هذا المنتج: بقيت كمية قليلة جدا.", "أحد منتجاتك المفضلة على وشك النفاد: إليك ما تبقى."],
        cta: "شاهد مفضلاتي",
      };
    }
    case "loyalty":
      return fr
        ? x.rewardReady
          ? {
              subjects: ["🎁 Votre remise fidélité −10 % vous attend", "{name}, votre −10 % fidélité est disponible", "Merci pour votre fidélité : −10 % sur votre prochaine commande"],
              intros: ["Merci pour vos commandes ! Votre prochaine commande bénéficie de −10 % sur les articles (une seule fois).", "Vous avez 6 commandes livrées : votre prochaine commande a −10 % sur les articles.", "Votre fidélité est récompensée : −10 % sur les articles de votre prochaine commande."],
              cta: "Utiliser ma remise",
            }
          : {
              subjects: ["Plus que {orders} avant votre −10 %", "{name}, encore {orders} avant votre −10 %", "Votre remise fidélité −10 % se rapproche"],
              intros: ["Merci pour vos commandes ! Après 6 commandes livrées, votre commande suivante bénéficie de −10 % sur les articles (une seule fois). Il vous en manque {orders}.", "Plus que {orders} pour débloquer votre remise fidélité de −10 % sur les articles.", "Votre remise fidélité de −10 % approche : encore {orders}. En attendant, voici une sélection :"],
              cta: "Voir les articles",
            }
        : x.rewardReady
          ? {
              subjects: ["🎁 خصم الولاء 10٪ ينتظرك", "{name}، خصم الولاء 10٪ متاح لك", "شكرا على ولائك: خصم 10٪ على طلبك القادم"],
              intros: ["شكرا على طلباتك! طلبك القادم يستفيد من خصم 10٪ على المنتجات (مرة واحدة).", "لديك 6 طلبات مُسلَّمة: طلبك القادم عليه خصم 10٪ على المنتجات.", "ولاؤك يُكافأ: خصم 10٪ على منتجات طلبك القادم."],
              cta: "استعمل خصمي",
            }
          : {
              subjects: ["بقي {orders} قبل خصمك 10٪", "{name}، بقي {orders} لخصم الولاء", "خصم الولاء 10٪ يقترب"],
              intros: ["شكرا على طلباتك! بعد 6 طلبات مُسلَّمة يستفيد طلبك التالي من خصم 10٪ على المنتجات (مرة واحدة). بقي لك {orders}.", "بقي {orders} للحصول على خصم الولاء 10٪ على المنتجات.", "خصم الولاء 10٪ يقترب: بقي {orders}. وإلى ذلك الحين، إليك مجموعة مختارة:"],
              cta: "شاهد المنتجات",
            };
    case "winback":
      return fr
        ? { subjects: ["{name}, ça fait un moment 👋", "Une sélection pour vous revoir chez Albasse Shopping", "{name}, des articles qui peuvent vous plaire"], intros: ["Merci pour votre dernière commande. Voici une sélection d'articles qui peuvent vous plaire :", "Cela fait un moment ! Voici des articles que nous avons choisis pour vous :", "Nous avons pensé à vous : voici une sélection pour votre prochaine commande :"], cta: "Voir les articles" }
        : { subjects: ["{name}، اشتقنا إليك 👋", "مجموعة منتجات لك في Albasse Shopping", "{name}، منتجات قد تعجبك"], intros: ["شكرا على طلبك الأخير. إليك مجموعة منتجات قد تعجبك:", "مرّ وقت طويل! إليك منتجات اخترناها لك:", "فكّرنا فيك: إليك مجموعة لطلبك القادم:"], cta: "شاهد المنتجات" };
    case "new_arrivals":
      return fr
        ? { subjects: ["🆕 Nouveautés chez Albasse Shopping", "{name}, découvrez les derniers articles arrivés", "Les derniers arrivages Albasse Shopping"], intros: ["Ces articles viennent d'arriver sur Albasse Shopping :", "Voici les derniers articles ajoutés à la boutique :", "De nouveaux articles sont arrivés ces derniers jours :"], cta: "Voir les nouveautés" }
        : { subjects: ["🆕 جديدنا في Albasse Shopping", "{name}، اكتشف آخر المنتجات الواصلة", "آخر ما وصل إلى Albasse Shopping"], intros: ["وصلت هذه المنتجات للتو إلى Albasse Shopping:", "إليك آخر المنتجات المضافة إلى المتجر:", "وصلت منتجات جديدة في الأيام الأخيرة:"], cta: "شاهد الجديد" };
    case "inactive":
      return fr
        ? { subjects: ["{name}, les articles du moment vous attendent 🛍️", "Vous nous manquez, {name} !", "Une sélection d'articles pour vous, {name}"], intros: ["Voici une sélection d'articles du moment sur Albasse Shopping :", "Vous nous manquez ! Voici quelques articles à découvrir :", "Passez voir ce que nous avons choisi pour vous :"], cta: "Voir tous les articles" }
        : { subjects: ["{name}، منتجات اللحظة في انتظارك 🛍️", "اشتقنا إليك يا {name}!", "مجموعة منتجات لك يا {name}"], intros: ["إليك مجموعة من منتجات اللحظة في Albasse Shopping:", "اشتقنا إليك! إليك بعض المنتجات لتكتشفها:", "تفضّل بزيارة ما اخترناه لك:"], cta: "شاهد كل المنتجات" };
    default: // nurture
      return fr
        ? { subjects: ["{name}, voici de quoi bien commencer 🛍️", "Bienvenue dans la famille Albasse Shopping, {name}", "Votre sélection pour démarrer chez Albasse Shopping"], intros: ["Votre compte est prêt. Voici une sélection d'articles pour commencer :", "Pour bien démarrer, voici une sélection d'articles de la boutique :", "Bienvenue ! Voici quelques articles à découvrir :"], cta: "Découvrir la boutique" }
        : { subjects: ["{name}، إليك ما تبدأ به 🛍️", "مرحبا بك في عائلة Albasse Shopping يا {name}", "مجموعتك للبدء في Albasse Shopping"], intros: ["حسابك جاهز. إليك مجموعة منتجات للبداية:", "للبداية، إليك مجموعة منتجات من المتجر:", "مرحبا بك! إليك بعض المنتجات لتكتشفها:"], cta: "اكتشف المتجر" };
  }
}

// remplit {name}, {n}, {date}, {orders} ; sans prénom, « {name}, » disparaît proprement
function fill(tpl: string, x: EmailContext): string {
  let out = tpl;
  if (!x.name) out = out.replace(/\{name\}[,،]\s*/g, "").replace(/\s+يا\s+\{name\}/g, "").replace(/[,،]?\s*\{name\}/g, "");
  out = out.replace(/\{name\}/g, x.name).replace(/\{n\}/g, String(x.n ?? "")).replace(/\{date\}/g, x.date ?? "").replace(/\{orders\}/g, x.orders);
  return out.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

// l'un des trois objets (et le texte qui va avec), choisi pour ce client sans hasard : le même client et le même jour donnent toujours le même résultat
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const VARIANTS: Variant[] = ["A", "B", "C"];
export function pickVariant(userId: string, runDate: string, lastVariant?: string | null): Variant {
  let i = hash(`${userId}|${runDate}`) % 3;
  if (lastVariant && VARIANTS[i] === lastVariant) i = (i + 1) % 3; // jamais deux fois de suite le même objet à un client
  return VARIANTS[i];
}

const fmtDate = (iso: string, lang: Lang) => new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Ndjamena" }).format(new Date(iso));

export interface EmailInput {
  segment: SegmentKey;
  variant: Variant;
  lang: Lang;
  fullName: string | null;
  products: VerifiedProduct[];
  runDate: string; // « 2026-10-25 » (jour de N'Djamena)
  unsubscribeUrl: string;
  loyaltyDelivered?: number; // fidélité : commandes livrées du client
}

export const campaignTag = (runDate: string, segment: SegmentKey) => `zmi-${runDate.replace(/-/g, "")}-${segment}`;
// le suivi des commandes : la session du site garde utm_medium et utm_campaign ; le client qui commande après avoir cliqué est rattaché à la campagne
const utm = (input: Pick<EmailInput, "runDate" | "segment" | "variant">) => `utm_source=zara&utm_medium=email&utm_campaign=${campaignTag(input.runDate, input.segment)}&utm_content=${input.variant}`;
const productUrl = (p: VerifiedProduct, input: EmailInput) => `${SITE}/produit/${encodeURIComponent(p.slug)}?${utm(input)}`;

function productRow(p: VerifiedProduct, input: EmailInput): string {
  const ar = input.lang === "ar";
  const href = escapeHtml(productUrl(p, input));
  const badges: string[] = [];
  if (p.flashEndsAt) badges.push(`<span style="color:#c0262d;font-size:12px;font-weight:bold">${ar ? "🔥 تخفيضات خاطفة" : "🔥 Vente flash"}</span>`);
  if (p.lowStock) badges.push(`<span style="color:#8a5a00;font-size:12px;font-weight:bold">${ar ? `بقي ${p.lowStock} فقط` : `Plus que ${p.lowStock} en stock`}</span>`);
  const side = ar ? "right" : "left";
  return `<tr>
<td style="padding:10px 0;border-bottom:1px solid #eceef3;width:84px;vertical-align:top"><a href="${href}"><img src="${escapeHtml(p.image)}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:8px"></a></td>
<td style="padding:10px 8px;border-bottom:1px solid #eceef3;vertical-align:top;font-size:14px;line-height:20px;text-align:${side}"><a href="${href}" style="color:#1d2433;text-decoration:none;font-weight:bold">${escapeHtml(p.name)}</a><br><span style="font-size:15px;color:#062266;font-weight:bold">${fmt(p.price)}</span>${
    p.compareAt ? ` <span style="color:#6b7280;text-decoration:line-through;font-size:12px">${fmt(p.compareAt)}</span> <span style="color:#c0262d;font-size:12px;font-weight:bold">${ar ? `−${p.discountPct}٪` : `−${p.discountPct} %`}</span>` : ""
  }${badges.length ? `<br>${badges.join(" · ")}` : ""}</td></tr>`;
}

const CONSENT_LINE: Record<ConsentKind, Record<Lang, string>> = {
  promotions: { fr: "Vous recevez cet e-mail parce que vous avez accepté de recevoir nos promotions sur albasseshopping.com.", ar: "تتلقى هذه الرسالة لأنك وافقت على استقبال عروضنا على albasseshopping.com." },
  new_products: { fr: "Vous recevez cet e-mail parce que vous avez accepté les alertes de nouveaux articles sur albasseshopping.com.", ar: "تتلقى هذه الرسالة لأنك وافقت على تنبيهات المنتجات الجديدة على albasseshopping.com." },
  flash_sale: { fr: "Vous recevez cet e-mail parce que vous avez accepté les alertes de ventes flash sur albasseshopping.com.", ar: "تتلقى هذه الرسالة لأنك وافقت على تنبيهات التخفيضات الخاطفة على albasseshopping.com." },
};

// la ligne d'aperçu sous l'objet : une autre phrase du même segment que celle du texte, de 140 caractères au plus, coupée entre deux mots
const preheader = (text: string) => (text.length <= 140 ? text : `${text.slice(0, 137).replace(/\s+\S*$/, "")}…`);

export function renderEmail(input: EmailInput): { subject: string; html: string } {
  const lang = input.lang;
  const name = firstName(input.fullName);
  const first = input.products[0];
  const flashEnd = input.products.map((p) => p.flashEndsAt).filter((d): d is string => !!d).sort()[0] ?? null;
  const delivered = input.loyaltyDelivered ?? 0;
  const x: EmailContext = {
    name,
    date: flashEnd ? fmtDate(flashEnd, lang) : null,
    n: first?.lowStock ?? null,
    orders: ordersLabel(lang, Math.max(1, LOYALTY_MIN_DELIVERED - delivered)),
    rewardReady: delivered >= LOYALTY_MIN_DELIVERED,
    fact: input.segment === "wishlist" && first ? wishFactOf(first) : null,
  };
  const copy = copyFor(input.segment, lang, x);
  const i = VARIANTS.indexOf(input.variant);
  const subject = fill(copy.subjects[i], x);
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px">${input.products.map((p) => productRow(p, input)).join("")}</table>`;
  const ar = lang === "ar";
  const greeting = ar ? `مرحبا${name ? ` ${escapeHtml(name)}` : ""}،` : `Bonjour${name ? ` ${escapeHtml(name)}` : ""},`;
  const html = layout(
    subject,
    para(greeting) +
      para(escapeHtml(fill(copy.intros[i], x))) +
      table +
      button(`${SITE}/?${utm(input)}`, copy.cta) +
      para(ar ? "🚚 التوصيل إلى كل أنحاء تشاد 🇹🇩" : "🚚 Livraison partout au Tchad 🇹🇩"),
    CONSENT_LINE[SEGMENT_CONSENT[input.segment]][lang],
    `<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280">${ar ? "إلغاء الاشتراك من الرسائل الإعلانية" : "Me désinscrire des e-mails publicitaires"}</a>`,
    lang,
    preheader(`${fill(copy.intros[(i + 1) % 3], x)} ${ar ? "التوصيل إلى كل أنحاء تشاد." : "Livraison partout au Tchad."}`)
  );
  return { subject, html };
}

// ---------------------------------------------------------------------------------------------
// 5. Le plan du jour
// ---------------------------------------------------------------------------------------------

export interface PlanRecipient {
  userId: string;
  emailMasked: string;
  segment: SegmentKey;
  lang: Lang;
  variant: Variant;
  productIds: string[];
  productNames: string[];
  subject: string;
}
export interface SegmentSummary {
  key: SegmentKey;
  label: string;
  eligible: number; // clients qui conviennent à ce segment (avant la limite du jour)
  planned: number; // retenus pour aujourd'hui
}
export interface Issue {
  level: "blocking" | "warning" | "info";
  code: string;
  message: string;
}
export interface Preview {
  segment: SegmentKey;
  label: string;
  lang: Lang;
  variant: Variant;
  subject: string;
  html: string;
}
export interface Plan {
  runDate: string;
  generatedAt: number;
  settings: MarketingSettings;
  catalog: CatalogReport;
  clients: { total: number; eligible: number; excluded: Record<string, number> };
  segments: SegmentSummary[];
  recipients: PlanRecipient[];
  deferred: number; // retenus mais reportés à cause de la limite du jour
  issues: Issue[];
  previews: Preview[];
}

export const ndjamenaDate = (ms: number) => new Date(ms + NDJAMENA_MS).toISOString().slice(0, 10);
export const ndjamenaHour = (ms: number) => new Date(ms + NDJAMENA_MS).getUTCHours();
export const ndjamenaDayStart = (ms: number) => Math.floor((ms + NDJAMENA_MS) / DAY_MS) * DAY_MS - NDJAMENA_MS;

export function planDay(snap: Snapshot, settings: MarketingSettings, opts: { alreadyQueuedToday: number; runDate?: string }): Plan {
  const { now } = snap;
  const runDate = opts.runDate ?? ndjamenaDate(now);
  const { verified, report } = verifyCatalog(snap.products, now);
  const byId = new Map(verified.map((p) => [p.id, p]));
  const categoryOf = new Map(snap.products.map((p) => [p.id, p.category_id ?? null]));
  const likes = new Map<string, number>();
  for (const f of snap.favorites) likes.set(f.productId, (likes.get(f.productId) ?? 0) + 1);
  const ctx: Ctx = {
    verified,
    byId,
    flash: verified.filter((p) => p.flashEndsAt),
    newArrivals: verified.filter((p) => isNew(p, now)),
    likes,
    now,
  };

  const ordersBy = group(snap.orders, (o) => o.userId);
  const favsBy = group(snap.favorites, (f) => f.userId);
  const histBy = group(snap.sent, (h) => h.userId);

  const excluded: Record<string, number> = {};
  const skip = (why: string) => (excluded[why] = (excluded[why] ?? 0) + 1);
  const eligibleBySeg: Record<SegmentKey, number> = { flash: 0, wishlist: 0, loyalty: 0, winback: 0, new_arrivals: 0, inactive: 0, nurture: 0 };
  const candidates: (PlanRecipient & { rank: number; active: number })[] = [];
  let eligible = 0;

  for (const client of snap.clients) {
    const why = baseExclusion(client);
    if (why) {
      skip(why);
      continue;
    }
    const f = buildFacts(client, ordersBy.get(client.id) ?? [], favsBy.get(client.id) ?? [], histBy.get(client.id) ?? [], categoryOf, now);
    let chosen: SegmentKey | null = null;
    let blockedByConsent = false;
    for (const seg of SEGMENT_PRIORITY) {
      if (!segmentApplies(seg, f, ctx)) continue;
      if (!hasConsent(client, SEGMENT_CONSENT[seg])) {
        blockedByConsent = true;
        continue;
      }
      chosen = seg;
      break;
    }
    if (!chosen) {
      skip(blockedByConsent ? "autorisation_manquante" : "aucun_segment_pertinent");
      continue;
    }
    const freq = frequencyExclusion(f.history, f.orders, now, settings, chosen);
    if (freq) {
      skip(freq);
      continue;
    }
    const products = pickForSegment(chosen, f, ctx);
    if (products.length < MIN_PRODUCTS[chosen]) {
      skip("pas_assez_de_nouveaux_articles");
      continue;
    }
    eligible++;
    eligibleBySeg[chosen]++;
    const lastVariant = f.history.filter((h) => h.kind === "marketing").sort((a, b) => b.createdAt - a.createdAt)[0]?.variant ?? null;
    const variant = pickVariant(client.id, runDate, lastVariant);
    const lang = langOf(client);
    const subject = renderEmail({ segment: chosen, variant, lang, fullName: client.fullName, products, runDate, unsubscribeUrl: `${SITE}/desinscription?t=apercu`, loyaltyDelivered: f.delivered }).subject;
    candidates.push({
      userId: client.id,
      emailMasked: mask(String(client.email)),
      segment: chosen,
      lang,
      variant,
      productIds: products.map((p) => p.id),
      productNames: products.map((p) => p.name),
      subject,
      rank: SEGMENT_PRIORITY.indexOf(chosen),
      active: client.lastActiveAt,
    });
  }

  // limite du jour : par priorité de segment, puis les clients les plus récemment actifs
  candidates.sort((a, b) => a.rank - b.rank || b.active - a.active);
  const room = Math.max(0, settings.dailyLimit - opts.alreadyQueuedToday);
  const picked = candidates.slice(0, room);
  const recipients: PlanRecipient[] = picked.map(({ rank: _r, active: _a, ...r }) => r);
  const deferred = candidates.length - picked.length;

  // aperçus : un exemple par segment et par langue, avec un prénom d'exemple (aucune donnée d'un vrai client)
  const previews: Preview[] = [];
  const seen = new Set<string>();
  for (const r of picked) {
    const key = `${r.segment}|${r.lang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const products = r.productIds.map((id) => byId.get(id)).filter((p): p is VerifiedProduct => !!p);
    const e = renderEmail({ segment: r.segment, variant: r.variant, lang: r.lang, fullName: r.lang === "ar" ? "الاسم" : "Prénom", products, runDate, unsubscribeUrl: `${SITE}/desinscription?t=exemple`, loyaltyDelivered: r.segment === "loyalty" ? 4 : undefined });
    previews.push({ segment: r.segment, label: SEGMENT_LABELS[r.segment], lang: r.lang, variant: r.variant, subject: e.subject, html: e.html });
  }

  const issues: Issue[] = [];
  if (verified.length < 2) issues.push({ level: "blocking", code: "catalogue_insuffisant", message: `Seulement ${verified.length} article(s) vérifié(s) : il en faut au moins 2 pour écrire une campagne.` });
  if (report.warnings.remise_suspecte) issues.push({ level: "warning", code: "remises_suspectes", message: `${report.warnings.remise_suspecte} article(s) ont un ancien prix qui donnerait plus de ${MAX_DISCOUNT_PCT} % de remise : la remise n'est pas annoncée (à vérifier : ${report.flagged.filter((f) => f.warning === "remise_suspecte").slice(0, 3).map((f) => f.name).join(", ")}).` });
  if (report.warnings.flash_expiree) issues.push({ level: "warning", code: "flash_expiree", message: `${report.warnings.flash_expiree} article(s) sont marqués « vente flash » alors qu'elle est terminée : aucune urgence n'est annoncée pour eux.` });
  if (verified.length >= 10 && verified.filter((p) => p.discountPct > 0).length / verified.length >= 0.8)
    issues.push({ level: "warning", code: "presque_tout_en_promotion", message: "Presque tous les articles affichent un ancien prix barré : seules les remises vraies (5 à 60 %) sont annoncées, mais elles ne mettent aucune offre en avant. Gardez l'ancien prix seulement pour les vraies promotions." });
  if (recipients.length === 0) issues.push({ level: "info", code: "aucun_destinataire", message: "Aucun client ne correspond aujourd'hui (autorisations, fréquence ou segments)." });
  if (deferred > 0) issues.push({ level: "info", code: "limite_du_jour", message: `${deferred} client(s) retenus sont reportés : limite du jour de ${settings.dailyLimit} e-mails.` });
  if (!snap.clients.some((c) => c.lang)) issues.push({ level: "info", code: "langue_deduite", message: "La langue des clients n'est pas enregistrée : elle est déduite de l'écriture du nom (arabe ou français)." });

  return {
    runDate,
    generatedAt: now,
    settings,
    catalog: report,
    clients: { total: snap.clients.length, eligible, excluded },
    segments: SEGMENT_PRIORITY.map((key) => ({ key, label: SEGMENT_LABELS[key], eligible: eligibleBySeg[key], planned: recipients.filter((r) => r.segment === key).length })),
    recipients,
    deferred,
    issues,
    previews,
  };
}

// ---------------------------------------------------------------------------------------------
// 6. Au moment de l'envoi : tout est relu avec les données du moment
// ---------------------------------------------------------------------------------------------

export interface SendCheck {
  client: Client;
  segment: SegmentKey;
  variant: Variant;
  productIds: string[];
  products: CatalogProduct[]; // les articles tels qu'ils sont dans la base à l'instant de l'envoi
  runDate: string;
  now: number;
  unsubscribeUrl: string;
  loyaltyDelivered: number;
  loyaltyUsed: boolean;
}
// renvoie l'e-mail à envoyer, ou la raison de ne PAS l'envoyer (accord retiré, désinscription, article épuisé…)
export function prepareSend(i: SendCheck): { ok: true; subject: string; html: string; lang: Lang; kept: string[] } | { ok: false; reason: string } {
  const why = baseExclusion(i.client);
  if (why) return { ok: false, reason: why };
  if (!hasConsent(i.client, SEGMENT_CONSENT[i.segment])) return { ok: false, reason: "autorisation_retiree" };
  if (i.segment === "loyalty" && (i.loyaltyUsed || i.loyaltyDelivered < LOYALTY_FROM_DELIVERED)) return { ok: false, reason: "fidelite_plus_applicable" };
  // chaque article est revérifié (prix, stock, lien, remise, vente flash) ; ceux qui ne passent plus sont retirés
  const kept = i.productIds
    .map((id) => i.products.find((p) => p.id === id))
    .map((p) => (p ? verifyProduct(p, i.now) : null))
    .filter((v): v is ProductVerdict => !!v && v.ok && !!v.product)
    .map((v) => v.product!);
  if (kept.length < MIN_PRODUCTS[i.segment]) return { ok: false, reason: "articles_plus_valides" };
  // rappel d'un favori : seulement si CE favori (le premier) est encore valide et encore en vente flash, en promotion ou presque épuisé
  if (i.segment === "wishlist") {
    const fav = kept[0];
    if (!fav || fav.id !== i.productIds[0] || !(fav.flashEndsAt || fav.discountPct > 0 || fav.lowStock)) return { ok: false, reason: "favori_plus_concerne" };
  }
  const lang = langOf(i.client);
  const e = renderEmail({ segment: i.segment, variant: i.variant, lang, fullName: i.client.fullName, products: kept, runDate: i.runDate, unsubscribeUrl: i.unsubscribeUrl, loyaltyDelivered: i.loyaltyDelivered });
  return { ok: true, subject: e.subject, html: e.html, lang, kept: kept.map((p) => p.id) };
}

// ---------------------------------------------------------------------------------------------
// 7. Le verrou : aucun envoi réel tant que les contrôles ne sont pas faits
// ---------------------------------------------------------------------------------------------

export interface GateState {
  brevoOk: boolean | null;
  brevoCheckedAt: number | null;
  simulationAt: number | null;
  simulationBlocking: number | null;
  testEmailAt: number | null;
  testEmailMessageId: string | null;
}
export const GATE_BREVO_MAX_AGE_MS = DAY_MS; // le contrôle Brevo date de moins de 24 h
export const GATE_SIMULATION_MAX_AGE_MS = 2 * DAY_MS; // la simulation sans blocage date de moins de 48 h
export const GATE_TEST_MAX_AGE_MS = 30 * DAY_MS; // l'e-mail de test confirmé par Brevo date de moins de 30 jours
export function liveGate(g: GateState, now: number): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (g.brevoOk !== true || g.brevoCheckedAt === null || now - g.brevoCheckedAt > GATE_BREVO_MAX_AGE_MS) missing.push("controle_brevo");
  if (g.simulationAt === null || now - g.simulationAt > GATE_SIMULATION_MAX_AGE_MS || (g.simulationBlocking ?? 1) > 0) missing.push("simulation");
  if (g.testEmailAt === null || !g.testEmailMessageId || now - g.testEmailAt > GATE_TEST_MAX_AGE_MS) missing.push("email_de_test_confirme");
  return { ok: missing.length === 0, missing };
}
