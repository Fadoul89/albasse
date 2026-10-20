// Ce que le téléphone dit pour le rappel des notifications de Zara (règle : lib/pushReminderRule).
import { Platform } from 'react-native';
import { isWebPushSupported } from './webPushSubscription';
import { isAppInstalledOnDevice, isRunningAsInstalledPwa } from './pwaInstallPrompt';
import { PUSH_REMINDER_KEY, pushReminder, type PushOutcome, type PushReminder } from './pushReminderRule';

function readRecord(): { at: number; outcome: string } | null {
  try {
    const raw = window.localStorage.getItem(PUSH_REMINDER_KEY);
    return raw ? (JSON.parse(raw) as { at: number; outcome: string }) : null;
  } catch {
    return null;
  }
}

export function pushReminderNow(ignorePause = false): PushReminder {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof Notification === 'undefined') return 'none';
  return pushReminder({
    supported: isWebPushSupported(),
    permission: Notification.permission,
    installed: isRunningAsInstalledPwa() || isAppInstalledOnDevice(),
    record: readRecord(),
    now: Date.now(),
    ignorePause,
  });
}

export function recordPushReminder(outcome: PushOutcome) {
  try {
    window.localStorage.setItem(PUSH_REMINDER_KEY, JSON.stringify({ at: Date.now(), outcome }));
  } catch {
    // stockage bloqué : Zara pourra le redire
  }
}
