# Albasse Shopping

Application e-commerce de mode masculine haut de gamme, construite avec Expo
(React Native + TypeScript) — un seul code pour Web, Android et iOS.

## Stack technique

- **Frontend** : Expo (React Native + TypeScript)
- **Navigation** : React Navigation (stack + tabs)
- **State** : Zustand (panier persistant, authentification)
- **Backend / DB / Auth** : Supabase (Postgres + Row Level Security)
- **Paiement** : Mobile Money (Airtel Money, Moov Money) — structure prête pour Stripe
- **Déploiement web** : Netlify · **Mobile** : Expo EAS

## Démarrage

```bash
npm install
npm run web       # version web (navigateur)
npm run android    # émulateur / téléphone Android
npm run ios        # nécessite macOS
```

Sans configuration Supabase, l'app tourne automatiquement avec des **données
de démonstration** (voir `src/constants/mockData.ts`) pour que l'interface
soit testable immédiatement.

## Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL du projet, exécutez le contenu de `supabase/schema.sql`
   (tables, sécurité RLS, catégories de base)
3. Copiez `.env.example` vers `.env` et renseignez :
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (Réglages du projet Supabase → API)
4. Pour promouvoir un compte en administrateur, après inscription :
   ```sql
   update profiles set is_admin = true where email = 'votre-email@exemple.com';
   ```

## Paiement Mobile Money

Les intégrations Airtel Money et Moov Money sont structurées dans
`src/lib/payments/` mais nécessitent vos identifiants marchands (Tchad) pour
être activées. Une fois vos comptes ouverts, ajoutez dans `.env` :

```
EXPO_PUBLIC_AIRTEL_MONEY_MERCHANT_ID=...
EXPO_PUBLIC_AIRTEL_MONEY_API_KEY=...
EXPO_PUBLIC_MOOV_MONEY_MERCHANT_ID=...
EXPO_PUBLIC_MOOV_MONEY_API_KEY=...
```

Stripe pourra être ajouté plus tard en implémentant un nouveau provider dans
`src/lib/payments/` (interface `PaymentProvider` déjà prête).

## Structure du projet

```
src/
├── theme/        Couleurs, typographie (noir/or/rouge, Fraunces/Manrope)
├── types/        Types TypeScript (Product, Category, User, Order, CartItem)
├── lib/          Client Supabase, service commandes, paiements
├── store/        Zustand : panier, authentification
├── navigation/   Stack + tab navigators
├── screens/      Tous les écrans (accueil, catégorie, produit, panier, compte, admin)
├── components/   Composants réutilisables (ProductCard, GoldButton, etc.)
├── constants/    Catégories, données de démonstration
└── hooks/        useProducts, useReviews (Supabase ↔ démo automatique)

supabase/
└── schema.sql    Schéma complet à exécuter dans Supabase
```

## Déploiement

- **Web (Netlify)** : `npx expo export -p web`, publier le dossier `dist/`
- **Mobile (Expo EAS)** : `npx eas build` puis `npx eas submit`
