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

## Menu « verre courbé » (16 novembre 2026, « Le menu à côté je veux comme ça »)
Le même menu ☰, dans le style de la vidéo « Curved Sidebar ». Seul le menu change : le reste du site garde ses couleurs bleu et or.
- **Le panneau** : du verre dépoli (le site se voit flou derrière) aux bords gauche et droit légèrement creusés, avec un fin liseré blanc,
  posé à gauche avec une petite marge. Il arrive en glissant un peu. Le site reste visible à droite ; toucher à côté ferme le menu.
- **En haut** : 💎 ALBASSE et le bouton pour fermer (|←, en haut à droite du panneau).
- **Le profil** (client connecté) : sa photo avec un point vert, son nom, son numéro client et son palier (🥉 Bronze…), ses points et la barre
  « … pts avant le palier … ». Toucher le profil ouvre **Mon compte**. Un visiteur voit toujours « Se connecter » / « Créer un compte ».
- **CATÉGORIES** : une ligne par catégorie principale, dans l'ordre de l'administration. Toucher le **nom** ouvre toujours la page de la catégorie.
  Une catégorie qui a des sous-catégories a une petite flèche : elle les montre **en arbre** (« Tout voir » puis chaque sous-catégorie), une seule
  catégorie ouverte à la fois. Sur la page d'une catégorie ou d'une sous-catégorie, le menu s'ouvre sur elle et la met en avant (verre blanc).
- **« À la une »** : une carte seulement pendant un **vrai moment fort** de l'année, aux mêmes dates que Zara (`lib/assistantOccasions.ts`) :
  Black Friday (21 jours avant), Tabaski, Ramadan, Korité, Saint-Valentin. Elle ouvre Zara sur les promotions réelles. Hors de ces périodes : pas de carte.
- **En bas** (client connecté) : **Mon compte** et **Se déconnecter**.
- Code : `src/components/SideMenu.tsx`, `src/components/CurvedGlass.tsx` (le verre courbé, effet web ; hors web un panneau clair arrondi),
  `src/lib/sideMenu.ts` (`menuSubs`, `menuActive`, `menuHighlight`). Aucun SQL.
- Tests : `tests/email/side-menu.test.ts` (28) ; navigateur `tests/shop/side-menu-glass-ui.test.js` (vraies catégories, compte simulé,
  dates fixées au 16 novembre et au 15 décembre 2026) ; partie `C` de `tests/zara/zara-ui.test.js`.

## Publicité mouvementée dans le menu (16 novembre 2026, « Possibilité de mettre publicité personnalisée ici » puis « Publicité mouvementée »)
- **Où la choisir** : Admin › Promotions intelligentes › **« 📣 Publicité du menu ☰ »** : ajouter des images (format conseillé : paysage,
  environ 1 200 × 700) et le lien de chacune (un article, une catégorie, WhatsApp…), puis « Enregistrer la publicité du menu ». 12 images au plus.
- **Dans le menu** : la publicité remplace la carte « À la une ». Une nouvelle image toutes les **5 secondes** : elle glisse depuis la droite,
  avec un **zoom lent**, un **reflet de lumière** qui passe, une **barre dorée** qui se remplit et des points qui disent quelle image est montrée.
  « PUB » en haut à gauche ; « Voir › » fait un petit saut quand l'image a un lien. Après la dernière image, la première revient sans saut.
- **Liens** : un article ou une catégorie du site s'ouvre dans le site (le menu se ferme) ; une autre page du site à sa place ;
  WhatsApp ou un autre site s'ouvre à part. Une image sans lien n'est pas cliquable.
- **« Moins d'animations »** (réglage du téléphone ou du navigateur) : ni zoom, ni reflet, ni saut ; les images changent sans glisser.
- **Sans image choisie** : la carte automatique « À la une » (Black Friday, Tabaski… à leurs dates), sinon rien.
- **Installation (une fois)** : `add-menu-ad.sql` dans Supabase › SQL Editor : **une colonne** `store_settings.menu_ad_items` (liste, 12 au plus),
  aucune nouvelle table, mêmes droits que les autres réglages. Avant le script : rien ne change, l'admin dit de lancer le script, et les
  publicités de l'accueil s'enregistrent comme avant.
- Code : `src/components/MenuAdCard.tsx`, `src/lib/menuAd.ts`, branchés dans `src/components/SideMenu.tsx` et `src/screens/admin/AdminPromotionsScreen.tsx`.
- Tests : `tests/email/menu-ad.test.ts` (14), `sh tests/sql/run-menu-ad.sh` (8, Postgres local jetable), navigateur `tests/shop/menu-ad-ui.test.js`.
