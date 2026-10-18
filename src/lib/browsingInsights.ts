// Intelligence commerciale de Zara : ce que le visiteur a regardé sur la boutique, son niveau d'intérêt, et quand une aide discrète
// a du sens. Aucun réseau, aucun écran ici : tout est testable. Le profil reste sur le téléphone du visiteur (le tracker l'enregistre,
// avec son accord) ; seule une copie « chiffres seulement » part vers la base pour le tableau de suivi.

export type InterestLevel = 'leger' | 'moyen' | 'eleve';
export type CartStatus = 'none' | 'in_cart' | 'removed' | 'purchased';
export type VariantKind = 'image' | 'size' | 'color';
export type SuggestionKind = 'product_revisit' | 'variants' | 'perfume_browse' | 'category_browse';
export type SuggestionOutcome = 'shown' | 'accepted' | 'dismissed';
export type ProductType = 'shoes' | 'perfume' | 'clothing' | 'other';

export const INTEREST_LABELS: Record<InterestLevel, string> = { leger: 'Léger', moyen: 'Moyen', eleve: 'Élevé' };

// --- réglages (tous testés) ---
export const RELOAD_WINDOW_MS = 8000; // rouvrir la même fiche en moins de 8 s (actualisation, double montage) = la même consultation
export const RETENTION_DAYS = 90; // durée de conservation : au-delà, tout est effacé
export const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min sans activité = nouvelle visite
export const SUGGESTION_COOLDOWN_MS = 30 * 60 * 1000; // jamais deux suggestions à moins de 30 minutes
export const SUGGESTION_SAME_TARGET_MS = 24 * 3600 * 1000; // la même suggestion n'est pas répétée avant 24 h
export const SUGGESTION_MAX_PER_DAY = 2;
export const REFUSAL_QUIET_MS = 7 * 24 * 3600 * 1000; // « Non merci » : plus de suggestion pendant 7 jours
export const MIN_ACTIVE_SECONDS_SIGNAL = 30; // « il a pris le temps » : un signal FAIBLE, jamais une preuve
export const MAX_PRODUCTS = 60;
export const MAX_ORDER = 40;
export const MAX_SEARCHES = 20;
export const MAX_SUGGESTIONS = 30;
export const MAX_VARIANT_VALUES = 12;

export interface ProductMeta {
  id: string;
  name: string;
  slug?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
}

export interface ProductRecord {
  id: string;
  name: string;
  slug: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  views: number; // nombre de consultations de la fiche
  sessions: number; // dans combien de visites différentes
  activeSeconds: number; // temps ACTIF cumulé (onglet visible, page active), en secondes
  lastDurationSeconds: number; // durée de la dernière consultation
  firstViewedAt: number;
  lastViewedAt: number;
  lastSessionKey: string | null;
  imageClicks: number;
  sizeClicks: number;
  colorClicks: number;
  sizes: string[]; // tailles essayées (distinctes)
  colors: string[]; // couleurs essayées (distinctes)
  returnsAfterOthers: number; // retours sur cette fiche après avoir regardé d'autres produits
  cartStatus: CartStatus;
  cartChangedAt: number | null;
  orderedAt: number | null;
  lastSuggestionAt: number | null;
  lastSuggestionKind: SuggestionKind | null;
}

export interface CategoryRecord {
  key: string; // le slug (ou l'identifiant) de la catégorie
  name: string | null;
  views: number; // fois où la page de la catégorie a été ouverte
  productIds: string[]; // produits distincts regardés dans cette catégorie
  lastViewedAt: number;
}

export interface SuggestionRecord {
  key: string; // ex. « product:ID » ou « cat:SLUG »
  kind: SuggestionKind;
  at: number;
  outcome: SuggestionOutcome;
}

export interface SyncSnapshot {
  views: number;
  activeSeconds: number;
  imageClicks: number;
  sizeClicks: number;
  colorClicks: number;
  returnsAfterOthers: number;
  sessions: number;
  cartStatus: CartStatus;
  interest: InterestLevel;
  lastSuggestionAt: number | null;
}

export interface BrowsingProfile {
  version: 1;
  visitorId: string;
  createdAt: number;
  updatedAt: number;
  products: Record<string, ProductRecord>;
  order: string[]; // ids des produits dans l'ordre où ils ont été regardés (le plus récent en dernier)
  categories: Record<string, CategoryRecord>;
  searches: { q: string; at: number }[];
  suggestions: SuggestionRecord[];
  quietUntil: number; // pas de suggestion avant cette date (le client a dit non)
  lastStart: { productId: string; at: number } | null; // pour reconnaître une actualisation
  lastActivityAt: number;
  sessionKey: string; // la visite en cours
  sessionStartedAt: number; // quand la visite en cours a commencé
  synced: Record<string, SyncSnapshot>; // ce qui est déjà parti vers la base (on n'envoie que la différence)
  searchesSyncedAt: number; // les recherches plus anciennes que cette date sont déjà parties
}

export function emptyProfile(visitorId: string, now: number): BrowsingProfile {
  return {
    version: 1,
    visitorId,
    createdAt: now,
    updatedAt: now,
    products: {},
    order: [],
    categories: {},
    searches: [],
    suggestions: [],
    quietUntil: 0,
    lastStart: null,
    lastActivityAt: now,
    sessionKey: `s${now.toString(36)}`,
    sessionStartedAt: now,
    synced: {},
    searchesSyncedAt: 0,
  };
}

const uniqPush = (list: string[], value: string, max: number): string[] => {
  if (!value) return list;
  if (list.includes(value)) return list;
  const next = [...list, value];
  return next.length > max ? next.slice(next.length - max) : next;
};

// La visite change après 30 minutes sans rien faire : « plusieurs visites » veut dire plusieurs vraies visites.
function rollSession(p: BrowsingProfile, now: number): BrowsingProfile {
  if (now - p.lastActivityAt > SESSION_GAP_MS) return { ...p, sessionKey: `s${now.toString(36)}`, sessionStartedAt: now, lastActivityAt: now };
  return { ...p, lastActivityAt: now };
}

function blankRecord(meta: ProductMeta, now: number): ProductRecord {
  return {
    id: meta.id,
    name: meta.name,
    slug: meta.slug ?? null,
    categoryId: meta.categoryId ?? null,
    categorySlug: meta.categorySlug ?? null,
    categoryName: meta.categoryName ?? null,
    views: 0,
    sessions: 0,
    activeSeconds: 0,
    lastDurationSeconds: 0,
    firstViewedAt: now,
    lastViewedAt: now,
    lastSessionKey: null,
    imageClicks: 0,
    sizeClicks: 0,
    colorClicks: 0,
    sizes: [],
    colors: [],
    returnsAfterOthers: 0,
    cartStatus: 'none',
    cartChangedAt: null,
    orderedAt: null,
    lastSuggestionAt: null,
    lastSuggestionKind: null,
  };
}

function withRecord(p: BrowsingProfile, meta: ProductMeta, now: number): { profile: BrowsingProfile; record: ProductRecord } {
  const existing = p.products[meta.id];
  const base = existing ?? blankRecord(meta, now);
  // le nom ou la catégorie peuvent arriver plus tard : on complète sans jamais effacer
  const record: ProductRecord = {
    ...base,
    name: meta.name || base.name,
    slug: meta.slug ?? base.slug,
    categoryId: meta.categoryId ?? base.categoryId,
    categorySlug: meta.categorySlug ?? base.categorySlug,
    categoryName: meta.categoryName ?? base.categoryName,
  };
  return { profile: p, record };
}

function put(p: BrowsingProfile, record: ProductRecord, now: number): BrowsingProfile {
  let products = { ...p.products, [record.id]: record };
  // trop de produits : on oublie les plus anciens
  const ids = Object.keys(products);
  if (ids.length > MAX_PRODUCTS) {
    ids
      .sort((a, b) => products[a].lastViewedAt - products[b].lastViewedAt)
      .slice(0, ids.length - MAX_PRODUCTS)
      .forEach((id) => delete products[id]);
    products = { ...products };
  }
  return { ...p, products, updatedAt: now };
}

// ---------------------------------------------------------------------------------------------
// Ce que le visiteur fait
// ---------------------------------------------------------------------------------------------

export interface ViewResult {
  profile: BrowsingProfile;
  counted: boolean; // false : c'est la même consultation (actualisation) : rien n'a été recompté
}

// Ouverture d'une fiche produit.
export function applyProductView(p0: BrowsingProfile, meta: ProductMeta, now: number): ViewResult {
  const p = rollSession(p0, now);
  const { record } = withRecord(p, meta, now);
  const last = p.lastStart;
  // même fiche rouverte tout de suite (actualisation, retour immédiat) : la même consultation, pas une nouvelle
  if (last && last.productId === meta.id && now - last.at < RELOAD_WINDOW_MS && p.products[meta.id]) {
    return { profile: put({ ...p, lastStart: { productId: meta.id, at: now } }, { ...record, lastViewedAt: now }, now), counted: false };
  }
  const known = !!p.products[meta.id];
  const position = p.order.lastIndexOf(meta.id);
  const othersAfter = known && position >= 0 && position < p.order.length - 1; // d'autres produits regardés depuis la dernière fois
  const newSession = record.lastSessionKey !== p.sessionKey;
  const next: ProductRecord = {
    ...record,
    views: record.views + 1,
    sessions: record.sessions + (newSession ? 1 : 0),
    lastSessionKey: p.sessionKey,
    lastViewedAt: now,
    returnsAfterOthers: record.returnsAfterOthers + (othersAfter ? 1 : 0),
  };
  const order = [...p.order.filter((id) => id !== meta.id), meta.id].slice(-MAX_ORDER);
  let profile: BrowsingProfile = { ...p, order, lastStart: { productId: meta.id, at: now } };
  profile = put(profile, next, now);
  // la catégorie : un produit de plus regardé dans cette catégorie
  const key = meta.categorySlug || meta.categoryId || '';
  if (key) {
    const cat = profile.categories[key] ?? { key, name: meta.categoryName ?? null, views: 0, productIds: [], lastViewedAt: now };
    profile = {
      ...profile,
      categories: { ...profile.categories, [key]: { ...cat, name: meta.categoryName ?? cat.name, productIds: uniqPush(cat.productIds, meta.id, MAX_PRODUCTS), lastViewedAt: now } },
    };
  }
  return { profile, counted: true };
}

// Temps ACTIF passé sur la fiche : `delta` = secondes ajoutées depuis le dernier envoi, `total` = durée de cette consultation.
export function applyActiveTime(p0: BrowsingProfile, meta: ProductMeta, delta: number, total: number, now: number): BrowsingProfile {
  if (!(delta > 0) && !(total > 0)) return p0;
  const p = rollSession(p0, now);
  const { record } = withRecord(p, meta, now);
  const safeDelta = Math.max(0, Math.min(delta, 3600)); // une heure d'un coup n'est jamais du temps actif
  return put(p, { ...record, activeSeconds: record.activeSeconds + safeDelta, lastDurationSeconds: Math.max(0, Math.round(total)), lastViewedAt: Math.max(record.lastViewedAt, now) }, now);
}

export function applyVariantClick(p0: BrowsingProfile, meta: ProductMeta, kind: VariantKind, value: string | null, now: number): BrowsingProfile {
  const p = rollSession(p0, now);
  const { record } = withRecord(p, meta, now);
  const next = { ...record };
  const clean = (value ?? '').trim().slice(0, 40);
  if (kind === 'image') next.imageClicks += 1;
  if (kind === 'size') {
    next.sizeClicks += 1;
    if (clean) next.sizes = uniqPush(next.sizes, clean, MAX_VARIANT_VALUES);
  }
  if (kind === 'color') {
    next.colorClicks += 1;
    if (clean) next.colors = uniqPush(next.colors, clean, MAX_VARIANT_VALUES);
  }
  return put(p, next, now);
}

// Complète le nom ou la catégorie d'un produit déjà ouvert (la catégorie arrive parfois après la fiche) : aucune vue n'est ajoutée.
export function applyProductMeta(p0: BrowsingProfile, meta: ProductMeta, now: number): BrowsingProfile {
  const existing = p0.products[meta.id];
  if (!existing) return p0;
  const { record } = withRecord(p0, meta, existing.lastViewedAt);
  let profile = put(p0, { ...record, lastViewedAt: existing.lastViewedAt }, p0.updatedAt);
  const key = meta.categorySlug || meta.categoryId || '';
  if (key && existing.views > 0) {
    const cat = profile.categories[key] ?? { key, name: meta.categoryName ?? null, views: 0, productIds: [], lastViewedAt: existing.lastViewedAt };
    profile = { ...profile, categories: { ...profile.categories, [key]: { ...cat, name: meta.categoryName ?? cat.name, productIds: uniqPush(cat.productIds, meta.id, MAX_PRODUCTS) } } };
  }
  return { ...profile, updatedAt: now };
}

export type CartEvent = 'add' | 'remove' | 'purchase';

export function applyCartEvent(p0: BrowsingProfile, meta: ProductMeta, event: CartEvent, now: number): BrowsingProfile {
  const p = rollSession(p0, now);
  const { record } = withRecord(p, meta, now);
  const status: CartStatus = event === 'add' ? 'in_cart' : event === 'remove' ? 'removed' : 'purchased';
  // « retiré » après un achat ne change rien : la commande reste la commande
  if (record.cartStatus === 'purchased' && event !== 'purchase') return p;
  return put(p, { ...record, cartStatus: status, cartChangedAt: now, orderedAt: event === 'purchase' ? now : record.orderedAt }, now);
}

export function applyCategoryView(p0: BrowsingProfile, key: string, name: string | null, now: number): BrowsingProfile {
  if (!key) return p0;
  const p = rollSession(p0, now);
  const cat = p.categories[key] ?? { key, name, views: 0, productIds: [], lastViewedAt: now };
  return { ...p, updatedAt: now, categories: { ...p.categories, [key]: { ...cat, name: name ?? cat.name, views: cat.views + 1, lastViewedAt: now } } };
}

// Une recherche : jamais un numéro de téléphone, une adresse e-mail ou un texte long (on ne cherche pas à identifier quelqu'un).
export function sanitizeSearch(raw: string): string | null {
  const q = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (q.length < 2 || q.length > 60) return null;
  if (/@|https?:|www\./.test(q)) return null;
  if ((q.match(/\d/g) ?? []).length >= 6) return null;
  return q;
}

export function applySearch(p0: BrowsingProfile, raw: string, now: number): BrowsingProfile {
  const q = sanitizeSearch(raw);
  if (!q) return p0;
  const p = rollSession(p0, now);
  const last = p.searches[p.searches.length - 1];
  // la même recherche, ou une recherche qui se complète lettre après lettre : une seule entrée
  let searches = p.searches;
  if (last && (last.q === q || q.startsWith(last.q) || last.q.startsWith(q)) && now - last.at < 20_000) searches = searches.slice(0, -1);
  searches = [...searches, { q, at: now }].slice(-MAX_SEARCHES);
  return { ...p, searches, updatedAt: now };
}

export function applySuggestion(p0: BrowsingProfile, key: string, kind: SuggestionKind, outcome: SuggestionOutcome, now: number, productId?: string | null): BrowsingProfile {
  const p = rollSession(p0, now);
  const suggestions = [...p.suggestions, { key, kind, at: now, outcome }].slice(-MAX_SUGGESTIONS);
  let profile: BrowsingProfile = { ...p, suggestions, updatedAt: now };
  // « Non merci » : le client ne veut pas de conseil pour le moment, on respecte (7 jours)
  if (outcome === 'dismissed') profile = { ...profile, quietUntil: now + REFUSAL_QUIET_MS };
  const rec = productId ? profile.products[productId] : null;
  if (rec) profile = put(profile, { ...rec, lastSuggestionAt: now, lastSuggestionKind: kind }, now);
  return profile;
}

// ---------------------------------------------------------------------------------------------
// Niveau d'intérêt : plusieurs signaux, jamais le temps seul
// ---------------------------------------------------------------------------------------------

export interface InterestEstimate {
  level: InterestLevel;
  signals: string[]; // pourquoi (pour les tests et le tableau de suivi)
}

// Les signaux « forts » (des gestes, pas du temps) : plusieurs consultations, retour après d'autres produits, plusieurs variantes essayées.
export function strongSignals(r: ProductRecord): { repeat: boolean; revisit: boolean; variants: boolean; count: number } {
  const repeat = r.views >= 3 || (r.views >= 2 && r.sessions >= 2);
  const revisit = r.returnsAfterOthers >= 1;
  const variants = r.sizes.length >= 2 || r.colors.length >= 2;
  return { repeat, revisit, variants, count: [repeat, revisit, variants].filter(Boolean).length };
}

export function estimateInterest(r: ProductRecord): InterestEstimate {
  const signals: string[] = [];
  const inCart = r.cartStatus === 'in_cart' || r.cartStatus === 'purchased';
  const { repeat, revisit, variants, count: strong } = strongSignals(r);
  const time = r.activeSeconds >= MIN_ACTIVE_SECONDS_SIGNAL;
  const photos = r.imageClicks >= 2;
  const anyVariantClick = r.sizeClicks + r.colorClicks >= 1;

  if (inCart) signals.push('panier');
  if (repeat) signals.push('plusieurs consultations');
  if (revisit) signals.push('retour après d’autres produits');
  if (variants) signals.push('plusieurs variantes');
  if (time) signals.push('temps passé');
  if (photos) signals.push('photos examinées');

  // Élevé : l'article est au panier, ou deux signaux forts, ou un signal fort confirmé par du temps ou des photos.
  if (inCart || strong >= 2 || (strong >= 1 && (time || photos))) return { level: 'eleve', signals };
  // Moyen : un signal fort, un retour sur la fiche, ou du temps passé À EXAMINER (photos, tailles, couleurs) — le temps seul ne compte pas.
  if (strong >= 1 || r.views >= 2 || (time && (photos || anyVariantClick)) || (photos && anyVariantClick)) return { level: 'moyen', signals };
  return { level: 'leger', signals };
}

export interface CategoryInterest {
  key: string;
  name: string | null;
  level: InterestLevel;
  distinctProducts: number;
}

export function categoryInterest(p: BrowsingProfile, key: string): CategoryInterest | null {
  const cat = p.categories[key];
  if (!cat) return null;
  const distinct = cat.productIds.length;
  const high = cat.productIds.some((id) => !!p.products[id] && estimateInterest(p.products[id]).level === 'eleve');
  const level: InterestLevel = distinct >= 5 || (distinct >= 3 && high) ? 'eleve' : distinct >= 3 ? 'moyen' : 'leger';
  return { key, name: cat.name, level, distinctProducts: distinct };
}

export function topCategories(p: BrowsingProfile, limit = 3): CategoryInterest[] {
  return Object.keys(p.categories)
    .map((k) => categoryInterest(p, k))
    .filter((c): c is CategoryInterest => !!c && c.distinctProducts >= 2)
    .sort((a, b) => b.distinctProducts - a.distinctProducts)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Ce que Zara peut demander au profil
// ---------------------------------------------------------------------------------------------

export function recentProducts(p: BrowsingProfile, limit: number, now: number, withinDays = 14): ProductRecord[] {
  const since = now - withinDays * 24 * 3600 * 1000;
  return Object.values(p.products)
    .filter((r) => r.lastViewedAt >= since && r.views > 0)
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt)
    .slice(0, limit);
}

export function repeatedProducts(p: BrowsingProfile, minViews = 2): ProductRecord[] {
  return Object.values(p.products)
    .filter((r) => r.views >= minViews)
    .sort((a, b) => b.views - a.views || b.lastViewedAt - a.lastViewedAt);
}

export function secondsOn(p: BrowsingProfile, productId: string): number {
  return Math.round(p.products[productId]?.activeSeconds ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Aide discrète : quand, et laquelle (jamais à chaque clic)
// ---------------------------------------------------------------------------------------------

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function productTypeOf(name: string | null | undefined, categorySlug?: string | null, categoryName?: string | null): ProductType {
  const text = fold(`${name ?? ''} ${categorySlug ?? ''} ${categoryName ?? ''}`);
  if (/parfum|fragrance|eau de|cologne|musc|oud\b|attar/.test(text)) return 'perfume';
  if (/chaussure|sandale|basket|soulier|sneaker|mocassin|botte|escarpin|claquette|tong/.test(text)) return 'shoes';
  if (/chemise|robe|pantalon|veste|costume|t-?shirt|jean|jupe|abaya|boubou|vetement|habit|polo|pull|blouse|short|manteau|cravate/.test(text)) return 'clothing';
  return 'other';
}

export interface Suggestion {
  kind: SuggestionKind;
  key: string; // « product:ID » ou « cat:SLUG »
  productId: string | null;
  categoryKey: string | null;
  type: ProductType;
  level: InterestLevel;
}

export interface SuggestionContext {
  now: number;
  allowed: boolean; // suivi autorisé par le visiteur
  // Ce que la boutique peut vraiment proposer en ce moment (catalogue réel). Sans ces vérifications, tout est permis.
  available?: (productId: string) => boolean; // l'article existe encore et est en stock
  categoryHasMore?: (categoryKey: string, seenIds: string[]) => boolean; // la catégorie a d'autres articles à montrer
}

const sameDay = (a: number, b: number) => Math.abs(a - b) < 24 * 3600 * 1000;

// Une seule suggestion au plus, et seulement si :
// - le suivi est autorisé et le client n'a pas dit « non merci » récemment ;
// - aucune autre suggestion à moins de 30 minutes, pas plus de 2 par jour, une seule par visite ;
// - ce n'est pas la même suggestion que celle des dernières 24 h ;
// - l'intérêt est probable (plusieurs signaux), jamais à cause d'un seul clic.
export function pickSuggestion(p: BrowsingProfile, ctx: SuggestionContext): Suggestion | null {
  if (!ctx.allowed) return null;
  const { now } = ctx;
  if (now < p.quietUntil) return null;
  const given = p.suggestions.filter((s) => s.outcome === 'shown' || s.outcome === 'accepted');
  if (given.some((s) => now - s.at < SUGGESTION_COOLDOWN_MS)) return null;
  if (given.filter((s) => sameDay(s.at, now)).length >= SUGGESTION_MAX_PER_DAY) return null;
  if (given.some((s) => s.at >= p.sessionStartedAt)) return null; // une seule par visite
  const recent = (key: string) => p.suggestions.some((s) => s.key === key && now - s.at < SUGGESTION_SAME_TARGET_MS);

  // 1) un article qui revient, ou plusieurs variantes d'un même article : intérêt élevé, ou au moins un signal fort (un geste, pas du temps)
  const products = Object.values(p.products)
    .filter((r) => r.cartStatus !== 'purchased' && r.cartStatus !== 'in_cart')
    .map((r) => ({ r, est: estimateInterest(r) }))
    .filter((x) => x.est.level === 'eleve' || (x.est.level === 'moyen' && strongSignals(x.r).count >= 1))
    .sort((a, b) => b.r.lastViewedAt - a.r.lastViewedAt);
  for (const { r, est } of products) {
    const key = `product:${r.id}`;
    if (recent(key)) continue;
    if (ctx.available && !ctx.available(r.id)) continue;
    const type = productTypeOf(r.name, r.categorySlug, r.categoryName);
    const manyColors = r.colors.length >= 2;
    return { kind: manyColors && type !== 'perfume' ? 'variants' : 'product_revisit', key, productId: r.id, categoryKey: r.categorySlug || r.categoryId, type, level: est.level };
  }

  // 2) plusieurs articles d'une même catégorie
  const cats = Object.keys(p.categories)
    .map((k) => categoryInterest(p, k))
    .filter((c): c is CategoryInterest => !!c && c.distinctProducts >= 3)
    .sort((a, b) => b.distinctProducts - a.distinctProducts);
  for (const c of cats) {
    const key = `cat:${c.key}`;
    if (recent(key)) continue;
    if (ctx.categoryHasMore && !ctx.categoryHasMore(c.key, p.categories[c.key]?.productIds ?? [])) continue;
    const sample = c.key ? Object.values(p.products).find((r) => (r.categorySlug || r.categoryId) === c.key) : undefined;
    const type = productTypeOf(sample?.name, c.key, c.name);
    return { kind: type === 'perfume' ? 'perfume_browse' : 'category_browse', key, productId: null, categoryKey: c.key, type, level: c.level };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Vie privée : durée de conservation, copie « chiffres seulement » pour la base
// ---------------------------------------------------------------------------------------------

export function pruneProfile(p: BrowsingProfile, now: number, retentionDays = RETENTION_DAYS): BrowsingProfile {
  const limit = now - retentionDays * 24 * 3600 * 1000;
  const products: Record<string, ProductRecord> = {};
  for (const [id, r] of Object.entries(p.products)) if (r.lastViewedAt >= limit) products[id] = r;
  const categories: Record<string, CategoryRecord> = {};
  for (const [k, c] of Object.entries(p.categories)) if (c.lastViewedAt >= limit) categories[k] = { ...c, productIds: c.productIds.filter((id) => !!products[id]) };
  const synced: Record<string, SyncSnapshot> = {};
  for (const id of Object.keys(p.synced)) if (products[id]) synced[id] = p.synced[id];
  return {
    ...p,
    products,
    categories,
    synced,
    order: p.order.filter((id) => !!products[id]),
    searches: p.searches.filter((s) => s.at >= limit),
    suggestions: p.suggestions.filter((s) => s.at >= limit),
  };
}

export interface ProductDelta {
  productId: string;
  name: string;
  categorySlug: string | null;
  categoryName: string | null;
  views: number;
  sessions: number;
  activeSeconds: number;
  lastDurationSeconds: number;
  lastViewedAt: number;
  imageClicks: number;
  sizeClicks: number;
  colorClicks: number;
  returnsAfterOthers: number;
  cartStatus: CartStatus;
  interest: InterestLevel;
  lastSuggestionKind: SuggestionKind | null;
  lastSuggestionAt: number | null;
}

const snapshotOf = (r: ProductRecord): SyncSnapshot => ({
  views: r.views,
  activeSeconds: Math.round(r.activeSeconds),
  imageClicks: r.imageClicks,
  sizeClicks: r.sizeClicks,
  colorClicks: r.colorClicks,
  returnsAfterOthers: r.returnsAfterOthers,
  sessions: r.sessions,
  cartStatus: r.cartStatus,
  interest: estimateInterest(r).level,
  lastSuggestionAt: r.lastSuggestionAt,
});

const NEVER_SENT: SyncSnapshot = { views: 0, activeSeconds: 0, imageClicks: 0, sizeClicks: 0, colorClicks: 0, returnsAfterOthers: 0, sessions: 0, cartStatus: 'none', interest: 'leger', lastSuggestionAt: null };

// Ce qui n'est pas encore parti vers la base : seulement la DIFFÉRENCE depuis le dernier envoi réussi, jamais le total (aucun double comptage).
export function pendingDeltas(p: BrowsingProfile): {
  deltas: ProductDelta[];
  snapshots: Record<string, SyncSnapshot>;
  searches: { q: string; at: number }[];
  searchesUpTo: number;
} {
  const deltas: ProductDelta[] = [];
  const snapshots: Record<string, SyncSnapshot> = {};
  for (const r of Object.values(p.products)) {
    const now = snapshotOf(r);
    const before = p.synced[r.id] ?? NEVER_SENT;
    const d = {
      views: now.views - before.views,
      activeSeconds: now.activeSeconds - before.activeSeconds,
      imageClicks: now.imageClicks - before.imageClicks,
      sizeClicks: now.sizeClicks - before.sizeClicks,
      colorClicks: now.colorClicks - before.colorClicks,
      returnsAfterOthers: now.returnsAfterOthers - before.returnsAfterOthers,
      sessions: now.sessions - before.sessions,
    };
    // l'état du panier, le niveau d'intérêt et la dernière suggestion changent sans compteur : on les renvoie aussi
    const moved = Object.values(d).some((v) => v > 0) || now.cartStatus !== before.cartStatus || now.interest !== before.interest || now.lastSuggestionAt !== before.lastSuggestionAt;
    if (!moved) continue;
    deltas.push({
      productId: r.id,
      name: r.name,
      categorySlug: r.categorySlug,
      categoryName: r.categoryName,
      views: Math.max(0, d.views),
      sessions: Math.max(0, d.sessions),
      activeSeconds: Math.max(0, d.activeSeconds),
      lastDurationSeconds: Math.round(r.lastDurationSeconds),
      lastViewedAt: r.lastViewedAt,
      imageClicks: Math.max(0, d.imageClicks),
      sizeClicks: Math.max(0, d.sizeClicks),
      colorClicks: Math.max(0, d.colorClicks),
      returnsAfterOthers: Math.max(0, d.returnsAfterOthers),
      cartStatus: r.cartStatus,
      interest: now.interest,
      lastSuggestionKind: r.lastSuggestionKind,
      lastSuggestionAt: r.lastSuggestionAt,
    });
    snapshots[r.id] = now;
  }
  // les recherches pas encore parties (plus récentes que le dernier envoi réussi)
  const searches = p.searches.filter((x) => x.at > p.searchesSyncedAt);
  const searchesUpTo = searches.reduce((max, x) => Math.max(max, x.at), p.searchesSyncedAt);
  return { deltas, snapshots, searches, searchesUpTo };
}

// Après un envoi réussi : on note ce qui est parti (et seulement ça), pour ne rien renvoyer deux fois.
export function markSynced(p: BrowsingProfile, snapshots: Record<string, SyncSnapshot>, searchesUpTo: number = p.searchesSyncedAt): BrowsingProfile {
  return { ...p, synced: { ...p.synced, ...snapshots }, searchesSyncedAt: Math.max(p.searchesSyncedAt, searchesUpTo) };
}

// ---------------------------------------------------------------------------------------------
// Enregistrement sur le téléphone
// ---------------------------------------------------------------------------------------------

export function serializeProfile(p: BrowsingProfile): string {
  return JSON.stringify(p);
}

// Lit un profil enregistré ; tout ce qui est abîmé ou d'une autre version est ignoré (on repart d'un profil vide, sans erreur).
export function parseProfile(raw: string | null | undefined, now: number): BrowsingProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<BrowsingProfile>;
    if (!v || v.version !== 1 || typeof v.visitorId !== 'string' || typeof v.products !== 'object' || v.products === null) return null;
    const base = emptyProfile(v.visitorId, now);
    return {
      ...base,
      ...v,
      products: v.products as Record<string, ProductRecord>,
      order: Array.isArray(v.order) ? v.order.filter((x) => typeof x === 'string') : [],
      categories: (v.categories && typeof v.categories === 'object' ? v.categories : {}) as Record<string, CategoryRecord>,
      searches: Array.isArray(v.searches) ? v.searches : [],
      suggestions: Array.isArray(v.suggestions) ? v.suggestions : [],
      synced: (v.synced && typeof v.synced === 'object' ? v.synced : {}) as Record<string, SyncSnapshot>,
      quietUntil: Number(v.quietUntil) || 0,
      lastActivityAt: Number(v.lastActivityAt) || now,
      sessionKey: typeof v.sessionKey === 'string' ? v.sessionKey : base.sessionKey,
      sessionStartedAt: Number(v.sessionStartedAt) || base.sessionStartedAt,
      searchesSyncedAt: Number(v.searchesSyncedAt) || 0,
      version: 1,
    };
  } catch {
    return null;
  }
}
