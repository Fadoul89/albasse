export const AIRLINES = [
  'Air France',
  'Turkish Airlines',
  'Ethiopian Airlines',
  'EgyptAir',
  'Royal Air Maroc',
  'Air Algérie',
  'ASKY Airlines',
  "Royal Airways (vol national Tchad)",
] as const;

export type Airline = (typeof AIRLINES)[number];
