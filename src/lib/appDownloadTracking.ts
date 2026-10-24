import { supabase, isSupabaseConfigured } from './supabase';
import { inAppName, isAndroidDevice, isIosDevice } from './pwaInstallPrompt';

// Ce qui s'est passé après le toucher sur « Installer » :
//   ios-guide     iPhone : le tutoriel vidéo s'ouvre
//   chrome-intent navigateur de TikTok / Facebook (Android) : la page s'est ouverte dans Chrome
//   chrome-bloque ... mais le lien a été bloqué : on renvoie le visiteur vers la page /installer, qui montre les étapes à la main
//   etapes        TikTok (Android) : on ne tente même pas Chrome, TikTok le refuse : la page /installer montre tout de suite les étapes
//   accepte / refuse / indisponible : réponse de la boîte d'installation de Chrome (indisponible = Chrome n'était pas prêt)
export type InstallClickOutcome = 'ios-guide' | 'chrome-intent' | 'chrome-bloque' | 'etapes' | 'accepte' | 'refuse' | 'indisponible';

// Une ligne par toucher. Le résultat et l'appareil sont écrits dans la colonne « source » (texte libre), sans changer la base :
//   popup|android|tiktok|chrome-bloque  (fenêtre | appareil | navigateur | résultat)
// Les clics restent comptés une fois chacun ; pour le détail : split_part(source, '|', n).
export function trackAppDownloadClick(source: 'banner' | 'popup' | 'page', outcome?: InstallClickOutcome) {
  if (!isSupabaseConfigured) return;
  const device = isIosDevice() ? 'iphone' : isAndroidDevice() ? 'android' : 'pc';
  const label = outcome ? `${source}|${device}|${inAppName() ?? 'navigateur'}|${outcome}` : source;
  supabase.from('app_download_clicks').insert({ source: label }).then(({ error }) => {
    if (error) console.error('Erreur suivi clic telechargement:', error.message);
  });
}
