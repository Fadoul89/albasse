# Zara et le mot de passe

Demande du patron (8 novembre 2026) : *« Est-ce que Zara peut prendre la gestion du mot de passe pour les clients ? »*

## Ce qu'il faut savoir d'abord
- **Zara ne donne jamais de code ni de mot de passe.** Elle ne peut pas savoir qui lui écrit : n'importe qui pourrait dire « je suis Aïcha, 66 11 11 11 » et prendre son compte. Un nouveau code ne se donne qu'à la personne reconnue par l'équipe, sur WhatsApp (Admin › Clients › fiche › « Donner un nouveau code », docs/recuperer-compte.md).
- **Zara ne voit jamais un mot de passe et ne le demande jamais.** Elle le dit au client.
- Quand le compte est obligatoire (réglage actuel), **un visiteur sans connexion ne voit pas le chat de Zara** : or celui qui a oublié son mot de passe n'est pas connecté. Zara parle donc **sur l'écran « Mot de passe oublié »** lui-même, et dans le chat pour les clients connectés.

## Où Zara parle
| Où | Qui | Ce que Zara fait |
| --- | --- | --- |
| Écran « Mot de passe oublié » (`/mot-de-passe-oublie`) | visiteur sans connexion | Photo ronde + bulle : « Bonjour 👋 Je suis Zara. Je vous aide à retrouver votre compte… ». La phrase change selon l'étape : après le téléphone ou le numéro client → « écrivez-nous sur WhatsApp » ; après l'e-mail → « regardez votre boîte e-mail et les spams ». La case unique (e-mail, téléphone ou numéro client) et l'alerte à l'équipe restent **exactement** comme avant. |
| Chat de Zara, client connecté | « comment changer mon mot de passe ? », « mot de passe oublié »… | Le chemin : « Compte » puis « Changer mon mot de passe », **son numéro client** (AS-000123, à garder), le bouton « 🔑 Changer mon mot de passe » (ouvre Compte). |
| Chat de Zara, visiteur sans connexion (quand le compte n'est pas obligatoire) | idem | Explique l'écran « Mot de passe oublié », bouton « 🔑 Mot de passe oublié » + WhatsApp. |

Le chat comprend le français et l'arabe (« j'ai oublié mon mot de passe », « mdp », « je n'arrive pas à me connecter », « نسيت كلمة السر », « الباسورد »…). « Code promo », « code de parrainage » ne sont **pas** pris pour un mot de passe.

## Ce que Zara ne promet jamais
- Pas de délai (« en quelques minutes »).
- Pas « j'ai prévenu l'équipe » : l'alerte Telegram est un plus qui peut ne pas partir (limite d'une alerte par client toutes les 30 minutes, Telegram pas lié…). Le client sait toujours quoi faire : écrire sur WhatsApp.

## Pas de SQL
Aucune table ni colonne ajoutée : rien à lancer dans Supabase. Le numéro client vient de `add-client-number.sql` (déjà en place).

## Où est le code
- Écran : `src/screens/auth/ForgotPasswordScreen.tsx`, composant `src/components/ZaraSays.tsx`, phrases `zaraForgotLine` dans `src/lib/clientNumber.ts`.
- Chat : détection `wantsPassword` / intention `password` (`src/lib/assistantBrain.ts`), textes FR/AR (`src/lib/assistantText.ts`), réponse `passwordReply` et bouton `forgot` (`src/store/assistantStore.ts`, `src/components/AssistantPanel.tsx`).
- Tests : `tests/zara/zara-password.test.ts` (48 contrôles : phrases reconnues et non reconnues, textes FR/AR, aucune promesse fausse) ; navigateur : partie `~` de `tests/zara/zara-ui.test.js` (bloc « j. Zara et le mot de passe »).

## Aucun compte trouvé (9 novembre 2026)
Sur l'écran « Mot de passe oublié », Zara vérifie d'abord (via la base) que la personne a un compte. Sans compte, elle dit : « Je ne trouve aucun compte avec cette information 🙏 Vérifiez-la, ou créez votre compte : c'est gratuit et rapide. » : pas de WhatsApp, pas d'alerte pour l'équipe. Détails : `docs/recuperer-compte.md`.

