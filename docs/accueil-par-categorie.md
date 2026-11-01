# Accueil : 4 articles par catégorie

Avant, la page d'accueil affichait **tous** les articles dans une seule grille (« Toute la collection »), des centaines d'articles à la suite.

Maintenant, sous les catégories, la publicité, la vente flash, les promotions et la saison fraîche, l'accueil montre **une section par catégorie** :

- le nom de la catégorie et son nombre d'articles (« Chaussures · 79 articles ») ; toucher le titre ouvre la catégorie ;
- **4 articles** (2 lignes de 2 sur téléphone, 1 ligne de 4 sur ordinateur) ;
- un bouton **« Voir les 75 autres articles → »** qui ouvre la catégorie avec tous ses articles (il n'apparaît que s'il en reste) ;
- en bas de la page, **« Voir tous les articles (N) »** : le catalogue complet.

## Règles

- Les catégories sont dans l'ordre choisi par l'administrateur (Admin › Catégories, flèches ▲ ▼).
- Une catégorie sans article en vente n'a pas de section.
- Un article retiré de la vente (`is_active = false`) n'est ni montré ni compté.
- Les 4 articles sont les plus récents **qui sont en stock** : un article épuisé ne prend pas une des 4 places tant qu'il y en a d'autres. Il reste visible dans la catégorie.
- Un article dont la catégorie n'existe plus n'apparaît pas dans une section, mais reste dans « Voir tous les articles ».
- Rien ne change dans la base : c'est seulement la façon d'afficher la page (aucun script SQL).

## Où est le code

- `src/lib/homeSections.ts` : le calcul (pur, sans réseau). Test : `node --import ./tests/zara/register.mjs tests/email/home-sections.test.ts`.
- `src/screens/HomeScreen.tsx` : l'affichage (`testID` : `home-sections`, `home-section-<slug>`, `home-section-title-<slug>`, `home-more-<slug>`, `home-all-articles`).
- Test dans le navigateur : `PARTS=@ SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333`.

Pour changer le nombre d'articles par catégorie : `HOME_PER_CATEGORY` dans `src/lib/homeSections.ts`.
