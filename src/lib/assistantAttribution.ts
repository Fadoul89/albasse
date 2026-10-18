// Ce qui vient de Zara : l'appareil du client, et la mémoire (sur son téléphone) de « il vient de toucher un bouton de Zara ».
// Aucun réseau ici : tout est testable. Rien de personnel n'est gardé, seulement le type d'appareil.

export type DeviceLabel = 'iPhone' | 'Android' | 'Tablette' | 'PC';

// Même découpage que les installations du site (tableau de bord) : iPhone, Android (téléphone), Tablette, PC.
export function deviceFromUserAgent(ua: string | null | undefined): DeviceLabel {
  const agent = ua ?? '';
  if (/iPad/i.test(agent)) return 'Tablette';
  if (/iPhone|iPod/i.test(agent)) return 'iPhone';
  if (/Android/i.test(agent)) return /Mobile/i.test(agent) ? 'Android' : 'Tablette';
  return 'PC';
}

export function currentDevice(): DeviceLabel {
  return deviceFromUserAgent(typeof navigator === 'undefined' ? '' : navigator.userAgent);
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Le stockage du téléphone, ou rien s'il est bloqué (navigation privée...) : on ne casse jamais le site pour une statistique.
export function deviceStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export type IntentKind = 'signup' | 'install';

const KEYS: Record<IntentKind, string> = {
  signup: 'albasse_zara_signup_intent',
  install: 'albasse_zara_install_intent',
};

// Combien de temps après avoir touché le bouton de Zara on compte encore ce qui suit « grâce à Zara » :
// un compte (3 jours : le client peut confirmer son e-mail plus tard) ; une installation (30 minutes : il installe tout de suite).
export const INTENT_WINDOW_MS: Record<IntentKind, number> = {
  signup: 3 * 24 * 3600 * 1000,
  install: 30 * 60 * 1000,
};

export function markIntent(kind: IntentKind, device: DeviceLabel, store: KeyValueStore | null = deviceStore(), now: number = Date.now()) {
  try {
    store?.setItem(KEYS[kind], JSON.stringify({ at: now, device }));
  } catch {
    // ignore : la statistique est perdue, rien d'autre
  }
}

export function readIntent(kind: IntentKind, store: KeyValueStore | null = deviceStore(), now: number = Date.now()): { at: number; device: DeviceLabel } | null {
  try {
    const raw = store?.getItem(KEYS[kind]);
    if (!raw) return null;
    const value = JSON.parse(raw) as { at?: unknown; device?: unknown };
    const at = Number(value.at);
    const device = value.device;
    if (!Number.isFinite(at) || at > now + 60_000 || now - at > INTENT_WINDOW_MS[kind]) return null;
    if (device !== 'iPhone' && device !== 'Android' && device !== 'Tablette' && device !== 'PC') return null;
    return { at, device };
  } catch {
    return null;
  }
}

export function clearIntent(kind: IntentKind, store: KeyValueStore | null = deviceStore()) {
  try {
    store?.removeItem(KEYS[kind]);
  } catch {
    // ignore
  }
}
