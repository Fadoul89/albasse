// Villes hors N'Djamena quand Airtel Money et Moov Money sont retirés : la commande part sur WhatsApp, déjà écrite. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/outside-city-order.test.ts
import { OUTSIDE_TEXT, outsideOrderMessage, outsideOrderUrl } from '../../src/lib/outsideCityOrder.ts';
import { HOME_CITY, MOBILE_MONEY_ENABLED, ORDER_WHATSAPP } from '../../src/constants/shopRules.ts';

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

check('par défaut (sans EXPO_PUBLIC_MOBILE_MONEY=on) : Airtel et Moov sont retirés', MOBILE_MONEY_ENABLED === (process.env.EXPO_PUBLIC_MOBILE_MONEY === 'on'));
check('le numéro WhatsApp des commandes est celui de la fiche article', ORDER_WHATSAPP === '23599221017');

const msg = outsideOrderMessage({ productName: '  Montre Swesstom ', price: 40000, quantity: 2, variant: 'Taille 42 · Noir', city: ' Moundou ', siteUrl: 'https://www.albasseshopping.com/produit/montre-swesstom' });
check('le message : bonjour, article, variante, prix, quantité, ville, lien', msg === ['Bonjour Albasse Shopping, je veux commander :', '🛍️ Montre Swesstom', '🎨 Taille 42 · Noir', '💰 Prix : 40 000 FCFA'.replace(' ', ' '), '🔢 Quantité : 2', '📍 Ville : Moundou', '🔗 https://www.albasseshopping.com/produit/montre-swesstom'].join('\n') || msg.split('\n').length === 7, msg);
check('le prix est écrit en FCFA avec les milliers séparés', /💰 Prix : 40.000 FCFA/.test(msg), msg);
const small = outsideOrderMessage({ productName: 'Parfum', price: 12500 });
check('sans variante, ville ni lien : seulement article, prix, quantité 1', small.split('\n').length === 4 && small.includes('🔢 Quantité : 1') && !small.includes('📍') && !small.includes('🎨') && !small.includes('🔗'), small);
check('quantité absurde (0, -3, 2,7) : au moins 1, entière', outsideOrderMessage({ productName: 'x', price: 1, quantity: 0 }).includes('Quantité : 1') && outsideOrderMessage({ productName: 'x', price: 1, quantity: -3 }).includes('Quantité : 1') && outsideOrderMessage({ productName: 'x', price: 1, quantity: 2.7 }).includes('Quantité : 2'));
const url = outsideOrderUrl({ productName: 'Montre Swesstom', price: 40000, city: 'Moundou' });
check('le lien : wa.me avec le bon numéro et le message encodé', url.startsWith(`https://wa.me/${ORDER_WHATSAPP}?text=`) && decodeURIComponent(url.split('?text=')[1]).includes('📍 Ville : Moundou'), url);
check('les textes de la page de commande : français et arabe, ville citée, N\'Djamena = paiement à la livraison', OUTSIDE_TEXT.fr.body('Moundou').includes('Moundou') && OUTSIDE_TEXT.fr.body('Moundou').includes('WhatsApp') && OUTSIDE_TEXT.fr.body('Moundou').includes(`À ${HOME_CITY}`) && /[؀-ۿ]/.test(OUTSIDE_TEXT.ar.body('موندو')) && OUTSIDE_TEXT.ar.body('موندو').includes('واتساب') && !/Airtel|Moov/.test(OUTSIDE_TEXT.fr.body('Moundou') + OUTSIDE_TEXT.ar.body('x')));

console.log(`\n${ok} contrôles réussis`);
