import type { Profile } from '../types';

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
  };
}

// Le nom est obligatoire ; le reste est facultatif (un compte cree avec Google n'a ni telephone ni adresse), mais un numero rempli doit etre valide.
export function checkProfileForm(form: ProfileForm): ProfileCheck {
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
    },
  };
}

// Vrai si le formulaire est different du profil enregistre (le bouton « Enregistrer » ne sert qu'a ce moment-la).
export function profileFormChanged(form: ProfileForm, profile: Profile): boolean {
  const saved = formFromProfile(profile);
  return (Object.keys(saved) as ProfileField[]).some((key) => clean(form[key]) !== clean(saved[key]));
}
