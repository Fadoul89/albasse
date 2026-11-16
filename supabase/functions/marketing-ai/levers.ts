// Assistant marketing + psychologie de la vente (demande du patron, 16 novembre 2026) : règles pures, sans réseau ni base.
// Testées : tests/email/marketing-levers.test.ts. index.ts lit les faits dans la base et les passe ici.
// Règle du patron : un levier n'est proposé (et donné à l'IA) que s'il est VRAI pour l'article. Aucun chiffre inventé.

export const LEVERS = ["auto", "social", "loss", "urgency", "scarcity", "trend", "reciprocity"] as const;
export type Lever = (typeof LEVERS)[number];
export type RealLever = Exclude<Lever, "auto">;

// mêmes seuils que le site (src/lib/assistantViews.ts, src/lib/promotions.ts, src/lib/assistantSales.ts) : un test vérifie qu'ils sont égaux
export const MIN_VIEWS_PROOF = 50;
export const TREND_MAX_RANK = 10;
export const LOW_STOCK_MAX = 5;
export const MIN_REAL_DISCOUNT_PCT = 5;
export const MAX_REAL_DISCOUNT_PCT = 60;

// l'ordre de « Automatique » : d'abord ce qui fait agir (vraie échéance, vraie économie), puis les preuves, puis le cadeau
export const AUTO_ORDER: RealLever[] = ["urgency", "loss", "social", "scarcity", "trend", "reciprocity"];

export interface ProductRow {
  name: string;
  price: number | string;
  compare_at_price?: number | string | null;
  stock?: number | string | null;
  is_flash_sale?: boolean | null;
  flash_sale_ends_at?: string | null;
  promo_ends_at?: string | null;
}

export interface Facts {
  hasProduct: boolean;
  price: number | null;
  oldPrice: number | null; // seulement pendant une vraie promotion (vente flash ou promotion en cours, remise de 5 à 60 %)
  saving: number; // ancien prix - prix, sinon 0
  pct: number; // remise en %, sinon 0
  stock: number | null;
  endsAt: string | null; // fin de la vente flash ou de la promotion en cours
  views: number; // personnes qui ont regardé l'article ces 30 derniers jours (0 si moins de MIN_VIEWS_PROOF)
  rank: number | null; // place parmi les articles les plus regardés (1 = le plus regardé), seulement si views > 0 et rang <= TREND_MAX_RANK
  gift: boolean; // le cadeau surprise des commandes passées dans le chat de Zara (règle de la boutique)
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const future = (iso: string | null | undefined, now: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && t > now;
};

const isoOf = (v: string | null | undefined): string | null => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

// La remise vraie (5 à 60 %) en % entier, sinon null (comme realDiscountPct du site)
export function realDiscountPct(price: number, oldPrice: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(oldPrice) || price <= 0 || oldPrice <= price) return null;
  const exact = (1 - price / oldPrice) * 100;
  return exact >= MIN_REAL_DISCOUNT_PCT && exact <= MAX_REAL_DISCOUNT_PCT ? Math.round(exact) : null;
}

// views : la ligne de l'article dans assistant_product_views (ou 0) ; rank : sa place dans cette liste (1 = la plus regardée), ou null
export function computeFacts(p: ProductRow | null, views: number, rank: number | null, now: number = Date.now()): Facts {
  if (!p) return { hasProduct: false, price: null, oldPrice: null, saving: 0, pct: 0, stock: null, endsAt: null, views: 0, rank: null, gift: true };
  const price = num(p.price);
  const old = num(p.compare_at_price);
  const flash = p.is_flash_sale === true && future(p.flash_sale_ends_at, now);
  const promo = future(p.promo_ends_at, now);
  const pct = (flash || promo) && Number.isFinite(old) ? realDiscountPct(price, old) : null;
  const stock = num(p.stock);
  const seen = Number.isInteger(views) && views >= MIN_VIEWS_PROOF ? views : 0;
  return {
    hasProduct: true,
    price: Number.isFinite(price) && price > 0 ? price : null,
    oldPrice: pct === null ? null : old,
    saving: pct === null ? 0 : Math.round(old - price),
    pct: pct ?? 0,
    stock: Number.isFinite(stock) ? stock : null,
    // l'échéance ne compte que pour une vraie remise en cours
    // en format standard (« 2026-11-16 18:45:30+00 » de la base est mal lu par Safari sur iPhone)
    endsAt: pct === null ? null : isoOf(flash ? p.flash_sale_ends_at : p.promo_ends_at),
    views: seen,
    rank: seen > 0 && typeof rank === "number" && Number.isInteger(rank) && rank >= 1 && rank <= TREND_MAX_RANK ? rank : null,
    gift: true,
  };
}

export type Availability = { key: RealLever; available: boolean; reason?: "no_product" | "few_views" | "no_discount" | "no_deadline" | "stock_ok" | "not_top" };

export function leverAvailability(f: Facts): Availability[] {
  const need = (ok: boolean, reason: Availability["reason"]) => (ok ? { available: true } : { available: false, reason: f.hasProduct ? reason : "no_product" });
  return [
    { key: "social", ...need(f.views > 0, "few_views") },
    { key: "loss", ...need(f.saving > 0, "no_discount") },
    { key: "urgency", ...need(!!f.endsAt, "no_deadline") },
    { key: "scarcity", ...need(f.stock !== null && f.stock >= 1 && f.stock <= LOW_STOCK_MAX, "stock_ok") },
    { key: "trend", ...need(f.rank !== null, "not_top") },
    { key: "reciprocity", available: f.gift },
  ] as Availability[];
}

export const availableLevers = (f: Facts): RealLever[] => leverAvailability(f).filter((l) => l.available).map((l) => l.key);

// Les leviers des versions à écrire : « auto » = les 2 meilleurs leviers vrais ; un levier choisi doit être vrai, sinon null (refusé)
export function chooseLevers(f: Facts, lever: string): RealLever[] | null {
  const ok = availableLevers(f);
  if (lever === "auto" || lever === "") return AUTO_ORDER.filter((k) => ok.includes(k)).slice(0, 2);
  return (ok as string[]).includes(lever) ? [lever as RealLever] : null;
}

export const LEVER_NAMES: Record<RealLever, string> = {
  social: "Preuve sociale",
  loss: "Aversion à la perte",
  urgency: "Urgence",
  scarcity: "Rareté",
  trend: "Effet de mode",
  reciprocity: "Réciprocité",
};

const fcfa = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
const whenNdj = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Ndjamena" }).format(new Date(iso));
const topBucket = (rank: number) => (rank <= 3 ? 3 : rank <= 5 ? 5 : 10);

// Le fait VRAI que l'IA doit utiliser pour chaque levier (et rien d'autre)
export function leverFact(f: Facts, k: RealLever): string {
  switch (k) {
    case "social":
      return `${f.views} personnes ont regardé cet article ces 30 derniers jours sur le site (chiffre réel : écris exactement ce nombre, dis « regardé », jamais « acheté » ni « regardent en ce moment »)`;
    case "loss":
      return `prix ${fcfa(f.price ?? 0)} au lieu de ${fcfa(f.oldPrice ?? 0)} : le client économise ${fcfa(f.saving)} (${f.pct} %)`;
    case "urgency":
      return `cette remise se termine ${f.endsAt ? whenNdj(f.endsAt) : ""} (heure de N'Djamena) : c'est la seule échéance que tu peux citer`;
    case "scarcity":
      return f.stock === 1 ? "il n'en reste qu'un seul en stock" : `il n'en reste que ${f.stock} en stock`;
    case "trend":
      return `cet article fait partie des ${topBucket(f.rank ?? 10)} articles les plus regardés de la boutique ces 30 derniers jours`;
    case "reciprocity":
      return "une commande passée dans le chat avec Zara, l'assistante du site, reçoit un petit cadeau surprise dans le colis (offert ; ne promets aucune valeur ni aucun objet précis)";
  }
}

export const LEVERS_SYSTEM = `Psychologie de la vente : tu utilises des leviers, mais SEULEMENT avec les faits vrais donnés.
- Preuve sociale : le nombre réel de personnes qui ont regardé l'article (« regardé », jamais « acheté »).
- Aversion à la perte : ce que le client économise vraiment (« vous gardez X FCFA dans votre poche »).
- Urgence : seulement la vraie date de fin de la remise.
- Rareté : seulement le vrai stock restant.
- Effet de mode : l'article est parmi les plus regardés de la boutique.
- Réciprocité : le cadeau surprise offert pour une commande passée dans le chat avec Zara.
Interdits : un levier qui n'est pas dans la liste des leviers vrais ; « stock limité », « dernières pièces », « dernière chance », « offre limitée », « dépêchez-vous » sans le fait qui le prouve ; un chiffre qui n'est pas dans les faits.`;

// Ce que l'IA doit écrire : chaque version commence par « Version N · <levier> »
export function leverInstructions(f: Facts, levers: RealLever[]): string {
  if (levers.length === 0) return "Aucun levier psychologique vrai pour cet article : écris un texte simple et honnête, sans urgence ni rareté. Commence par « Version 1 · Sans levier ».";
  const facts = levers.map((k) => `- ${LEVER_NAMES[k]} : ${leverFact(f, k)}`).join("\n");
  const plan =
    levers.length === 1
      ? `Utilise le levier « ${LEVER_NAMES[levers[0]]} ». Commence chaque version par une ligne « Version N · ${LEVER_NAMES[levers[0]]} ».`
      : `Écris ${levers.length} versions, une par levier, dans cet ordre : ${levers.map((k, i) => `version ${i + 1} = ${LEVER_NAMES[k]}`).join(", ")}. Commence chaque version par une ligne « Version N · <nom du levier> ».`;
  return `Leviers vrais à utiliser (et leurs faits) :\n${facts}\n${plan}`;
}

// Contrôle du texte écrit par l'IA : ce qui ne colle pas aux faits (le texte est montré quand même, avec un avertissement à l'administrateur)
export function falseClaims(text: string, f: Facts): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  const hasUrgency = !!f.endsAt;
  const hasScarcity = f.stock !== null && f.stock >= 1 && f.stock <= LOW_STOCK_MAX;
  if (!hasScarcity && /stock limit|dernières pièces|derniers exemplaires|plus que \d+ en stock|presque épuisé|il n.en reste/.test(t)) out.push("rareté");
  if (!hasUrgency && /dernière chance|offre limitée|dépêchez|plus que \d+ ?h|se termine|ce soir seulement|aujourd.hui seulement|jusqu.à minuit/.test(t)) out.push("urgence");
  const people = [...t.matchAll(/(\d[\d\s\u00a0\u202f]*)\s*personnes/g)].map((m) => Number(m[1].replace(/\D/g, "")));
  if (people.some((n) => n !== f.views)) out.push("nombre de personnes");
  if (/personnes (l.ont |ont )?(acheté|commandé)|déjà vendu|clients satisfaits/.test(t)) out.push("achats");
  const fcfaNums = [...t.matchAll(/(\d[\d\s\u00a0\u202f]*)\s*fcfa/g)].map((m) => Number(m[1].replace(/\D/g, ""))).filter((n) => n > 0);
  const known = new Set([f.price, f.oldPrice, f.saving].filter((n): n is number => typeof n === "number" && n > 0).map((n) => Math.round(n)));
  if (f.hasProduct && fcfaNums.some((n) => !known.has(n))) out.push("prix");
  return out;
}
