// Page Admin › « Performance par source » : la base compte elle-même (add-source-report.sql, fonction admin_source_report) et le site lit le résultat.
// Avant, la page relisait les visites une par une, et la base ne renvoie que 1 000 lignes par demande : sur 7 ou 30 jours, les chiffres
// ne portaient que sur 1 000 visites. Ici : des fonctions pures, sans réseau (tests/email/source-report.test.ts). Un résultat illisible
// (script SQL pas encore lancé, fonction refusée) donne null : la page garde alors son ancien calcul.
import type { TrafficSource } from './analytics';
import { isObject, num, text } from './visitStats';

export interface SourceRow {
  source: TrafficSource;
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  avgTimeSeconds: number;
  pagesViewed: number;
  productViews: number;
  cartAdds: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  // « vrais visiteurs » (restent 20 s ou plus, voient 2 pages ou plus, ou sont connectés) ; absent tant que add-source-report.sql n'est pas lancé
  realVisitors?: number;
}

export interface CampaignRow {
  campaign: string;
  medium: string | null;
  source: TrafficSource;
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  realVisitors?: number;
}

export interface Leaderboard {
  bestSales: string | null;
  bestConversion: string | null;
  mostVisitors: string | null;
  longestAvgTime: string | null;
}

export interface ReportTotals {
  sessions: number;
  visitors: number;
  realSessions: number;
  realVisitors: number;
}

export interface SourceReport {
  rows: SourceRow[];
  campaigns: CampaignRow[];
  totals: ReportTotals;
}

// conversion = commandes / visiteurs (en %), 0 sans visiteur
export const conversionRate = (orders: number, visitors: number): number => (visitors > 0 ? (orders / visitors) * 100 : 0);

// `sources` : la liste des sources de la page (TRAFFIC_SOURCES), dans l'ordre d'affichage. Une source sans visite donne une ligne à zéro.
export function parseSourceReport(raw: unknown, sources: readonly TrafficSource[]): SourceReport | null {
  if (!isObject(raw) || !isObject(raw.totals) || !Array.isArray(raw.sources) || !Array.isArray(raw.campaigns)) return null;
  const t = raw.totals;
  const sessions = num(t.sessions);
  const visitors = num(t.visitors);
  const realSessions = num(t.real_sessions);
  const realVisitors = num(t.real_visitors);
  if (sessions === null || visitors === null || realSessions === null || realVisitors === null) return null;

  const bySource = new Map<string, Record<string, unknown>>();
  for (const row of raw.sources) {
    if (!isObject(row)) continue;
    const name = text(row.source);
    if (name && num(row.sessions) !== null) bySource.set(name, row);
  }
  const rows: SourceRow[] = sources.map((source) => {
    const r = bySource.get(source);
    const v = r ? num(r.visitors) ?? 0 : 0;
    const nv = r ? num(r.new_visitors) ?? 0 : 0;
    const orders = r ? num(r.orders) ?? 0 : 0;
    return {
      source,
      visitors: v,
      newVisitors: nv,
      returningVisitors: Math.max(0, v - nv),
      avgTimeSeconds: r ? num(r.avg_time_seconds) ?? 0 : 0,
      pagesViewed: r ? num(r.pages_viewed) ?? 0 : 0,
      productViews: r ? num(r.product_views) ?? 0 : 0,
      cartAdds: r ? num(r.cart_adds) ?? 0 : 0,
      orders,
      revenue: r ? num(r.revenue) ?? 0 : 0,
      conversionRate: conversionRate(orders, v),
      realVisitors: r ? num(r.real_visitors) ?? 0 : 0,
    };
  });

  const campaigns: CampaignRow[] = [];
  for (const row of raw.campaigns) {
    if (!isObject(row)) continue;
    const campaign = text(row.campaign);
    const v = num(row.visitors);
    if (!campaign || v === null) continue;
    const src = text(row.source);
    const orders = num(row.orders) ?? 0;
    campaigns.push({
      campaign,
      medium: text(row.medium),
      source: src && (sources as readonly string[]).includes(src) ? (src as TrafficSource) : ('Autre' as TrafficSource),
      visitors: v,
      orders,
      revenue: num(row.revenue) ?? 0,
      conversionRate: conversionRate(orders, v),
      realVisitors: num(row.real_visitors) ?? 0,
    });
  }
  return { rows, campaigns, totals: { sessions, visitors, realSessions, realVisitors } };
}

// « Classement automatique » : la meilleure source pour les ventes, la conversion, les visiteurs et le temps moyen (jamais une source à zéro)
export function buildLeaderboard(rows: SourceRow[]): Leaderboard {
  const withVisitors = rows.filter((r) => r.visitors > 0);
  const bestSales = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
  const bestConversion = [...withVisitors].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  const mostVisitors = [...rows].sort((a, b) => b.visitors - a.visitors)[0];
  const longestAvgTime = [...withVisitors].sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds)[0];
  return {
    bestSales: bestSales && bestSales.revenue > 0 ? bestSales.source : null,
    bestConversion: bestConversion && bestConversion.conversionRate > 0 ? bestConversion.source : null,
    mostVisitors: mostVisitors && mostVisitors.visitors > 0 ? mostVisitors.source : null,
    longestAvgTime: longestAvgTime && longestAvgTime.avgTimeSeconds > 0 ? longestAvgTime.source : null,
  };
}
