# Zara Marketing Intelligence

Campagnes e-mail quotidiennes, ciblées et vérifiées, envoyées par **Brevo** (l'intégration déjà en place dans la fonction `brevo-email`).
Le module ne reconstruit rien de Zara King : il réutilise la file d'envoi (`email_outbox`), la désinscription (`email_prefs`), le plafond
journalier (`EMAIL_DAILY_CAP`) et la clé Brevo déjà configurée.

**À l'installation rien ne part.** Le mode est « éteint ». Un envoi réel demande trois contrôles réussis, la validation de l'administrateur
(il tape ACTIVER) et, par défaut, son approbation de chaque campagne.

## Où est quoi

| Élément | Fichier |
| --- | --- |
| Moteur (vérification des articles, segments, centres d'intérêt, conseils de style, consentements, fréquence, textes FR/AR, plan du jour, verrou) | `supabase/functions/brevo-email/marketing.ts` |
| Apprentissage (meilleure variante d'objet, ordre des segments, pause automatique, alerte plaintes) | `supabase/functions/brevo-email/marketingLearning.ts` |
| Déroulement (simulation, approbation, mise en file, suivi des résultats, passage horaire) | `supabase/functions/brevo-email/marketingRun.ts` |
| Rapport de l'administrateur | `supabase/functions/brevo-email/marketingReport.ts` |
| Contrôle de la connexion à Brevo (lecture seule) | `supabase/functions/brevo-email/brevoCheck.ts` |
| Envoi (relecture au dernier moment) | `supabase/functions/brevo-email/drain.ts` |
| Actions de la fonction | `supabase/functions/brevo-email/index.ts` |
| Base : réglages, journal, campagnes, colonnes de suivi, tâche horaire | `add-marketing-intelligence.sql` |
| Écran administrateur | `src/screens/admin/AdminMarketingAIScreen.tsx` (Admin › Marketing › Zara Marketing (e-mails)) |

## Variables d'environnement (Supabase › Edge Functions › Secrets)

Aucune nouvelle variable n'est obligatoire. Rien de secret n'est écrit dans le dépôt ni renvoyé à l'application.

| Nom | Rôle | Par défaut |
| --- | --- | --- |
| `BREVO_API_KEY` | clé Brevo **existante** (jamais affichée, jamais journalisée) | obligatoire |
| `EMAIL_SENDER` | adresse d'expédition acceptée par Brevo | `contact@albasseshopping.com` |
| `EMAIL_SENDER_NAME` | nom affiché | `Albasse Shopping` |
| `EMAIL_DAILY_CAP` | plafond global d'e-mails par jour (commandes, bienvenue, publicité, campagnes) | `150` |

Le secret qui relie la base à la fonction (`email_cron_secret`) est dans le coffre-fort Supabase (créé par `add-order-emails.sql`).

La clé Brevo d'Albasse Shopping est une clé **limitée** : Brevo refuse la lecture du compte, des expéditeurs et du domaine, mais laisse
lire le journal des e-mails (livraisons, clics, rebonds, plaintes). C'est suffisant et plus sûr : le contrôle l'accepte (« clé limitée »).
Ce qui prouve que la clé sait **envoyer**, c'est l'e-mail de test confirmé par Brevo (identifiant du message), pas ce contrôle.

## Ce que fait Zara chaque jour (à l'heure réglée, heure de N'Djamena)

1. **Vérifie chaque article** : actif, en stock, prix valable, lien, photo ; remise annoncée seulement si elle est réelle (5 à 60 % ; au-delà, c'est
   probablement une erreur de saisie : la remise n'est pas annoncée et l'article est signalé) ; vente flash annoncée seulement si elle est réellement
   en cours ; « plus que N en stock » seulement s'il en reste 3 ou moins.
2. **Écarte** les clients sans adresse réelle, bloqués, administrateurs, **désinscrits**, **en suppression** (rebond dur, plainte), ceux qui ont commandé
   depuis moins de 3 jours, ceux déjà sollicités récemment (minimum 7 jours, maximum 3 e-mails sur 30 jours, réglables).
3. **Segmente** : chaque client reçoit au plus UNE campagne, celle du premier segment qui lui convient, dans cet ordre.

   | Segment | Qui | Accord requis |
   | --- | --- | --- |
   | Vente flash | une vente flash est réellement en cours | alertes ventes flash |
   | Articles favoris | un favori est en vente flash, en vraie promotion ou presque épuisé | promotions |
   | Fidélité | 4 commandes livrées ou plus, remise −10 % pas encore utilisée | promotions |
   | Clients à reconquérir | dernière commande livrée il y a plus de 30 jours, rien depuis | promotions |
   | Amateurs de parfums | la rubrique la plus forte du client est « parfums » (voir ci-dessous) | promotions |
   | Acheteurs de vêtements | la rubrique la plus forte est « vêtements » (Vêtements et Vêtements pour femmes ensemble) | promotions |
   | Intéressés par une catégorie | la rubrique la plus forte est une autre catégorie (chaussures, montres, « Maison & Mobilier »…) | promotions |
   | Nouveautés | au moins 3 articles de moins de 14 jours | alertes nouveaux articles |
   | Clients absents | absent depuis 7 jours ou plus | promotions |
   | Nouveaux comptes | compte de 2 à 14 jours, sans commande | promotions |

   **Centres d'intérêt** : Zara ne regarde que ce que le client a fait lui-même : un article **acheté** (3 points), un article **cliqué dans un de nos
   e-mails** (2 points, lu chez Brevo), un article mis en **favori** (1 point). À partir de 2 points dans une rubrique, le client a un centre
   d'intérêt ; s'il en a plusieurs, la plus forte gagne (à égalité : l'ordre alphabétique, toujours le même). Les articles simplement **regardés**
   (suivi de navigation automatique, sans choix du visiteur) ne servent **jamais**. Une rubrique regroupe des catégories voisines (reconnues par leur
   nom : parfum, vêtement, chaussure, montre, sac, lunettes) ; toute autre catégorie est sa propre rubrique. L'e-mail ne montre que des articles de
   cette rubrique (jusqu'à 4), jamais un article déjà acheté ni déjà montré récemment.

4. **Choisit des articles vérifiés**, jamais déjà achetés, jamais ceux des 3 derniers e-mails, au plus 4 dont 2 par catégorie (la limite par catégorie
   ne s'applique pas à un segment d'intérêt, déjà ciblé) ; sinon le client est écarté (« pertinence plutôt que volume »).
5. **Rédige** : objet et texte propres au segment, 3 variantes (A, B, C ; jamais la même deux fois de suite pour un client), français ou arabe
   (de droite à gauche). Objets de 60 caractères au plus, ligne d'aperçu, un seul bouton. Les liens portent
   `utm_source=zara&utm_medium=email&utm_campaign=zmi-AAAAMMJJ-segment` pour rattacher les commandes.
   Les e-mails d'intérêt (parfums, vêtements, chaussures, montres, sacs, lunettes) et ceux des nouveaux comptes portent un **conseil de style** :
   un vrai conseil d'usage, court, écrit d'avance en français et en arabe (`TIPS`), sans prix, sans promesse, un seul par e-mail, toujours le même
   pour le même client le même jour. Une catégorie sans famille connue (« Maison & Mobilier »…) n'a **pas** de conseil : Zara n'en invente pas.
6. **Applique la limite du jour** (50 par défaut), en gardant d'abord les segments prioritaires.
7. **Simulation** : écrit le plan et le rapport, **rien** dans la file d'envoi, aucun code de désinscription créé, aucun appel à Brevo.
   **Mode actif** : met en file (après approbation par défaut) ; les e-mails partent goutte à goutte (5 par minute au plus), après ceux des commandes.
8. **Au moment de l'envoi**, tout est relu : accord, désinscription, suppression, compte bloqué, articles (prix, stock, remise, vente flash). Ce qui ne
   passe plus est annulé avec sa raison.
9. **Résultats** : Brevo répond par un identifiant de message = confirmation d'acceptation. Livraison, clics, rebonds et plaintes sont lus chez Brevo
   (journal des e-mails). Un rebond dur, un blocage, une adresse invalide ou une plainte met l'adresse en **suppression** tout de suite.

## Ce que Zara apprend (clics, commandes attribuées, désinscriptions, plaintes)

Chaque passage relit les résultats des campagnes des 30 derniers jours (60 pour les objets) et en tire des réglages pour les suivantes.
Seuls les e-mails **mesurés** comptent (identifiant du message connu **et** événements lus chez Brevo) : un résultat pas encore lu n'est jamais compté
comme « 0 clic ». Rien n'est conclu sans assez de mesures ; en dessous, Zara garde ses règles de départ et le dit.

| Ce qu'elle regarde | Ce qu'elle en fait |
| --- | --- |
| **Clics** par objet (A, B, C) d'un segment | À partir de 30 e-mails mesurés par objet, si le meilleur a au moins 25 % de clics en plus et 2 points d'écart : 7 clients sur 10 le reçoivent, les 3 autres continuent d'essayer les trois. |
| **Clics, commandes attribuées, désinscriptions, plaintes** par segment | À partir de 100 e-mails livrés par segment, les segments sont classés par *valeur* = clics + 10 × commandes attribuées − 10 × désinscriptions − 20 × plaintes (par e-mail livré). Vente flash, favoris et fidélité gardent toujours leur place en tête (échéance ou récompense promise) ; un segment sans assez de mesures garde sa place. |
| **Désinscriptions** (dans les 7 jours après l'e-mail, rattachées au dernier e-mail reçu) | Plus de 2 % des e-mails livrés (à partir de 50) : le segment est mis en **pause** tout seul. |
| **Plaintes** | 2 plaintes ou plus dépassant 0,3 % des e-mails livrés : segment en pause. 3 plaintes ou plus dépassant 0,3 % au total : **tous les envois sont suspendus** (blocage : le verrou ne peut plus s'ouvrir tant que la cause n'est pas corrigée et qu'une simulation sans blocage n'est pas refaite). L'adresse qui se plaint est de toute façon mise en suppression tout de suite. |
| **Rebonds définitifs** | Plus de 5 % des e-mails mesurés (à partir de 50) : segment en pause. |
| **Articles cliqués** dans les e-mails (lien lu chez Brevo) | Ils nourrissent les centres d'intérêt de chaque client (2 points par article cliqué). Si Brevo ne donne pas le lien cliqué, cela ne sert simplement pas. |

Une pause concerne un segment, pas les clients : un client dont le segment est en pause passe au segment suivant qui lui convient, sinon il est
écarté (« segment en pause »). Tout est visible dans l'écran : carte « Ce que Zara a appris » (notes en français, segments en pause, tableau des 30
jours avec « — » pour ce que Brevo n'a pas encore donné). Les seuils sont dans `marketingLearning.ts` (`HEALTH`, `MIN_VARIANT_SAMPLE`,
`MIN_SEGMENT_SAMPLE`).

## Le verrou (aucun envoi réel sans les contrôles)

« Actif » est refusé tant que ces trois contrôles ne sont pas valables, **dans la fonction et dans la base** (déclencheur `marketing_ai_guard`) :

1. contrôle Brevo réussi depuis moins de 24 h (refait automatiquement à chaque passage) ;
2. simulation sans blocage depuis moins de 48 h (refaite à chaque passage) ;
3. e-mail de test, vers l'administrateur seulement, **confirmé par Brevo** (identifiant du message) depuis moins de 30 jours ;

et l'administrateur tape **ACTIVER**. Si un contrôle cesse d'être bon pendant que le mode est actif, le mode retombe tout seul en « simulation » et
l'envoi de ce qui attendait est annulé. Les e-mails de campagne en attente sont annulés (« verrou ») dès que le mode n'est pas « actif et validé ».

## Désabonnement et suppression

- Chaque e-mail a un lien « Me désinscrire » (page du site) et l'en-tête `List-Unsubscribe` en un geste (bouton de la messagerie).
- La désinscription coupe seulement les e-mails publicitaires (pas ceux des commandes). Elle est relue juste avant chaque envoi.
- Accord = réglages du profil du client : `notify_promotions`, `notify_new_products`, `notify_flash_sale`.

## Rapport

Écran administrateur : e-mails mis en file, acceptés, confirmés, livrés, clics, désinscriptions, rebonds, plaintes, refus, commandes et revenu
attribués, segments et variantes comparés, erreurs. Un chiffre lu chez Brevo reste « non mesuré » tant qu'il n'a pas été lu (jamais 0).
Les commandes attribuées sont celles de la visite ouverte par un clic dans l'e-mail ; le revenu ne compte que les commandes livrées et non
signalées fausses.

## Étapes pour activer l'automatisation

1. Fusionner la branche (l'écran apparaît dans l'administration ; il dit « Une étape manque » tant que le script SQL n'est pas lancé).
2. Lancer `add-marketing-intelligence.sql` dans Supabase › SQL Editor (sans danger : mode éteint, rien ne part).
3. Déployer la fonction `brevo-email` à jour (sans changer la clé).
4. Dans l'écran : **Contrôler Brevo**, **Simuler**, relire le plan et les aperçus, **Envoyer le test** (confirmé par Brevo), puis **Simulation** comme mode.
5. Laisser tourner la simulation plusieurs jours (rapport quotidien) ; vérifier les alertes (remises suspectes, vente flash restée cochée…).
6. Seulement alors : **Activer les envois**, en gardant « me demander d'approuver chaque campagne ». L'approbation automatique est un second choix
   explicite, à faire plus tard.
7. Optionnel : une fois « actif », éteindre l'ancienne publicité « absents depuis 7 jours » (elle s'efface déjà d'elle-même tant que Zara Marketing est actif).

## Tests

```
node --import ./tests/zara/register.mjs tests/email/marketing.test.ts        # moteur : 127 vérifications
node --import ./tests/zara/register.mjs tests/email/marketing-interest.test.ts # centres d'intérêt, conseils de style : 57
node --import ./tests/zara/register.mjs tests/email/marketing-learning.test.ts # apprentissage, pauses, ordre, variantes : 49
node --import ./tests/zara/register.mjs tests/email/marketing-run.test.ts    # déroulement, verrou, envoi, de bout en bout : 91
node --import ./tests/zara/register.mjs tests/email/marketing-report.test.ts # rapport : 12
node --import ./tests/zara/register.mjs tests/email/marketing-ui-lib.test.ts # l'écran et le verrou du serveur sont d'accord
node --import ./tests/zara/register.mjs tests/email/brevo-check.test.ts      # contrôle Brevo : la clé n'apparaît jamais
```
Interface : `PARTS=C node tests/zara/zara-ui.test.js` (écran Zara Marketing, mode d'emploi du verrou).

## Limites connues (à décider)

- La langue des clients n'est pas enregistrée : elle est déduite de l'écriture du nom (arabe ou français). La colonne `email_prefs.lang` est prête.
- Les interactions de navigation (suivi de navigation de Zara) ne sont pas rattachées aux comptes : elles ne servent pas à cibler. Les achats, les
  favoris et les articles cliqués dans nos e-mails, eux, sont utilisés (voir « Centres d'intérêt »).
- Les articles cliqués ne sont connus que si Brevo renvoie le lien cliqué dans ses événements. Cela se vérifiera aux premiers vrais clics ; sinon
  les centres d'intérêt reposent sur les achats et les favoris (rien ne casse).
- L'apprentissage a besoin de volume : avec 50 e-mails par jour, il faut plusieurs semaines pour que chaque objet atteigne 30 mesures et chaque
  segment 100 e-mails livrés. D'ici là, Zara garde ses règles de départ et le dit dans la carte « Ce que Zara a appris ».
- Les commandes attribuées ne comptent que la visite ouverte par un clic dans l'e-mail : un client qui commande plus tard, depuis une autre visite,
  n'est pas compté. L'apprentissage sous-estime donc un peu les commandes (de façon égale pour tous les segments).
- Presque tous les articles affichent un ancien prix barré : le moteur n'annonce que les remises vraies (5 à 60 %), mais elles ne distinguent
  aucune offre. Garder l'ancien prix seulement pour les vraies promotions rend les campagnes plus pertinentes.
- Le consentement est celui des réglages du profil (`notify_*`). Si la loi ou votre politique demande un consentement explicite à l'inscription,
  il faut ajouter une case à l'inscription avant d'activer.
