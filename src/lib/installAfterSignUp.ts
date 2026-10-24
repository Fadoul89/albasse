import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInsideApp } from './runningInApp';
import { isAndroidDevice, isAppInstalledOnDevice, isIosDevice, isRunningAsInstalledPwa } from './pwaInstallPrompt';

// Juste après la création du compte, le visiteur voit la page d'installation du raccourci (/installer) : une seule fois par téléphone,
// et seulement sur un téléphone qui n'a pas encore le raccourci.
const SHOWN_KEY = 'albasse_install_after_signup';

// Même clé que la fenêtre « Installer » du site (AppDownloadPopup) : une fois par jour.
export const appPopupSeenKey = () => `albasse_app_popup_seen_${new Date().toISOString().slice(0, 10)}`;

// Même clé et même forme que la mémoire de Zara pour l'installation (assistantStore) : « déjà demandé », pour qu'elle ne redemande pas juste derrière.
const ZARA_INSTALL_KEY = 'albasse_zara_install';

export function installAfterSignUpDue(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (!isIosDevice() && !isAndroidDevice()) return false; // téléphone seulement, jamais sur ordinateur
  if (isRunningInsideApp() || isRunningAsInstalledPwa() || isAppInstalledOnDevice()) return false;
  try {
    return !window.localStorage.getItem(SHOWN_KEY);
  } catch {
    return false;
  }
}

// À appeler quand la page d'installation s'affiche (après l'inscription ou ouverte par un lien) : plus de page automatique,
// plus de fenêtre « Installer » aujourd'hui, et Zara ne repose pas la question.
export function markInstallPageShown() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHOWN_KEY, '1');
    if (!window.localStorage.getItem(ZARA_INSTALL_KEY)) {
      window.localStorage.setItem(ZARA_INSTALL_KEY, JSON.stringify({ at: Date.now(), outcome: 'asked' }));
    }
  } catch {
    // stockage bloqué : la page pourra revenir
  }
  void AsyncStorage.setItem(appPopupSeenKey(), '1');
}
