// Le bouton « LinkedIn » d'une fiche produit, à côté de « WhatsApp » et « Facebook » : sur téléphone, il ouvre l'APPLICATION LinkedIn (pas le
// navigateur) avec le lien de l'article prêt à publier. Sans l'application, la page de partage du site LinkedIn s'ouvre à la place ;
// sur ordinateur, dans un nouvel onglet (la fiche de l'article reste affichée).
// (Comment l'ouvrir selon l'appareil : shareTarget.ts, le même que pour Facebook.) Fonctions simples, sans réseau : tests/email/linkedin-share.test.ts.
import { currentShareDevice, openShareTarget, type ShareDevice, type ShareTarget } from './shareTarget';

export const LINKEDIN_SHARE_BASE = 'https://www.linkedin.com/sharing/share-offsite/';
const LINKEDIN_ANDROID_PACKAGE = 'com.linkedin.android';

export function linkedinShareUrl(pageUrl: string): string {
  return `${LINKEDIN_SHARE_BASE}?url=${encodeURIComponent(pageUrl)}`;
}

export function linkedinShareTarget(pageUrl: string, device: ShareDevice): ShareTarget {
  const web = linkedinShareUrl(pageUrl);
  // Android : le lien de partage est donné DIRECTEMENT à l'application LinkedIn (son nom de paquet) ; si elle n'est pas installée,
  // Chrome ouvre la page de partage du site (« browser_fallback_url »)
  const intent = `intent://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}#Intent;scheme=https;package=${LINKEDIN_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(web)};end`;
  switch (device) {
    case 'android':
      return { kind: 'intent', url: intent };
    case 'android-app':
      // dans l'application Albasse : même demande à l'application LinkedIn ; si la page est encore là 1,5 s plus tard, la page de partage
      return { kind: 'app', url: intent, fallback: web };
    case 'ios':
      // iPhone : le lien linkedin.com s'ouvre de lui-même dans l'application LinkedIn quand elle est installée
      return { kind: 'link', url: web };
    default:
      return { kind: 'tab', url: web };
  }
}

// Web seulement.
export function shareOnLinkedIn(pageUrl: string) {
  openShareTarget(linkedinShareTarget(pageUrl, currentShareDevice()));
}
