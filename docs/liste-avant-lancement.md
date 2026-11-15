# Liste « avant le lancement » (15 points) — état au 15 novembre 2026

Chaque point a été contrôlé sur le vrai site avant d'être corrigé. Ce qui n'avait pas besoin de changement est noté « déjà bon ».

| # | Point | État | Où |
|---|---|---|---|
| 1 | Politique de confidentialité | déjà bonne, complétée (section « Cookies et mesure publicitaire », mise à jour novembre 2026) | `src/screens/PrivacyPolicyScreen.tsx` |
| 2 | Conditions générales | **ajoutées** : page `/conditions-generales`, liens dans le pied de page, Mon compte, l'inscription ; page pour Google et plan du site | `src/lib/termsText.ts`, `src/screens/TermsScreen.tsx`, `netlify/edge-functions/lib/seo.ts` |
| 3 | Clés secrètes hors du site | déjà bon : seule la clé publique (anon) est dans le site, aucune clé secrète dans le code ni dans le site fabriqué | — |
| 4 | HTTPS forcé | déjà bon : http redirigé vers https, HSTS actif (Netlify) | — |
| 5 | Bandeau de consentement aux cookies | **ajouté** : Accepter / Refuser ; le pixel TikTok ne démarre qu'après « Accepter » | `src/lib/cookieChoice.ts`, `src/lib/cookieConsent.ts`, `src/components/CookieBanner.tsx`, `src/lib/tiktokPixel.ts` |
| 6 | Titres et descriptions meta | déjà bon (accueil, articles, catégories, pages d'information) | `netlify/edge-functions/lib/seo.ts` |
| 7 | Image d'aperçu pour les réseaux sociaux | déjà bon (balises Open Graph et Twitter, photo de l'article) | idem |
| 8 | Favicon | déjà bon | `favicon.ico`, `public/` |
| 9 | Plan du site et robots.txt | déjà bon, `/conditions-generales` ajoutée au plan | `netlify/edge-functions/sitemap.ts` |
| 10 | Texte alternatif des images | **ajouté** sur toutes les images du site (avant : 0 sur 55) | tous les `<Image` (propriété `accessibilityLabel`, voir ci-dessous) |
| 11 | Images compressées | **non fait, décision du patron** (la réduction des photos par Supabase peut être payante) : les photos restent telles quelles | — |
| 12 | Vitesse de chargement | fichiers au nom unique gardés 1 an par le navigateur ; en-têtes de sécurité | `netlify.toml` |
| 13 | Contraste des couleurs | **corrigé** (texte à 4.5:1 au moins, vérifié par l'outil axe sur 8 pages) | `src/theme/colors.ts` et écrans |
| 14 | Adapté au mobile | déjà bon (aucun défilement horizontal, testé sur téléphone) | — |
| 15 | Page 404 personnalisée | **ajoutée** : écran « Page introuvable » + vrai code 404 envoyé par Netlify | `src/screens/NotFoundScreen.tsx`, `netlify/edge-functions/not-found.ts` |
| — | Liens cassés | déjà bon : 641 adresses du plan du site vérifiées, 0 lien cassé | — |

## Conditions générales
Chaque phrase reprend une règle qui existe déjà sur le site (page de commande, conditions de retour, inscription, fidélité). Rien n'est inventé : pas de délai de livraison chiffré, pas de tribunal ni de loi. Le patron relit le texte (`src/lib/termsText.ts`) : si une règle change, on change la phrase à cet endroit et dans le résumé vu par Google (`INFO_PAGE_DEFS` de `seo.ts`).
Test : `node --import ./tests/zara/register.mjs tests/email/terms.test.ts` (18 contrôles).

## Bandeau cookies
- Tant que le visiteur n'a pas choisi : **rien n'est envoyé à TikTok** (le pixel n'est même pas chargé).
- « Accepter » : le pixel TikTok se charge, le choix est gardé dans le navigateur (`albasse_cookie_consent`).
- « Refuser » : rien n'est envoyé ; le bandeau ne revient plus.
- Le visiteur peut changer d'avis dans la politique de confidentialité (section 5).
- **Effet à connaître** : TikTok ne compte plus que les visiteurs qui acceptent. Les chiffres de la publicité TikTok seront donc plus bas qu'avant, sans que les ventes réelles baissent.
- Ne sont pas concernés (le site ne peut pas fonctionner sans) : connexion, favoris, langue, panier.
- Google Traduction (bouton « العربية ») se charge toujours : c'est un choix du visiteur et il n'envoie rien de publicitaire.
Tests : `tests/email/cookie-consent.test.ts` (10 contrôles) et, dans le navigateur, `tests/legal/legal-ui.test.js`.

## Textes alternatifs
La version d'expo-image du site (57) ne transmet que la propriété `accessibilityLabel` à la balise `<img>` : la propriété `alt` est ignorée. Toujours écrire `accessibilityLabel="…"` (ou `""` pour une image purement décorative).

## Contraste
Nouvelles couleurs dans `src/theme/colors.ts` :
- `creamMuted` 0.6 → 0.75 et `creamFaint` 0.35 → 0.66 (textes grisés lisibles) ; `decorFaint` garde l'ancien gris pour les décors sans texte (étoiles vides).
- `errorText` (#ff9b9b) et `successText` (#5fd38d) : le rouge #d8232a et le vert #2e8b57 restent pour les fonds et les boutons, mais le **texte** rouge ou vert utilise ces versions plus claires.
- Texte blanc (et non crème) sur fond rouge ; texte foncé sur le vert WhatsApp (le blanc ne faisait que 1.98).
- Onglets du bas : or clair ; badge « LIVE » rouge plus foncé qui pulse en taille (plus en transparence) ; phrase d'accroche de l'accueil sans transparence (seule la lueur pulse).

## Page 404
- L'application affiche « Page introuvable » (écran `NotFound`, adresse `*`) avec « Retour à l'accueil » et « Chercher un article ».
- Netlify répond le code **404** (avant : la page d'accueil avec le code 200, que Google appelle un « faux 404 »). La liste des adresses valides est dans `netlify/edge-functions/lib/routes.ts` ; le test `tests/seo/not-found.test.ts` la compare avec la configuration de l'application : une nouvelle page ajoutée à `RootNavigator.tsx` sans être ajoutée à `routes.ts` fait échouer le test.
- Les fichiers (scripts, images, polices, `google….html`) ne passent pas par cette fonction.

## Vitesse et sécurité (`netlify.toml`)
- `/_expo/static/*` et `/assets/*` : `Cache-Control: public, max-age=31536000, immutable` (leurs noms contiennent un code qui change quand le fichier change).
- Pour toutes les pages : `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.
- Pas de `Content-Security-Policy` ni de `Strict-Transport-Security` ajoutés à la main (risque de bloquer le site / déjà fait par Netlify).

## Vérifier avant de publier
```
node --import ./tests/zara/register.mjs tests/email/terms.test.ts
node --import ./tests/zara/register.mjs tests/email/cookie-consent.test.ts
node --import ./tests/zara/register.mjs tests/seo/not-found.test.ts
node --import ./tests/zara/register.mjs tests/seo/seo.test.ts
# dans le navigateur (après expo export) : cookies, conditions générales, 404, alt, contraste (outil axe-core)
EXPO_PUBLIC_MOBILE_MONEY=on npx expo export --platform web --output-dir /tmp/dist-legal
SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/legal/legal-ui.test.js /tmp/dist-legal 4455 <chemin de axe.min.js>
```
Après la mise en ligne : `curl -sI https://www.albasseshopping.com/page-qui-nexiste-pas` doit répondre `404`, et `curl -sI https://www.albasseshopping.com/contact` doit répondre `200`.
