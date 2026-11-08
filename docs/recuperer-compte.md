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

## 3. L'équipe est prévenue tout de suite sur Telegram (demande du patron, 7 novembre)
Avant, l'équipe ne savait qu'un client avait oublié son mot de passe que s'il pensait à écrire sur WhatsApp. Maintenant, dès que le client **valide** l'écran « Mot de passe oublié », un message arrive sur le Telegram de l'administrateur (le même bot que l'alerte de nouvelle commande) :
```
🔑 Mot de passe oublié
Éric Moussa
📞 66 12 34 56
📍 N'Djamena
Il attend un nouveau code.
👉 Sa fiche (puis « Donner un nouveau code ») : https://www.albasseshopping.com/admin/clients/<identifiant>
💬 WhatsApp : https://wa.me/23566123456
```
Un ancien compte (avec e-mail) donne « 🔑 Mot de passe oublié (par e-mail) » : le lien de réinitialisation lui part par e-mail, l'équipe est seulement prévenue (rien à faire, sauf s'il écrit).
- Un clic sur « Sa fiche » ouvre directement le client dans Admin › Clients ; le code se donne comme d'habitude (partie 2 ci-dessus). Le message ne contient **jamais** de mot de passe ni de code.
- Garde-fous : un numéro ou e-mail **inconnu** n'envoie rien (et la réponse est la même, personne ne peut deviner quels numéros ont un compte) ; un compte administrateur non plus ; **1 alerte par client toutes les 30 minutes** et **20 par heure en tout** ; le journal (client, moyen, date) est effacé après 30 jours.
- Si l'alerte ne peut pas partir (script pas lancé, pas de Telegram lié, réseau), le client ne voit **rien** de différent : l'écran marche comme avant.
- Lire le journal (Supabase › SQL Editor) : `select * from password_request_alerts order by created_at desc;`
- Code : fonction `notify_admin_password_request` (`add-password-request-alert.sql`), appelée par `src/lib/passwordRequestAlert.ts` depuis `src/screens/auth/ForgotPasswordScreen.tsx`.

## 4. Le numéro client aide à retrouver le bon compte (demande du patron, 8 novembre)
Chaque compte a un **numéro client** `AS-000123` (docs/numero-client.md), visible par le client dans **Compte › 🪪 Mon numéro client**. Il le garde (copie, capture, WhatsApp) et le donne à l'équipe s'il perd l'accès ; l'équipe le tape dans **Admin › Clients** pour ouvrir la bonne fiche, vérifie la personne, puis donne un nouveau code comme ci-dessus. L'alerte Telegram et le message du nouveau code portent aussi le numéro. Sur l'écran « Mot de passe oublié », le client peut maintenant taper son **téléphone, son e-mail ou son numéro client** ; l'e-mail d'un compte créé avec le numéro (88 comptes sur 114) prévient l'équipe comme un numéro (« il attend un nouveau code ») au lieu de « rien à faire » : voir docs/numero-client.md. **Ce n'est pas un mot de passe** : il n'ouvre aucun compte.

## Sécurité
- La fonction `admin_set_client_password` est réservée aux administrateurs (`is_admin()`), refusée pour un compte administrateur, code de 6 à 72 caractères.
- Le code n'est **jamais gardé en clair** (la base le chiffre en bcrypt, comme Supabase). Le petit journal `admin_password_resets` note seulement : quel client, quel administrateur, quand. Il est lisible par les administrateurs seulement.
- Lire le journal (Supabase › SQL Editor) : `select * from admin_password_resets order by created_at desc;`
- Le client n'est pas déconnecté des appareils où il est déjà connecté.

## Mise en service
1. Lancer **`add-admin-reset-password.sql`** une fois dans Supabase › SQL Editor (sans danger si on le relance).
1 bis. Pour l'alerte Telegram : lancer aussi **`add-password-request-alert.sql`** (sans danger si on le relance ; il faut le token du bot dans le coffre-fort et un administrateur qui a lié Telegram : déjà en place pour l'alerte de commande).
2. Publier le site (Netlify).
   Tant que le script n'est pas lancé, le bouton répond « Le script add-admin-reset-password.sql n'est pas encore lancé dans Supabase. » et ne montre aucun code. Le changement dans Compte marche sans le script.

## Tests
- Navigateur : `PARTS='~' … node tests/zara/zara-ui.test.js <dist> <port>` (32 contrôles : Compte, bouton admin, WhatsApp, refus de la base, client ordinaire).
- Règles pures : `node --import ./tests/zara/register.mjs tests/email/password-recovery.test.ts` (32 contrôles).
- Base (Postgres local jetable, jamais la vraie) : `sh tests/sql/run-admin-password.sh` (29 contrôles : droits, refus, code bcrypt qui ouvre le compte, journal).
- Alerte Telegram, base (Postgres local jetable) : `sh tests/sql/run-password-alert.sh` (44 contrôles : numéros écrits de toutes les façons, e-mail, inconnu, administrateur, 1 alerte / 30 min, 20 / heure, sans token, plusieurs administrateurs, journal, droits).
- Alerte Telegram, navigateur : partie `2` de `tests/zara/zara-ui.test.js` (la base reçoit le numéro écrit, alerte en panne sans gêne pour le client, e-mail, champ vide).
