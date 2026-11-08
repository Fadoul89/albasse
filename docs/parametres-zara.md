# Paramètres Zara : tous les réglages de Zara sur une page

Demande du patron (8 novembre 2026) : *« Mettez-moi tous les paramètres Zara dans un paramètres à côté. »*

## Où c'est
- **Tableau de bord administrateur** : un nouveau cadre **« 🤖 Paramètres Zara »**, juste à côté de « ⚙️ Paramètres », avec le bouton **« Tous les réglages de Zara »**.
- Adresse directe : `/admin/parametres-zara`. Page réservée aux administrateurs (un client normal lit « Accès réservé aux administrateurs. »).

## Ce que la page réunit
| Partie | Réglage | Ce qui est écrit dans la base |
| --- | --- | --- |
| 🖥️ À l'écran des clients | « Zara gère les publicités à l'écran » (interrupteur) | `store_settings.zara_ads_enabled` |
| | « La publicité s'affiche après… » (0, 3, 5, 10, 15, 30, 60 s) | `store_settings.zara_ads_delay_seconds` |
| | « Vente flash automatique par Zara » (interrupteur) | `store_settings.zara_auto_flash_enabled` |
| 📣 Messages que Zara envoie | « Notification automatique des nouveaux articles » | `store_settings.push_new_products_enabled` |
| | « E-mails publicitaires (clients absents depuis 7 jours) » | `store_settings.inactive_emails_enabled` |
| | « Telegram aux clients absents (7 jours) » | `store_settings.telegram_absent_enabled` |
| ✉️ Zara Marketing (e-mails) | **Lecture seule** : le mode (Éteint / Simulation / Actif), l'heure de passage, la limite par jour, l'approbation | rien n'est écrit |

## Les règles importantes
- **Rien n'est déplacé ni supprimé.** Ces interrupteurs sont **les mêmes** (même composant, mêmes colonnes, mêmes messages) que sur « Promotions intelligentes » et « Assistant marketing » : un changement fait ici est exactement le même que là-bas, et les deux pages restent à jour.
- **Zara Marketing n'est jamais commandée d'ici.** Le verrou « ACTIVER », la simulation, le test e-mail et les réglages détaillés restent sur leur page (`/admin/zara-marketing`) : la page n'a **aucun** bouton qui pourrait lancer des envois réels. Elle affiche seulement l'état et un bouton « Ouvrir Zara Marketing ».
- **Pas de nouveau script SQL.** Aucune colonne n'est ajoutée. Si un ancien script n'est pas lancé (colonne absente), chaque interrupteur le dit comme avant (« Lancez d'abord le script … dans Supabase »).
- Les réglages qui demandent un vrai travail (choix des articles de la Vente flash, annonces par public, notifications programmées, Zara SEO, statistiques) restent sur leurs pages ; la page les liste avec un lien.

## Ce que cette page ne contient pas (et pourquoi)
- Le chat de Zara ne s'ouvre plus tout seul (docs/zara-pubs.md) : ce n'est plus un réglage, c'est une règle fixe.
- Les limites de Zara IA (20 questions par jour et par visiteur) sont fixées dans la fonction serveur `zara-ai`, pas dans un réglage de la boutique : il n'y a donc rien à y régler d'ici.

## Où est le code
- Page : `src/screens/admin/AdminZaraSettingsScreen.tsx`.
- Interrupteurs : `src/components/StoreSettingToggle.tsx` (les mêmes qu'avant), `src/components/ZaraAdsDelay.tsx`.
- Menu : `src/constants/adminMenu.ts` (groupe `zara`) ; adresse : `src/navigation/RootNavigator.tsx`.
- Test dans le navigateur : partie `C` de `tests/zara/zara-ui.test.js` (cadre « Paramètres Zara » du tableau de bord, page, interrupteurs, lecture seule de Zara Marketing, accès refusé aux clients).
