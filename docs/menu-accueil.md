# Menu ☰ de l'accueil (comme Jumia)

Demande du patron (15 novembre 2026) : « Un menu comme Jumia : le profil du client et à l'intérieur ses points, puis les catégories une à une. »

## Ce que voit le client
- Sur l'**accueil**, en haut à gauche : le bouton **☰** (trois traits), à côté du choix de langue.
- Il touche ☰ : un panneau glisse depuis la gauche (le reste de la page s'assombrit).
  1. **« 👤 Profil client »** : sa photo (ou l'initiale de son nom), son nom, son **numéro client** (AS-000883), puis **ses points** à l'intérieur : palier (🥉 Bronze, 🥈 Argent, 🥇 Or, 💎 Platine, 👑 Diamond), nombre de points, barre vers le prochain palier et « 23 pts avant le palier 🥇 Or ». Toucher la carte ouvre **Mon compte**.
  2. **« 🗂️ Catégories »** : **une ligne par catégorie**, avec sa photo, dans l'**ordre choisi dans l'administration** ; toucher une ligne ouvre la page de la catégorie et ferme le menu. Les sous-catégories restent dans la page de leur catégorie.
- Pour fermer : **✕**, ou toucher à côté du panneau, ou la touche retour du téléphone.
- Un visiteur sans compte voit **« Se connecter »** et **« Créer un compte »** à la place du profil (aucun faux point).

## Vrai, jamais inventé
- Les points sont ceux du compte (`profiles.loyalty_points` : 1 point par tranche de 5 000 FCFA d'une commande **livrée**, voir `add-loyalty-points.sql`). Le menu ne les calcule pas, il les lit.
- Le numéro client n'apparaît que si le compte en a un.
- Les catégories sont celles de la boutique : une nouvelle catégorie apparaît toute seule.

## Code
- `src/lib/sideMenu.ts` (ce que le menu montre, sans réseau), `src/components/SideMenu.tsx` (le bouton `MenuButton` et le panneau), branché dans `src/screens/HomeScreen.tsx`.
- Aucun SQL, aucune nouvelle table.

## Tests
- `tests/email/side-menu.test.ts` (16 contrôles : paliers, barre, « 0 pt », points invalides, catégories dans l'ordre, sous-catégories écartées).
- Navigateur : partie `C` de `tests/zara/zara-ui.test.js` (bouton, profil + points, 19 catégories une à une, ✕, toucher à côté, ouvrir une catégorie, visiteur).

## Menu ☰ aussi sur Recherche et sur les pages de catégorie (15 novembre 2026, « Oui »)
- **Recherche** : le bouton ☰ est à gauche du titre. **Pages de catégorie** : à droite de l'en-tête (à côté de ← et 🏠). Même panneau : profil + points, puis les catégories une à une.
- `MenuLauncher` (`src/components/SideMenu.tsx`) : les catégories ne sont lues qu'à l'**ouverture** du menu (aucune lecture de plus tant que le client ne touche pas ☰).

## Nom du titulaire sur les cartes de paiement
- Sous le numéro, une ligne **« Nom : … »** n'apparaît que si un nom est enregistré. Sans nom : aucune ligne, jamais de nom inventé.
- Le patron écrit lui-même les noms dans **Admin › Moyens de paiement** (champ « Nom du titulaire » sous Airtel et sous Moov). Ces champs n'apparaissent qu'**après** le script `add-payment-holder-names.sql` (2 colonnes ajoutées à `payment_settings`, aucune nouvelle table, aucun `grant` à ajouter) : tant que le script n'est pas lancé, rien ne change et l'enregistrement ne peut pas échouer.
- Tests : `tests/email/payment-cards.test.ts` (23) et la partie `C` du navigateur (cartes avec nom, champs de l'administration avec et sans les colonnes).

## Boutons qui vibrent (fiche article) — 15 novembre 2026
- Les deux boutons de la fiche article, **« Commander sur WhatsApp »** et **« Commander »**, tremblent environ **une demi-seconde toutes les 3 secondes** (3 pixels au plus, le second bouton avec 0,3 s de retard), puis se reposent.
- Seulement un mouvement à l'écran : le téléphone ne vibre pas. La taille et la place des boutons ne changent pas, et ils marchent comme avant.
- Pas de mouvement pour les clients qui ont demandé « moins d'animations » (réglage du téléphone ou du navigateur).
- Code : `src/components/VibrateView.tsx`, branché dans `src/screens/ProductScreen.tsx`. Tests : partie `C` de `tests/zara/zara-ui.test.js` (les deux boutons vibrent, taille inchangée, « Commander » ouvre toujours la commande, « moins d'animations » = aucun mouvement).
