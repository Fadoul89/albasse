// Page unique « Café Homme » (/cafe) : état de la page, stock bas, lien WhatsApp, textes vrais. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/landing-cafe.test.ts
import { CAFE_FACTS, CAFE_PAGE, CAFE_POINTS, LOW_STOCK_MAX, cafeLowStock, cafeNeedsChoice, cafeStatus, cafeWhatsAppUrl } from '../../src/lib/landingCafe.ts';
import { DELIVERY_HOURS, HOME_CITY } from '../../src/constants/shopRules.ts';

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

check('adresse /cafe, article « cafe-homme »', CAFE_PAGE.path === 'cafe' && CAFE_PAGE.slug === 'cafe-homme');
check('la page est pour les hommes', CAFE_PAGE.badge === 'POUR HOMME' && CAFE_POINTS.some((p) => /destiné aux hommes/.test(p.text)));

// état de la page
check('fiche pas encore arrivée : chargement', cafeStatus(null, true) === 'loading');
check('fiche introuvable (chargement fini) : indisponible', cafeStatus(null, false) === 'missing' && cafeStatus(undefined, false) === 'missing');
check('article retiré de la vente : indisponible', cafeStatus({ is_active: false, stock: 50 }, false) === 'missing');
check('stock à 0 : épuisé', cafeStatus({ is_active: true, stock: 0 }, false) === 'soldout');
check('stock inconnu ou négatif : épuisé (jamais de commande sans stock)', cafeStatus({ is_active: true, stock: null }, false) === 'soldout' && cafeStatus({ is_active: true, stock: -2 }, false) === 'soldout');
check('en vente avec du stock : on peut commander', cafeStatus({ is_active: true, stock: 58 }, false) === 'ready');
check('fiche arrivée pendant un rechargement : on peut commander', cafeStatus({ is_active: true, stock: 3 }, true) === 'ready');

// stock bas : seulement s'il est vrai
check('stock bas dit seulement de 1 à 10 exemplaires', cafeLowStock(1) === 1 && cafeLowStock(10) === 10 && LOW_STOCK_MAX === 10);
check('58 en stock : rien n\'est dit ; 0 : rien non plus', cafeLowStock(58) === null && cafeLowStock(11) === null && cafeLowStock(0) === null && cafeLowStock(null) === null);

// tailles / couleurs
check('un seul choix (ou aucun) : « Commander » va directement à la commande', !cafeNeedsChoice({ sizes: [], colors: [] }) && !cafeNeedsChoice({ sizes: ['M'], colors: ['noir'] }) && !cafeNeedsChoice({}));
check('plusieurs tailles ou couleurs : le client choisit sur la fiche de l\'article', cafeNeedsChoice({ sizes: ['M', 'L'] }) && cafeNeedsChoice({ colors: ['noir', 'bleu'] }));

// WhatsApp
const wa = (n: string | null | undefined) => cafeWhatsAppUrl(n);
check('numéro du site « 60605151 » (8 chiffres) : indicatif 235 ajouté', wa('60605151').startsWith('https://wa.me/23560605151?text='));
check('numéro avec +235 et espaces : chiffres seulement', wa('+235 60 60 51 51').startsWith('https://wa.me/23560605151?text='));
check('numéro absent ou illisible : le numéro de la boutique', wa(null).startsWith('https://wa.me/23560605151?text=') && wa('abc').startsWith('https://wa.me/23560605151?text='));
check('le message est encodé et parle du Café Homme', decodeURIComponent(wa('60605151').split('?text=')[1]) === 'Bonjour, j’ai une question sur le Café Homme.');

// textes : vrais, sans promesse
const all = [...CAFE_POINTS.map((p) => p.text), ...CAFE_FACTS.map((f) => `${f.title} ${f.text}`), CAFE_PAGE.subtitle].join(' | ');
check('livraison : N\'Djamena + heures de livraison de la boutique', CAFE_FACTS[0].text.includes(HOME_CITY) && CAFE_FACTS[0].text.includes(DELIVERY_HOURS));
check('paiement : à la livraison seulement à N\'Djamena, Mobile Money ailleurs', CAFE_FACTS[1].text.includes(`À la livraison à ${HOME_CITY}`) && /Airtel Money ou Moov Money/.test(CAFE_FACTS[1].text));
check('retour : 72 heures (comme la page « Conditions de retour »)', /72 heures/.test(CAFE_FACTS[2].text));
check('aucune promesse de santé, d\'effet ou de résultat sur la page', !/effet|santé|soigne|guéri|garanti|performance|virilité|énergie garantie|sans danger|aucun/i.test(all), all);
check('le lot : 5 sachets (comme la fiche)', /5 sachets/.test(CAFE_PAGE.subtitle) && CAFE_POINTS.some((p) => /5 sachets/.test(p.text)));

console.log(`\n${ok} contrôles réussis`);
