# Clé du bot Telegram (coffre-fort) et changement de clé

## Ce que ça fait (en simple)
1. **La clé du bot n'est écrite dans aucune fonction ni aucun fichier.** Elle est gardée dans le coffre-fort Supabase (`vault`, nom `telegram_bot_token`) ; les fonctions serveur la relisent à chaque envoi (`zara_report_credentials`, réservée au serveur).
2. **Le lien Telegram → site (webhook)** est protégé par un mot de passe aussi gardé dans le coffre-fort (`telegram_webhook_secret`) : sans lui, la fonction `telegram-webhook` répond « interdit » (401).
3. **Changer la clé sans écrire de SQL** : après avoir touché « Revoke current token » dans BotFather, l'administrateur **envoie la NOUVELLE clé dans la conversation avec le bot**. Le bot :
   - retrouve la clé même si tout le message de BotFather est collé (phrases autour comprises),
   - vérifie auprès de Telegram que la clé est bonne,
   - la range dans le coffre-fort (fonction `set_telegram_bot_token`, qui refuse tout ce qui n'a pas la forme d'une clé et la clé d'un autre bot),
   - remet le lien (webhook) avec la nouvelle clé,
   - **efface le message qui contient la clé**, puis confirme par « ✅ Nouvelle clé enregistrée ».
4. Seul un **administrateur lié à Telegram**, dans une **conversation privée**, peut le faire. Pour les autres, le bot ne répond rien.

## Journal
Table `telegram_key_events` (réservée au serveur) : à chaque clé envoyée au bot, une ligne avec l'heure, la longueur du message et le résultat (`saved`, `refused`, `same`, `not-saved`, `ignored`, `error`) ; `no-key-in-text` = long message sans clé reconnaissable. **Jamais la clé ni le texte.** Lecture : `select * from telegram_key_events order by at desc;`

## Si quelque chose ne va pas
- Pas de « ✅ » après quelques secondes : la clé envoyée n'était pas la nouvelle (fausse, ou déjà révoquée). Le bot ne peut pas répondre tant qu'il n'a pas la bonne clé. Recommencer en copiant le **dernier** message de BotFather, puis effacer à la main le message envoyé.
- « ⚠️ C'est la même clé… » : la clé envoyée est l'ancienne ; le bouton « Revoke current token » n'a pas été touché.
- Pendant le changement (entre « Revoke » et la confirmation), les alertes Telegram (commande, facture, rapport du lundi) sont coupées quelques instants.
- Secours en SQL : `select public.set_telegram_bot_token('<clé>');` (rôle serveur ou éditeur SQL Supabase).

## Fichiers
| Élément | Fichier |
| --- | --- |
| Base : mot de passe du lien, `set_telegram_bot_token`, journal | `add-telegram-key-vault.sql` |
| Fonction du bot (liaison des comptes + changement de clé) | `supabase/functions/telegram-webhook/index.ts` et `key.ts` |
| Diffusion aux clients (clé lue dans le coffre-fort) | `supabase/functions/telegram-broadcast/index.ts` |
| Tests (faux Telegram, aucun réseau) | `tests/email/telegram-key.test.ts` |

Lancer le test : `node --import ./tests/zara/register.mjs tests/email/telegram-key.test.ts`

## Limites connues
- Une clé **déjà révoquée** envoyée par erreur ne peut pas être effacée par le bot (il n'a plus de clé valide) : l'effacer à la main.
- Les autres fonctions de notifications (`send-product-push`, `send-web-push`) ont encore leurs propres codes secrets écrits dans leur code ; elles ne touchent pas à la clé Telegram.
