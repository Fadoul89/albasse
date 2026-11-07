# Mes partenaires locaux (privé : le patron seul)

Demande du patron (7 novembre 2026) : *« Certains articles que je publie appartiennent à des partenaires locaux. Quand je reçois une commande, je peux oublier à qui est l'article. Je veux une liste de mes partenaires, associer chaque article à un partenaire, et que moi seul puisse le voir, avec de petits messages sur l'article. »*

## Ce que fait le site
1. **Admin › Boutique › Mes partenaires** (`/admin/partenaires`) : la liste de mes partenaires (nom, téléphone / WhatsApp, petit mot). Ajouter, modifier, supprimer ; **Appeler** et **WhatsApp** ; **Ses articles** (la liste de ses articles, avec le petit message de chacun ; un clic ouvre l'article).
2. **Modifier le produit / Nouveau produit** : une partie **« 🤝 Partenaire de l'article »** (sous la catégorie) : on touche un partenaire, ou « Aucun (article à moi) ». Un **petit message privé** facultatif par article (ex. « prix chez lui : 8 000 », « il apporte 5 pièces par semaine »). Un article n'a qu'**un seul** partenaire.
3. **Admin › Commandes** : sous chaque article commandé qui a un partenaire, un **cadre large** (« 🤝 PARTENAIRE DE CET ARTICLE ») avec le nom en grand, le numéro (+235 66 12 34 56) et le petit message (« Prix chez lui : 8 000 ») chacun sur sa ligne, avec **📞 Appeler** et **💬 Prévenir le partenaire** (WhatsApp prêt : « nous avons une commande pour « Montre » × 2, pouvez-vous confirmer qu'il est disponible ? » ; **jamais** le nom, le numéro, l'adresse ou le prix du client).
4. **Alerte Telegram de nouvelle commande** (la même qu'avant) : sous chaque article qui a un partenaire, une ligne `🤝 Partenaire : nom · téléphone — petit message`. Une commande sans article de partenaire donne **exactement le même message qu'avant** (prouvé par le test de la base).
5. **Admin › Produits** : une petite étiquette `🤝 nom` sur chaque article qui a un partenaire.

## Confidentialité (le point le plus important)
- Deux nouvelles tables, **`partners`** et **`product_partners`**, **réservées aux administrateurs** (sécurité par ligne). Un visiteur sans compte n'a **aucun droit** dessus ; un client connecté ne voit **aucune ligne**.
- Le lien article → partenaire **n'est pas une colonne de la table « products »** (qui est publique) : il ne voyage jamais avec les articles montrés aux clients. Les pages client (accueil, catégorie, fiche article), la facture et les e-mails ne le demandent jamais (le test navigateur vérifie qu'**aucune requête** n'est envoyée).
- Supprimer un partenaire retire seulement le lien de ses articles : **les articles ne sont jamais supprimés ni modifiés**. Supprimer un article retire son lien.

## Mise en service
1. Lancer **`add-partners.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance). Il crée les 2 tables et remplace la fonction d'alerte Telegram de commande (même message sans partenaire).
2. Publier le site (Netlify).
   **Tant que le script n'est pas lancé**, tout reste comme avant : « Mes partenaires » dit « lancez add-partners.sql », le formulaire d'article n'a pas la partie partenaire, les commandes n'ont aucune ligne de plus. Rien ne casse.

## Limites assumées
- Les articles **déjà commandés** avant la mise en service n'ont pas d'alerte Telegram rétroactive (mais la page Commandes montre le partenaire de l'article tel qu'il est associé **aujourd'hui**).
- Le partenaire montré sur une commande est celui **associé à l'article au moment où on ouvre la page** (pas une copie figée au moment de la commande). Si on change le partenaire d'un article, les anciennes commandes montrent le nouveau.
- Un article = un partenaire. Un partenaire = autant d'articles qu'on veut.

## Où est le code
- Base : `add-partners.sql` (tables, sécurité, alerte Telegram) ; test : `sh tests/sql/run-partners.sh` (41 contrôles : droits, sécurité par ligne, suppressions, message Telegram identique sans partenaire, ordre des articles, commandes bizarres, token absent).
- Règles pures : `src/lib/partners.ts` (test : `node --import ./tests/zara/register.mjs tests/email/partners.test.ts`, 34 contrôles) ; lecture / écriture : `src/lib/partnersData.ts`.
- Écrans : `src/screens/admin/AdminPartnersScreen.tsx`, `src/components/PartnerPicker.tsx`, `AdminProductFormScreen.tsx`, `AdminOrdersScreen.tsx`, `AdminProductsScreen.tsx` ; menu : `src/constants/adminMenu.ts` (thème Boutique).
- Test navigateur : partie `Ω` de `tests/zara/zara-ui.test.js` (fausse base complète : liste, ajout, modification, suppression en cascade, formulaire d'article, commandes, script SQL pas lancé, visiteur et client sans accès).
