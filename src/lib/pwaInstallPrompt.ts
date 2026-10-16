type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __pwaInstallPrompt__?: BeforeInstallPromptEvent;
  }
}

// Fallback listener pour les cas où le module est chargé avant l'événement.
// La capture principale est dans public/index.html (avant React).
let deferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

function getPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return window.__pwaInstallPrompt__ ?? deferredPrompt ?? null;
}

export function isPwaInstallPromptAvailable(): boolean {
  return getPrompt() !== null;
}

export async function triggerPwaInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const promptEvent = getPrompt();
  if (!promptEvent) return 'unavailable';
  // Effacer pour ne pas redéclencher deux fois
  if (typeof window !== 'undefined') window.__pwaInstallPrompt__ = undefined;
  deferredPrompt = null;
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

// Safari iOS ne propose jamais de boite de dialogue automatique
// (beforeinstallprompt n'existe pas) : l'installation se fait toujours a la
// main via le bouton Partager. On le detecte pour afficher les bonnes
// instructions plutot que le bouton "Installer" en un tap.
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

// Distingue Android d'un PC (Windows/Mac/Linux) quand la boite de dialogue
// automatique n'est pas disponible : les instructions manuelles different
// ("ecran d'accueil" sur mobile vs barre d'adresse sur ordinateur).
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
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
