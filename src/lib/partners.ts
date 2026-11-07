// Partenaires locaux (docs/partenaires.md) : la liste des partenaires du patron, et l'association « cet article appartient à ce partenaire » avec un petit message privé.
// Fonctions pures, sans réseau : testées dans tests/email/partners.test.ts.
// CONFIDENTIEL : réservé aux administrateurs (règles de la base : add-partners.sql). Rien de tout cela n'est montré aux clients, ni sur le site, ni sur la facture.
import { phoneDigits, prettyPhone } from './phoneAuth';

export const PARTNER_NAME_MAX = 80;
export const PARTNER_PHONE_MAX = 40;
export const PARTNER_NOTE_MAX = 300;

export interface Partner {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at?: string | null;
}

// « cet article appartient à ce partenaire » (une ligne par article au plus)
export interface ProductPartnerLink {
  product_id: string;
  partner_id: string;
  note: string | null;
}

export type PartnerInputCheck =
  | { ok: true; value: { name: string; phone: string | null; note: string | null } }
  | { ok: false; title: string; message: string };

const clean = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();

// Ce que le patron écrit pour un partenaire : le nom est obligatoire ; le téléphone, s'il est écrit, doit être un vrai numéro ; le petit mot est facultatif.
export function checkPartnerInput(input: { name: string; phone?: string; note?: string }): PartnerInputCheck {
  const name = clean(input.name);
  if (!name) return { ok: false, title: 'Nom manquant', message: 'Merci de donner le nom du partenaire.' };
  if (name.length > PARTNER_NAME_MAX) return { ok: false, title: 'Nom trop long', message: `Le nom du partenaire a ${PARTNER_NAME_MAX} caractères au plus.` };
  const phone = clean(input.phone);
  if (phone && (phone.length > PARTNER_PHONE_MAX || !phoneDigits(phone))) {
    return { ok: false, title: 'Numéro invalide', message: 'Merci de saisir un numéro de téléphone valide (ex. 66 12 34 56), ou laissez la case vide.' };
  }
  const note = (input.note ?? '').trim();
  if (note.length > PARTNER_NOTE_MAX) return { ok: false, title: 'Message trop long', message: `Le petit message a ${PARTNER_NOTE_MAX} caractères au plus.` };
  return { ok: true, value: { name, phone: phone || null, note: note || null } };
}

// Le petit message privé d'un article : vide = pas de message ; trop long = refusé (message clair)
export function checkLinkNote(note: string): { ok: true; value: string | null } | { ok: false; message: string } {
  const value = note.trim();
  if (value.length > PARTNER_NOTE_MAX) return { ok: false, message: `Le petit message a ${PARTNER_NOTE_MAX} caractères au plus.` };
  return { ok: true, value: value || null };
}

// partenaire par identifiant, et partenaire + petit message par article
export function partnerIndex(partners: readonly Partner[]): Map<string, Partner> {
  return new Map(partners.map((p) => [p.id, p]));
}

export interface ArticlePartner {
  partner: Partner;
  note: string | null;
}

export function partnerByProduct(partners: readonly Partner[], links: readonly ProductPartnerLink[]): Map<string, ArticlePartner> {
  const byId = partnerIndex(partners);
  const out = new Map<string, ArticlePartner>();
  for (const l of links) {
    const partner = byId.get(l.partner_id);
    if (partner) out.set(l.product_id, { partner, note: clean(l.note) ? (l.note ?? '').trim() : null });
  }
  return out;
}

// Le numéro joli (« +235 66 12 34 56 ») ou ce que le patron a écrit si ce n'est pas un numéro lisible
export function partnerPhoneLabel(phone: string | null | undefined): string | null {
  const raw = clean(phone);
  if (!raw) return null;
  const digits = phoneDigits(raw);
  return digits ? prettyPhone(digits) : raw;
}

// La ligne montrée sous un article (commande, liste d'articles) : « 🤝 Partenaire : Mahamat · +235 66 12 34 56 — petit message »
export function partnerLine(ap: ArticlePartner): string {
  return ['🤝 Partenaire : ' + ap.partner.name.trim(), partnerPhoneLabel(ap.partner.phone)].filter(Boolean).join(' · ') + (ap.note ? ` — ${ap.note}` : '');
}

// Nombre d'articles d'un partenaire : « aucun article », « 1 article », « 12 articles »
export function articlesCountLabel(n: number): string {
  if (!n || n < 1) return 'aucun article';
  return `${n} article${n > 1 ? 's' : ''}`;
}

// WhatsApp du partenaire (message déjà écrit : l'article et la quantité, jamais les informations du client)
export function partnerWhatsappLink(partner: Pick<Partner, 'name' | 'phone'>, article?: { name: string; quantity: number }): string | null {
  const digits = phoneDigits(partner.phone ?? '');
  if (!digits) return null;
  const first = clean(partner.name).split(' ')[0] ?? '';
  const hello = first ? `Bonjour ${first},` : 'Bonjour,';
  const body = article
    ? `${hello} ici Albasse Shopping. Nous avons une commande pour « ${clean(article.name)} » × ${Math.max(1, Math.floor(article.quantity || 1))}. Pouvez-vous nous confirmer qu'il est disponible ? Merci 🙏`
    : `${hello} ici Albasse Shopping 😊`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function partnerCallLink(partner: Pick<Partner, 'phone'>): string | null {
  const digits = phoneDigits(partner.phone ?? '');
  return digits ? `tel:+${digits}` : null;
}

// L'erreur de la base quand les tables n'existent pas encore (script add-partners.sql pas lancé) : PostgREST dit PGRST205, Postgres dit 42P01
export function isMissingPartnersTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const text = String(error.message ?? '');
  return (error.code === 'PGRST205' || error.code === '42P01' || /could not find the table|does not exist/i.test(text)) && /partners|product_partners/.test(text);
}
