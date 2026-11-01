// Le bouton « Facebook » d'une fiche produit : sur téléphone, il ouvre l'APPLICATION Facebook (pas le navigateur) avec le lien
// de l'article prêt à partager. Sans l'application, la page de partage du site Facebook s'ouvre à la place.
// (Comment l'ouvrir selon l'appareil : shareTarget.ts, le même pour LinkedIn.)
import { currentShareDevice, openShareTarget, type ShareDevice, type ShareTarget } from './shareTarget';

export type FacebookShareTarget = ShareTarget;
export type FacebookDevice = ShareDevice;

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

export const currentFacebookDevice = currentShareDevice;

// Web seulement.
export function shareOnFacebook(pageUrl: string) {
  openShareTarget(facebookShareTarget(pageUrl, currentFacebookDevice()));
}
