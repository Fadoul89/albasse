# Parrainage : « Invite 5 amis, gagne un parfum »

Demande du patron (5 novembre 2026) : *« les clients qui ont déjà créé un compte reçoivent un lien pour inviter leurs amis à créer un compte et à installer l'application. 5 amis invités qui installent l'application : le client gagne un parfum gratuit. »*

Réponses du patron : **un parfum à chaque tranche de 5 amis (5, 10, 15…)**, et **c'est le patron qui valide** puis l'équipe écrit au gagnant sur WhatsApp. Aucun parfum n'est donné automatiquement.

Ce n'est pas le programme d'affiliation (commissions sur les ventes, lien `?ref=`) : le parrainage a son propre code et son propre lien `?invite=`.

## Comment un ami « compte »

Un ami compte **seulement** s'il fait les deux gestes :
1. il **crée son compte avec le lien** du client (dans les 2 jours qui suivent la création de son compte : un compte déjà ancien ne peut pas être rattaché) ;
2. il **ouvre l'application installée** (l'icône sur l'écran d'accueil de son téléphone) **en étant connecté**.

C'est le seul signal sûr : le site sait quand il tourne en mode « application installée » (Android et iPhone), même quand le navigateur ne le dit pas. Un ami banni ne compte plus.

Par client : 1 ami qui compte = 1 compte différent, avec un numéro de téléphone différent (un numéro ne peut pas créer deux comptes). Un client ne peut pas s'inviter lui-même, et deux clients ne peuvent pas s'inviter l'un l'autre.

## Pour le client

- **Mon compte** : une carte « 🎁 Invite tes amis, gagne un parfum » avec la progression (« 2 / 5 amis »). Elle n'apparaît que quand la base sait le faire (script SQL lancé).
- **Écran « Inviter mes amis »** (`/inviter-mes-amis`) :
  - la phrase du but et une barre de 5 cases (« 2 / 5 amis ») ; après 5 amis, la barre repart à zéro et « 1 parfum gagné » s'affiche ;
  - **son lien** (`https://www.albasseshopping.com/?invite=ABCD2345`), un bouton **« Envoyer à mes amis sur WhatsApp »** (message déjà écrit, **sans aucune promesse à l'ami**) et **« Copier le lien »** ;
  - « Comment ça marche » en 3 gestes, et la règle « chaque fois que 5 amis comptent : 1 parfum gratuit, l'équipe vérifie vos amis puis vous contacte sur WhatsApp » ;
  - **ses amis** : le **prénom seulement** et l'état (✅ application installée, ⏳ compte créé, application pas encore ouverte) ; un rappel « N amis ont créé leur compte mais n'ont pas encore ouvert l'application » ;
  - **ses parfums** : « Parfum gagné ✓ L'équipe vérifie vos amis… » (à valider), « Parfum validé ✓ L'équipe vous contacte sur WhatsApp… », « Parfum remis ✓ » ou « Non validé par l'équipe ».
- **L'ami** : en ouvrant le lien, le formulaire d'inscription dit « 🎁 Invité(e) par Amina » (prénom de celui qui invite). Le code est gardé 30 jours sur son téléphone, même s'il s'inscrit plus tard.

## Pour l'administrateur (Admin › Parrainages)

- Les totaux : clients qui invitent, amis inscrits, amis qui ont ouvert l'application, parfums à valider, parfums remis.
- **Chaque gain** (« à valider » en premier) : le client (nom, téléphone), « Parfum n° 1 · gagné le 5 novembre », et **ses amis avec leur nom et leur numéro** (✅ installé, ⏳ pas encore ouvert, 🚫 compte banni) : « 5 amis qui comptent sur 6 invités ». C'est ce que vous vérifiez avant de valider.
- Les boutons : **Valider**, **Parfum remis**, **Refuser** (avec confirmation), **Remettre à valider**, et **« Écrire sur WhatsApp »** (message de félicitations déjà écrit, envoyé au numéro WhatsApp du client, sinon à son téléphone).
- La liste des clients qui invitent avec leur progression.

## Ce que fait la base (`add-friend-invites.sql`)

Sans danger à relancer. Aucun compte, article ni commande n'est modifié ; les colonnes ajoutées sont vides pour tout le monde au départ.
- 4 colonnes sur `profiles` : `invite_code`, `invited_by`, `invited_at`, `app_opened_at`. **Un client ne peut pas les écrire lui-même** (garde-fou) : seules les fonctions les remplissent.
- Une table `invite_rewards` (les gains : à valider, validé, remis, refusé). Droits donnés explicitement : le client lit **ses** gains ; l'écriture passe seulement par les fonctions.
- Les fonctions : `invite_my_code`, `invite_lookup` (le prénom de celui qui invite), `invite_claim` (« j'ai été invité par ce code »), `invite_mark_app_opened`, `invite_my_progress`, et pour l'administrateur `admin_invite_overview` et `admin_invite_reward_set` (refusées à un client).
- 1 gain par tranche de 5 amis qui comptent, **sans doublon** ; un gain déjà gagné reste même si un ami est banni ensuite (le patron décide).

**Avant le script SQL** : le site marche exactement comme avant. Aucune carte dans Mon compte, l'écran dit « pas encore disponible », Admin › Parrainages dit « Lancez d'abord le script add-friend-invites.sql ». L'inscription, la connexion et l'ouverture de l'application ne peuvent jamais échouer à cause du parrainage.

Test sur un Postgres local jetable (jamais la vraie base) : `sh tests/sql/run-friend-invites.sh` (59 contrôles).

## Honnêteté

- Aucune promesse à l'ami (le message WhatsApp ne parle d'aucun cadeau) ; le gain est pour celui qui invite.
- Le parfum n'est jamais donné avant la validation du patron ; l'écran du client le dit (« l'équipe vérifie vos amis »).
- Le client ne voit jamais le nom de famille ni le téléphone de ses amis ; la politique de confidentialité le dit.

## Où est le code

- Règles pures : `src/lib/friendInvites.ts` (test : `node --import ./tests/zara/register.mjs tests/email/friend-invites.test.ts`).
- Appels à la base : `src/lib/friendInvitesApi.ts`, `src/hooks/useMyInvites.ts`.
- Écrans : `src/screens/InviteFriendsScreen.tsx`, `src/screens/admin/AdminInvitesScreen.tsx`, carte dans `src/screens/AccountScreen.tsx`, ligne « Invité(e) par » dans `src/components/RegisterForm.tsx`.
- Capture du lien et ouverture de l'application : `src/navigation/RootNavigator.tsx` ; rattachement à l'inscription : `src/store/authStore.ts`.
- Test dans le navigateur : `PARTS='#' SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333`.
