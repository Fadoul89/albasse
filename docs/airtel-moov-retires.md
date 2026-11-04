# Airtel Money et Moov Money : retirés « pour le moment »

Demande du patron (3 novembre 2026) : « Supprimez le mode de paiement Airtel et Moov pour le moment. »
Choix du patron : **les autres villes commandent sur WhatsApp**, et le retrait est **simple, dans le code** (pas d'interrupteur dans l'admin, aucun SQL).

## Ce que voient les clients
- **Page de commande** : un seul mode de paiement, **« Paiement à la livraison »**. Il est possible seulement quand la ville choisie est **N'Djamena**.
  - Ville hors N'Djamena : le bouton « Confirmer la commande » disparaît et une carte **« 💬 Commande sur WhatsApp »** apparaît : « Pour le moment, les commandes pour Moundou se prennent sur WhatsApp : nous notons votre commande avec vous et vous disons comment payer. À N'Djamena, vous commandez ici et vous payez à la livraison. » Le bouton **« Commander sur WhatsApp »** ouvre WhatsApp (numéro des commandes, le même que la fiche article) avec la commande **déjà écrite** : article, prix, quantité, ville, lien de la fiche.
  - Plus de numéro Airtel / Moov, plus de lien de paiement sur la page.
- **Chat de Zara** (« Finalisez votre commande ») :
  - **N'Djamena** : plus de question « Comment souhaitez-vous payer ? ». Zara dit « 💵 Paiement : en espèces à la livraison, à N'Djamena. Vous ne payez qu'en recevant votre commande. » et continue (emballage cadeau, récapitulatif, confirmation). La commande est enregistrée en `cash_on_delivery`.
  - **Autre ville** : dès que la ville est choisie (bouton ou écrite), Zara dit que la commande se prend sur WhatsApp et propose **« 💬 Commander sur WhatsApp »** (commande déjà écrite), **« 🏙️ Ville »** (changer de ville) et « Annuler la commande ». Rien n'est enregistré.
  - Un vieux bouton ou le mot « airtel » écrit par le client ne lance jamais un paiement Airtel.
  - Les réponses de Zara sur la livraison et les « informations importantes » ne parlent plus d'Airtel ni de Moov (français et arabe).
- **Annonce de Zara** (accueil) : la ligne de livraison d'une autre ville dit « commande sur WhatsApp » (plus « paiement à l'avance »).
- **Message WhatsApp de relance** (Admin › Clients) : pour une autre ville : « Livraison partout au Tchad : écrivez-nous sur WhatsApp, nous prenons votre commande avec vous. »
- **Google** (description de la page d'accueil, `public/index.html` et `netlify/edge-functions/lib/seo.ts`) : « …paiement à la livraison à N'Djamena. » (sans Airtel ni Moov).
- **Zara IA** (`supabase/functions/zara-ai`) : sa consigne dit que Airtel / Moov sont retirés et qu'il ne faut pas les proposer. **La fonction doit être redéployée** pour que ça compte.

## Ce qui ne change pas
- Les **anciennes commandes** payées ou annoncées par Airtel / Moov gardent leur libellé (mes commandes, administration, facture PDF, e-mails) : l'historique reste vrai.
- **Admin › Moyens de paiement** : les numéros restent enregistrés, avec une note jaune « retirés pour le moment ».
- Le programme d'**affiliés** (paiement des commissions) n'est pas touché.
- Aucun SQL, aucune nouvelle table.

## Comment les remettre (le jour venu)
1. Dans le code, `src/constants/shopRules.ts` : `MOBILE_MONEY_ENABLED` vaut `true` quand la variable `EXPO_PUBLIC_MOBILE_MONEY=on` est présente au moment de la construction du site (ou on met `true` directement dans la ligne). Les textes de Zara, la page de commande, l'annonce et le message de relance reviennent alors **exactement** comme avant.
2. Remettre à la main (ce sont des textes fixes, hors de l'interrupteur) : la description Google dans `public/index.html` et `netlify/edge-functions/lib/seo.ts` (« …, Airtel Money et Moov Money »), et la consigne de `supabase/functions/zara-ai/index.ts`.
3. Publier le site (15 crédits Netlify) et redéployer `zara-ai`.

## Tests
- Règles : `tests/email/outside-city-order.test.ts` (8 contrôles : le message WhatsApp, le lien, les phrases). Les autres tests de règles tournent **dans les deux modes** : sans variable (Airtel / Moov retirés) et avec `EXPO_PUBLIC_MOBILE_MONEY=on` (anciens contrôles).
- Navigateur : la construction **sans** variable passe la partie `¤` (N'Djamena sans question de paiement, autre ville → WhatsApp, arabe, mot « airtel » ignoré, informations de Zara) et la partie `C` (page de commande) ; la construction **avec** `EXPO_PUBLIC_MOBILE_MONEY=on` doit être lancée avec `MOBILE_MONEY=on` et passe **tous les anciens contrôles** (parties `O`, `§`, `C`…), ce qui prouve que le retour en arrière marcherait.
