// Vrais chiffres des visites (add-visit-stats.sql) : la base compte elle-même, le site lit seulement le résultat.
// Avant, le tableau de bord et Admin › Clients relisaient les visites une par une, et la base ne renvoie que 1 000 lignes par demande :
// « Visiteurs aujourd'hui » se bloquait à 900 alors qu'il y avait 1 618 visiteurs.
// « Vraie visite » = la personne reste 20 secondes ou plus, OU voit 2 pages ou plus, OU est connectée (même règle dans le script SQL).
// Des fonctions pures, sans réseau : testées dans tests/email/visit-stats.test.ts. Un résultat illisible (script SQL pas encore lancé,
// ou fonction refusée) donne null : l'appelant garde alors son ancien calcul au lieu d'afficher un nombre inventé.
import { percent } from './clientGender';

export const REAL_VISIT_SECONDS = 20;

export interface VisitSource {
  source: string;
  sessions: number;
  visitors: number;
  realSessions: number;
  realVisitors: number;
  productViews: number;
  cartAdds: number;
  orders: number;
  revenue: number;
}
export interface VisitCampaign {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  realSessions: number;
}
export interface VisitOverview {
  sessions: number;
  visitors: number;
  realSessions: number;
  realVisitors: number;
  bySource: VisitSource[];
  byCampaign: VisitCampaign[];
  topViewed: { productId: string; views: number }[];
}
export interface CustomerActivity {
  userId: string;
  sessions: number;
  durationSeconds: number;
  lastSeenAt: string | null;
  topSource: string | null;
  views: number;
  cartAdds: number;
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
// un nombre ou un texte numérique (la base renvoie parfois les montants en texte) ; sinon null
export const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
export const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function parseVisitOverview(raw: unknown): VisitOverview | null {
  if (!isObject(raw)) return null;
  const sessions = num(raw.sessions);
  const visitors = num(raw.visitors);
  const realSessions = num(raw.real_sessions);
  const realVisitors = num(raw.real_visitors);
  if (sessions === null || visitors === null || realSessions === null || realVisitors === null) return null;

  const bySource: VisitSource[] = [];
  for (const row of Array.isArray(raw.by_source) ? raw.by_source : []) {
    if (!isObject(row)) continue;
    const source = text(row.source);
    const s = num(row.sessions);
    if (!source || s === null) continue;
    bySource.push({
      source,
      sessions: s,
      visitors: num(row.visitors) ?? s,
      realSessions: num(row.real_sessions) ?? 0,
      realVisitors: num(row.real_visitors) ?? 0,
      productViews: num(row.product_views) ?? 0,
      cartAdds: num(row.cart_adds) ?? 0,
      orders: num(row.orders) ?? 0,
      revenue: num(row.revenue) ?? 0,
    });
  }
  const byCampaign: VisitCampaign[] = [];
  for (const row of Array.isArray(raw.by_campaign) ? raw.by_campaign : []) {
    if (!isObject(row)) continue;
    const campaign = text(row.campaign);
    const s = num(row.sessions);
    if (!campaign || s === null) continue;
    byCampaign.push({ source: text(row.source) ?? 'Inconnue', medium: text(row.medium) ?? '-', campaign, sessions: s, realSessions: num(row.real_sessions) ?? 0 });
  }
  const topViewed: { productId: string; views: number }[] = [];
  for (const row of Array.isArray(raw.top_viewed) ? raw.top_viewed : []) {
    if (!isObject(row)) continue;
    const productId = text(row.product_id);
    const views = num(row.views);
    if (productId && views !== null) topViewed.push({ productId, views });
  }
  return { sessions, visitors, realSessions, realVisitors, bySource, byCampaign, topViewed };
}

// userId → activité du client ; null si le résultat n'est pas une liste (script SQL pas lancé)
export function parseCustomerActivity(raw: unknown): Map<string, CustomerActivity> | null {
  if (!Array.isArray(raw)) return null;
  const map = new Map<string, CustomerActivity>();
  for (const row of raw) {
    if (!isObject(row)) continue;
    const userId = text(row.user_id);
    if (!userId) continue;
    map.set(userId, {
      userId,
      sessions: num(row.sessions) ?? 0,
      durationSeconds: num(row.duration_seconds) ?? 0,
      lastSeenAt: text(row.last_seen_at),
      topSource: text(row.top_source),
      views: num(row.views) ?? 0,
      cartAdds: num(row.cart_adds) ?? 0,
    });
  }
  return map;
}

// Part de vraies visites : « 68 % » ; « <1 % » quand il y en a, mais moins de 1 sur 100 (jamais « 0 % » pour 1 vraie visite sur 1 524) ; « — » sans visite
export function sharePercent(part: number, total: number): string {
  if (total <= 0) return '—';
  if (part <= 0) return '0 %';
  const pct = (part / total) * 100;
  return pct < 1 ? '<1 %' : percent(part, total);
}

// « 5 sur 1638 (<1 %) »
export const realVisitsLabel = (real: number, total: number): string => `${real} sur ${total} (${sharePercent(real, total)})`;

// Texte court d'une campagne : le numéro de la campagne (c'est celui du Gestionnaire de publicités de Meta) ; le média est ajouté seulement
// quand ce n'est pas « paid » (publicité payante), pour que le numéro de 18 chiffres tienne sur un téléphone
export const campaignLabel = (c: { medium: string; campaign: string }): string =>
  c.medium && c.medium !== '-' && c.medium !== 'paid' ? `${c.medium} · ${c.campaign}` : c.campaign;

// Même règle que le script SQL, pour les anciens calculs (secours avant le script) et les tests
export const isRealVisit = (s: { duration_seconds?: number | null; page_views?: number | null; user_id?: string | null }): boolean =>
  (s.duration_seconds ?? 0) >= REAL_VISIT_SECONDS || (s.page_views ?? 1) >= 2 || !!s.user_id;

// Lecture page par page : la base renvoie au plus 1 000 lignes par demande. Sert aux listes qui peuvent grandir (clients, commandes).
// `page(from, to)` lit les lignes de from à to (comprises) ; on s'arrête à la première page incomplète, ou après 50 pages (garde-fou).
export const PAGE_SIZE = 1000;
export const MAX_PAGES = 50;
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}
