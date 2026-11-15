# Double vérification des administrateurs (code de Google Authenticator)

Seulement pour les comptes **administrateurs**. Les clients se connectent comme avant (numéro + mot de passe), sans code.

## Pour le patron
1. **Mise en route (une seule fois)** : Mon compte › Administration › Paramètres › **🔐 Double vérification** (adresse `/admin/securite`).
   Touchez « Commencer », scannez le QR code avec **Google Authenticator** (ou tapez la clé), puis tapez le code à 6 chiffres affiché → « Activer ».
2. **Ensuite, à chaque connexion admin** : après le numéro et le mot de passe, l'écran « Code de vérification » demande le code de Google Authenticator
   (il change toutes les 30 secondes). Tant que le code n'est pas tapé, rien d'autre n'est accessible (Zara et les fenêtres sont cachées).
3. **Téléphone perdu** : retirer l'ancien téléphone dans Supabase › Authentication › Users › le compte admin › supprimer le facteur « TOTP »
   (ou en SQL : `delete from auth.mfa_factors where user_id = '<id du compte>';`). Puis refaire la mise en route avec le nouveau téléphone.

## Ce qui protège vraiment (pas seulement l'écran)
- **Base** (`add-admin-mfa.sql`) : `is_admin()` exige une session « aal2 » (code tapé) dès que l'admin a un facteur **vérifié**.
  Toutes les règles d'accès admin passent par `is_admin()` (56 règles RLS, les fonctions `admin_*`). Un mot de passe volé ne suffit plus
  pour lire les commandes ou les clients. Un admin qui n'a pas activé la double vérification : rien ne change.
- **Fonctions serveur** réservées aux admins (`admin-client-account`, `brevo-email` (envoi de test / campagnes), `marketing-ai`, `order-invoice`
  (facture d'un autre client), `telegram-broadcast`, `send-broadcast-push`, `zara-seo`) : en plus de `profiles.is_admin`, elles demandent
  à la base `is_admin()` avec le jeton de l'admin (fonction `adminAllowed`). Même règle partout.
- Le code est vérifié par **Supabase** (`mfa.challengeAndVerify`), jamais par le site. Le secret du téléphone n'est jamais gardé par le site.

## Fichiers
- `src/lib/adminMfa.ts` (textes, code, QR, messages), `src/store/mfaStore.ts`, `src/components/MfaCodeInput.tsx`, `src/components/AdminMfaGate.tsx`,
  `src/screens/admin/AdminSecurityScreen.tsx`, `src/navigation/RootNavigator.tsx` (écran du code par-dessus tout), `src/constants/adminMenu.ts`.
- `add-admin-mfa.sql` (base), `supabase/functions/*/index.ts` (`adminAllowed`).

## Tests
- `node --import ./tests/zara/register.mjs tests/email/admin-mfa.test.ts` (textes, code, QR, et garde-fou : chaque fonction serveur admin passe par `is_admin()`).
- `sh tests/sql/run-admin-mfa.sh` (Postgres local jetable : 15 contrôles, dont les règles RLS).
- `NODE_PATH=/opt/node-tools/node_modules node tests/account/admin-mfa-ui.test.js <dist> 4520 <dossier photos>` (navigateur, Supabase simulé :
  client sans code, mise en route, mauvais / bon code, écran du code, Zara cachée, déconnexion).

## Mise en ligne (ordre)
1. `add-admin-mfa.sql` sur la base (sans effet tant que personne n'a activé la double vérification).
2. Déployer les 7 fonctions serveur.
3. Publier le site.
Retour en arrière : relancer l'ancienne `is_admin()` : `select coalesce((select is_admin from profiles where id = auth.uid()), false);`.
