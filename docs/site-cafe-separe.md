# Site « Vitalité & Énergie Homme » à part, sans Albasse

Le même code que le site Albasse, mis en ligne **une 2ᵉ fois** sur Netlify, sur **une autre adresse**. Ce 2ᵉ site s'ouvre directement sur la page du café :

- plus de « ALBASSE SHOPPING » en haut, plus la fenêtre « Télécharge l'app », plus de bandeau d'achats récents, plus Zara, plus de fenêtres de promotion ni de roue ;
- le nom de la page « Vitalité & Énergie Homme » dans l'onglet du navigateur, dans l'aperçu du lien (WhatsApp, Facebook, TikTok) et sous l'icône si le client met la page sur son écran d'accueil (icône neutre « V&É ») ;
- pas de plan du site, `noindex` (Google ne l'affiche pas), pas de menu ni de recherche de la boutique ;
- la **commande arrive dans ton admin**, comme les autres. Comme tu l'as choisi, la page de commande, la confirmation et la facture gardent le nom Albasse Shopping.

Le site `albasseshopping.com` ne change pas (son popup « Télécharge l'app » non plus). Son ancienne page cachée `/cafe` a été **supprimée** : elle n'existe que sur ce site à part.

## Étape 1. Créer le 2ᵉ site sur Netlify (gratuit)

1. Sur netlify.com, connecté comme pour le site Albasse : **Add new site › Import an existing project › GitHub**, puis le dépôt **Fadoul89/albasse**, branche **main**.
2. Laisse les réglages de fabrication proposés (la commande et le dossier viennent du fichier `netlify.toml`).
3. Avant de lancer, **Add environment variables** (ou, après, *Site configuration › Environment variables*). Trois variables :

   | Nom | Valeur |
   | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | la même que sur le site Albasse |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | la même que sur le site Albasse |
   | `EXPO_PUBLIC_SINGLE_PAGE` | `cafe` |

   (Pour retrouver les deux premières : site Albasse › *Site configuration › Environment variables*.) Les variables de paiement Airtel / Moov ne sont pas utilisées par la page.
4. **Deploy**. Au bout de quelques minutes, le site est en ligne.

## Étape 2. Choisir l'adresse gratuite

*Site configuration › Site details › Change site name* : par exemple `vitalite-homme`. L'adresse devient `https://vitalite-homme.netlify.app` (si le nom est libre ; sinon essaie `vitalite-energie-homme`, `cafe-homme-tchad`…). Gratuit, sans carte bancaire. Si tu changes encore le nom plus tard, l'ancienne adresse ne marche plus.

## Étape 3. Vérifier (2 minutes)

- Ouvre l'adresse sur ton téléphone : tu vois « Vitalité & Énergie Homme », le café, son prix, et **nulle part** « Albasse ».
- Touche « Commander maintenant » : la page de commande s'ouvre avec le café. Fais une vraie commande de test avec ton numéro, puis annule-la dans Admin › Commandes.
- Envoie l'adresse à quelqu'un sur WhatsApp : l'aperçu du lien affiche « Vitalité & Énergie Homme » et l'icône « V&É ».

## Pour ta publicité
Donne l'adresse, avec les repères habituels pour que « Performance par source » compte les visites :
`https://vitalite-homme.netlify.app/?utm_source=tiktok&utm_medium=paid&utm_campaign=cafe-homme`

## Un vrai nom en .com plus tard
Un nom gratuit la première année **sans rien acheter** n'existe presque plus (les « domaines gratuits » demandent d'acheter un hébergement dont tu n'as pas besoin). Un .com coûte environ 1 à 5 $ la première année, puis 10 à 20 $ par an, avec une carte bancaire internationale. Quand tu en as un : *Netlify › Domain management › Add a domain*, puis suivre les 2 lignes d'adresse (DNS) que Netlify indique. Le code n'a rien à changer.

## À savoir
- **Même base de données** : les deux sites partagent les articles, le stock, les clients et les commandes. Un client qui commande sur le site café a un compte qui marche aussi sur albasseshopping.com. C'est ce qui fait arriver les commandes dans ton admin.
- **Deux mises en ligne à chaque mise à jour du code** : à chaque changement sur `main`, Netlify refabrique les deux sites. Le plan gratuit de Netlify a une limite de minutes de fabrication par mois : si elle est atteinte, dis-le-moi.
- **Si tu changes la valeur de `EXPO_PUBLIC_SINGLE_PAGE`** : *Deploys › Trigger deploy › Clear cache and deploy site* (sinon Netlify peut garder l'ancienne version).
- **Mot de passe oublié par e-mail** : si un jour un lien d'e-mail doit ramener sur ce site, ajoute son adresse dans Supabase › *Authentication › URL Configuration › Redirect URLs*. La commande et la création de compte n'en ont pas besoin.
- **Enveloppe kaki** : la page promet une livraison dans une enveloppe kaki : c'est à ton équipe de préparer ainsi les colis qui contiennent « Café Homme ».
- **Aucune promesse de santé** n'est écrite sur la page (la ligne « aucun effet secondaire » de la fiche n'est pas reprise).

## Comment c'est fait (pour le code)
- `EXPO_PUBLIC_SINGLE_PAGE=cafe` à la fabrication : `src/lib/singlePage.ts`. Dans ce mode, l'onglet « Accueil » EST la page café (`CafeScreen`), la barre du bas, les bandeaux, les fenêtres et Zara ne sont pas affichés (`src/navigation/RootNavigator.tsx`, `TabNavigator.tsx`), et « / », « /cafe », « /vitalite-energie-homme » ouvrent cette page.
- `scripts/single-page-shell.js` (lancé par `netlify.toml` après la fabrication) : titre, description, aperçus, manifeste, icônes neutres (`public/single/cafe/`), `sw.js`, `offline.html`, `robots.txt`. **Sans la variable, le script ne fait rien** (le vrai site). Il fait échouer la fabrication s'il reste « Albasse » dans la coquille de la page.
- `netlify/edge-functions/og-preview.ts` et `sitemap.ts` : ne servent rien d'Albasse quand la variable est là.
- Tests : `node tests/single/shell.test.js`, `node --import ./tests/zara/register.mjs tests/email/single-page.test.ts`, `tests/seo/seo.test.ts`, et dans le navigateur (site fabriqué avec la variable, puis le script) : `PARTS='*' SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js <dossier> 4333`.
