// Zara rappelle d'activer les notifications à ceux qui ont installé Albasse Shopping sur leur téléphone mais ne les reçoivent pas
// encore (le patron envoie des notifications programmées : seuls les téléphones qui ont dit « Autoriser » les reçoivent).
// Règle pure (testée dans le cerveau) ; la lecture du téléphone est dans lib/pushReminder.
export const PUSH_REMINDER_KEY = 'albasse_zara_push';

export type PushOutcome = 'asked' | 'later' | 'steps' | 'accepted';
export type PushReminder = 'ask' | 'blocked' | 'none';

const DAY = 24 * 3600 * 1000;
// Après une question restée sans réponse : le lendemain ; « Plus tard » : 3 jours ; étapes pour débloquer : 7 jours.
export const PUSH_PAUSE_MS: Record<PushOutcome, number> = { asked: DAY, later: 3 * DAY, steps: 7 * DAY, accepted: 7 * DAY };

export function pushReminder(input: {
  supported: boolean; // le téléphone sait recevoir les notifications du site (pas l'application Albasse, pas Safari hors écran d'accueil)
  permission: 'default' | 'granted' | 'denied' | null;
  installed: boolean;
  record: { at: number; outcome: string } | null;
  now: number;
  ignorePause?: boolean; // le bouton du menu reste là tant que ce n'est pas activé
}): PushReminder {
  if (!input.supported || !input.installed) return 'none';
  if (input.permission !== 'default' && input.permission !== 'denied') return 'none';
  if (!input.ignorePause && input.record) {
    const pause = PUSH_PAUSE_MS[input.record.outcome as PushOutcome] ?? DAY;
    if (input.now - Number(input.record.at) < pause) return 'none';
  }
  return input.permission === 'denied' ? 'blocked' : 'ask';
}
