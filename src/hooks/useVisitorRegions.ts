// Admin › Visiteurs par région : la dernière position connue de chaque visiteur (GPS, option décrite dans
// docs/option-gps-visiteurs.md), regroupée par région et par ville. Base vide (script pas encore lancé, ou
// aucun visiteur n'a encore accepté) : écran "pas encore disponible", jamais d'erreur.
import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface RegionRow {
  region: string;
  country: string;
  visitors: number;
}

export interface CityRow {
  city: string;
  region: string;
  visitors: number;
}

export type VisitorRegionsState = 'loading' | 'ready' | 'missing' | 'error';

export function useVisitorRegions() {
  const [state, setState] = useState<VisitorRegionsState>('loading');
  const [total, setTotal] = useState(0);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setState('missing');
      return;
    }
    setState('loading');
    const { data, error } = await supabase.rpc('admin_visitor_regions_overview');
    if (error) {
      setState((error as { code?: string }).code === 'PGRST202' ? 'missing' : 'error');
      return;
    }
    const d = (data ?? {}) as { total_visitors_located?: number; regions?: RegionRow[]; cities?: CityRow[] };
    setTotal(Number(d.total_visitors_located) || 0);
    setRegions(Array.isArray(d.regions) ? d.regions : []);
    setCities(Array.isArray(d.cities) ? d.cities : []);
    setState('ready');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, total, regions, cities, refresh };
}
