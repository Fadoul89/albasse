import { Platform } from 'react-native';

// Petit « ding » doux (deux notes) joué quand Zara s'ouvre toute seule. Il est fabriqué par le navigateur : aucun fichier à charger.
// Les navigateurs des téléphones n'autorisent un son que si le visiteur a déjà touché l'écran : sinon le contexte audio démarre « suspendu » et on
// ne joue rien (Zara s'ouvre en silence). On ne force jamais : un son qui partirait plus tard, à un autre moment, serait pire que pas de son.
export function playZaraDing(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    if (ctx.state !== 'running') {
      void ctx.close().catch(() => undefined);
      return false;
    }
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    // doux : volume bas, montée rapide puis descente
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    for (const [freq, at] of [
      [880, 0],
      [1320, 0.14],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + at);
      osc.connect(gain);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.45);
    }
    setTimeout(() => void ctx.close().catch(() => undefined), 1200);
    return true;
  } catch {
    return false;
  }
}
