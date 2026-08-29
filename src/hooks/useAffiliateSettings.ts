import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AffiliateSettings } from '../types';

const FALLBACK: AffiliateSettings = {
  id: 1,
  default_commission_rate: 5,
  updated_at: new Date().toISOString(),
};

export function useAffiliateSettings() {
  const [settings, setSettings] = useState<AffiliateSettings>(FALLBACK);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from('affiliate_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data as AffiliateSettings);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  return { settings, isLoading, refresh };
}
