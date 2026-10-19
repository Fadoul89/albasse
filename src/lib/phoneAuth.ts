// Comptes créés avec le numéro de téléphone (l'e-mail est facultatif). Supabase demande un e-mail : le compte reçoit une adresse
// tirée du numéro (23566123456@tel.albasseshopping.com), jamais affichée ni utilisée pour écrire au client. Le vrai e-mail, s'il est
// donné, va dans le profil. Les anciens comptes se connectent toujours avec leur e-mail.
export const PHONE_LOGIN_DOMAIN = 'tel.albasseshopping.com';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());

// Chiffres du numéro avec l'indicatif : « 66 12 34 56 », « +235 66 12 34 56 » et « 00235 66123456 » donnent tous « 23566123456 »
// (8 chiffres = numéro du Tchad sans indicatif). null si ce n'est pas un numéro.
export function phoneDigits(input: string): string | null {
  const raw = input.trim();
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);
  if (/^\d{8}$/.test(digits)) digits = `235${digits}`;
  return /^\d{9,15}$/.test(digits) ? digits : null;
}

export function phoneLoginEmail(phone: string): string | null {
  const digits = phoneDigits(phone);
  return digits ? `${digits}@${PHONE_LOGIN_DOMAIN}` : null;
}

export const isPhoneLoginEmail = (email: string | null | undefined) =>
  !!email && email.trim().toLowerCase().endsWith(`@${PHONE_LOGIN_DOMAIN}`);

// L'e-mail à montrer (null pour l'adresse tirée du numéro).
export const visibleEmail = (email: string | null | undefined) => (email && !isPhoneLoginEmail(email) ? email : null);

// « +235 66 12 34 56 » pour un numéro du Tchad, sinon « +chiffres ».
export function prettyPhone(digits: string): string {
  const m = /^235(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(digits);
  return m ? `+235 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${digits}`;
}

// Dans un texte (notification « Nouveau client ») : l'adresse tirée du numéro devient « 📱 +235 66 12 34 56 ».
export const withPrettyPhoneLogins = (text: string) =>
  text.replace(/\b(\d{9,15})@tel\.albasseshopping\.com\b/gi, (_, digits: string) => `📱 ${prettyPhone(digits)}`);

// Ce que le client tape pour se connecter : un e-mail (ancien compte) ou son numéro. null si ce n'est ni l'un ni l'autre.
export function loginEmailFor(identifier: string): string | null {
  const value = identifier.trim();
  if (value.includes('@')) return isValidEmail(value) ? value.toLowerCase() : null;
  return phoneLoginEmail(value);
}
