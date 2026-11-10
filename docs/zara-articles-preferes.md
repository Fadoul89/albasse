# Affiche « Vos articles préférés » : l'intérêt élevé du client

Demande du patron (10 novembre 2026) : *« Pour les clients Intérêt élevé, Zara doit analyser et proposer sur la publicité-affiche les articles qui sont d'Intérêt élevé, par exemple le client AS-000883. »*

## Ce que fait Zara
Zara analyse ce que CE client a fait, et montre sur l'affiche de l'accueil (l'annonce « Annonce · Zara ») **ses articles d'intérêt le plus élevé, jusqu'à 3** :
- **les articles qu'il regarde de près** : « Intérêt élevé » (commande commencée, plusieurs signaux forts…), ou regardés au moins 2 fois ;
- **les articles qu'il a aimés** (cœur ❤️, ses favoris).

Quand il y en a **2 ou 3**, c'est l'**affiche « 💙 VOS ARTICLES PRÉFÉRÉS »** : le meilleur article en grand (photo, nom, prix, « Acheter maintenant », « Demander à Zara »), les 1 ou 2 autres en dessous (photo, nom, vrai prix, un toucher ouvre la fiche), et « Pourquoi cette annonce ? » avec les vrais noms. Elle existe aussi en arabe.
Quand il n'y en a qu'**un** : comme avant (« Vous avez regardé cet article. Il vous attend toujours. »), ou, s'il est seulement aimé, « Vous avez aimé cet article ❤️ Il vous attend. » (« Vous avez ajouté « … » à vos favoris »).

## Comment les articles sont classés
| Ce que le client a fait | Points |
| --- | --- |
| article aimé (favori) | 3 |
| article « Intérêt élevé » | 3 |
| article « moyen » regardé au moins 2 fois | 1 |
| chaque consultation en plus | un peu (0,1, au plus 1) |

À égalité : le plus récemment regardé, puis le nom. Un article regardé « léger » (un seul regard, rien d'autre) ne compte **pas**.

## Ce qu'elle ne fait jamais
- Proposer un article **déjà commandé** (même aimé), **épuisé**, **retiré de la vente**, **sans photo**, ou réservé aux adultes / « Vitalité & Énergie » (mêmes règles que toutes les annonces).
- Inventer : pas de favori et pas de regard fort = pas d'affiche « préférés » (Zara passe aux autres raisons vraies : catégorie explorée, métier, genre, vraie promotion).
- Mettre de la pression (aucune fausse rareté ni urgence) ou deviner : seuls de VRAIS regards et de VRAIS favoris comptent.

## L'ordre des annonces
1. **Élève ou étudiant** : la grande affiche de l'offre du patron (URBANSOLE, code EE26), tant qu'elle existe (`docs/offre-eleves-etudiants.md`).
2. **Intérêt élevé : l'affiche « Vos articles préférés »** (ou un seul article regardé / aimé).
3. Une catégorie explorée, puis le métier, le genre, une vraie promotion, une nouveauté (comme avant, `docs/zara-annonce-ciblee.md`).

## Le « ✕ »
Sur l'affiche « préférés », le « ✕ » ferme **tous ses articles** pour 24 h et ne compte que pour **un seul** « ✕ » (au 3ᵉ « ✕ » sur 24 h, Zara s'arrête). 15 secondes plus tard, Zara propose une AUTRE annonce, jamais un des articles fermés.

## À savoir
- **Les favoris suivent le compte** (ils sont dans la base) : l'affiche les montre sur **n'importe quel téléphone** du client. **Les regards, eux, sont gardés sur le téléphone** où le client a navigué : sur un autre téléphone, seuls ses favoris comptent. (Pour que les regards suivent aussi le compte, il faudrait un script SQL : à demander au besoin.)
- Exemple, client **AS-000883** : il a aimé « Survêtement Real Madrid » et « Survêtement Arsenal », et regardé deux fois « Real Madrid » et « TAGIA ROYALE – velour » (les regards de « Barcelona enfant » et du « 511 » sont uniques, ils ne comptent pas). Sur son téléphone, Zara lui montre l'affiche avec **Real Madrid** (aimé + regardé), **Arsenal** (aimé) et **TAGIA ROYALE** (regardé 2 fois). Sur un autre téléphone : **Real Madrid** et **Arsenal**.
- Aucun script SQL, aucune fonction serveur.

## Où est le code
- Classement et choix : `src/lib/adTargeting.ts` (`rankInterest`, étape 1 de `pickTargetedAd`, raisons `interest` et `liked`, `addClosedAds`).
- Affiche : `src/components/TargetedAdCard.tsx` ; favoris : `src/store/favoritesStore.ts`.

## Tests
- Règles : `node --import ./tests/zara/register.mjs tests/email/ad-interest.test.ts` (28 contrôles : classement, client AS-000883, favoris seuls, commandé, épuisé, « ✕ ») et `tests/email/ad-targeting.test.ts`.
- Navigateur : partie `€` de `tests/zara/zara-ui.test.js` (bloc g4 : affiche à 3 articles, un seul favori, arabe, « ✕ », aucun favori ; et la suite « ✕ » adaptée).
