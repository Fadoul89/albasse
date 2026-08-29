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
}

const LOW_STOCK_THRESHOLD = 5;

function startOfToday(): string {
  const d = new Date();
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

    const [ordersRes, profilesRes, sessionsRes, viewsRes, cartRes, productsRes] = await Promise.all([
      supabase.from('orders').select('id,total,status,created_at,session_id,referrer_source,items'),
      supabase.from('profiles').select('id,created_at').eq('is_admin', false),
      supabase.from('visitor_sessions').select('id,started_at,referrer_source'),
      supabase.from('product_views').select('product_id,session_id'),
      supabase.from('cart_events').select('session_id'),
      supabase.from('products').select('*'),
    ]);

    const orders = (ordersRes.data as Order[]) ?? [];
    const profiles = (profilesRes.data as { id: string; created_at: string }[]) ?? [];
    const sessions = (sessionsRes.data as { id: string; started_at: string; referrer_source: string | null }[]) ?? [];
    const views = (viewsRes.data as { product_id: string; session_id: string | null }[]) ?? [];
    const cartAdds = (cartRes.data as { session_id: string | null }[]) ?? [];
    const products = (productsRes.data as Product[]) ?? [];

    const ordersToday = orders.filter((o) => o.created_at >= todayIso);
    const revenueToday = ordersToday
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const newCustomersToday = profiles.filter((p) => p.created_at >= todayIso).length;
    const visitorsToday = sessions.filter((s) => s.started_at >= todayIso).length;

    // Produits les plus consultes
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

    // Produits les plus vendus (depuis les items des commandes non annulees)
    const salesCounts: Record<string, { name: string; count: number }> = {};
    orders
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

    // Performance par source marketing
    const sessionSource: Record<string, string> = {};
    sessions.forEach((s) => {
      sessionSource[s.id] = s.referrer_source ?? 'Inconnue';
    });

    const sourceKeys = new Set<string>();
    sessions.forEach((s) => sourceKeys.add(s.referrer_source ?? 'Inconnue'));

    const sourcePerformance: SourcePerformance[] = Array.from(sourceKeys).map((source) => {
      const sourceSessions = sessions.filter((s) => (s.referrer_source ?? 'Inconnue') === source);
      const sessionIds = new Set(sourceSessions.map((s) => s.id));

      const sourceViews = views.filter((v) => v.session_id && sessionIds.has(v.session_id)).length;
      const sourceCartAdds = cartAdds.filter((c) => c.session_id && sessionIds.has(c.session_id)).length;
      const sourceOrders = orders.filter((o) => o.session_id && sessionIds.has(o.session_id));
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
    });
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { stats, isLoading, refresh };
}
