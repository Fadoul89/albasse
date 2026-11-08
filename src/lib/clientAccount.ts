// Gestion de compte côté équipe (Admin › Clients › « Gérer le compte »), règles pures (testées : tests/email/client-account.test.ts) : docs/gestion-de-compte.md
//   • comment le client se connecte (numéro, e-mail ou compte fermé) et ce que l'équipe peut faire selon cela ;
//   • les champs de la fiche et ce qui a changé ;
//   • les phrases simples quand la base ou la fonction serveur refuse.
import { isValidEmail, phoneDigits, prettyPhone } from './phoneAuth';
import { formatClientNumber } from './clientNumber';

export type LoginKind = 'phone' | 'email' | 'closed';
export interface AccountInfo {
  loginKind: LoginKind;
  loginEmail: string;
  orders: number;
  isAdmin: boolean;
}

// La réponse de admin_client_account_info → ce que l'écran utilise ; null si la réponse n'a pas la bonne forme
export function parseInfo(data: unknown): AccountInfo | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const kind = d.login_kind;
  if (kind !== 'phone' && kind !== 'email' && kind !== 'closed') return null;
  if (typeof d.login_email !== 'string') return null;
  const orders = Number(d.orders);
  return { loginKind: kind, loginEmail: d.login_email, orders: Number.isFinite(orders) && orders >= 0 ? Math.floor(orders) : 0, isAdmin: d.is_admin === true };
}

// Une fiche de compte fermé (adresse closed-000123@closed.albasseshopping.com)
export const isClosedEmail = (email: string | null | undefined): boolean => /^closed-[a-z0-9-]+@closed\.albasseshopping\.com$/i.test((email ?? '').trim());

// « Connexion : par numéro de téléphone (+235 66 12 34 56) »
export function loginLabel(info: AccountInfo): string {
  if (info.loginKind === 'closed') return 'Compte fermé : plus aucune connexion possible';
  if (info.loginKind === 'phone') {
    const digits = phoneDigits(info.loginEmail.split('@')[0] ?? '');
    return `Par numéro de téléphone (${digits ? prettyPhone(digits) : info.loginEmail.split('@')[0]})`;
  }
  return `Par e-mail (${info.loginEmail})`;
}

// ---------- modifier la fiche
export interface EditForm {
  full_name: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  region: string;
  country: string;
  address: string;
  profession: string;
}
export type EditKey = keyof EditForm;
export const EDIT_LABELS: Record<EditKey, string> = {
  full_name: 'Nom et prénom',
  phone: 'Téléphone',
  whatsapp_number: 'WhatsApp',
  email: 'E-mail de contact',
  region: 'Ville',
  country: 'Pays',
  address: 'Adresse',
  profession: 'Profession',
};

// Les champs que l'on peut modifier : le téléphone d'un compte « numéro » est SA connexion (voir « Changer le numéro de connexion »), l'e-mail d'un ancien compte aussi
export function editableFields(kind: LoginKind): EditKey[] {
  if (kind === 'closed') return [];
  const base: EditKey[] = ['full_name', 'whatsapp_number', 'region', 'country', 'address', 'profession'];
  return kind === 'phone' ? ['full_name', 'whatsapp_number', 'email', 'region', 'country', 'address', 'profession'] : ['full_name', 'phone', ...base.slice(1)];
}

export interface ProfileLike {
  full_name?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  region?: string | null;
  country?: string | null;
  address?: string | null;
  profession?: string | null;
}
// Le formulaire au départ (l'e-mail technique tiré du numéro n'est jamais montré)
export function initialForm(p: ProfileLike): EditForm {
  const mail = p.email && !/@tel\.albasseshopping\.com$/i.test(p.email) ? p.email : '';
  return {
    full_name: p.full_name ?? '',
    phone: p.phone ?? '',
    whatsapp_number: p.whatsapp_number ?? '',
    email: mail,
    region: p.region ?? '',
    country: p.country ?? '',
    address: p.address ?? '',
    profession: p.profession ?? '',
  };
}
const MAX: Partial<Record<EditKey, number>> = { full_name: 80, region: 80, country: 80, address: 200, profession: 80, email: 120 };
// Ce qui a changé + le premier problème (null si tout va bien). Seuls les champs modifiables ET changés sont envoyés.
export function buildChanges(original: EditForm, form: EditForm, kind: LoginKind): { changes: Partial<EditForm>; problem: string | null } {
  const changes: Partial<EditForm> = {};
  for (const key of editableFields(kind)) {
    const next = form[key].trim();
    if (next === original[key].trim()) continue;
    if (key === 'full_name' && (next.length < 2 || next.length > 80)) return { changes: {}, problem: 'Le nom doit avoir entre 2 et 80 caractères.' };
    if (key === 'email' && next && (!isValidEmail(next) || next.length > 120)) return { changes: {}, problem: 'Cette adresse e-mail n’est pas valable.' };
    if ((key === 'phone' || key === 'whatsapp_number') && next && !phoneDigits(next)) return { changes: {}, problem: `${EDIT_LABELS[key]} : ce numéro n’est pas valable (exemple : 66 12 34 56).` };
    const max = MAX[key];
    if (max && next.length > max) return { changes: {}, problem: `${EDIT_LABELS[key]} : ${max} caractères au plus.` };
    changes[key] = next;
  }
  return { changes, problem: Object.keys(changes).length === 0 ? 'Rien n’a changé.' : null };
}

// ---------- actions de la fonction serveur
export type AccountAction = 'change_login' | 'close' | 'delete';
export const ACTION_LABEL: Record<string, string> = {
  edit: '✏️ Fiche modifiée',
  change_login: '📱 Connexion changée',
  close: '🔒 Compte fermé',
  delete: '🗑️ Compte supprimé',
};

// Supprimer pour de bon : seulement sans commande (sinon les commandes seraient effacées avec le compte)
export function canDelete(info: AccountInfo): { ok: boolean; why: string | null } {
  if (info.isAdmin) return { ok: false, why: 'Un compte administrateur ne se gère pas ici.' };
  if (info.orders > 0) return { ok: false, why: `Ce client a ${info.orders} commande${info.orders > 1 ? 's' : ''} : pour les garder dans votre comptabilité, fermez le compte au lieu de le supprimer.` };
  return { ok: true, why: null };
}
// Le mot à taper pour confirmer la suppression : le numéro client (AS-000123), sinon les 8 premiers caractères de l'identifiant
export const deleteConfirmWord = (clientNumber: unknown, userId: string): string => formatClientNumber(clientNumber) ?? userId.slice(0, 8);

const REASONS: Record<string, string> = {
  bad_phone: 'Ce numéro n’est pas valable (exemple : 66 12 34 56).',
  bad_email: 'Cette adresse e-mail n’est pas valable.',
  same_login: 'C’est déjà sa connexion actuelle.',
  login_taken: 'Cette connexion est déjà utilisée par un autre compte.',
  closed: 'Ce compte est fermé.',
  already_closed: 'Ce compte est déjà fermé.',
  is_admin: 'Un compte administrateur ne se gère pas ici.',
  not_found: 'Ce client est introuvable.',
  bad_confirm: 'La confirmation ne correspond pas : rien n’a été fait.',
  has_orders: 'Ce client a des commandes : fermez le compte au lieu de le supprimer.',
  auth_error: 'La connexion du client n’a pas pu être modifiée : rien n’a été changé.',
  forbidden: 'Seul un administrateur peut faire cela.',
  unauthenticated: 'Reconnectez-vous pour continuer.',
  bad_request: 'La demande n’est pas valable.',
  server_error: 'Panne du serveur : réessayez dans un moment.',
  not_installed: 'La fonction « admin-client-account » n’est pas encore installée.',
};
export const reasonMessage = (reason: string): string => REASONS[reason] ?? 'Impossible pour le moment : réessayez dans un moment.';

// Ce que la base répond (phrases françaises de add-client-account-admin.sql) → une phrase claire pour l'équipe
export function rpcErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('could not find the function') || (m.includes('schema cache') && m.includes('admin_'))) return 'Le script add-client-account-admin.sql n’est pas encore lancé dans Supabase.';
  if (m.includes('non autorise')) return 'Seul un administrateur peut faire cela.';
  if (m.includes('introuvable')) return 'Ce client est introuvable.';
  return message;
}
// Le journal : « fiche modifiée : nom, ville » → ce que l'équipe lit
export const logLine = (action: string, detail: string): string => `${ACTION_LABEL[action] ?? action}${detail ? ` · ${detail}` : ''}`;
