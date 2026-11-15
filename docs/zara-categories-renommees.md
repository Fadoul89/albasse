# Catégories renommées : Zara et Google s'y retrouvent (15 novembre 2026)

Le patron a renommé des catégories dans l'administration. Le site (adresses, textes) a suivi, mais Zara et les robots utilisaient encore les anciennes adresses.

| Avant | Maintenant (adresse) | Effet constaté avant la correction |
| --- | --- | --- |
| Maison & Mobilier (`maison-mobilier`) | Maison & Bureau (`maison-bureau`) | l'annonce « Maison » pour les femmes ne marchait plus (corrigé dans la publication « Maison & Bureau ») |
| Montre (`montre`) | MONTRE & ACCESSOIRES (`montre-accessoires`) | **Zara ne reconnaissait plus les montres** : « cadeau pour lui » ne proposait plus de montre |
| Bébé et Maternité (`bebe-et-maternite`) | Produits pour bébés (`produits-pour-bebes`) | Zara ne reconnaissait plus les articles pour bébé |

## Zara
- `src/lib/assistantLang.ts` : `SHOP_SLUG_TO_KEY` / `zaraKey` / `shopSlugOf`. Zara garde ses clés d'origine (« montre », « bebe-et-maternite ») pour ses textes, ses cadeaux et ses conseils ; `assistantData.ts` donne cette clé aux catégories et aux articles ; le bouton « Page » (`AssistantPanel.tsx`) rouvre l'adresse réelle (`/categorie/montre-accessoires`).
- Noms arabes ajoutés : « Machines et équipements professionnels », « Ensemble safari ».
- **Si une catégorie est encore renommée**, ajouter sa correspondance dans `SHOP_SLUG_TO_KEY`.
- Tests : `tests/email/zara-slugs.test.ts` (8) ; `tests/zara/zara-brain.test.ts` : **937 vérifications, 0 échec** avec les vraies données (avant : 10 échecs « montres » et un arrêt en cours de route) ; navigateur partie `A` : 36 vérifications, 0 échec.

## Google
- Les anciennes adresses `/categorie/maison-mobilier` et `/categorie/bebe-et-maternite` étaient dans la liste « Détectée, actuellement non indexée » de Search Console et répondaient « introuvable ». Elles renvoient maintenant vers la nouvelle (**301**, redirection définitive), pour les robots comme pour les visiteurs avec un ancien lien (`oldCategoryRedirect` dans `netlify/edge-functions/lib/seo.ts`, branché dans `og-preview.ts`).
- Tests : `tests/seo/seo.test.ts` (132 vérifications).
