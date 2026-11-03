# Date de naissance et Célibataire / Marié(e) : à la création du compte

Quand un client crée son compte, il doit maintenant écrire sa **date de naissance** et choisir **Célibataire** ou **Marié(e)**. Sans les deux, le compte n'est pas créé et un message dit quoi corriger. Rien n'est deviné : seul ce que le client écrit lui-même est gardé.

## Ce que voit le client
Sur « Créer un compte » (page Inscription, et en premier sur l'écran d'entrée quand le compte est obligatoire), dans la partie **Informations obligatoires**, dans cet ordre :
1. Nom et prénom
2. Vous êtes * (Homme / Femme)
3. **🎂 Date de naissance *** : un champ où l'on tape les chiffres, les barres arrivent toutes seules (`25031998` devient `25/03/1998`). Exemple affiché dans le champ.
4. **💍 Situation *** : deux gros boutons, **🙋 Célibataire** et **💍 Marié(e)** (un seul peut être choisi).
5. Téléphone, mot de passe

Messages si quelque chose ne va pas (aucun compte n'est créé) :
- Date vide : « Date de naissance manquante — Merci d'écrire votre date de naissance (jour / mois / année). »
- Date mal écrite : « Écrivez-la ainsi : 25/03/1998 (jour / mois / année). »
- Date qui n'existe pas (31/02/1998, 29/02/1999…) : « Cette date n'existe pas. »
- Date dans le futur : « La date de naissance ne peut pas être dans le futur. »
- Âge qui ressemble à une faute de frappe (moins de 10 ans ou plus de 110 ans) : « Cette date donne un âge de N ans. Merci de vérifier le jour, le mois et l'année. » (c'est un contrôle de faute de frappe, pas une règle sur qui peut s'inscrire)
- Situation non choisie : « Merci de choisir Célibataire ou Marié(e). »

## Les clients déjà inscrits
Ils ne sont **pas bloqués** : rien ne change pour eux tant qu'ils ne le décident pas. Ils peuvent remplir les deux réponses dans **Compte › Modifier mon profil** (🎂 Date de naissance, 💍 Situation). Une fois la date enregistrée, elle ne peut plus être effacée (elle est obligatoire depuis l'inscription), seulement corrigée.

Pas de carte de Zara pour l'instant (contrairement au genre). Si vous voulez que Zara leur pose la question une fois sur l'accueil, c'est une petite suite à demander.

Les comptes créés **sans formulaire** (Google, ou « commande sans compte » dont le compte est créé à la confirmation) n'ont pas ces deux réponses : « Non précisée » / « Non précisé », jusqu'à ce que le client les remplisse dans son profil.

## Ce que vous voyez (Admin › Clients)
- **Sur chaque ligne** de client : `🎂 25/03/1998 · 28 ans · 💍 Marié(e)` (ou `🎂 Non précisée · ❔ Non précisé`). L'âge est calculé avec la date du jour, à N'Djamena.
- **Sur la fiche du client** (rubrique Identité) : « Date de naissance » (avec l'âge) et « Situation ».
- Pas de modification par l'administrateur pour l'instant (le client corrige lui-même dans son profil). Pas de statistiques ni de filtres : à demander si vous en voulez (âge moyen, mariés / célibataires…).

## Mise en service (dans cet ordre)
1. Lancer **`add-client-birth-marital.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance). Il ajoute à `profiles` :
   - `birth_date` (date) : pas avant 1900, pas dans le futur ;
   - `marital_status` (texte) : seulement `celibataire` ou `marie` (ou vide) ;
   - un petit déclencheur qui refuse une date dans le futur.
   Aucune nouvelle table, donc aucun `grant` de plus (les colonnes ont le même accès que le reste de `profiles` : le client lit et modifie sa propre ligne, l'administrateur lit tout ; la protection des colonnes sensibles de `fix-profile-security.sql` n'est pas touchée).
2. **Publier le site.**

À faire AVANT de publier : si le site est publié sans le script, le formulaire demande bien les deux réponses mais la base ne peut pas les garder (elles seraient perdues). L'inscription, elle, réussit toujours : les deux réponses sont enregistrées dans une demande **à part** (comme le genre), et une colonne absente ne fait jamais échouer une inscription. Tant que le script n'est pas lancé, rien ne s'affiche dans le profil ni dans Admin › Clients.

## Vie privée
La politique de confidentialité liste maintenant « votre nom, votre genre (homme ou femme), **votre date de naissance, votre situation (célibataire ou marié)**, numéro de téléphone… ». Ces réponses servent à l'analyse interne des clients ; elles ne sont jamais partagées.

## Tests
- Règles (lecture de la date, âge, messages, inscription, formulaire du profil) : `node --import ./tests/zara/register.mjs tests/email/client-birth-marital.test.ts` (53 contrôles).
- Base : `sh tests/sql/run-client-birth-marital.sh` (27 contrôles, sur un Postgres local jetable : valeurs refusées, date dans le futur refusée, le client écrit seulement sa propre ligne, l'anonyme n'a rien, script rejouable, protection des colonnes sensibles toujours active).
- Navigateur : partie `%` de `tests/zara/zara-ui.test.js` (sections 5 à 8 : inscription obligatoire avec tous les messages, colonnes absentes, profil, Admin › Clients ligne et fiche, confidentialité).
