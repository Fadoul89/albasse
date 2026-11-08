# Zara et les émotions du client

Demande du patron (8 novembre 2026) : *« Zara doit apprendre : les gens n'achètent pas pour des raisons logiques, ils achètent pour des raisons émotionnelles. Ils sont prêts à tout pour ceux qui encouragent leurs rêves, justifient leurs échecs, apaisent leurs peurs, confirment leurs soupçons. »*

Zara écoute ce que le client écrit **de lui-même** (une phrase à la première personne : « je rêve de… », « j'ai raté… », « j'ai peur de… », « je me méfie… », « je n'ai plus d'argent ») et répond **d'abord à la personne, ensuite à l'article**. Elle comprend le français et l'arabe.

Règle de base, la même que partout chez Zara : **seul le VRAI parle.** Les émotions ne servent jamais à fabriquer une pression.

## Ce que Zara répond

| Ce que le client écrit | Ce que Zara fait | Exemple |
| --- | --- | --- |
| **Un rêve, une ambition** : « je rêve de devenir… », « mon objectif », « je veux réussir / impressionner / être respecté » | Elle **encourage**, puis propose son conseil (bouton « 🎯 Conseil »). Si le client demande aussi un article, elle y répond ensuite. Elle ne promet **rien** sur l'article. | « Quel beau rêve 🌟 Je crois en vous : tout grand projet commence par un premier pas. » |
| **Un échec, un découragement** : « j'ai raté mon entretien », « je n'ai pas de chance », « on s'est moqué de moi », « je me sens nul » | Elle **soutient sans juger** : un échec ne dit rien de la valeur de la personne. Aucune pression d'achat. | « Un échec ne dit rien de votre valeur : beaucoup de personnes se relèvent et repartent plus fortes. » |
| **Une peur** : « j'ai peur de me faire arnaquer », « je m'inquiète pour la livraison » | Elle dit que **c'est normal et qu'il a raison de poser la question**, puis donne des **faits vrais qu'il peut vérifier** : paiement à la réception à N'Djamena, boutique et sa carte, téléphone, « depuis 2013 ». | « Voici ce qui vous protège vraiment : » + les faits. |
| **Un soupçon** : « je me méfie », « j'ai des doutes », « c'est louche », « on m'a dit que c'est une arnaque » | Elle **confirme sa prudence** (« vous avez raison de vérifier avant d'acheter ») et donne les mêmes **faits contrôlables**. | « Ne me croyez pas sur parole : vérifiez ces points, vous les trouverez vrais. » |
| **Une difficulté** : « je n'ai plus d'argent », « je suis au chômage », « j'ai perdu mon travail », « mon père est décédé », « je suis malade », « j'ai des dettes » | **Aucune vente, aucune pression.** Seulement de la douceur, le bouton Menu et WhatsApp (l'équipe répond). Elle ne montre ni article ni promotion. | « Je suis vraiment désolée d'apprendre cela 🤍 Il n'y a aucune pression de ma part. » |

Si plusieurs émotions sont dans la même phrase, la **difficulté** passe d'abord, puis l'**échec**, le **soupçon**, la **peur**, le **rêve**.

## Ce que Zara ne fait JAMAIS (décidé avec le patron : elle dit la vérité)
- **Justifier un échec** : elle ne dit jamais « ce n'est pas votre faute » ni « c'est la faute des autres » (ce serait faux). Elle dit que l'échec ne définit pas la personne, et elle reste à ses côtés.
- **Confirmer un soupçon** : elle confirme que **vérifier est une bonne idée**, jamais une accusation (« vous avez raison, c'est une arnaque » n'existe pas). Elle ne critique pas les autres boutiques.
- **Promettre** une réussite, une guérison, un résultat (« cet article vous fera réussir » est interdit). **Aucune promesse de santé.**
- **Presser** quelqu'un de fragile : pas de « dernière chance », pas de culpabilité, pas de fausse rareté. Un client en difficulté n'entend **aucune** proposition d'achat.
- **Deviner** : rien n'est lu entre les lignes. « Un cadeau pour un malade » ou « j'ai perdu mon mot de passe » ne sont **pas** des émotions (le client parle d'un article ou d'un compte).

## Ce qui ne change pas
Les anciens sujets de Zara (confiance, retours, mot de passe, occasions comme le mariage, recherche d'article) répondent comme avant. Une émotion ajoute **une phrase chaleureuse avant** la réponse habituelle ; quand le client demande aussi un article, Zara l'encourage puis lui montre l'article.

## Où est le code
- Reconnaissance (fonctions pures) : `src/lib/assistantEmotion.ts`.
- Phrases françaises et arabes (2 à 3 variantes par émotion, Zara ne répète pas la même de suite) : `src/lib/assistantText.ts`, groupe `emotion`.
- Branchement dans le chat : `emotionReply` et `trustAnswer` dans `src/store/assistantStore.ts`.
- Pas de SQL, pas de fonction serveur.

## Tests
- Règles : `node --import ./tests/zara/register.mjs tests/zara/zara-emotion.test.ts` (34 contrôles : phrases reconnues en français et arabe, demandes normales jamais prises pour une émotion, priorité de la difficulté, aucune promesse ni pression dans les textes).
- Navigateur : partie `€` de `tests/zara/zara-ui.test.js`, bloc « j. Zara et les émotions » (rêve, échec, peur, soupçon, difficulté sans aucune vente, rêve + demande d'une montre, arabe).
