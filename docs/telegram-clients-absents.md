# Telegram aux clients absents depuis 7 jours

Zara écrit chaque matin sur **Telegram** aux clients qui n'ont ni commandé ni visité le site depuis 7 jours, **à condition qu'ils aient lié leur Telegram**. Chaque jour à 17 h, le résultat arrive sur **votre** Telegram : e-mails et Telegram, clients revenus, commandes.

## Pourquoi seulement ceux qui ont lié Telegram
Un bot Telegram ne peut écrire qu'à une personne qui a d'abord appuyé sur « Démarrer » dans le bot. Il est impossible d'écrire à quelqu'un à partir de son numéro ou de son e-mail. Au début, **aucun client** n'a lié Telegram (seul le compte administrateur l'est) : il faut donc inviter les clients à le faire.

## Comment un client lie son Telegram
1. Bouton **« Lier mon Telegram »** sur la page de confirmation de commande (seulement s'il ne l'a pas déjà fait).
2. **Zara** en parle : après une commande dans le chat (une ligne d'astuce et un bouton), et quand le client écrit « Telegram » (français et arabe). Sans compte, Zara demande d'abord d'en créer un.
3. **Compte › « Lier Telegram (nouveautés et offres) »**.

Le bouton ouvre `https://t.me/AlbasseShoppingBot?start=<identifiant du compte>` ; le client appuie sur « Démarrer » ; le bot lie le compte et répond : « Vous recevrez ici vos nouveautés, nos offres et les messages de la boutique. Pour ne plus recevoir nos offres, écrivez STOP à tout moment. » **Lier = accepter les nouveautés et les offres** (le message le dit avec le mot STOP).

## Les règles d'envoi (mêmes principes que les e-mails publicitaires)
- Le client a lié son Telegram **et** n'a pas écrit STOP ; il n'a pas bloqué le bot.
- Ni compte bloqué ni administrateur.
- Ni commande ni visite sur le site depuis 7 jours.
- **Un message tous les 14 jours au plus** par client ; **50 messages par jour** au plus ; les plus récemment absents d'abord.
- Chaque matin à **9 h 30** (N'Djamena), après les e-mails de 9 h.
- Le message montre de **vrais articles** (la vente flash en cours d'abord, 4 articles au plus, vrais prix, vraie remise) avec leurs liens, la photo du 1er article, un bouton « Voir les articles » et la phrase « Pour ne plus recevoir ces messages, écrivez STOP. ».
- Un client qui a bloqué le bot (ou supprimé son Telegram) n'est **plus jamais** contacté.

## STOP et REPRENDRE
Le client écrit au bot :
- **STOP** (ou /stop, « arrêter », « توقف »…) : plus aucun message publicitaire sur Telegram. Le bot confirme.
- **REPRENDRE** : il les reçoit de nouveau.
Une phrase qui contient seulement le mot « stop » n'arrête rien : il faut écrire le mot seul. Un client qui a écrit STOP n'est plus contacté non plus par l'envoi manuel de **Admin › Messages** vers Telegram.

## L'interrupteur (Admin › Assistant marketing)
« ✈️ Telegram aux clients absents (7 jours) » : **éteint au départ**. Sous l'interrupteur : le nombre de clients qui ont lié Telegram, combien reçoivent les offres, combien ont écrit STOP.

## Le rapport de 17 h sur votre Telegram
Exemple :
```
📣 Clients absents — rapport du 31/10

📧 E-mails publicitaires : 49 envoyés aujourd'hui, 99 envoyés sur 7 jours
→ 1 client revenu sur le site, 0 client a commandé

✈️ Telegram : 3 envoyés aujourd'hui, 12 envoyés sur 7 jours
→ 4 clients revenus sur le site, 2 clients ont commandé
⚠️ 1 échec, 2 bots bloqués (7 jours)

✈️ Clients liés à Telegram : 20 (15 acceptent les offres, 3 ont écrit STOP)
Interrupteurs : e-mails 🟢 allumé · Telegram 🟢 allumé
```
- « **Revenu** » = un client contacté qui a ouvert une visite **reconnue** sur le site **après** le message. Un client qui revient sans se connecter n'est pas compté.
- « **A commandé** » = un client contacté qui a commandé **après** le message.
- Le rapport ne part pas quand il n'y a rien à dire (aucun envoi sur 7 jours et personne de lié).

## À installer (une seule fois, dans cet ordre)
1. Déployer les fonctions : **telegram-promo** (nouvelle) et **telegram-webhook** (mise à jour : consentement, STOP / REPRENDRE) ; **telegram-broadcast** (mise à jour : écarte ceux qui ont écrit STOP).
2. Lancer **add-telegram-absent.sql** dans Supabase › SQL Editor (sans danger à relancer). Il crée deux tables réservées au serveur (`telegram_prefs`, `telegram_promos` : aucun visiteur ni client n'y a accès, `grant` explicites pour `service_role` seulement), les réglages (interrupteur éteint, limite 50), les fonctions de choix et de rapport, et les deux planifications (`telegram-absent-daily` à 9 h 30, `telegram-promos-report` à 17 h).
3. Publier le site (carte de confirmation, Zara, interrupteur).
4. Allumer l'interrupteur quand vous le souhaitez.

Le secret partagé entre la base et les fonctions (`email_cron_secret`) est celui des e-mails : rien à créer. Le code du bot Telegram est lu dans le coffre-fort, jamais écrit dans le code ni journalisé.

## Fichiers
| Élément | Fichier |
| --- | --- |
| Script SQL (tables, choix des clients, rapport, planification) | `add-telegram-absent.sql` |
| Fonction serveur (envoi aux clients, rapport) | `supabase/functions/telegram-promo/index.ts` |
| Message, choix des articles, erreurs de Telegram, texte du rapport | `supabase/functions/telegram-promo/message.ts` |
| Déroulement des envois (testable avec un faux Telegram) | `supabase/functions/telegram-promo/send.ts` |
| Bot : consentement au lien, STOP / REPRENDRE | `supabase/functions/telegram-webhook/index.ts`, `commands.ts` |
| Envoi manuel (écarte les STOP) | `supabase/functions/telegram-broadcast/index.ts` |
| Lien « Lier Telegram » | `src/lib/telegramLink.ts` |
| Carte de la page de confirmation | `src/screens/OrderConfirmationScreen.tsx` |
| Zara (mot « Telegram », astuce après une commande, français et arabe) | `src/store/assistantStore.ts`, `src/lib/assistantBrain.ts`, `src/lib/assistantText.ts` |
| Interrupteur et nombre de clients liés | `src/components/TelegramAbsentCard.tsx`, `src/components/StoreSettingToggle.tsx` |
| Tests | `tests/email/telegram-promo.test.ts` (92), `tests/sql/run-telegram-absent.sh` (Postgres local jetable : 55 contrôles), partie `+` de `tests/zara/zara-ui.test.js` (navigateur) |
