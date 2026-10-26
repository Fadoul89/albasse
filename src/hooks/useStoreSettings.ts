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
  voiceover_url: null,
  whatsapp_order_enabled: true,
  left_ad_items: [],
  right_ad_items: [],
  updated_at: new Date().toISOString(),
};

// Derniers réglages lus : la page suivante les a tout de suite (sans attendre la base).
let lastSettings: StoreSettings | null = null;

// Pour le code qui n'est pas un composant (le chat de Zara) : les derniers réglages lus, ou null s'ils ne sont pas encore lus.
export const getLastStoreSettings = (): StoreSettings | null => lastSettings;

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(lastSettings ?? FALLBACK);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured && !lastSettings);

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
        if (data) {
          lastSettings = {
            ...(data as StoreSettings),
            left_ad_items: (data as StoreSettings).left_ad_items ?? [],
            right_ad_items: (data as StoreSettings).right_ad_items ?? [],
          };
          setSettings(lastSettings);
        }
        setIsLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  return { settings, isLoading, refresh };
}
