// Page de confirmation de commande : « Paiement Paiement à la livraison initié » (mot répété) corrigé. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/payment-initiated-text.test.ts
import { paymentInitiatedText } from '../../src/lib/payments/initiatedText.ts';

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

const cash = paymentInitiatedText('Paiement à la livraison', 'Vous payerez en espèces directement à la livraison.');
check('livraison : « Paiement » n\'est écrit qu\'une fois', cash === 'Paiement à la livraison initié. Vous payerez en espèces directement à la livraison.', cash);
check('livraison : pas de doublon', !/paiement\s+paiement/i.test(cash), cash);
check('Airtel Money : « Paiement Airtel Money initié »', paymentInitiatedText('Airtel Money', 'Validez sur votre téléphone.') === 'Paiement Airtel Money initié. Validez sur votre téléphone.');
check('Moov Money : « Paiement Moov Money initié »', paymentInitiatedText('Moov Money', 'ok') === 'Paiement Moov Money initié. ok');
check('majuscule/minuscule et espaces ignorés', paymentInitiatedText('  paiement à la livraison ', 'ok') === 'paiement à la livraison initié. ok');
check('un libellé qui contient « paiement » plus loin est complété', paymentInitiatedText('Mobile Money (paiement rapide)', 'ok') === 'Paiement Mobile Money (paiement rapide) initié. ok');

console.log(`\n${ok} vérifications réussies${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
