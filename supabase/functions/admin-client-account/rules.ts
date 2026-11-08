// Fonction « admin-client-account » : règles pures (testées : tests/account/admin-client-account.test.ts). Aucun accès réseau ni base ici.
// Ce que la fonction sait faire pour un administrateur connecté, sur le compte d'un CLIENT (jamais d'un administrateur) :
//   change_login : changer la connexion (le numéro de téléphone d'un compte « numéro », l'e-mail d'un ancien compte) ;
//   close        : fermer le compte (nom et coordonnées effacés, connexion coupée, COMMANDES GARDÉES) ;
//   delete       : supprimer pour de bon, seulement un compte SANS aucune commande (sinon les commandes seraient effacées avec lui).
export const PHONE_LOGIN_DOMAIN = "tel.albasseshopping.com";
export const CLOSED_DOMAIN = "closed.albasseshopping.com";

export type Action = "change_login" | "close" | "delete";
export type LoginKind = "phone" | "email" | "closed";

export interface Request {
  action: Action;
  userId: string;
  value: string; // change_login : le nouveau numéro ou le nouvel e-mail
  reason: string; // close : motif facultatif
  confirm: string; // close et delete : la confirmation tapée par l'administrateur
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// « 66 12 34 56 », « +235 66 12 34 56 » ou « 00235 66123456 » → « 23566123456 » ; null si ce n'est pas un numéro (comme src/lib/phoneAuth.ts)
export function phoneDigits(input: string): string | null {
  const raw = input.trim();
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+") && digits.startsWith("00")) digits = digits.slice(2);
  if (/^\d{8}$/.test(digits)) digits = `235${digits}`;
  return /^\d{9,15}$/.test(digits) ? digits : null;
}
export const phoneLoginEmail = (digits: string) => `${digits}@${PHONE_LOGIN_DOMAIN}`;
export function prettyPhone(digits: string): string {
  const m = /^235(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(digits);
  return m ? `+235 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${digits}`;
}
export const loginKindOf = (email: string | null | undefined): LoginKind => {
  const e = (email ?? "").trim().toLowerCase();
  if (/^closed-[a-z0-9-]+@closed\.albasseshopping\.com$/.test(e)) return "closed";
  return e.endsWith(`@${PHONE_LOGIN_DOMAIN}`) ? "phone" : "email";
};
// AS-000123 ; sans numéro client (script pas lancé) : les 8 premiers caractères de l'identifiant
export const formatClientNumber = (n: unknown): string | null =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 999_999_999 ? `AS-${String(n).padStart(6, "0")}` : null;
export const confirmWord = (clientNumber: unknown, userId: string): string => formatClientNumber(clientNumber) ?? userId.slice(0, 8);

// L'adresse de connexion d'un compte fermé : elle libère le numéro (le client pourra se réinscrire) et ne peut recevoir aucun e-mail réel
export function closedEmail(clientNumber: unknown, userId: string): string {
  const n = typeof clientNumber === "number" && Number.isInteger(clientNumber) && clientNumber >= 1 ? String(clientNumber).padStart(6, "0") : userId.slice(0, 8);
  return `closed-${n}@${CLOSED_DOMAIN}`;
}

export function parseRequest(body: unknown): { ok: true; req: Request } | { ok: false; reason: "bad_request" } {
  if (!body || typeof body !== "object") return { ok: false, reason: "bad_request" };
  const b = body as Record<string, unknown>;
  const action = b.action;
  if (action !== "change_login" && action !== "close" && action !== "delete") return { ok: false, reason: "bad_request" };
  if (typeof b.userId !== "string" || !UUID_RE.test(b.userId)) return { ok: false, reason: "bad_request" };
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return { ok: true, req: { action, userId: b.userId, value: str(b.value, 120), reason: str(b.reason, 200), confirm: str(b.confirm, 40) } };
}

// Un mot de passe au hasard (jamais montré à personne) pour un compte fermé : 32 caractères
export function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "x").slice(0, 32);
}

// Le message de refus d'une adresse déjà prise (Supabase répond de plusieurs façons)
export const isLoginTaken = (message: string): boolean => /already|registered|exists|duplicate|taken|unique/i.test(message);

// Le nouveau numéro ou le nouvel e-mail : null si valable, sinon la raison
export function checkNewLogin(kind: LoginKind, value: string, currentLogin: string): { ok: true; login: string; digits?: string } | { ok: false; reason: string } {
  if (kind === "closed") return { ok: false, reason: "closed" };
  if (kind === "phone") {
    const digits = phoneDigits(value);
    if (!digits) return { ok: false, reason: "bad_phone" };
    const login = phoneLoginEmail(digits);
    if (login.toLowerCase() === currentLogin.trim().toLowerCase()) return { ok: false, reason: "same_login" };
    return { ok: true, login, digits };
  }
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120 || email.endsWith(`@${PHONE_LOGIN_DOMAIN}`) || email.endsWith(`@${CLOSED_DOMAIN}`)) return { ok: false, reason: "bad_email" };
  if (email === currentLogin.trim().toLowerCase()) return { ok: false, reason: "same_login" };
  return { ok: true, login: email };
}
