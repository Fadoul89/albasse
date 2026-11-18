// Mémoire de Zara (clients connectés) : le client voit ses notes et peut tout effacer (« Tout oublier »).
// Seule la fonction serveur zara-ai les écrit. null : mémoire pas installée (add-zara-memory.sql) ou pas de réseau.
import { supabase, isSupabaseConfigured } from './supabase';

export async function loadZaraMemory(userId: string): Promise<string[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from('zara_memory').select('notes').eq('user_id', userId).maybeSingle();
    if (error) return null;
    const notes = (data as { notes?: unknown } | null)?.notes;
    return Array.isArray(notes) ? notes.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return null;
  }
}

export async function forgetZaraMemory(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('zara_memory').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
