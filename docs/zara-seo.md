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
- **Google Search Console** : propriété `https://www.albasseshopping.com/` **validée le 26 octobre 2026** par le fichier `public/google80a7957df67d5261.html` (**à ne jamais supprimer** : Google le revérifie pour garder le statut de propriétaire). Envoyer `sitemap.xml` dans le menu « Sitemaps ». Les premières statistiques arrivent en 2 à 3 jours.

## Étape 2 : « Zara SEO » (descriptions des articles) — prête, pas encore en ligne
Admin › **🔎 Zara SEO (Google)** (`/admin/zara-seo`). Environ 145 fiches sont sans description ou trop courtes (moins de 60 caractères).

**Comment ça marche**
1. L'écran affiche le bilan : articles en vente, sans description, trop courtes, correctes + les noms d'articles en double (à renommer par la boutique : Zara ne change jamais un nom).
2. Le bouton « Zara, prépare 8 descriptions » envoie 8 fiches à la fonction `zara-seo` (réservée aux administrateurs). Zara regarde la photo (Claude, vision) et **propose** un texte. Rien n'est écrit dans la base à cette étape.
3. L'administrateur lit, corrige si besoin, décoche les fiches qu'il ne veut pas, puis « Valider et publier ». Seulement alors la base reçoit les descriptions.
4. « Remettre l'ancienne » (liste « déjà écrites par Zara ») restaure l'ancienne description de l'article, à tout moment.

**Règles de Zara** (`supabase/functions/zara-seo/rules.ts`, testées) : 60 à 320 caractères ; ni prix, ni FCFA, ni promotion, ni livraison, ni stock, ni « original / authentique / garanti », ni « meilleur / n° 1 », ni avis ou étoiles, ni emoji, ni balises. Une proposition qui rompt une règle est remplacée par un texte « faits connus » (nom, catégorie, couleurs, tailles). Si la photo ne peut pas être lue, même repli : jamais de description inventée.

**Sécurité**
- La fonction `zara-seo` vérifie la connexion (JWT) **et** `profiles.is_admin`, puis ne fait que **lire** les articles.
- La publication passe par `zara_apply_seo` (script `add-zara-seo.sql`) : contrôle `is_admin()` dans la base, texte de 40 à 600 caractères, sans `<` ni `>`. Les visiteurs et les clients n'ont pas le droit de l'appeler.
- La toute première description d'origine est gardée dans `products.description_before_zara` (jamais écrasée par une 2ᵉ modification) ; `zara_undo_seo` la remet.
- Aucune nouvelle table (donc aucun `grant` de table à ajouter).
- Coût : environ 8 appels de vision par lot (quelques centimes). Le secret `ANTHROPIC_API_KEY` existe déjà (utilisé par `zara-ai`).

**Fichiers**
| Élément | Fichier |
| --- | --- |
| Règles et choix du texte (testés) | `supabase/functions/zara-seo/rules.ts` |
| Fonction serveur (propose, n'écrit rien) | `supabase/functions/zara-seo/index.ts` |
| Colonnes + `zara_apply_seo` + `zara_undo_seo` | `add-zara-seo.sql` |
| Calculs de l'écran (purs) | `src/lib/zaraSeoCore.ts` |
| Appels fonction et base | `src/lib/zaraSeo.ts` |
| Écran | `src/components/ZaraSeoPanel.tsx`, `src/screens/admin/AdminZaraSeoScreen.tsx` |
| Tests | `tests/seo/zara-seo.test.ts` (63), `tests/sql/run-zara-seo.sh` (base locale), partie 9 de `tests/zara/zara-ui.test.js` (22, navigateur) |

**Mise en service** (après accord du patron) : lancer `add-zara-seo.sql` dans Supabase › SQL Editor ; déployer la fonction `zara-seo` (JWT obligatoire) ; publier le site ; ouvrir Admin › Zara SEO.
**Pour tout annuler** : `update products set description = coalesce(description_before_zara, ''), description_before_zara = null, description_zara_at = null where description_zara_at is not null;` (aussi en commentaire dans le script).

## Étape suivante (non commencée)
- Étape 3 : rapport SEO dans le rapport du lundi (mots cherchés sans résultat, fiches à améliorer), Google Search Console.
