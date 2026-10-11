import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { City } from '../types/city';

export function useCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Erreur chargement villes:', error.message);
        setCities((data as City[]) ?? []);
        setIsLoading(false);
      });
  }, []);

  return { cities, isLoading };
}

export function usePaymentSettings() {
  const [settings, setSettings] = useState<import('../types/city').PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('payment_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setSettings(data ?? null);
        setIsLoading(false);
      });
  }, []);

  return { settings, isLoading };
}
