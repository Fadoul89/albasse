// Ouvrir une page de partage (Facebook, LinkedIn…) : sur téléphone, l'APPLICATION du réseau s'ouvre (pas le navigateur) avec le lien de l'article
// prêt à partager ; sans l'application, la page de partage du site s'ouvre à la place. Ce qui change d'un réseau à l'autre (le lien à ouvrir) est dans
// facebookShare.ts et linkedinShare.ts ; ce fichier sait seulement l'ouvrir, selon l'appareil. Web seulement.
import { isAndroidDevice, isIosDevice } from './pwaInstallPrompt';
import { isRunningInsideApp } from './runningInApp';

export type ShareTarget =
  // Chrome sur Android : l'application, ou la page de partage si elle n'est pas installée (Chrome s'en charge)
  | { kind: 'intent'; url: string }
  // dans l'application Albasse (Android) : on essaie l'application, puis la page de partage si elle ne s'est pas ouverte
  | { kind: 'app'; url: string; fallback: string }
  // iPhone : le lien du réseau s'ouvre de lui-même dans son application quand elle est installée
  | { kind: 'link'; url: string }
  // ordinateur : un nouvel onglet
  | { kind: 'tab'; url: string };

export type ShareDevice = 'android' | 'android-app' | 'ios' | 'desktop';

export function currentShareDevice(): ShareDevice {
  if (isAndroidDevice()) return isRunningInsideApp() ? 'android-app' : 'android';
  if (isIosDevice()) return 'ios';
  return 'desktop';
}

// Un vrai lien touché (dans le geste du client) : c'est ce qui permet au téléphone d'ouvrir l'application.
function follow(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function openShareTarget(target: ShareTarget) {
  if (target.kind === 'tab') {
    window.open(target.url, '_blank', 'noopener');
    return;
  }
  if (target.kind !== 'app') {
    follow(target.url);
    return;
  }
  // l'application Albasse ne peut pas savoir si l'autre application est installée : si la page est encore là 1,5 s plus tard, elle ne s'est
  // pas ouverte, on ouvre alors la page de partage
  let left = false;
  const onHide = () => {
    left = true;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') left = true;
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onHide);
  window.addEventListener('pagehide', onHide);
  follow(target.url);
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onHide);
    window.removeEventListener('pagehide', onHide);
    if (!left) follow(target.fallback);
  }, 1500);
}
