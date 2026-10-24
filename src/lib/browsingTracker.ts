// Collecte de la navigation du visiteur, pour que Zara le conseille mieux : articles regardés, temps ACTIF, variantes, panier, recherches.
//
// - Rien n'est noté si le visiteur a refusé le suivi (ou si son navigateur dit « Ne pas me suivre »).
// - Le profil reste d'abord sur son téléphone ; seule une copie « chiffres seulement » part vers la base, par petits envois qui ne
//   comptent jamais deux fois la même chose (numéro d'envoi unique, et seulement la différence depuis le dernier envoi réussi).
// - Une connexion qui coupe ne perd rien : l'envoi attend dans un « courrier à poster » gardé sur le téléphone et repart plus tard.
// - Seulement sur le site (web) ; ailleurs, ce module ne fait rien.

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { getCurrentSessionId } from './analytics';
import { deviceStore, type KeyValueStore } from './assistantAttribution';
import * as bi from './browsingInsights';
import { ActiveTimer, TICK_MS, isActive } from './activeTimer';
import { isTrackingAllowed, readChoice, writeChoice, type TrackingChoice } from './trackingConsent';

const PROFILE_KEY = 'albasse_browsing_profile_v1';
const OUTBOX_KEY = 'albasse_browsing_outbox_v1';
const VISITOR_KEY = 'albasse_visitor_id'; // le même identifiant anonyme que les statistiques de visites
const PERSIST_EVERY_TICKS = 5; // le temps actif est gardé toutes les 5 secondes (une coupure brutale perd 5 s au plus)
const SYNC_DEBOUNCE_MS = 8000;
const SYNC_MIN_GAP_MS = 3000;
const SYNC_RETRY_MS = 30000;
const SYNC_MISSING_RETRY_MS = 10 * 60 * 1000; // la base n'a pas encore le script : on réessaie dans 10 minutes, pas chaque seconde

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';

interface ActiveView {
  meta: bi.ProductMeta;
  timer: ActiveTimer;
  flushedSeconds: number;
  ticks: number;
}

let profile: bi.BrowsingProfile | null = null;
let loaded = false;
let active: ActiveView | null = null;
let lastInteractionAt = Date.now();
let lastMoveAt = 0;
let tickId: ReturnType<typeof setInterval> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;
let lastSyncAttempt = 0;
let syncBlockedUntil = 0;
let installed = false;
const listeners = new Set<() => void>();

const store = (): KeyValueStore | null => (isWeb() ? deviceStore() : null);

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// l'identifiant anonyme du visiteur (aussi pour la limite des messages de Zara IA)
export const getVisitorId = (): string => visitorId();

function visitorId(): string {
  const s = store();
  try {
    const existing = s?.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = uuid();
    s?.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return uuid();
  }
}

export function isTrackingEnabled(): boolean {
  return isWeb() && isTrackingAllowed(store());
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const now = Date.now();
  let parsed: bi.BrowsingProfile | null = null;
  try {
    parsed = bi.parseProfile(store()?.getItem(PROFILE_KEY), now);
  } catch {
    parsed = null;
  }
  // la durée de conservation (90 jours) s'applique dès le chargement
  profile = parsed ? bi.pruneProfile(parsed, now) : bi.emptyProfile(visitorId(), now);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // un abonné qui plante ne doit pas bloquer les autres
    }
  });
}

function save() {
  try {
    if (profile) store()?.setItem(PROFILE_KEY, bi.serializeProfile(profile));
  } catch {
    // stockage plein ou bloqué : le profil reste en mémoire pour cette visite
  }
}

function persist() {
  save();
  notify();
  scheduleSync();
}

function mutate(fn: (p: bi.BrowsingProfile) => bi.BrowsingProfile) {
  if (!isTrackingEnabled()) return;
  load();
  if (!profile) return;
  profile = fn(profile);
  persist();
}

// ---------------------------------------------------------------------------------------------
// Temps ACTIF sur la fiche en cours
// ---------------------------------------------------------------------------------------------

const activityNow = (now: number) =>
  isActive({ visible: document.visibilityState === 'visible', focused: typeof document.hasFocus === 'function' ? document.hasFocus() : true, lastInteractionAt, now });

function flushActive(final: boolean) {
  if (!active || !profile) return;
  const now = Date.now();
  active.timer.tick(now, activityNow(now));
  const total = active.timer.seconds;
  const delta = total - active.flushedSeconds;
  if (delta > 0.01 || (final && total > 0)) {
    profile = bi.applyActiveTime(profile, active.meta, delta, total, now);
    active.flushedSeconds = total;
    persist();
  }
}

function tick() {
  if (!active) return;
  const now = Date.now();
  active.timer.tick(now, activityNow(now));
  active.ticks += 1;
  if (active.ticks % PERSIST_EVERY_TICKS === 0) flushActive(false);
}

function startTicking() {
  if (tickId) return;
  tickId = setInterval(tick, TICK_MS);
}

function stopTicking() {
  if (tickId) clearInterval(tickId);
  tickId = null;
}

// Ouverture d'une fiche produit. Une fiche rouverte tout de suite (actualisation) reste la même consultation.
export function startProductView(meta: bi.ProductMeta): void {
  if (!isTrackingEnabled()) return;
  load();
  endProductView('replace');
  if (!profile) return;
  const now = Date.now();
  lastInteractionAt = now; // ouvrir une page est un geste du client
  profile = bi.applyProductView(profile, meta, now).profile;
  active = { meta, timer: new ActiveTimer(now), flushedSeconds: 0, ticks: 0 };
  persist();
  startTicking();
}

// La catégorie du produit arrive parfois après l'ouverture de la fiche : on la complète, sans compter une nouvelle consultation.
export function enrichProductMeta(meta: bi.ProductMeta): void {
  if (active && active.meta.id === meta.id) active.meta = meta;
  mutate((p) => bi.applyProductMeta(p, meta, Date.now()));
}

// Fermeture, remplacement ou passage à une autre page : le temps actif est arrêté et gardé.
export function endProductView(_reason: 'leave' | 'replace' | 'hidden' = 'leave'): void {
  if (!active) return;
  flushActive(true);
  active = null;
  stopTicking();
}

// ---------------------------------------------------------------------------------------------
// Gestes
// ---------------------------------------------------------------------------------------------

export function trackVariant(meta: bi.ProductMeta, kind: bi.VariantKind, value: string | null): void {
  lastInteractionAt = Date.now();
  mutate((p) => bi.applyVariantClick(p, meta, kind, value, Date.now()));
}

export function trackCartEvent(meta: bi.ProductMeta, event: bi.CartEvent): void {
  mutate((p) => bi.applyCartEvent(p, meta, event, Date.now()));
}

export function trackSearchQuery(query: string): void {
  mutate((p) => bi.applySearch(p, query, Date.now()));
}

export function trackCategoryView(key: string, name: string | null): void {
  mutate((p) => bi.applyCategoryView(p, key, name, Date.now()));
}

export function recordSuggestion(key: string, kind: bi.SuggestionKind, outcome: bi.SuggestionOutcome, productId?: string | null): void {
  mutate((p) => bi.applySuggestion(p, key, kind, outcome, Date.now(), productId));
}

// ---------------------------------------------------------------------------------------------
// Ce que Zara peut demander (jamais rien si le suivi est refusé)
// ---------------------------------------------------------------------------------------------

export function getBrowsingProfile(): bi.BrowsingProfile | null {
  if (!isTrackingEnabled()) return null;
  load();
  flushActive(false); // inclut la fiche en cours
  return profile;
}

export function trackingState(): { allowed: boolean; choice: TrackingChoice; hasData: boolean } {
  const allowed = isTrackingEnabled();
  if (allowed) load();
  return { allowed, choice: readChoice(store()), hasData: allowed && !!profile && Object.keys(profile.products).length > 0 };
}

export function subscribeBrowsing(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Le visiteur refuse (ou accepte à nouveau). Un refus arrête tout, efface ce qui est gardé sur le téléphone et demande l'effacement en base.
export function setTrackingChoice(choice: 'granted' | 'denied'): void {
  if (!isWeb()) return;
  writeChoice(choice, store());
  if (choice === 'denied') {
    const id = (profile?.visitorId ?? visitorId());
    endProductView('hidden');
    profile = null;
    loaded = false;
    try {
      store()?.removeItem(PROFILE_KEY);
      store()?.removeItem(OUTBOX_KEY);
    } catch {
      // ignore
    }
    if (isSupabaseConfigured) {
      void Promise.resolve(supabase.rpc('forget_browsing', { p_visitor_id: id })).then(
        () => undefined,
        () => undefined
      );
    }
  } else {
    loaded = false;
    load();
    scheduleSync();
  }
  notify();
}

// ---------------------------------------------------------------------------------------------
// Envoi vers la base : fiable, sans double comptage
// ---------------------------------------------------------------------------------------------

interface Outbox {
  id: string;
  items: bi.ProductDelta[];
  searches: { q: string; at: number }[];
  searchesUpTo: number;
  snapshots: Record<string, bi.SyncSnapshot>;
}

function readOutbox(): Outbox | null {
  try {
    const raw = store()?.getItem(OUTBOX_KEY);
    if (!raw) return null;
    const box = JSON.parse(raw) as Outbox;
    return box && typeof box.id === 'string' && Array.isArray(box.items) && box.snapshots ? { ...box, searches: Array.isArray(box.searches) ? box.searches : [], searchesUpTo: Number(box.searchesUpTo) || 0 } : null;
  } catch {
    return null;
  }
}

function writeOutbox(box: Outbox | null) {
  try {
    if (box) store()?.setItem(OUTBOX_KEY, JSON.stringify(box));
    else store()?.removeItem(OUTBOX_KEY);
  } catch {
    // ignore
  }
}

const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

function toPayload(d: bi.ProductDelta) {
  return {
    product_id: d.productId,
    name: d.name,
    category_slug: d.categorySlug,
    category_name: d.categoryName,
    views: d.views,
    sessions: d.sessions,
    active_seconds: d.activeSeconds,
    last_duration_seconds: d.lastDurationSeconds,
    last_viewed_at: iso(d.lastViewedAt),
    image_clicks: d.imageClicks,
    size_clicks: d.sizeClicks,
    color_clicks: d.colorClicks,
    returns_after_others: d.returnsAfterOthers,
    cart_status: d.cartStatus,
    interest: d.interest,
    last_suggestion_kind: d.lastSuggestionKind,
    last_suggestion_at: iso(d.lastSuggestionAt),
  };
}

function scheduleSync(delay: number = SYNC_DEBOUNCE_MS) {
  if (!isWeb() || !isSupabaseConfigured || syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushToServer();
  }, delay);
}

export async function flushToServer(force = false, depth = 0): Promise<void> {
  if (!isSupabaseConfigured || !isTrackingEnabled() || syncInFlight) return;
  const now = Date.now();
  if (now < syncBlockedUntil) return; // la base n'a pas encore le script : même à la fermeture d'une page, on n'insiste pas
  if (!force && now - lastSyncAttempt < SYNC_MIN_GAP_MS) return;
  load();
  if (!profile) return;
  flushActive(false);
  // un courrier déjà prêt (envoi précédent coupé) repart tel quel, avec le même numéro d'envoi : la base ne le compte qu'une fois
  let box = readOutbox();
  if (!box) {
    const { deltas, snapshots, searches, searchesUpTo } = bi.pendingDeltas(profile);
    if (deltas.length === 0 && searches.length === 0) return;
    box = { id: uuid(), items: deltas, searches, searchesUpTo, snapshots };
    writeOutbox(box);
  }
  syncInFlight = true;
  lastSyncAttempt = now;
  let followUp = false;
  try {
    const sessionId = await getCurrentSessionId(null).catch(() => null);
    const { error } = await supabase.rpc('track_browsing', {
      p_visitor_id: profile.visitorId,
      p_session_id: sessionId,
      p_batch_id: box.id,
      p_items: box.items.map(toPayload),
      p_searches: box.searches.map((x) => ({ q: x.q, at: iso(x.at) })),
    });
    if (error) {
      // la fonction n'existe pas encore dans la base (script pas appliqué) : on se tait pendant 10 minutes
      if ((error as { code?: string }).code === 'PGRST202') syncBlockedUntil = Date.now() + SYNC_MISSING_RETRY_MS;
      throw error;
    }
    // reçu : on note ce qui est parti (et seulement ça), et le courrier est supprimé
    if (profile && isTrackingEnabled()) {
      profile = bi.markSynced(profile, box.snapshots, box.searchesUpTo);
      save();
    }
    writeOutbox(null);
    // il reste peut-être des gestes arrivés pendant l'envoi
    if (profile) {
      const rest = bi.pendingDeltas(profile);
      if (rest.deltas.length > 0 || rest.searches.length > 0) {
        // à la fermeture d'une page, un courrier en retard est parti en premier : le reste part tout de suite, sans attendre un minuteur que l'onglet figé n'exécutera pas
        if (force && depth < 2) followUp = true;
        else scheduleSync();
      }
    }
  } catch {
    scheduleSync(syncBlockedUntil > Date.now() ? SYNC_MISSING_RETRY_MS : SYNC_RETRY_MS);
  } finally {
    syncInFlight = false;
  }
  if (followUp) await flushToServer(true, depth + 1);
}

// ---------------------------------------------------------------------------------------------
// Démarrage (une seule fois, sur le site)
// ---------------------------------------------------------------------------------------------

export function initBrowsingTracker(): void {
  if (!isWeb() || installed) return;
  installed = true;
  if (isTrackingEnabled()) load();

  const touch = () => {
    lastInteractionAt = Date.now();
  };
  for (const name of ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel', 'click']) {
    window.addEventListener(name, touch, { passive: true, capture: true });
  }
  window.addEventListener(
    'pointermove',
    () => {
      const now = Date.now();
      if (now - lastMoveAt > 1000) {
        lastMoveAt = now;
        lastInteractionAt = now;
      }
    },
    { passive: true, capture: true }
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushActive(false);
      void flushToServer(true);
    } else {
      lastInteractionAt = Date.now(); // il revient sur l'onglet
    }
  });
  window.addEventListener('pagehide', () => {
    flushActive(false);
    void flushToServer(true);
  });
  window.addEventListener('online', () => void flushToServer(true));

  // courrier resté sur le téléphone (envoi coupé à la visite précédente) : il repart peu après l'ouverture
  if (isTrackingEnabled() && readOutbox()) scheduleSync(5000);
}
