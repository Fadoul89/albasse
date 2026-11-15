# Sécurité : les 20 points (contrôle du 15 novembre 2026)

| # | Point | État |
|---|---|---|
| 1 | Clés d'API cachées | Bon : seule la clé publique (anon) est dans le site. Les clés des services (Brevo, Telegram, IA…) sont côté serveur. |
| 2 | Variables d'environnement | Bon : `.env` n'est pas dans git ; `.env.example` ne propose plus de clé secrète `EXPO_PUBLIC_` ; test `tests/email/no-secret-in-site.test.ts`. |
| 3 | Secrets dans l'historique git | Bon : aucun trouvé (clés Supabase service_role, Anthropic, OpenAI, Brevo, Telegram, Google, GitHub, clés privées). |
| 4 | Authentification | Bon : Supabase Auth. |
| 5 | Double vérification (2FA) des admins | **À faire par le patron** sur ses comptes Supabase, Netlify, GitHub, Gmail. |
| 6 | Accès des utilisateurs | Bon : règles RLS ; aucune donnée client lisible par le public. |
| 7 | Pages admin protégées | Bon : les fonctions admin vérifient `is_admin()` dans la base. |
| 8 | Points d'accès (API) | Bon : fonctions serveur protégées par connexion ou secret partagé. Les 2 fonctions de notification lisent désormais leur secret dans le coffre-fort. |
| 9 | Base de données | Corrigé : chemin de recherche fixé sur 8 fonctions (`fix-function-search-path.sql`). |
| 10 | RLS sur chaque table | Bon : 0 table sans RLS. |
| 11 | Mots de passe hachés | Bon : Supabase Auth (aucune colonne mot de passe dans nos tables). |
| 12 | Données sensibles chiffrées | Bon : secrets dans le coffre-fort Supabase (vault). |
| 13 | Pas de données en trop | Bon : tables publiques = articles, catégories, villes, réglages de la boutique. |
| 14 | Formulaires nettoyés | Bon : l'affichage React échappe le texte ; la base reçoit des paramètres (pas de SQL fabriqué). |
| 15 | Limite de requêtes | En partie : Supabase Auth limite les connexions ; IA de Zara limitée par jour ; demandes de rappel et mot de passe oublié freinées. |
| 16 | Plafond de dépenses | **À faire par le patron** : Supabase › Billing › Spend cap ; limite de dépenses chez le fournisseur d'IA. |
| 17 | Dépendances à jour | 23 alertes `npm audit`, toutes dans les outils de fabrication (Expo, Metro), pas dans le site téléchargé par les clients. À traiter lors de la prochaine mise à jour d'Expo. |
| 18 | Paquets inutiles | Non traité (risque de casser la fabrication pour un gain faible). |
| 19 | Journaux et alertes | Bon : alertes Telegram (commandes, demandes de mot de passe), journaux Supabase. |
| 20 | Audit complet | Ce document. Avis Supabase restants : fonctions appelables sans connexion (voulues : chat de Zara, suivi, roue…, ou déclencheurs qui ne peuvent pas être appelés directement), pg_net dans `public` (ne pas déplacer : les déclencheurs l'utilisent), protection des mots de passe piratés (**à activer par le patron** : Authentication › Passwords). |

## Secrets des notifications (fait le 15 novembre 2026)
- Avant : le secret partagé base → fonctions `send-product-push` / `send-web-push` et la clé privée VAPID étaient écrits dans le code de ces fonctions (et le secret dans le déclencheur `push_notify_product_notification`).
- Maintenant : ils sont dans le coffre-fort (`push_webhook_secret`, `vapid_private_key`), lus seulement par le serveur (`service_role`). Mêmes valeurs qu'avant : les abonnements des navigateurs restent valables.
- Scripts : `add-push-secrets-vault.sql` puis `fix-push-trigger-vault.sql`. Code des fonctions : `supabase/functions/send-product-push`, `supabase/functions/send-web-push`.
- Vérifier sans rien envoyer : `POST …/functions/v1/send-web-push` avec l'en-tête `x-webhook-secret` et `{"dry_run": true}` → `{"ok":true,"dry_run":true,"total":…}` ; sans le bon secret → 401.
- Ne jamais changer la clé VAPID : chaque navigateur devrait se réabonner.
