// Zara SEO (admin) : santé des fiches produit (descriptions), choix des fiches à améliorer, appels à la fonction « zara-seo » et à la base.
// Aucune description n'est publiée sans validation : la fonction serveur ne fait que PROPOSER, la publication passe par zara_apply_seo (add-zara-seo.sql).
import { supabase, isSupabaseConfigured } from './supabase';
import { type SeoRow, type SeoSuggestion } from './zaraSeoCore';

export * from './zaraSeoCore';


const isMissing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42883' || error.code === 'PGRST202' || error.code === '42703' || /Could not find the function|does not exist|column .* does not exist/i.test(error.message ?? ''));
export { isMissing as isSeoSetupMissing };

const COLUMNS = 'id, name, slug, description, stock, is_active, images, created_at';

// Toutes les fiches (lecture seule). Si le script SQL n'est pas encore lancé, les colonnes de Zara n'existent pas : on le dit.
export async function fetchSeoRows(): Promise<{ rows: SeoRow[]; setupMissing: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { rows: [], setupMissing: false, error: 'Base non configurée' };
  const full = await supabase.from('products').select(`${COLUMNS}, description_zara_at, description_before_zara`).order('created_at', { ascending: false }).limit(2000);
  if (!full.error) return { rows: (full.data ?? []) as SeoRow[], setupMissing: false };
  if (!isMissing(full.error)) return { rows: [], setupMissing: false, error: full.error.message };
  const basic = await supabase.from('products').select(COLUMNS).order('created_at', { ascending: false }).limit(2000);
  if (basic.error) return { rows: [], setupMissing: true, error: basic.error.message };
  return { rows: (basic.data ?? []) as SeoRow[], setupMissing: true };
}

export async function requestSuggestions(ids: string[]): Promise<{ items: SeoSuggestion[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke('zara-seo', { body: { ids } });
  if (error) return { items: [], error: error.message || 'La fonction « zara-seo » ne répond pas.' };
  const d = data as { ok?: boolean; reason?: string; items?: SeoSuggestion[] } | null;
  if (!d?.ok) return { items: [], error: d?.reason === 'forbidden' ? 'Réservé aux administrateurs.' : 'Zara n’a pas pu préparer les descriptions. Réessayez dans un instant.' };
  return { items: d.items ?? [] };
}

export async function applySuggestions(items: { id: string; description: string }[]): Promise<{ applied: number; skipped: number; error?: string; setupMissing?: boolean }> {
  const { data, error } = await supabase.rpc('zara_apply_seo', { p_items: items });
  if (error) return { applied: 0, skipped: 0, error: error.message, setupMissing: isMissing(error) };
  const r = (data ?? {}) as { applied?: number; skipped?: unknown[] };
  return { applied: r.applied ?? 0, skipped: Array.isArray(r.skipped) ? r.skipped.length : 0 };
}

export async function undoSuggestions(ids: string[]): Promise<{ restored: number; error?: string }> {
  const { data, error } = await supabase.rpc('zara_undo_seo', { p_ids: ids });
  if (error) return { restored: 0, error: error.message };
  return { restored: Number(data ?? 0) };
}
