# Numéro client : retrouver un compte plus vite

Demande du patron (8 novembre 2026) : *« Donne à chaque client qui crée un compte un numéro d'identité lié avec son numéro (de téléphone) et son e-mail, pour faciliter la récupération de leur compte. »*

## Ce que c'est
- Chaque compte reçoit **un numéro unique et définitif**, écrit **`AS-000123`** (AS = Albasse Shopping, puis 6 chiffres).
- Il est **lié au compte**, donc à son téléphone et à son e-mail : le client le voit avec eux dans « Compte », l'équipe le voit sur la fiche du client.
- Les comptes **déjà créés** reçoivent leur numéro dans l'ordre de création (le plus ancien : `AS-000001`). Les **nouveaux comptes** le reçoivent tout seuls, à leur création, sans rien changer à l'inscription.
- C'est un numéro de **client**, pas une pièce d'identité : le site ne demande aucun document ni numéro officiel.
- **Ce n'est pas un mot de passe** : il ne permet pas d'entrer dans un compte. Il sert seulement à **retrouver le bon compte** (par exemple si le client a changé de téléphone ou ne se rappelle plus de quel numéro il s'est inscrit).

## Où il apparaît
| Où | Quoi |
| --- | --- |
| **Compte › 🪪 Mon numéro client** (client) | Le numéro en grand, avec son téléphone et son e-mail, un bouton **Copier** et **« Me l'envoyer sur WhatsApp »** (message prêt : numéro, téléphone, e-mail). Un compte créé avec le numéro de téléphone n'affiche jamais l'adresse technique `@tel.albasseshopping.com`. |
| **Mot de passe oublié** (client sans compte ouvert) | Une case **facultative « Numéro client »** : si le client le connaît, le message WhatsApp vers l'équipe ajoute « Mon numéro client : AS-000123 ». Mal écrit : une phrase simple, rien ne bloque. Vide : le message est celui d'avant. |
| **Alerte Telegram « 🔑 Mot de passe oublié »** (équipe) | Une ligne **« 🪪 N° client : AS-000123 »** sous le téléphone. |
| **Admin › Clients** (liste) | « 🪪 AS-000123 » sur chaque client ; la barre de recherche trouve par **numéro client** (« AS-000123 », « as 123 » ou « 123 » : exactement ce numéro, jamais « 12 » pour « 123 »), comme par nom ou téléphone. |
| **Admin › Clients › fiche du client** | La ligne **« 🪪 Numéro client »** en haut de l'identité. |
| **WhatsApp du nouveau code** (équipe → client) | Le message ajoute « Votre numéro client : AS-000123 (gardez-le : il aide à retrouver votre compte) ». |

## Comment s'en servir pour récupérer un compte
1. Le client écrit sur WhatsApp (ou tape « Mot de passe oublié ») : il dit son **numéro client** s'il l'a gardé, sinon son nom et son téléphone.
2. L'équipe tape le numéro dans **Admin › Clients** : la fiche s'ouvre, avec le téléphone et l'e-mail du compte.
3. L'équipe **vérifie** que c'est bien la bonne personne (nom, ville, dernière commande) : le numéro seul **ne prouve pas** qui écrit, comme un nom ou un téléphone seul.
4. Section **🔑 Mot de passe oublié › Donner un nouveau code** (inchangé, docs/recuperer-compte.md) ; le message WhatsApp rappelle le numéro client au client.

## Règles de sécurité
- Le numéro **ne change jamais** : personne ne peut le modifier depuis le site, **ni un client, ni un administrateur** connecté au site (déclencheur de protection). Seul l'éditeur SQL de Supabase le pourrait, à la main.
- Le client lit **son propre numéro** (règle déjà en place : chacun ne lit que son profil, l'équipe lit tous les profils). Aucun visiteur sans compte ne peut lire un numéro.
- Un numéro seul ne donne **jamais** d'accès : aucun écran n'ouvre un compte avec lui.
- **Aucune nouvelle table** : donc aucune règle d'accès à ajouter. Seule la séquence qui compte les numéros a un droit pour le serveur (`service_role`), pas pour le site.
- Un numéro peut sauter (par exemple un compte dont la création échoue consomme un numéro) : un trou entre deux numéros est normal.

## Mise en service (dans cet ordre)
1. Supabase › SQL Editor : lancer **`add-client-number.sql`** (sans danger si on le relance : rien n'est renuméroté).
2. Supabase › SQL Editor : relancer **`add-password-request-alert.sql`** (version mise à jour : l'alerte Telegram porte le numéro ; elle marche aussi sans le script du numéro).
3. Publier le site (Netlify).
- Avant l'étape 1, rien ne change pour les clients : la carte n'apparaît pas (le compte n'a pas de numéro), la liste et la fiche n'ont pas la ligne, aucun message d'erreur.
- Vérifier après : `select client_number, full_name, phone from profiles order by client_number limit 20;`

## Où est le code
- Règles pures (écrire, lire, rechercher le numéro, messages) : `src/lib/clientNumber.ts`.
- Carte du client : `src/components/ClientNumberCard.tsx` (sur `src/screens/AccountScreen.tsx`) ; case facultative : `src/screens/auth/ForgotPasswordScreen.tsx`.
- Équipe : `src/screens/admin/AdminCustomersScreen.tsx` (ligne + recherche), `src/screens/admin/AdminCustomerDetailScreen.tsx` (fiche + message du code), `src/lib/passwordRecovery.ts` (message WhatsApp).
- Base : `add-client-number.sql` (colonne `profiles.client_number`, séquence, protection) ; alerte Telegram : `add-password-request-alert.sql`.

## Tests
- Règles pures : `node --import ./tests/zara/register.mjs tests/email/client-number.test.ts` (28 contrôles) et `tests/email/password-recovery.test.ts` (32).
- Base (Postgres local jetable, jamais la vraie) : `sh tests/sql/run-client-number.sh` (28 contrôles : numérotation dans l'ordre, relance sans renumérotation, nouveau compte, serveur, droits, protection contre les modifications, unicité, alerte avec et sans la colonne) ; `sh tests/sql/run-password-alert.sh` (44, inchangé).
- Navigateur : partie `~` de `tests/zara/zara-ui.test.js` (carte du client, copie, WhatsApp, compte sans numéro, fiche et liste de l'équipe, recherche, « Mot de passe oublié »).
