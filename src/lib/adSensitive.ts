// Articles « Vitalité & Énergie » (catégorie « Vitalité & Énergie Homme » : café, bonbons énergie…) : les annonces de Zara ne les montrent PAS,
// sauf aux clients MARIÉS et âgés de 32 ans ou plus (demande du patron, 4 novembre 2026). Zara ne devine rien : il faut que le client ait lui-même
// écrit sa date de naissance et choisi « Marié(e) » dans son compte (Compte › Modifier mon profil). Sans ces deux réponses (visiteur, ancien compte,
// colonnes pas encore lancées) : pas d'article « Vitalité & Énergie » dans une annonce. Ces articles restent en vente normalement dans leur catégorie.
// Des fonctions pures, sans réseau : testées dans tests/email/ad-targeting.test.ts.

import { normalize } from './assistantBrain';
import { ageOf, maritalOf } from './clientBirthMarital';
import { rootOf } from './subCategories';

export const VITALITY_MIN_AGE = 32;

// La catégorie « Vitalité & Énergie » : le nom (ou l'adresse) contient « vitalité » ET « énergie » (accents et majuscules sans importance)
export function isVitalityCategory(category: { name?: string | null; slug?: string | null } | null | undefined): boolean {
  if (!category) return false;
  const text = normalize(`${category.name ?? ''} ${category.slug ?? ''}`).replace(/-/g, ' ');
  return /vitalit/.test(text) && /energ/.test(text);
}

// Ce client peut-il voir ces articles dans une annonce ? Marié(e) ET 32 ans ou plus (âge calculé avec le jour de N'Djamena)
export function vitalityAllowed(customer: { birth_date?: unknown; marital_status?: unknown } | null | undefined, now: number = Date.now()): boolean {
  if (!customer) return false;
  if (maritalOf(customer.marital_status) !== 'marie') return false;
  const age = ageOf(customer.birth_date, now);
  return age !== null && age >= VITALITY_MIN_AGE;
}

// Les articles qu'une annonce a le droit de montrer à ce client : les articles « Vitalité & Énergie » partent, sauf pour un client marié de 32 ans et plus.
export function adAllowedProducts<T extends { category_id: string | null }>(
  products: readonly T[],
  categories: readonly { id: string; name?: string | null; slug?: string | null; parent_id?: string | null }[],
  customer: { birth_date?: unknown; marital_status?: unknown } | null | undefined,
  now: number = Date.now()
): T[] {
  if (vitalityAllowed(customer, now)) return [...products];
  // une sous-catégorie de « Vitalité & Énergie » est « Vitalité & Énergie » aussi
  const typed = categories as readonly { id: string; slug: string; name: string; parent_id?: string | null }[];
  const hidden = new Set(typed.filter((c) => isVitalityCategory(c) || isVitalityCategory(rootOf(typed, c.id))).map((c) => c.id));
  if (hidden.size === 0) return [...products];
  return products.filter((p) => !p.category_id || !hidden.has(p.category_id));
}
