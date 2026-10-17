import { supabase, isSupabaseConfigured } from './supabase';
import { isRunningInsideApp } from './runningInApp';
import { isRunningAsInstalledPwa } from './pwaInstallPrompt';

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

const SHORTCUT_FLAG_KEY = 'albasse_shortcut_install_tracked';

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'Autre';
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/OPR|Opera/i.test(ua)) return 'Opera';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua)) return 'Safari';
  return 'Autre';
}

function detectDeviceType(): string {
  if (typeof navigator === 'undefined') return 'PC';
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return 'Tablette';
  if (/iPhone|iPod/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android' : 'Tablette';
  return 'PC';
}

// Compte une installation quand le visiteur accepte la boite de dialogue
// native d'installation du raccourci PWA. Enregistre le navigateur et le
// type d'appareil pour la repartition dans le dashboard admin.
export function trackShortcutInstallIfNeeded() {
  if (typeof window === 'undefined' || !isSupabaseConfigured) return;
  try {
    if (window.localStorage.getItem(SHORTCUT_FLAG_KEY)) return;
    const deviceId = generateDeviceId();
    window.localStorage.setItem(SHORTCUT_FLAG_KEY, deviceId);
    supabase
      .from('app_installs')
      .insert({
        device_id: deviceId,
        install_type: 'shortcut',
        browser: detectBrowser(),
        device_type: detectDeviceType(),
      })
      .then(({ error }) => {
        if (error) console.error('Erreur suivi installation raccourci:', error.message);
      });
  } catch {
    // silencieux : le suivi ne doit jamais bloquer l'installation
  }
}

// Compte aussi les installations faites autrement que par le bouton du site
// (menu ⋮ de Chrome, Partager > Sur l'ecran d'accueil sur iPhone...) : Chrome
// envoie « appinstalled » quelle que soit la methode, et l'icone installee
// s'ouvre en mode application. Un seul comptage par appareil (meme drapeau
// que ci-dessus), et jamais dans la coquille de l'app Android.
export function startShortcutInstallTracking() {
  if (typeof window === 'undefined' || isRunningInsideApp()) return;
  window.addEventListener('appinstalled', trackShortcutInstallIfNeeded);
  if (isRunningAsInstalledPwa()) trackShortcutInstallIfNeeded();
}
