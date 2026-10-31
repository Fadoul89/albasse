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
