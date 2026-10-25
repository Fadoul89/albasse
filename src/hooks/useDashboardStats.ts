import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order, Product } from '../types';
import { countsAsSale, salesTotal } from '../lib/salesRules';

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

export interface BrowserStat {
  browser: string;
  count: number;
}

export interface DashboardStats {
  revenueToday: number;
  ordersToday: number; // commandes livrées (et non fausses) créées aujourd'hui
  ordersReceivedToday: number; // commandes reçues aujourd'hui, livrées ou pas encore
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
  shortcutsByBrowser: BrowserStat[];
  shortcutsByDevice: BrowserStat[];
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
      shortcutsBrowserRes,
    ] = await Promise.all([
      supabase.from('orders').select('id,total,status,is_flagged_fake,created_at,session_id,referrer_source,items').gte('created_at', todayIso),
      supabase
        .from('orders')
        .select('id,total,status,is_flagged_fake,created_at,session_id,referrer_source,items')
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
      supabase.from('app_installs').select('browser,device_type').eq('install_type', 'shortcut'),
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

    // seules les commandes livrées et non signalées fausses comptent (voir lib/salesRules.ts)
    const revenueToday = salesTotal(ordersToday);
    const ordersDeliveredToday = ordersToday.filter(countsAsSale).length;
    // commandes reçues aujourd'hui (ni annulées ni fausses) : pas encore comptées tant qu'elles ne sont pas livrées
    const ordersReceivedToday = ordersToday.filter((o) => o.status !== 'cancelled' && !o.is_flagged_fake).length;
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

    // Produits les plus vendus (depuis les items des commandes livrees, 30 derniers jours)
    const salesCounts: Record<string, { name: string; count: number }> = {};
    ordersWindow
      .filter(countsAsSale)
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
      const sourceOrders = ordersWindow.filter((o) => o.session_id && sessionIds.has(o.session_id) && countsAsSale(o));
      const sourceRevenue = salesTotal(sourceOrders);

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

    const browserCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};
    ((shortcutsBrowserRes.data ?? []) as { browser: string | null; device_type: string | null }[]).forEach(
      ({ browser, device_type }) => {
        const bKey = browser ?? 'Autre';
        browserCounts[bKey] = (browserCounts[bKey] ?? 0) + 1;
        const dKey = device_type ?? 'PC';
        deviceCounts[dKey] = (deviceCounts[dKey] ?? 0) + 1;
      }
    );
    const shortcutsByBrowser: BrowserStat[] = Object.entries(browserCounts)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count);
    const shortcutsByDevice: BrowserStat[] = Object.entries(deviceCounts)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count);

    setStats({
      revenueToday,
      ordersToday: ordersDeliveredToday,
      ordersReceivedToday,
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
      shortcutsByBrowser,
      shortcutsByDevice,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { stats, isLoading, refresh };
}
