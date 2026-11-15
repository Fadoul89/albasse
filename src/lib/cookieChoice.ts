// Partie pure (sans React Native) du choix pour les cookies : testée par tests/email/cookie-consent.test.ts

export type CookieChoice = 'accepted' | 'refused';

export const COOKIE_KEY = 'albasse_cookie_consent';

export const COOKIE_TEXT = {
  title: '🍪 Vos cookies',
  body: 'Avec votre accord, nous utilisons le pixel TikTok pour mesurer l’effet de nos publicités. Si vous refusez, rien n’est envoyé à TikTok et le site fonctionne pareil.',
  accept: 'Accepter',
  refuse: 'Refuser',
  more: 'En savoir plus',
  // dans la politique de confidentialité
  settingsTitle: 'Mon choix pour les cookies',
  settingsAccepted: 'Vous avez accepté la mesure publicitaire (pixel TikTok).',
  settingsRefused: 'Vous avez refusé la mesure publicitaire : rien n’est envoyé à TikTok.',
  settingsNone: 'Vous n’avez pas encore choisi.',
  settingsChange: 'Changer mon choix',
} as const;

/** Valeur lue dans le stockage du navigateur -> choix, ou null (pas encore choisi / valeur inconnue). */
export function parseChoice(raw: string | null | undefined): CookieChoice | null {
  return raw === 'accepted' || raw === 'refused' ? raw : null;
}

/** Le bandeau n'apparaît que sur le site web, tant que le visiteur n'a pas choisi. */
export function shouldShowBanner(choice: CookieChoice | null, isWeb: boolean): boolean {
  return isWeb && choice === null;
}
