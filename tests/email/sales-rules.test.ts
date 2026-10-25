// Ce qui compte comme une vente (src/lib/salesRules.ts) : seulement les commandes livrées, jamais les fausses.
// Lancer : node --import ./tests/zara/register.mjs tests/email/sales-rules.test.ts
import { countsAsSale, salesTotal } from '../../src/lib/salesRules.ts';

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

check('livrée : compte', countsAsSale({ status: 'delivered', is_flagged_fake: false }));
check('livrée sans information « fausse » (ancienne base) : compte', countsAsSale({ status: 'delivered' }));
check('livrée mais signalée fausse : ne compte pas', !countsAsSale({ status: 'delivered', is_flagged_fake: true }));
check('en attente, payée, en préparation, expédiée, annulée : ne comptent pas', ['pending', 'paid', 'processing', 'shipped', 'cancelled'].every((s) => !countsAsSale({ status: s, is_flagged_fake: false })));
const list = [
  { status: 'delivered', is_flagged_fake: false, total: 20000 },
  { status: 'delivered', is_flagged_fake: false, total: '15000' },
  { status: 'delivered', is_flagged_fake: true, total: 99999 },
  { status: 'pending', is_flagged_fake: false, total: 50000 },
  { status: 'cancelled', is_flagged_fake: false, total: 30000 },
  { status: 'shipped', is_flagged_fake: false, total: 12000 },
];
check('total des ventes : 20 000 + 15 000 (rien d’autre)', salesTotal(list) === 35000, salesTotal(list));
check('aucune commande : 0', salesTotal([]) === 0);
console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
