# Page unique « Café Homme » (albasseshopping.com/cafe)

Une seule page pour vendre le **Café Homme** (catégorie « Vitalité & Énergie Homme »), faite pour les hommes, **sans le menu ni les catégories du site**.

Adresse : `https://www.albasseshopping.com/cafe` (la page répond aussi à `https://www.albasseshopping.com/vitalite-energie-homme`).

Nom de la page : **Vitalité & Énergie Homme** (affiché en haut de la page et dans l'onglet du navigateur).

## Ce que le client voit
- « ALBASSE SHOPPING », la pastille **POUR HOMME** et le nom de la page **Vitalité & Énergie Homme**.
- La vraie photo, le vrai nom et le **vrai prix** de la fiche `cafe-homme` (si tu changes le prix ou la photo dans Admin › Produits, la page suit toute seule).
- Un bouton **Commander maintenant** (et la même barre « Commander » collée en bas de l'écran).
- « Le café en bref » : préparation rapide, 5 sachets individuels, format à emporter, destiné aux hommes, **livraison dans une enveloppe kaki**.
- « Livraison, paiement, retour » : les vraies règles de la boutique (colis livré dans une enveloppe kaki, livraison de 8h30 à 16h, paiement à la livraison à N'Djamena, Airtel Money ou Moov Money ailleurs, retour sous 72 heures).
- Un bouton WhatsApp (« Une question ? ») et, tout en bas, Conditions de retour, Confidentialité, Contact.

## La commande
« Commander » ouvre la **page de commande du site** avec le café (un article, quantité modifiable). La commande arrive donc dans ton admin comme les autres : liste des commandes, facture, alerte Telegram, compte du client créé à la confirmation. Rien n'est envoyé tant que le client ne confirme pas.

## Adresse cachée
- Aucun lien vers cette page depuis le site, et elle n'est pas dans le plan du site.
- La balise `noindex` demande à Google de ne pas l'afficher dans ses résultats.
- Pour ta publicité (TikTok, Facebook…), donne le lien directement. Les liens avec `?utm_source=…&utm_medium=…&utm_campaign=…` sont comptés comme sur le reste du site (Admin › Performance par source).

## L'enveloppe kaki
La page promet au client une livraison **dans une enveloppe kaki**. C'est à l'équipe de préparer ainsi les commandes de café : repérer dans Admin › Commandes les commandes qui contiennent « Café Homme » (le nom de l'article est écrit sur chaque commande).

## Ce qui est écrit… et ce qui ne l'est pas
Les phrases viennent de la fiche de l'article et des règles de la boutique. **Aucune promesse de santé ou d'effet** n'est écrite sur la page (la ligne « aucun effet secondaire » de la fiche n'est volontairement pas reprise : elle ne peut pas être prouvée). « Plus que N en stock » n'apparaît que si le stock est vraiment entre 1 et 10.

Cas particuliers : stock à 0 → « Épuisé pour le moment » (bouton inactif, WhatsApp reste disponible) ; article retiré de la vente ou fiche supprimée → « Cette offre n'est pas disponible pour le moment ».

## Où est le code
- `src/screens/CafeScreen.tsx` : la page. `src/lib/landingCafe.ts` : les textes, l'état (prêt / épuisé / indisponible), le stock bas, le lien WhatsApp.
- `src/navigation/RootNavigator.tsx` : l'adresse `/cafe`.
- Tests : `node --import ./tests/zara/register.mjs tests/email/landing-cafe.test.ts` et, dans le navigateur, `PARTS=! SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333`.

## Pour une autre page du même genre
Même méthode : copier `CafeScreen.tsx` et `landingCafe.ts`, changer le `slug` de l'article, les phrases et l'adresse dans `RootNavigator.tsx`.
