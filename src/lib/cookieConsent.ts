// Choix du visiteur pour les cookies de mesure publicitaire (pixel TikTok).
// Avant son accord, RIEN n'est envoyé à TikTok. Les données nécessaires au fonctionnement du site (compte, panier, favoris) ne sont pas concernées.
import { Platform } from 'react-native';

import { parseChoice, type CookieChoice } from './cookieChoice';
export { COOKIE_KEY, COOKIE_TEXT, parseChoice, shouldShowBanner, type CookieChoice } from './cookieChoice';
import { COOKIE_KEY } from './cookieChoice';

const listeners = new Set<(c: CookieChoice | null) => void>();
let memory: CookieChoice | null = null; // si le navigateur refuse le stockage : le choix tient jusqu'au prochain chargement

export function readChoice(): CookieChoice | null {
  if (Platform.OS !== 'web') return null;
  try {
    const stored = parseChoice(window.localStorage.getItem(COOKIE_KEY));
    return stored ?? memory;
  } catch {
    return memory;
  }
}

export function saveChoice(choice: CookieChoice): void {
  memory = choice;
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(COOKIE_KEY, choice);
    } catch {
      /* stockage bloqué : le choix reste en mémoire */
    }
  }
  listeners.forEach((fn) => fn(choice));
}

export function onChoiceChange(fn: (c: CookieChoice | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Vrai seulement si le visiteur a dit « Accepter ». */
export function hasCookieConsent(): boolean {
  return readChoice() === 'accepted';
}
