// Espace affilié (src/lib/affiliateStats.ts) : lecture des chiffres de la base, totaux, libellé, codes. Fonctions pures, aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/shop/affiliate-stats.test.ts
import {
  parseAffiliateStats,
  affiliateTotals,
  commissionLabel,
  normalizeReferralCode,
  generateReferralCode,
  isDuplicateCodeError,
  paymentHistory,
  ndjamenaDate,
  paymentCountLabel,
  orderCountLabel,
  orderRef,
} from '../../src/lib/affiliateStats.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) { ok++; console.log('OK   ', label); } else { console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail)); process.exitCode = 1; }
};

// la réponse de affiliate_my_stats() (montants rendus en texte ou en nombre selon la base)
const raw = {
  visitors: 3,
  sessions: 4,
  commissions: [
    { id: 'c1', order_id: 'o-aaaaaaaa-1', order_number: 101, order_total: 40000, amount: '2500', status: 'validated', paid: false, paid_at: null, created_at: '2026-11-20T10:00:00Z' },
    { id: 'c2', order_id: 'o-bbbbbbbb-2', order_number: 105, order_total: '40000', amount: 2500, status: 'pending', paid: false, paid_at: null, created_at: '2026-11-19T10:00:00Z' },
    { id: 'c3', order_id: 'o-cccccccc-3', order_number: 108, order_total: 40000, amount: 2500, status: 'cancelled', paid: false, paid_at: null, created_at: '2026-11-18T10:00:00Z' },
    { id: 'c4', order_id: 'o-dddddddd-4', order_number: null, order_total: 30000, amount: 1000, status: 'validated', paid: true, paid_at: '2026-11-21T10:00:00Z', created_at: '2026-11-17T10:00:00Z' },
    { id: 'bad', order_id: 'o', amount: 10, status: 'inconnu' },
    'pas un objet',
  ],
  products: [
    { product_id: 'p1', views: 2, orders: 3, commission: '6000' },
    { product_id: 'p2', views: 1, orders: 0, commission: 0 },
    { views: 9 },
  ],
};

const s = parseAffiliateStats(raw, 'amina');
check('réponse lue : 3 visiteurs', s?.visitors === 3, s);
check('4 commissions gardées (une ligne au statut inconnu et une ligne illisible écartées)', s?.commissions.length === 4, s?.commissions.map((c) => c.id));
check('montants en texte convertis en nombres (2 500, 40 000)', s?.commissions[0].amount === 2500 && s?.commissions[1].order_total === 40000);
check('le numéro de commande est gardé, et l\'affilié est rattaché', s?.commissions[0].order_number === 101 && s?.commissions[0].affiliate_id === 'amina' && s?.commissions[3].order_number === null);
check('« payée » lu seulement si vrai', s?.commissions[3].paid === true && s?.commissions[0].paid === false);
check('par article : montre vue 2 fois, 3 commandes, 6 000 FCFA ; parfum vu 1 fois ; une ligne sans article écartée',
  s?.products.p1?.views === 2 && s?.products.p1?.orders === 3 && s?.products.p1?.commission === 6000 && s?.products.p2?.views === 1 && Object.keys(s?.products ?? {}).length === 2, s?.products);

check('pas affilié / fonction absente (null) : null (la page garde l\'ancienne lecture)', parseAffiliateStats(null, 'x') === null);
check('réponse incomplète : null', parseAffiliateStats({ visitors: 1 }, 'x') === null && parseAffiliateStats({ commissions: [], products: [] }, 'x') === null && parseAffiliateStats([], 'x') === null);
check('aucune vente encore : 0 partout, pas d\'erreur', JSON.stringify(parseAffiliateStats({ visitors: 0, sessions: 0, commissions: [], products: [] }, 'x')) === JSON.stringify({ visitors: 0, commissions: [], products: {} }));

const t = affiliateTotals(s!.commissions);
check('ventes : 3 (l\'annulée ne compte pas)', t.ordersCount === 3, t);
check('chiffre d\'affaires : 110 000 FCFA (40 000 + 40 000 + 30 000 ; l\'annulée exclue)', t.revenue === 110000, t);
check('commission en attente 2 500, validée non payée 2 500, déjà payée 1 000', t.pendingCommission === 2500 && t.validatedCommission === 2500 && t.paidCommission === 1000, t);
check('montant de commande inconnu : compté 0, pas d\'erreur', affiliateTotals([{ status: 'pending', paid: false, amount: 100, order_total: null }]).revenue === 0);

check('libellé : « Commande N° 101 » (le numéro de l\'admin)', commissionLabel({ order_number: 101, order_id: 'o-aaaaaaaa-1' }) === 'Commande N° 101');
check('libellé sans numéro : les 8 premiers caractères comme avant', commissionLabel({ order_number: null, order_id: 'abcdef1234567' }) === 'Commande #abcdef12' && commissionLabel({ order_id: 'abcdef1234567' }) === 'Commande #abcdef12');

check('lien ?ref=amin123 : AMIN123', normalizeReferralCode('amin123') === 'AMIN123');
check('lien avec espaces : nettoyé', normalizeReferralCode('  Amin123 ') === 'AMIN123');
check('code vide, trop long, avec des signes bizarres, ou pas un texte : ignoré', [ '', ' ', 'A', 'x'.repeat(33), 'AMIN<script>', 'AM IN', null, undefined, 42 ].every((v) => normalizeReferralCode(v) === null));
check('code de 32 caractères, tiret, souligné : accepté', normalizeReferralCode('a'.repeat(32)) === 'A'.repeat(32) && normalizeReferralCode('promo-tik_1') === 'PROMO-TIK_1');

check('nouveau code : 4 lettres du nom sans accents + 4 chiffres (« Aïcha Mahamat » → AICH…)', /^AICH\d{4}$/.test(generateReferralCode('Aïcha Mahamat')), generateReferralCode('Aïcha Mahamat'));
check('chiffres de 1000 à 9999', generateReferralCode('Amina', () => 0) === 'AMIN1000' && generateReferralCode('Amina', () => 0.99999) === 'AMIN9999');
check('nom vide ou sans lettres : AFF + 4 chiffres', /^AFF\d{4}$/.test(generateReferralCode(null)) && /^AFF\d{4}$/.test(generateReferralCode('1234 ✨')) && /^AFF\d{4}$/.test(generateReferralCode('')));
check('nom court : gardé tel quel (« Al » → AL + 4 chiffres)', /^AL\d{4}$/.test(generateReferralCode('Al')));
check('un code généré passe toujours le nettoyage du lien, sans changer', ['Aïcha', 'Al', null, 'Jean-Pierre', 'Ñoño'].every((n) => [0, 0.5, 0.99999].every((r) => { const c = generateReferralCode(n, () => r); return normalizeReferralCode(c) === c; })));

check('code déjà pris : reconnu (code 23505 ou message « duplicate key »)', isDuplicateCodeError({ code: '23505', message: 'x' }) && isDuplicateCodeError({ message: 'duplicate key value violates unique constraint "profiles_referral_code_idx"' }));
check('autre erreur ou aucune : pas un doublon', !isDuplicateCodeError(null) && !isDuplicateCodeError({ code: '42501', message: 'permission denied' }) && !isDuplicateCodeError({}));

// historique des paiements (bouton « Déjà payé »)
const paidRows = [
  { order_id: 'o-99', order_number: 99, order_total: 22000, amount: 1100, paid: true, paid_at: '2026-11-21T08:00:00Z' },   // 21 nov. 9h00 à N'Djamena
  { order_id: 'o-101', order_number: 101, order_total: 40000, amount: 2500, paid: true, paid_at: '2026-11-21T13:05:00Z' }, // 21 nov. 14h05
  { order_id: 'o-96', order_number: 96, order_total: 18000, amount: 900, paid: true, paid_at: '2026-11-14T23:30:00Z' },    // 15 nov. 0h30 à N'Djamena (14 nov. en UTC)
  { order_id: 'o-105', order_number: 105, order_total: 22000, amount: 1100, paid: false, paid_at: null },                  // pas payée
  { order_id: 'oldoldold-1', order_number: null, order_total: null, amount: 500, paid: true, paid_at: null },              // payée, date perdue
];
const h = paymentHistory(paidRows);
check('historique : 3 paiements (les 2 commissions du 21 novembre = un seul paiement), la non payée exclue', h.count === 3 && h.payments.length === 3, h.payments.map((p) => p.key));
check('total payé : 5 000 FCFA (1 100 + 2 500 + 900 + 500)', h.total === 5000, h.total);
check('le plus récent d\'abord : 21 novembre (3 600 FCFA), puis 15 novembre, puis la date perdue', h.payments[0].dateLabel === '21 novembre 2026' && h.payments[0].total === 3600 && h.payments[1].dateLabel === '15 novembre 2026' && h.payments[2].dateLabel === 'Date non enregistrée', h.payments.map((p) => [p.dateLabel, p.total]));
check('l\'heure : celle du dernier règlement du jour, à N\'Djamena (14h05)', h.payments[0].timeLabel === '14h05', h.payments[0].timeLabel);
check('payé à 23h30 UTC le 14 : compté le 15 novembre à 0h30 (heure de N\'Djamena)', h.payments[1].key === '2026-11-15' && h.payments[1].timeLabel === '0h30', h.payments[1]);
check('commandes d\'un paiement : N° 101 puis N° 99, avec leur montant', h.payments[0].orders.map((o) => `${o.order_number}:${o.order_total}`).join(',') === '101:40000,99:22000');
check('aucun paiement : 0, liste vide', JSON.stringify(paymentHistory([])) === JSON.stringify({ total: 0, count: 0, payments: [] }) && paymentHistory([paidRows[3]]).count === 0);
check('date illisible ou vide : pas de date', ndjamenaDate('n\'importe quoi') === null && ndjamenaDate(null) === null && ndjamenaDate('') === null);
check('1er janvier à 23h30 UTC : 2 janvier à N\'Djamena, mois en français', ndjamenaDate('2026-01-01T23:30:00Z')?.dateLabel === '2 janvier 2026' && ndjamenaDate('2026-08-05T10:07:00Z')?.dateLabel === '5 août 2026' && ndjamenaDate('2026-08-05T10:07:00Z')?.timeLabel === '11h07');
check('libellés : 1 paiement / 3 paiements, 1 commande / 2 commandes', paymentCountLabel(1) === '1 paiement' && paymentCountLabel(3) === '3 paiements' && paymentCountLabel(0) === '0 paiement' && orderCountLabel(1) === '1 commande' && orderCountLabel(2) === '2 commandes');
check('référence : N° 101, ou #8 caractères sans numéro', orderRef({ order_number: 101, order_id: 'x' }) === 'N° 101' && orderRef({ order_number: null, order_id: 'oldoldold-1' }) === '#oldoldol');

console.log(process.exitCode ? '\nIL Y A DES ECHECS' : `\nTOUS LES CONTROLES REUSSIS (${ok})`);
