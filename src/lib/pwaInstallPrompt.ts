type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __pwaInstallPrompt__?: BeforeInstallPromptEvent;
    __pwaInstallIssue__?: string;
  }
}

// Dernier resultat du bouton « Installer » : affiche par le diagnostic (?diag=1)
// et dans le message quand la boite d'installation n'a pas pu s'ouvrir.
let lastOutcome: 'accepted' | 'dismissed' | 'unavailable' | null = null;
function note(text: string) {
  if (typeof window !== 'undefined') window.__pwaInstallIssue__ = text;
}
function describeError(e: unknown): string {
  const err = e as { name?: string; message?: string } | null;
  return `${err?.name ?? 'Erreur'} : ${String(err?.message ?? e).slice(0, 90)}`;
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

// Le téléphone a-t-il déjà Albasse Shopping ? Retenu sur l'appareil quand le site tourne en application (raccourci ouvert depuis
// l'écran d'accueil), quand Chrome annonce l'installation (« appinstalled »), quand le visiteur accepte la boîte d'installation,
// ou quand Chrome Android voit le raccourci déjà installé (manifest « related_applications »).
const INSTALLED_KEY = 'albasse_app_installed';
// posé par le suivi des installations (appInstallTracking) quand le visiteur a accepté la boîte d'installation
const SHORTCUT_TRACKED_KEY = 'albasse_shortcut_install_tracked';

export function rememberAppInstalled() {
  try {
    window.localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    // stockage bloqué : le bouton restera proposé
  }
}

if (typeof window !== 'undefined') {
  // installée (par le menu de Chrome ou un bouton du site) : l'ancienne invite gardée ne sert plus
  window.addEventListener('appinstalled', () => {
    window.__pwaInstallPrompt__ = undefined;
    deferredPrompt = null;
    rememberAppInstalled();
  });
  if (isRunningAsInstalledPwa()) rememberAppInstalled();
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (Array.isArray(apps) && apps.length > 0) rememberAppInstalled();
    })
    .catch(() => {});
}

export function isAppInstalledOnDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isRunningAsInstalledPwa()) return true;
  // Chrome ne propose l'installation que si l'application n'est PAS installée : un ancien souvenir (désinstallée depuis) est oublié
  if (getPrompt()) {
    try {
      window.localStorage.removeItem(INSTALLED_KEY);
    } catch {
      // ignore
    }
    return false;
  }
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === '1' || !!window.localStorage.getItem(SHORTCUT_TRACKED_KEY);
  } catch {
    return false;
  }
}

function getPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return window.__pwaInstallPrompt__ ?? deferredPrompt ?? null;
}

export function isPwaInstallPromptAvailable(): boolean {
  return getPrompt() !== null;
}

// Chrome peut declencher l'evenement quelques instants apres le tap : on
// patiente (le tap reste valide ~5 s) avant de dire que ce n'est pas encore
// pret. Navigateurs sans l'evenement (Firefox, Safari) : pas d'attente inutile.
function waitForPrompt(timeoutMs: number): Promise<BeforeInstallPromptEvent | null> {
  if (typeof window === 'undefined' || !('onbeforeinstallprompt' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', finish);
      resolve(getPrompt());
    };
    const timer = setTimeout(finish, timeoutMs);
    window.addEventListener('beforeinstallprompt', finish);
  });
}

export async function triggerPwaInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const promptEvent = getPrompt() ?? (await waitForPrompt(4500));
  if (!promptEvent) {
    note("aucun évènement de Chrome au moment du toucher");
    return 'unavailable';
  }
  // Effacer pour ne pas redéclencher deux fois
  if (typeof window !== 'undefined') window.__pwaInstallPrompt__ = undefined;
  deferredPrompt = null;
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    note(`choix dans la boîte de Chrome : ${outcome}`);
    lastOutcome = outcome;
    if (outcome === 'accepted') rememberAppInstalled();
    return outcome;
  } catch (e) {
    note(`prompt() a échoué : ${describeError(e)}`);
    lastOutcome = 'unavailable';
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

// Instructions manuelles quand la boite d'installation automatique n'est pas
// disponible. Le libelle du menu Chrome Android varie selon la version.
export function manualInstallInstructions(): string {
  if (isIosDevice()) {
    return "Pour installer : appuyez sur le bouton Partager (le carré avec une flèche) en bas de Safari, puis « Sur l'écran d'accueil ». Ouvrez ensuite l'icône Albasse et touchez « Activer » dans le bandeau vert pour recevoir les alertes.";
  }
  if (isAndroidDevice()) {
    return "Pour installer : appuyez sur les trois points (⋮) en haut à droite de Chrome, puis sur « Installer et créer un raccourci » (ou « Installer l'application » / « Ajouter à l'écran d'accueil » selon votre version).";
  }
  return "Pour installer : cliquez sur l'icône d'installation ⊕ dans la barre d'adresse de Chrome, ou sur les trois points (⋮) en haut à droite puis « Installer Albasse Shopping ».";
}

// Message affiche quand l'installation en un tap n'est pas disponible. Sur
// Chrome, l'evenement arrive seulement une fois le service worker actif et le
// site utilise un moment : le plus souvent il suffit d'attendre et de
// retoucher « Installer ». Les instructions manuelles restent en secours, et
// on rappelle que l'icone peut deja etre installee (Chrome ne propose alors
// plus rien).
export function installNotReadyMessage(): string {
  const manual = manualInstallInstructions();
  if (isIosDevice() || typeof window === 'undefined' || !('onbeforeinstallprompt' in window)) return manual;
  const detail = window.__pwaInstallIssue__ ? `\n\n(Détail technique : ${window.__pwaInstallIssue__})` : '';
  // Chrome ne renvoie pas l'evenement apres un refus dans la meme page : il faut recharger.
  if (lastOutcome === 'dismissed') {
    return (
      "Vous avez fermé la boîte d'installation de Chrome. Pour la rouvrir : rechargez la page (tirez vers le bas), attendez quelques secondes, puis touchez « Installer » de nouveau." +
      detail
    );
  }
  return (
    "Chrome prépare l'installation : patientez quelques secondes sur le site (jusqu'à 30 secondes), puis touchez « Installer » de nouveau." +
    '\n\nSinon, ' +
    manual.charAt(0).toLowerCase() +
    manual.slice(1) +
    "\n\nSi Albasse est déjà installé, ouvrez-le depuis votre écran d'accueil ou votre liste d'applications." +
    detail
  );
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
