export interface LoyaltyTier {
  key: 'bronze' | 'argent' | 'or' | 'platine' | 'diamond';
  label: string;
  icon: string;
  min: number;
}

// 5000 FCFA depenses = 1 point. Paliers jusqu'a 100 points (Diamond).
export const LOYALTY_TIERS: LoyaltyTier[] = [
  { key: 'bronze', label: 'Bronze', icon: '🥉', min: 0 },
  { key: 'argent', label: 'Argent', icon: '🥈', min: 25 },
  { key: 'or', label: 'Or', icon: '🥇', min: 50 },
  { key: 'platine', label: 'Platine', icon: '🔷', min: 75 },
  { key: 'diamond', label: 'Diamond', icon: '💎', min: 100 },
];

export interface LoyaltyStatus {
  points: number;
  current: LoyaltyTier;
  next: LoyaltyTier | null;
  progress: number; // 0 a 1, vers le prochain palier
  pointsToNext: number;
}

export function getLoyaltyStatus(points: number): LoyaltyStatus {
  points = points ?? 0;
  let current = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (points >= tier.min) current = tier;
  }
  const currentIndex = LOYALTY_TIERS.indexOf(current);
  const next = LOYALTY_TIERS[currentIndex + 1] ?? null;
  const progress = next ? Math.min(1, (points - current.min) / (next.min - current.min)) : 1;
  const pointsToNext = next ? Math.max(0, next.min - points) : 0;
  return { points, current, next, progress, pointsToNext };
}
