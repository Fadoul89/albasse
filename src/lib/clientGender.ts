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
