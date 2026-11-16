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

---

# Côté communication : l'assistant marketing

Demande du patron (16 novembre 2026, « psychologique côté communication ») : les mêmes principes dans les textes publicitaires
qu'écrit l'**assistant marketing** (Admin › Marketing : Facebook, TikTok, WhatsApp, Google). Même règle : **rien d'inventé**.

## Ce que voit l'administrateur

1. **Les vrais chiffres de l'article**, lus dans la base par la fonction `marketing-ai` (action `facts`) : personnes en 30 jours
   (et place parmi les plus regardés), prix et vraie économie (seulement pendant une vraie promotion), fin de la vente flash ou de la promotion, stock.
2. **Un levier psychologique** : ✨ Automatique, 👀 Preuve sociale, 💰 Aversion à la perte, ⏰ Urgence, ⏳ Rareté, 🔥 Effet de mode, 🎁 Réciprocité.
   Seuls les leviers **vrais** pour l'article peuvent être choisis ; les autres sont barrés, avec la raison.
3. **Le texte** : chaque version commence par « Version N · <levier> ». « Automatique » écrit 2 versions avec les 2 meilleurs leviers vrais
   (dans l'ordre : urgence, perte, preuve sociale, rareté, effet de mode, réciprocité).
4. **Le contrôle** : si le texte de l'IA parle de « stock limité » sans stock bas, d'urgence sans date de fin, d'un autre nombre de personnes,
   d'achats non prouvés ou d'un prix qui n'est pas celui de l'article, un avertissement rouge « Vérifiez avant de publier » s'affiche.

## Quand un levier est vrai

| Levier | Vrai si | Ce que l'IA reçoit |
| --- | --- | --- |
| Preuve sociale | au moins 50 personnes en 30 jours | « 1842 personnes ont regardé cet article ces 30 derniers jours » (« regardé », jamais « acheté ») |
| Aversion à la perte | vraie promotion en cours (5 à 60 %) | « 40 000 FCFA au lieu de 50 000 FCFA : le client économise 10 000 FCFA » |
| Urgence | vente flash ou promotion avec une date de fin | « cette remise se termine lundi 16 novembre à 19:45 (heure de N'Djamena) » |
| Rareté | stock de 1 à 5 | « il n'en reste que 3 en stock » |
| Effet de mode | parmi les 10 articles les plus regardés (et 50 personnes au moins) | « fait partie des 3 / 5 / 10 articles les plus regardés » |
| Réciprocité | toujours (règle de la boutique) | le cadeau surprise des commandes passées dans le chat de Zara, sans valeur promise |

Le levier demandé est revérifié par la fonction : un levier qui n'est pas vrai est refusé (`reason: "lever"`).
L'ancien prix n'est plus cité hors d'une vraie promotion (avant, il l'était dès qu'un ancien prix était écrit).

## Où est le code

| Élément | Fichier |
| --- | --- |
| Règles (faits, leviers vrais, consignes à l'IA, contrôle du texte) | `supabase/functions/marketing-ai/levers.ts` |
| Fonction (faits lus dans la base, écriture avec l'IA) | `supabase/functions/marketing-ai/index.ts` |
| Écran : noms des leviers, lignes des chiffres, avertissement | `src/lib/marketingLevers.ts`, `src/screens/admin/AdminMarketingScreen.tsx` |

## Tests

- Règles : `node --import ./tests/zara/register.mjs tests/email/marketing-levers.test.ts` (mêmes clés et mêmes seuils que le site).
- Écran : `NODE_PATH=/opt/node-tools/node_modules node tests/account/marketing-levers-ui.test.js <dossier dist>` (fonction simulée, aucune IA appelée).

## Pour le patron : à lancer

1. La fonction `marketing-ai` (déploiement Supabase), après son « Oui ».
2. La publication du site, après son « Oui » (15 crédits Netlify).
