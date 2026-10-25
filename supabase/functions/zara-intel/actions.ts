// Zara Intelligence 360 : le moteur d'actions et de permissions. Des fonctions pures, sans réseau ni base : testées dans tests/intel/actions.test.ts.
//
// Principe : TOUTE action (qu'elle soit proposée par une règle, par l'IA ou par l'administrateur) passe par `decide`. Cette décision ne dépend
// JAMAIS du modèle d'IA : elle ne lit que le registre ci-dessous (écrit dans le code, relu par un humain), les réglages de l'administrateur
// et l'historique. L'IA peut proposer ; elle ne peut ni accorder une permission, ni approuver sa propre action, ni modifier ce registre.
//
// Chaque action déclare : son type, ses paramètres validés (schéma strict : un champ inconnu est refusé), son niveau de risque, la permission
// requise, ses limites d'exécution, ses conditions de validation humaine, et un identifiant unique (idempotence : la même action le même jour
// n'est jamais faite deux fois).
//
// Ce que ce fichier ne fait PAS : exécuter quoi que ce soit. L'exécution (un autre fichier) ne se fait que si `decide` répond « allow » et
// que `simulated` est faux. Les actions « manual » ne sont jamais exécutées par le système : elles sont notées comme recommandations
// pour l'administrateur, qui les fait lui-même.

export type Mode = "off" | "simulation" | "live";
// none : lecture et analyse seulement ; low : écrit seulement dans la mémoire de Zara ou prépare sans rien envoyer ;
// medium : peut toucher des clients (dans des limites) ; high : argent, prix, règles — jamais sans approbation ; forbidden : jamais.
export type Risk = "none" | "low" | "medium" | "high" | "forbidden";
// never : permis automatiquement dans les limites ; configurable : approbation de l'administrateur, sauf s'il a PRÉ-APPROUVÉ ce type
// (dans ses limites) ; always : approbation explicite à chaque fois, non pré-approuvable ; forbidden : jamais exécutable.
export type ApprovalRule = "never" | "configurable" | "always" | "forbidden";
// internal : le système l'exécute ; manual : le système note une recommandation, l'administrateur l'exécute lui-même.
export type Executor = "internal" | "manual";
export type Group = "analysis" | "report" | "marketing" | "loyalty" | "catalog" | "finance" | "security";
export type Source = "ai" | "rule" | "admin";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const NDJAMENA_MS = HOUR_MS; // UTC+1, sans heure d'été
export const ndjamenaDay = (ms: number) => new Date(ms + NDJAMENA_MS).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------
// Paramètres : un schéma strict, pour que rien de ce que produit un modèle ne passe sans être contrôlé
// ---------------------------------------------------------------------------------------------

export type Field =
  | { kind: "string"; max: number; min?: number; optional?: boolean }
  | { kind: "int"; min: number; max: number; optional?: boolean }
  | { kind: "uuid"; optional?: boolean }
  | { kind: "date"; optional?: boolean }
  | { kind: "enum"; values: readonly string[]; optional?: boolean };
export type Schema = Record<string, Field>;
export type Params = Record<string, string | number>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

export function validateParams(schema: Schema, input: unknown): { ok: true; params: Params } | { ok: false; errors: string[] } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["parametres_pas_un_objet"] };
  const src = input as Record<string, unknown>;
  const errors: string[] = [];
  const params: Params = {};
  for (const k of Object.keys(src)) if (!Object.prototype.hasOwnProperty.call(schema, k)) errors.push(`champ_inconnu:${k.slice(0, 40)}`);
  for (const [name, f] of Object.entries(schema)) {
    const v = src[name];
    if (v === undefined || v === null) {
      if (!f.optional) errors.push(`champ_manquant:${name}`);
      continue;
    }
    switch (f.kind) {
      case "string": {
        const s = typeof v === "string" ? v.trim() : null;
        if (s === null || s.length < (f.min ?? 0) || s.length > f.max || CONTROL.test(s) || (s.length === 0 && !f.optional)) errors.push(`champ_invalide:${name}`);
        else params[name] = s;
        break;
      }
      case "int":
        if (typeof v !== "number" || !Number.isInteger(v) || v < f.min || v > f.max) errors.push(`champ_invalide:${name}`);
        else params[name] = v;
        break;
      case "uuid":
        if (typeof v !== "string" || !UUID.test(v)) errors.push(`champ_invalide:${name}`);
        else params[name] = v.toLowerCase();
        break;
      case "date":
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) errors.push(`champ_invalide:${name}`);
        else params[name] = v;
        break;
      case "enum":
        if (typeof v !== "string" || !f.values.includes(v)) errors.push(`champ_invalide:${name}`);
        else params[name] = v;
        break;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, params };
}

// ---------------------------------------------------------------------------------------------
// Le registre des actions (écrit dans le code : ni l'IA ni la base ne peuvent l'agrandir)
// ---------------------------------------------------------------------------------------------

export interface ActionSpec {
  type: string;
  label: string; // en français, pour l'administrateur
  group: Group;
  risk: Risk;
  permission: string; // permission que l'administrateur doit avoir accordée (intel_settings.permissions)
  approval: ApprovalRule;
  executor: Executor;
  limits: { perRun: number; perDay: number }; // maximum DUR : l'administrateur peut seulement le baisser
  schema: Schema;
  key: (params: Params, day: string) => string; // identifiant unique (idempotence)
}

const A = (s: ActionSpec): ActionSpec => s;
const none: Schema = {};
const dateOnly: Schema = { date: { kind: "date" } };

export const ACTIONS: readonly ActionSpec[] = [
  // --- analyses et rapports : automatiques ---
  A({ type: "analysis.run_radar", label: "Analyser les ventes et le catalogue", group: "analysis", risk: "none", permission: "intel.analysis", approval: "never", executor: "internal", limits: { perRun: 1, perDay: 24 }, schema: none, key: (_p, day) => `analysis.run_radar:${day}` }),
  A({ type: "report.daily_summary", label: "Préparer le résumé quotidien", group: "report", risk: "low", permission: "intel.report", approval: "never", executor: "internal", limits: { perRun: 1, perDay: 1 }, schema: dateOnly, key: (p) => `report.daily_summary:${p.date}` }),
  A({ type: "admin.notify", label: "Prévenir l'administrateur (cloche)", group: "report", risk: "low", permission: "intel.notify", approval: "never", executor: "internal", limits: { perRun: 5, perDay: 10 }, schema: { title: { kind: "string", min: 3, max: 80 }, message: { kind: "string", min: 3, max: 300 }, topic: { kind: "string", min: 3, max: 60 } }, key: (p, day) => `admin.notify:${p.topic}:${day}` }),
  // --- marketing : préparé automatiquement, envoyé seulement avec le verrou de Zara Marketing ET l'accord de l'administrateur ---
  A({ type: "marketing.prepare_campaign", label: "Préparer la campagne du jour (simulation, rien n'est envoyé)", group: "marketing", risk: "low", permission: "intel.marketing.prepare", approval: "never", executor: "internal", limits: { perRun: 1, perDay: 2 }, schema: dateOnly, key: (p) => `marketing.prepare_campaign:${p.date}` }),
  A({ type: "marketing.send_campaign", label: "Lancer l'envoi de la campagne préparée", group: "marketing", risk: "medium", permission: "intel.marketing.send", approval: "configurable", executor: "internal", limits: { perRun: 1, perDay: 1 }, schema: { run_id: { kind: "uuid" } }, key: (p) => `marketing.send_campaign:${p.run_id}` }),
  // --- fidélité : préparer, puis envoyer après vérification du vrai statut ---
  A({ type: "loyalty.prepare_message", label: "Préparer un message de fidélité (simulation)", group: "loyalty", risk: "low", permission: "intel.loyalty.prepare", approval: "never", executor: "internal", limits: { perRun: 3, perDay: 6 }, schema: { segment: { kind: "enum", values: ["bronze", "argent", "or", "platine", "diamond", "less_active", "reward_ready"] }, date: { kind: "date" } }, key: (p) => `loyalty.prepare_message:${p.segment}:${p.date}` }),
  A({ type: "loyalty.send_message", label: "Envoyer un message de fidélité", group: "loyalty", risk: "medium", permission: "intel.loyalty.send", approval: "configurable", executor: "internal", limits: { perRun: 1, perDay: 2 }, schema: { segment: { kind: "enum", values: ["bronze", "argent", "or", "platine", "diamond", "less_active", "reward_ready"] }, date: { kind: "date" } }, key: (p) => `loyalty.send_message:${p.segment}:${p.date}` }),
  // --- catalogue : seulement des recommandations pour l'administrateur ---
  A({ type: "catalog.suggest_restock", label: "Recommander un réapprovisionnement", group: "catalog", risk: "low", permission: "intel.recommend", approval: "never", executor: "manual", limits: { perRun: 10, perDay: 20 }, schema: { product_id: { kind: "uuid" } }, key: (p, day) => `catalog.suggest_restock:${p.product_id}:${day}` }),
  A({ type: "catalog.suggest_item", label: "Recommander d'ajouter un article cherché par les clients", group: "catalog", risk: "low", permission: "intel.recommend", approval: "never", executor: "manual", limits: { perRun: 10, perDay: 20 }, schema: { term: { kind: "string", min: 2, max: 60 } }, key: (p, day) => `catalog.suggest_item:${String(p.term).toLowerCase()}:${day}` }),
  A({ type: "catalog.review_category", label: "Recommander de revoir une catégorie (prix, photos, description)", group: "catalog", risk: "low", permission: "intel.recommend", approval: "never", executor: "manual", limits: { perRun: 5, perDay: 10 }, schema: { category_id: { kind: "uuid" } }, key: (p, day) => `catalog.review_category:${p.category_id}:${day}` }),
  // --- opérations sensibles : approbation explicite à CHAQUE fois, jamais pré-approuvable, jamais exécutées par le système ---
  A({ type: "catalog.price_change", label: "Modifier un prix", group: "finance", risk: "high", permission: "intel.sensitive", approval: "always", executor: "manual", limits: { perRun: 3, perDay: 5 }, schema: { product_id: { kind: "uuid" }, new_price: { kind: "int", min: 100, max: 50_000_000 } }, key: (p, day) => `catalog.price_change:${p.product_id}:${p.new_price}:${day}` }),
  A({ type: "promo.exceptional_discount", label: "Accorder une remise exceptionnelle", group: "finance", risk: "high", permission: "intel.sensitive", approval: "always", executor: "manual", limits: { perRun: 1, perDay: 2 }, schema: { product_id: { kind: "uuid" }, percent: { kind: "int", min: 1, max: 60 } }, key: (p, day) => `promo.exceptional_discount:${p.product_id}:${p.percent}:${day}` }),
  A({ type: "order.refund", label: "Rembourser une commande", group: "finance", risk: "high", permission: "intel.sensitive", approval: "always", executor: "manual", limits: { perRun: 1, perDay: 3 }, schema: { order_id: { kind: "uuid" }, reason: { kind: "string", min: 3, max: 200 } }, key: (p) => `order.refund:${p.order_id}` }),
  A({ type: "ads.budget_change", label: "Changer un budget publicitaire", group: "finance", risk: "high", permission: "intel.sensitive", approval: "always", executor: "manual", limits: { perRun: 1, perDay: 2 }, schema: { channel: { kind: "enum", values: ["google", "facebook", "tiktok", "other"] }, daily_budget: { kind: "int", min: 0, max: 10_000_000 } }, key: (p, day) => `ads.budget_change:${p.channel}:${p.daily_budget}:${day}` }),
  A({ type: "loyalty.rules_change", label: "Changer les règles de fidélité", group: "finance", risk: "high", permission: "intel.sensitive", approval: "always", executor: "manual", limits: { perRun: 1, perDay: 1 }, schema: { rule: { kind: "enum", values: ["points_rate", "tiers", "discount_rate", "discount_threshold"] }, proposal: { kind: "string", min: 3, max: 300 } }, key: (p, day) => `loyalty.rules_change:${p.rule}:${day}` }),
  // --- interdit : même si l'IA le recommande, même si l'administrateur le demande par ce canal ---
  A({ type: "permissions.change", label: "Modifier les permissions de Zara", group: "security", risk: "forbidden", permission: "never", approval: "forbidden", executor: "manual", limits: { perRun: 0, perDay: 0 }, schema: none, key: (_p, day) => `permissions.change:${day}` }),
  A({ type: "code.modify", label: "Modifier le code de production", group: "security", risk: "forbidden", permission: "never", approval: "forbidden", executor: "manual", limits: { perRun: 0, perDay: 0 }, schema: none, key: (_p, day) => `code.modify:${day}` }),
  A({ type: "security.rules_change", label: "Modifier les règles de sécurité", group: "security", risk: "forbidden", permission: "never", approval: "forbidden", executor: "manual", limits: { perRun: 0, perDay: 0 }, schema: none, key: (_p, day) => `security.rules_change:${day}` }),
  A({ type: "finance.settings_change", label: "Modifier les paramètres financiers (paiements, livraison)", group: "security", risk: "forbidden", permission: "never", approval: "forbidden", executor: "manual", limits: { perRun: 0, perDay: 0 }, schema: none, key: (_p, day) => `finance.settings_change:${day}` }),
  A({ type: "contact.unsubscribed", label: "Contacter une personne désabonnée", group: "security", risk: "forbidden", permission: "never", approval: "forbidden", executor: "manual", limits: { perRun: 0, perDay: 0 }, schema: none, key: (_p, day) => `contact.unsubscribed:${day}` }),
  A({ type: "data.export_personal", label: "Exporter des données personnelles de clients", group: "security", risk: "forbidden", permission: "never", approval: "forbidden", executor: "manual", limits: { perRun: 0, perDay: 0 }, schema: none, key: (_p, day) => `data.export_personal:${day}` }),
];

const BY_TYPE = new Map(ACTIONS.map((a) => [a.type, a]));
export const specOf = (type: string): ActionSpec | null => (typeof type === "string" ? BY_TYPE.get(type) ?? null : null);
// opérations sensibles : toujours une approbation explicite (jamais pré-approuvables)
export const SENSITIVE_TYPES = ACTIONS.filter((a) => a.risk === "high").map((a) => a.type);
export const FORBIDDEN_TYPES = ACTIONS.filter((a) => a.risk === "forbidden").map((a) => a.type);
// toutes les permissions que l'administrateur peut accorder (jamais « never »)
export const PERMISSIONS = [...new Set(ACTIONS.filter((a) => a.risk !== "forbidden").map((a) => a.permission))];

// ---------------------------------------------------------------------------------------------
// Réglages, historique, approbations (écrits par l'administrateur et par le serveur, jamais par le modèle)
// ---------------------------------------------------------------------------------------------

export interface IntelState {
  mode: Mode;
  killSwitch: boolean; // arrêt d'urgence
  grants: readonly string[]; // permissions accordées par l'administrateur
  preapproved: readonly string[]; // types « configurable » que l'administrateur a pré-approuvés (dans leurs limites)
  limitOverrides: Readonly<Record<string, { perRun?: number; perDay?: number }>>; // peuvent seulement BAISSER les limites
}
export type HistoryStatus = "proposed" | "pending_approval" | "approved" | "running" | "done" | "failed" | "refused" | "blocked";
export interface HistoryEntry {
  type: string;
  key: string;
  status: HistoryStatus;
  at: number;
  simulated: boolean; // une action simulée ne consomme jamais le budget d'une vraie action, et inversement
}
export interface Approval {
  key: string;
  paramsHash: string;
  approvedAt: number;
  approvedBy: string;
  expiresAt: number;
}
export const APPROVAL_TTL_MS = DAY_MS;
// états qui comptent dans les limites (un refus ou un blocage n'a rien consommé)
const COUNTS: ReadonlySet<HistoryStatus> = new Set(["proposed", "pending_approval", "approved", "running", "done", "failed"]);
// états qui font d'une nouvelle demande identique un doublon (un échec peut être retenté, dans les limites)
const BLOCKS_DUPLICATE: ReadonlySet<HistoryStatus> = new Set(["proposed", "pending_approval", "approved", "running", "done"]);

export interface ActionRequest {
  type: string;
  params: unknown;
  source: Source; // d'où vient la proposition : sert à la traçabilité, JAMAIS à élargir un droit
}
export interface Context {
  now: number;
  history: readonly HistoryEntry[]; // 24 dernières heures
  approvals: readonly Approval[];
  plannedInRun: Readonly<Record<string, number>>; // actions de chaque type déjà décidées dans ce passage
}

export type DecisionKind = "allow" | "needs_approval" | "deny" | "duplicate";
export interface Decision {
  kind: DecisionKind;
  simulated: boolean; // vrai : rien ne doit être exécuté (mode simulation), seulement noté
  reasons: string[];
  type: string;
  group: Group | null;
  risk: Risk | null;
  executor: Executor | null;
  key: string | null;
  params: Params | null;
  paramsHash: string | null;
  label: string;
}

export const REASON_LABELS: Record<string, string> = {
  type_inconnu: "Action inconnue : refusée.",
  interdit: "Action interdite : Zara ne peut jamais la faire, même sur recommandation de l'IA.",
  mode_eteint: "Zara Intelligence est éteinte.",
  arret_urgence: "Arrêt d'urgence actif : aucune action n'est exécutée.",
  parametres_invalides: "Paramètres invalides.",
  permission_manquante: "Permission non accordée par l'administrateur.",
  doublon: "Déjà faite ou déjà en attente (même identifiant).",
  limite_par_passage: "Limite par passage atteinte.",
  limite_journaliere: "Limite des 24 dernières heures atteinte.",
  approbation_requise: "Approbation de l'administrateur nécessaire.",
  approbation_expiree: "L'approbation a expiré : à redemander.",
  pre_approuvee: "Pré-approuvée par l'administrateur, dans ses limites.",
  recommandation_seulement: "Le système ne l'exécute pas : recommandation pour l'administrateur.",
};

// ---------------------------------------------------------------------------------------------
// Empreinte des paramètres (une approbation ne vaut que pour CES paramètres)
// ---------------------------------------------------------------------------------------------

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}
export function hashParams(params: unknown): string {
  const s = stableStringify(params);
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
    h2 = (Math.imul(h2, 33) ^ s.charCodeAt(i)) | 0;
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}${s.length.toString(16)}`;
}

// ---------------------------------------------------------------------------------------------
// La décision
// ---------------------------------------------------------------------------------------------

const effectiveLimit = (hard: number, override: number | undefined) => (typeof override === "number" && Number.isInteger(override) && override >= 0 ? Math.min(hard, override) : hard);

export function decide(req: ActionRequest, state: IntelState, ctx: Context): Decision {
  const spec = specOf(req?.type);
  const base: Decision = { kind: "deny", simulated: false, reasons: [], type: String(req?.type ?? "").slice(0, 60), group: null, risk: null, executor: null, key: null, params: null, paramsHash: null, label: "" };
  const deny = (...reasons: string[]): Decision => ({ ...base, kind: "deny", reasons });
  if (!spec) return deny("type_inconnu");
  const withSpec: Decision = { ...base, group: spec.group, risk: spec.risk, executor: spec.executor, label: spec.label };
  const done = (kind: DecisionKind, reasons: string[], extra: Partial<Decision> = {}): Decision => ({ ...withSpec, ...extra, kind, reasons, simulated: state.mode === "simulation" && spec.risk !== "none" });

  // 1. interdit : rien ne l'autorise (ni mode, ni permission, ni approbation, ni source)
  if (spec.risk === "forbidden" || spec.approval === "forbidden") return { ...withSpec, kind: "deny", reasons: ["interdit"] };
  // 2. éteint, ou arrêt d'urgence (seules les analyses en lecture continuent : elles ne touchent à rien)
  if (state.mode === "off") return { ...withSpec, kind: "deny", reasons: ["mode_eteint"] };
  if (state.killSwitch && spec.risk !== "none") return { ...withSpec, kind: "deny", reasons: ["arret_urgence"] };
  // 3. paramètres : schéma strict
  const v = validateParams(spec.schema, req.params);
  if (!v.ok) return { ...withSpec, kind: "deny", reasons: ["parametres_invalides", ...v.errors] };
  const key = spec.key(v.params, ndjamenaDay(ctx.now));
  const paramsHash = hashParams(v.params);
  const keyed = { key, params: v.params, paramsHash };
  // 4. permission accordée par l'administrateur
  if (!state.grants.includes(spec.permission)) return done("deny", ["permission_manquante"], keyed);
  // 5. doublon : même identifiant déjà fait ou en attente (dans le même mode : simulation ou réel)
  const simulated = state.mode === "simulation" && spec.risk !== "none";
  const same = ctx.history.filter((h) => h.simulated === simulated);
  if (same.some((h) => h.key === key && BLOCKS_DUPLICATE.has(h.status))) return done("duplicate", ["doublon"], keyed);
  // 6. limites : l'administrateur peut seulement les baisser
  const ov = state.limitOverrides[spec.type];
  const perDay = effectiveLimit(spec.limits.perDay, ov?.perDay);
  const perRun = effectiveLimit(spec.limits.perRun, ov?.perRun);
  if ((ctx.plannedInRun[spec.type] ?? 0) >= perRun) return done("deny", ["limite_par_passage"], keyed);
  if (same.filter((h) => h.type === spec.type && COUNTS.has(h.status) && ctx.now - h.at < DAY_MS).length >= perDay) return done("deny", ["limite_journaliere"], keyed);
  // 7. approbation
  const recommendation = spec.executor === "manual" ? ["recommandation_seulement"] : [];
  if (spec.approval === "never") return done("allow", recommendation, keyed);
  const valid = ctx.approvals.find((a) => a.key === key && a.paramsHash === paramsHash && a.expiresAt > ctx.now);
  if (valid) return done("allow", recommendation, keyed);
  const expired = ctx.approvals.some((a) => a.key === key && a.paramsHash === paramsHash && a.expiresAt <= ctx.now);
  // « configurable » : pré-approuvable (dans les limites). « always » : jamais, même si l'administrateur l'a listé par erreur.
  if (spec.approval === "configurable" && state.preapproved.includes(spec.type)) return done("allow", ["pre_approuvee", ...recommendation], keyed);
  return done("needs_approval", expired ? ["approbation_expiree", "approbation_requise"] : ["approbation_requise"], keyed);
}

// ---------------------------------------------------------------------------------------------
// Approbation : seul un administrateur identifié par le serveur peut en créer une
// ---------------------------------------------------------------------------------------------

export function approve(decision: Decision, approver: { id: string; isAdmin: boolean }, now: number): { ok: true; approval: Approval } | { ok: false; reason: "not_admin" | "not_pending" } {
  if (!approver || approver.isAdmin !== true || typeof approver.id !== "string" || approver.id.length === 0) return { ok: false, reason: "not_admin" };
  if (decision.kind !== "needs_approval" || !decision.key || !decision.paramsHash || decision.risk === "forbidden") return { ok: false, reason: "not_pending" };
  return { ok: true, approval: { key: decision.key, paramsHash: decision.paramsHash, approvedAt: now, approvedBy: approver.id, expiresAt: now + APPROVAL_TTL_MS } };
}

// ---------------------------------------------------------------------------------------------
// Réglages sûrs : ce que l'administrateur peut accorder (jamais plus que le registre)
// ---------------------------------------------------------------------------------------------

// Nettoie des réglages venant de la base : une permission inconnue, un type interdit ou non pré-approuvable est ignoré.
export function cleanState(raw: { mode?: unknown; kill_switch?: unknown; permissions?: unknown; preapproved?: unknown; limits?: unknown }): IntelState {
  const mode: Mode = raw.mode === "live" || raw.mode === "simulation" ? raw.mode : "off";
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const grants = list(raw.permissions).filter((p) => PERMISSIONS.includes(p));
  const preapproved = list(raw.preapproved).filter((t) => specOf(t)?.approval === "configurable");
  const limitOverrides: Record<string, { perRun?: number; perDay?: number }> = {};
  if (raw.limits && typeof raw.limits === "object" && !Array.isArray(raw.limits)) {
    for (const [type, o] of Object.entries(raw.limits as Record<string, unknown>)) {
      const spec = specOf(type);
      if (!spec || spec.risk === "forbidden" || !o || typeof o !== "object") continue;
      const { perRun, perDay } = o as Record<string, unknown>;
      limitOverrides[type] = {
        ...(typeof perRun === "number" && Number.isInteger(perRun) && perRun >= 0 ? { perRun } : {}),
        ...(typeof perDay === "number" && Number.isInteger(perDay) && perDay >= 0 ? { perDay } : {}),
      };
    }
  }
  // l'arrêt d'urgence est le réglage par défaut : seul un « false » écrit explicitement le lève (colonne absente ou illisible = arrêté)
  return { mode, killSwitch: raw.kill_switch !== false, grants, preapproved, limitOverrides };
}

// La vue pour le tableau de bord : le registre lisible (sans fonctions)
export function registryView() {
  return ACTIONS.map((a) => ({ type: a.type, label: a.label, group: a.group, risk: a.risk, approval: a.approval, executor: a.executor, permission: a.permission, limits: a.limits }));
}
