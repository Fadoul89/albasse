# Livraison programmée (clients de N'Djamena)

Pour un client qui commande à **N'Djamena**, la page de commande (et Zara dans le chat) propose de choisir un **jour** et une **heure** de rendez-vous. Zara écrit à l'administrateur sur **Telegram 10 minutes avant** le rendez-vous.

- La **livraison normale n'est pas affichée dans la liste** : le client voit seulement « Livraison programmée ».
- S'il ne choisit ni jour ni heure (ou touche « Passer » dans le chat), la commande est prise comme une **livraison normale**, comme avant.
- Un jour sans heure est refusé avec un message (il faut les deux, ou aucun). Toucher une 2ᵉ fois le jour choisi annule le rendez-vous.
- Dans les autres villes, rien de tout cela n'apparaît.

### Dans le chat de Zara
Après la ville (N'Djamena), Zara demande : « Voulez-vous choisir le jour et l'heure de votre livraison ? » avec les boutons des jours, « Passer » et « Annuler la commande ». Puis les heures (8h30 à 15h30) et « Autre jour ». Le client peut aussi écrire « demain », « jeudi », « 31/10 », « 14h30 », « midi ». Le récapitulatif et la confirmation rappellent le rendez-vous ; « Modifier » propose « 📅 Rendez-vous ». Tout existe en français et en arabe.

## Les règles (heure de N'Djamena)

| Règle | Valeur |
|---|---|
| Heures proposées | de 8h30 à 15h30, une heure toutes les 30 minutes |
| Délai minimum | le rendez-vous est au moins 2 h après la commande |
| Jours proposés | aujourd'hui (s'il reste des heures) jusqu'à dans 7 jours |
| Frais en plus | aucun (la livraison à N'Djamena reste gratuite) |

Ces valeurs sont dans `src/constants/shopRules.ts` (`SCHEDULED_DELIVERY`). La base les revérifie à l'enregistrement : le téléphone du client ne peut pas les contourner (`add-scheduled-delivery.sql`).

## Ce que voit l'administrateur

- Sur Telegram, **tout de suite** : « 📅 Livraison programmée demandée » (jour, heure, client, adresse), en plus du message « 🛒 Nouvelle commande ».
- Sur Telegram, **10 minutes avant** : « ⏰ Zara : livraison programmée dans N min » avec la date et l'heure, le numéro de commande, le client et son téléphone, l'adresse, les articles, l'emballage cadeau s'il y en a, le total, et **« À encaisser à la livraison »** ou le mode Mobile Money.
- Dans **Gestion des commandes** : un cadre « 📅 Livraison programmée : … » sur la commande.

Le rappel part **une seule fois** par commande. Il arrive entre 9 et 10 minutes avant le rendez-vous (la base vérifie chaque minute). Il ne part pas pour une commande annulée, déjà livrée ou signalée fausse, ni si le rendez-vous est passé depuis plus de 15 minutes.

## La règle des 48 h

Une commande « en attente » depuis plus de 48 h est signalée comme fausse commande. Pour une livraison programmée **payée à la livraison**, les 48 h comptent à partir du **rendez-vous** (sinon un rendez-vous dans 3 jours serait signalé avant d'avoir eu lieu). En **Mobile Money**, il faut toujours payer dans les 48 h après la commande. Les écrans (Mes commandes, Gestion des commandes) affichent le bon compte à rebours.

## Pour l'activer (dans cet ordre)

1. Lancer `add-scheduled-delivery.sql` dans Supabase › SQL Editor (une fois, sans danger à relancer). Un message d'essai part sur Telegram.
2. Ensuite seulement, publier le site.

Si le site est publié avant le script, un client qui choisit la livraison programmée voit « La livraison programmée n'est pas encore disponible. Choisissez la livraison normale. » : sa commande n'est **jamais** enregistrée sans son rendez-vous.

## Ce qui n'est pas inclus

- L'e-mail de confirmation au client ne mentionne pas encore le rendez-vous.
- Le client ne peut pas changer son rendez-vous lui-même (l'administrateur peut le déplacer).
- Le rappel va aux administrateurs qui ont lié Telegram (Compte › Lier Telegram).

## Tests

- Jours, heures et fuseau : `TZ=America/Los_Angeles node --import ./tests/zara/register.mjs tests/email/scheduled-delivery.test.ts` (65 contrôles : jours, heures, arabe, texte écrit par le client ; le résultat est le même sous tous les fuseaux).
- Script SQL sur un Postgres local jetable : `sh tests/sql/run-scheduled-delivery.sh` (78 contrôles : garde-fou, rappel, doublons, Telegram absent, règle des 48 h, relance du script).
- Navigateur : `PARTS=C node tests/zara/zara-ui.test.js dist 4333` (page de commande : choix à N'Djamena seulement, enregistrement, confirmation, Mes commandes, administration, script SQL pas encore lancé), `PARTS=O` (chat de Zara : jour, heure, « Passer », texte écrit, modification, ville changée, arabe).
