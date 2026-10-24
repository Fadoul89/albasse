// Vrai nombre de personnes en ligne : appareils dont le site a donné signe de vie depuis 70 s (voir add-online-count.sql,
// le signal part toutes les 20 s depuis lib/analytics). null tant que la base ne répond pas (script pas encore lancé) :
// le compteur reste caché plutôt que d'afficher un nombre inventé.
import { supabase, isSupabaseConfigured } from './supabase';

export async function fetchOnlineCount(): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('online_visitors_count');
  if (error || typeof data !== 'number') return null;
  // la personne qui regarde est en ligne, même si son premier signal n'est pas encore arrivé
  return Math.max(1, data);
}

export const onlineLabel = (count: number) => `${count} en ligne`;
