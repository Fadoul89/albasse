// Retrouver son compte quand on a perdu le code : règles pures (testées : tests/email/password-recovery.test.ts).
//  - le client connecté change lui-même son mot de passe dans « Compte » ;
//  - l'équipe donne un nouveau code de 6 chiffres depuis Admin › Clients et l'envoie sur WhatsApp.
import { isPhoneLoginEmail, phoneDigits, prettyPhone } from './phoneAuth';

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 72; // limite du chiffrement bcrypt utilisé par la base
const SITE_URL = 'https://www.albasseshopping.com';

// Le message (en français) du premier problème, ou null si le nouveau mot de passe est bon.
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Le mot de passe est trop long (${MAX_PASSWORD_LENGTH} caractères au plus).`;
  if (password !== confirm) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}

// Ce que Supabase répond quand le changement est refusé → une phrase simple pour le client.
export function changePasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('different from the old') || m.includes('same_password') || m.includes('same password')) {
    return 'Ce mot de passe est déjà le vôtre. Choisissez-en un autre.';
  }
  if (m.includes('reauthenticat') || m.includes('recently') || m.includes('session') || m.includes('jwt')) {
    return 'Pour votre sécurité, déconnectez-vous puis reconnectez-vous avant de changer votre mot de passe.';
  }
  if (m.includes('weak') || m.includes('at least') || m.includes('too short')) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return message;
}

// Ce que l'équipe tape de travers → une phrase claire pour l'administrateur (réponse de la base au bouton « Nouveau code »).
export function adminResetError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('could not find the function') || (m.includes('admin_set_client_password') && m.includes('schema cache'))) {
    return 'Le script add-admin-reset-password.sql n’est pas encore lancé dans Supabase.';
  }
  if (m.includes('compte administrateur')) return 'Le code d’un compte administrateur ne se change pas ici.';
  if (m.includes('non autorise')) return 'Seul un administrateur peut donner un nouveau code.';
  if (m.includes('introuvable')) return 'Ce client est introuvable.';
  return message;
}

export interface LoginHow {
  kind: 'phone' | 'email';
  value: string; // « +235 66 12 34 56 » ou l'adresse e-mail
}

// L'identifiant de connexion du compte (adresse tirée du numéro, ou vrai e-mail d'un ancien compte) → ce que le client doit taper.
export function loginHow(loginEmail: string): LoginHow {
  const email = loginEmail.trim();
  if (isPhoneLoginEmail(email)) {
    const digits = phoneDigits(email.split('@')[0]);
    return { kind: 'phone', value: digits ? prettyPhone(digits) : email.split('@')[0] };
  }
  return { kind: 'email', value: email };
}

// Message WhatsApp prêt à envoyer avec le nouveau code (l'administrateur peut le modifier avant).
export function recoveryMessage(o: { firstName: string; loginEmail: string; code: string }): string {
  const how = loginHow(o.loginEmail);
  const hello = o.firstName.trim() ? `Bonjour ${o.firstName.trim()},` : 'Bonjour,';
  const who = how.kind === 'phone' ? `votre numéro ${how.value}` : `votre e-mail ${how.value}`;
  return [
    `${hello} ici l'équipe Albasse Shopping 😊`,
    `Voici votre nouveau code : ${o.code}`,
    `Connectez-vous avec ${who} et ce code : ${SITE_URL}`,
    'Vous pourrez le changer dans « Compte » › « Changer mon mot de passe ».',
  ].join('\n');
}

// Le numéro à qui écrire (WhatsApp du client, sinon son téléphone) ; null si aucun numéro valable.
export function recoveryPhone(p: { whatsapp_number?: string | null; phone?: string | null }): string | null {
  return phoneDigits(p.whatsapp_number ?? '') ?? phoneDigits(p.phone ?? '');
}
