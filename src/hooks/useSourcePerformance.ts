import { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TRAFFIC_SOURCES, type TrafficSource } from '../lib/analytics';
import type { Order } from '../types';
import { countsAsSale, salesTotal } from '../lib/salesRules';
import { buildLeaderboard, parseSourceReport, type CampaignRow, type Leaderboard, type ReportTotals, type SourceReport, type SourceRow } from '../lib/sourceReport';

export type { CampaignRow, Leaderboard, ReportTotals, SourceRow };

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  '7d': '7 jours',
  '30d': '30 jours',
  month: 'Ce mois',
  lastMonth: 'Mois précédent',
  custom: 'Personnalisé',
};

export const SOURCE_STYLE: Record<TrafficSource, { emoji: string; color: string }> = {
  TikTok: { emoji: '🟣', color: '#c96bf0' },
  Facebook: { emoji: '🔵', color: '#4a8cff' },
  Instagram: { emoji: '🟠', color: '#e1306c' },
  Google: { emoji: '🔴', color: '#ea4335' },
  WhatsApp: { emoji: '🟢', color: '#25d366' },
  'Accès direct': { emoji: '🌐', color: '#c79a3e' },
  'Publicité / campagne': { emoji: '📢', color: '#d8232a' },
  Autre: { emoji: '🔗', color: 'rgba(244, 239, 228, 0.6)' },
};

type SessionRow = {
  id: string;
  visitor_id: string | null;
  user_id: string | null;
  started_at: string;
  duration_seconds: number;
  page_views: number;
  referrer_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getPeriodRange(period: Period, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case '30d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: endOfDay(e) };
    }
    case 'custom':
      return {
        start: customStart ? startOfDay(new Date(customStart)) : startOfDay(now),
        end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
      };
  }
}

function visitorKey(s: SessionRow): string {
  return s.visitor_id ?? s.user_id ?? s.id;
}

export function useSourcePerformance() {
  const [period, setPeriod] = useState<Period>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [firstSeen, setFirstSeen] = useState<Record<string, string>>({});
  const [views, setViews] = useState<{ product_id: string; session_id: string | null }[]>([]);
  const [cartAdds, setCartAdds] = useState<{ session_id: string | null }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  // le rapport exact compté par la base (add-source-report.sql) ; null tant que ce script n'est pas lancé : l'ancien calcul prend alors le relais
  const [report, setReport] = useState<SourceReport | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { start, end } = getPeriodRange(period, customStart, customEnd);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // La base compte elle-même (exact, sans la limite de 1 000 lignes par demande) : visiteurs, nouveaux, temps moyen, pages, articles vus, paniers,
    // commandes, ventes, vraies visites, campagnes. En cas d'erreur (script pas lancé) : null, et l'ancienne lecture ligne par ligne prend le relais.
    const reportRes = await supabase.rpc('admin_source_report', { p_since: startIso, p_until: endIso });
    const exact = reportRes.error ? null : parseSourceReport(reportRes.data, TRAFFIC_SOURCES);
    if (exact) {
      setReport(exact);
      setSessions([]);
      setFirstSeen({});
      setViews([]);
      setCartAdds([]);
      setOrders([]);
      setIsLoading(false);
      return;
    }
    setReport(null);

    const sessionsRes = await supabase
      .from('visitor_sessions')
      .select('id,visitor_id,user_id,started_at,duration_seconds,page_views,referrer_source,utm_medium,utm_campaign')
      .gte('started_at', startIso)
      .lte('started_at', endIso);

    const periodSessions = (sessionsRes.data as SessionRow[]) ?? [];
    setSessions(periodSessions);

    // "Nouveau vs recurrent" a besoin de la toute premiere visite de chaque
    // visiteur de la periode : une agregation cote base (RPC), bornee aux
    // visiteurs concernes, plutot que de rapatrier l'historique complet des
    // sessions qui depasse la limite de lignes renvoyees par defaut.
    const visitorKeysInPeriod = Array.from(new Set(periodSessions.map(visitorKey)));
    const firstSeenMap: Record<string, string> = {};
    if (visitorKeysInPeriod.length > 0) {
      const firstSeenRes = await supabase.rpc('get_visitor_first_seen', { keys: visitorKeysInPeriod });
      ((firstSeenRes.data as { visitor_key: string; first_seen_at: string }[]) ?? []).forEach((row) => {
        firstSeenMap[row.visitor_key] = row.first_seen_at;
      });
    }
    setFirstSeen(firstSeenMap);

    const sessionIds = periodSessions.map((s) => s.id);
    if (sessionIds.length === 0) {
      setViews([]);
      setCartAdds([]);
      setOrders([]);
      setIsLoading(false);
      return;
    }

    const [viewsRes, cartRes, ordersRes] = await Promise.all([
      supabase.from('product_views').select('product_id,session_id').in('session_id', sessionIds),
      supabase.from('cart_events').select('session_id').in('session_id', sessionIds),
      supabase
        .from('orders')
        .select('id,total,status,is_flagged_fake,created_at,session_id,referrer_source,items')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
    ]);

    setViews((viewsRes.data as { product_id: string; session_id: string | null }[]) ?? []);
    setCartAdds((cartRes.data as { session_id: string | null }[]) ?? []);
    setOrders((ordersRes.data as Order[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd]);

  const { rows, campaigns, leaderboard, totals } = useMemo(() => {
    if (report) return { rows: report.rows, campaigns: report.campaigns, leaderboard: buildLeaderboard(report.rows), totals: report.totals as ReportTotals | null };
    const { start, end } = getPeriodRange(period, customStart, customEnd);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // sessions est deja filtre sur la periode selectionnee cote serveur.
    const inPeriod = sessions;

    const rows: SourceRow[] = TRAFFIC_SOURCES.map((source) => {
      const sourceSessions = inPeriod.filter((s) => (s.referrer_source ?? 'Autre') === source);
      const sessionIds = new Set(sourceSessions.map((s) => s.id));
      const visitorKeys = new Set(sourceSessions.map(visitorKey));
      const newVisitorKeys = new Set(
        Array.from(visitorKeys).filter((k) => firstSeen[k] >= startIso && firstSeen[k] <= endIso)
      );

      const sourceViews = views.filter((v) => v.session_id && sessionIds.has(v.session_id)).length;
      const sourceCartAdds = cartAdds.filter((c) => c.session_id && sessionIds.has(c.session_id)).length;
      const sourceOrders = orders.filter(
        (o) => o.session_id && sessionIds.has(o.session_id) && o.created_at >= startIso && o.created_at <= endIso && countsAsSale(o)
      );
      const revenue = salesTotal(sourceOrders);

      const totalDuration = sourceSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
      const totalPages = sourceSessions.reduce((sum, s) => sum + (s.page_views ?? 1), 0);

      return {
        source,
        visitors: visitorKeys.size,
        newVisitors: newVisitorKeys.size,
        returningVisitors: visitorKeys.size - newVisitorKeys.size,
        avgTimeSeconds: sourceSessions.length > 0 ? Math.round(totalDuration / sourceSessions.length) : 0,
        pagesViewed: totalPages,
        productViews: sourceViews,
        cartAdds: sourceCartAdds,
        orders: sourceOrders.length,
        revenue,
        conversionRate: visitorKeys.size > 0 ? (sourceOrders.length / visitorKeys.size) * 100 : 0,
      };
    });

    // Detail des campagnes publicitaires (utm_campaign)
    const campaignKeys = new Set(inPeriod.filter((s) => s.utm_campaign).map((s) => s.utm_campaign as string));
    const campaigns: CampaignRow[] = Array.from(campaignKeys).map((campaign) => {
      const campaignSessions = inPeriod.filter((s) => s.utm_campaign === campaign);
      const sessionIds = new Set(campaignSessions.map((s) => s.id));
      const visitorKeys = new Set(campaignSessions.map(visitorKey));
      const campaignOrders = orders.filter((o) => o.session_id && sessionIds.has(o.session_id) && countsAsSale(o));
      const revenue = salesTotal(campaignOrders);

      return {
        campaign,
        medium: campaignSessions[0]?.utm_medium ?? null,
        source: (campaignSessions[0]?.referrer_source as TrafficSource) ?? 'Autre',
        visitors: visitorKeys.size,
        orders: campaignOrders.length,
        revenue,
        conversionRate: visitorKeys.size > 0 ? (campaignOrders.length / visitorKeys.size) * 100 : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const leaderboard: Leaderboard = buildLeaderboard(rows);

    return { rows, campaigns, leaderboard, totals: null as ReportTotals | null };
  }, [report, sessions, firstSeen, views, cartAdds, orders, period, customStart, customEnd]);

  return {
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    rows,
    campaigns,
    leaderboard,
    totals,
    isLoading,
    refresh,
  };
}
