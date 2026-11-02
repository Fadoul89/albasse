# Zara apprend les « mots qui vendent »

Demande du patron : Zara doit utiliser les bons mots pour parler au client — **VOUS, GRATUIT, PARCE QUE, SANS RISQUE, EXCLUSIF, IMMÉDIAT, COURTE DURÉE** — la phrase **« X % des clients ont aussi acheté ceci »** et le bouton **« Finalisez votre commande »**.

Règle de base, décidée avec le patron : **chaque mot n'est dit que s'il est VRAI.** Aucun pourcentage inventé, aucune fausse rareté, aucune fausse urgence. Sans donnée solide, Zara ne dit rien.

Le code est dans `src/lib/assistantWords.ts` (fonctions pures, testées dans `tests/email/zara-words.test.ts`) ; le branchement est dans `src/store/assistantStore.ts` (la commande dans le chat).

## Ce que dit Zara, et d'où vient la vérité

| Mot | Où Zara le dit | Pourquoi c'est vrai |
| --- | --- | --- |
| **VOUS** | partout | Zara dit « vous » à la personne, jamais « les clients ». |
| **GRATUIT** | début de la commande dans le chat, récapitulatif, confirmation | Le **cadeau surprise** (« Un petit cadeau dans le colis ») est offert à **toute commande confirmée dans le chat de Zara**. |
| **EXCLUSIF** | avec le cadeau : « Offre réservée au chat » | Le cadeau n'existe **que** pour les commandes du chat : la page de commande du site ne le donne pas. |
| **SANS RISQUE** | au moment du paiement | À N'Djamena : « vous payez seulement quand vous recevez ». Ailleurs : retour sous 72 h d'un article incorrect ou défectueux, frais de retour à notre charge (les vraies règles de la boutique). |
| **PARCE QUE** | récapitulatif | Chaque appel à confirmer donne sa raison : la commande est enregistrée tout de suite, et le cadeau part avec elle. |
| **IMMÉDIAT** | confirmation | « Notre équipe vient de recevoir votre commande » : la commande arrive tout de suite dans l'admin (et l'alerte Telegram). |
| **COURTE DURÉE** | récapitulatif | **Seulement une vraie échéance** : la fin de la vente flash ou de la promotion de l'article (« Ce prix se termine dans 5 h »), sinon les **48 h de validité** de la commande. Jamais de compte à rebours inventé. |
| **« X % des clients ont aussi acheté ceci »** | début de la commande | Voir plus bas : le pourcentage est calculé avec les vraies commandes, avec des seuils. |
| **« Finalisez votre commande »** | bouton du menu, rappels, « Annuler la commande » | Remplace « Terminer ma commande » partout (chat, tests, aide). |

En arabe, les mêmes phrases existent (« أكمل طلبك الآن », « هدية مفاجأة مجانية », « بدون مخاطرة »…).

## Le cadeau surprise

- **Qui** : toute commande **confirmée dans le chat de Zara** (et seulement là).
- **Quoi** : « Un petit cadeau dans le colis ». Le contenu est choisi par l'équipe ; aucune valeur n'est promise.
- **Comment on sait que la commande vient du chat** : la commande du chat note l'appareil du client dans la colonne `orders.assistant_device` (déjà en place, script `add-assistant-stats.sql`). Une commande du site n'a pas cette valeur. Règle : `hasChatGift(order)` = appareil non vide.
- **Où le cadeau est écrit** :
  - **Facture** (écran *Facture* du site **et** PDF envoyé par la fonction `order-invoice`) : une ligne « **Cadeau surprise (Zara) — Offert** » juste avant la livraison. Elle ne change pas le total.
  - **Admin › Commandes** : le badge « 🎁 Cadeau surprise à mettre dans le colis (commande passée avec Zara) » (l'équipe sait quoi mettre dans le colis).
  - **Mes commandes** (client) : « 🎁 Cadeau surprise offert dans votre colis (commande passée avec Zara) ».
  - **Dans le chat** : à l'ouverture de la commande, au récapitulatif et à la confirmation.

## « X % des clients ont aussi acheté ceci » — le vrai pourcentage

Script SQL : **`add-product-affinity.sql`** (fonction `product_affinity(p_product_id)`), à lancer par le patron dans Supabase › SQL Editor. Elle ne renvoie que des **totaux** (jamais un nom, un numéro ou une adresse de client) :

- `customers` / `bought_with` : combien de clients ont acheté l'article, et combien ont acheté chaque autre article avec lui (commandes non annulées, non « fausses », 365 derniers jours ; un client = un compte, ou le téléphone de livraison pour une commande sans compte ; un client compte une seule fois).
- `viewers` / `viewed_with` : même chose pour la navigation (visiteurs distincts, 90 derniers jours).

Le pourcentage est **calculé par le site** à partir de ces nombres, et **dit seulement si les chiffres sont assez solides** :

| | Achats (prioritaire) | Navigation (sinon) |
| --- | --- | --- |
| Au moins | **5 clients** ayant acheté l'article | **20 visiteurs** ayant regardé l'article |
| Dont | **2 clients** ont acheté l'autre article | **5 visiteurs** ont regardé l'autre |
| Et un pourcentage d'au moins | **20 %** | **30 %** |
| Phrase | « 👥 40 % des clients qui ont acheté « A » ont aussi acheté « B » » | « 👀 35 % des visiteurs qui ont regardé « A » ont aussi regardé « B » » |

Ainsi, la phrase « acheté » apparaîtra **plus tard**, quand il y aura assez de vraies commandes (au 2 novembre 2026, la base n'a aucune commande). D'ici là, Zara peut dire la phrase « regardé » si la navigation le permet, **et dit clairement « regardé », jamais « acheté »**. L'autre article doit être en stock et en vente.

Tant que le script SQL n'est pas lancé (ou en cas de panne), Zara ne dit **aucun** pourcentage et la commande se passe comme avant.

## Ce qui a changé dans le parcours de commande (chat)

1. **Début** : « Parfait, finalisons votre commande ensemble ! » + 🎁 cadeau surprise (réservé au chat) + (si vrai) la phrase « X % ».
2. **Paiement** : la question habituelle + ✅ « Sans risque : … » (selon la ville).
3. **Récapitulatif** : le récapitulatif habituel + 🎁 cadeau + ⚡ « Finalisez votre commande maintenant : elle est enregistrée tout de suite… » + ⏳ la vraie échéance (fin de promotion, sinon 48 h).
4. **Confirmation** : « enregistrée » + ⚡ « Notre équipe vient de recevoir votre commande » + 🎁 « Votre cadeau surprise sera dans votre colis (il est écrit sur votre facture) ».

## Pour le patron : à lancer

1. **Le site** (publication) : dès son « Oui » (une publication coûte 15 crédits Netlify).
2. **Le script SQL** `add-product-affinity.sql` (Supabase › SQL Editor) : seulement pour le « X % ». Sans lui, tout le reste marche.
3. **La fonction `order-invoice`** (pour la ligne « Cadeau surprise » sur le **PDF**) : à déployer après son « Oui ». L'écran *Facture* du site, lui, est mis à jour par la publication du site.

## Tests

- Règles : `node --import ./tests/zara/register.mjs tests/email/zara-words.test.ts` (43 vérifications : seuils, pourcentage, échéances, arabe, aucune promesse de santé).
- Facture PDF : `node --import ./tests/zara/register.mjs tests/email/invoice-pdf.test.ts` (ligne du cadeau seulement pour une commande du chat ; mêmes mots que l'écran).
- SQL (Postgres local jetable) : `sh tests/sql/run-product-affinity.sh` (18 vérifications : clients comptés une fois, annulées / fausses / anciennes exclues, 5 premiers, aucune donnée personnelle, droits).
- Navigateur : `PARTS=O` (parcours de commande dans le chat) et `PARTS=§` (« mots qui vendent » : cadeau, sans risque, échéance vraie, pourcentage).
