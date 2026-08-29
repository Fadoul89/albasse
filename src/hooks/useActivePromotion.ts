import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { SmartPromotion } from '../types';

export function useActivePromotion() {
  const [promotion, setPromotion] = useState<SmartPromotion | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    supabase
      .from('smart_promotions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const now = Date.now();
        const eligible = (data as SmartPromotion[]).find((p) => {
          const start = new Date(`${p.start_date}T00:00:00`).getTime();
          const end = new Date(`${p.end_date}T${p.end_time}`).getTime();
          if (now < start || now > end) return false;
          if (p.max_beneficiaries !== null && p.claimed_count >= p.max_beneficiaries) return false;
          return true;
        });
        setPromotion(eligible ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return promotion;
}
