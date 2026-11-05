// Parrainage : les appels à la base et ce qui est gardé sur le téléphone (docs/parrainage.md). Les règles sont dans lib/friendInvites.ts.
// Tout est « au mieux » : tant que le script SQL add-friend-invites.sql n'est pas lancé, ou si le réseau coupe, le site marche exactement comme avant
// (une inscription, une connexion ou une ouverture de l'application ne doit JAMAIS échouer à cause du parrainage).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { isRunningInsideApp } from './runningInApp';
import { isRunningAsInstalledPwa } from './pwaInstallPrompt';
import {
  inviteCodeFromSearch,
  normalizeInviteCode,
  parseOverview,
  parseProgress,
  storeInviteValue,
  storedInviteCode,
  type AdminOverview,
  type InviteProgress,
  type RewardStatus,
} from './friendInvites';

const CODE_KEY = 'albasse_invite_code';
const OPENED_KEY = 'albasse_invite_app_opened'; // + « : » + identifiant du client : l'ouverture est déjà annoncée à la base

type DbError = { code?: string; message?: string } | null | undefined;
// La fonction n'existe pas encore dans la base (script SQL pas lancé)
export const isMissingFunction = (error: DbError): boolean =>
  !!error && (error.code === '42883' || error.code === 'PGRST202' || /Could not find the function|does not exist/i.test(String(error.message ?? '')));

// Le code écrit dans l'adresse du lien (?invite=ABCD2345) est gardé 30 jours, même si l'ami s'inscrit plus tard
export async function captureInviteCodeFromUrl(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const code = inviteCodeFromSearch(window.location.search);
    if (code) await AsyncStorage.setItem(CODE_KEY, storeInviteValue(code, Date.now()));
  } catch {
    // silencieux
  }
}

export async function readStoredInviteCode(): Promise<string | null> {
  try {
    return storedInviteCode(await AsyncStorage.getItem(CODE_KEY), Date.now());
  } catch {
    return null;
  }
}

export async function clearStoredInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CODE_KEY);
  } catch {
    // silencieux
  }
}

// « Invité par Amina » sur l'écran d'inscription ; null si le code n'existe pas ou si la base n'a pas le script
export async function inviterFirstName(code: string): Promise<string | null> {
  if (!isSupabaseConfigured || !normalizeInviteCode(code)) return null;
  try {
    const { data, error } = await supabase.rpc('invite_lookup', { p_code: code });
    if (error || typeof data !== 'string') return null;
    return data.trim() || null;
  } catch {
    return null;
  }
}

// Juste après l'inscription : le nouveau client dit qui l'a invité. Le code est effacé quand la base a répondu (bon, ou refusé pour de bon).
export async function claimInviteIfAny(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const code = await readStoredInviteCode();
    if (!code) return;
    const { data, error } = await supabase.rpc('invite_claim', { p_code: code });
    if (error) return; // script pas lancé ou réseau coupé : on garde le code, on réessaiera
    if (data !== 'login') await clearStoredInviteCode();
  } catch {
    // silencieux
  }
}

// L'application installée s'ouvre avec ce client connecté : la base le note (une seule fois). On ne le dit pas si le site tourne dans un navigateur normal.
export function trackInviteAppOpen(userId: string | null | undefined): void {
  if (!userId || Platform.OS !== 'web' || typeof window === 'undefined' || !isSupabaseConfigured) return;
  if (!isRunningAsInstalledPwa() && !isRunningInsideApp()) return;
  try {
    const key = `${OPENED_KEY}:${userId}`;
    if (window.localStorage.getItem(key)) return;
    Promise.resolve(supabase.rpc('invite_mark_app_opened')).then(({ error }) => {
      if (error) return; // script pas lancé ou réseau coupé : on réessaiera à la prochaine ouverture
      try {
        window.localStorage.setItem(key, '1');
      } catch {
        // silencieux
      }
    });
  } catch {
    // silencieux
  }
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: 'missing' | 'error' };

export async function fetchMyProgress(): Promise<Loaded<InviteProgress>> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'missing' };
  try {
    const { data, error } = await supabase.rpc('invite_my_progress');
    if (error) return { ok: false, reason: isMissingFunction(error) ? 'missing' : 'error' };
    const progress = parseProgress(data);
    return progress ? { ok: true, data: progress } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function fetchOverview(): Promise<Loaded<AdminOverview>> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'missing' };
  try {
    const { data, error } = await supabase.rpc('admin_invite_overview');
    if (error) return { ok: false, reason: isMissingFunction(error) ? 'missing' : 'error' };
    const overview = parseOverview(data);
    return overview ? { ok: true, data: overview } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function setRewardStatus(id: string, status: RewardStatus, note?: string | null): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('admin_invite_reward_set', { p_reward: id, p_status: status, p_note: note ?? null });
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
