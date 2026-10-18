// Mesure du temps ACTIF passé sur une fiche : un onglet laissé ouvert, un téléphone en veille ou un client qui ne touche plus rien
// ne comptent pas. Aucun écran, aucun réseau : tout est testable.

export const TICK_MS = 1000; // le tracker regarde l'écran chaque seconde
export const MAX_TICK_MS = 2000; // une seconde « longue » (veille, onglet gelé) compte au plus 2 s, jamais tout le trou
export const IDLE_MS = 60 * 1000; // sans toucher à rien pendant 1 minute : plus du temps actif

export interface ActivityState {
  visible: boolean; // l'onglet est affiché
  focused: boolean; // la fenêtre est au premier plan
  lastInteractionAt: number; // dernier toucher, clic, défilement ou touche
  now: number;
}

export function isActive(s: ActivityState): boolean {
  return s.visible && s.focused && s.now - s.lastInteractionAt < IDLE_MS;
}

export class ActiveTimer {
  private last: number;
  private ms = 0;

  constructor(now: number) {
    this.last = now;
  }

  // À appeler à chaque seconde (et avant d'enregistrer) : ajoute le temps écoulé seulement si le client était actif.
  tick(now: number, active: boolean): number {
    const dt = now - this.last;
    this.last = now;
    if (dt > 0 && active) this.ms += Math.min(dt, MAX_TICK_MS);
    return this.ms;
  }

  get seconds(): number {
    return this.ms / 1000;
  }
}
