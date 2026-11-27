// Icône « Black Friday » (petite pastille) : accueil et cartes articles en vraie promotion, du 27 au 30 novembre 2026 inclus
// (heure de N'Djamena), retirée automatiquement le 1er décembre. Date fixe, pas de valeur en base — purement saisonnier ;
// pour la reconduire l'an prochain, changer BLACK_FRIDAY_BADGE_END.
export const BLACK_FRIDAY_BADGE_END = '2026-11-30';

const NDJAMENA_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function blackFridayBadgeActive(now: number = Date.now()): boolean {
  const end = Date.parse(`${BLACK_FRIDAY_BADGE_END}T00:00:00Z`) + DAY_MS - NDJAMENA_OFFSET_MS;
  return now < end;
}
