# Photos des articles protégées

Sur le site, les visiteurs ne peuvent plus enregistrer les **photos de vos articles** par les moyens simples :
- **clic droit** (ordinateur) et **appui long** (téléphone) sur une photo : le menu « Enregistrer l'image » / « Rechercher avec Google Lens » ne s'ouvre pas ;
- **glisser-déposer** d'une photo hors de la page : bloqué.

## Quelles photos
Seulement celles rangées dans l'espace de stockage `product-images` (là où l'administration enregistre les photos) : les photos des **articles**, et aussi celles des **catégories** et des **pubs des côtés**, rangées au même endroit. Tout le reste du site est normal : photos de profil des clients, logo, Zara, icônes, textes (qui restent sélectionnables et copiables).

Le code est dans `public/index.html` (une petite règle de style et un petit script, appliqués à tout le site, y compris aux futures photos). Il n'y a rien à régler.

## Ce que ça ne peut pas empêcher
- Une **capture d'écran** reste toujours possible (aucun site web ne peut l'empêcher).
- Un visiteur qui connaît les outils de son navigateur peut encore retrouver l'adresse d'une image.
Cette protection **décourage la copie facile** ; elle ne l'interdit pas à 100 %. Pour aller plus loin : un **filigrane** (le logo « Albasse Shopping » incrusté sur chaque photo) rend les photos copiées reconnaissables.

## Google
Aucun effet sur le référencement : Google continue de voir et d'afficher vos photos (Google Images, fiches articles).

## Test
Partie `=` de `tests/zara/zara-ui.test.js` (navigateur) : sur la fiche article, l'accueil et une catégorie, le menu est bloqué sur chaque photo d'article ; les autres images et le texte ne sont pas touchés.
