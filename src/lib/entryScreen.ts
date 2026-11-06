// Écran d'entrée « Créez votre compte » (docs/ecran-entree.md) : la bande « Voici ce qui vous attend » (4 vrais articles, avec leur vrai prix), les avantages, et
// l'inscription en 2 étapes. Des fonctions pures, sans réseau : testées dans tests/email/entry-screen.test.ts.
//
// Rien n'est inventé : les articles et les prix viennent de la boutique, les avantages sont ceux que le site offre vraiment.

import { adAllowedProducts } from './adSensitive';
import { WHEEL_ENABLED } from './featureFlags';
import { genderOf } from './clientGender';
import { hasBirthColumn, hasMaritalColumn, maritalOf } from './clientBirthMarital';
import { rootIdOf } from './subCategories';

export const ENTRY_PREVIEW_COUNT = 4;

// Les avantages montrés à l'entrée (tous vrais) : paiement à la livraison à N'Djamena seulement, parrainage ; la roue de la chance seulement quand elle est active (lib/featureFlags)
export const ENTRY_BENEFITS: readonly string[] = [
  '💵 Paiement à la livraison à N’Djamena',
  '🎁 Invite 5 amis, gagne un parfum',
  ...(WHEEL_ENABLED ? ['🎡 Roue de la chance'] : []),
];

export interface EntryProduct {
  id: string;
  name: string;
  price: number | string;
  images?: string[] | null;
  stock?: number | null;
  is_active?: boolean | null;
  category_id: string | null;
  likes_count?: number | null;
  created_at?: string | null;
}

export interface EntryCategory {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
}

export const entryPrice = (value: number | string): string => `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} FCFA`;

const firstImage = (p: EntryProduct): string | null => {
  const url = Array.isArray(p.images) ? p.images.find((i) => typeof i === 'string' && i.trim() !== '') : null;
  return url ?? null;
};

// Les articles montrés à un visiteur qui n'a pas encore de compte : en vente (actif, en stock, avec photo et prix), les plus aimés d'abord,
// de catégories DIFFÉRENTES si possible, et jamais un article « Vitalité & Énergie » (réservé aux annonces des clients mariés de 32 ans et plus).
export function pickEntryProducts(products: readonly EntryProduct[], categories: readonly EntryCategory[], count: number = ENTRY_PREVIEW_COUNT): EntryProduct[] {
  const sellable = products.filter((p) => p.is_active !== false && (p.stock ?? 0) > 0 && firstImage(p) !== null && Number(p.price) > 0 && p.name.trim() !== '');
  const allowed = adAllowedProducts(sellable, categories, null);
  const ranked = [...allowed].sort((a, b) => {
    const likes = (b.likes_count ?? 0) - (a.likes_count ?? 0);
    if (likes !== 0) return likes;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
  const picked: EntryProduct[] = [];
  const seen = new Set<string>();
  for (const p of ranked) {
    if (picked.length >= count) break;
    const root = rootIdOf(categories, p.category_id) ?? p.category_id ?? p.id;
    if (seen.has(root)) continue;
    seen.add(root);
    picked.push(p);
  }
  for (const p of ranked) {
    if (picked.length >= count) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}

// ---------------------------------------------------------------------------------------------
// Étape 1 : nom, téléphone, mot de passe, conditions
// ---------------------------------------------------------------------------------------------

export type StepOneCheck = { ok: true } | { ok: false; title: string; message: string };

export function checkStepOne(input: { name: string; phone: string; password: string; terms: boolean }, phoneOk: boolean): StepOneCheck {
  if (!input.name.trim() || !input.phone.trim() || !input.password) {
    return { ok: false, title: 'Champs manquants', message: 'Nom, numéro de téléphone et mot de passe sont obligatoires.' };
  }
  if (!phoneOk) return { ok: false, title: 'Téléphone invalide', message: 'Merci de saisir un numéro de téléphone valide (ex. 66 12 34 56).' };
  if (input.password.length < 6) return { ok: false, title: 'Mot de passe trop court', message: 'Minimum 6 caractères.' };
  if (!input.terms) return { ok: false, title: 'Conditions non acceptées', message: "Merci d'accepter les conditions d'inscription pour continuer." };
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Étape 2 : les 3 questions (sexe, date de naissance, situation), obligatoires, juste après la création du compte
// ---------------------------------------------------------------------------------------------

// Le profil attend-il encore une de ces réponses ? Une colonne absente de la base (script SQL pas lancé) ne se demande pas.
export function stepTwoMissing(profile: object | null | undefined): boolean {
  if (!profile) return false;
  const p = profile as { gender?: unknown; birth_date?: unknown; marital_status?: unknown };
  if ('gender' in profile && !genderOf(p.gender)) return true;
  if (hasBirthColumn(profile) && !p.birth_date) return true;
  if (hasMaritalColumn(profile) && !maritalOf(p.marital_status)) return true;
  return false;
}

// Profil pas encore chargé = on attend (l'étape 2 s'affiche déjà, avec un petit chargement) ; sinon : manque-t-il une réponse ?
export const answersMissingFor = (profile: object | null | undefined): boolean => (profile ? stepTwoMissing(profile) : true);

// L'étape 2 s'affiche seulement si ce téléphone vient de créer son compte avec le formulaire court (« en attente »), qu'on est connecté et qu'il manque une réponse.
export const stepTwoDue = (input: { pending: boolean; isAuthenticated: boolean; answersMissing: boolean }): boolean =>
  input.pending && input.isAuthenticated && input.answersMissing;

// L'attente expire au bout de 3 jours (téléphone éteint en pleine inscription) : un ancien compte n'est jamais bloqué par un vieux reste.
export const STEP_TWO_MAX_AGE_MS = 3 * 24 * 3_600_000;
export const stepTwoStillValid = (armedAt: number | null | undefined, now: number): boolean =>
  typeof armedAt === 'number' && Number.isFinite(armedAt) && armedAt <= now + 3_600_000 && now - armedAt < STEP_TWO_MAX_AGE_MS;
