import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useProducts } from './useProducts';
import { parseAffiliateStats, type ProductStat } from '../lib/affiliateStats';
import type { Product } from '../types';

export interface AffiliateProductRow {
  product: Product;
  clicks: number;
  orders: number;
  commission: number;
}

// l'ancienne lecture, si le script de la base n'est pas encore lancé (les vues restent alors réservées à l'administrateur)
async function legacyProductStats(referralCode: string, affiliateId: string): Promise<Record<string, ProductStat>> {
  const out: Record<string, ProductStat> = {};
  const get = (id: string) => (out[id] ??= { views: 0, orders: 0, commission: 0 });
  const sessionsRes = await supabase.from('visitor_sessions').select('id').eq('referral_code', referralCode);
  const sessionIds = ((sessionsRes.data as { id: string }[]) ?? []).map((s) => s.id);
  if (sessionIds.length > 0) {
    const viewsRes = await supabase.from('product_views').select('product_id').in('session_id', sessionIds);
    ((viewsRes.data as { product_id: string }[]) ?? []).forEach((v) => {
      get(v.product_id).views += 1;
    });
  }
  const itemsRes = await supabase.from('affiliate_commission_items').select('product_id, amount, commission_id').eq('affiliate_id', affiliateId);
  const orders: Record<string, Set<string>> = {};
  ((itemsRes.data as { product_id: string | null; amount: number; commission_id: string }[]) ?? []).forEach((it) => {
    if (!it.product_id) return;
    get(it.product_id).commission += Number(it.amount);
    (orders[it.product_id] ??= new Set()).add(it.commission_id);
  });
  for (const [id, set] of Object.entries(orders)) get(id).orders = set.size;
  return out;
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
    try {
      // la fonction sûre de la base : vues des visiteurs venus de SON lien, commandes et commission par article (annulées exclues)
      const { data, error } = await supabase.rpc('affiliate_my_stats');
      const parsed = error ? null : parseAffiliateStats(data, profile.id);
      const stats = parsed ? parsed.products : await legacyProductStats(profile.referral_code, profile.id);

      const result: AffiliateProductRow[] = products
        .filter((p) => p.is_active)
        .map((p) => ({
          product: p,
          clicks: stats[p.id]?.views ?? 0,
          orders: stats[p.id]?.orders ?? 0,
          commission: stats[p.id]?.commission ?? 0,
        }))
        .sort((a, b) => b.commission - a.commission || b.clicks - a.clicks);
      setRows(result);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [profile?.id, profile?.referral_code, products.length]);

  return { rows, isLoading, refresh };
}
