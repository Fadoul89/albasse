# Zara choisit la Vente flash et les Promotions

## Ce que ça fait (en simple)
1. **La Vente flash dure 24 h puis disparaît** toute seule (section de l'accueil, compte à rebours, ancien prix).
2. **L'ancien prix barré n'est montré que pour les vraies promotions** : une Vente flash en cours ou une Promotion de Zara en cours, avec une vraie remise (5 % à 60 % ; au-delà, c'est une erreur de saisie). Les autres articles montrent seulement leur prix. **Rien n'est effacé** : l'ancien prix est mis de côté dans la base (`old_price_saved`).
3. **Vente flash AUTOMATIQUE** (interrupteur, éteint au départ) : quand il est allumé, dès qu'une Vente flash est finie, **Zara choisit seule les 4 articles suivants** pour 24 h (vérification toutes les 5 minutes, dans la base). Elle n'en lance pas une nouvelle tant qu'une Vente flash est en cours (la vôtre ou la sienne), ne reprend jamais un article qui a eu une Vente flash depuis moins de 3 jours, et ne choisit rien si les visites ne suffisent pas.
4. **Choix à la main** (Vente flash et Promotions) : Zara propose d'après les statistiques réelles du site (vues, ajouts au panier, j'aime, ventes, stock) ; l'administrateur voit la liste et les raisons, puis touche **« Valider et publier »**. Rien n'est publié avant.
5. **Zara ne modifie JAMAIS le prix d'un article.** Aucune fonction du script n'écrit la colonne `price` (un test le vérifie). Elle choisit seulement parmi les articles qui ont déjà un ancien prix donnant une vraie remise.

Où : Admin › **Promotions intelligentes** › carte **« ⚡ Zara choisit : Vente flash et Promotions »** : l'interrupteur **« ⚡ Vente flash automatique par Zara »** (avec le dernier choix automatique), puis les boutons « 🔎 Zara, choisis les articles », « ✅ Valider et publier » et « ⏹ Arrêter la Vente flash et les promotions » (qui coupe **aussi** la Vente flash automatique).

## Les réglages choisis (modifiables dans `src/lib/zaraPromoPicker.ts`)
| Réglage | Valeur |
| --- | --- |
| Vente flash | 4 articles, 24 h |
| Promotions | 12 articles, 7 jours (section « 🏷️ PROMOTIONS » de l'accueil) |
| Stock minimum | 5 pour la Vente flash, 3 pour une Promotion |
| Intérêt minimum (vues + 5 × paniers + j'aime, 20 au plus) | 5 pour la Vente flash, 3 pour une Promotion |
| Même rubrique | 2 articles au plus en Vente flash, 3 en Promotion |
| Repos après une Vente flash | 3 jours (l'article peut aller en Promotion) |
| Vérification automatique | toutes les 5 minutes (tâche `zara-auto-flash`) |

**Vente flash** = les articles les plus demandés (avec du stock et une vraie remise). **Promotions** = les articles regardés mais peu achetés (une remise peut les décider), un peu de chaque rubrique. Pas assez de visites : Zara propose moins d'articles et le dit, jamais un choix au hasard. Un article déjà en promotion n'est pas reproposé tout de suite, et un article qui vient d'avoir une Vente flash se repose 3 jours : les choix tournent.

La Vente flash automatique applique **exactement les mêmes règles** que les propositions de l'écran : elles sont écrites deux fois (en SQL pour la tâche automatique, dans `zaraPromoPicker.ts` pour l'écran) et un test SQL reprend le même exemple que le test des fonctions pures.

## Fichiers
| Élément | Fichier |
| --- | --- |
| Base : colonnes, nettoyage toutes les 5 min, Vente flash automatique, statistiques, publication, arrêt | `add-zara-promotions.sql` |
| Test de la base sur un Postgres local jetable | `tests/sql/run-zara-promotions.sh` (+ `zara-promotions-stubs.sql`, `-catalog.sql`, `-checks.sql`) |
| Règles d'affichage (vente flash finie, ancien prix seulement en promotion) | `src/lib/promotions.ts` |
| Choix de Zara (fonction pure) | `src/lib/zaraPromoPicker.ts` |
| Carte administrateur | `src/components/ZaraPromoPicker.tsx` (dans `AdminPromotionsScreen.tsx`) |
| Accueil (Vente flash en cours, section Promotions) | `src/screens/HomeScreen.tsx` |
| Tests | `tests/email/zara-promotions.test.ts`, partie 8 de `tests/zara/zara-ui.test.js` |

## Ce que fait le script SQL
- Colonnes : `products.promo_ends_at` (fin de la promotion de Zara), `products.old_price_saved` (l'ancien prix mis de côté), `products.last_flash_at` (dernière Vente flash) ; `store_settings.zara_auto_flash_enabled` (l'interrupteur, **éteint** au départ) et `zara_auto_flash_last` (le dernier choix automatique, affiché dans l'écran).
- `zara_auto_flash_run()`, toutes les 5 minutes : si l'interrupteur est allumé et qu'aucune Vente flash n'est en cours, choisit les 4 articles suivants (voir plus haut).
- `zara_promotions_cleanup()`, toutes les 5 minutes : termine les ventes flash et promotions finies, et **met de côté l'ancien prix** (`compare_at_price` → `old_price_saved`) des articles qui ne sont plus en vente flash ni en promotion. Elle ne touche jamais à un prix de vente.
- `zara_promotion_stats()`, `zara_apply_promotions()`, `zara_stop_promotions()` : réservées aux administrateurs (contrôle `is_admin()` dans la fonction ; les visiteurs n'ont même pas le droit de les appeler).
- Aucune nouvelle table : pas de `grant` de table à ajouter.

⚠️ **Dès que le script est lancé**, les anciens prix barrés disparaissent de tous les articles qui ne sont pas en Vente flash ou en promotion, et les ventes flash terminées (290 sur 294 aujourd'hui) cessent d'être affichées. Le site (nouvelle version) applique la même règle ; sans le script, le site masque déjà les ventes flash terminées et les anciens prix hors promotion.

**Pour tout remettre comme avant :**
```sql
select cron.unschedule('zara-promotions-cleanup');
update public.products set compare_at_price = old_price_saved where old_price_saved is not null and compare_at_price is null;
```

## Prix barré saisi à la main
Le champ « Prix barré » du formulaire article existe toujours. Un prix barré saisi hors Vente flash ou promotion est **mis de côté** au prochain nettoyage (pas perdu) ; il s'affichera quand l'article sera en Vente flash (bascule « Vente flash » du formulaire : 24 h) ou en promotion de Zara. Le formulaire le rappelle et montre l'ancien prix mis de côté.

## Limites connues
- La remise annoncée vient de l'ancien prix saisi dans la boutique : Zara vérifie qu'il donne une remise vraie (5 % à 60 %) mais ne peut pas savoir si l'ancien prix a vraiment été pratiqué.
- Les statistiques sont celles du site (vues, paniers, j'aime, commandes) ; il y a peu de commandes (1 par mois en ce moment) : le choix repose surtout sur les vues et les paniers.
- Les **Promotions** (7 jours) restent à valider par l'administrateur ; seule la Vente flash (24 h) est automatique. Une Promotion automatique pourrait être ajoutée plus tard.
- La Vente flash automatique démarre dans les 5 minutes après la fin de la précédente (pas à une heure fixe).
- Les e-mails de Zara Marketing (autre page) lisent les mêmes colonnes : après le nettoyage, ils n'annoncent donc que les vraies promotions.
