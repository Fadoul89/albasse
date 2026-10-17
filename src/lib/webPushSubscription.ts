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

export async function subscribeToWebPush(): Promise<boolean> {
  if (!isWebPushSupported() || !isSupabaseConfigured) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

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
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const { error } = await supabase
      .from('web_push_subscriptions')
      .upsert(
        { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: 'endpoint' }
      );

    return !error;
  } catch {
    return false;
  }
}
