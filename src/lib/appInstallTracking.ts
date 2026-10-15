import { supabase, isSupabaseConfigured } from './supabase';
import { isRunningInsideApp } from './runningInApp';

const FLAG_KEY = 'albasse_app_install_tracked';

function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Compte une installation la premiere fois que le site tourne dans la
// coquille WebView de l'app (le stockage local de la WebView est propre a
// cette installation : il disparait si l'app est desinstallee, donc une
// reinstallation recompte bien comme une nouvelle installation).
export function trackAppInstallIfNeeded() {
  if (typeof window === 'undefined' || !isRunningInsideApp() || !isSupabaseConfigured) return;
  try {
    if (window.localStorage.getItem(FLAG_KEY)) return;
    const deviceId = generateDeviceId();
    window.localStorage.setItem(FLAG_KEY, deviceId);
    supabase.from('app_installs').insert({ device_id: deviceId }).then(({ error }) => {
      if (error) console.error('Erreur suivi installation app:', error.message);
    });
  } catch {
    // silencieux : le suivi ne doit jamais bloquer le chargement du site
  }
}
