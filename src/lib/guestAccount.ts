// Commande sans compte : le visiteur donne prénom, nom, téléphone et e-mail à la commande ; son compte est créé tout seul à la confirmation.
// Fonctions pures (testées : tests/email/guest-account.test.ts). Le compte utilise le numéro comme identifiant (voir phoneAuth.ts).
//
// Mot de passe : un code de 6 chiffres DIFFÉRENT pour chaque client (jamais un mot de passe commun comme « 1234 » : avec un mot de passe connu de
// tous, quiconque connaît le numéro d'un client pourrait ouvrir son compte et voir ses commandes, son adresse et ses points). Le code est montré
// une fois sur la page de confirmation ; le client peut le changer dans « Compte », et s'il l'oublie l'équipe l'aide sur WhatsApp (comme avant).
import { isValidEmail } from './phoneAuth';

// numéro du Tchad sans indicatif : 8 chiffres, commence par 6 ou 9 (même règle que la page de commande)
export const CHAD_PHONE_REGEX = /^[69]\d{7}$/;

export interface GuestInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// « Amina » + « Hassan » → « Amina Hassan »
export const guestFullName = (g: Pick<GuestInfo, 'firstName' | 'lastName'>) => clean(`${g.firstName} ${g.lastName}`);

// Le message (en français) du premier champ à corriger, ou null si tout est bon.
export function guestInfoProblem(g: GuestInfo): string | null {
  if (clean(g.firstName).length < 2) return 'Merci d’écrire votre prénom.';
  if (clean(g.lastName).length < 2) return 'Merci d’écrire votre nom.';
  if (!CHAD_PHONE_REGEX.test(g.phone.trim())) return 'Le numéro doit contenir 8 chiffres et commencer par 6 ou 9 (ex. 66123456).';
  if (!isValidEmail(g.email)) return 'Merci d’écrire une adresse e-mail valide (ex. nom@gmail.com).';
  return null;
}

// Codes trop faciles à deviner : un seul chiffre répété, suites (123456, 654321…), motifs répétés (121212, 123123).
export function isWeakCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return true;
  if (/^(\d)\1{5}$/.test(code)) return true;
  const d = code.split('').map(Number);
  const up = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const down = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  if (up || down) return true;
  if (code.slice(0, 2) === code.slice(2, 4) && code.slice(2, 4) === code.slice(4, 6)) return true;
  if (code.slice(0, 3) === code.slice(3, 6)) return true;
  return false;
}

// Tirage aléatoire sûr quand le navigateur le permet (sinon Math.random : le code reste différent pour chaque client).
function randomBelow(max: number): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max; // évite un léger biais
    const buf = new Uint32Array(1);
    do {
      c.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateTempPassword(below: (max: number) => number = randomBelow): string {
  for (let i = 0; i < 50; i++) {
    const code = String(below(1_000_000)).padStart(6, '0');
    if (!isWeakCode(code)) return code;
  }
  return '482915'; // ne devrait jamais arriver (50 tirages faibles de suite)
}

// « 66123456 » → « 66 12 34 56 »
export const prettyChadPhone = (phone: string) => phone.replace(/(\d{2})(?=\d)/g, '$1 ').trim();

export interface NewAccountNotice {
  phone: string;
  password: string;
}
