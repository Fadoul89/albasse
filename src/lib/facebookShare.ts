// Le bouton « Facebook » d'une fiche produit : sur téléphone, il ouvre l'APPLICATION Facebook (pas le navigateur) avec le lien
// de l'article prêt à partager. Sans l'application, la page de partage du site Facebook s'ouvre à la place.
import { isAndroidDevice, isIosDevice } from './pwaInstallPrompt';
import { isRunningInsideApp } from './runningInApp';

export type FacebookShareTarget =
  // Chrome sur Android : l'application Facebook, ou la page de partage si elle n'est pas installée (Chrome s'en charge)
  | { kind: 'intent'; url: string }
  // dans l'application Albasse (Android) : on essaie l'application Facebook, puis la page de partage si elle ne s'est pas ouverte
  | { kind: 'app'; url: string; fallback: string }
  // iPhone : le lien Facebook s'ouvre de lui-même dans l'application Facebook quand elle est installée
  | { kind: 'link'; url: string }
  // ordinateur : un nouvel onglet
  | { kind: 'tab'; url: string };

export type FacebookDevice = 'android' | 'android-app' | 'ios' | 'desktop';

const FB_ANDROID_PACKAGE = 'com.facebook.katana';

export function facebookSharerUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
}

export function facebookShareTarget(pageUrl: string, device: FacebookDevice): FacebookShareTarget {
  const web = facebookSharerUrl(pageUrl);
  // « facewebmodal » : l'application Facebook ouvre la page de partage chez elle, avec le compte déjà connecté
  const inFbApp = `facewebmodal/f?href=${encodeURIComponent(web)}`;
  switch (device) {
    case 'android':
      return { kind: 'intent', url: `intent://${inFbApp}#Intent;scheme=fb;package=${FB_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(web)};end` };
    case 'android-app':
      return { kind: 'app', url: `fb://${inFbApp}`, fallback: web };
    case 'ios':
      return { kind: 'link', url: web };
    default:
      return { kind: 'tab', url: web };
  }
}

export function currentFacebookDevice(): FacebookDevice {
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

// Web seulement.
export function shareOnFacebook(pageUrl: string) {
  const target = facebookShareTarget(pageUrl, currentFacebookDevice());
  if (target.kind === 'tab') {
    window.open(target.url, '_blank', 'noopener');
    return;
  }
  if (target.kind !== 'app') {
    follow(target.url);
    return;
  }
  // l'application Albasse ne peut pas savoir si Facebook est installé : si la page est encore là 1,5 s plus tard, Facebook ne s'est
  // pas ouvert, on ouvre alors la page de partage
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
