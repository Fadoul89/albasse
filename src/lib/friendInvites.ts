// Parrainage « Invite 5 amis, gagne un parfum » (demande du patron, 5 novembre 2026 ; docs/parrainage.md).
// Un client qui a un compte reçoit un lien. Un ami COMPTE seulement s'il crée son compte avec ce lien ET ouvre l'application installée (icône sur l'écran
// d'accueil) en étant connecté. À chaque tranche de 5 amis, le client gagne 1 parfum gratuit ; le patron valide les amis avant de le remettre.
// Des fonctions pures, sans réseau : testées dans tests/email/friend-invites.test.ts. Les appels à la base sont dans lib/friendInvitesApi.ts.
import { SITE_URL } from './relanceMessage';

export const INVITE_GOAL = 5; // amis qui comptent pour gagner 1 parfum
export const INVITE_PARAM = 'invite'; // adresse du lien : https://www.albasseshopping.com/?invite=ABCD2345
export const INVITE_STORAGE_DAYS = 30; // le code reçu par le lien est gardé 30 jours (l'ami peut s'inscrire plus tard)

// Les mêmes lettres et chiffres que la base (jamais I, L, O, 0, 1 : faciles à lire et à dicter)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${ALPHABET}]{8}$`);

// « abcd 2345 » → « ABCD2345 » ; null si ce n'est pas un code valable
export function normalizeInviteCode(raw: unknown): string | null {
  const code = String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}

export const inviteLink = (code: string, origin: string = SITE_URL): string => `${origin.replace(/\/$/, '')}/?${INVITE_PARAM}=${code}`;

// Le code écrit dans l'adresse (« ?invite=ABCD2345 » ou « ?x=1&invite=abcd2345 ») ; null si absent ou invalide
export function inviteCodeFromSearch(search: string | null | undefined): string | null {
  const q = String(search ?? '').replace(/^\?/, '');
  for (const part of q.split('&')) {
    const [key, ...rest] = part.split('=');
    if (key === INVITE_PARAM) {
      try {
        return normalizeInviteCode(decodeURIComponent(rest.join('=')));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Le code gardé sur le téléphone : { code, expiresAt } ; null s'il est trop vieux ou illisible
export function storedInviteCode(raw: string | null | undefined, now: number): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; expiresAt?: unknown };
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < now) return null;
    return normalizeInviteCode(parsed.code);
  } catch {
    return null;
  }
}

export const storeInviteValue = (code: string, now: number): string => JSON.stringify({ code, expiresAt: now + INVITE_STORAGE_DAYS * 24 * 3600 * 1000 });

// Le message que le client envoie à ses amis (WhatsApp). On ne promet rien à l'ami : le gain est pour celui qui invite.
export function inviteShareText(code: string, origin: string = SITE_URL): string {
  return [
    'Salut 👋 Je t’invite sur Albasse Shopping, la boutique en ligne du Tchad.',
    `Crée ton compte avec mon lien, puis installe l’application sur ton téléphone : ${inviteLink(code, origin)}`,
  ].join('\n');
}

export const whatsappShareUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

// ---------------------------------------------------------------------------------------------
// Ce que la base renvoie (invite_my_progress, admin_invite_overview) : lu avec prudence
// ---------------------------------------------------------------------------------------------

export type RewardStatus = 'a_valider' | 'valide' | 'remis' | 'refuse';
const STATUSES: RewardStatus[] = ['a_valider', 'valide', 'remis', 'refuse'];
const isStatus = (v: unknown): v is RewardStatus => STATUSES.includes(v as RewardStatus);

export interface InviteFriend {
  name: string;
  installed: boolean;
}
export interface InviteReward {
  number: number;
  status: RewardStatus;
}
export interface InviteProgress {
  code: string | null;
  goal: number;
  joined: number;
  installed: number;
  friends: InviteFriend[];
  rewards: InviteReward[];
}

const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []);

export function parseProgress(raw: unknown): InviteProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    code: normalizeInviteCode(r.code),
    goal: int(r.goal) || INVITE_GOAL,
    joined: int(r.joined),
    installed: int(r.installed),
    friends: arr(r.friends).map((f) => ({ name: String(f.name ?? 'Un ami').trim() || 'Un ami', installed: f.installed === true })),
    rewards: arr(r.rewards)
      .filter((x) => isStatus(x.status))
      .map((x) => ({ number: int(x.number), status: x.status as RewardStatus })),
  };
}

export interface ProgressView {
  installed: number;
  joined: number;
  inTranche: number; // les amis de la tranche en cours : 0 à 4 (le 5e fait gagner un parfum et remet la barre à zéro)
  toNext: number; // amis qui manquent pour le prochain parfum
  earned: number; // parfums gagnés (installed / 5)
  waitingInstall: number; // amis inscrits qui n'ont pas encore ouvert l'application
  headline: string;
  barLabel: string;
}

export function progressView(p: Pick<InviteProgress, 'goal' | 'joined' | 'installed'>): ProgressView {
  const goal = p.goal > 0 ? p.goal : INVITE_GOAL;
  const earned = Math.floor(p.installed / goal);
  const inTranche = p.installed - earned * goal;
  const toNext = goal - inTranche;
  const waitingInstall = Math.max(0, p.joined - p.installed);
  const headline =
    p.installed === 0
      ? `Invite ${goal} amis : ils créent leur compte avec ton lien et installent l’application, tu gagnes un parfum gratuit.`
      : `Encore ${toNext} ami${toNext > 1 ? 's' : ''} pour gagner ${earned > 0 ? 'un autre parfum' : 'un parfum gratuit'}.`;
  return { installed: p.installed, joined: p.joined, inTranche, toNext, earned, waitingInstall, headline, barLabel: `${inTranche} / ${goal} amis` };
}

// Ce que le client lit sur chaque gain (jamais de promesse que le patron n'a pas faite : le gain reste « à valider » tant qu'il n'a pas vérifié)
export function rewardStatusLabel(status: RewardStatus): string {
  switch (status) {
    case 'a_valider':
      return 'Parfum gagné ✓ L’équipe vérifie vos amis, puis vous contacte sur WhatsApp.';
    case 'valide':
      return 'Parfum validé ✓ L’équipe vous contacte sur WhatsApp pour le choisir.';
    case 'remis':
      return 'Parfum remis ✓';
    default:
      return 'Non validé par l’équipe.';
  }
}

export const statusIcon = (status: RewardStatus): string => (status === 'remis' ? '🎁' : status === 'refuse' ? '⛔' : status === 'valide' ? '✅' : '⏳');

// « Amina », « Amina, Fatimé et Moussa », « 5 amis » : pour le texte « Invité par … » et les résumés
export const inviterGreeting = (firstName: string | null | undefined): string => {
  const n = String(firstName ?? '').trim();
  return n ? `Invité(e) par ${n}` : '';
};

// ---------------------------------------------------------------------------------------------
// Pour l'administrateur
// ---------------------------------------------------------------------------------------------

export interface AdminFriend {
  name: string;
  phone: string | null;
  installed: boolean;
  banned: boolean;
}
export interface AdminReward {
  id: string;
  number: number;
  status: RewardStatus;
  note: string | null;
  createdAt: string;
  handledAt: string | null;
  user: { id: string; name: string; phone: string | null; whatsapp: string | null };
  friends: AdminFriend[];
}
export interface AdminInviter {
  id: string;
  name: string;
  phone: string | null;
  joined: number;
  installed: number;
}
export interface AdminOverview {
  goal: number;
  totals: { inviters: number; joined: number; installed: number; toValidate: number; validated: number; delivered: number; refused: number };
  rewards: AdminReward[];
  inviters: AdminInviter[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseOverview(raw: unknown): AdminOverview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const t = (r.totals ?? {}) as Record<string, unknown>;
  return {
    goal: int(r.goal) || INVITE_GOAL,
    totals: { inviters: int(t.inviters), joined: int(t.joined), installed: int(t.installed), toValidate: int(t.to_validate), validated: int(t.validated), delivered: int(t.delivered), refused: int(t.refused) },
    rewards: arr(r.rewards)
      .filter((x) => isStatus(x.status))
      .map((x) => {
        const u = (x.user ?? {}) as Record<string, unknown>;
        return {
          id: String(x.id ?? ''),
          number: int(x.number),
          status: x.status as RewardStatus,
          note: str(x.note),
          createdAt: String(x.created_at ?? ''),
          handledAt: str(x.handled_at),
          user: { id: String(u.id ?? ''), name: str(u.name) ?? 'Client', phone: str(u.phone), whatsapp: str(u.whatsapp) },
          friends: arr(x.friends).map((f) => ({ name: str(f.name) ?? 'Ami', phone: str(f.phone), installed: f.installed === true, banned: f.banned === true })),
        };
      }),
    inviters: arr(r.inviters).map((x) => ({ id: String(x.id ?? ''), name: str(x.name) ?? 'Client', phone: str(x.phone), joined: int(x.joined), installed: int(x.installed) })),
  };
}

// Les amis qui comptent vraiment (installés, non bannis) : ce que le patron vérifie avant de remettre le parfum
export const countingFriends = (friends: AdminFriend[]): number => friends.filter((f) => f.installed && !f.banned).length;

// Le message prêt à envoyer au gagnant (le patron peut le modifier avant)
export function winnerMessage(firstName: string): string {
  const hello = firstName.trim() ? `Bonjour ${firstName.trim()},` : 'Bonjour,';
  return [
    `${hello} ici l’équipe Albasse Shopping 😊`,
    `Bravo ! Vos amis ont créé leur compte avec votre lien et installé l’application : vous avez gagné un parfum gratuit 🎁`,
    'Dites-nous quel parfum vous plairait et nous organisons la remise.',
  ].join('\n');
}

export const REWARD_ACTIONS: { status: RewardStatus; label: string }[] = [
  { status: 'valide', label: 'Valider' },
  { status: 'remis', label: 'Parfum remis' },
  { status: 'refuse', label: 'Refuser' },
  { status: 'a_valider', label: 'Remettre à valider' },
];

export const adminStatusLabel = (status: RewardStatus): string =>
  status === 'a_valider' ? 'À valider' : status === 'valide' ? 'Validé' : status === 'remis' ? 'Remis' : 'Refusé';
