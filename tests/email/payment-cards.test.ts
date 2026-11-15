// Bas de la page de commande : cartes Moov Money / Airtel Money (src/lib/paymentCards.ts).
import { digitsOnly, hasHolderColumns, paymentCards, PAYMENT_CARDS_TEXT } from '../../src/lib/paymentCards.ts';
import { PAYMENT } from '../../src/constants/shopRules.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name);
  }
}

// sans réglage : les numéros de la boutique, Moov puis Airtel
const base = paymentCards(null);
check('2 cartes', base.length === 2);
check('Moov en premier', base[0].key === 'moov' && base[0].name === 'Moov Money');
check('Airtel en second', base[1].key === 'airtel' && base[1].name === 'Airtel Money');
check('numéro Moov = 99 22 10 17', base[0].number === '99 22 10 17' && base[0].number === PAYMENT.moov);
check('numéro Airtel = 60 60 51 51', base[1].number === '60 60 51 51' && base[1].number === PAYMENT.airtel);
check('copie : chiffres seuls (Moov)', base[0].copyValue === '99221017');
check('copie : chiffres seuls (Airtel)', base[1].copyValue === '60605151');
check('pas de lien sans réglage', base[0].url === null && base[1].url === null);

// l'administration change un numéro : la carte le suit
const custom = paymentCards({ moov_number: '66 11 22 33', airtel_number: ' 62 00 00 01 ', moov_payment_url: 'https://pay.example/moov', airtel_payment_url: '' });
check('numéro Moov de l’administration', custom[0].number === '66 11 22 33' && custom[0].copyValue === '66112233');
check('numéro Airtel de l’administration (espaces autour retirés)', custom[1].number === '62 00 00 01' && custom[1].copyValue === '62000001');
check('lien Moov gardé', custom[0].url === 'https://pay.example/moov');
check('lien vide = pas de lien', custom[1].url === null);

// un numéro vide dans l'administration revient au numéro de la boutique
const empty = paymentCards({ moov_number: '   ', airtel_number: null });
check('vide → numéro de la boutique', empty[0].number === PAYMENT.moov && empty[1].number === PAYMENT.airtel);

check('digitsOnly', digitsOnly('+235 99-22.10 17') === '235992210' + '17');

// nom du titulaire : seulement s'il est enregistré
check('sans nom enregistré : aucun nom (jamais inventé)', base[0].holder === null && base[1].holder === null);
const named = paymentCards({ moov_holder_name: '  NOM Prénom ', airtel_holder_name: '' });
check('nom enregistré : repris (espaces retirés) ; nom vide : aucun nom', named[0].holder === 'NOM Prénom' && named[1].holder === null);

// l'administration ne montre les champs « Nom » que si les colonnes existent (script add-payment-holder-names.sql lancé)
check('colonnes « nom » absentes : pas de champs Nom dans l\'administration', !hasHolderColumns({ airtel_number: 'x', moov_number: 'y' }) && !hasHolderColumns(null) && !hasHolderColumns(undefined));
check('colonnes « nom » présentes (même vides) : les champs Nom apparaissent', hasHolderColumns({ airtel_holder_name: null, moov_holder_name: null }) && hasHolderColumns({ airtel_holder_name: 'A', moov_holder_name: 'B' }));
check('une seule des deux colonnes : pas de champs (le script les ajoute ensemble)', !hasHolderColumns({ airtel_holder_name: null }));

// textes
check('titre', PAYMENT_CARDS_TEXT.title.includes('Informations de paiement'));
check('bouton « Copier le numéro »', PAYMENT_CARDS_TEXT.copy === 'Copier le numéro');
check('explication : à l’avance hors N’Djamena, à la livraison à N’Djamena', /avance/.test(PAYMENT_CARDS_TEXT.intro) && /livraison/.test(PAYMENT_CARDS_TEXT.intro));
check('aucun nom de titulaire inventé', !/Nom\s*:/.test(PAYMENT_CARDS_TEXT.intro + PAYMENT_CARDS_TEXT.numberLabel));

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
