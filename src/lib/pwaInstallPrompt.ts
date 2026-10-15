// Capture l'evenement Chrome "beforeinstallprompt" des le chargement de la
// page (il ne se redeclenche pas si on l'ecoute trop tard) pour pouvoir
// declencher la vraie boite de dialogue d'installation native de Chrome
// depuis notre propre bouton "Installer".
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function isPwaInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

export async function triggerPwaInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

export function isRunningAsInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
    const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    return Boolean(standaloneMedia || iosStandalone);
  } catch {
    return false;
  }
}
