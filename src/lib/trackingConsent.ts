// Le choix du visiteur sur le suivi de sa navigation (les articles qu'il regarde, pour que Zara le conseille mieux).
// Règle : le suivi se fait en arrière-plan, sans message ni bouton qui dérange le visiteur ; il est actif tant que le visiteur ne l'a pas
// refusé (page de confidentialité, ou en l'écrivant à Zara) ; le refus est respecté tout de suite et partout.
// Les signaux « Ne pas me suivre » du navigateur (Do Not Track, Global Privacy Control) comptent comme un refus,
// sauf si le visiteur a lui-même accepté ici. Aucun réseau : tout est testable.

import { deviceStore, type KeyValueStore } from './assistantAttribution';

export type TrackingChoice = 'granted' | 'denied' | 'unset';

const CHOICE_KEY = 'albasse_tracking_choice';

export interface PrivacySignals {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}

export function privacySignals(): PrivacySignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = (typeof window === 'undefined' ? {} : window) as { doNotTrack?: string };
  return { doNotTrack: nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack ?? null, globalPrivacyControl: nav.globalPrivacyControl === true };
}

export function readChoice(store: KeyValueStore | null = deviceStore()): TrackingChoice {
  try {
    const raw = store?.getItem(CHOICE_KEY);
    if (!raw) return 'unset';
    const value = (JSON.parse(raw) as { choice?: unknown }).choice;
    return value === 'granted' || value === 'denied' ? value : 'unset';
  } catch {
    return 'unset';
  }
}

export function writeChoice(choice: 'granted' | 'denied', store: KeyValueStore | null = deviceStore(), now: number = Date.now()): void {
  try {
    store?.setItem(CHOICE_KEY, JSON.stringify({ choice, at: now }));
  } catch {
    // ignore : le choix ne sera pas retenu, le suivi reste refusé pour cette visite grâce au drapeau mémoire du tracker
  }
}

// Le suivi est-il permis ? Le choix du visiteur gagne toujours ; sans choix, un signal « Ne pas me suivre » du navigateur l'emporte.
export function isTrackingAllowed(store: KeyValueStore | null = deviceStore(), signals: PrivacySignals = privacySignals()): boolean {
  const choice = readChoice(store);
  if (choice === 'denied') return false;
  if (choice === 'granted') return true;
  const dnt = signals.doNotTrack;
  return !(dnt === '1' || dnt === 'yes' || signals.globalPrivacyControl === true);
}
