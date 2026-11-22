import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { affiliateTotals, parseAffiliateStats, type AffiliateCommissionRow } from '../lib/affiliateStats';

export type MyAffiliateCommission = AffiliateCommissionRow;

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
    try {
      // 1) la fonction sûre de la base (add-affiliate-fixes.sql) : SES visiteurs et SES commissions, avec le numéro et le montant
      //    de la commande, sans jamais les données des clients
      const { data, error } = await supabase.rpc('affiliate_my_stats');
      const parsed = error ? null : parseAffiliateStats(data, profile.id);
      if (parsed) {
        setStats({ visitorsSent: parsed.visitors, ...affiliateTotals(parsed.commissions), commissions: parsed.commissions });
        return;
      }

      // 2) script pas encore lancé : l'ancienne lecture (les commissions ; visites et montants restent réservés à l'administrateur)
      const [sessionsRes, commissionsRes] = await Promise.all([
        supabase.from('visitor_sessions').select('id', { count: 'exact', head: true }).eq('referral_code', profile.referral_code),
        supabase.from('affiliate_commissions').select('*, orders(total)').eq('affiliate_id', profile.id).order('created_at', { ascending: false }),
      ]);
      const commissions: MyAffiliateCommission[] = ((commissionsRes.data as any[]) ?? []).map((c) => ({
        id: c.id,
        affiliate_id: c.affiliate_id,
        order_id: c.order_id,
        order_number: null,
        order_total: c.orders?.total ?? null,
        amount: Number(c.amount),
        status: c.status,
        paid: c.paid,
        paid_at: c.paid_at,
        created_at: c.created_at,
      }));
      setStats({ visitorsSent: sessionsRes.count ?? 0, ...affiliateTotals(commissions), commissions });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [profile?.id, profile?.referral_code]);

  return { stats, isLoading, refresh };
}
