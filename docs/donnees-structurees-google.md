# Données structurées Google (fiches articles)

Chaque fiche article envoie à Google, en plus du nom, de la photo, du prix et du stock, **les conditions de retour** et **la livraison**. Le code est dans `netlify/edge-functions/lib/seo.ts` (testé par `tests/seo/seo.test.ts`).

## Ce que Google reçoit (seulement des faits vrais)
| Information | Valeur | D'où elle vient |
| --- | --- | --- |
| Retours (`hasMerchantReturnPolicy`) | Tchad, **3 jours (72 h)**, lien vers « Conditions de retour » | La page « Conditions de retour » : un article incorrect ou défectueux se signale dans les 72 h. Pas de « retour gratuit » (les frais dépendent du cas) ; rien sur les échanges de taille (pas de délai écrit). |
| Frais de livraison (`shippingDetails`) | De **0 à 2 500 FCFA** (gratuite à N'Djamena, 2 500 FCFA dans toutes les autres villes), Tchad | Admin › Livraison (Villes) : 43 villes actives, plus aucune « À définir » |
| Délai de livraison | **1 à 3 jours** (1 à 2 jours à N'Djamena, 1 à 3 jours ailleurs ; on garde le plus long) | Donné par le patron (31 octobre 2026) |

## Ce qui n'y est PAS, volontairement
- **Note et avis** (`aggregateRating`, `review`) : il n'y a pas d'avis de clients sur le site, et de fausses étoiles font pénaliser le site par Google. À ajouter seulement avec de **vrais avis** (idée : noter l'article après la livraison).
- **Marque et code GTIN** : non enregistrés dans les fiches ; on n'invente rien. Possible plus tard avec un champ « Marque » pour les articles qui en ont une vraie.

## Quand mettre à jour
Si les **frais** (autres que 2 500 FCFA) ou les **délais** changent, ou si la politique de retour change : modifier `SHIPPING_MAX_FEE`, `DELIVERY_DAYS` ou `RETURN_WINDOW_DAYS` dans `seo.ts`, lancer `node --import ./tests/zara/register.mjs tests/seo/seo.test.ts`, publier.

## Où vérifier
Google Search Console › Améliorations › « Extraits de produits » et « Fiches de marchand ». Google relit les pages en quelques jours ; les e-mails « problèmes non critiques » sur les retours et la livraison doivent alors disparaître. Les e-mails sur la note, l'avis et la marque restent : c'est normal (voir ci-dessus).

## Messages de Google Search Console du 9 novembre 2026 (« De nouvelles raisons empêchent l'indexation des pages »)
Raisons données par Google : « Page en double sans URL canonique sélectionnée par l'utilisateur », « Page en double : Google n'a pas choisi la même URL canonique que l'utilisateur », « Page avec redirection ».
- **Page avec redirection** : normal, rien à corriger. `http://` → `https://` et `albasseshopping.com` → `www.albasseshopping.com` sont des redirections voulues (301).
- **Sans URL canonique (pages d'information)** : `/contact`, `/conditions-de-retour` et `/confidentialite` (dans le plan du site) recevaient de Google la même coquille que toutes les autres adresses du site (titre « Albasse Shopping », aucune adresse canonique). Maintenant (`netlify/edge-functions/og-preview.ts` + `lib/seo.ts` : `INFO_PAGE_DEFS`, `infoPage`) chacune a **son titre, sa description, son texte tiré de la vraie page et son adresse canonique**. Les visiteurs normaux ne voient aucun changement. Les pages privées (compte, commande, connexion…) restent fermées par `robots.txt`.
- **Google n'a pas choisi la même canonique** : le catalogue contient des **copies identiques** (même nom ET même prix, adresses `…-2`, `…-3`) : 618 articles actifs, 38 groupes identiques, 78 pages, 40 copies en trop au 15 novembre 2026. Maintenant la page d'une copie annonce comme **adresse canonique la plus ancienne copie en stock** (sinon la plus ancienne ; `pickCanonicalSlug`, `copiesOf`), et le plan du site ne garde qu'**une adresse par groupe** (`withoutCopies`). Rien n'est supprimé : toutes les pages restent ouvertes aux clients. Deux articles de même nom mais de **prix différents** ne sont pas des copies. La vraie solution reste de supprimer ou fusionner les copies dans l'administration.
- **Données structurées (« Fiches de marchand », « Extraits de produits »)** : les messages ne disent pas le détail ; à lire dans Search Console (ouvrir le message, puis le rapport). Nos données respectent les champs obligatoires de Google (nom, image, prix, devise XAF, disponibilité, livraison, retours) ; jamais de fausse note ni de faux avis. Les « problèmes » sont en général des champs facultatifs absents (marque, code-barres, note).
- Tests : `tests/seo/seo.test.ts` (115 vérifications, dont 29 nouvelles).
