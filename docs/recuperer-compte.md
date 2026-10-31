# Retrouver son compte (code perdu)

Le client qui commande sans compte reçoit un code de 6 chiffres sur la page de confirmation et doit le garder en capture d'écran.
S'il ne l'a pas fait, il y a maintenant deux chemins.

## 1. Le client est encore connecté sur son téléphone
**Compte › 🔑 Changer mon mot de passe** : il écrit un nouveau mot de passe (6 caractères au moins, 72 au plus), le répète, et c'est fait.
Pas besoin de l'ancien code : il est déjà connecté. « Voir les mots de passe » montre ce qu'il tape.
Le code est dans `src/components/ChangePasswordCard.tsx` ; les règles et les messages d'erreur dans `src/lib/passwordRecovery.ts`.

Si Supabase refuse (même mot de passe que l'ancien, connexion trop ancienne…), le client lit une phrase simple, la carte reste ouverte.

## 2. Le client n'est plus connecté (autre téléphone, navigateur vidé…)
1. Il tape **Mot de passe oublié** et écrit son numéro : le site lui ouvre WhatsApp avec un message déjà écrit pour la boutique (comme avant).
2. L'équipe ouvre **Admin › Clients**, cherche le numéro, ouvre le client.
3. Section **🔑 Mot de passe oublié › Donner un nouveau code** → confirmer.
4. Le site tire un code de 6 chiffres au hasard (jamais 123456, 111111, 121212…), la base le met sur le compte, **l'ancien code ne marche plus**.
5. Le code s'affiche en grand, avec **💬 Envoyer le code sur WhatsApp** : message déjà écrit (prénom, code, « connectez-vous avec votre numéro +235 … », lien du site, où le changer).
   Un ancien compte (connexion par e-mail) reçoit « votre e-mail … » à la place du numéro.

Le code n'est visible qu'**une seule fois** : si on quitte la page, on crée simplement un autre code.

## Sécurité
- La fonction `admin_set_client_password` est réservée aux administrateurs (`is_admin()`), refusée pour un compte administrateur, code de 6 à 72 caractères.
- Le code n'est **jamais gardé en clair** (la base le chiffre en bcrypt, comme Supabase). Le petit journal `admin_password_resets` note seulement : quel client, quel administrateur, quand. Il est lisible par les administrateurs seulement.
- Lire le journal (Supabase › SQL Editor) : `select * from admin_password_resets order by created_at desc;`
- Le client n'est pas déconnecté des appareils où il est déjà connecté.

## Mise en service
1. Lancer **`add-admin-reset-password.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance).
2. Publier le site (Netlify).
   Tant que le script n'est pas lancé, le bouton répond « Le script add-admin-reset-password.sql n'est pas encore lancé dans Supabase. » et ne montre aucun code. Le changement dans Compte marche sans le script.

## Tests
- Navigateur : `PARTS='~' … node tests/zara/zara-ui.test.js <dist> <port>` (32 contrôles : Compte, bouton admin, WhatsApp, refus de la base, client ordinaire).
- Règles pures : `node --import ./tests/zara/register.mjs tests/email/password-recovery.test.ts` (32 contrôles).
- Base (Postgres local jetable, jamais la vraie) : `sh tests/sql/run-admin-password.sh` (29 contrôles : droits, refus, code bcrypt qui ouvre le compte, journal).
