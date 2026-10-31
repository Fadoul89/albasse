# Photos protégées

Sur le site, les visiteurs ne peuvent plus enregistrer les photos par les moyens simples :
- **clic droit** (ordinateur) et **appui long** (téléphone) sur une photo : le menu « Enregistrer l'image » / « Rechercher avec Google Lens » ne s'ouvre pas ;
- **glisser-déposer** d'une photo hors de la page : bloqué ;
- les textes restent sélectionnables et copiables comme avant.

Le code est dans `public/index.html` (une petite règle de style et un petit script, appliqués à tout le site). Il n'y a rien à régler.

## Ce que ça ne peut pas empêcher
- Une **capture d'écran** reste toujours possible (aucun site web ne peut l'empêcher).
- Un visiteur qui connaît les outils de son navigateur peut encore retrouver l'adresse d'une image.
Cette protection **décourage la copie facile** ; elle ne l'interdit pas à 100 %. Pour aller plus loin : un **filigrane** (le logo « Albasse Shopping » incrusté sur chaque photo) rend les photos copiées reconnaissables.

## Google
Aucun effet sur le référencement : Google continue de voir et d'afficher vos photos (Google Images, fiches articles).

## Test
Partie `=` de `tests/zara/zara-ui.test.js` (navigateur) : menu bloqué sur une photo, glisser bloqué, texte inchangé.
