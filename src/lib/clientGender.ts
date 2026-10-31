// Homme / Femme : le genre du client, gardé dans profiles.gender (add-client-gender.sql) pour suivre l'analyse des clients (Admin › Clients).
// Rien n'est deviné d'après le prénom : seul le choix du client (inscription, profil, carte de Zara) ou celui de l'administrateur est gardé.
// Tant que personne n'a choisi : « Non précisé ». Des fonctions pures, sans réseau : testées dans tests/email/client-gender.test.ts.

export type Gender = 'homme' | 'femme';
export type GenderKey = Gender | 'unknown';

export const GENDERS: Gender[] = ['homme', 'femme'];
export const GENDER_LABEL: Record<Gender, string> = { homme: 'Homme', femme: 'Femme' };
export const GENDER_ICON: Record<Gender, string> = { homme: '👨', femme: '👩' };

export const isGender = (value: unknown): value is Gender => value === 'homme' || value === 'femme';
export const genderOf = (value: unknown): Gender | null => (isGender(value) ? value : null);
export const genderLabel = (value: unknown): string => (isGender(value) ? GENDER_LABEL[value] : 'Non précisé');

// La colonne existe dans la base seulement quand le script SQL a été lancé : le profil lu porte alors la clé « gender » (vide ou non).
// Avant, rien ne s'affiche et rien n'est écrit (une écriture dans une colonne absente ferait échouer l'enregistrement du profil).
export const hasGenderColumn = (profile: object | null | undefined): boolean => !!profile && 'gender' in profile;

// ---------------------------------------------------------------------------------------------
// Statistiques par genre (Admin › Clients)
// ---------------------------------------------------------------------------------------------

export interface GenderCustomer {
  profile: { gender?: unknown };
  orderCount: number; // commandes (hors fausses commandes)
  completedOrders: number; // commandes qui comptent comme vente
  totalSpent: number; // montant des ventes
  productViewCount?: number;
}
export interface GenderBucket {
  clients: number;
  withOrders: number; // clients qui ont commandé
  orders: number;
  sales: number; // commandes qui comptent comme vente
  revenue: number; // montant des ventes
  views: number; // articles regardés
}
export interface GenderSummary {
  buckets: Record<GenderKey, GenderBucket>;
  total: number;
  known: number; // clients dont le genre est connu
}

const emptyBucket = (): GenderBucket => ({ clients: 0, withOrders: 0, orders: 0, sales: 0, revenue: 0, views: 0 });

export function genderSummary(customers: GenderCustomer[]): GenderSummary {
  const buckets: Record<GenderKey, GenderBucket> = { homme: emptyBucket(), femme: emptyBucket(), unknown: emptyBucket() };
  for (const c of customers) {
    const b = buckets[genderOf(c.profile?.gender) ?? 'unknown'];
    b.clients++;
    if (c.orderCount > 0) b.withOrders++;
    b.orders += c.orderCount;
    b.sales += c.completedOrders;
    b.revenue += c.totalSpent;
    b.views += c.productViewCount ?? 0;
  }
  return { buckets, total: customers.length, known: buckets.homme.clients + buckets.femme.clients };
}

// « 48 % » (une part sur un total) ; « — » quand il n'y a rien à diviser
export const percent = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)} %` : '—');

// « 12 500 FCFA » en moyenne par client (« — » sans client)
export const averagePerClient = (revenue: number, clients: number): number => (clients > 0 ? Math.round(revenue / clients) : 0);

// ---------------------------------------------------------------------------------------------
// Zara demande une fois aux clients déjà inscrits (carte sur l'accueil)
// ---------------------------------------------------------------------------------------------

export const ASK_GAP_MS = 3 * 86_400_000; // « Plus tard » : la carte revient 3 jours après…
export const ASK_MAX = 3; // … trois fois au plus, puis Zara ne demande plus

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

// La carte est montrée seulement : à un client connecté (pas à l'équipe), dont la base a la colonne et qui n'a pas encore choisi, qui n'a pas dépassé
// ASK_MAX demandes et qui n'a pas reçu la carte depuis moins de 3 jours.
export function genderAskDue(profile: { is_admin?: boolean; gender?: unknown } | null | undefined, state: AskState, now: number): boolean {
  if (!profile || profile.is_admin) return false;
  if (!hasGenderColumn(profile)) return false;
  if (genderOf(profile.gender)) return false;
  if (state.count >= ASK_MAX) return false;
  return state.count === 0 || now - state.last >= ASK_GAP_MS;
}
