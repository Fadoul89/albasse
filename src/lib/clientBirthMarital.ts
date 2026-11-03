// Date de naissance et situation (Célibataire / Marié(e)) du client : obligatoires à l'inscription, modifiables dans le profil, visibles pour
// l'administrateur (Admin › Clients). Gardées dans profiles.birth_date et profiles.marital_status (add-client-birth-marital.sql).
// Rien n'est deviné : seul ce que le client a écrit lui-même est gardé. Tant que personne n'a répondu : « Non précisée » / « Non précisé ».
// Des fonctions pures, sans réseau : testées dans tests/email/client-birth-marital.test.ts.

export type MaritalStatus = 'celibataire' | 'marie';

export const MARITALS: MaritalStatus[] = ['celibataire', 'marie'];
export const MARITAL_LABEL: Record<MaritalStatus, string> = { celibataire: 'Célibataire', marie: 'Marié(e)' };
export const MARITAL_ICON: Record<MaritalStatus, string> = { celibataire: '🙋', marie: '💍' };

export const isMarital = (value: unknown): value is MaritalStatus => value === 'celibataire' || value === 'marie';
export const maritalOf = (value: unknown): MaritalStatus | null => (isMarital(value) ? value : null);
export const maritalLabel = (value: unknown): string => (isMarital(value) ? MARITAL_LABEL[value] : 'Non précisé');

// Les colonnes existent dans la base seulement quand le script SQL a été lancé : le profil lu porte alors les clés « birth_date » et « marital_status »
// (vides ou non). Avant, rien ne s'affiche et rien n'est écrit (une écriture dans une colonne absente ferait échouer l'enregistrement du profil).
export const hasBirthColumn = (profile: object | null | undefined): boolean => !!profile && 'birth_date' in profile;
export const hasMaritalColumn = (profile: object | null | undefined): boolean => !!profile && 'marital_status' in profile;

// ---------------------------------------------------------------------------------------------
// Date de naissance
// ---------------------------------------------------------------------------------------------

// Un âge qui donne à penser à une faute de frappe (année mal écrite) : le site demande de vérifier, il ne décide pas qui a le droit de s'inscrire.
export const MIN_PLAUSIBLE_AGE = 10;
export const MAX_PLAUSIBLE_AGE = 110;

const ZONE_OFFSET_MS = 3_600_000; // N'Djamena = UTC+1 : « aujourd'hui » est le jour de là-bas

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

// Vrai calendrier : 31/02/1998 n'existe pas, 29/02/2000 existe, 29/02/1900 n'existe pas.
function realDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCFullYear(year); // les années 0–99 : Date.UTC les ramène à 1900+
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// Ce que le client écrit s'arrange tout seul pendant la frappe : « 25031998 » devient « 25/03/1998 » (les barres s'ajoutent, seuls les chiffres restent).
export function formatBirthInput(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// « 1998-03-25 » (ce que garde la base) lu comme une vraie date, ou null (vide, illisible, date qui n'existe pas)
export function birthDateOf(value: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!m) return null;
  return realDate(Number(m[1]), Number(m[2]), Number(m[3])) ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// « 1998-03-25 » → « 25/03/1998 » (ce que le client écrit et lit) ; '' quand il n'y a pas de date
export function birthDisplay(value: unknown): string {
  const iso = birthDateOf(value);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

// L'âge en années entières à la date `now` (jour de N'Djamena) ; null sans date valide ou pour une date dans le futur
export function ageOf(value: unknown, now: number): number | null {
  const iso = birthDateOf(value);
  if (!iso) return null;
  const today = new Date(now + ZONE_OFFSET_MS);
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age--;
  return age >= 0 ? age : null;
}

// « 25/03/1998 · 27 ans » (ou « Non précisée »)
export function birthLabel(value: unknown, now: number): string {
  const shown = birthDisplay(value);
  if (!shown) return 'Non précisée';
  const age = ageOf(value, now);
  return age === null ? shown : `${shown} · ${age} ${age > 1 ? 'ans' : 'an'}`;
}

export type BirthProblem = 'empty' | 'format' | 'nonexistent' | 'future' | 'implausible';
export type BirthParse = { ok: true; iso: string; age: number } | { ok: false; problem: BirthProblem; age?: number };

// Lit « 25/03/1998 » (barres, tirets, points ou espaces acceptés ; jour et mois sur 1 ou 2 chiffres ; année sur 4 chiffres)
export function parseBirthInput(text: string, now: number): BirthParse {
  const t = String(text ?? '').trim();
  if (!t) return { ok: false, problem: 'empty' };
  const m = /^(\d{1,2})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{4})$/.exec(t) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (!m) return { ok: false, problem: 'format' };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!realDate(year, month, day)) return { ok: false, problem: 'nonexistent' };
  const iso = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  const today = new Date(now + ZONE_OFFSET_MS);
  const todayIso = `${pad(today.getUTCFullYear(), 4)}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
  if (iso > todayIso) return { ok: false, problem: 'future' };
  const age = ageOf(iso, now) ?? 0;
  if (age < MIN_PLAUSIBLE_AGE || age > MAX_PLAUSIBLE_AGE) return { ok: false, problem: 'implausible', age };
  return { ok: true, iso, age };
}

export const BIRTH_EXAMPLE = '25/03/1998';

export function birthProblemMessage(parse: Extract<BirthParse, { ok: false }>): { title: string; message: string } {
  switch (parse.problem) {
    case 'empty':
      return { title: 'Date de naissance manquante', message: 'Merci d’écrire votre date de naissance (jour / mois / année).' };
    case 'format':
      return { title: 'Date de naissance invalide', message: `Écrivez-la ainsi : ${BIRTH_EXAMPLE} (jour / mois / année).` };
    case 'nonexistent':
      return { title: 'Date de naissance invalide', message: `Cette date n’existe pas. Écrivez-la ainsi : ${BIRTH_EXAMPLE}.` };
    case 'future':
      return { title: 'Date de naissance invalide', message: 'La date de naissance ne peut pas être dans le futur.' };
    default:
      return {
        title: 'Date de naissance à vérifier',
        message: `Cette date donne un âge de ${parse.age ?? '?'} ans. Merci de vérifier le jour, le mois et l’année.`,
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Les deux réponses ensemble (inscription)
// ---------------------------------------------------------------------------------------------

export type BirthMaritalCheck =
  | { ok: true; birthDate: string; marital: MaritalStatus }
  | { ok: false; field: 'birth' | 'marital'; title: string; message: string };

// Inscription : la date de naissance ET la situation sont obligatoires
export function checkBirthMarital(input: { birth: string; marital: unknown }, now: number): BirthMaritalCheck {
  const parse = parseBirthInput(input.birth, now);
  if (!parse.ok) return { ok: false, field: 'birth', ...birthProblemMessage(parse) };
  const marital = maritalOf(input.marital);
  if (!marital) {
    return { ok: false, field: 'marital', title: 'Choix manquant', message: `Merci de choisir « ${MARITAL_LABEL.celibataire} » ou « ${MARITAL_LABEL.marie} ».` };
  }
  return { ok: true, birthDate: parse.iso, marital };
}
