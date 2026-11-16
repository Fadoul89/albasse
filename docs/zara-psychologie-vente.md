# Zara + psychologie de la vente

Demande du patron (16 novembre 2026, « Lier avec Zara ») : appliquer à Zara les principes de la psychologie de la vente
(la liste des « 50+ principes » : aversion à la perte, ancrage, preuve sociale, rareté…) et les « 30 derniers jours ».

Règle de base, la même que pour les « mots qui vendent » (`docs/zara-mots-qui-vendent.md`) : **chaque chiffre n'est dit que s'il est VRAI.**
Pas de faux « X personnes regardent en ce moment », pas de fausse urgence, pas de fausse rareté.

## Ce que Zara faisait déjà

| Principe | Dans Zara |
| --- | --- |
| Ancrage | « 40 000 FCFA au lieu de 50 000 FCFA » (le vrai ancien prix, seulement pendant une vraie promotion) |
| Rareté | « Plus que 3 en stock » (le vrai stock, 5 ou moins) |
| Réciprocité | le cadeau surprise des commandes du chat |
| Effet Zeigarnik | « Finalisez votre commande », les rappels |
| Effet de gradient | « Il vous manque 20 points pour le grade Or » |
| Paradoxe du choix | 4 articles au plus à la fois |
| Engagement | une question à la fois (pour qui, quel article, quel budget) |
| Preuve sociale (achats) | « X % des clients ont aussi acheté ceci » : attend qu'il y ait assez de vraies commandes |

## Ce qui est ajouté

| Principe | Ce que dit Zara | D'où vient la vérité |
| --- | --- | --- |
| **Effet de mode** + 30 derniers jours | bouton « 👀 Les plus regardés » dans le menu (juste après « 🆕 Nouveautés ») : « 👀 Voici les articles les plus regardés ces 30 derniers jours chez Albasse Shopping 👇 » + 4 fiches au plus | les vraies visites des fiches produits (`product_views`), 30 derniers jours |
| **Preuve sociale** (visites) | sur chaque fiche du chat : « 👀 Vu par 1 842 personnes (30 j) » ; sur la page d'un article : « 👀 1 842 personnes ont regardé cet article ces 30 derniers jours. » | idem, **à partir de 50 personnes** seulement |
| **Aversion à la perte** | « 20 % de remise : 40 000 FCFA au lieu de 50 000 FCFA · vous économisez 10 000 FCFA » (et sur la page d'un article : « (-20 % : vous économisez 10 000 FCFA) ») | ancien prix écrit par l'équipe moins le prix |

En arabe : « 👀 الأكثر مشاهدة », « 👀 شاهده 1842 شخصا في 30 يوما », « توفّر 10 000 FCFA ».

Zara dit **« regardé »**, jamais « acheté » : au 16 novembre 2026, il y a 12 959 visiteurs en 30 jours mais une seule commande.

Zara comprend aussi quand on l'écrit : « les plus regardés », « les plus vus », « les plus populaires », « الأكثر مشاهدة ».

### Pas pour Zara

- **Prix psychologique** (9 900 au lieu de 10 000) : c'est le patron qui fixe les prix.
- **Autorité** : il faudrait un vrai expert ou un vrai label ; Zara n'en invente pas.

## Comment les personnes sont comptées

Script SQL : **`add-zara-most-viewed.sql`** (fonction `assistant_product_views(p_days)`, 30 jours par défaut, 30 au plus).

- Une personne = un compte ; sinon le même navigateur (`visitor_sessions.visitor_id`) ; sinon la visite. Quelqu'un qui revient 3 fois ne compte qu'**une** fois.
- Les visites des **administrateurs** ne comptent pas. Seulement les articles **actifs**.
- La fonction ne renvoie que des **totaux** par article (`product_id`, `visitors`) : jamais un nom, un numéro ni une adresse. Les visiteurs ne lisent jamais la table des visites elle-même.
- Elle renvoie les articles vus par au moins 10 personnes ; le site ne dit un chiffre qu'à partir de **50**. 300 articles au plus.
- Un index sur la date des visites garde le calcul rapide (environ 0,1 s aujourd'hui). Le site garde la réponse 5 minutes.

Tant que le script n'est pas lancé (ou en cas de panne) : **aucun chiffre de visites** n'est dit ; le bouton « Les plus regardés » répond
« Je ne peux pas encore vous montrer les articles les plus regardés » et propose les promotions et les nouveautés. Zara n'attend jamais
les visites plus de 1,5 s avant de montrer des fiches (sinon les fiches partent sans le chiffre).

## Où est le code

| Élément | Fichier |
| --- | --- |
| Règles (seuil de 50, 4 articles, économie) | `src/lib/assistantViews.ts` |
| Lecture de la base (gardée 5 minutes) | `src/lib/assistantData.ts` (`getProductViews`, `cardWithViews`) |
| Textes FR / AR | `src/lib/assistantText.ts` (`chip.popular`, `card.views`, `mostViewedIntro`, `noMostViewed`, `viewsLine`, `why.discount`) |
| Conseil et page d'un article | `src/lib/assistantMarketing.ts` (`whyReasons`, `productPitch`, contexte `popular`) |
| Compréhension du texte | `src/lib/assistantBrain.ts` (`MOST_VIEWED_RE`, intention `popular`) |
| Conversation | `src/store/assistantStore.ts` (`mostViewedReply`, bouton du menu) |
| Fiche du chat | `src/components/AssistantPanel.tsx` (`assistant-card-views`) |

## Pour le patron : à lancer

1. Le script SQL `add-zara-most-viewed.sql` (Supabase › SQL Editor), après son « Oui ».
2. La publication du site, après son « Oui » (une publication coûte 15 crédits Netlify).

## Tests

- Règles : `node --import ./tests/zara/register.mjs tests/email/zara-views.test.ts`.
- SQL (Postgres local jetable) : `sh tests/sql/run-most-viewed.sh` (une personne comptée une fois, admin exclu, articles inactifs exclus, 30 jours, aucune donnée de client, droits).
- Navigateur : `PARTS=£` (bouton, ordre, vrai chiffre sur chaque fiche, arabe, script pas lancé, page d'un article).
