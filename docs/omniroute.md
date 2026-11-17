# OmniRoute : l'IA de la boutique par une passerelle

Zara (`zara-ai`), l'assistant marketing (`marketing-ai`) et Zara SEO (`zara-seo`) passent maintenant par un seul fichier, `supabase/functions/_shared/llm.ts`.

**Ordre de passage :**

1. Si `OMNIROUTE_URL` et `OMNIROUTE_API_KEY` sont réglés, la demande part vers OmniRoute (format OpenAI, `/v1/chat/completions`).
2. Si OmniRoute ne répond pas (panne, plus de 60 s, erreur, quota) et que `ANTHROPIC_API_KEY` existe, la fonction appelle Claude directement, en secours. Le client ne voit pas de différence.
3. Sans réglage OmniRoute, rien ne change : Claude directement, comme avant.

Les outils de Zara (chercher des articles, promotions, cartes) et les photos de Zara SEO sont traduits dans les deux sens par `_shared/omniroute.ts`. Les règles de contrôle (faux chiffres, règles SEO, limites par visiteur) restent les mêmes.

## Mise en service

1. **Héberger OmniRoute sur une adresse publique en HTTPS** (serveur, VPS…). L'adresse par défaut `localhost:20128` ne marche pas : les fonctions Supabase tournent dans le cloud et ne voient pas votre ordinateur.
2. Dans OmniRoute : créer une clé API, et choisir le modèle ou le « combo » à utiliser (il doit savoir lire les photos et utiliser des outils, sinon Zara et Zara SEO ne marcheront pas bien).
3. Supabase › Edge Functions › **Secrets** :
   - `OMNIROUTE_URL` : ex. `https://ia.mon-domaine.com` (avec ou sans `/v1`)
   - `OMNIROUTE_API_KEY` : la clé créée dans OmniRoute
   - `OMNIROUTE_MODEL` : le nom du modèle ou combo dans OmniRoute (si absent : `claude-sonnet-5-5`)
   - garder `ANTHROPIC_API_KEY` pour le secours (conseillé)
4. Redéployer `zara-ai`, `marketing-ai` et `zara-seo` (le dossier `_shared` part avec elles : `supabase functions deploy zara-ai marketing-ai zara-seo`).

Pour revenir à Claude seul : supprimer `OMNIROUTE_URL` dans les secrets. Pas besoin de redéployer.

## Fichiers et tests

| Rôle | Fichier |
| --- | --- |
| Choix OmniRoute / secours Claude | `supabase/functions/_shared/llm.ts` |
| Traduction Claude ↔ OpenAI (sans réseau) | `supabase/functions/_shared/omniroute.ts` |
| Tests (28) | `node --import ./tests/zara/register.mjs tests/ai/omniroute.test.ts` |

Aucune table ni script SQL n'est ajouté.
