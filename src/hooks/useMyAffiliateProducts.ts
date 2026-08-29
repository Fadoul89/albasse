import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProducts } from './useProducts';
import type { Product } from '../types';

export interface AffiliateProductRow {
  product: Product;
  clicks: number;
  orders: number;
  commission: number;
}

export function useMyAffiliateProducts() {
  const profile = useAuthStore((s) => s.profile);
  const { products } = useProducts();
  const [rows, setRows] = useState<AffiliateProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured || !profile?.is_affiliate || !profile.referral_code || products.length === 0) {
      setRows([]);
      return;
    }
    setIsLoading(true);

    const sessionsRes = await supabase
      .from('visitor_sessions')
      .select('id')
      .eq('referral_code', profile.referral_code);
    const sessionIds = ((sessionsRes.data as { id: string }[]) ?? []).map((s) => s.id);

    const viewsByProduct: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const viewsRes = await supabase.from('product_views').select('product_id').in('session_id', sessionIds);
      ((viewsRes.data as { product_id: string }[]) ?? []).forEach((v) => {
        viewsByProduct[v.product_id] = (viewsByProduct[v.product_id] ?? 0) + 1;
      });
    }

    const itemsRes = await supabase
      .from('affiliate_commission_items')
      .select('product_id, amount, commission_id')
      .eq('affiliate_id', profile.id);

    const ordersByProduct: Record<string, Set<string>> = {};
    const commissionByProduct: Record<string, number> = {};
    ((itemsRes.data as { product_id: string | null; amount: number; commission_id: string }[]) ?? []).forEach((it) => {
      if (!it.product_id) return;
      commissionByProduct[it.product_id] = (commissionByProduct[it.product_id] ?? 0) + Number(it.amount);
      if (!ordersByProduct[it.product_id]) ordersByProduct[it.product_id] = new Set();
      ordersByProduct[it.product_id].add(it.commission_id);
    });

    const result: AffiliateProductRow[] = products
      .filter((p) => p.is_active)
      .map((p) => ({
        product: p,
        clicks: viewsByProduct[p.id] ?? 0,
        orders: ordersByProduct[p.id]?.size ?? 0,
        commission: commissionByProduct[p.id] ?? 0,
      }))
      .sort((a, b) => b.commission - a.commission || b.clicks - a.clicks);

    setRows(result);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [profile?.id, profile?.referral_code, products.length]);

  return { rows, isLoading, refresh };
}
