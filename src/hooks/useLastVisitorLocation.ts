// La dernière position GPS connue d'un client (option GPS, docs/option-gps-visiteurs.md), pour l'afficher
// sur sa fiche admin. null si le client n'a jamais partagé sa position (ou si le script n'est pas lancé).
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface LastVisitorLocation {
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: string;
}

export function useLastVisitorLocation(userId: string) {
  const [location, setLocation] = useState<LastVisitorLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      if (!isSupabaseConfigured) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('visitor_locations')
        .select('address,city,region,country,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLocation(data ? { address: data.address, city: data.city, region: data.region, country: data.country, createdAt: data.created_at } : null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { location, isLoading };
}
