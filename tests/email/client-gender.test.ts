// Homme / Femme : le genre du client (choix, libellés, statistiques par genre, quand Zara demande une fois, formulaire du profil). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/client-gender.test.ts
import {
  ASK_GAP_MS,
  ASK_MAX,
  GENDERS,
  NEVER_ASKED,
  averagePerClient,
  genderAskDue,
  genderLabel,
  genderOf,
  genderSummary,
  hasGenderColumn,
  isGender,
  parseAskState,
  percent,
} from '../../src/lib/clientGender.ts';
import { checkProfileForm, formFromProfile, profileFormChanged } from '../../src/lib/profileEdit.ts';
import type { Profile } from '../../src/types/index.ts';

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

// ---- les deux choix, et rien d'autre
check('deux choix : homme et femme', GENDERS.length === 2 && GENDERS[0] === 'homme' && GENDERS[1] === 'femme');
check('« homme » et « femme » sont reconnus', isGender('homme') && isGender('femme'));
check('le reste est refusé : majuscule, vide, autre, null, nombre', !isGender('Homme') && !isGender('') && !isGender('autre') && !isGender(null) && !isGender(undefined) && !isGender(1));
check('genderOf : le genre ou null', genderOf('femme') === 'femme' && genderOf('x') === null && genderOf(undefined) === null);
check('libellés : Homme, Femme, Non précisé', genderLabel('homme') === 'Homme' && genderLabel('femme') === 'Femme' && genderLabel(null) === 'Non précisé' && genderLabel('zzz') === 'Non précisé');

// ---- la colonne existe seulement après le script SQL
check('profil sans la clé « gender » : colonne absente', !hasGenderColumn({ id: 'a' }));
check('profil avec « gender » vide : colonne présente', hasGenderColumn({ id: 'a', gender: null }));
check('aucun profil : colonne absente', !hasGenderColumn(null) && !hasGenderColumn(undefined));

// ---- statistiques par genre
const c = (gender: unknown, orderCount: number, completedOrders: number, totalSpent: number, productViewCount = 0) => ({ profile: { gender }, orderCount, completedOrders, totalSpent, productViewCount });
const sum = genderSummary([
  c('homme', 2, 1, 30000, 10),
  c('homme', 0, 0, 0, 3),
  c('femme', 3, 3, 90000, 20),
  c('femme', 1, 0, 0),
  c('femme', 0, 0, 0),
  c(null, 1, 1, 5000),
  c(undefined, 0, 0, 0),
  c('autre', 2, 2, 7000), // valeur impossible dans la base : comptée « non précisé »
]);
check('total 8 clients, genre connu pour 5', sum.total === 8 && sum.known === 5);
check('hommes : 2 clients, 1 a commandé, 2 commandes, 1 vente, 30 000 FCFA, 13 articles vus',
  sum.buckets.homme.clients === 2 && sum.buckets.homme.withOrders === 1 && sum.buckets.homme.orders === 2 && sum.buckets.homme.sales === 1 && sum.buckets.homme.revenue === 30000 && sum.buckets.homme.views === 13, sum.buckets.homme);
check('femmes : 3 clientes, 2 ont commandé, 4 commandes, 3 ventes, 90 000 FCFA',
  sum.buckets.femme.clients === 3 && sum.buckets.femme.withOrders === 2 && sum.buckets.femme.orders === 4 && sum.buckets.femme.sales === 3 && sum.buckets.femme.revenue === 90000, sum.buckets.femme);
check('non précisé : null, absent et valeur inconnue (3 clients, 12 000 FCFA)',
  sum.buckets.unknown.clients === 3 && sum.buckets.unknown.orders === 3 && sum.buckets.unknown.revenue === 12000, sum.buckets.unknown);
check('rien ne se perd : les trois groupes font le total', sum.buckets.homme.clients + sum.buckets.femme.clients + sum.buckets.unknown.clients === sum.total);
const none = genderSummary([]);
check('aucun client : tout à zéro', none.total === 0 && none.known === 0 && none.buckets.homme.clients === 0 && none.buckets.unknown.revenue === 0);
check('pourcentages : 5 sur 8 = 63 %, rien à diviser = « — »', percent(5, 8) === '63 %' && percent(0, 0) === '—' && percent(1, 3) === '33 %');
check('moyenne par client : 90 000 / 3 = 30 000 ; sans client = 0', averagePerClient(90000, 3) === 30000 && averagePerClient(5, 0) === 0);

// ---- quand Zara demande une fois (carte sur l'accueil)
const DAY = 86_400_000;
const T = Date.parse('2026-11-01T10:00:00Z');
const client = { is_admin: false, gender: null };
check('jamais demandé, colonne présente : la carte est montrée', genderAskDue(client, NEVER_ASKED, T));
check('colonne absente (script SQL pas lancé) : jamais montrée', !genderAskDue({ is_admin: false }, NEVER_ASKED, T));
check('déjà choisi : jamais montrée', !genderAskDue({ is_admin: false, gender: 'femme' }, NEVER_ASKED, T) && !genderAskDue({ is_admin: false, gender: 'homme' }, NEVER_ASKED, T));
check('équipe (administrateur) : jamais montrée', !genderAskDue({ is_admin: true, gender: null }, NEVER_ASKED, T));
check('pas de profil (visiteur) : jamais montrée', !genderAskDue(null, NEVER_ASKED, T) && !genderAskDue(undefined, NEVER_ASKED, T));
check('« Plus tard » il y a 1 jour : pas encore', !genderAskDue(client, { count: 1, last: T - DAY }, T));
check('« Plus tard » il y a 2 j 23 h : pas encore', !genderAskDue(client, { count: 1, last: T - 3 * DAY + 3600_000 }, T));
check('3 jours après : la carte revient', genderAskDue(client, { count: 1, last: T - ASK_GAP_MS }, T));
check('la 3e fois est la dernière : 3 demandes faites, Zara ne demande plus', ASK_MAX === 3 && !genderAskDue(client, { count: 3, last: T - 30 * DAY }, T) && genderAskDue(client, { count: 2, last: T - 4 * DAY }, T));
check('date dans le futur (horloge changée) : on attend', !genderAskDue(client, { count: 1, last: T + DAY }, T));

// ---- ce que le téléphone a gardé
check('texte correct relu', JSON.stringify(parseAskState('{"count":2,"last":1700000000000}')) === '{"count":2,"last":1700000000000}');
check('rien de gardé : jamais demandé', parseAskState(null).count === 0 && parseAskState(undefined).count === 0 && parseAskState('').count === 0);
check('texte illisible ou faux : jamais demandé', parseAskState('pas du json').count === 0 && parseAskState('{"count":"x"}').count === 0 && parseAskState('{"count":-1,"last":5}').count === 0 && parseAskState('[]').count === 0);

// ---- formulaire du profil
const profile = (extra: Partial<Profile> = {}) =>
  ({ id: 'p1', email: 'a@b.c', full_name: 'Amina Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, ...extra }) as Profile;
check('profil sans choix : le formulaire est vide', formFromProfile(profile({ gender: null })).gender === '' && formFromProfile(profile()).gender === '');
check('profil « femme » : le formulaire le reprend', formFromProfile(profile({ gender: 'femme' })).gender === 'femme');
const noChoice = checkProfileForm(formFromProfile(profile({ gender: null })));
check('sans choix : la colonne n\'est PAS envoyée à la base (aucun risque avant le script SQL)', noChoice.ok && !('gender' in noChoice.changes));
const chosen = checkProfileForm({ ...formFromProfile(profile({ gender: null })), gender: 'homme' });
check('avec un choix : « homme » est envoyé', chosen.ok && chosen.changes.gender === 'homme');
check('changer le genre active « Enregistrer »', profileFormChanged({ ...formFromProfile(profile({ gender: null })), gender: 'femme' }, profile({ gender: null })));
check('sans changement : « Enregistrer » reste éteint', !profileFormChanged(formFromProfile(profile({ gender: 'femme' })), profile({ gender: 'femme' })));

console.log(`\n${ok} contrôles réussis`);
