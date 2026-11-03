import type { Profile } from '../types';
import { genderOf, type Gender } from './clientGender';
import { birthDisplay, birthProblemMessage, maritalOf, parseBirthInput, type MaritalStatus } from './clientBirthMarital';

// Memes regles que l'inscription : 8 a 15 chiffres, avec « + », espaces ou tirets possibles.
export const PROFILE_PHONE_REGEX = /^[+]?[\d\s-]{8,15}$/;

export interface ProfileForm {
  fullName: string;
  phone: string;
  whatsappNumber: string;
  profession: string;
  region: string;
  country: string;
  address: string;
  gender: '' | Gender; // '' : pas encore choisi
  birthDate: string; // « 25/03/1998 » ; '' : pas encore écrite (ou la base n'a pas encore la colonne)
  marital: '' | MaritalStatus; // '' : pas encore choisi
}

// Les colonnes de la table `profiles` que le client peut changer lui-meme (les memes que celles de l'inscription).
export interface ProfileChanges {
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  profession: string | null;
  region: string | null;
  country: string | null;
  address: string | null;
  gender?: Gender; // seulement quand le client a choisi (et que la base a la colonne) : sinon la colonne n'est jamais écrite
  birth_date?: string; // « 1998-03-25 » : même règle (jamais écrite tant que le formulaire est vide)
  marital_status?: MaritalStatus; // idem
}

export type ProfileField = keyof ProfileForm;

export type ProfileCheck =
  | { ok: true; changes: ProfileChanges }
  | { ok: false; field: ProfileField; title: string; message: string };

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const orNull = (value: string) => (clean(value) === '' ? null : clean(value));

export function formFromProfile(profile: Profile): ProfileForm {
  return {
    fullName: profile.full_name ?? '',
    phone: profile.phone ?? '',
    whatsappNumber: profile.whatsapp_number ?? '',
    profession: profile.profession ?? '',
    region: profile.region ?? '',
    country: profile.country ?? '',
    address: profile.address ?? '',
    gender: genderOf(profile.gender) ?? '',
    birthDate: birthDisplay(profile.birth_date),
    marital: maritalOf(profile.marital_status) ?? '',
  };
}

// Le nom est obligatoire ; le reste est facultatif (un compte cree avec Google n'a ni telephone ni adresse), mais un numero rempli doit etre valide.
// La date de naissance : facultative pour un ancien compte qui n'en a pas encore, mais une date écrite doit être juste, et une date déjà enregistrée
// ne peut pas être effacée (elle est obligatoire à l'inscription). `now` : l'heure, pour ne pas accepter une date dans le futur.
export function checkProfileForm(form: ProfileForm, saved?: Profile | null, now: number = Date.now()): ProfileCheck {
  const fullName = clean(form.fullName);
  if (fullName.length < 2) {
    return { ok: false, field: 'fullName', title: 'Nom manquant', message: 'Merci d’écrire votre nom et prénom.' };
  }
  const phone = clean(form.phone);
  if (phone && !PROFILE_PHONE_REGEX.test(phone)) {
    return { ok: false, field: 'phone', title: 'Téléphone invalide', message: 'Merci de saisir un numéro de téléphone valide (8 à 15 chiffres).' };
  }
  const whatsapp = clean(form.whatsappNumber);
  if (whatsapp && !PROFILE_PHONE_REGEX.test(whatsapp)) {
    return { ok: false, field: 'whatsappNumber', title: 'Numéro WhatsApp invalide', message: 'Merci de saisir un numéro WhatsApp valide (8 à 15 chiffres).' };
  }
  let birthIso: string | null = null;
  if (clean(form.birthDate ?? '') || (saved && birthDisplay(saved.birth_date))) {
    const parse = parseBirthInput(form.birthDate ?? '', now);
    if (!parse.ok) {
      const { title, message } = birthProblemMessage(parse);
      return { ok: false, field: 'birthDate', title, message };
    }
    birthIso = parse.iso;
  }
  return {
    ok: true,
    changes: {
      full_name: fullName,
      phone: orNull(form.phone),
      whatsapp_number: orNull(form.whatsappNumber),
      profession: orNull(form.profession),
      region: orNull(form.region),
      country: orNull(form.country),
      address: orNull(form.address),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(birthIso ? { birth_date: birthIso } : {}),
      ...(form.marital ? { marital_status: form.marital } : {}),
    },
  };
}

// Vrai si le formulaire est different du profil enregistre (le bouton « Enregistrer » ne sert qu'a ce moment-la).
export function profileFormChanged(form: ProfileForm, profile: Profile): boolean {
  const saved = formFromProfile(profile);
  return (Object.keys(saved) as ProfileField[]).some((key) => clean(form[key] ?? '') !== clean(saved[key]));
}
