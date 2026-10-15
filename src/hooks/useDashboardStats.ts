import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order, Product } from '../types';

export interface TopProduct {
  product_id: string;
  name: string;
  count: number;
}

export interface SourcePerformance {
  source: string;
  sessions: number;
  productViews: number;
  cartAdds: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface DashboardStats {
  revenueToday: number;
  ordersToday: number;
  newCustomersToday: number;
  visitorsToday: number;
  mostViewedProducts: TopProduct[];
  bestSellingProducts: TopProduct[];
  lowStockProducts: Product[];
  sourcePerformance: SourcePerformance[];
  appDownloadClicksTotal: number;
  appDownloadClicksToday: number;
  appInstallsTotal: number;
  appInstallsToday: number;
}

const LOW_STOCK_THRESHOLD = 5;
// Les classements (produits vus/vendus, performance par source) portent sur
// une fenetre recente plutot que l'historique complet : au-dela de 1000
// lignes, Supabase ne renvoie qu'une page arbitraire de resultats, donc
// charger des tables d'evenements non bornees finit par rendre les stats
// fausses (ex. "0 visiteur aujourd'hui" alors que des visites existent).
const RECENT_WINDOW_DAYS = 30;

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function recentWindowStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_WINDOW_DAYS);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const todayIso = startOfToday();
    const windowStartIso = recentWindowStart();

    const [
      ordersTodayRes,
      ordersWindowRes,
      profilesTodayRes,
      sessionsTodayRes,
      sessionsWindowRes,
      viewsWindowRes,
      cartWindowRes,
      productsRes,
      downloadsTotalRes,
      downloadsTodayRes,
      installsTotalRes,
      installsTodayRes,
    ] = await Promise.all([
      supabase.from('orders').select('id,total,status,created_at,session_id,referrer_source,items').gte('created_at', todayIso),
      supabase
        .from('orders')
        .select('id,total,status,created_at,session_id,referrer_source,items')
        .gte('created_at', windowStartIso),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', false).gte('created_at', todayIso),
      supabase
        .from('visitor_sessions')
        .select('id,started_at,referrer_source,visitor_id')
        .gte('started_at', todayIso),
      supabase
        .from('visitor_sessions')
        .select('id,started_at,referrer_source,visitor_id')
        .gte('started_at', windowStartIso),
      supabase.from('product_views').select('product_id,session_id,created_at').gte('created_at', windowStartIso),
      supabase.from('cart_events').select('session_id,created_at').gte('created_at', windowStartIso),
      supabase.from('products').select('*'),
      supabase.from('app_download_clicks').select('id', { count: 'exact', head: true }),
      supabase.from('app_download_clicks').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
      supabase.from('app_installs').select('id', { count: 'exact', head: true }),
      supabase.from('app_installs').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    ]);

    const ordersToday = (ordersTodayRes.data as Order[]) ?? [];
    const ordersWindow = (ordersWindowRes.data as Order[]) ?? [];
    const sessionsToday =
      (sessionsTodayRes.data as { id: string; started_at: string; referrer_source: string | null; visitor_id: string | null }[]) ?? [];
    const sessionsWindow =
      (sessionsWindowRes.data as { id: string; started_at: string; referrer_source: string | null; visitor_id: string | null }[]) ?? [];
    const views = (viewsWindowRes.data as { product_id: string; session_id: string | null }[]) ?? [];
    const cartAdds = (cartWindowRes.data as { session_id: string | null }[]) ?? [];
    const products = (productsRes.data as Product[]) ?? [];

    const revenueToday = ordersToday
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const newCustomersToday = profilesTodayRes.count ?? 0;
    const visitorsToday = new Set(sessionsToday.map((s) => s.visitor_id ?? s.id)).size;

    // Produits les plus consultes (30 derniers jours)
    const viewCounts: Record<string, number> = {};
    views.forEach((v) => {
      viewCounts[v.product_id] = (viewCounts[v.product_id] ?? 0) + 1;
    });
    const mostViewedProducts: TopProduct[] = Object.entries(viewCounts)
      .map(([product_id, count]) => ({
        product_id,
        count,
        name: products.find((p) => p.id === product_id)?.name ?? 'Produit supprimé',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Produits les plus vendus (depuis les items des commandes non annulees, 30 derniers jours)
    const salesCounts: Record<string, { name: string; count: number }> = {};
    ordersWindow
      .filter((o) => o.status !== 'cancelled')
      .forEach((o) => {
        (o.items ?? []).forEach((it) => {
          if (!salesCounts[it.product_id]) salesCounts[it.product_id] = { name: it.product_name, count: 0 };
          salesCounts[it.product_id].count += it.quantity;
        });
      });
    const bestSellingProducts: TopProduct[] = Object.entries(salesCounts)
      .map(([product_id, v]) => ({ product_id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const lowStockProducts = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock);

    // Performance par source marketing (30 derniers jours)
    const sourceKeys = new Set<string>();
    sessionsWindow.forEach((s) => sourceKeys.add(s.referrer_source ?? 'Inconnue'));

    const sourcePerformance: SourcePerformance[] = Array.from(sourceKeys).map((source) => {
      const sourceSessions = sessionsWindow.filter((s) => (s.referrer_source ?? 'Inconnue') === source);
      const sessionIds = new Set(sourceSessions.map((s) => s.id));

      const sourceViews = views.filter((v) => v.session_id && sessionIds.has(v.session_id)).length;
      const sourceCartAdds = cartAdds.filter((c) => c.session_id && sessionIds.has(c.session_id)).length;
      const sourceOrders = ordersWindow.filter((o) => o.session_id && sessionIds.has(o.session_id));
      const sourceRevenue = sourceOrders
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total), 0);

      return {
        source,
        sessions: sourceSessions.length,
        productViews: sourceViews,
        cartAdds: sourceCartAdds,
        orders: sourceOrders.length,
        revenue: sourceRevenue,
        conversionRate: sourceSessions.length > 0 ? (sourceOrders.length / sourceSessions.length) * 100 : 0,
      };
    });
    sourcePerformance.sort((a, b) => b.sessions - a.sessions);

    setStats({
      revenueToday,
      ordersToday: ordersToday.length,
      newCustomersToday,
      visitorsToday,
      mostViewedProducts,
      bestSellingProducts,
      lowStockProducts,
      sourcePerformance,
      appDownloadClicksTotal: downloadsTotalRes.count ?? 0,
      appDownloadClicksToday: downloadsTodayRes.count ?? 0,
      appInstallsTotal: installsTotalRes.count ?? 0,
      appInstallsToday: installsTodayRes.count ?? 0,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { stats, isLoading, refresh };
}
