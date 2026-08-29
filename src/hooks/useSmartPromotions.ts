import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { SmartPromotion } from '../types';

export function useSmartPromotions() {
  const [promotions, setPromotions] = useState<SmartPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase.from('smart_promotions').select('*').order('created_at', { ascending: false });
    setPromotions((data as SmartPromotion[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { promotions, isLoading, refresh };
}
