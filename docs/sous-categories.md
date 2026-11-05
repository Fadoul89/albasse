# Sous-catégories

Demande du patron (5 novembre 2026) : *« Possibilité de créer sous catégorie »*.

Une **sous-catégorie** est une catégorie qui a une **catégorie principale** : par exemple « Vêtements » › « Chemises », « Costumes ».
**Un seul niveau** : une sous-catégorie n'a pas de sous-catégorie.

## Pour l'administrateur (Admin › Catégories)

- Sous chaque catégorie principale : le bouton **« ＋ Sous-catégorie »**. Le formulaire s'ouvre sur « Nouvelle sous-catégorie de « Vêtements » » : écrire le nom, **Ajouter**.
- Le formulaire a aussi un choix **« Catégorie principale »** : « Aucune (catégorie principale) » ou l'une des catégories principales. Une catégorie qui a déjà des sous-catégories reste principale (le choix est remplacé par une petite explication).
- La liste est un arbre : chaque catégorie principale, puis ses sous-catégories (« ↳ », décalées, avec « Sous-catégorie de … »).
- **▲ ▼** déplacent une catégorie parmi ses « sœurs » : les principales entre elles, les sous-catégories d'une même catégorie entre elles.
- **Supprimer** une catégorie principale : ses sous-catégories deviennent des catégories principales (leurs articles restent classés). Les articles rangés **directement** dans la catégorie supprimée n'ont plus de catégorie (comme avant). Le message de confirmation le dit.
- **Formulaire d'un article** : la catégorie se choisit parmi les catégories principales **et** les sous-catégories (« ↳ Chemises » sous « Vêtements »). L'article est rangé dans celle qu'on touche. La liste « Produits » a le même filtre ; une catégorie principale montre aussi les articles de ses sous-catégories.
- **Promotions intelligentes** : le choix d'une catégorie montre aussi les sous-catégories.
- **Affiliés** : une sous-catégorie sans taux de commission à elle prend le taux de sa catégorie principale (puis le taux global). Rien ne change pour les catégories d'aujourd'hui.

## Pour le client

- **Accueil** : la ligne des catégories et les sections ne montrent que les catégories **principales**. Les articles d'une sous-catégorie comptent dans la section de leur catégorie principale (« Vêtements · 7 articles », 4 montrés, « Voir les 3 autres articles »).
- **Page d'une catégorie principale** : tous ses articles **et** ceux de ses sous-catégories, avec de petites puces « **Tout** · Chemises · Costumes ». Toucher une puce ouvre la sous-catégorie (adresse `/categorie/<adresse-de-la-sous-categorie>`, seulement ses articles) ; « Tout » revient.
- **Page d'une sous-catégorie** : seulement ses articles, avec les mêmes puces pour changer ou revenir.
- Les sous-catégories sont de vraies pages : elles sont dans le plan du site (`sitemap.xml`) et lisibles par Google ; la page d'une catégorie principale liste aussi les articles de ses sous-catégories.

## Pour Zara et les annonces

- **Zara** range chaque article dans sa catégorie **principale** (ses boutons de catégories, ses conseils et ses recherches par catégorie marchent comme avant). Le nom de la sous-catégorie sert seulement à **retrouver** l'article (« chemises » trouve un article rangé dans « Chemises »). L'IA de Zara (fonction `zara-ai`) voit « Vêtements › Chemises ».
- **Annonces de Zara** : une sous-catégorie prend le **public** de sa catégorie principale (une sous-catégorie de « Vêtements pour femmes » n'est jamais montrée à un homme) et la règle **« Vitalité & Énergie »** (une sous-catégorie de « Vitalité & Énergie Homme » est cachée sauf aux mariés de 32 ans et plus). « Catégorie explorée » compte toute la famille.
- **Suivi de navigation** : l'article d'une sous-catégorie compte pour sa catégorie principale.

## Script SQL : `add-subcategories.sql`

Sans danger à relancer. Il ajoute **une colonne** `parent_id` sur `categories` (vide pour toutes les catégories d'aujourd'hui), un index et un garde-fou : « un seul niveau », jamais sa propre sous-catégorie. **Aucune catégorie ni aucun article n'est modifié.** Pas de nouvelle table : les droits (lecture pour tous, écriture pour l'administrateur) sont ceux d'aujourd'hui.

**Avant le script** : tout le site marche comme avant (toutes les catégories sont principales). Dans Admin › Catégories, une phrase explique « lancez d'abord le script add-subcategories.sql » et les boutons « ＋ Sous-catégorie » sont cachés.

Test sur un Postgres local jetable (jamais la vraie base) : `sh tests/sql/run-subcategories.sh`.

## Où est le code

- `src/lib/subCategories.ts` : les règles (pures, sans réseau). Test : `node --import ./tests/zara/register.mjs tests/email/sub-categories.test.ts`.
- `src/hooks/useCategories.ts` : `categories` (toutes), `mainCategories` (principales), `rootIdOf`.
- Écrans : `AdminCategoriesScreen`, `AdminProductFormScreen`, `AdminProductsScreen`, `AdminPromotionsScreen`, `HomeScreen`, `CategoryScreen`.
- Zara : `src/lib/assistantData.ts`, `src/lib/assistantBrain.ts`, `supabase/functions/zara-ai/index.ts` (à redéployer). Annonces : `src/lib/adTargeting.ts`, `src/lib/adSensitive.ts`.
- Google : `netlify/edge-functions/og-preview.ts`.
- Test dans le navigateur : `PARTS='$' SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333`.
