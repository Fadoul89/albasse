// Zara Intelligence 360 : le Business Radar. Des fonctions pures, sans réseau ni base : testées dans tests/intel/radar.test.ts.
//
// À partir de chiffres déjà regroupés (visites, consultations, intentions de commander, commandes, recherches, articles), le radar repère
// des opportunités et les classe par priorité. Règles de ce fichier :
//  - un FAIT est un chiffre lu dans la base, avec sa source ; une HYPOTHÈSE est une explication possible, toujours écrite « Hypothèse : … »
//    et jamais présentée comme établie. `causeEstablished` est toujours faux : le radar ne prétend jamais connaître la cause d'une baisse ;
//  - rien n'est conclu sans assez de données : chaque détecteur a un minimum, et la confiance (0 à 1) dépend de la taille de l'échantillon ;
//  - l'« impact » est un score de 0 à 100 expliqué (une estimation d'importance), jamais un montant promis ;
//  - le radar ne fait rien : il PROPOSE des actions (type + paramètres) que le moteur d'actions (actions.ts) acceptera ou non.
//
// « Intentions de commander » = les événements du bouton « Commander » (table cart_events, nom conservé de l'ancien panier). Ce n'est pas une
// commande : tant que la table des commandes est vide ou presque, le radar le dit (dq:no_orders) au lieu d'annoncer un taux de conversion.

export type Pair = readonly [number, number]; // [période actuelle, période précédente de même durée]
export type Cost = "none" | "low" | "medium" | "high";
export type FindingRisk = "low" | "medium" | "high";
export type FindingType = "data_quality" | "traffic_change" | "search_no_result" | "category_low_intent" | "popular_products" | "rising_products" | "stock_risk" | "unavailable_demand" | "marketing_ready";

export interface RadarProduct {
  id: string;
  name: string;
  categoryId: string | null;
  active: boolean;
  stock: number;
  price: number;
  likes: number;
  createdAt: number;
  views: Pair;
  intents: Pair;
  orders: Pair;
  favorites: Pair;
}
export interface RadarCategory {
  id: string;
  name: string;
}
export interface MarketingFacts {
  accounts: number;
  consentPromotions: number;
  flashActive: number; // articles en vente flash réellement en cours
  newArrivals14d: number;
}
export interface RadarInput {
  now: number;
  windowDays: number; // 7 ou 30 : durée de chaque période comparée
  traffic: { sessions: Pair; views: Pair; intents: Pair; orders: Pair; searches: Pair };
  ordersEver: number; // commandes réelles enregistrées depuis le début
  products: RadarProduct[];
  categories: RadarCategory[];
  searchTerms: { q: string; count: number }[]; // recherches de la période actuelle, regroupées
  marketing?: MarketingFacts;
}

export interface Fact {
  label: string;
  value: string;
  source: string; // table ou calcul d'où vient le chiffre
}
export interface ProposedAction {
  type: string;
  params: Record<string, string | number>;
  label: string;
}
export interface Finding {
  key: string; // stable d'un jour à l'autre : sert à ne pas répéter la même alerte
  type: FindingType;
  title: string;
  facts: Fact[];
  hypotheses: string[]; // toutes commencent par « Hypothèse »
  causeEstablished: false;
  impact: number; // 0 à 100
  impactNote: string;
  confidence: number; // 0 à 1
  cost: Cost;
  risk: FindingRisk;
  priority: number;
  proposed: ProposedAction[];
}
export interface Kpi {
  key: "sessions" | "views" | "intents" | "orders" | "searches";
  label: string;
  cur: number;
  prev: number;
  deltaPct: number | null; // null : pas de base de comparaison (période précédente trop petite)
  enough: boolean;
}
export interface RadarReport {
  windowDays: number;
  generatedAt: number;
  kpis: Kpi[];
  findings: Finding[];
}

// ---------------------------------------------------------------------------------------------
// Réglages des détecteurs (en un seul endroit, pour être relus)
// ---------------------------------------------------------------------------------------------

export const MIN_CHANGE_PCT = 15; // en dessous, une variation n'est pas signalée
export const MIN_BASE: Record<Kpi["key"], number> = { sessions: 100, views: 200, intents: 20, orders: 5, searches: 20 }; // période précédente minimum pour comparer
const KPI_LABELS: Record<Kpi["key"], string> = { sessions: "Visites", views: "Consultations d'articles", intents: "Intentions de commander", orders: "Commandes", searches: "Recherches" };
const KPI_WEIGHT: Record<Kpi["key"], number> = { sessions: 0.5, views: 0.5, intents: 0.8, orders: 1, searches: 0.3 };
const KPI_SOURCE: Record<Kpi["key"], string> = { sessions: "visitor_sessions", views: "product_views", intents: "cart_events", orders: "orders", searches: "browsing_searches" };
export const MIN_SEARCH_COUNT = 2; // une recherche faite au moins 2 fois
export const MAX_PER_TYPE = 5;
export const RISK_FACTOR: Record<FindingRisk, number> = { low: 1, medium: 0.7, high: 0.4 };
export const COST_FACTOR: Record<Cost, number> = { none: 1, low: 1.2, medium: 1.8, high: 3 };
// minimums d'un détecteur, proportionnels à la durée de la période (référence : 30 jours)
const scaled = (base: number, windowDays: number, floor: number) => Math.max(floor, Math.round((base * windowDays) / 30));

// ---------------------------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------------------------

export const confidence = (n: number, k: number) => Math.round((Math.max(0, n) / (Math.max(0, n) + k)) * 100) / 100;
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
const fmtPct = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toString().replace(".", ",")} %`;
const fmtN = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
const period = (d: number) => `${d} jours`;
const hyp = (text: string) => `Hypothèse : ${text}`;
const ndjamenaDate = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
const cleanText = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function prioritize(f: Omit<Finding, "priority" | "causeEstablished">): Finding {
  return { ...f, causeEstablished: false, priority: Math.round(((f.impact * f.confidence * RISK_FACTOR[f.risk]) / COST_FACTOR[f.cost]) * 10) / 10 };
}

// ---------------------------------------------------------------------------------------------
// Le texte des recherches : ce que le catalogue sait trouver (règle simplifiée, signalée comme estimation)
// ---------------------------------------------------------------------------------------------

const STOP = new Set(["pour", "avec", "sans", "les", "des", "une", "aux", "sur", "dans", "chez", "the", "and"]);
// minuscules, sans accents ; arabe : sans voyelles brèves, alef/ya/ta marbuta unifiés
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}
const isArabic = (t: string) => /[؀-ۿ]/.test(t);
// arabe : l'article « ال » au début est retiré (« العطر » et « عطر » sont le même mot)
const stemArabic = (t: string) => (isArabic(t) && t.length > 3 && t.startsWith("ال") ? t.slice(2) : t);
export function tokens(s: string): string[] {
  return (foldText(s).match(/[\p{L}\p{N}]+/gu) ?? []).map(stemArabic).filter((t) => !STOP.has(t) && (isArabic(t) ? t.length >= 2 : t.length >= 3));
}
export function buildCatalogIndex(products: readonly RadarProduct[], categories: readonly RadarCategory[]): Set<string> {
  const words = new Set<string>();
  for (const p of products) if (p.active) for (const t of tokens(p.name)) words.add(t);
  for (const c of categories) for (const t of tokens(c.name)) words.add(t);
  return words;
}
// vrai : au moins un mot de la recherche commence comme un mot du catalogue (ou l'inverse) ; null : rien à évaluer (mots trop courts)
export function hasCatalogMatch(term: string, index: ReadonlySet<string>): boolean | null {
  const ts = tokens(term);
  if (ts.length === 0) return null;
  for (const t of ts) for (const w of index) if (w.startsWith(t) || t.startsWith(w)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// Les indicateurs comparés
// ---------------------------------------------------------------------------------------------

export function buildKpis(input: RadarInput): Kpi[] {
  return (Object.keys(KPI_LABELS) as Kpi["key"][]).map((key) => {
    const [cur, prev] = input.traffic[key];
    const enough = prev >= MIN_BASE[key];
    return { key, label: KPI_LABELS[key], cur, prev, deltaPct: enough ? pctChange(cur, prev) : null, enough };
  });
}

// ---------------------------------------------------------------------------------------------
// Les détecteurs
// ---------------------------------------------------------------------------------------------

function dataQuality(input: RadarInput): Finding[] {
  const out: Finding[] = [];
  const w = input.windowDays;
  const [intents] = input.traffic.intents;
  const [sessions] = input.traffic.sessions;
  const [orders] = input.traffic.orders;
  if (input.ordersEver === 0) {
    out.push(
      prioritize({
        key: `dq:no_orders:w${w}`,
        type: "data_quality",
        title: "Aucune commande enregistrée : les conversions ne peuvent pas être mesurées",
        facts: [
          { label: "Commandes enregistrées depuis le début", value: "0", source: "orders" },
          { label: `Intentions de commander (${period(w)})`, value: fmtN(intents), source: "cart_events" },
          { label: `Visites (${period(w)})`, value: fmtN(sessions), source: "visitor_sessions" },
        ],
        hypotheses: [hyp("les commandes passent peut-être par WhatsApp ou par téléphone, hors du site (à confirmer par l'administrateur)."), hyp("d'anciennes commandes de test ont pu être effacées.")],
        impact: 60,
        impactNote: "Sans commandes dans la base, ni le taux de conversion ni l'apprentissage des campagnes ne peuvent être mesurés.",
        confidence: 1,
        cost: "none",
        risk: "low",
        proposed: [],
      })
    );
  } else if (orders < 5 && sessions >= 500) {
    out.push(
      prioritize({
        key: `dq:few_orders:w${w}`,
        type: "data_quality",
        title: "Très peu de commandes : les comparaisons de ventes sont peu fiables",
        facts: [
          { label: `Commandes réelles (${period(w)})`, value: fmtN(orders), source: "orders" },
          { label: `Visites (${period(w)})`, value: fmtN(sessions), source: "visitor_sessions" },
        ],
        hypotheses: [hyp("une partie des commandes est peut-être prise hors du site (WhatsApp, téléphone).")],
        impact: 35,
        impactNote: "Les écarts de ventes sur de si petits nombres peuvent être du hasard.",
        confidence: 0.9,
        cost: "none",
        risk: "low",
        proposed: [],
      })
    );
  }
  return out;
}

const WATCH: Record<Kpi["key"], string[]> = {
  sessions: ["l'origine des visites (réseaux sociaux, publicité, WhatsApp)", "une panne ou une lenteur du site sur la période", "les jours fériés ou fêtes"],
  views: ["les articles mis en avant sur l'accueil", "les nouveautés ajoutées", "la qualité des photos"],
  intents: ["le prix et le stock des articles les plus regardés", "le bouton « Commander » sur téléphone", "les moyens de paiement proposés"],
  orders: ["le suivi des commandes (livraison, paiement)", "les ruptures de stock", "les commandes prises hors du site"],
  searches: ["la visibilité de la barre de recherche"],
};

function trafficChange(input: RadarInput): Finding[] {
  const out: Finding[] = [];
  const w = input.windowDays;
  for (const k of buildKpis(input)) {
    if (!k.enough || k.deltaPct === null || Math.abs(k.deltaPct) < MIN_CHANGE_PCT) continue;
    const down = k.deltaPct < 0;
    out.push(
      prioritize({
        key: `traffic:${k.key}:w${w}`,
        type: "traffic_change",
        title: `${k.label} : ${fmtPct(k.deltaPct)} sur ${period(w)}`,
        facts: [
          { label: `${k.label} (${period(w)} récents)`, value: fmtN(k.cur), source: KPI_SOURCE[k.key] },
          { label: `${k.label} (${period(w)} d'avant)`, value: fmtN(k.prev), source: KPI_SOURCE[k.key] },
          { label: "Variation", value: fmtPct(k.deltaPct), source: "calcul" },
        ],
        hypotheses: [hyp(`aucune cause n'est établie par les données disponibles. Pistes à vérifier, sans rien confirmer : ${WATCH[k.key].join(" ; ")}.`)],
        impact: Math.round(clamp(Math.abs(k.deltaPct) * KPI_WEIGHT[k.key] * (down ? 1.5 : 1), 0, down ? 100 : 60)),
        impactNote: down ? "Une baisse est plus urgente qu'une hausse : l'impact est pondéré par l'importance de l'indicateur." : "Une hausse est une occasion de comprendre ce qui marche.",
        confidence: confidence(k.cur + k.prev, 200),
        cost: "none",
        risk: "low",
        proposed: [],
      })
    );
  }
  return out;
}

function searchNoResult(input: RadarInput): Finding[] {
  const index = buildCatalogIndex(input.products, input.categories);
  const merged = new Map<string, { q: string; count: number }>();
  for (const t of input.searchTerms) {
    const q = cleanText(t.q, 60);
    if (q.length < 2 || !(t.count > 0)) continue;
    const k = foldText(q);
    const prev = merged.get(k);
    merged.set(k, { q: prev?.q ?? q, count: (prev?.count ?? 0) + t.count });
  }
  const missing = [...merged.values()].filter((t) => t.count >= MIN_SEARCH_COUNT && hasCatalogMatch(t.q, index) === false).sort((a, b) => b.count - a.count || a.q.localeCompare(b.q)).slice(0, MAX_PER_TYPE);
  return missing.map((t) =>
    prioritize({
      key: `search:${foldText(t.q).replace(/\s+/g, "-")}:w${input.windowDays}`,
      type: "search_no_result",
      title: `« ${t.q} » est cherché ${t.count} fois et ne correspond à aucun article`,
      facts: [
        { label: `Recherches de « ${t.q} » (${period(input.windowDays)})`, value: fmtN(t.count), source: "browsing_searches" },
        { label: "Articles du catalogue qui correspondent", value: "aucun (estimation avec une règle simplifiée : un mot en commun avec un nom d'article ou de catégorie)", source: "products, categories" },
      ],
      hypotheses: [hyp("des clients cherchent un article que la boutique n'a pas, ou l'écrivent autrement (orthographe, langue, marque).")],
      impact: Math.round(clamp(t.count * 8 + 10)),
      impactNote: "Plus un mot est cherché, plus l'occasion manquée est probable ; le nombre de recherches reste petit.",
      confidence: confidence(t.count, 6),
      cost: "low",
      risk: "low",
      proposed: [{ type: "catalog.suggest_item", params: { term: t.q }, label: `Étudier l'ajout d'un article « ${t.q} »` }],
    })
  );
}

function categoryLowIntent(input: RadarInput): Finding[] {
  const minViews = scaled(100, input.windowDays, 30);
  const byCat = new Map<string, { views: number; viewsPrev: number; intents: number; orders: number; products: number }>();
  for (const p of input.products) {
    if (!p.categoryId) continue;
    const c = byCat.get(p.categoryId) ?? { views: 0, viewsPrev: 0, intents: 0, orders: 0, products: 0 };
    c.views += p.views[0];
    c.viewsPrev += p.views[1];
    c.intents += p.intents[0];
    c.orders += p.orders[0];
    if (p.active) c.products++;
    byCat.set(p.categoryId, c);
  }
  const eligible = [...byCat.entries()].filter(([, c]) => c.views >= minViews);
  const totalViews = eligible.reduce((s, [, c]) => s + c.views, 0);
  const totalIntents = eligible.reduce((s, [, c]) => s + c.intents, 0);
  if (eligible.length < 2 || totalIntents < 10 || totalViews === 0) return [];
  const shopRate = totalIntents / totalViews;
  const names = new Map(input.categories.map((c) => [c.id, c.name]));
  const orderData = input.ordersEver > 0 && input.traffic.orders[0] >= 5;
  return eligible
    .map(([id, c]) => ({ id, c, rate: c.intents / c.views }))
    .filter((x) => x.rate < shopRate * 0.5)
    .sort((a, b) => b.c.views - a.c.views)
    .slice(0, MAX_PER_TYPE)
    .map(({ id, c, rate }) => {
      const name = cleanText(names.get(id) ?? "Catégorie", 60);
      const share = c.views / totalViews;
      return prioritize({
        key: `category:${id}:w${input.windowDays}`,
        type: "category_low_intent",
        title: `« ${name} » : très regardée, peu d'intentions de commander`,
        facts: [
          { label: `Consultations de « ${name} » (${period(input.windowDays)})`, value: `${fmtN(c.views)} (${Math.round(share * 100)} % des consultations des catégories comparées)`, source: "product_views" },
          { label: "Intentions de commander", value: `${fmtN(c.intents)} (${(rate * 100).toFixed(1).replace(".", ",")} % des consultations)`, source: "cart_events" },
          { label: "Moyenne des autres catégories", value: `${(shopRate * 100).toFixed(1).replace(".", ",")} % des consultations`, source: "calcul" },
          { label: "Articles actifs dans la catégorie", value: fmtN(c.products), source: "products" },
          ...(orderData ? [{ label: "Commandes de la catégorie", value: fmtN(c.orders), source: "orders" }] : []),
        ],
        hypotheses: [hyp("les prix, les photos, la description, le stock ou le choix proposé sont à revoir — rien ne le confirme."), hyp("les clients regardent peut-être pour comparer ou pour se renseigner avant de commander ailleurs.")],
        impact: Math.round(clamp(share * 100 * 1.2 * (1 - rate / shopRate))),
        impactNote: "Plus la catégorie pèse dans les consultations et plus son taux est loin de la moyenne, plus l'écart compte.",
        confidence: Math.round(confidence(c.views, 150) * 0.8 * 100) / 100,
        cost: "medium",
        risk: "low",
        proposed: [{ type: "catalog.review_category", params: { category_id: id }, label: `Revoir la catégorie « ${name} »` }],
      });
    });
}

function popularProducts(input: RadarInput): Finding[] {
  const minViews = scaled(30, input.windowDays, 10);
  const totalViews = input.traffic.views[0];
  const top = input.products.filter((p) => p.active && p.stock > 0 && p.views[0] >= minViews).sort((a, b) => b.views[0] - a.views[0] || a.name.localeCompare(b.name)).slice(0, MAX_PER_TYPE);
  if (top.length === 0) return [];
  const share = totalViews > 0 ? top.reduce((s, p) => s + p.views[0], 0) / totalViews : 0;
  return [
    prioritize({
      key: `popular:top:w${input.windowDays}`,
      type: "popular_products",
      title: `Les ${top.length} articles les plus regardés (${period(input.windowDays)})`,
      facts: top.map((p) => ({ label: cleanText(p.name, 60), value: `${fmtN(p.views[0])} consultations (avant : ${fmtN(p.views[1])}), ${fmtN(p.favorites[0])} favoris, stock ${fmtN(p.stock)}`, source: "product_views, favorites, products" })),
      hypotheses: [hyp("mettre ces articles en avant (campagne, notification) pourrait augmenter les visites — effet non mesuré tant qu'aucune campagne n'a été envoyée.")],
      impact: Math.round(clamp(30 + share * 100)),
      impactNote: "L'impact croît avec la part des consultations que ces articles concentrent.",
      confidence: confidence(top.reduce((s, p) => s + p.views[0], 0), 100),
      cost: "low",
      risk: "low",
      proposed: [{ type: "marketing.prepare_campaign", params: { date: ndjamenaDate(input.now) }, label: "Préparer la campagne du jour (simulation)" }],
    }),
  ];
}

function risingProducts(input: RadarInput): Finding[] {
  const minViews = scaled(30, input.windowDays, 10);
  const rising = input.products
    .filter((p) => p.active && p.stock > 0 && p.views[0] >= minViews && p.views[1] >= 5 && p.views[0] >= p.views[1] * 1.5)
    .sort((a, b) => b.views[0] / b.views[1] - a.views[0] / a.views[1] || b.views[0] - a.views[0])
    .slice(0, 3);
  if (rising.length === 0) return [];
  return [
    prioritize({
      key: `rising:top:w${input.windowDays}`,
      type: "rising_products",
      title: `${rising.length} article(s) dont les consultations montent fortement`,
      facts: rising.map((p) => ({ label: cleanText(p.name, 60), value: `${fmtN(p.views[0])} consultations (avant : ${fmtN(p.views[1])}, ${fmtPct(pctChange(p.views[0], p.views[1]) ?? 0)}), stock ${fmtN(p.stock)}`, source: "product_views, products" })),
      hypotheses: [hyp("l'intérêt pourrait venir d'un partage, d'une publicité ou d'une fête proche — non vérifié.")],
      impact: Math.round(clamp(25 + rising.reduce((s, p) => s + p.views[0], 0) / 5)),
      impactNote: "Un article en hausse peut manquer de stock si la demande continue.",
      confidence: confidence(rising.reduce((s, p) => s + p.views[0], 0), 80),
      cost: "none",
      risk: "low",
      proposed: [],
    }),
  ];
}

function stockRisk(input: RadarInput): Finding[] {
  const minViews = scaled(15, input.windowDays, 8);
  const out: Finding[] = [];
  const low = input.products.filter((p) => p.active && p.stock > 0 && p.stock <= 3 && p.views[0] >= minViews).sort((a, b) => b.views[0] - a.views[0] || a.name.localeCompare(b.name)).slice(0, MAX_PER_TYPE);
  for (const p of low) {
    out.push(
      prioritize({
        key: `stock:low:${p.id}:w${input.windowDays}`,
        type: "stock_risk",
        title: `« ${cleanText(p.name, 60)} » : plus que ${p.stock} en stock et très regardé`,
        facts: [
          { label: "Stock actuel", value: fmtN(p.stock), source: "products" },
          { label: `Consultations (${period(input.windowDays)})`, value: `${fmtN(p.views[0])} (avant : ${fmtN(p.views[1])})`, source: "product_views" },
          { label: "Intentions de commander", value: fmtN(p.intents[0]), source: "cart_events" },
        ],
        hypotheses: [hyp("si la demande continue, l'article sera en rupture bientôt.")],
        impact: Math.round(clamp(p.views[0] * 2 + (4 - p.stock) * 10)),
        impactNote: "Une rupture sur un article très regardé fait perdre des commandes possibles.",
        confidence: confidence(p.views[0], 30),
        cost: "medium",
        risk: "low",
        proposed: [{ type: "catalog.suggest_restock", params: { product_id: p.id }, label: `Réapprovisionner « ${cleanText(p.name, 40)} »` }],
      })
    );
  }
  const gone = input.products.filter((p) => (!p.active || p.stock <= 0) && p.views[0] >= minViews).sort((a, b) => b.views[0] - a.views[0] || a.name.localeCompare(b.name)).slice(0, MAX_PER_TYPE);
  for (const p of gone) {
    out.push(
      prioritize({
        key: `unavailable:${p.id}:w${input.windowDays}`,
        type: "unavailable_demand",
        title: `« ${cleanText(p.name, 60)} » est indisponible mais a été regardé ${fmtN(p.views[0])} fois`,
        facts: [
          { label: "État actuel", value: p.active ? "actif, stock épuisé" : "désactivé", source: "products" },
          { label: `Consultations (${period(input.windowDays)})`, value: fmtN(p.views[0]), source: "product_views" },
        ],
        hypotheses: [hyp("les consultations ont pu avoir lieu avant l'indisponibilité : la base ne dit pas quand l'article a disparu."), hyp("il existe peut-être une demande à satisfaire en le remettant en vente.")],
        impact: Math.round(clamp(p.views[0] * 1.5)),
        impactNote: "Impact réduit : on ne sait pas si la demande est encore là.",
        confidence: Math.round(confidence(p.views[0], 30) * 0.7 * 100) / 100,
        cost: "medium",
        risk: "low",
        proposed: [{ type: "catalog.suggest_restock", params: { product_id: p.id }, label: `Étudier la remise en vente de « ${cleanText(p.name, 40)} »` }],
      })
    );
  }
  return out;
}

function marketingReady(input: RadarInput): Finding[] {
  const m = input.marketing;
  if (!m || m.consentPromotions <= 0) return [];
  const reasons = [m.flashActive > 0 ? "une vente flash est en cours" : "", m.newArrivals14d >= 3 ? `${m.newArrivals14d} nouveautés de moins de 14 jours` : ""].filter(Boolean);
  if (reasons.length === 0) return [];
  return [
    prioritize({
      key: `marketing:ready:w${input.windowDays}`,
      type: "marketing_ready",
      title: `Une campagne e-mail ciblée est possible : ${reasons.join(" et ")}`,
      facts: [
        { label: "Comptes avec accord « promotions »", value: `${fmtN(m.consentPromotions)} sur ${fmtN(m.accounts)}`, source: "profiles" },
        { label: "Articles en vente flash réellement en cours", value: fmtN(m.flashActive), source: "products" },
        { label: "Nouveautés de moins de 14 jours", value: fmtN(m.newArrivals14d), source: "products" },
      ],
      hypotheses: [hyp("une campagne ciblée peut ramener des visiteurs — effet non mesuré tant que la simulation n'a pas tourné et que Brevo n'a pas renvoyé de résultats.")],
      impact: Math.round(clamp(25 + (m.flashActive > 0 ? 25 : 0) + (m.newArrivals14d >= 3 ? 15 : 0) + Math.min(20, (m.consentPromotions / Math.max(1, m.accounts)) * 20))),
      impactNote: "Estimation de l'occasion, pas une prévision de ventes.",
      confidence: 0.6,
      cost: "low",
      risk: "low",
      proposed: [{ type: "marketing.prepare_campaign", params: { date: ndjamenaDate(input.now) }, label: "Préparer la campagne du jour (simulation)" }],
    }),
  ];
}

// ---------------------------------------------------------------------------------------------
// Le rapport
// ---------------------------------------------------------------------------------------------

export function analyze(input: RadarInput): RadarReport {
  const findings = [...dataQuality(input), ...trafficChange(input), ...searchNoResult(input), ...categoryLowIntent(input), ...popularProducts(input), ...risingProducts(input), ...stockRisk(input), ...marketingReady(input)];
  findings.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  return { windowDays: input.windowDays, generatedAt: input.now, kpis: buildKpis(input), findings };
}
