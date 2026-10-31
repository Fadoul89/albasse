// Petit signal entre la publicité de Zara (accueil) et l'ouverture automatique de son chat : quand une publicité va vraiment s'afficher,
// la carte annonce l'heure de son apparition, et Zara laisse la carte se montrer quelques secondes avant d'ouvrir son chat par-dessus.
// Sans publicité à montrer (réglage éteint, aucun fait vrai à dire), rien n'est annoncé et Zara s'ouvre à l'heure habituelle.
import { create } from 'zustand';

interface ZaraAdSignal {
  // heure (Date.now()) à laquelle la carte apparaît, ou null s'il n'y a pas de publicité à montrer
  readyAt: number | null;
  announce: (readyAt: number) => void;
  clear: () => void;
}

export const useZaraAdSignal = create<ZaraAdSignal>((set) => ({
  readyAt: null,
  announce: (readyAt) => set({ readyAt }),
  clear: () => set({ readyAt: null }),
}));

// Combien de temps la carte reste seule à l'écran avant que Zara n'ouvre son chat.
export const ZARA_AD_TO_CHAT_MS = 10000;

// L'heure d'ouverture du chat : à l'heure habituelle (baseMs après l'arrivée sur l'accueil), mais pas avant ZARA_AD_TO_CHAT_MS après l'apparition de la carte.
export function zaraChatOpensAt(startedAt: number, baseMs: number, adReadyAt: number | null): number {
  const usual = startedAt + baseMs;
  return adReadyAt === null ? usual : Math.max(usual, adReadyAt + ZARA_AD_TO_CHAT_MS);
}
