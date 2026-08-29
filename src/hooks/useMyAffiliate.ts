import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { AffiliateCommission } from '../types';

export interface MyAffiliateCommission extends AffiliateCommission {
  order_total: number | null;
}

export interface MyAffiliateStats {
  visitorsSent: number;
  ordersCount: number;
  revenue: number;
  pendingCommission: number;
  validatedCommission: number;
  paidCommission: number;
  commissions: MyAffiliateCommission[];
}

const EMPTY: MyAffiliateStats = {
  visitorsSent: 0,
  ordersCount: 0,
  revenue: 0,
  pendingCommission: 0,
  validatedCommission: 0,
  paidCommission: 0,
  commissions: [],
};

export function useMyAffiliate() {
  const profile = useAuthStore((s) => s.profile);
  const [stats, setStats] = useState<MyAffiliateStats>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured || !profile?.is_affiliate || !profile.referral_code) {
      setStats(EMPTY);
      return;
    }
    setIsLoading(true);

    const [sessionsRes, commissionsRes] = await Promise.all([
      supabase.from('visitor_sessions').select('id', { count: 'exact', head: true }).eq('referral_code', profile.referral_code),
      supabase
        .from('affiliate_commissions')
        .select('*, orders(total)')
        .eq('affiliate_id', profile.id)
        .order('created_at', { ascending: false }),
    ]);

    const rawCommissions = (commissionsRes.data as any[]) ?? [];
    const commissions: MyAffiliateCommission[] = rawCommissions.map((c) => ({
      id: c.id,
      affiliate_id: c.affiliate_id,
      order_id: c.order_id,
      amount: Number(c.amount),
      status: c.status,
      paid: c.paid,
      paid_at: c.paid_at,
      created_at: c.created_at,
      order_total: c.orders?.total ?? null,
    }));

    const revenue = commissions
      .filter((c) => c.status !== 'cancelled')
      .reduce((sum, c) => sum + (c.order_total ?? 0), 0);
    const pendingCommission = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const validatedCommission = commissions
      .filter((c) => c.status === 'validated' && !c.paid)
      .reduce((s, c) => s + c.amount, 0);
    const paidCommission = commissions.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0);

    setStats({
      visitorsSent: sessionsRes.count ?? 0,
      ordersCount: commissions.filter((c) => c.status !== 'cancelled').length,
      revenue,
      pendingCommission,
      validatedCommission,
      paidCommission,
      commissions,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [profile?.id, profile?.referral_code]);

  return { stats, isLoading, refresh };
}
