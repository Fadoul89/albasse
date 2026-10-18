# Tests de Zara Kings

Ces tests ne font **aucune écriture** dans la vraie base : lecture seule avec la clé publique, et les commandes d'un client sont simulées.

## Avant de lancer
- Node 22 ou plus.
- Playwright installé à part (il n'est pas ajouté au projet) : `npm i --no-save playwright` puis `npx playwright install chromium`.
- La clé publique Supabase (la même que `EXPO_PUBLIC_SUPABASE_ANON_KEY`) dans la variable `SUPABASE_ANON_KEY`.

## Le « cerveau » de Zara (rapide, plus de 300 vérifications)
```
SUPABASE_ANON_KEY=... node --import ./tests/zara/register.mjs tests/zara/zara-brain.test.ts
```

## Le site complet dans le navigateur
```
npx expo export --platform web
SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333
```
`PARTS=MTOF` lance seulement certaines parties : A conseil, L langues, K bouton « + » / panier / commande, P installation du raccourci (question « Avez-vous déjà installé l'application ? », bouton Installer, photo iPhone), R profil client modifiable, S statistiques de Zara (appareil iPhone/Android, commandes, comptes et installations « grâce à Zara », page administrateur « Statistiques de Zara »), M client avec compte reconnu et salué par son prénom (dont la connexion depuis Zara), T personnalité (politesse, compliments, adresse et numéro personnels), O Zara finalise l'achat dans le chat (fausse base : aucune vraie commande), F programme de fidélité (grade, points, comment gagner), B C D E reste du site (panier, client connecté, panne, clavier, ordinateur).

## Le script SQL des statistiques de Zara (add-assistant-stats.sql)
Il n'est pas appliqué à la vraie base par les tests. Pour le vérifier sans toucher à la vraie base, on le joue sur un Postgres local jetable
(décor de test : rôles `anon` / `authenticated`, `auth.uid()`, `is_admin()`, tables `orders`, `profiles`, `app_installs`), après
`add-assistant-client-counter.sql`. Contrôles faits : le script se relance sans erreur ; un visiteur ne peut ni lire les tables ni appeler
les statistiques ; un client non administrateur est refusé ; l'administrateur reçoit les bons chiffres (commandes fausses et annulées
écartées, périodes début inclus / fin exclue, appareil inconnu = « Autre »).
