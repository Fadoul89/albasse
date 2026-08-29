import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order } from '../types';

export interface ViewedProduct {
  product_id: string;
  name: string;
  count: number;
}

export function useCustomerActivity(userId: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewedProducts, setViewedProducts] = useState<ViewedProduct[]>([]);
  const [cartAddCount, setCartAddCount] = useState(0);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('product_views').select('product_id').eq('user_id', userId),
      supabase.from('cart_events').select('id').eq('user_id', userId),
    ]).then(async ([ordersRes, viewsRes, cartRes]) => {
      if (cancelled) return;

      setOrders((ordersRes.data as Order[]) ?? []);
      setCartAddCount(cartRes.data?.length ?? 0);

      const productIds = (viewsRes.data as { product_id: string }[]) ?? [];
      const counts: Record<string, number> = {};
      productIds.forEach((v) => {
        counts[v.product_id] = (counts[v.product_id] ?? 0) + 1;
      });

      const ids = Object.keys(counts);
      if (ids.length > 0) {
        const { data: products } = await supabase.from('products').select('id,name').in('id', ids);
        const list: ViewedProduct[] = (products ?? [])
          .map((p) => ({ product_id: p.id, name: p.name, count: counts[p.id] }))
          .sort((a, b) => b.count - a.count);
        if (!cancelled) setViewedProducts(list);
      } else {
        setViewedProducts([]);
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { orders, viewedProducts, cartAddCount, isLoading };
}
