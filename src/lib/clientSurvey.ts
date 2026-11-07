// Le petit sondage du site (docs/sondage-client.md) : à la création du compte on ne demande plus que le nom, le téléphone et le mot de passe. Les autres informations
// (Homme / Femme, date de naissance, célibataire / marié, numéro WhatsApp, accord pour les nouveautés et offres) sont demandées ENSUITE, à l'intérieur du site,
// dans une petite carte sur l'accueil : une question à la fois, chaque réponse enregistrée tout de suite, « Plus tard » toujours possible.
// Rien n'est jamais deviné ni coché à la place du client. Des fonctions pures, sans réseau : testées dans tests/email/client-survey.test.ts.
import { genderOf, hasGenderColumn } from './clientGender';
import { birthDateOf, hasBirthColumn, hasMaritalColumn, maritalOf, parseBirthInput, birthProblemMessage } from './clientBirthMarital';
import { phoneDigits } from './phoneAuth';

export type SurveyKey = 'gender' | 'birth' | 'marital' | 'whatsapp' | 'notifications';

// L'ordre des questions : d'abord les trois qui servent à mieux conseiller, puis les deux « réglages »
export const SURVEY_ORDER: readonly SurveyKey[] = ['gender', 'birth', 'marital', 'whatsapp', 'notifications'];

export interface SurveyProfile {
  is_admin?: boolean | null;
  gender?: unknown;
  birth_date?: unknown;
  marital_status?: unknown;
  phone?: string | null;
  whatsapp_number?: string | null;
  notify_new_products?: boolean | null;
  notify_promotions?: boolean | null;
  notify_flash_sale?: boolean | null;
}

// Ce que le téléphone a gardé des réponses qui ne laissent aucune trace dans le profil (« c'est le même numéro », « non merci »)
export interface SurveyLocal {
  whatsappDone: boolean;
  notificationsDone: boolean;
}
export const NO_LOCAL: SurveyLocal = { whatsappDone: false, notificationsDone: false };

// Texte gardé sur le téléphone : tout ce qui n'est pas clair compte comme « rien répondu »
export function parseSurveyLocal(raw: string | null | undefined): SurveyLocal {
  try {
    const v = JSON.parse(String(raw ?? ''));
    return { whatsappDone: v?.whatsappDone === true, notificationsDone: v?.notificationsDone === true };
  } catch {
    return NO_LOCAL;
  }
}

const last8 = (value: unknown): string => String(value ?? '').replace(/\D/g, '').slice(-8);

// Le WhatsApp est « déjà connu comme différent » seulement quand le client en a donné un autre que son téléphone : sinon on lui demande une fois si c'est le même.
// Sans téléphone dans le compte (rare), la question n'a pas de sens : on ne la pose pas.
export function whatsappQuestionDue(profile: SurveyProfile): boolean {
  const phone = last8(profile.phone);
  if (!phone) return false;
  const wa = last8(profile.whatsapp_number);
  return wa === '' || wa === phone;
}

// L'accord pour les nouveautés et offres : demandé seulement quand les trois réglages sont « non » (un compte créé sans cocher quoi que ce soit). Un client qui a
// déjà dit « oui » (même pour un seul réglage) n'est jamais redemandé, et un « non merci » est gardé sur son téléphone.
export const notificationsQuestionDue = (profile: SurveyProfile): boolean =>
  profile.notify_new_products === false && profile.notify_promotions === false && profile.notify_flash_sale === false;

// Les questions qui restent, dans l'ordre. Une colonne absente de la base (script SQL pas lancé) ne se demande pas ; l'équipe n'est jamais interrogée.
export function surveyPending(profile: SurveyProfile | null | undefined, local: SurveyLocal = NO_LOCAL): SurveyKey[] {
  if (!profile || profile.is_admin) return [];
  const out: SurveyKey[] = [];
  if (hasGenderColumn(profile) && !genderOf(profile.gender)) out.push('gender');
  if (hasBirthColumn(profile) && !birthDateOf(profile.birth_date)) out.push('birth');
  if (hasMaritalColumn(profile) && !maritalOf(profile.marital_status)) out.push('marital');
  if (!local.whatsappDone && whatsappQuestionDue(profile)) out.push('whatsapp');
  if (!local.notificationsDone && notificationsQuestionDue(profile)) out.push('notifications');
  return out;
}

// « Question 2 sur 4 » : `total` = ce qui restait à l'ouverture de la carte, `remaining` = ce qui reste maintenant (la question affichée en fait partie)
export function surveyProgress(total: number, remaining: number): { index: number; total: number } {
  const t = Math.max(total, remaining, 1);
  return { index: Math.min(Math.max(t - remaining + 1, 1), t), total: t };
}

// ---------------------------------------------------------------------------------------------
// Quand la carte est montrée (comme l'ancienne carte « Vous êtes ? » de Zara)
// ---------------------------------------------------------------------------------------------

export const ASK_GAP_MS = 3 * 86_400_000; // « Plus tard » : la carte revient 3 jours après…
export const ASK_MAX = 3; // … trois fois au plus, puis le sondage ne demande plus (tout reste modifiable dans Mon compte)

export interface AskState {
  count: number; // nombre de fois où la carte a été montrée
  last: number; // la dernière fois (millisecondes)
}
export const NEVER_ASKED: AskState = { count: 0, last: 0 };

// Ce que le téléphone a gardé (texte JSON) : tout ce qui n'est pas clair compte comme « jamais demandé »
export function parseAskState(raw: string | null | undefined): AskState {
  try {
    const v = JSON.parse(String(raw ?? ''));
    const count = Math.floor(Number(v?.count));
    const last = Number(v?.last);
    if (Number.isFinite(count) && count >= 0 && Number.isFinite(last) && last >= 0) return { count, last };
  } catch {
    // texte illisible
  }
  return NEVER_ASKED;
}

// La carte est montrée seulement : à un client connecté (pas à l'équipe), quand il lui reste au moins une question, qu'elle n'a pas déjà été montrée ASK_MAX fois
// et qu'elle n'a pas été montrée depuis moins de 3 jours. Un compte neuf la voit tout de suite (jamais demandé).
export function surveyAskDue(profile: SurveyProfile | null | undefined, local: SurveyLocal, state: AskState, now: number): boolean {
  if (surveyPending(profile, local).length === 0) return false;
  if (state.count >= ASK_MAX) return false;
  return state.count === 0 || now - state.last >= ASK_GAP_MS;
}

// ---------------------------------------------------------------------------------------------
// Les réponses qui s'écrivent (vérifiées avant d'être envoyées à la base)
// ---------------------------------------------------------------------------------------------

export type SurveyCheck<T> = { ok: true; value: T } | { ok: false; title: string; message: string };

// « 25/03/1998 » → « 1998-03-25 » (la date doit exister, ne pas être dans le futur, et donner un âge plausible)
export function checkSurveyBirth(text: string, now: number): SurveyCheck<string> {
  const parse = parseBirthInput(text, now);
  if (!parse.ok) return { ok: false, ...birthProblemMessage(parse) };
  return { ok: true, value: parse.iso };
}

// Un autre numéro WhatsApp : 8 à 15 chiffres, écrit comme le profil le garde (espaces nettoyés)
export function checkSurveyWhatsapp(text: string): SurveyCheck<string> {
  const value = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!value || !phoneDigits(value)) {
    return { ok: false, title: 'Numéro WhatsApp invalide', message: 'Merci de saisir un numéro WhatsApp valide (8 à 15 chiffres).' };
  }
  return { ok: true, value };
}

// « Oui, avec plaisir » : les trois réglages de Mon compte → Notifications passent à « oui » (et seulement ceux-là)
export const NOTIFICATIONS_ON = { notify_new_products: true, notify_promotions: true, notify_flash_sale: true } as const;
