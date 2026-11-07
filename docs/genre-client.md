# Homme / Femme : le genre des clients

Pour bien suivre l'analyse des clients, le site garde maintenant si chaque client est un **homme** ou une **femme**. Rien n'est deviné d'après le prénom : seul le choix du client (ou le vôtre) est gardé. Tant que personne n'a choisi : « Non précisé ».

## Comment le genre est rempli
- **Tous les clients** (7 novembre 2026) : le sexe n'est plus demandé à l'inscription. Il est demandé ensuite, dans le **petit sondage du site** (une carte sur l'accueil, `docs/sondage-client.md`) : « Pour mieux vous conseiller, vous êtes… » (Homme / Femme). Un geste. C'est la 1re question du sondage.
  - « Plus tard » ferme la carte ; elle revient 3 jours après, **trois fois au plus** (puis Zara ne demande plus). Le souvenir est sur le téléphone du client.
  - La carte n'est montrée ni à l'équipe, ni à un client qui a déjà tout répondu, et la question du sexe seulement quand le script SQL est lancé.
  - C'est une carte sur la page d'accueil, pas une fenêtre : elle ne gêne jamais la fenêtre « Télécharge l'app ».
- **Le client** peut changer à tout moment : Compte › Modifier mon profil › « Vous êtes ».
- **Vous (administrateur)** : Admin › Clients › le client › Identité › « Genre » (Homme / Femme, ou « Remettre non précisé »). Utile pour corriger.

## Ce que vous voyez dans Admin › Clients
- Une carte **« Analyse par genre »** : pour les hommes, les femmes et les « non précisé » : nombre de clients et part du total, combien ont commandé, nombre de commandes, **ventes** (commandes livrées, sans les fausses commandes) et **moyenne par client**. Elle dit aussi pour combien de clients le genre est connu. Les comptes test masqués ne comptent pas.
- Trois filtres : **👨 Hommes**, **👩 Femmes**, **❔ Genre non précisé**.
- Sur chaque ligne de client : « 👨 Homme », « 👩 Femme » ou « ❔ Genre non précisé ».

## Mise en service (dans cet ordre)
1. Lancer **`add-client-gender.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance). Il ajoute la colonne `profiles.gender` (`homme` / `femme` / vide) et la fonction `admin_set_client_gender` (réservée aux administrateurs : sans elle, l'administrateur ne pourrait pas modifier la ligne d'un autre client). Aucune nouvelle table, donc aucun `grant` de plus.
2. Publier le site.
Tant que le script n'est pas lancé, rien ne change pour personne : pas de carte, pas de choix dans le profil, pas de statistiques (le profil lu ne porte pas la clé `gender`). Le choix de l'inscription est enregistré dans une demande **à part** : une colonne absente ne fait jamais échouer une inscription.

## Vie privée
Le genre est ajouté à la liste des données de la politique de confidentialité (« nom, genre (homme ou femme), numéro… »). Il sert à l'analyse interne des clients ; il n'est jamais partagé.

## Tests
- Base : `sh tests/sql/run-client-gender.sh` (18 contrôles : le client choisit pour lui-même seulement, valeurs refusées hors homme / femme, l'administrateur passe par la fonction, l'anonyme n'a aucun accès, script rejouable).
- Règles : `node --import ./tests/zara/register.mjs tests/email/client-gender.test.ts` (35 contrôles : libellés, statistiques par genre, quand Zara demande, formulaire du profil).
- Navigateur : partie `%` de `tests/zara/zara-ui.test.js` (inscription courte, profil, sondage du site, Admin › Clients : carte, filtres, fiche).

## Voir aussi
La **date de naissance** et **Célibataire / Marié(e)** suivent le même modèle (obligatoires à l'inscription, modifiables dans le profil, visibles dans Admin › Clients) : voir `docs/naissance-situation-client.md`.
