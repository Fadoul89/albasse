// Un client a touché une notification programmée : la page s'ouvre avec la marque « ?push=… » (posée par public/sw.js).
// Le clic est compté une seule fois par onglet (add-push-clicks.sql : record_push_click), puis la marque quitte l'adresse.
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { readPushTag } from './scheduledPushTime';

export function recordPushClickFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !isSupabaseConfigured) return;
  const tag = readPushTag(window.location.search);
  if (!tag) return;
  // la page lit encore quelques secondes la page voulue par la notification (public/index.html) : la marque part après
  window.setTimeout(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('push') !== tag) return;
      url.searchParams.delete('push');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch {
      // ignore
    }
  }, 8000);
  try {
    const key = `albasse_push_click_${tag}`;
    if (window.sessionStorage.getItem(key)) return; // déjà compté dans cet onglet (page rechargée)
    window.sessionStorage.setItem(key, '1');
  } catch {
    // stockage bloqué : le clic est quand même compté
  }
  Promise.resolve(supabase.rpc('record_push_click', { p_hash: tag })).catch(() => {
    // silencieux : le comptage ne doit jamais gêner le client
  });
}
