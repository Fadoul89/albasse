# Vrais chiffres des visites et « vraies visites »

## Le problème trouvé
Le 31 octobre 2026, le tableau de bord affichait « 900 visiteurs aujourd'hui » et ne bougeait plus depuis une heure, alors qu'il y en avait **1 618**.
Cause : la base ne renvoie que **1 000 lignes par demande**, et le tableau de bord relisait les visites une par une. Au-delà de 1 000 visites dans la période, il s'arrêtait trop tôt.
Les mêmes lectures limitées faussaient aussi les statistiques de chaque client dans Admin › Clients (visites, temps passé, articles vus, ajouts).
Autre erreur trouvée en passant : « Produits les plus consultés » lisait une colonne qui n'existe pas (`product_views.created_at`, la vraie s'appelle `viewed_at`) : la liste restait vide.

## Ce qui change
Deux fonctions de la base **comptent elles-mêmes** (exact, quelle que soit la taille), réservées aux administrateurs :
- `admin_visit_overview(depuis, jusqu'à)` : visites, visiteurs, vraies visites, détail par source et par campagne, articles les plus vus.
- `admin_customer_activity()` : pour chaque client connecté, ses visites, son temps passé, ses articles vus, ses ajouts et sa source principale.

Le tableau de bord et Admin › Clients lisent ces comptes. La liste des clients et celle des commandes sont aussi lues **page par page** (1 000 lignes à la fois), pour ne perdre personne quand il y aura plus de 1 000 clients.

## « Vraie visite »
Une visite compte comme **vraie** si la personne : reste **20 secondes ou plus**, **ou** voit **2 pages ou plus**, **ou** est **connectée**.
Les clics qui repartent tout de suite (clic par erreur, pub mal ciblée) restent dans « Visites », mais pas dans « Vraies visites ».
Même règle dans le script SQL (`add-visit-stats.sql`) et dans le site (`src/lib/visitStats.ts`).

## Ce que vous voyez sur le tableau de bord
- **Visiteurs aujourd'hui** : le vrai nombre.
- **Vraies visites aujourd'hui** : combien sont de vraies visites, avec une phrase qui explique la règle (« 5 sur 1638 (<1 %) »).
- **Qualité des visites (aujourd'hui)** : pour chaque source (Publicité / campagne, Accès direct, Facebook, TikTok…) : visiteurs, vrais visiteurs et part. En dessous, **chaque campagne payante** (le numéro est celui du Gestionnaire de publicités de Meta) avec ses visites et ses vraies visites.
- **Performance par source (résumé)** et **Produits les plus consultés** : maintenant exacts (30 derniers jours).
- Admin › Clients : visites, temps passé et articles vus de chaque client, exacts.
Une part inférieure à 1 % s'écrit « <1 % » (jamais « 0 % » quand il y a au moins une vraie visite).

## Mise en service (dans cet ordre)
1. Lancer **`add-visit-stats.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance ; aucune table créée, rien n'est modifié ni supprimé : seulement deux fonctions de lecture).
2. Publier le site.

Tant que le script n'est pas lancé, le site garde son **ancien calcul** (sans « Vraies visites » ni « Qualité des visites »), avec la bonne colonne `viewed_at` : rien ne casse.

## Page « Performance par source » (étape suivante : `add-source-report.sql`)
Cette page (Admin › Rapports › Performance par source, avec le choix de la période) lisait aussi les visites une par une : sur 7 jours (plus de 10 000 visites) ou 30 jours, ses chiffres ne portaient que sur 1 000 visites, et les articles vus et les paniers restaient à zéro (des milliers d'identifiants dans une seule adresse faisaient échouer la demande).
Maintenant une fonction de la base, **`admin_source_report(depuis, jusqu'à)`** (réservée aux administrateurs), compte tout elle-même avec **les mêmes règles qu'avant** :
- visiteur = `visitor_id`, sinon le compte connecté, sinon la visite elle-même ; source vide = « Autre » ;
- **nouveau** = sa toute première visite (depuis toujours) tombe dans la période ; **revenant** = les autres ;
- temps moyen = temps total / visites ; pages vues = total des pages ;
- articles vus et paniers = ceux des visites de la période ; commandes et chiffre d'affaires = seulement les commandes **livrées** et non fausses, créées dans la période ; conversion = commandes / visiteurs ;
- campagnes (`utm_campaign`) : visiteurs, commandes, chiffre d'affaires, triées par chiffre d'affaires puis par visiteurs.
Nouveau : **vrais visiteurs** (même règle que le tableau de bord) pour chaque source et chaque campagne, une ligne « Sur la période : visites · visiteurs · vrais visiteurs », et une colonne « Vrais » dans le tableau comparatif. Les bornes de la période sont comprises.
Tant que ce script n'est pas lancé, la page garde son **ancien calcul** (sans les « vrais visiteurs »).

## Mise en service de cette étape
1. Lancer **`add-source-report.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance ; aucune table créée, une seule fonction de lecture).
2. Publier le site.

## Tests
- Base locale jetable : `sh tests/sql/run-visit-stats.sh` et `sh tests/sql/run-source-report.sh` (période du 10 au 16 octobre, bornes comprises, 1 500 visites de plus que la limite, nouveaux / revenants, commandes livrées seulement, vraies visites, campagnes, accès réservé) (1 500 visites en plus de la limite, vraies visites, sources, campagnes, articles les plus vus, commandes livrées seulement, accès réservé aux administrateurs, relance sans erreur).
- Logique du site : `node --import ./tests/zara/register.mjs tests/email/visit-stats.test.ts` et `tests/email/source-report.test.ts` (lecture du rapport, classement automatique).
- Navigateur : `PARTS=& SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333` (fausse base : tableau de bord avec et sans le script SQL, Admin › Clients, plus de 1 000 clients, Performance par source avec et sans le script SQL, changement de période).
