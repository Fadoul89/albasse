// Écran d'entrée « Créez votre compte » (docs/ecran-entree.md) : la bande « Voici ce qui vous attend » (4 vrais articles à la fois, qui changent toute seule, avec leur vrai prix), les avantages, et
// l'inscription courte (nom, téléphone, mot de passe). Des fonctions pures, sans réseau : testées dans tests/email/entry-screen.test.ts.
//
// Rien n'est inventé : les articles et les prix viennent de la boutique, les avantages sont ceux que le site offre vraiment.

import { adAllowedProducts } from './adSensitive';
import { WHEEL_ENABLED } from './featureFlags';
import { rootIdOf } from './subCategories';

export const ENTRY_PREVIEW_COUNT = 4;
// Demandes du patron (6 novembre 2026) : « montre les articles moins chers : de 10 000 à 15 000 FCFA », puis « les articles changent automatiquement, avec les autres de
// 20 000 à 40 000 FCFA ». Deux fourchettes (bornes comprises) ; les articles de 15 001 à 19 999 FCFA ne sont pas montrés.
export const ENTRY_PRICE_BANDS: readonly { min: number; max: number }[] = [
  { min: 10000, max: 15000 },
  { min: 20000, max: 40000 },
];
export const ENTRY_PRICE_MIN = Math.min(...ENTRY_PRICE_BANDS.map((b) => b.min));
export const ENTRY_PRICE_MAX = Math.max(...ENTRY_PRICE_BANDS.map((b) => b.max));
// La bande change toute seule : jusqu'à 4 « jeux » de 4 articles, un nouveau jeu toutes les 5 secondes
export const ENTRY_SET_COUNT = 4;
export const ENTRY_ROTATE_MS = 5000;

// La fourchette d'un prix : 0 (10 000 à 15 000), 1 (20 000 à 40 000), ou -1 (hors des deux : jamais montré)
export const entryBandOf = (price: number | string): number => {
  const n = Number(price);
  return Number.isFinite(n) ? ENTRY_PRICE_BANDS.findIndex((b) => n >= b.min && n <= b.max) : -1;
};

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

const nameOf = (p: EntryProduct) => p.name.replace(/\s+/g, ' ').trim().toLowerCase();

// Les articles à montrer, du plus aimé au moins aimé (à égalité : le moins cher, puis le plus récent) : en vente (actif, en stock, avec photo, un nom), dans l'une des deux
// fourchettes de prix, et jamais un article « Vitalité & Énergie » (réservé aux annonces des clients mariés de 32 ans et plus).
function rankEntryProducts(products: readonly EntryProduct[], categories: readonly EntryCategory[]): EntryProduct[] {
  const sellable = products.filter((p) => p.is_active !== false && (p.stock ?? 0) > 0 && firstImage(p) !== null && entryBandOf(p.price) >= 0 && p.name.trim() !== '');
  const allowed = adAllowedProducts(sellable, categories, null);
  return [...allowed].sort((a, b) => {
    const likes = (b.likes_count ?? 0) - (a.likes_count ?? 0);
    if (likes !== 0) return likes;
    const cheaper = Number(a.price) - Number(b.price);
    if (cheaper !== 0) return cheaper;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
}

// UN jeu de `count` articles DIFFÉRENTS à des PRIX DIFFÉRENTS : la moitié (arrondie en haut) de la fourchette 10 000 à 15 000, le reste de la fourchette 20 000 à 40 000,
// quand les deux ont des articles ; sinon on complète avec l'autre. On cherche d'abord un article par catégorie ET par prix, puis un article par prix, puis (seulement
// s'il n'y a pas assez de prix différents) un article par nom. Jamais deux fois le même nom, même sous deux fiches.
function selectEntrySet(ranked: readonly EntryProduct[], categories: readonly EntryCategory[], count: number): EntryProduct[] {
  const picked: EntryProduct[] = [];
  const roots = new Set<string>();
  const prices = new Set<number>();
  const names = new Set<string>();
  const rootOfProduct = (p: EntryProduct) => rootIdOf(categories, p.category_id) ?? p.category_id ?? p.id;
  const take = (p: EntryProduct) => {
    picked.push(p);
    roots.add(rootOfProduct(p));
    prices.add(Number(p.price));
    names.add(nameOf(p));
  };
  const rules: ((p: EntryProduct) => boolean)[] = [
    (p) => !roots.has(rootOfProduct(p)) && !prices.has(Number(p.price)) && !names.has(nameOf(p)),
    (p) => !prices.has(Number(p.price)) && !names.has(nameOf(p)),
    (p) => !names.has(nameOf(p)),
  ];
  const run = (list: readonly EntryProduct[], upTo: number) => {
    for (const ok of rules) {
      for (const p of list) {
        if (picked.length >= upTo) return;
        if (!picked.includes(p) && ok(p)) take(p);
      }
    }
  };
  run(ranked.filter((p) => entryBandOf(p.price) === 0), Math.ceil(count / 2));
  run(ranked.filter((p) => entryBandOf(p.price) === 1), count);
  run(ranked, count);
  return picked;
}

// affichage : du moins cher au plus cher (à prix égal, l'ordre de choix est gardé)
const byPriceAscending = (set: readonly EntryProduct[]): EntryProduct[] => set.map((p, i) => ({ p, i })).sort((x, y) => Number(x.p.price) - Number(y.p.price) || x.i - y.i).map((x) => x.p);

// Les « jeux » de la bande « Voici ce qui vous attend » : le 1er jeu est montré tout de suite, les autres prennent sa place l'un après l'autre (toutes les ENTRY_ROTATE_MS).
// Un article (ou son nom) n'apparaît que dans un seul jeu ; seul le 1er jeu peut avoir moins de `count` articles (jamais une bande à moitié vide qui change).
export function pickEntrySets(products: readonly EntryProduct[], categories: readonly EntryCategory[], count: number = ENTRY_PREVIEW_COUNT, maxSets: number = ENTRY_SET_COUNT): EntryProduct[][] {
  let pool = rankEntryProducts(products, categories);
  const sets: EntryProduct[][] = [];
  while (sets.length < maxSets && pool.length > 0) {
    const set = selectEntrySet(pool, categories, count);
    if (set.length === 0 || (sets.length > 0 && set.length < count)) break;
    sets.push(byPriceAscending(set));
    const usedNames = new Set(set.map(nameOf));
    pool = pool.filter((p) => !set.includes(p) && !usedNames.has(nameOf(p)));
  }
  return sets;
}

// Le 1er jeu seulement (les plus aimés d'abord, 4 prix différents, du moins cher au plus cher)
export function pickEntryProducts(products: readonly EntryProduct[], categories: readonly EntryCategory[], count: number = ENTRY_PREVIEW_COUNT): EntryProduct[] {
  return pickEntrySets(products, categories, count, 1)[0] ?? [];
}

// ---------------------------------------------------------------------------------------------
// Création du compte : nom, téléphone, mot de passe, conditions (e-mail facultatif). Le reste est demandé ensuite, dans le sondage (lib/clientSurvey)
// ---------------------------------------------------------------------------------------------

export type StepOneCheck = { ok: true } | { ok: false; title: string; message: string };

// L'e-mail est facultatif : vide = accepté ; écrit mais mal écrit = refusé (`emailOk` : l'adresse écrite est valide)
export function checkStepOne(input: { name: string; phone: string; password: string; terms: boolean; email?: string }, phoneOk: boolean, emailOk: boolean = true): StepOneCheck {
  if (!input.name.trim() || !input.phone.trim() || !input.password) {
    return { ok: false, title: 'Champs manquants', message: 'Nom, numéro de téléphone et mot de passe sont obligatoires.' };
  }
  if (!phoneOk) return { ok: false, title: 'Téléphone invalide', message: 'Merci de saisir un numéro de téléphone valide (ex. 66 12 34 56).' };
  if ((input.email ?? '').trim() && !emailOk) return { ok: false, title: 'E-mail invalide', message: 'Merci de saisir une adresse e-mail valide, ou laissez la case vide.' };
  if (input.password.length < 6) return { ok: false, title: 'Mot de passe trop court', message: 'Minimum 6 caractères.' };
  if (!input.terms) return { ok: false, title: 'Conditions non acceptées', message: "Merci d'accepter les conditions d'inscription pour continuer." };
  return { ok: true };
}
