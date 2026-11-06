// Écran d'entrée « Créez votre compte » : les 4 articles montrés, les avantages, l'étape 1 (nom, téléphone, mot de passe) et l'étape 2 (3 questions). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/entry-screen.test.ts
import {
  ENTRY_BENEFITS,
  ENTRY_PREVIEW_COUNT,
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

// ---- les articles montrés
check('on montre 4 articles', ENTRY_PREVIEW_COUNT === 4);
{
  const products = [
    P('a', 'mont', 3), P('b', 'chau', 3), P('c', 'parf', 2), P('d', 'luns', 1), P('e', 'mont', 3), P('f', 'chau', 2),
  ];
  const picked = pickEntryProducts(products, cats);
  check('4 articles de 4 catégories différentes quand c\'est possible', picked.length === 4 && new Set(picked.map((p) => p.category_id)).size === 4, picked.map((p) => p.id));
  check('les plus aimés d\'abord (a et b : 3 « j\'aime »)', picked[0].id === 'a' && picked[1].id === 'b', picked.map((p) => p.id));
}
{
  const products = [P('a', 'mont', 9), P('b', 'mont', 8), P('c', 'mont', 7), P('d', 'mont', 6), P('e', 'chau', 1)];
  const picked = pickEntryProducts(products, cats);
  check('une catégorie d\'abord une fois : « e » (chaussures) passe avant les 3e et 4e montres', picked.map((p) => p.id).join(',') === 'a,e,b,c', picked.map((p) => p.id));
}
{
  const sub = [P('a', 'parf-h', 5), P('b', 'parf', 4), P('c', 'mont', 3)];
  const picked = pickEntryProducts(sub, cats);
  check('une sous-catégorie compte comme sa catégorie principale (parfum homme et parfum : un seul des deux en premier)', picked[0].id === 'a' && picked[1].id === 'c' && picked[2].id === 'b', picked.map((p) => p.id));
}
{
  const products = [
    P('vit1', 'vit', 99), P('vit2', 'vit-s', 98), // « Vitalité & Énergie » et sa sous-catégorie : jamais montrés à un visiteur
    P('ok1', 'mont', 1),
  ];
  const picked = pickEntryProducts(products, cats);
  check('jamais d\'article « Vitalité & Énergie » (ni de sa sous-catégorie), même très aimé', picked.map((p) => p.id).join(',') === 'ok1', picked.map((p) => p.id));
}
{
  const products = [
    P('inactif', 'mont', 9, { is_active: false }),
    P('stock0', 'mont', 9, { stock: 0 }),
    P('stocknull', 'mont', 9, { stock: null }),
    P('sansphoto', 'mont', 9, { images: [] }),
    P('photovide', 'mont', 9, { images: ['', '  '] }),
    P('sansimages', 'mont', 9, { images: null }),
    P('prixzero', 'mont', 9, { price: 0 }),
    P('prixabsent', 'mont', 9, { price: '' }),
    P('sansnom', 'mont', 9, { name: '   ' }),
    P('bon', 'chau', 1),
  ];
  const picked = pickEntryProducts(products, cats);
  check('seulement des articles en vente : actif, en stock, avec photo, avec un prix, avec un nom', picked.map((p) => p.id).join(',') === 'bon', picked.map((p) => p.id));
}
check('boutique vide : rien à montrer (la bande n\'apparaît pas)', pickEntryProducts([], cats).length === 0);
check('moins de 4 articles en vente : on montre ceux qui existent', pickEntryProducts([P('a', 'mont', 1), P('b', 'chau', 1)], cats).length === 2);
{
  const products = [P('a', 'mont', 5), P('b', 'mont', 4), P('c', 'mont', 3), P('d', 'mont', 2), P('e', 'mont', 1)];
  const picked = pickEntryProducts(products, cats);
  check('une seule catégorie : on complète quand même jusqu\'à 4 (les plus aimés)', picked.map((p) => p.id).join(',') === 'a,b,c,d', picked.map((p) => p.id));
}
{
  const tie = [P('vieux', 'mont', 2, { created_at: '2026-10-01T00:00:00Z' }), P('neuf', 'chau', 2, { created_at: '2026-11-04T00:00:00Z' })];
  check('même nombre de « j\'aime » : le plus récent d\'abord', pickEntryProducts(tie, cats)[0].id === 'neuf');
}
check('article sans catégorie : montré quand même', pickEntryProducts([P('x', null, 1)], cats).length === 1);
check('le tri ne modifie pas la liste reçue', (() => {
  const input = [P('a', 'mont', 1), P('b', 'chau', 9)];
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
