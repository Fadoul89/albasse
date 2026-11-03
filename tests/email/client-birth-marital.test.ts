// Date de naissance et Célibataire / Marié(e) : lecture de la date, âge, messages, inscription, formulaire du profil. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/client-birth-marital.test.ts
import {
  BIRTH_EXAMPLE,
  MARITALS,
  MARITAL_LABEL,
  MAX_PLAUSIBLE_AGE,
  MIN_PLAUSIBLE_AGE,
  ageOf,
  birthDateOf,
  birthDisplay,
  birthLabel,
  birthProblemMessage,
  checkBirthMarital,
  formatBirthInput,
  hasBirthColumn,
  hasMaritalColumn,
  isMarital,
  maritalLabel,
  maritalOf,
  parseBirthInput,
} from '../../src/lib/clientBirthMarital.ts';
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

// « Aujourd'hui » fixe : mardi 3 novembre 2026, 12 h UTC (13 h à N'Djamena)
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

// ---------------------------------------------------------------- situation
check('deux choix : célibataire puis marié', MARITALS.join() === 'celibataire,marie');
check('libellés : Célibataire, Marié(e)', MARITAL_LABEL.celibataire === 'Célibataire' && MARITAL_LABEL.marie === 'Marié(e)');
check('isMarital : seulement les deux valeurs exactes', isMarital('celibataire') && isMarital('marie') && !isMarital('Marié') && !isMarital('') && !isMarital(null) && !isMarital(undefined) && !isMarital(1));
check('maritalOf : la valeur ou null', maritalOf('marie') === 'marie' && maritalOf('divorce') === null && maritalOf(undefined) === null);
check('maritalLabel : libellé ou « Non précisé »', maritalLabel('celibataire') === 'Célibataire' && maritalLabel('marie') === 'Marié(e)' && maritalLabel(null) === 'Non précisé' && maritalLabel('x') === 'Non précisé');
check('colonnes : présentes seulement si le profil lu porte la clé (même vide)',
  hasBirthColumn({ birth_date: null }) && hasMaritalColumn({ marital_status: null }) && !hasBirthColumn({}) && !hasMaritalColumn({ birth_date: null }) && !hasBirthColumn(null) && !hasMaritalColumn(undefined));

// ---------------------------------------------------------------- mise en forme pendant la frappe
check('frappe : « 25031998 » devient « 25/03/1998 »', formatBirthInput('25031998') === '25/03/1998');
check('frappe : les barres arrivent au fur et à mesure (2, 3, 4, 5, 6 chiffres)',
  formatBirthInput('2') === '2' && formatBirthInput('25') === '25' && formatBirthInput('250') === '25/0' && formatBirthInput('2503') === '25/03' && formatBirthInput('25031') === '25/03/1' && formatBirthInput('250319') === '25/03/19');
check('frappe : une date collée avec des tirets ou des points est remise en forme', formatBirthInput('25-03-1998') === '25/03/1998' && formatBirthInput('25.03.1998') === '25/03/1998');
check('frappe : les lettres sont ignorées, 8 chiffres au plus', formatBirthInput('ab25cd03') === '25/03' && formatBirthInput('2503199899999') === '25/03/1998');
check('frappe : effacer la dernière barre ne bloque pas (« 25/ » → « 25 »)', formatBirthInput('25/') === '25' && formatBirthInput('') === '' && formatBirthInput(undefined as unknown as string) === '');

// ---------------------------------------------------------------- lecture de la date
const good = parseBirthInput('25/03/1998', NOW);
check('« 25/03/1998 » est lue : 1998-03-25, 28 ans', good.ok && good.iso === '1998-03-25' && good.age === 28, good);
check('tirets, points, espaces acceptés', ['25-03-1998', '25.03.1998', '25 03 1998', ' 25 / 03 / 1998 '].every((t) => { const r = parseBirthInput(t, NOW); return r.ok && r.iso === '1998-03-25'; }));
check('jour et mois sur un chiffre : « 5/3/1998 » → 1998-03-05', (() => { const r = parseBirthInput('5/3/1998', NOW); return r.ok && r.iso === '1998-03-05'; })());
check('huit chiffres collés : « 25031998 »', (() => { const r = parseBirthInput('25031998', NOW); return r.ok && r.iso === '1998-03-25'; })());
check('vide : problème « empty »', ['', '   '].every((t) => { const r = parseBirthInput(t, NOW); return !r.ok && r.problem === 'empty'; }));
check('année sur 2 chiffres refusée (« format »)', (() => { const r = parseBirthInput('25/03/98', NOW); return !r.ok && r.problem === 'format'; })());
check('du texte refusé (« format »)', ['abc', '25/mars/1998', '25/03', '1998/03/25 12'].every((t) => { const r = parseBirthInput(t, NOW); return !r.ok && r.problem === 'format'; }));
check('date qui n\'existe pas : 31/02, 30/02, 31/04, 00/01, 15/13, 29/02/1999', ['31/02/1998', '30/02/1998', '31/04/1998', '00/01/1998', '15/13/1998', '29/02/1999'].every((t) => { const r = parseBirthInput(t, NOW); return !r.ok && r.problem === 'nonexistent'; }));
check('29/02/2000 existe (bissextile), 29/02/1900 n\'existe pas', (() => { const a = parseBirthInput('29/02/2000', NOW); const b = parseBirthInput('29/02/1900', NOW); return a.ok && a.iso === '2000-02-29' && !b.ok && b.problem === 'nonexistent'; })());
check('dans le futur : demain, l\'an prochain', (() => { const a = parseBirthInput('04/11/2026', NOW); const b = parseBirthInput('01/01/2027', NOW); return !a.ok && a.problem === 'future' && !b.ok && b.problem === 'future'; })());
check('aujourd\'hui (jour de N\'Djamena) : pas dans le futur mais âge 0 → « implausible »', (() => { const r = parseBirthInput('03/11/2026', NOW); return !r.ok && r.problem === 'implausible' && r.age === 0; })());
check('fuseau : à 23 h 30 UTC le 3 novembre il est déjà le 4 à N\'Djamena → le 4 n\'est pas dans le futur', (() => {
  const late = Date.UTC(2026, 10, 3, 23, 30);
  const r = parseBirthInput('04/11/2026', late);
  return !r.ok && r.problem === 'implausible';
})());
check('trop jeune (< ' + MIN_PLAUSIBLE_AGE + ' ans) : « implausible » avec l\'âge', (() => { const r = parseBirthInput('01/01/2020', NOW); return !r.ok && r.problem === 'implausible' && r.age === 6; })());
check('10 ans pile (anniversaire passé) accepté, la veille des 10 ans refusé', (() => { const a = parseBirthInput('03/11/2016', NOW); const b = parseBirthInput('04/11/2016', NOW); return a.ok && a.age === 10 && !b.ok && b.problem === 'implausible' && b.age === 9; })());
check('trop vieux (> ' + MAX_PLAUSIBLE_AGE + ' ans) : « implausible »', (() => { const r = parseBirthInput('01/01/1900', NOW); return !r.ok && r.problem === 'implausible' && r.age === 126; })());
check('110 ans pile accepté, 111 ans refusé', (() => { const a = parseBirthInput('03/11/1916', NOW); const b = parseBirthInput('02/11/1915', NOW); return a.ok && a.age === 110 && !b.ok && b.problem === 'implausible'; })());

// ---------------------------------------------------------------- âge et libellés
check('âge : avant l\'anniversaire de l\'année = un an de moins', ageOf('1998-12-25', NOW) === 27 && ageOf('1998-11-03', NOW) === 28 && ageOf('1998-11-04', NOW) === 27);
check('âge : date dans le futur, vide ou illisible = null', ageOf('2030-01-01', NOW) === null && ageOf(null, NOW) === null && ageOf('', NOW) === null && ageOf('n\'importe quoi', NOW) === null);
check('birthDateOf : lit « 1998-03-25 » (même avec une heure derrière), refuse 1998-02-31 et le texte', birthDateOf('1998-03-25') === '1998-03-25' && birthDateOf('1998-03-25T00:00:00Z') === '1998-03-25' && birthDateOf('1998-02-31') === null && birthDateOf('25/03/1998') === null && birthDateOf(null) === null);
check('birthDisplay : 1998-03-25 → 25/03/1998, sinon vide', birthDisplay('1998-03-25') === '25/03/1998' && birthDisplay(null) === '' && birthDisplay('x') === '');
check('birthLabel : « 25/03/1998 · 28 ans » ; « Non précisée » sans date', birthLabel('1998-03-25', NOW) === '25/03/1998 · 28 ans' && birthLabel(null, NOW) === 'Non précisée' && birthLabel(undefined, NOW) === 'Non précisée');
check('birthLabel : « 1 an » au singulier', birthLabel('2025-10-01', NOW) === '01/10/2025 · 1 an');

// ---------------------------------------------------------------- messages
check('messages : chacun dit quoi faire, en français simple', (() => {
  const msg = (t: string) => { const r = parseBirthInput(t, NOW); return r.ok ? null : birthProblemMessage(r); };
  const empty = msg('');
  const format = msg('abc');
  const none = msg('31/02/1998');
  const future = msg('01/01/2027');
  const odd = msg('01/01/1900');
  return !!empty && /manquante/.test(empty.title) && /jour \/ mois \/ année/.test(empty.message)
    && !!format && format.message.includes(BIRTH_EXAMPLE)
    && !!none && /n’existe pas/.test(none.message)
    && !!future && /futur/.test(future.message)
    && !!odd && /126 ans/.test(odd.message) && /vérifier/.test(odd.message);
})());

// ---------------------------------------------------------------- inscription : les deux sont obligatoires
const full = checkBirthMarital({ birth: '25/03/1998', marital: 'marie' }, NOW);
check('inscription : date + situation → ok, date ISO et situation', full.ok && full.birthDate === '1998-03-25' && full.marital === 'marie', full);
const noBirth = checkBirthMarital({ birth: '', marital: 'marie' }, NOW);
check('inscription sans date : refusée, champ « birth »', !noBirth.ok && noBirth.field === 'birth' && /manquante/.test(noBirth.title), noBirth);
const noMarital = checkBirthMarital({ birth: '25/03/1998', marital: '' }, NOW);
check('inscription sans situation : refusée, champ « marital », cite les deux choix', !noMarital.ok && noMarital.field === 'marital' && noMarital.message.includes('Célibataire') && noMarital.message.includes('Marié(e)'), noMarital);
const badBoth = checkBirthMarital({ birth: '31/02/1998', marital: '' }, NOW);
check('date fausse ET situation vide : la date d\'abord (dans l\'ordre du formulaire)', !badBoth.ok && badBoth.field === 'birth');
check('inscription : une situation inventée est refusée', (() => { const r = checkBirthMarital({ birth: '25/03/1998', marital: 'divorce' }, NOW); return !r.ok && r.field === 'marital'; })());

// ---------------------------------------------------------------- formulaire du profil
const profile = (extra: Record<string, unknown> = {}): Profile =>
  ({ id: 'u1', email: 'a@b.c', avatar_url: null, full_name: 'Amina Ali', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: 'Tchad', address: null, ...extra }) as unknown as Profile;

const old = profile(); // la base n'a pas encore les colonnes : aucune clé
check('ancien profil (colonnes absentes) : formulaire vide pour les deux', formFromProfile(old).birthDate === '' && formFromProfile(old).marital === '');
const oldSave = checkProfileForm(formFromProfile(old), old, NOW);
check('ancien profil : enregistrer ne touche JAMAIS les deux colonnes (une colonne absente ferait échouer la demande)', oldSave.ok && !('birth_date' in oldSave.changes) && !('marital_status' in oldSave.changes), oldSave);

const blank = profile({ birth_date: null, marital_status: null }); // le script est lancé, le client n'a pas répondu
check('colonnes vides : formulaire vide, enregistrer sans les remplir reste permis (ancien client)', (() => { const r = checkProfileForm(formFromProfile(blank), blank, NOW); return r.ok && !('birth_date' in r.changes) && !('marital_status' in r.changes); })());
const filled = checkProfileForm({ ...formFromProfile(blank), birthDate: '25/03/1998', marital: 'celibataire' }, blank, NOW);
check('colonnes vides puis remplies : birth_date en ISO et marital_status envoyés', filled.ok && filled.changes.birth_date === '1998-03-25' && filled.changes.marital_status === 'celibataire', filled);
const wrongDate = checkProfileForm({ ...formFromProfile(blank), birthDate: '31/02/1998' }, blank, NOW);
check('profil : une date fausse est refusée, champ « birthDate », rien n\'est envoyé', !wrongDate.ok && wrongDate.field === 'birthDate' && /n’existe pas/.test(wrongDate.message), wrongDate);
const partial = checkProfileForm({ ...formFromProfile(blank), birthDate: '25/03' }, blank, NOW);
check('profil : une date écrite à moitié est refusée', !partial.ok && partial.field === 'birthDate');
const future = checkProfileForm({ ...formFromProfile(blank), birthDate: '01/01/2027' }, blank, NOW);
check('profil : une date future est refusée', !future.ok && future.field === 'birthDate' && /futur/.test(future.message));

const known = profile({ birth_date: '1998-03-25', marital_status: 'marie' });
check('client qui a répondu : le formulaire montre « 25/03/1998 » et « marie »', formFromProfile(known).birthDate === '25/03/1998' && formFromProfile(known).marital === 'marie');
check('rien n\'a changé : « Enregistrer » reste inactif', !profileFormChanged(formFromProfile(known), known));
check('la situation change : « Enregistrer » devient actif', profileFormChanged({ ...formFromProfile(known), marital: 'celibataire' }, known));
check('la date change : « Enregistrer » devient actif', profileFormChanged({ ...formFromProfile(known), birthDate: '26/03/1998' }, known));
const cleared = checkProfileForm({ ...formFromProfile(known), birthDate: '' }, known, NOW);
check('une date déjà enregistrée ne peut pas être effacée (obligatoire depuis l\'inscription)', !cleared.ok && cleared.field === 'birthDate' && /manquante/.test(cleared.title), cleared);
const resave = checkProfileForm(formFromProfile(known), known, NOW);
check('client qui a répondu : enregistrer renvoie ses réponses telles quelles', resave.ok && resave.changes.birth_date === '1998-03-25' && resave.changes.marital_status === 'marie', resave);
const oldForm = { fullName: 'Ahmed Hassan', phone: '66123456', whatsappNumber: '99221017', profession: 'Commerçant', region: "N'Djamena", country: 'Tchad', address: 'Quartier Chagoua' } as unknown as Parameters<typeof checkProfileForm>[0];
check('ancien formulaire sans les deux champs (tests anciens) : accepté, rien de plus envoyé', (() => { const r = checkProfileForm(oldForm); return r.ok && Object.keys(r.changes).join() === 'full_name,phone,whatsapp_number,profession,region,country,address'; })());

console.log(`\n${ok} contrôles réussis${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
