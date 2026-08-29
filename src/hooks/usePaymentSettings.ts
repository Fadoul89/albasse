import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PaymentSettings } from '../types';

export function usePaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from('payment_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setSettings((data as PaymentSettings) ?? null);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  return { settings, isLoading, refresh };
}
