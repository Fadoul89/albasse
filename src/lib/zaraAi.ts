// Zara IA : un message écrit librement par le client (ou une photo) est envoyé à la fonction serveur « zara-ai » (Claude Sonnet 5.5),
// qui cherche dans les vrais articles et répond. null : pas de réponse (clé ou script SQL absents, limite de 20 messages
// du jour atteinte, réseau...) : Zara répond alors comme avant, avec ses règles.
// Client connecté : la fonction reçoit son jeton de connexion (ajouté par supabase.functions.invoke) et lit sa mémoire (add-zara-memory.sql).
import { supabase, isSupabaseConfigured } from './supabase';

export interface ZaraAiAnswer {
  text: string;
  productIds: string[];
  // les notes de Zara sur ce client connecté ; null : visiteur sans compte, ou mémoire pas installée
  memory: string[] | null;
}

export interface ZaraAiTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ZaraAiPhoto {
  mediaType: 'image/jpeg';
  data: string; // base64 sans « data:image/jpeg;base64, »
}

// pourquoi une photo n'a pas eu de réponse : limite des 5 photos du jour, ou Zara IA indisponible
export type ZaraPhotoFailure = 'photo_limit' | 'unavailable';

const TIMEOUT_MS = 25000;
const PHOTO_TIMEOUT_MS = 40000;
const PAUSE_MS = 10 * 60 * 1000;
// après « limite atteinte » ou « pas installé », on ne redemande pas pendant 10 minutes (Zara répond tout de suite)
let pausedUntil = 0;

type Raw = { ok?: boolean; reason?: string; text?: unknown; productIds?: unknown; memory?: unknown };

async function call(body: Record<string, unknown>, timeoutMs: number): Promise<{ answer: ZaraAiAnswer } | { reason: string }> {
  if (!isSupabaseConfigured || Date.now() < pausedUntil) return { reason: 'paused' };
  try {
    const request = supabase.functions.invoke('zara-ai', { body });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
    const { data, error } = await Promise.race([request, timeout]);
    if (error || !data) return { reason: 'network' };
    const d = data as Raw;
    if (!d.ok || typeof d.text !== 'string' || !d.text.trim()) {
      if (d.reason === 'limit' || d.reason === 'no_key' || d.reason === 'setup') pausedUntil = Date.now() + PAUSE_MS;
      return { reason: d.reason ?? 'empty' };
    }
    const ids = Array.isArray(d.productIds) ? d.productIds.filter((x): x is string => typeof x === 'string') : [];
    const memory = Array.isArray(d.memory) ? d.memory.filter((x): x is string => typeof x === 'string') : null;
    // pas de mise en forme markdown dans la bulle de Zara : on retire les ** du gras
    return { answer: { text: d.text.replace(/\*\*/g, '').trim(), productIds: ids, memory } };
  } catch {
    return { reason: 'network' };
  }
}

export async function askZaraAi(message: string, history: ZaraAiTurn[], visitorId: string, name: string | null = null): Promise<ZaraAiAnswer | null> {
  const res = await call({ message, history, visitorId, ...(name ? { name } : {}) }, TIMEOUT_MS);
  return 'answer' in res ? res.answer : null;
}

// Photo → article : la photo (déjà réduite par zaraPhoto.ts) part avec un petit message (celui écrit par le client, ou rien).
export async function askZaraAiPhoto(
  photo: ZaraAiPhoto,
  message: string,
  history: ZaraAiTurn[],
  visitorId: string,
  name: string | null = null,
): Promise<{ answer: ZaraAiAnswer } | { failure: ZaraPhotoFailure }> {
  const res = await call({ message, history, visitorId, photo, ...(name ? { name } : {}) }, PHOTO_TIMEOUT_MS);
  if ('answer' in res) return res;
  return { failure: res.reason === 'photo_limit' ? 'photo_limit' : 'unavailable' };
}
