# Gestion de compte côté équipe (Admin › Clients › fiche du client › « 🛠️ Gérer le compte »)

Demande du patron (8 novembre 2026) : *« Je veux une gestion de compte complète »*. Choix du patron : **côté équipe d'abord** (le côté client viendra ensuite : changer son numéro, supprimer son compte).

## Ce qui existait déjà (inchangé)
- **Bannir / réactiver** un client, avec le motif et l'**historique des sanctions**.
- **Mot de passe oublié › Donner un nouveau code** (docs/recuperer-compte.md), envoyer un message, voir l'activité et les commandes.

## Ce que la fiche permet maintenant
Un bloc **« 🛠️ Gérer le compte »** en haut de la fiche. Il dit **comment le client se connecte** (par numéro de téléphone, par e-mail, ou compte fermé), combien de commandes il a et son **numéro client** (docs/numero-client.md), puis propose :

| Bouton | Ce que ça fait |
| --- | --- |
| **✏️ Modifier la fiche** | Nom, WhatsApp, **e-mail de contact**, ville, pays, adresse, profession. Seuls les champs **changés** partent. Un champ vidé est effacé. Pour un **compte « numéro »** le téléphone **ne se modifie pas ici** (c'est sa connexion : voir le bouton suivant). Pour un **ancien compte** (connexion par e-mail) c'est le contraire : le téléphone de contact se modifie, l'e-mail de connexion non. |
| **📱 Changer le numéro de connexion** (ou **✉️ l'e-mail de connexion** pour un ancien compte) | Pour un client qui a **perdu ou changé de téléphone**. Il se connecte ensuite avec le **nouveau numéro** et son **mot de passe actuel** ; l'ancien numéro ne marche plus. La fiche suit (téléphone ; WhatsApp s'il suivait le téléphone). Refusé si le numéro est déjà celui d'un autre compte. |
| **🔒 Fermer le compte** | Le **nom, le téléphone, le WhatsApp, l'adresse et la photo sont effacés**, le client ne peut plus se connecter (mot de passe annulé, compte bloqué), les notifications sont coupées. **Ses commandes sont GARDÉES** pour votre comptabilité. Son numéro de téléphone est **libéré** : il pourra se réinscrire. Il faut taper **FERMER** ; un motif est facultatif ; ajouté à l'historique des sanctions. Définitif. |
| **🗑️ Supprimer pour de bon** | **Seulement un compte sans aucune commande.** Il disparaît complètement (favoris, messages, historique). Il faut taper son **numéro client** (ex. `AS-000042`). Avec des commandes, le bouton explique : « fermez le compte au lieu de le supprimer ». |
| **📜 Journal des actions** | Les 10 dernières actions sur ce client : date, action, détail, **qui l'a faite**. |

### Pourquoi « fermer » et « supprimer » sont séparés (important)
Dans la base, supprimer un compte **efface aussi toutes ses commandes** (le lien est « en cascade »). Un vrai « Supprimer » ferait donc disparaître des ventes de votre comptabilité. C'est pourquoi :
- la suppression n'est permise que **sans commande** ;
- **fermer** (anonymiser, garder les commandes) est le chemin normal.

## Sécurité
- **Réservé aux administrateurs.** La base vérifie `is_admin()` ; la fonction serveur vérifie le jeton de connexion **puis** `profiles.is_admin`.
- **Jamais un compte administrateur**, jamais soi-même, jamais un compte déjà fermé (sauf lecture).
- **Chaque action demande une confirmation claire** (taper FERMER, ou le numéro client) ; rien ne part avant.
- **Le journal ne garde aucune donnée personnelle** : ni nom, ni téléphone, ni e-mail. Seulement : quand, quel administrateur, quel numéro client, quelle action, et les **noms** des champs changés (« fiche modifiée : nom, ville »). Lisible par les administrateurs seulement ; personne ne peut l'écrire ni l'effacer depuis le site.
- Le changement de connexion, la fermeture et la suppression passent par la **fonction serveur officielle de Supabase** (pas de modification directe des tables de connexion).
- Un numéro changé ne coupe pas les téléphones déjà connectés (leur session continue jusqu'à expiration) ; pour couper tout de suite : **fermer** le compte.

## Pas encore fait
- **Fusionner deux comptes** du même client (déplacer commandes, favoris, points) : à faire si le patron le veut.
- Côté **client** (Compte) : changer son numéro de connexion, ajouter son e-mail, supprimer son compte.

## Mise en service (dans cet ordre)
1. Supabase › SQL Editor : lancer **`add-client-number.sql`** (docs/numero-client.md), puis **`add-client-account-admin.sql`** (sans danger si on le relance). Il crée le journal `client_account_log` (avec ses droits explicites : lecture pour les administrateurs, écriture pour le serveur seulement) et les fonctions `admin_client_account_info` et `admin_update_client_profile`.
2. Déployer la fonction **`admin-client-account`** (dossier `supabase/functions/admin-client-account`, **vérification du jeton activée**).
3. Publier le site (Netlify).
- Avant l'étape 1, le bloc dit « Le script add-client-account-admin.sql n'est pas encore lancé » et **n'affiche aucun bouton** ; le reste de la fiche marche comme avant. Avant l'étape 2, les boutons de connexion, de fermeture et de suppression répondent « La fonction admin-client-account n'est pas encore installée » ; modifier la fiche marche déjà.

## Où est le code
- Écran : `src/components/AdminAccountManager.tsx` (dans `src/screens/admin/AdminCustomerDetailScreen.tsx`) ; règles pures et phrases : `src/lib/clientAccount.ts` ; appels : `src/lib/clientAccountApi.ts`.
- Base : `add-client-account-admin.sql`. Fonction serveur : `supabase/functions/admin-client-account/` (`rules.ts` règles, `logic.ts` étapes, `index.ts` accès réels).

## Tests
- Règles de l'écran : `node --import ./tests/zara/register.mjs tests/email/client-account.test.ts` (31 contrôles).
- Fonction serveur avec de **faux** accès : `node --import ./tests/zara/register.mjs tests/account/admin-client-account.test.ts` (50 contrôles : numéro changé, adresse déjà prise, fermeture, suppression refusée avec commandes, confirmations, jamais un administrateur).
- Base (Postgres local jetable, jamais la vraie) : `sh tests/sql/run-client-account.sh` (54 contrôles : droits du journal, modification valable et refus, jamais de donnée personnelle dans le journal).
- Navigateur : partie `~` de `tests/zara/zara-ui.test.js` (bloc « i. Gérer le compte »).
