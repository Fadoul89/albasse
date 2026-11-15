# Airtel Money et Moov Money : retirés « pour le moment »

> ## ✅ REMIS le 15 novembre 2026
> Demande du patron : « Activé le système de paiement / Mettez les informations en bas de page de commande ».
> - **Interrupteur** : `netlify.toml` › `[build.environment]` › `EXPO_PUBLIC_MOBILE_MONEY = "on"` (le site publié est construit avec). **Pour les retirer de nouveau : supprimer cette ligne**, remettre les textes fixes ci-dessous, publier, redéployer `zara-ai`.
> - **Textes fixes remis** : description Google (`public/index.html`, `netlify/edge-functions/lib/seo.ts`) « …paiement à la livraison à N'Djamena, Airtel Money et Moov Money. » et consigne de `supabase/functions/zara-ai/index.ts` (« paiement à l'avance par Airtel Money ou Moov Money »). **`zara-ai` doit être redéployée.**
> - **Page de commande, tout en bas** (sous « Confirmer la commande ») : bloc **« 💳 Informations de paiement »** avec une carte **Moov Money** (99 22 10 17) puis une carte **Airtel Money** (60 60 51 51), chacune avec le bouton **« 📋 Copier le numéro »** (copie les chiffres seuls). Les numéros viennent d'Admin › Moyens de paiement (sinon ceux de `shopRules.PAYMENT`) ; un lien de paiement n'apparaît que s'il est enregistré. Aucun nom de titulaire n'est affiché : il n'est enregistré nulle part. Le bloc n'existe que si Airtel / Moov sont ouverts. Code : `src/lib/paymentCards.ts`, `src/components/PaymentInfoCards.tsx`.
> - Tests : `tests/email/payment-cards.test.ts` (18) ; navigateur, construction avec la variable : `MOBILE_MONEY=on PARTS='C§O' node tests/zara/zara-ui.test.js` (la partie `C` contrôle le bloc, l'ordre, la copie).
>
> Le reste de cette page décrit le retrait du 3 novembre (historique).

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
