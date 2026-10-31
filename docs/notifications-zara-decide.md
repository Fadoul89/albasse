# Notifications : « Zara décide », jamais plusieurs en même temps

## Pourquoi

Avant, chaque nouvelle ligne de notification partait **tout de suite** sur tous les téléphones abonnés. Les nouveaux articles, les ventes flash
(plusieurs articles à la même minute) et les notifications programmées partaient donc sans limite : jusqu'à **28 par jour** (28 octobre).
Cela dérange les clients.

## Ce que fait le gardien (`add-push-gate.sql`)

Les notifications **automatiques** (vente flash, et nouvel article si l'interrupteur ci-dessous est rallumé) attendent dans une file (`push_outbox`). Un gardien passe chaque minute et en
envoie **une seule** quand tout est vrai :

| Règle | Réglage (par défaut) |
|---|---|
| Écart minimum depuis la dernière notification | `push_min_gap_minutes` = 180 (3 h) |
| Plafond de notifications automatiques par jour (heure du Tchad) | `push_max_per_day` = 2 |
| Fenêtre d'envoi (heure du Tchad) | `push_window_start` = 9, `push_window_end` = 20 |
| Heure très fréquentée : au-dessus de la moyenne des visiteurs de la fenêtre, sur 30 jours | automatique |

- Avec vos visites actuelles, les bonnes heures sont **9 h à 13 h et 19 h** ; 14 h–17 h et la nuit sont évitées. Avec moins de 100 regards
  sur 30 jours, toutes les heures de la fenêtre sont bonnes.
- **Regroupement** : plusieurs annonces du même genre en attente (ex. 4 ventes flash) partent en **une** notification (« 🔥 4 promotions en cours »)
  qui présente l'article le plus regardé de la semaine. Les promotions passent avant les nouveaux articles.
- **Jamais de faux** : un article épuisé ou désactivé, ou une vente flash déjà terminée, n'est jamais annoncé. Une annonce qui attend depuis plus
  de 24 h est abandonnée.
- **Notifications programmées par l'administrateur** (Promotions intelligentes) : elles partent à l'heure qu'il a choisie (la fenêtre et le
  plafond ne s'appliquent pas), mais respectent l'écart : jamais deux en même temps, et elles passent avant les automatiques. « Envoyer
  maintenant » les envoie dès que l'écart est respecté. Une programmée pour un article épuisé est abandonnée.
- La cloche des clients (liste des notifications) reçoit la notification au moment où elle part, comme avant.

## Notifications de nouveaux articles : ÉTEINTES par défaut

Avant, chaque article publié envoyait tout de suite une notification à tous les téléphones (la case « notify_on_publish » est cochée par défaut et
n'apparaît pas dans le formulaire article). Maintenant, **publier un article n'envoie rien** tant que l'interrupteur
« 🛍️ Notification automatique des nouveaux articles » (page **Promotions intelligentes**, dans la section des notifications programmées) est éteint.

- Pour les rallumer plus tard : touchez l'interrupteur, ou `update store_settings set push_new_products_enabled = true where id = 1;`.
- Rallumés, les nouveaux articles passent par le gardien (une seule notification à la fois, aux bonnes heures, regroupées).
- Éteints, rien n'est envoyé ni mis dans la cloche des clients ; une annonce « nouvel article » restée en attente dans la file est abandonnée.
- Script : `add-push-new-products-switch.sql` (marche **seul**, sans le gardien, et dans n'importe quel ordre avec `add-push-gate.sql`, qui contient la même fonction).
- Les ventes flash et les notifications programmées par l'administrateur ne dépendent pas de cet interrupteur.

## Interrupteur du gardien

`update store_settings set push_gate_enabled = false where id = 1;` : le gardien s'éteint et envoie d'un coup tout ce qui attend, puis tout
repart tout de suite comme avant. Pour le rallumer : `= true`. Les autres réglages se changent de la même façon (`update store_settings set push_max_per_day = 3 where id = 1;`).

## Voir ce qui attend

```sql
select kind, status, title, note, created_at at time zone 'Africa/Ndjamena' as cree from push_outbox order by created_at desc limit 30;
```

## Tests

`sh tests/sql/run-push-gate.sh` (Postgres local jetable, jamais la vraie base) : 68 contrôles (horaires, écart, plafond, regroupement,
programmées, interrupteurs, droits d'accès). `sh tests/sql/run-push-new-switch.sh` : l'interrupteur « nouveaux articles » seul, puis avec le gardien
dans les deux ordres d'installation. Navigateur : partie `I` de `tests/zara/zara-ui.test.js`.
