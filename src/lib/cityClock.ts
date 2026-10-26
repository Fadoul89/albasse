// Horloge des villes du Tchad (accueil du site) : l'heure locale de N'Djamena, Abéché, Moundou, Moussoro, Ati, Mongo, Sarh et Amdjarass,
// une ville après l'autre, 10 secondes chacune. Des fonctions pures, testées dans tests/email/city-clock.test.ts.
// Vérité sur l'heure : le Tchad entier est en UTC+1 toute l'année (pas d'heure d'été), donc toutes ces villes affichent la MÊME heure ;
// elle est calculée à partir de l'heure UTC, jamais de celle du téléphone du client (qui peut être mal réglée ou dans un autre pays).

export const CITY_CLOCK_SECONDS = 10;

const NDJAMENA_OFFSET_MS = 3_600_000;

// l'ordre demandé par le patron
export const CLOCK_CITIES = ["N'Djamena", 'Abéché', 'Moundou', 'Moussoro', 'Ati', 'Mongo', 'Sarh', 'Amdjarass'] as const;

const two = (n: number) => String(n).padStart(2, '0');

// « 06:15 » : l'heure et les minutes locales au Tchad
export function chadTime(now: number = Date.now()): string {
  const d = new Date(now + NDJAMENA_OFFSET_MS);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

// la ville affichée quand 'secondes' secondes se sont écoulées depuis l'ouverture de la page (N'Djamena d'abord, puis on tourne)
export function cityIndexAt(elapsedSeconds: number, count: number = CLOCK_CITIES.length): number {
  if (!(elapsedSeconds > 0)) return 0;
  return Math.floor(elapsedSeconds / CITY_CLOCK_SECONDS) % count;
}

// « 06:15 H à N'Djamena » : la phrase lue par les lecteurs d'écran
export function clockSentence(index: number, now: number = Date.now()): string {
  const city = CLOCK_CITIES[((index % CLOCK_CITIES.length) + CLOCK_CITIES.length) % CLOCK_CITIES.length];
  return `${chadTime(now)} H à ${city}`;
}
