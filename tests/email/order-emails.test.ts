// Contenu des e-mails de commande (supabase/functions/brevo-email/orderEmails.ts) : fonctions pures, aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/order-emails.test.ts
import assert from 'node:assert/strict';
import * as E from '../../supabase/functions/brevo-email/orderEmails.ts';

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

const ID = '0c7e6708-fb70-413c-9862-6e041adc963f';
const order = (extra: Partial<E.OrderRow> = {}): E.OrderRow => ({
  id: ID,
  total: 42500,
  payment_method: 'cash_on_delivery',
  shipping_city: "N'Djamena",
  gift_wrap: false,
  loyalty_discount: 0,
  items: [
    { product_name: 'Chaussures homme slip-on sport ', unit_price: 15000, quantity: 2, size: '42', color: 'Noir' },
    { product_name: 'Soulier', unit_price: 12500, quantity: 1, size: null, color: null },
  ],
  ...extra,
});

// adresses
check('vraie adresse acceptée', E.realEmail(' ali@gmail.com ') === 'ali@gmail.com');
check('fausse adresse des comptes par téléphone refusée (même en majuscules)', E.realEmail('23566123456@tel.albasseshopping.com') === null && E.realEmail('X@TEL.ALBASSESHOPPING.COM') === null);
check('adresse vide, mal écrite ou absente : refusée', E.realEmail('') === null && E.realEmail('ali@') === null && E.realEmail('bonjour') === null && E.realEmail(null) === null && E.realEmail(undefined) === null);
check('adresse masquée dans la réponse à l’application', E.mask('chagara89@gmail.com') === 'ch***@gmail.com');

// montants, référence, prénom
check('montant : espaces insécables, FCFA', E.fmt(22500) === '22 500 FCFA' && E.fmt(0) === '0 FCFA' && E.fmt(1234567) === '1 234 567 FCFA' && E.fmt(Number.NaN) === '0 FCFA');
check('référence de commande : 8 premiers caractères en majuscules', E.orderRef(ID) === '0C7E6708', E.orderRef(ID));
check('prénom : premier mot, vide si absent', E.firstName('  Ali Mahamat ') === 'Ali' && E.firstName(null) === '' && E.firstName('') === '');

// commande reçue
{
  const m = E.orderReceivedEmail(order(), 'Ali Mahamat');
  check('commande reçue : objet avec la référence', m.subject === 'Commande reçue n° 0C7E6708 — Albasse Shopping', m.subject);
  check('commande reçue : bonjour avec le prénom, la référence et le titre', /Bonjour Ali,/.test(m.html) && /n° 0C7E6708/.test(m.html) && /Commande reçue ✅/.test(m.html));
  check('commande reçue : les articles avec taille, couleur, quantité et prix', /Chaussures homme slip-on sport/.test(m.html) && /Taille 42 · Noir/.test(m.html) && /2 × 15 000 FCFA/.test(m.html) && /1 × 12 500 FCFA/.test(m.html), m.html.slice(0, 200));
  check('commande reçue : total, ville, horaires de livraison, paiement à la livraison', /42 500 FCFA/.test(m.html) && /N&#39;Djamena/.test(m.html) && /8h30 à 16h/.test(m.html) && /Paiement à la livraison\./.test(m.html));
  check('commande reçue : lien vers Mes commandes', /href="https:\/\/www\.albasseshopping\.com\/mes-commandes"/.test(m.html));
  check('commande reçue : sans emballage cadeau ni remise, aucune ligne pour eux', !/Emballage cadeau/.test(m.html) && !/Remise fidélité/.test(m.html));
}
{
  const m = E.orderReceivedEmail(order({ gift_wrap: true, loyalty_discount: 3000 }), null);
  check('emballage cadeau : ligne à 2 000 FCFA', /Emballage cadeau/.test(m.html) && /2 000 FCFA/.test(m.html));
  check('remise fidélité : ligne en moins', /Remise fidélité −10 %/.test(m.html) && /−3 000 FCFA/.test(m.html));
  check('sans prénom : « Bonjour, » simple', /Bonjour,/.test(m.html));
}
{
  const air = E.orderReceivedEmail(order({ payment_method: 'airtel_money' }), 'Awa').html;
  const moov = E.orderReceivedEmail(order({ payment_method: 'moov_money' }), 'Awa').html;
  check('Airtel Money : numéro et validité 48 heures', /Airtel Money/.test(air) && /60 60 51 51/.test(air) && /48 heures/.test(air));
  check('Moov Money : numéro et validité 48 heures', /Moov Money/.test(moov) && /99 22 10 17/.test(moov) && /48 heures/.test(moov));
  check('paiement par carte, et mode inconnu : rien d’inventé', E.paymentLine('stripe') === 'Paiement par carte.' && E.paymentLine('autre') === '');
}
{
  // un nom d'article ou de client piégé ne doit jamais devenir du code dans l'e-mail
  const m = E.orderReceivedEmail(order({ items: [{ product_name: '<script>alert(1)</script> & Cie', unit_price: 1000, quantity: 1 }], shipping_city: '<b>Ville</b>' }), '<img src=x onerror=alert(1)>');
  check('texte piégé : tout est échappé', !/<script>/.test(m.html) && !/<img src=x/.test(m.html) && !/<b>Ville<\/b>/.test(m.html) && /&lt;script&gt;/.test(m.html), m.html.slice(0, 300));
}

// remise fidélité
check('remise déjà utilisée : aucune phrase', E.loyaltyLine({ delivered: 8, used: true }) === '');
check('6 livrées ou plus, remise pas encore utilisée : bonne nouvelle', /Bonne nouvelle : votre prochaine commande bénéficie de −10 %/.test(E.loyaltyLine({ delivered: 6, used: false })));
check('3 livrées : encore 3 commandes (pluriel)', E.loyaltyLine({ delivered: 3, used: false }) === 'Encore 3 commandes livrées, et votre commande suivante aura −10 % sur les articles.');
check('5 livrées : encore 1 commande (singulier)', E.loyaltyLine({ delivered: 5, used: false }) === 'Encore 1 commande livrée, et votre commande suivante aura −10 % sur les articles.');

// commande livrée
{
  const m = E.orderDeliveredEmail(order(), 'Ali Mahamat', { delivered: 1, used: false });
  check('commande livrée : objet et titre', m.subject === 'Votre commande n° 0C7E6708 est livrée 🎉' && /Commande livrée 🎉/.test(m.html), m.subject);
  check('commande livrée : merci, fidélité, aide et lien', /Merci de votre confiance/.test(m.html) && /Encore 5 commandes livrées/.test(m.html) && /Répondez simplement à cet e-mail/.test(m.html) && /mes-commandes/.test(m.html));
  const used = E.orderDeliveredEmail(order(), 'Ali', { delivered: 9, used: true });
  check('commande livrée, remise déjà utilisée : pas de phrase de fidélité', !/Encore|Bonne nouvelle/.test(used.html));
}
check('mise en page : bandeau de la boutique avec le logo, et pied de page', />Albasse Shopping<\/td>/.test(E.layout('Titre', '<p>x</p>')) && /Cet e-mail concerne votre commande/.test(E.layout('Titre', '<p>x</p>')));
check('mise en page : le logo vient d’une adresse publique du site (https://www.albasseshopping.com/icon-192.png), sans texte de remplacement en double', /<img src="https:\/\/www\.albasseshopping\.com\/icon-192\.png"[^>]*alt=""/.test(E.layout('Titre', '<p>x</p>')));

// bienvenue
{
  const m = E.welcomeEmail('Ali Mahamat');
  check('bienvenue : objet et titre', m.subject === 'Bienvenue chez Albasse Shopping ! 🎉' && /Bienvenue sur Albasse Shopping ! 🎉/.test(m.html), m.subject);
  check('bienvenue : prénom, plateforme 100 % tchadienne, vêtements, chaussures, parfums, montres, accessoires', /Bonjour Ali et bienvenue/.test(m.html) && /100 % tchadienne/.test(m.html) && /vêtements, chaussures, parfums, montres et accessoires/.test(m.html));
  check('bienvenue : les 4 raisons de choisir Albasse', ['tous les goûts et tous les budgets', 'simple et pratique', 'Livraison partout au Tchad', 'service client à votre écoute'].every((t) => m.html.includes(t)));
  check('bienvenue : merci, compte créé, bouton vers le site, pied de page propre', /grande famille/.test(m.html) && /Votre compte est créé/.test(m.html) && /href="https:\/\/www\.albasseshopping\.com"/.test(m.html) && !/Créez votre compte/.test(m.html) && !/concerne votre commande/.test(m.html));
  check('bienvenue sans nom : « Bonjour et bienvenue ! », texte piégé échappé', /Bonjour et bienvenue/.test(E.welcomeEmail('').html) && !/<img src=x/.test(E.welcomeEmail('<img src=x onerror=alert(1)>').html));
}

assert.ok(true);
console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
