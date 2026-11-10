# Fiche « 🧠 Zara a étudié ce client » (Admin › Clients › le client)

Demande du patron (10 novembre 2026) : *« Zara doit étudier chaque client. »* Choix du patron : une fiche, sur la page de chaque client, qui montre ce que Zara a compris et ce qu'elle lui propose.

## Ce que montre la fiche
- **Le niveau** : 💙 Intérêt élevé / 🟡 moyen / ⚪ léger / ⚪ rien d'enregistré, avec une phrase (« Zara a repéré 3 articles que ce client regarde de près ou aime »).
- **Son public** (d'après ce qu'il a écrit dans son compte) : Femmes, Hommes, Élèves, Étudiants, Administrateurs, Militaires… ou « Aucun public reconnu ».
- **💙 Ses articles préférés** (Intérêt élevé), du meilleur au moins bon, avec la vraie raison : « ❤️ aimé · intérêt moyen · regardé 2× ». Un article qui n'est plus en vente reste dans la liste, barré, avec « plus en vente : Zara ne le propose pas ».
- **👀 Regardés sans plus** : les articles vus une fois, sans autre signe (pas assez pour l'affiche).
- **📦 Déjà commandés** : jamais reproposés.
- **📣 Ce que Zara lui propose** : la même affiche que sur son accueil (« Vos articles préférés vous attendent. », ou l'offre élèves/étudiants, ou une autre annonce vraie), avec les articles dans l'ordre et « Pourquoi cette annonce ? ». Sinon : « Rien pour le moment : Zara n'invente jamais une annonce. »
- **ⓘ Ce que Zara ne sait pas** : aucun métier écrit, aucun genre choisi, aucun article aimé, aucun regard enregistré, métier qui ne correspond à aucun public.

La fiche est en **lecture seule** (aucun bouton, aucun champ) et réservée à l'administrateur (la base ne laisse lire le suivi des regards qu'à lui).

## D'où viennent les données
Tout est **enregistré** par le site pour ce client : ses regards (suivi de la base, `visitor_product_interest`), ses favoris (`favorites`), ses commandes (`orders`), ce qu'il a écrit dans son compte. **Rien n'est deviné.** Si la lecture est refusée (réseau, droits), la fiche dit « Étude impossible pour le moment » : jamais une fausse étude « rien d'enregistré ».

## À savoir
- La fiche est calculée avec **les mêmes règles que l'affiche de l'accueil** (`pickTargetedAd`, `docs/zara-articles-preferes.md`), avec les regards enregistrés dans la base. Sur le **téléphone** du client, l'affiche peut changer, car ses regards y sont aussi gardés.
- Exemple, client **AS-000883** : « 💙 Intérêt élevé », articles préférés **Survêtement Real Madrid** (aimé · regardé 2×), **Survêtement Arsenal** (aimé), **TAGIA ROYALE – velour** (regardé 2×) ; regardés sans plus : Barcelona enfant et le 511 ; affiche proposée : « Vos articles préférés vous attendent ».
- Aucun script SQL, aucune fonction serveur.

## Où est le code
- Règles pures : `src/lib/clientStudy.ts` (`studyClient`) ; moteur : `src/lib/adTargeting.ts` (`interest`, `orderedProductIds`, `mergeInterestRecords`).
- Affichage : `src/components/ZaraStudyCard.tsx`, branché dans `src/screens/admin/AdminCustomerDetailScreen.tsx`.

## Tests
- `node --import ./tests/zara/register.mjs tests/email/client-study.test.ts` (23 contrôles : le client AS-000883, sans donnée, commandé, retiré de la vente, public, offre étudiants).
- Navigateur : partie `~` de `tests/zara/zara-ui.test.js`, bloc « s » (la fiche du client AS-000883, article commandé, client sans rien, lecture refusée, lecture seule).
