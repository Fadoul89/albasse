# Historique des notifications push : effacement automatique après 24 h

Dans Admin › Promotions intelligentes › « Notifications push programmées », la liste **Historique** montre les notifications déjà passées : envoyées (avec leurs clics), annulées et « pas envoyées (trop en retard) ».
Avant, rien ne les effaçait : elles restaient toujours (les 20 dernières s'affichaient).

## Ce qui change
Chaque ligne de l'historique s'efface **toute seule 24 heures après** le moment où elle est devenue « envoyée », « annulée » ou « pas envoyée ».
- Les notifications **programmées** (à venir) ne sont **jamais** effacées.
- Une notification annulée disparaît 24 h après l'annulation (pas 24 h après sa création).
- Le **nombre de clics** est gardé sur la ligne : il disparaît avec elle. Un clic qui arrive plus tard n'est plus compté (la notification n'existe plus).
- Une phrase sous « Historique » l'explique : « Chaque ligne s'efface toute seule 24 h après son envoi ou son annulation (ses clics aussi). » Elle s'affiche **seulement quand le script SQL est lancé** (le site vérifie que la colonne `status_changed_at` existe) : avant, elle serait fausse.

## Comment ça marche
- Une colonne **`status_changed_at`** note le moment du dernier changement d'état (un déclencheur la met à jour tout seul : création, envoi, annulation, « pas envoyée »).
- Une tâche de Supabase (**pg_cron**, `purge-old-scheduled-pushes`) tourne **toutes les 10 minutes** et efface les lignes finies depuis plus de 24 h. Une ligne disparaît donc entre 24 h et 24 h 10 min après.
- Les lignes qui existaient avant le script : « envoyée » = depuis son envoi ; « annulée » ou « pas envoyée » = depuis leur création (la base n'a pas gardé le moment exact de l'annulation). Les plus anciennes disparaissent donc au premier passage.

## Mise en service (dans cet ordre)
1. Lancer **`add-push-history-cleanup.sql`** une fois dans Supabase › SQL Editor (après `add-scheduled-push.sql`). Sans danger si on le relance. Une colonne en plus, pas de nouvelle table : aucun `grant` à ajouter.
2. Publier le site (la phrase sous « Historique »). Le site peut être publié avant ou après le script : tant que le script n'est pas lancé, la phrase est cachée et rien ne change.

## Tests
- Base locale jetable : `sh tests/sql/run-push-history.sh` (24 contrôles : lignes anciennes effacées, récentes gardées, programmées jamais touchées, départ des 24 h à l'annulation et à l'envoi, accès administrateur inchangé, relance sans erreur).
- Navigateur : `PARTS=I` (la phrase de l'historique est affichée quand la colonne existe, cachée quand le script n'est pas lancé).
