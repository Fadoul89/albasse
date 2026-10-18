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
`PARTS=MTOF` lance seulement certaines parties : A conseil, L langues, K bouton « + » / panier / commande, P installation du raccourci (question « Avez-vous déjà installé l'application ? », bouton Installer, photo iPhone), R profil client modifiable, S statistiques de Zara (appareil iPhone/Android, commandes, comptes et installations « grâce à Zara », page administrateur « Statistiques de Zara »), M client avec compte reconnu et salué par son prénom (dont la connexion depuis Zara), T personnalité (politesse, compliments, adresse et numéro personnels), O Zara finalise l'achat dans le chat (fausse base : aucune vraie commande), F programme de fidélité (grade, points, comment gagner), U suivi de navigation (articles regardés, temps ACTIF, variantes, panier, recherches, suivi en arrière-plan (aucune fenêtre ni bouton), refus depuis la page de confidentialité, signal « Ne pas me suivre » du navigateur, envoi vers la base sans double comptage, reprise après coupure, 90 jours), V Zara intelligente (suggestions discrètes avec les vrais articles, « Non merci », historique « qu'est-ce que j'ai regardé », Zara ne parle jamais du suivi d'elle-même, « ne me suis plus » respecté seulement si le client l'écrit, aucun bouton de suivi dans le chat, signal du navigateur, arabe), W page administrateur « Suivi de navigation » (fausse base), B C D E reste du site (panier, client connecté, panne, clavier, ordinateur).

## Le script SQL des statistiques de Zara (add-assistant-stats.sql)
Il n'est pas appliqué à la vraie base par les tests. Pour le vérifier sans toucher à la vraie base, on le joue sur un Postgres local jetable
(décor de test : rôles `anon` / `authenticated`, `auth.uid()`, `is_admin()`, tables `orders`, `profiles`, `app_installs`), après
`add-assistant-client-counter.sql`. Contrôles faits : le script se relance sans erreur ; un visiteur ne peut ni lire les tables ni appeler
les statistiques ; un client non administrateur est refusé ; l'administrateur reçoit les bons chiffres (commandes fausses et annulées
écartées, périodes début inclus / fin exclue, appareil inconnu = « Autre »).

## Le script SQL du suivi de navigation (add-browsing-intelligence.sql)
Même méthode : il n'est pas appliqué à la vraie base par les tests, on le joue sur un Postgres local jetable (même décor, plus les stubs `anon` /
`authenticated`). Contrôles faits : le script se relance sans erreur ; un visiteur ne peut ni lire les tables ni appeler le tableau de suivi ;
un client non administrateur est refusé ; un envoi n'est compté qu'une fois même s'il arrive deux fois (numéro d'envoi) ; seules des différences
sont ajoutées ; un achat n'est jamais « défait » par un retrait du panier ; les valeurs illisibles ou énormes sont ramenées à des valeurs sûres ;
« refuser » efface les lignes du visiteur ; l'effacement après 90 jours marche ; l'administrateur voit des références anonymes (V-xxxxxx / C-xxxxxxxx),
jamais l'identifiant brut ni le nom.

## Ce que les tests ne prouvent pas
- Les tests utilisent une fausse base pour tout ce qui s'écrit (suivi, commandes, statistiques) : rien n'est écrit dans la vraie base.
- La mesure du temps actif est testée dans un navigateur de test (onglet caché, actualisation, retour sur la fiche, coupure de connexion) ; sur de
  vrais téléphones, les veilles et changements d'application peuvent varier : le temps compte au plus 2 secondes par seconde et jamais pendant
  une veille, mais le chiffre reste une estimation.
