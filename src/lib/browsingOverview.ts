// Le « tableau de suivi » des administrateurs : ce que les visiteurs ont regardé, avec le niveau d'intérêt estimé.
// La base donne des références anonymes (V-xxxxxx pour un visiteur, C-xxxxxxxx pour un compte) : jamais le nom ni le téléphone.
// Aucun écran, aucun réseau : tout est testable.

import type { CartStatus, InterestLevel, SuggestionKind } from './browsingInsights';

export interface OverviewRow {
  visitorRef: string;
  accountRef: string | null;
  sessionId: string | null;
  productId: string;
  productName: string;
  categoryName: string | null;
  views: number;
  sessions: number;
  activeSeconds: number;
  lastDurationSeconds: number;
  lastViewedAt: string | null;
  variantClicks: number;
  cartStatus: CartStatus;
  orderStatus: string | null;
  interest: InterestLevel;
  lastSuggestionKind: SuggestionKind | null;
  lastSuggestionAt: string | null;
}

export interface TopProduct {
  productId: string;
  name: string;
  category: string | null;
  views: number;
  activeSeconds: number;
  visitors: number;
  highInterest: number;
}

export interface BrowsingOverview {
  rows: OverviewRow[];
  topProducts: TopProduct[];
  topCategories: { category: string; views: number; visitors: number }[];
  topSearches: { query: string; count: number }[];
  levels: Record<InterestLevel, number>;
  totals: { visitors: number; rows: number };
}

const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);

const CART: CartStatus[] = ['none', 'in_cart', 'removed', 'purchased'];
const LEVELS: InterestLevel[] = ['leger', 'moyen', 'eleve'];
const KINDS: SuggestionKind[] = ['product_revisit', 'variants', 'perfume_browse', 'category_browse'];

// Réponse de la base (browsing_overview) -> données sûres pour l'écran, même si un champ manque.
export function buildBrowsingOverview(raw: unknown): BrowsingOverview {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const levelsRaw = (r.levels && typeof r.levels === 'object' ? r.levels : {}) as Record<string, unknown>;
  const totals = (r.totals && typeof r.totals === 'object' ? r.totals : {}) as Record<string, unknown>;
  return {
    rows: arr(r.rows).map((x) => ({
      visitorRef: str(x.visitor_ref) ?? 'V-?',
      accountRef: str(x.account_ref),
      sessionId: str(x.session_id),
      productId: str(x.product_id) ?? '',
      productName: str(x.product_name) ?? 'Article sans nom',
      categoryName: str(x.category_name),
      views: int(x.views),
      sessions: int(x.sessions),
      activeSeconds: int(x.active_seconds),
      lastDurationSeconds: int(x.last_duration_seconds),
      lastViewedAt: str(x.last_viewed_at),
      variantClicks: int(x.variant_clicks),
      cartStatus: CART.includes(x.cart_status as CartStatus) ? (x.cart_status as CartStatus) : 'none',
      orderStatus: str(x.order_status),
      interest: LEVELS.includes(x.interest as InterestLevel) ? (x.interest as InterestLevel) : 'leger',
      lastSuggestionKind: KINDS.includes(x.last_suggestion_kind as SuggestionKind) ? (x.last_suggestion_kind as SuggestionKind) : null,
      lastSuggestionAt: str(x.last_suggestion_at),
    })),
    topProducts: arr(r.top_products).map((x) => ({
      productId: str(x.product_id) ?? '',
      name: str(x.product_name) ?? 'Article sans nom',
      category: str(x.category_name),
      views: int(x.views),
      activeSeconds: int(x.active_seconds),
      visitors: int(x.visitors),
      highInterest: int(x.high_interest),
    })),
    topCategories: arr(r.top_categories).map((x) => ({ category: str(x.category) ?? 'Sans catégorie', views: int(x.views), visitors: int(x.visitors) })),
    topSearches: arr(r.top_searches).map((x) => ({ query: str(x.query) ?? '', count: int(x.n) })).filter((x) => x.query),
    levels: { leger: int(levelsRaw.leger), moyen: int(levelsRaw.moyen), eleve: int(levelsRaw.eleve) },
    totals: { visitors: int(totals.visitors), rows: int(totals.rows) },
  };
}

export const CART_LABELS: Record<CartStatus, string> = {
  none: 'Pas au panier',
  in_cart: 'Au panier',
  removed: 'Retiré du panier',
  purchased: 'Acheté',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const SUGGESTION_LABELS: Record<SuggestionKind, string> = {
  product_revisit: 'Tailles / modèles similaires',
  variants: 'Couleurs et tailles',
  perfume_browse: 'Familles de parfums',
  category_browse: 'Autres articles de la catégorie',
};

export type InterestFilter = 'all' | InterestLevel;
export const INTEREST_FILTERS: InterestFilter[] = ['all', 'eleve', 'moyen', 'leger'];

export function filterRows(rows: OverviewRow[], filter: InterestFilter): OverviewRow[] {
  return filter === 'all' ? rows : rows.filter((r) => r.interest === filter);
}

// 75 -> « 1 min 15 s », 8 -> « 8 s », 3600 -> « 1 h 00 min »
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

// « il y a 5 min », « il y a 3 h », « il y a 2 j » ; au-delà de 30 jours, la date.
export function formatAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return 'à l’instant';
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d <= 30) return `il y a ${d} j`;
  return new Date(t).toLocaleDateString('fr-FR');
}
