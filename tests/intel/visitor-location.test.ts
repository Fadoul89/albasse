// Option GPS : règles pures de src/lib/visitorLocation.ts (pas de réseau, pas de navigateur ici).
// Lancer : node --import ./tests/zara/register.mjs tests/intel/visitor-location.test.ts
import { hasAlreadyAsked, markAsked, shouldRequestLocation, parseNominatimAddress } from '../../src/lib/visitorLocation.ts';
import type { KeyValueStore } from '../../src/lib/assistantAttribution.ts';

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

function fakeStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// --- hasAlreadyAsked / markAsked ---
{
  const store = fakeStore();
  check('hasAlreadyAsked : faux au départ', hasAlreadyAsked(store) === false);
  markAsked(store);
  check('hasAlreadyAsked : vrai après markAsked', hasAlreadyAsked(store) === true);
}
check('hasAlreadyAsked : faux sans magasin (null)', hasAlreadyAsked(null) === false);

// --- shouldRequestLocation ---
{
  const store = fakeStore();
  check('shouldRequestLocation : oui par défaut (aucun refus)', shouldRequestLocation(store, {}) === true);
}
{
  const store = fakeStore();
  markAsked(store);
  check('shouldRequestLocation : non si déjà demandée sur cet appareil', shouldRequestLocation(store, {}) === false);
}
{
  const store = fakeStore();
  check('shouldRequestLocation : non si Ne-pas-me-suivre (DNT)', shouldRequestLocation(store, { doNotTrack: '1' }) === false);
}
{
  const store = fakeStore();
  check('shouldRequestLocation : non si Global Privacy Control', shouldRequestLocation(store, { globalPrivacyControl: true }) === false);
}

// --- parseNominatimAddress ---
check('parseNominatimAddress : rien si pas de JSON', JSON.stringify(parseNominatimAddress(null)) === JSON.stringify({ address: null, city: null, region: null, country: null }));

{
  const json = {
    display_name: 'Avenue Charles de Gaulle, Ndjamena, Tchad',
    address: { city: 'Ndjamena', state: 'Ndjamena', country: 'Tchad' },
  };
  const parsed = parseNominatimAddress(json);
  check('parseNominatimAddress : adresse complète', parsed.address === 'Avenue Charles de Gaulle, Ndjamena, Tchad', parsed);
  check('parseNominatimAddress : ville', parsed.city === 'Ndjamena', parsed);
  check('parseNominatimAddress : région', parsed.region === 'Ndjamena', parsed);
  check('parseNominatimAddress : pays', parsed.country === 'Tchad', parsed);
}

{
  // "town" et "county" quand "city" et "state" manquent
  const json = { address: { town: 'Moundou', county: 'Logone Occidental', country: 'Tchad' } };
  const parsed = parseNominatimAddress(json);
  check('parseNominatimAddress : ville via town', parsed.city === 'Moundou', parsed);
  check('parseNominatimAddress : région via county', parsed.region === 'Logone Occidental', parsed);
}

{
  // champs absents : jamais de chaîne vide, toujours null
  const parsed = parseNominatimAddress({ address: { city: '   ' } });
  check('parseNominatimAddress : chaîne vide traitée comme absente', parsed.city === null, parsed);
}

console.log(`\n${ok} contrôles réussis`);
