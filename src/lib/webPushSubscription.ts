import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

// Meme paire VAPID que celle configuree sur la fonction Supabase send-web-push.
const VAPID_PUBLIC_KEY = 'BBpjkKFREyGMSEb3sFj--PHJa4NiR9n-9PxTxUHtJ8QVtcuCcJibGsP0ic9uVFn7HxPuqR8gsXzzeT2FL_qQEPs';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isWebPushSupported(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function hasWebPushPermission(): boolean {
  if (!isWebPushSupported()) return false;
  return Notification.permission === 'granted';
}

// Le visiteur a refuse (ou bloque) les notifications : inutile de reproposer
// un bouton « Activer », seul un changement dans les reglages du navigateur
// peut les reactiver.
export function isWebPushBlocked(): boolean {
  if (!isWebPushSupported()) return false;
  return Notification.permission === 'denied';
}

// Raison du dernier echec de subscribeToWebPush(), pour l'afficher au visiteur
// au lieu de refermer le bandeau sans rien dire.
export const PUSH_PERMISSION_NOT_GRANTED = 'autorisation non accordée';
let lastIssue = '';
export function getWebPushIssue(): string {
  return lastIssue;
}
function fail(reason: string, e?: unknown): false {
  const err = e as { name?: string; code?: string; message?: string } | null;
  lastIssue = e ? `${reason} : ${err?.name ?? err?.code ?? 'erreur'} ${String(err?.message ?? '').slice(0, 90)}`.trim() : reason;
  return false;
}

export async function subscribeToWebPush(): Promise<boolean> {
  lastIssue = '';
  if (!isWebPushSupported() || !isSupabaseConfigured) return fail('notifications non prises en charge ici');

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return fail(PUSH_PERMISSION_NOT_GRANTED);

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return fail('abonnement incomplet');

    // Simple insertion, pas d'« insert ou mise a jour » : celle-ci exige le droit de
    // lire la table (reserve aux administrateurs) et etait refusee (403), surtout pour
    // les clients connectes. 23505 = cet appareil est deja abonne : c'est un succes.
    const { error } = await supabase
      .from('web_push_subscriptions')
      .insert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
    if (error && error.code !== '23505') return fail('enregistrement sur le site refusé', error);

    rememberSynced(json.endpoint);
    return true;
  } catch (e) {
    return fail('activation impossible', e);
  }
}

// Adresse du dernier abonnement dont l'enregistrement sur le site a reussi : evite
// de renvoyer la meme chose (et une erreur « doublon ») a chaque ouverture.
const SYNCED_KEY = 'albasse_push_synced_endpoint';
function rememberSynced(endpoint: string) {
  try {
    window.localStorage.setItem(SYNCED_KEY, endpoint);
  } catch {
    // silencieux
  }
}

// L'autorisation est deja accordee et l'appareil a deja un abonnement, mais celui-ci
// n'est jamais arrive sur le site (ancien echec d'enregistrement) : on le renvoie, une
// seule fois. Aucun toucher n'est necessaire : rien n'est demande, on reutilise
// l'abonnement existant.
export async function syncWebPushSubscription(): Promise<void> {
  if (!isWebPushSupported() || !isSupabaseConfigured || Notification.permission !== 'granted') return;
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
    if (window.localStorage.getItem(SYNCED_KEY) === json.endpoint) return;

    const { error } = await supabase
      .from('web_push_subscriptions')
      .insert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
    if (!error || error.code === '23505') rememberSynced(json.endpoint);
  } catch {
    // silencieux : la synchronisation ne doit jamais gener le site
  }
}
