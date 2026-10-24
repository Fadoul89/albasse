// Zara IA : un message écrit librement par le client est envoyé à la fonction serveur « zara-ai » (Claude Haiku 5.5),
// qui cherche dans les vrais articles et répond. null : pas de réponse (clé ou script SQL absents, limite de 20 messages
// du jour atteinte, réseau...) : Zara répond alors comme avant, avec ses règles.
import { supabase, isSupabaseConfigured } from './supabase';

export interface ZaraAiAnswer {
  text: string;
  productIds: string[];
}

export interface ZaraAiTurn {
  role: 'user' | 'assistant';
  text: string;
}

const TIMEOUT_MS = 25000;
const PAUSE_MS = 10 * 60 * 1000;
// après « limite atteinte » ou « pas installé », on ne redemande pas pendant 10 minutes (Zara répond tout de suite)
let pausedUntil = 0;

export async function askZaraAi(message: string, history: ZaraAiTurn[], visitorId: string, name: string | null = null): Promise<ZaraAiAnswer | null> {
  if (!isSupabaseConfigured || Date.now() < pausedUntil) return null;
  try {
    const call = supabase.functions.invoke('zara-ai', { body: { message, history, visitorId, ...(name ? { name } : {}) } });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    const { data, error } = await Promise.race([call, timeout]);
    if (error || !data) return null;
    const d = data as { ok?: boolean; reason?: string; text?: unknown; productIds?: unknown };
    if (!d.ok || typeof d.text !== 'string' || !d.text.trim()) {
      if (d.reason === 'limit' || d.reason === 'no_key' || d.reason === 'setup') pausedUntil = Date.now() + PAUSE_MS;
      return null;
    }
    const ids = Array.isArray(d.productIds) ? d.productIds.filter((x): x is string => typeof x === 'string') : [];
    return { text: d.text.trim(), productIds: ids };
  } catch {
    return null;
  }
}
