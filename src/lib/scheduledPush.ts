// Notifications push programmées (page « Promotions intelligentes ») : un article, un message court, un jour et une heure
// (heure du Tchad, UTC+1 toute l'année). À l'heure dite, la base envoie la notification à tous les téléphones abonnés
// (script add-scheduled-push.sql : minuteur pg_cron + déclencheur des notifications produit).
import { supabase, isSupabaseConfigured } from './supabase';
import { PUSH_MESSAGE_MAX, PUSH_TITLE_MAX, chadLabel, chadTimeOf, chadToIso, clickStats, defaultChadSlot, pushTitleFor, scheduleProblem } from './scheduledPushTime';

export { PUSH_MESSAGE_MAX, PUSH_TITLE_MAX, chadLabel, chadTimeOf, chadToIso, clickStats, defaultChadSlot, pushTitleFor, scheduleProblem };

export type ScheduledPushStatus = 'pending' | 'sent' | 'expired' | 'cancelled';

export interface ScheduledPush {
  id: string;
  product_id: string;
  title: string;
  message: string;
  send_at: string;
  status: ScheduledPushStatus;
  sent_at: string | null;
  clicks?: number | null;
  recipients?: number | null;
  // présent seulement quand add-push-history-cleanup.sql est lancé (l'historique s'efface alors tout seul 24 h après)
  status_changed_at?: string | null;
  product: { name: string; slug: string; images: string[] | null } | null;
}

// La table n'existe pas encore (script SQL pas encore lancé).
const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === 'PGRST205' ||
    error.code === '42P01' ||
    (/scheduled_pushes/.test(error.message ?? '') && /does not exist|could not find/i.test(error.message ?? '')));

export async function fetchScheduledPushes(): Promise<{ rows: ScheduledPush[]; missing: boolean; error: string | null }> {
  if (!isSupabaseConfigured) return { rows: [], missing: false, error: null };
  const query = (columns: string) =>
    supabase.from('scheduled_pushes').select(columns).order('send_at', { ascending: false }).limit(100);
  const base = 'id, product_id, title, message, send_at, status, sent_at, product:products(name, slug, images)';
  // une colonne absente (script SQL pas encore lancé) donne l'erreur 42703 : on réessaie avec moins de colonnes, la liste s'affiche quand même
  const columnProblem = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42703' || /clicks|recipients|status_changed_at/.test(e.message ?? ''));
  // status_changed_at : add-push-history-cleanup.sql (l'historique s'efface 24 h après) ; clicks, recipients : add-push-clicks.sql
  let { data, error } = await query(`${base}, clicks, recipients, status_changed_at`);
  if (columnProblem(error)) ({ data, error } = await query(`${base}, clicks, recipients`));
  if (columnProblem(error)) ({ data, error } = await query(base));
  if (error) return { rows: [], missing: isMissingTable(error), error: error.message };
  return { rows: (data ?? []) as unknown as ScheduledPush[], missing: false, error: null };
}

export async function createScheduledPush(row: { productId: string; title: string; message: string; sendAt: string }): Promise<string | null> {
  const { error } = await supabase
    .from('scheduled_pushes')
    .insert({ product_id: row.productId, title: row.title, message: row.message.trim(), send_at: row.sendAt });
  if (!error) return null;
  return isMissingTable(error) ? 'missing' : error.message;
}

// Seulement une notification encore « à venir » (une notification déjà partie ne change plus).
export async function cancelScheduledPush(id: string): Promise<string | null> {
  const { error } = await supabase.from('scheduled_pushes').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending');
  return error ? error.message : null;
}

// Elle devient « due » tout de suite ; le gardien (add-push-gate.sql, qui passe chaque minute) l'envoie dès que l'écart minimum avec la
// dernière notification est respecté : jamais deux notifications en même temps.
export async function sendScheduledPushNow(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('scheduled_pushes')
    .update({ send_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');
  return error ? error.message : null;
}
