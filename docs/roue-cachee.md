# Roue de la chance : cachée partout (rien n'est effacé)

Demande du patron (6 novembre 2026) : *« Supprimer la roue de la chance »*. Réponse choisie : **la cacher partout, sans rien effacer** (on peut la remettre).

## Ce que les clients ne voient plus
- **Écran d'entrée** : la pastille « 🎡 Roue de la chance » (il reste « 💵 Paiement à la livraison à N'Djamena » et « 🎁 Invite 5 amis, gagne un parfum »).
- **Mon compte** : la ligne « Roue de la chance ».
- **La fenêtre** « Un tour de roue vous attend ! » (qui s'ouvrait après des commandes livrées).
- **La page `/roue-de-la-chance`** : un vieux lien ouvre seulement « La roue de la chance n'est pas disponible pour le moment. » Aucun jeu, aucune écriture.
- **Zara** (français et arabe) ne parle plus de la roue quand elle invite à créer un compte : « …retrouvez vos favoris ❤️ et gagnez des points fidélité ! ».

## Ce qui reste (volontairement)
- **La base** : les lots (`wheel_prizes`), l'historique des tours (`wheel_spins`) et la fonction `spin_wheel` ne sont pas touchés. Aucun client ne perd un lot déjà gagné.
- **Admin › Roue de la chance** (page des lots) reste dans le menu de l'administrateur.
- `/roue-de-la-chance` reste dans la liste des pages privées de `robots.txt` et du plan du site (elle n'est jamais indexée).

## Pour la remettre
Une seule ligne : `src/lib/featureFlags.ts` → `WHEEL_ENABLED = true`, puis publier. Les 3 messages de Zara qui ne parlent plus de la roue sont à remettre à la main (`accountInvite` et `accountExplain` dans `src/lib/assistantText.ts`).

## Où est le code
- Interrupteur : `src/lib/featureFlags.ts`.
- Utilisé par : `src/lib/entryScreen.ts` (avantages), `src/screens/AccountScreen.tsx` (menu), `src/navigation/RootNavigator.tsx` (fenêtre), `src/screens/WheelScreen.tsx` (page).
- Test : `tests/email/entry-screen.test.ts` et la partie `2` de `tests/zara/zara-ui.test.js` (Mon compte sans la roue, ancien lien).
