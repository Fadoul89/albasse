// « Dernier e-mail Zara » (Admin › Clients) : pour chaque client, la date du dernier e-mail PUBLICITAIRE que Zara lui a vraiment envoyé
// (l'e-mail « absents depuis 7 jours » ou une campagne de Zara Marketing), lue dans la file d'envoi (email_outbox, statut « sent »).
// Demande du patron (6 novembre) : « pourquoi Zara n'envoie pas d'e-mail aux personnes absentes ? » → on le voit maintenant sur la fiche.
// Fonctions pures, sans réseau : testées dans tests/email/last-email.test.ts. Rien n'est inventé : sans ligne « envoyé », on dit « aucun e-mail ».
// Les e-mails de commande et de bienvenue ne comptent pas (ce n'est pas Zara qui fait de la publicité).

export const ZARA_EMAIL_KINDS = ['promo_inactive', 'marketing'] as const;
export type ZaraEmailKind = (typeof ZARA_EMAIL_KINDS)[number];

// une ligne de email_outbox, telle que la base la renvoie
export interface SentEmailRow {
  user_id?: string | null;
  kind?: string | null;
  status?: string | null;
  sent_at?: string | null;
  click_count?: number | string | null;
  bounce_type?: string | null;
  complaint_at?: string | null;
}

export interface LastEmail {
  sentAt: string;
  kind: ZaraEmailKind;
  clicks: number;
  hardBounce: boolean;
  complaint: boolean;
}

const isZaraKind = (k: unknown): k is ZaraEmailKind => (ZARA_EMAIL_KINDS as readonly string[]).includes(k as string);
const time = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : NaN;
};

// Le dernier e-mail Zara envoyé à chaque client (clé : identifiant du compte). Seules comptent les lignes publicitaires, au statut « sent », avec une vraie date d'envoi.
export function lastZaraEmails(rows: readonly SentEmailRow[]): Map<string, LastEmail> {
  const out = new Map<string, LastEmail>();
  for (const r of rows) {
    if (!r || typeof r.user_id !== 'string' || !r.user_id || r.status !== 'sent' || !isZaraKind(r.kind) || !r.sent_at) continue;
    const t = time(r.sent_at);
    if (Number.isNaN(t)) continue;
    const before = out.get(r.user_id);
    if (before && time(before.sentAt) >= t) continue;
    const clicks = Number(r.click_count);
    out.set(r.user_id, {
      sentAt: r.sent_at,
      kind: r.kind,
      clicks: Number.isFinite(clicks) && clicks > 0 ? Math.floor(clicks) : 0,
      hardBounce: r.bounce_type === 'hard' || r.bounce_type === 'invalid',
      complaint: !!r.complaint_at,
    });
  }
  return out;
}

export const EMAIL_KIND_LABEL: Record<ZaraEmailKind, string> = {
  promo_inactive: 'e-mail « absents »',
  marketing: 'campagne Zara Marketing',
};

export interface LastEmailInput {
  // l'adresse e-mail VISIBLE du client (null pour un compte créé avec le téléphone seulement : son adresse cachée ne reçoit rien)
  email: string | null;
  notifyPromotions: boolean | null | undefined;
  banned: boolean;
  daysAway: number;
  // undefined : lecture pas encore faite ou impossible (rien n'est affiché) ; null : aucun e-mail envoyé
  last: LastEmail | null | undefined;
}

export interface LastEmailLine {
  text: string;
  tone: 'sent' | 'none' | 'problem';
}

const DAY_MS = 86_400_000;

// « il y a 3 j » / « aujourd'hui » : les jours entiers depuis l'envoi
export function agoLabel(sentAt: string, now: number): string {
  const t = time(sentAt);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((now - t) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  return `il y a ${days} j`;
}

// La ligne montrée sur la fiche du client (null = rien à montrer). `formatDay` : la date écrite comme le reste de l'écran (formatDate).
export function lastEmailLine(input: LastEmailInput, formatDay: (iso: string) => string, now: number = Date.now()): LastEmailLine | null {
  const { last } = input;
  if (last === undefined) return null;
  if (last) {
    const parts = [`✉️ Dernier e-mail Zara : ${formatDay(last.sentAt)}`, agoLabel(last.sentAt, now), EMAIL_KIND_LABEL[last.kind]].filter(Boolean);
    if (last.clicks > 0) parts.push(`${last.clicks} clic${last.clicks > 1 ? 's' : ''}`);
    if (last.hardBounce) parts.push('adresse refusée par la messagerie');
    if (last.complaint) parts.push('plainte signalée');
    if (input.notifyPromotions === false) parts.push('promotions refusées depuis');
    return { text: parts.join(' · '), tone: last.hardBounce || last.complaint || input.notifyPromotions === false ? 'problem' : 'sent' };
  }
  if (!input.email) return { text: "✉️ Pas d'adresse e-mail : Zara ne peut pas lui écrire (WhatsApp seulement)", tone: 'none' };
  if (input.banned) return { text: '✉️ Aucun e-mail Zara : compte bloqué', tone: 'none' };
  if (input.notifyPromotions === false) return { text: "✉️ Aucun e-mail Zara : n'a pas accepté les promotions", tone: 'none' };
  if (input.daysAway < 7) return { text: '✉️ Aucun e-mail Zara : connecté il y a moins de 7 jours', tone: 'none' };
  return { text: '✉️ Aucun e-mail Zara envoyé pour l’instant', tone: 'none' };
}
