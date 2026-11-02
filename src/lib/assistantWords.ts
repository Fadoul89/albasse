// Les mots qui vendent, appris par Zara (docs/zara-mots-qui-vendent.md). Chaque mot est utilisé SEULEMENT quand ce qu'il dit est VRAI :
//   VOUS        : Zara parle toujours à la personne (« vous »), jamais à la masse.
//   GRATUIT     : le cadeau surprise offert à toute commande confirmée dans le chat de Zara (et seulement là). Il est dans le colis et écrit sur la facture.
//   PARCE QUE   : une vraie raison à chaque conseil.
//   SANS RISQUE : seulement les vraies assurances de la boutique (paiement à la livraison à N'Djamena ; retour sous 72 h d'un article incorrect ou défectueux).
//   EXCLUSIF    : le cadeau est réservé au chat (c'est vrai : il n'existe pas sur le site).
//   IMMÉDIAT    : la commande est enregistrée tout de suite et l'équipe la reçoit à l'instant.
//   COURTE DURÉE: seulement une vraie échéance (fin de la vente flash ou de la promotion, stock réellement bas, commande valable 48 h).
//   « X % des clients ont aussi acheté ceci » : un VRAI pourcentage tiré des vraies commandes (au moins 5 clients), sinon une vraie statistique de navigation.
//   « Finalisez votre commande » : le bouton et les rappels qui mènent à la confirmation.
// Aucun chiffre inventé, aucune fausse rareté, aucune fausse urgence : sans donnée solide, Zara ne dit rien.
// Des fonctions pures, sans réseau : testées dans tests/email/zara-words.test.ts.
import { ORDER_VALIDITY_HOURS } from '../constants/shopRules';
import { flashActive, promoActive, shownOldPrice, type PromoFields } from './promotions';

export type WordsLang = 'fr' | 'ar';

const FR = {
  finish: 'Finalisez votre commande',
  surpriseOffer:
    '🎁 Cadeau surprise offert : toute commande confirmée ici, dans le chat avec moi, reçoit un petit cadeau surprise dans son colis. Il sera écrit sur votre facture. (Offre réservée au chat.)',
  surpriseRecap: '🎁 Cadeau surprise offert (commande passée avec moi) : il sera dans votre colis et écrit sur votre facture',
  surprisePlaced: '🎁 Votre cadeau surprise sera dans votre colis (il est écrit sur votre facture).',
  surpriseInvoice: 'Cadeau surprise (Zara)',
  surpriseInvoiceValue: 'Offert',
  surpriseAdmin: '🎁 Cadeau surprise à mettre dans le colis (commande passée avec Zara)',
  surpriseClient: '🎁 Cadeau surprise offert dans votre colis (commande passée avec Zara)',
  confirmBecause: '⚡ Finalisez votre commande maintenant : elle est enregistrée tout de suite, et votre cadeau surprise 🎁 part avec elle.',
  received: '⚡ Notre équipe vient de recevoir votre commande.',
  riskFreeHome: '✅ Sans risque : à N’Djamena, vous payez seulement quand vous recevez votre commande.',
  riskFreeOther: '✅ Sans risque : si vous recevez un article incorrect ou défectueux, écrivez-nous dans les 72 heures après la réception (avec une photo ou une vidéo) : les frais de retour sont à notre charge.',
  validity: `⏳ Votre commande reste valable ${ORDER_VALIDITY_HOURS} heures : confirmez-la avant.`,
};

const AR = {
  finish: 'أكمل طلبك الآن',
  surpriseOffer:
    '🎁 هدية مفاجأة مجانية: كل طلب يتم تأكيده هنا، في المحادثة معي، يحصل على هدية مفاجأة صغيرة داخل الطرد. ستُكتب على فاتورتك. (العرض خاص بالمحادثة فقط.)',
  surpriseRecap: '🎁 هدية مفاجأة مجانية (طلب تم معي): ستكون داخل طردك ومكتوبة على فاتورتك',
  surprisePlaced: '🎁 هدية المفاجأة ستكون داخل طردك (ومكتوبة على فاتورتك).',
  confirmBecause: '⚡ أكمل طلبك الآن: يُسجَّل فوراً، وهدية المفاجأة 🎁 تُرسَل معه.',
  received: '⚡ تلقّى فريقنا طلبك للتو.',
  riskFreeHome: '✅ بدون مخاطرة: في إنجامينا تدفع فقط عندما تستلم طلبك.',
  riskFreeOther: '✅ بدون مخاطرة: إذا وصلك منتج خاطئ أو معيب، راسلنا خلال 72 ساعة من الاستلام (مع صورة أو فيديو): تكاليف الإرجاع علينا.',
  validity: `⏳ يبقى طلبك صالحاً ${ORDER_VALIDITY_HOURS} ساعة: أكّده قبل ذلك.`,
};

const pick = (lang: WordsLang) => (lang === 'ar' ? AR : FR);

// --- le cadeau surprise (commande passée DANS le chat de Zara) ---
// Une commande du chat note l'appareil du client (colonne assistant_device, add-assistant-stats.sql) : c'est ce qui la distingue d'une commande du site.
export const hasChatGift = (order: { assistant_device?: string | null } | null | undefined): boolean => !!order && typeof order.assistant_device === 'string' && order.assistant_device.trim() !== '';

export const giftOfferLine = (lang: WordsLang): string => pick(lang).surpriseOffer;
export const giftRecapLine = (lang: WordsLang): string => pick(lang).surpriseRecap;
export const giftPlacedLine = (lang: WordsLang): string => pick(lang).surprisePlaced;
export const finishLabel = (lang: WordsLang): string => pick(lang).finish;
export const confirmBecauseLine = (lang: WordsLang): string => pick(lang).confirmBecause;
export const receivedLine = (lang: WordsLang): string => pick(lang).received;
export const GIFT_INVOICE = { label: FR.surpriseInvoice, value: FR.surpriseInvoiceValue } as const;
export const GIFT_ADMIN_BADGE = FR.surpriseAdmin;
export const GIFT_CLIENT_LINE = FR.surpriseClient;

// --- sans risque : seulement les vraies assurances de la boutique (selon la ville) ---
export const riskFreeLine = (lang: WordsLang, home: boolean): string => (home ? pick(lang).riskFreeHome : pick(lang).riskFreeOther);

// --- courte durée : seulement une vraie échéance ---
export interface UrgencyInput {
  flashEndsAt?: string | null; // fin de la vente flash en cours
  promoEndsAt?: string | null; // fin de la promotion en cours
  now?: number;
}
const parseTime = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};
// La plus proche vraie échéance encore à venir (la vente flash dure 24 h, une promotion 7 jours), ou null.
export function nextRealDeadline(input: UrgencyInput): number | null {
  const now = input.now ?? Date.now();
  const times = [parseTime(input.flashEndsAt), parseTime(input.promoEndsAt)].filter((t) => t > now);
  return times.length === 0 ? null : Math.min(...times);
}
function clockLabel(at: number, now: number, lang: WordsLang): string {
  const hours = Math.max(1, Math.ceil((at - now) / 3_600_000));
  if (hours < 24) return lang === 'ar' ? `خلال ${hours} ساعة` : `dans ${hours} h`;
  const days = Math.ceil(hours / 24);
  return lang === 'ar' ? `خلال ${days} يوم` : `dans ${days} jour${days > 1 ? 's' : ''}`;
}
export function urgencyLine(input: UrgencyInput, lang: WordsLang): string | null {
  const now = input.now ?? Date.now();
  const at = nextRealDeadline(input);
  if (at === null) return null;
  const when = clockLabel(at, now, lang);
  return lang === 'ar' ? `⏳ هذا العرض ينتهي ${when}.` : `⏳ Ce prix se termine ${when}.`;
}
// L'échéance de l'article commandé : seulement pendant une VRAIE promotion (ancien prix montré, remise vraie) ; sinon rien.
export function productUrgencyLine(p: PromoFields | null | undefined, lang: WordsLang, now: number = Date.now()): string | null {
  if (!p || shownOldPrice(p, now) === null) return null;
  return urgencyLine({ flashEndsAt: flashActive(p, now) ? p.flash_sale_ends_at : null, promoEndsAt: promoActive(p, now) ? p.promo_ends_at : null, now }, lang);
}
export const validityLine = (lang: WordsLang): string => pick(lang).validity;

// --- « X % des clients ont aussi acheté ceci » : le VRAI pourcentage ---
export const MIN_BOUGHT_CUSTOMERS = 5; // en dessous de 5 clients, un pourcentage ne prouve rien : Zara ne le dit pas
export const MIN_BOUGHT_PCT = 20;
export const MIN_BOUGHT_TOGETHER = 2; // au moins 2 clients ont acheté les deux
export const MIN_VIEWERS = 20;
export const MIN_VIEWED_PCT = 30;
export const MIN_VIEWED_TOGETHER = 5;

export interface AffinityRow {
  productId: string;
  n: number;
}
export interface Affinity {
  customers: number; // clients qui ont acheté l'article
  boughtWith: AffinityRow[];
  viewers: number; // visiteurs qui ont regardé l'article (90 jours)
  viewedWith: AffinityRow[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const rows = (v: unknown): AffinityRow[] =>
  Array.isArray(v)
    ? v.flatMap((r) => (isObject(r) && typeof r.product_id === 'string' && r.product_id ? [{ productId: r.product_id, n: int(r.n) }] : []))
    : [];

// La réponse de la base (add-product-affinity.sql) : tout ce qui est douteux est ignoré ; illisible (script pas lancé) = null.
export function parseAffinity(raw: unknown): Affinity | null {
  if (!isObject(raw)) return null;
  return {
    customers: int(raw.customers),
    boughtWith: rows(raw.bought_with),
    viewers: int(raw.viewers),
    viewedWith: rows(raw.viewed_with),
  };
}

export interface AlsoPick {
  kind: 'bought' | 'viewed';
  pct: number; // entier, calculé ici à partir des vrais nombres (jamais lu tel quel)
  productId: string;
  n: number;
  total: number;
}
// Le pourcentage à annoncer, ou null. Les achats passent avant la navigation ; « nameOk » écarte les articles qui ne sont plus en vente.
export function pickAlsoBought(aff: Affinity | null | undefined, selfId: string, nameOk: (id: string) => boolean): AlsoPick | null {
  if (!aff) return null;
  const best = (list: AffinityRow[]) => list.filter((r) => r.productId !== selfId && r.n > 0 && nameOk(r.productId)).sort((a, b) => b.n - a.n)[0] ?? null;
  if (aff.customers >= MIN_BOUGHT_CUSTOMERS) {
    const r = best(aff.boughtWith);
    if (r && r.n >= MIN_BOUGHT_TOGETHER && r.n <= aff.customers) {
      const pct = Math.round((100 * r.n) / aff.customers);
      if (pct >= MIN_BOUGHT_PCT) return { kind: 'bought', pct, productId: r.productId, n: r.n, total: aff.customers };
    }
  }
  if (aff.viewers >= MIN_VIEWERS) {
    const r = best(aff.viewedWith);
    if (r && r.n >= MIN_VIEWED_TOGETHER && r.n <= aff.viewers) {
      const pct = Math.round((100 * r.n) / aff.viewers);
      if (pct >= MIN_VIEWED_PCT) return { kind: 'viewed', pct, productId: r.productId, n: r.n, total: aff.viewers };
    }
  }
  return null;
}
export function alsoLine(pick: AlsoPick, selfName: string, otherName: string, lang: WordsLang): string {
  if (lang === 'ar') {
    return pick.kind === 'bought'
      ? `👥 ${pick.pct}% من الزبائن الذين اشتروا «${selfName}» اشتروا أيضاً «${otherName}».`
      : `👀 ${pick.pct}% من الزوار الذين شاهدوا «${selfName}» شاهدوا أيضاً «${otherName}».`;
  }
  return pick.kind === 'bought'
    ? `👥 ${pick.pct} % des clients qui ont acheté « ${selfName} » ont aussi acheté « ${otherName} ».`
    : `👀 ${pick.pct} % des visiteurs qui ont regardé « ${selfName} » ont aussi regardé « ${otherName} ».`;
}
