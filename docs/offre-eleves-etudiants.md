# Offre élèves et étudiants : URBANSOLE à 12 500 FCFA (code EE26)

Demande du patron (9 novembre 2026) : *« Propose cet article à tous les élèves et étudiants. Grande affiche professionnelle. Offre uniquement pour les élèves et étudiants : 12 500 FCFA. »* Puis : *« un code de réduction EE26 pour réduction automatique »*.

## Ce que ça fait
- **L'article** : URBANSOLE (`/produit/urbansole`), 15 000 FCFA pour tout le monde, **12 500 FCFA pour les élèves et étudiants** (−2 500 FCFA, −17 %).
- **Le code EE26 s'applique tout seul** : le client n'écrit rien, ni à la commande, ni dans Zara.
- **Qui y a droit** : un client connecté dont le **métier**, écrit par lui-même dans son compte (« Compte » › « Métier »), est élève, étudiant, lycéen, collégien, écolier (français) ou تلميذ / طالب (arabe). **Rien n'est deviné** : ni le prénom, ni l'âge, ni le genre. Un client sans métier écrit n'a pas l'offre. Aujourd'hui, 231 clients sur 874 ont écrit « étudiant » (149) ou « élève » (82).
- **La grande affiche** (accueil, dans l'annonce de Zara) : bandeau « 🎓 OFFRE RÉSERVÉE AUX ÉLÈVES ET ÉTUDIANTS », grande photo, « −17 % », nom, **12 500 FCFA** en grand, « au lieu de 15 000 FCFA », « 🎟️ Code EE26 appliqué automatiquement », « Offre uniquement pour les élèves et étudiants », bouton « **Commander avec le code EE26** », « Demander à Zara » et « Pourquoi cette annonce ? ». En arabe aussi. Elle passe **avant** les autres annonces pour un élève ou un étudiant.
- **Elle disparaît** : avec le « ✕ » (l'article n'est plus proposé 24 h), quand l'élève/étudiant a déjà commandé l'article, si l'article est épuisé, retiré, sans photo, ou si son prix tombe à 12 500 FCFA ou moins (il n'y a plus d'économie : jamais de fausse offre).
- **La fiche article** : l'élève/étudiant voit 12 500 FCFA, le prix normal barré et « 🎓 Offre élèves et étudiants : 12 500 FCFA au lieu de 15 000 FCFA (code EE26 appliqué automatiquement) ». Les autres clients voient 15 000 FCFA, sans rien d'autre. Le partage de la fiche (Facebook, WhatsApp…) montre toujours le prix normal.
- **La commande** (page de commande du site **et** Zara) : le prix de l'article est 12 500 FCFA pour un élève/étudiant, le total est juste. Le récapitulatif de Zara dit « 🎓 Offre élèves et étudiants … (code EE26 appliqué automatiquement) ». La commande garde `unit_price` = 12 500 (le prix payé), `list_price` = 15 000 et `promo_code` = « EE26 » : **Admin › Commandes** montre « 🎓 Code EE26 (élève/étudiant) · prix normal 15 000 FCFA » ; la **facture** écrit « Code EE26 » à côté de l'article et ses totaux sont justes.
- **Un panier gardé avec l'offre** puis un client qui n'y a plus droit (autre compte sur le même téléphone, métier changé) : le prix normal revient, et Zara le dit (« Le prix a changé : 12 500 → 15 000 »).
- **Zara** : le client écrit « EE26 », « offre étudiant », « réduction pour les élèves »… ou touche le bouton « 🎓 Offre élèves et étudiants » de son menu (affiché seulement aux élèves/étudiants) :
  - élève/étudiant : l'article au prix de l'offre, le code s'applique tout seul ;
  - autre client : « l'offre est réservée aux élèves et étudiants » + comment y avoir droit (écrire « élève » ou « étudiant » dans « Métier ») ; un visiteur sans compte est invité à créer son compte ;
  - article épuisé ou sans économie : « Il n'y a pas d'offre élèves et étudiants en ce moment ».
- **Admin › Zara › Annonces par public** : les publics « élèves » et « étudiants » montrent la grande affiche (prix de l'offre).

## Ce que ça ne fait jamais (la vérité d'abord)
- Aucun prix « avant » inventé : « au lieu de 15 000 FCFA » est toujours le **vrai prix de l'article dans la base** (si le patron le change, tout suit).
- Aucune fausse urgence, aucune fausse rareté, aucun compte à rebours.
- Jamais le prix de l'offre à quelqu'un qui n'a pas écrit « élève » ou « étudiant » dans son compte.

## À savoir
- **Le métier est écrit par le client** : rien ne le prouve. Quelqu'un peut écrire « étudiant » pour avoir le prix. C'est la règle choisie (même règle que les annonces ciblées).
- **La base ne revérifie pas les prix aujourd'hui** : le script `add-order-price-validation.sql` est un brouillon, **non appliqué**. Le prix de l'offre est donc décidé par le site (comme tous les prix). **Si le patron applique un jour ce script**, il faudra d'abord lui apprendre la règle de l'offre (sinon il refuserait les commandes à 12 500 FCFA : « Le prix a changé »).
- **Changer l'offre** (autre article, autre prix, autre code) : `src/lib/studentOffer.ts`, constante `STUDENT_OFFER` (`slug`, `price`, `code`). Aucun script SQL, aucune fonction serveur.
- **Arrêter l'offre** : retirer l'article de la vente, ou mettre son prix à 12 500 FCFA ou moins, ou (pour tout couper) demander la suppression de `STUDENT_OFFER`.

## Où est le code
- Règles pures : `src/lib/studentOffer.ts` (qui y a droit, prix, textes français et arabe, reconnaissance du code).
- Annonce : `src/lib/adTargeting.ts` (raison `studentOffer`, en premier pour les élèves/étudiants), `src/components/TargetedAdCard.tsx` (la grande affiche), `src/components/ZaraAdsAudiences.tsx` (aperçu admin).
- Prix de la commande : `src/store/cartStore.ts` (`setOrderItem`, `settleOffers`), `src/lib/orders.ts`, `src/screens/CheckoutScreen.tsx`, `src/screens/ProductScreen.tsx`.
- Zara : `src/store/assistantStore.ts` (`studentOfferReply`, bouton du menu, récapitulatif, panier), `src/lib/assistantData.ts` (`toCard`).
- Équipe : `src/screens/admin/AdminOrdersScreen.tsx`, `src/lib/invoice.ts`.

## Tests
- Règles : `node --import ./tests/zara/register.mjs tests/email/student-offer.test.ts` (45 contrôles : qui y a droit, prix, panier, code, textes, annonce, aperçu admin) ; `tests/email/invoice.test.ts` (facture).
- Navigateur : partie `€` de `tests/zara/zara-ui.test.js` (bloc g3 : grande affiche en français et en arabe, fiche article, client sans droit, « ✕ ») et partie `¤` (commande dans Zara et sur la page de commande, avec et sans droit, panier gardé).
