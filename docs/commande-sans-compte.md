# Commande sans compte

Depuis que « Compte obligatoire » est désactivé (Admin › Clients), n'importe qui peut regarder le site. Ce changement permet aussi de **commander sans avoir créé de compte avant**.

## Ce que voit le visiteur
1. Fiche article → **Commander** → page de commande (plus de renvoi vers la connexion).
2. La page demande : **prénom, nom, téléphone, e-mail**, adresse, ville, paiement (comme avant pour le reste).
3. Il touche **Confirmer la commande** :
   - ses informations sont contrôlées (téléphone du Tchad à 8 chiffres commençant par 6 ou 9, e-mail valable) ;
   - son **compte est créé automatiquement** avec son numéro (même système que l'inscription : `23566123456@tel.albasseshopping.com`) ;
   - la commande est enregistrée à son nom ;
   - la page de confirmation affiche **« Votre compte est créé »** avec son numéro et son **mot de passe provisoire** (à garder en capture d'écran), et la facture PDF.
4. Il est connecté : « Mes commandes » et la facture fonctionnent tout de suite.

Dans le chat, Zara dit « Pas besoin de compte pour commander » et ouvre la page de commande (l'article reste choisi).

## Mot de passe : pourquoi pas « 1234 »
Le patron avait demandé « 1234 » pour tous. Deux raisons de ne pas le faire :
- **Sécurité des clients** : avec un mot de passe connu de tous, quiconque connaît le numéro d'un client (livreur, voisin, ancien client) ouvrirait son compte : nom, adresse, commandes, factures, points de fidélité.
- **Le système exige au moins 6 caractères** (le formulaire d'inscription le dit aussi) : « 1234 » serait refusé à la création du compte.

À la place : **un code de 6 chiffres différent pour chaque client**, tiré au hasard, jamais une suite ou un motif facile (123456, 111111, 121212…). Il est montré une fois sur la page de confirmation. Le client peut le changer dans « Compte ». S'il l'oublie : « Mot de passe oublié » → l'équipe l'aide sur WhatsApp (comme pour tous les comptes créés avec un numéro).

Le code est fabriqué dans `src/lib/guestAccount.ts` (`generateTempPassword`) : c'est le seul endroit à changer si le patron veut une autre règle.

## Cas particuliers
- **Numéro déjà inscrit** : rien n'est créé, la commande n'est pas mise sur le compte d'une autre personne ; le visiteur voit « Vous avez déjà un compte avec ce numéro » et arrive sur la page de connexion.
- **Commande qui échoue après la création du compte** (réseau coupé) : le compte existe et le visiteur est connecté ; il retouche « Confirmer » (son nom est déjà rempli) et le même code s'affiche sur la confirmation.
- **Messages publicitaires** : le compte automatique ne s'abonne PAS aux notifications ni aux e-mails promotionnels (le client n'a rien coché). Il peut les activer dans son profil.
- **Client déjà connecté** : rien ne change.

## Fichiers
| Élément | Fichier |
| --- | --- |
| Contrôle des champs, code de 6 chiffres | `src/lib/guestAccount.ts` |
| Page de commande (visiteur / client) | `src/screens/CheckoutScreen.tsx` |
| Code montré à la confirmation | `src/screens/OrderConfirmationScreen.tsx` |
| Fiche article (« Commander » sans renvoi) | `src/screens/ProductScreen.tsx` |
| Zara : « Pas besoin de compte » (français et arabe) | `src/store/assistantStore.ts`, `src/lib/assistantText.ts` |
| Tests | `tests/email/guest-account.test.ts` (38), partie 0 de `tests/zara/zara-ui.test.js` (navigateur) |

Aucun script SQL à lancer : aucune table ni colonne nouvelle.
