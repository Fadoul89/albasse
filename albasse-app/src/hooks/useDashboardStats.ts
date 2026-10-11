import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/order';
import type { Product } from '../data';

export interface TopProduct {
  product_id: string;
  name: string;
  count: number;
}

export interface DashboardStats {
  revenueToday: number;
  ordersToday: number;
  newCustomersToday: number;
  mostViewedProducts: TopProduct[];
  bestSellingProducts: TopProduct[];
  lowStockProducts: { id: string; name: string; stock: number }[];
}

const LOW_STOCK_THRESHOLD = 5;

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    const todayIso = startOfToday();

    const [ordersRes, profilesRes, viewsRes, productsRes] = await Promise.all([
      supabase.from('orders').select('id,total,status,created_at,items'),
      supabase.from('profiles').select('id,created_at').eq('is_admin', false),
      supabase.from('product_views').select('product_id'),
      supabase.from('products').select('id,name,stock').eq('is_active', true),
    ]);

    const orders = (ordersRes.data as Order[]) ?? [];
    const profiles = (profilesRes.data as { id: string; created_at: string }[]) ?? [];
    const views = (viewsRes.data as { product_id: string }[]) ?? [];
    const products = (productsRes.data as Pick<Product, 'id' | 'name' | 'stock'>[]) ?? [];

    const ordersToday = orders.filter((o) => o.created_at >= todayIso);
    const revenueToday = ordersToday.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total), 0);
    const newCustomersToday = profiles.filter((p) => p.created_at >= todayIso).length;

    const viewCounts: Record<string, number> = {};
    views.forEach((v) => {
      viewCounts[v.product_id] = (viewCounts[v.product_id] ?? 0) + 1;
    });
    const mostViewedProducts: TopProduct[] = Object.entries(viewCounts)
      .map(([product_id, count]) => ({ product_id, count, name: products.find((p) => p.id === product_id)?.name ?? 'Produit' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

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

    const lowStockProducts = products
      .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    setStats({ revenueToday, ordersToday: ordersToday.length, newCustomersToday, mostViewedProducts, bestSellingProducts, lowStockProducts });
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { stats, isLoading, refresh };
}
