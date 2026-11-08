# Publicités de Zara à l'écran

Le patron peut laisser Zara gérer les publicités affichées aux clients (accueil + fenêtre de promotion).

## Où l'allumer, l'éteindre, régler le délai
Admin → **Promotions intelligentes** :
- interrupteur « 🤖 Zara gère les publicités à l'écran » : activer / désactiver à la main, quand on veut ;
- « ⏱️ La publicité s'affiche après… » : tout de suite, 3, 5, 10, 15, 30 ou 60 secondes après l'ouverture de l'accueil (5 s par défaut). Le même délai ouvre la fenêtre de promotion quand Zara gère les publicités (script `add-zara-ads-delay.sql`, une colonne).
Éteint par défaut. Il faut d'abord lancer `add-zara-ads.sql` dans Supabase (une colonne ajoutée à `store_settings`).
Tant que le script n'est pas lancé, ou que l'interrupteur est éteint, le site est exactement comme avant.

## Ce que Zara affiche
- **Accueil** : juste sous la ligne des catégories, une carte « ZARA VOUS CONSEILLE » avec un vrai article (photo, nom, prix, bouton « Voir »).
  Jusqu'à 3 articles qui tournent toutes les 7 secondes ; les choix changent chaque heure.
- **Fenêtre de promotion** : quand l'offre concerne un article, Zara ajoute une phrase sous le message de l'offre.

- **Annonce ciblée** : la même option affiche aussi, dans le fil de l'accueil, une carte « Annonce » qui ressemble à une vraie pub et qui est choisie pour chaque client (article regardé, catégorie explorée, vraie promotion, genre, ville) : voir `docs/zara-annonce-ciblee.md`.

## Règle d'or : seulement des faits vrais
| Phrase | Condition vraie |
| --- | --- |
| « Beaucoup de clients ont acheté cet article : N commandes ces 7 derniers jours. » | au moins **5** vraies commandes de cet article en 7 jours |
| « N clients ont commandé cet article ces 7 derniers jours. » | **3 ou 4** vraies commandes |
| « Article rare : il n'en reste que N. » (client haut placé) | stock réel de **1 à 5** |
| « Plus que N en stock. » (autres clients) | stock réel de **1 à 5** |

Sans fait vrai, **aucune phrase** : la carte reste cachée. Zara n'invente jamais une rareté ni un nombre de clients.

## Clients haut placés
Le métier écrit par le client dans son compte (champ libre) décide seulement de **l'ordre et des mots** :
directeur, ingénieur, médecin, avocat, juriste, banquier, entrepreneur, homme d'affaires, comptable, gestionnaire, ministre, PDG… (et leurs équivalents en arabe).
Ces clients lisent d'abord « Article rare » (si le stock est vraiment petit) et voient en premier les articles les plus haut de gamme.
Les faits sont les mêmes pour tous : un article abondant n'est jamais présenté comme rare.

## Qui voit la publicité, et le chat de Zara
- La carte s'affiche sur l'accueil pour les clients **connectés** avec leur compte (avec « Compte obligatoire à l'entrée », un visiteur sans compte ne voit que la page d'inscription : la carte attend derrière).
- **Le chat de Zara ne s'ouvre plus tout seul** (demande du patron, 7 novembre 2026 : « Arrête l'ouverture automatique de la fenêtre du chat de Zara »). Avant, Zara ouvrait son chat toute seule (8 secondes après l'arrivée sur l'accueil, ou 10 secondes après l'apparition de la carte de publicité) avec un petit « ding ». **Tout cela est supprimé** : la fenêtre ne s'ouvre que si le visiteur touche le **bouton rond de Zara** ou la **petite bulle** (la bulle de bienvenue, qui apparaît 5 secondes après l'arrivée — 10 secondes pour un client connecté — et reste 10 secondes, comme avant l'ouverture automatique). La carte de publicité reste donc seule à l'écran, sans fenêtre par-dessus. Les rappels (« Activez les notifications », « Installez l'application ») ne passent plus par une ouverture automatique : ils sont dits dans la petite bulle et dans le chat, quand le visiteur le touche. Aucun son n'est joué.
- **Sur téléphone, la fenêtre de Zara n'est plus en plein écran** : c'est une fenêtre qui monte du bas, sur environ 60 % de la zone visible (au moins 360 px), avec des coins arrondis ; le haut de la page reste visible. Quand le clavier s'ouvre, elle se réduit et la zone de saisie reste au-dessus du clavier. Sur ordinateur : toujours la carte de 400 px en bas à droite.
- Réglages dans le code : `SHEET_RATIO` et `SHEET_MIN_HEIGHT` (`src/components/AssistantPanel.tsx`).

## Données
- Commandes réelles : fonction `assistant_product_sales` (totaux par article, jamais un nom de client), commandes non annulées et non signalées « fausses ».
- Stock : celui du catalogue.

## Tests
- `node --import ./tests/zara/register.mjs tests/email/zara-ads.test.ts` (49 contrôles)
- navigateur : `PARTS=7E … node tests/zara/zara-ui.test.js <dist> <port>` (7 : publicité chez un client connecté, chat qui ne s'ouvre pas tout seul, puis ouvert au toucher ; E : fenêtre du bas et clavier ; L9b : Zara reste fermée sur l'accueil)

## Articles « Vitalité & Énergie »
La carte « Zara vous conseille » ne propose jamais un article « Vitalité & Énergie » (sauf à un client marié de 32 ans et plus, d'après son compte) : voir `docs/zara-annonce-ciblee.md` (rubrique « Vitalité & Énergie »).
