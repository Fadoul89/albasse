import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types';

export interface AffiliateSummary {
  profile: Profile;
  visitorsSent: number;
  ordersCount: number;
  revenue: number;
  pendingCommission: number;
  validatedCommission: number;
  paidCommission: number;
}

export function useAffiliates() {
  const [affiliates, setAffiliates] = useState<AffiliateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const [profilesRes, sessionsRes, commissionsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_affiliate', true).order('created_at', { ascending: false }),
      supabase.from('visitor_sessions').select('referral_code').not('referral_code', 'is', null),
      supabase.from('affiliate_commissions').select('*, orders(total)'),
    ]);

    const profiles = (profilesRes.data as Profile[]) ?? [];
    const sessions = (sessionsRes.data as { referral_code: string }[]) ?? [];
    const commissions = (commissionsRes.data as any[]) ?? [];

    const visitorsByCode: Record<string, number> = {};
    sessions.forEach((s) => {
      visitorsByCode[s.referral_code] = (visitorsByCode[s.referral_code] ?? 0) + 1;
    });

    const summaries: AffiliateSummary[] = profiles.map((p) => {
      const own = commissions.filter((c) => c.affiliate_id === p.id);
      const active = own.filter((c) => c.status !== 'cancelled');
      return {
        profile: p,
        visitorsSent: (p.referral_code && visitorsByCode[p.referral_code]) || 0,
        ordersCount: active.length,
        revenue: active.reduce((s, c) => s + (c.orders?.total ?? 0), 0),
        pendingCommission: own.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0),
        validatedCommission: own
          .filter((c) => c.status === 'validated' && !c.paid)
          .reduce((s, c) => s + Number(c.amount), 0),
        paidCommission: own.filter((c) => c.paid).reduce((s, c) => s + Number(c.amount), 0),
      };
    });

    setAffiliates(summaries);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { affiliates, isLoading, refresh };
}
