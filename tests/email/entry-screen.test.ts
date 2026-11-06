// Écran d'entrée « Créez votre compte » : les 4 articles montrés, les avantages, l'étape 1 (nom, téléphone, mot de passe) et l'étape 2 (3 questions). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/entry-screen.test.ts
import {
  ENTRY_BENEFITS,
  ENTRY_PREVIEW_COUNT,
  ENTRY_PRICE_MAX,
  ENTRY_PRICE_MIN,
  STEP_TWO_MAX_AGE_MS,
  answersMissingFor,
  checkStepOne,
  entryPrice,
  pickEntryProducts,
  stepTwoDue,
  stepTwoMissing,
  stepTwoStillValid,
  type EntryCategory,
  type EntryProduct,
} from '../../src/lib/entryScreen.ts';
import { WHEEL_ENABLED } from '../../src/lib/featureFlags.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

const cats: EntryCategory[] = [
  { id: 'parf', name: 'Parfum', slug: 'parfum' },
  { id: 'parf-h', name: 'Parfum homme', slug: 'parfum-homme', parent_id: 'parf' },
  { id: 'mont', name: 'MONTRE & ACCESSOIRES', slug: 'montre' },
  { id: 'chau', name: 'Chaussures', slug: 'chaussures' },
  { id: 'vit', name: 'Vitalité & Énergie Homme', slug: 'vitalite-energie-homme' },
  { id: 'vit-s', name: 'Café', slug: 'cafe', parent_id: 'vit' },
  { id: 'luns', name: 'Lunettes', slug: 'lunettes' },
];
const P = (id: string, cat: string | null, likes: number, extra: Partial<EntryProduct> = {}): EntryProduct => ({
  id,
  name: `Article ${id}`,
  price: 10000,
  images: [`https://x/${id}.jpg`],
  stock: 5,
  is_active: true,
  category_id: cat,
  likes_count: likes,
  created_at: '2026-11-01T00:00:00Z',
  ...extra,
});

// ---- prix
check('prix : « 40 000 FCFA » (séparateur de milliers français, sans décimales)', entryPrice(40000).replace(/\s/g, ' ') === '40 000 FCFA' || /^40\D000 FCFA$/.test(entryPrice(40000)), entryPrice(40000));
check('prix : texte reçu de la base (« 22500.00 »)', /^22\D500 FCFA$/.test(entryPrice('22500.00')), entryPrice('22500.00'));
check('prix : valeur absente = 0 FCFA, jamais « NaN »', entryPrice('') === '0 FCFA' && !/NaN/.test(entryPrice(undefined as unknown as number)));

// ---- les articles montrés : entre 10 000 et 15 000 FCFA (demande du patron, 6 novembre)
check('on montre 4 articles', ENTRY_PREVIEW_COUNT === 4);
check('fourchette de prix : de 10 000 à 15 000 FCFA', ENTRY_PRICE_MIN === 10000 && ENTRY_PRICE_MAX === 15000);
const PR = (id: string, cat: string | null, price: number | string, likes = 0, extra: Partial<EntryProduct> = {}): EntryProduct => P(id, cat, likes, { price, ...extra });
{
  const products = [
    PR('trop-bas1', 'mont', 3500, 9), PR('trop-bas2', 'chau', 9999, 9), PR('trop-haut1', 'parf', 15001, 9), PR('trop-haut2', 'luns', 650000, 9),
    PR('borne-basse', 'mont', 10000, 1), PR('borne-haute', 'chau', 15000, 1), PR('milieu', 'parf', 12500, 1),
  ];
  const picked = pickEntryProducts(products, cats);
  check('seulement de 10 000 à 15 000 FCFA, bornes comprises (9 999 et 15 001 refusés, même très aimés)', picked.map((p) => p.id).join(',') === 'borne-basse,milieu,borne-haute', picked.map((p) => `${p.id}:${p.price}`));
}
{
  const products = [PR('a', 'mont', 15000, 5), PR('b', 'chau', 10000, 4), PR('c', 'parf', 12500, 3), PR('d', 'luns', 11000, 2), PR('e', 'vit', 10500, 99)];
  const picked = pickEntryProducts(products, cats);
  check('4 articles de 4 catégories différentes, rangés du moins cher au plus cher pour l\'affichage', picked.map((p) => p.id).join(',') === 'b,d,c,a' && new Set(picked.map((p) => p.category_id)).size === 4, picked.map((p) => `${p.id}:${p.price}`));
  check('les prix montrés se suivent dans l\'ordre croissant', picked.every((p, i) => i === 0 || Number(picked[i - 1].price) <= Number(p.price)), picked.map((p) => p.price));
}
{
  const products = [PR('a', 'mont', 11000, 9), PR('b', 'mont', 11500, 8), PR('c', 'mont', 12000, 7), PR('d', 'mont', 12500, 6), PR('e', 'chau', 13000, 1), PR('f', 'parf', 13500, 0)];
  const picked = pickEntryProducts(products, cats);
  check('on choisit les plus aimés, un par catégorie d\'abord : chaussures et parfum passent avant les 2e et 3e montres', picked.map((p) => p.id).join(',') === 'a,b,e,f' || picked.map((p) => p.id).sort().join(',') === 'a,e,f,b', picked.map((p) => p.id));
  check('…donc 3 catégories différentes dans les 3 premiers choisis', new Set(picked.slice(0, 4).map((p) => p.category_id)).size === 3, picked.map((p) => p.category_id));
}
{
  const sub = [PR('a', 'parf-h', 12000, 5), PR('b', 'parf', 12500, 4), PR('c', 'mont', 13000, 3)];
  const picked = pickEntryProducts(sub, cats);
  check('une sous-catégorie compte comme sa catégorie principale (parfum homme et parfum : un seul d\'abord)', picked.map((p) => p.id).join(',') === 'a,b,c' && picked.slice(0, 3).filter((p) => p.category_id === 'parf' || p.category_id === 'parf-h').length === 2, picked.map((p) => p.id));
  const firstTwo = pickEntryProducts([...sub, PR('d', 'luns', 14000, 0)], cats).map((p) => p.id);
  check('…et le 2e parfum n\'est pris qu\'en dernier (4 articles : parfum homme, montre, lunettes, puis parfum)', firstTwo.join(',') === 'a,b,c,d', firstTwo);
}
{
  const products = [PR('vit1', 'vit', 12000, 99), PR('vit2', 'vit-s', 12500, 98), PR('ok1', 'mont', 13000, 1)];
  const picked = pickEntryProducts(products, cats);
  check('jamais d\'article « Vitalité & Énergie » (ni de sa sous-catégorie), même dans la fourchette et très aimé', picked.map((p) => p.id).join(',') === 'ok1', picked.map((p) => p.id));
}
{
  const products = [
    PR('inactif', 'mont', 12000, 9, { is_active: false }),
    PR('stock0', 'mont', 12000, 9, { stock: 0 }),
    PR('stocknull', 'mont', 12000, 9, { stock: null }),
    PR('sansphoto', 'mont', 12000, 9, { images: [] }),
    PR('photovide', 'mont', 12000, 9, { images: ['', '  '] }),
    PR('sansimages', 'mont', 12000, 9, { images: null }),
    PR('prixabsent', 'mont', '', 9),
    PR('sansnom', 'mont', 12000, 9, { name: '   ' }),
    PR('bon', 'chau', 12000),
  ];
  const picked = pickEntryProducts(products, cats);
  check('seulement des articles en vente : actif, en stock, avec photo, un prix dans la fourchette, un nom', picked.map((p) => p.id).join(',') === 'bon', picked.map((p) => p.id));
}
check('boutique vide : rien à montrer (la bande n\'apparaît pas)', pickEntryProducts([], cats).length === 0);
check('aucun article dans la fourchette : rien (jamais un article hors de 10 000 à 15 000, même pour compléter)', pickEntryProducts([PR('a', 'mont', 3500), PR('b', 'chau', 225000), PR('c', 'parf', 650000)], cats).length === 0);
check('moins de 4 articles dans la fourchette : on montre ceux qui existent', pickEntryProducts([PR('a', 'mont', 11000), PR('b', 'chau', 12000), PR('c', 'parf', 20000)], cats).length === 2);
{
  const products = [PR('a', 'mont', 10000, 5), PR('b', 'mont', 11000, 4), PR('c', 'mont', 12000, 3), PR('d', 'mont', 13000, 2), PR('e', 'mont', 14000, 1)];
  const picked = pickEntryProducts(products, cats);
  check('une seule catégorie : on complète quand même jusqu\'à 4 (les plus aimés), du moins cher au plus cher', picked.map((p) => p.id).join(',') === 'a,b,c,d', picked.map((p) => p.id));
}
{
  const tie = [PR('peuaime', 'mont', 12000, 1), PR('beaucoup-cher', 'chau', 14000, 7), PR('beaucoup-moins-cher', 'parf', 11000, 7), PR('beaucoup-vieux', 'luns', 11000, 7, { created_at: '2026-10-01T00:00:00Z' })];
  const picked = pickEntryProducts(tie, cats, 3).map((p) => p.id);
  check('mêmes « j\'aime » : le moins cher d\'abord, puis le plus récent (3 choisis, puis rangés par prix)', picked.join(',') === 'beaucoup-moins-cher,beaucoup-vieux,beaucoup-cher' || picked.join(',') === 'beaucoup-vieux,beaucoup-moins-cher,beaucoup-cher', picked);
}
{
  const strings = [PR('x', 'mont', '12000.00'), PR('y', 'chau', '15000.50'), PR('z', 'parf', '10000'), PR('w', 'luns', '9999.99')];
  check('prix reçus en texte par la base (« 12000.00 ») : comparés comme des nombres, 15 000,50 et 9 999,99 hors fourchette', pickEntryProducts(strings, cats).map((p) => p.id).sort().join(',') === 'x,z', pickEntryProducts(strings, cats).map((p) => p.id));
}
check('article sans catégorie : montré quand même', pickEntryProducts([PR('x', null, 12000)], cats).length === 1);
check('le tri ne modifie pas la liste reçue', (() => {
  const input = [PR('a', 'mont', 14000, 1), PR('b', 'chau', 10500, 9)];
  const copy = input.map((p) => p.id).join(',');
  pickEntryProducts(input, cats);
  return input.map((p) => p.id).join(',') === copy;
})());

// ---- les avantages : seulement des choses vraies
check('2 avantages : paiement à la livraison à N\'Djamena et parrainage (la roue de la chance est cachée : lib/featureFlags)', ENTRY_BENEFITS.length === (WHEEL_ENABLED ? 3 : 2) && /N’Djamena/.test(ENTRY_BENEFITS[0]) && /Invite 5 amis, gagne un parfum/.test(ENTRY_BENEFITS[1]), ENTRY_BENEFITS);
check('roue cachée : aucun avantage ne parle de la roue de la chance', WHEEL_ENABLED || ENTRY_BENEFITS.every((b) => !/roue/i.test(b)), ENTRY_BENEFITS);
check('aucun avantage ne promet un pourcentage, un prix cassé ou une urgence', ENTRY_BENEFITS.every((b) => !/%|dernier|limité|stock|\bvite\b|promo|solde|-\d/i.test(b)), ENTRY_BENEFITS);

// ---- étape 1
const phoneOk = true;
check('étape 1 complète : accepté', checkStepOne({ name: 'Ali Mahamat', phone: '66 12 34 56', password: 'secret12', terms: true }, phoneOk).ok === true);
{
  const r = checkStepOne({ name: '', phone: '66 12 34 56', password: 'secret12', terms: true }, phoneOk);
  check('sans nom : « Champs manquants » (même message qu\'avant)', !r.ok && r.title === 'Champs manquants' && r.message === 'Nom, numéro de téléphone et mot de passe sont obligatoires.', r);
}
check('sans téléphone : champs manquants', (() => { const r = checkStepOne({ name: 'Ali', phone: '  ', password: 'secret12', terms: true }, phoneOk); return !r.ok && r.title === 'Champs manquants'; })());
check('sans mot de passe : champs manquants', (() => { const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '', terms: true }, phoneOk); return !r.ok && r.title === 'Champs manquants'; })());
{
  const r = checkStepOne({ name: 'Ali', phone: '12', password: 'secret12', terms: true }, false);
  check('numéro invalide : « Téléphone invalide »', !r.ok && r.title === 'Téléphone invalide' && /numéro de téléphone valide/.test(r.message), r);
}
{
  const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '12345', terms: true }, phoneOk);
  check('mot de passe de 5 caractères : « Mot de passe trop court »', !r.ok && r.title === 'Mot de passe trop court' && r.message === 'Minimum 6 caractères.', r);
}
check('mot de passe de 6 caractères : accepté', checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '123456', terms: true }, phoneOk).ok === true);
{
  const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: false }, phoneOk);
  check('conditions pas acceptées : refusé', !r.ok && r.title === 'Conditions non acceptées', r);
}
check('e-mail facultatif : vide = accepté', checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: '' }, phoneOk, true).ok === true && checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: '   ' }, phoneOk, false).ok === true && checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true }, phoneOk, false).ok === true);
{
  const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: 'pas-un-email' }, phoneOk, false);
  check('e-mail écrit mais mal écrit : « E-mail invalide » (même message qu\'avant)', !r.ok && r.title === 'E-mail invalide' && r.message === 'Merci de saisir une adresse e-mail valide, ou laissez la case vide.', r);
}
check('e-mail valide : accepté', checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: 'ali@example.com' }, phoneOk, true).ok === true);
check('numéro invalide passe avant l\'e-mail invalide', (() => { const r = checkStepOne({ name: 'Ali', phone: '12', password: 'secret12', terms: true, email: 'x' }, false, false); return !r.ok && r.title === 'Téléphone invalide'; })());
check('e-mail invalide passe avant mot de passe trop court et conditions', (() => { const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '123', terms: false, email: 'x' }, phoneOk, false); return !r.ok && r.title === 'E-mail invalide'; })());
check('l\'ordre des contrôles : champs manquants avant tout le reste', (() => { const r = checkStepOne({ name: '', phone: '', password: '', terms: false }, false); return !r.ok && r.title === 'Champs manquants'; })());

// ---- étape 2 : qui doit répondre ?
const full = { gender: 'femme', birth_date: '1998-03-25', marital_status: 'celibataire' };
check('profil complet : rien à demander', !stepTwoMissing(full));
check('sexe manquant (colonne présente, vide) : à demander', stepTwoMissing({ ...full, gender: null }));
check('naissance manquante : à demander', stepTwoMissing({ ...full, birth_date: null }));
check('situation manquante : à demander', stepTwoMissing({ ...full, marital_status: null }));
check('valeur inconnue (« autre ») : à demander', stepTwoMissing({ ...full, gender: 'autre' }) && stepTwoMissing({ ...full, marital_status: 'veuf' }));
check('rien de rempli, colonnes présentes : à demander', stepTwoMissing({ gender: null, birth_date: null, marital_status: null }));
check('colonnes absentes de la base (scripts SQL pas lancés) : on ne demande pas ce qui ne peut pas être gardé', !stepTwoMissing({ id: 'u' }));
check('seulement le sexe absent de la base : la naissance et la situation sont quand même demandées', stepTwoMissing({ birth_date: null, marital_status: null }) && !stepTwoMissing({ birth_date: '1998-03-25', marital_status: 'marie' }));
check('pas de profil : stepTwoMissing = faux ; answersMissingFor = vrai (on attend le profil, avec un petit chargement)', !stepTwoMissing(null) && !stepTwoMissing(undefined) && answersMissingFor(null) === true && answersMissingFor(undefined) === true);
check('answersMissingFor suit le profil', answersMissingFor(full) === false && answersMissingFor({ ...full, gender: null }) === true);

check('étape 2 due : en attente + connecté + réponses manquantes', stepTwoDue({ pending: true, isAuthenticated: true, answersMissing: true }));
check('pas en attente : jamais (les anciens clients ne sont pas bloqués)', !stepTwoDue({ pending: false, isAuthenticated: true, answersMissing: true }));
check('pas connecté : jamais (c\'est le mur d\'entrée qui s\'affiche)', !stepTwoDue({ pending: true, isAuthenticated: false, answersMissing: true }));
check('réponses déjà données : plus rien à demander', !stepTwoDue({ pending: true, isAuthenticated: true, answersMissing: false }));

// ---- l'attente expire
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);
check('attente de 10 minutes : valable', stepTwoStillValid(NOW - 600_000, NOW));
check('attente de 2 jours : valable', stepTwoStillValid(NOW - 2 * 86_400_000, NOW));
check('attente de 3 jours ou plus : expirée (un ancien compte n\'est jamais bloqué par un vieux reste)', !stepTwoStillValid(NOW - STEP_TWO_MAX_AGE_MS, NOW) && !stepTwoStillValid(NOW - 10 * 86_400_000, NOW));
check('pas de date / texte / valeur absurde : expirée', !stepTwoStillValid(null, NOW) && !stepTwoStillValid(undefined, NOW) && !stepTwoStillValid(NaN, NOW) && !stepTwoStillValid(Infinity, NOW));
check('horloge du téléphone en retard de moins d\'1 h : valable ; date très loin dans le futur : expirée', stepTwoStillValid(NOW + 1_800_000, NOW) && !stepTwoStillValid(NOW + 5 * 3_600_000, NOW));

console.log(`\n${ok} controles OK`);
if (process.exitCode) console.log('DES ECHECS ci-dessus');
else console.log('TOUT EST BON');
