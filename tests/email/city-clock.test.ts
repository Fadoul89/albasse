// Horloge des villes du Tchad (src/lib/cityClock.ts) : heure UTC+1 et rotation toutes les 10 secondes.
// Lancer : TZ=America/Los_Angeles node --import ./tests/zara/register.mjs tests/email/city-clock.test.ts
import { CITY_CLOCK_SECONDS, CLOCK_CITIES, chadTime, cityIndexAt, clockSentence } from '../../src/lib/cityClock.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// --- l'heure : UTC+1, quelle que soit l'heure du téléphone ---
check('05:15 UTC → 06:15 à N’Djamena (l’exemple du patron)', chadTime(Date.UTC(2026, 9, 26, 5, 15)) === '06:15', chadTime(Date.UTC(2026, 9, 26, 5, 15)));
check('minuit à N’Djamena = 23:00 UTC', chadTime(Date.UTC(2026, 9, 25, 23, 0)) === '00:00');
check('23:30 UTC → 00:30 le lendemain', chadTime(Date.UTC(2026, 9, 26, 23, 30)) === '00:30');
check('pas d’heure d’été : juillet et janvier, même décalage', chadTime(Date.UTC(2026, 6, 1, 12, 0)) === '13:00' && chadTime(Date.UTC(2027, 0, 1, 12, 0)) === '13:00');
check('toujours 5 caractères « HH:MM » (zéros devant)', chadTime(Date.UTC(2026, 9, 26, 2, 5)) === '03:05' && chadTime(Date.UTC(2026, 9, 26, 8, 9)) === '09:09');
check('les secondes ne changent rien', chadTime(Date.UTC(2026, 9, 26, 5, 15, 59)) === '06:15' && chadTime(Date.UTC(2026, 9, 26, 5, 16, 0)) === '06:16');
check('l’heure ne dépend pas du fuseau du téléphone (TZ=' + (process.env.TZ ?? 'système') + ')', chadTime(Date.UTC(2026, 9, 26, 12, 0)) === '13:00');

// --- les villes, dans l’ordre demandé ---
check('8 villes : N’Djamena, Abéché, Moundou, Moussoro, Ati, Mongo, Sarh, Amdjarass', CLOCK_CITIES.join('|') === "N'Djamena|Abéché|Moundou|Moussoro|Ati|Mongo|Sarh|Amdjarass", CLOCK_CITIES);
check('10 secondes par ville', CITY_CLOCK_SECONDS === 10);

// --- la rotation ---
check('à l’ouverture : N’Djamena (0 s et 9 s)', cityIndexAt(0) === 0 && cityIndexAt(9.99) === 0);
check('à 10 s : Abéché ; à 20 s : Moundou ; à 30 s : Moussoro', cityIndexAt(10) === 1 && cityIndexAt(20) === 2 && cityIndexAt(30) === 3);
check('à 70 s : Amdjarass (la dernière)', cityIndexAt(70) === 7 && CLOCK_CITIES[cityIndexAt(70)] === 'Amdjarass');
check('à 80 s : on repart de N’Djamena', cityIndexAt(80) === 0 && cityIndexAt(160) === 0 && cityIndexAt(170) === 1);
check('valeurs bizarres : 0, négatif, NaN → N’Djamena', cityIndexAt(-5) === 0 && cityIndexAt(NaN) === 0);

// --- la phrase lue par les lecteurs d’écran ---
check('« 06:15 H à N’Djamena »', clockSentence(0, Date.UTC(2026, 9, 26, 5, 15)) === "06:15 H à N'Djamena", clockSentence(0, Date.UTC(2026, 9, 26, 5, 15)));
check('« 06:15 H à Amdjarass », et l’index hors limites revient dans la liste', clockSentence(7, Date.UTC(2026, 9, 26, 5, 15)) === '06:15 H à Amdjarass' && clockSentence(8, Date.UTC(2026, 9, 26, 5, 15)).endsWith("N'Djamena") && clockSentence(-1, Date.UTC(2026, 9, 26, 5, 15)).endsWith('Amdjarass'));

console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
