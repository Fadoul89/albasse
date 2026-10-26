# Zara SEO : référencement du site (Google) — étape 1 « réparer ce que Google voit »

## Ce que ça fait (en simple)
1. **Google reçoit une vraie page** pour l'**accueil**, chaque **fiche produit** et chaque **catégorie** : titre, description, photo, adresse officielle (canonical), liens vers les autres pages, et des **données structurées** (prix en FCFA, disponibilité « en stock / épuisé », fil d'Ariane, liste d'articles). Les visiteurs normaux ne voient rien de différent : ils reçoivent l'application comme avant.
2. **Titres** : `Montre KEEP MOVING – 11 000 FCFA | Albasse Shopping` (62 caractères au plus quand c'est possible). **Descriptions** : une seule ligne de 160 caractères au plus, avec le prix et « Livraison au Tchad » ; une fiche sans description reçoit une phrase de secours avec des faits connus seulement (nom, catégorie, prix).
3. **Plan du site** (`/sitemap.xml`) et **`robots.txt`** refaits à chaque demande à partir de la base : un nouvel article apparaît tout de suite, un article désactivé disparaît. Le plan contient aussi la photo de chaque article (recherche d'images). Si la base ne répond pas, le fichier fabriqué à la mise en ligne est servi (jamais de plan vide).
4. **Adresses qui n'existent plus** (article supprimé ou désactivé, catégorie inconnue) : réponse **404** pour Google, avec `noindex` : l'adresse sort de l'index au lieu de rester comme fausse page.
5. **Pages privées cachées à Google** (`robots.txt`) : administration, connexion, inscription, commande, facture, compte, messages, favoris, notifications, espace affilié, désinscription, roue de la chance.
6. **Page d'accueil statique** (`public/index.html`) : description et aperçu par défaut (réseaux sociaux), sans adresse canonique (la même page sert toutes les adresses).

## Ce qui n'est PAS fait exprès
- **Aucune note ni avis** dans les données structurées : les avis du site peuvent être de démonstration, et Google interdit les faux avis.
- Aucune information inventée : on n'écrit que le nom, la catégorie, le prix, le stock et la description saisie par la boutique.
- Pas de génération statique d'Expo : elle n'existe que pour Expo Router (ce site utilise une autre navigation). On garde donc le système « page lisible pour les robots » déjà en place (fonctions Netlify).

## Fichiers
| Élément | Fichier |
| --- | --- |
| Textes, données structurées, pages pour Google, plan du site, robots.txt (testés) | `netlify/edge-functions/lib/seo.ts` |
| Page vue par Google : accueil, produit, catégorie (+ 404) | `netlify/edge-functions/og-preview.ts` |
| `/sitemap.xml` et `/robots.txt` dynamiques | `netlify/edge-functions/sitemap.ts` |
| Branchement | `netlify.toml` (blocs `[[edge_functions]]`) |
| Fichiers de secours fabriqués à la mise en ligne | `scripts/generate-sitemap.js` |
| Description et aperçu par défaut | `public/index.html` |
| Tests (70 vérifications, faux Netlify + fausse base, aucun réseau) | `tests/seo/seo.test.ts` |

Lancer le test : `node --import ./tests/zara/register.mjs tests/seo/seo.test.ts`

## Robots reconnus
Googlebot, Google-InspectionTool (test d'adresse de Search Console), Bing, DuckDuckGo, Yandex, Apple, Baidu, et les aperçus Facebook, WhatsApp, TikTok, Telegram, LinkedIn, Slack, Discord, Pinterest, Twitter.

## Sécurité
- Les visiteurs normaux reçoivent **exactement la même page qu'avant** (aucun en-tête ajouté, aucune requête à la base).
- Les deux fonctions ont un **filet de sécurité** : au moindre problème imprévu (base coupée, erreur), tout le monde reçoit la page normale du site, jamais une erreur. Pour le plan du site, c'est le fichier fabriqué à la mise en ligne.
- **Pour tout annuler** : retirer les blocs `/` et `/sitemap.xml` et `/robots.txt` de `netlify.toml` (ou annuler la publication de ce changement sur GitHub) : le site redevient comme avant.

## À savoir
- **Compte obligatoire à l'entrée** (réglage « Clients » de l'administration) : un visiteur qui arrive depuis Google doit d'abord se connecter ou créer un compte avant de voir le produit. Google voit la fiche, mais le visiteur est freiné : c'est un choix de la boutique, non modifié ici. Mesurable plus tard avec Google Search Console.
- Le SEO agit en **semaines**, pas en jours : Google doit revenir lire les pages.
- **Google Search Console** (gratuit) n'est pas encore connecté : c'est la prochaine étape utile pour voir les vraies recherches. Ajouter le site, ajouter l'adresse du plan `https://www.albasseshopping.com/sitemap.xml`.

## Étapes suivantes (non commencées)
- Étape 2 : Zara propose titre et description des fiches sans description (50) ou trop courtes (95), l'administrateur valide avant publication.
- Étape 3 : rapport SEO dans le rapport du lundi (mots cherchés sans résultat, fiches à améliorer), Google Search Console.
