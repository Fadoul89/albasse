// Gestion de compte côté équipe : les appels à la base et à la fonction serveur « admin-client-account » (règles et phrases : lib/clientAccount.ts, docs/gestion-de-compte.md).
// Chaque appel répond { ok: true, value } ou { ok: false, message } avec une phrase claire pour l'équipe : jamais de message technique brut.
import { supabase } from './supabase';
import { parseInfo, reasonMessage, rpcErrorMessage, type AccountAction, type AccountInfo, type EditForm } from './clientAccount';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string; missing?: boolean };

export async function fetchAccountInfo(userId: string): Promise<ApiResult<AccountInfo>> {
  const { data, error } = await supabase.rpc('admin_client_account_info', { p_target: userId });
  if (error) {
    const message = rpcErrorMessage(error.message);
    return { ok: false, message, missing: /pas encore lancé/.test(message) };
  }
  const info = parseInfo(data);
  return info ? { ok: true, value: info } : { ok: false, message: 'Réponse inattendue de la base.' };
}

export async function saveProfile(userId: string, changes: Partial<EditForm>): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('admin_update_client_profile', { p_target: userId, p_changes: changes });
  return error ? { ok: false, message: rpcErrorMessage(error.message) } : { ok: true, value: null };
}

export interface ActionBody {
  action: AccountAction;
  userId: string;
  value?: string;
  reason?: string;
  confirm?: string;
}
export async function runAccountAction(body: ActionBody): Promise<ApiResult<{ detail: string; login?: string }>> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-client-account', { body });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 404) return { ok: false, message: reasonMessage('not_installed'), missing: true };
      if (status === 401) return { ok: false, message: reasonMessage('unauthenticated') };
      if (status === 403) return { ok: false, message: reasonMessage('forbidden') };
      return { ok: false, message: reasonMessage('server_error') };
    }
    const d = data as { ok?: boolean; reason?: string; detail?: string; login?: string } | null;
    if (d?.ok === true) return { ok: true, value: { detail: d.detail ?? '', login: d.login } };
    return { ok: false, message: reasonMessage(d?.reason ?? '') };
  } catch {
    return { ok: false, message: reasonMessage('server_error') };
  }
}

export interface LogRow {
  id: string;
  created_at: string;
  action: string;
  detail: string;
  adminName: string | null;
}
// Le journal de ce client (10 dernières actions). Une panne ou un script pas lancé : liste vide, jamais d'erreur à l'écran.
export async function fetchAccountLog(userId: string): Promise<LogRow[]> {
  const { data, error } = await supabase.from('client_account_log').select('id, created_at, admin_id, action, detail').eq('target_id', userId).order('created_at', { ascending: false }).limit(10);
  if (error || !Array.isArray(data)) return [];
  const ids = [...new Set(data.map((r: { admin_id: string | null }) => r.admin_id).filter((x): x is string => !!x))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: admins } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    for (const a of (admins ?? []) as { id: string; full_name: string | null }[]) names[a.id] = a.full_name ?? 'Admin';
  }
  return data.map((r: { id: string; created_at: string; admin_id: string | null; action: string; detail: string }) => ({
    id: r.id,
    created_at: r.created_at,
    action: r.action,
    detail: r.detail,
    adminName: r.admin_id ? names[r.admin_id] ?? 'Admin' : null,
  }));
}
