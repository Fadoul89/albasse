# « Dernier e-mail Zara » sur chaque fiche client (Admin › Clients)

Demande du patron (6 novembre 2026) : *« Pourquoi Zara n'envoie pas d'e-mail aux personnes absentes ? »* — en vérité Zara en envoie déjà (l'e-mail « absents depuis 7 jours », 527 envoyés depuis le 25 octobre, au plus 1 tous les 14 jours par client), mais **la fiche du client ne le montrait pas**. Zara Marketing (e-mails par centre d'intérêt) reste en « simulation » tant que le patron n'a pas tapé ACTIVER.

## Ce que montre la ligne (sous « Créé le … »)
| Cas | Ligne |
| --- | --- |
| Un e-mail Zara a été envoyé | `✉️ Dernier e-mail Zara : 5 nov. 2026 · il y a 1 j · e-mail « absents »` (ou `campagne Zara Marketing`), puis `· 1 clic` s'il y en a |
| Adresse refusée (rebond définitif), plainte, ou promotions refusées depuis | la même ligne, **en rouge**, avec la mention |
| Compte créé avec le téléphone seulement | `✉️ Pas d'adresse e-mail : Zara ne peut pas lui écrire (WhatsApp seulement)` |
| Compte bloqué | `✉️ Aucun e-mail Zara : compte bloqué` |
| N'a pas accepté les promotions | `✉️ Aucun e-mail Zara : n'a pas accepté les promotions` |
| Connecté il y a moins de 7 jours | `✉️ Aucun e-mail Zara : connecté il y a moins de 7 jours` |
| Rien envoyé, aucune raison connue | `✉️ Aucun e-mail Zara envoyé pour l’instant` (sans inventer de raison) |
| Lecture impossible (réseau, droits) | **aucune ligne** (jamais un faux « aucun e-mail ») |

## Ce qui compte
- Seulement les e-mails **publicitaires de Zara** : `promo_inactive` (« absents ») et `marketing` (Zara Marketing), au statut **« sent »** avec une date d'envoi. Les e-mails de bienvenue et de commande ne comptent pas ; « en attente », « annulé », « ignoré », « échoué » non plus.
- Le plus récent par client. La base ne renvoie que 1 000 lignes par demande : l'écran lit page par page (10 000 e-mails au plus) ; au-delà, un client sans ligne n'affiche rien (jamais un faux « aucun e-mail »).

## Ce qui ne change pas
- **Aucun script SQL** : la table `email_outbox` est déjà lisible par l'administrateur (règle `email_outbox_admin_read`, droit `select` pour `authenticated`). Rien n'est écrit dans la base.
- Aucun e-mail n'est envoyé par cet écran ; les règles d'envoi de Zara (fréquence, désinscription, plafond) ne changent pas.

## Où est le code
- Règles pures : `src/lib/lastEmail.ts` (test : `node --import ./tests/zara/register.mjs tests/email/last-email.test.ts`).
- Lecture : `src/lib/lastEmailData.ts` ; affichage : `src/screens/admin/AdminCustomersScreen.tsx` (`testID="customer-last-email"`).
- Test dans le navigateur : partie `^` de `tests/zara/zara-ui.test.js` (fausse base : e-mail envoyé avec clic, adresse refusée, rien envoyé, compte téléphone, panne de lecture).
