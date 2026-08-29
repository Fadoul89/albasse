export const AIRLINES = [
  'Air France (Paris)',
  'Turkish Airlines (Istanbul)',
  'Ethiopian Airlines (Addis-Abeba)',
  'EgyptAir (Le Caire)',
  'ASKY Airlines (Lomé et réseau ouest-africain)',
  'Air Algérie (Alger)',
  'Royal Air Maroc (Casablanca)',
  "Royal Airways (vol national Tchad)",
] as const;

export type Airline = (typeof AIRLINES)[number];
