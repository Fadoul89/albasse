import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { City } from '../types';

const FALLBACK_NAMES = [
  "N'Djamena", 'Moundou', 'Sarh', 'Abéché', 'Kélo', 'Koumra', 'Pala', 'Bongor', 'Doba',
  'Faya-Largeau', 'Mongo', 'Ati', 'Am Timan', 'Mao', 'Moussoro', 'Bol', 'Massakory',
  'Biltine', 'Fada', 'Amdjarass', 'Adré', 'Iriba', 'Goz Beïda', 'Laï', 'Fianga', 'Léré',
  'Benoy', 'Kyabé', 'Moïssala', 'Bousso', 'Massaguet', 'Massenya', 'Ngouri', 'Oum Hadjer',
  'Abou Deïa', 'Am Dam', 'Haraze', 'Melfi', 'Mbaïbokoum', 'Beinamar', 'Bébédjia',
  'Gounou-Gaya', 'Guidiguir',
];

const KNOWN_DELIVERY: Record<string, { fee: number; agency: string | null }> = {
  "N'Djamena": { fee: 0, agency: 'Livraison' },
  Moundou: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Sarh: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Kélo: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Koumra: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Pala: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Bongor: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Doba: { fee: 2500, agency: 'STTL ou Sud Voyage' },
  Abéché: { fee: 2500, agency: 'Abou Aziza' },
  Mongo: { fee: 2500, agency: 'Abou Aziza' },
  Ati: { fee: 2500, agency: null },
  'Am Timan': { fee: 2500, agency: null },
  Mao: { fee: 2500, agency: null },
};

const FALLBACK_CITIES: City[] = FALLBACK_NAMES.map((name, i) => ({
  id: `fallback-${i}`,
  name,
  is_active: true,
  delivery_fee: KNOWN_DELIVERY[name]?.fee ?? null,
  delivery_agency: KNOWN_DELIVERY[name]?.agency ?? null,
  sort_order: i,
  created_at: new Date().toISOString(),
}));

export function useCities(includeInactive = false) {
  const [cities, setCities] = useState<City[]>(isSupabaseConfigured ? [] : FALLBACK_CITIES);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setCities(FALLBACK_CITIES);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let query = supabase.from('cities').select('*').order('sort_order', { ascending: true });
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error || !data) {
      setCities(FALLBACK_CITIES);
    } else {
      setCities(data as City[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [includeInactive]);

  return { cities, isLoading, refresh };
}
