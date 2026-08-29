import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StoreSettings } from '../types';

const FALLBACK: StoreSettings = {
  id: 1,
  shop_name: 'Albasse Shopping',
  address: 'Marché Central',
  postal_code: '5575',
  city: "N'Djamena",
  country: 'Tchad',
  phone: '00235 60605151',
  whatsapp: '00235 60605151',
  email: 'contact@albasseshopping.com',
  hours: 'Lun - Sam : 8h - 19h',
  google_maps_url: null,
  updated_at: new Date().toISOString(),
};

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(FALLBACK);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data as StoreSettings);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  return { settings, isLoading, refresh };
}
