// Le numéro client (add-client-number.sql, docs/numero-client.md) : un numéro unique par compte, écrit « AS-000123 », lié au téléphone et à l'e-mail du compte.
// Ce n'est PAS un mot de passe : il ne permet pas d'entrer dans un compte, il aide seulement le client et l'équipe à retrouver le bon compte.
// Règles pures (testées : tests/email/client-number.test.ts).

export const CLIENT_NUMBER_PREFIX = 'AS-';

// 123 → « AS-000123 » ; absent, vide ou invalide (colonne pas encore dans la base) → null
export function formatClientNumber(n: unknown): string | null {
  const v = typeof n === 'string' && /^\d+$/.test(n.trim()) ? Number(n) : n;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 999_999_999) return null;
  return `${CLIENT_NUMBER_PREFIX}${String(v).padStart(6, '0')}`;
}

// Ce que le client ou l'équipe écrit → le numéro : « AS-000123 », « as 123 », « AS123 », « 000123 » ou « 123 » donnent 123 ; le reste → null
export function parseClientNumber(text: string | null | undefined): number | null {
  const m = /^\s*(?:as\s*[-–—:.]?\s*)?(\d{1,9})\s*$/i.exec(text ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

// Recherche de l'équipe (Admin › Clients) : « AS-000123 », « as 123 » ou le numéro seul (« 123 ») retrouvent le client, EXACTEMENT ce numéro.
// Un nombre seul ne ressemble jamais à tous les téléphones : « 12 » ne trouve pas le client 123.
export function clientNumberMatches(n: unknown, query: string): boolean {
  const shown = formatClientNumber(n);
  if (!shown) return false;
  const parsed = parseClientNumber(query);
  return parsed !== null && formatClientNumber(parsed) === shown;
}

// Dans la case « Mot de passe oublié » : est-ce un numéro client ? « AS-000123 » (avec AS), ou 7 chiffres au plus (« 123 »).
// Un numéro de téléphone a toujours 8 chiffres ou plus : il n'est jamais pris pour un numéro client.
export function looksLikeClientNumber(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t || t.includes('@')) return false;
  if (/^as/i.test(t)) return parseClientNumber(t) !== null;
  return /^\d{1,7}$/.test(t) && parseClientNumber(t) !== null;
}

// La ligne ajoutée aux messages (WhatsApp du client vers l'équipe, de l'équipe vers le client) ; vide si le client n'a pas de numéro
export function clientNumberLine(n: unknown): string {
  const shown = formatClientNumber(n);
  return shown ? `Votre numéro client : ${shown} (gardez-le : il aide à retrouver votre compte)` : '';
}

// Le message que le client envoie à l'équipe quand il a oublié son mot de passe : son numéro de téléphone, et son numéro client s'il le connaît (facultatif)
export function forgotMessage(phone: string, clientNumberText: string): string {
  const parsed = parseClientNumber(clientNumberText);
  const num = parsed !== null ? formatClientNumber(parsed) : null;
  return `Bonjour Albasse Shopping, j'ai oublié le mot de passe de mon compte (numéro ${phone})${num ? `. Mon numéro client : ${num}` : ''}. Pouvez-vous m'aider ?`;
}

// « Mot de passe oublié » avec le numéro client seul (le client ne se souvient plus de son téléphone)
export function forgotNumberMessage(clientNumberText: string): string {
  const num = formatClientNumber(parseClientNumber(clientNumberText));
  return `Bonjour Albasse Shopping, j'ai oublié le mot de passe de mon compte. Mon numéro client : ${num ?? clientNumberText.trim()}. Pouvez-vous m'aider ?`;
}

// « Mot de passe oublié » avec un e-mail : le lien n'est pas arrivé (compte créé avec le numéro de téléphone, ou e-mail mal écrit)
export function forgotEmailMessage(email: string): string {
  return `Bonjour Albasse Shopping, j'ai oublié le mot de passe de mon compte (e-mail ${email.trim()}). Je n'ai pas reçu d'e-mail. Pouvez-vous m'aider ?`;
}

// Le message que le client s'envoie à lui-même sur WhatsApp pour garder son numéro
export function keepMessage(o: { number: unknown; phone?: string | null; email?: string | null }): string | null {
  const shown = formatClientNumber(o.number);
  if (!shown) return null;
  return [
    `Mon numéro client Albasse Shopping : ${shown}`,
    o.phone ? `Téléphone du compte : ${o.phone}` : null,
    o.email ? `E-mail du compte : ${o.email}` : null,
    'Si je perds l’accès à mon compte, je donne ce numéro à l’équipe sur WhatsApp.',
  ]
    .filter(Boolean)
    .join('\n');
}
