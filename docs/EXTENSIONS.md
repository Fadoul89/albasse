# Extensions de l'agent IA (Claude Code)

Ce projet utilise quatre extensions pour l'agent de code. Une seule est déjà
active via la config du dépôt (Context7) ; les trois autres s'installent une
fois sur ta machine avec les commandes ci-dessous (PowerShell ou terminal).

| Extension     | Rôle                                                        | Statut dans le dépôt          |
|---------------|-------------------------------------------------------------|-------------------------------|
| Context7      | Doc à jour des librairies (Expo 57, Supabase, React Native) | ✅ `.mcp.json` (auto)          |
| Agent Skills  | Compétences officielles Expo + Supabase pour l'agent        | ⏳ à installer (`.claude/skills/`) |
| Graphify      | Graphe de connaissances du code (`/graphify`)               | ⏳ à installer (`.claude/`)    |
| Strix         | Agent de tests de sécurité (pentest) sur l'app              | ⏳ CLI locale (Docker)         |

## 1. Context7 — déjà configuré

Le fichier `.mcp.json` à la racine déclare le serveur MCP distant de Context7.
Claude Code le propose automatiquement à l'ouverture du projet (accepter).

- Une clé API est facultative (quota plus élevé) : crée-la sur
  https://context7.com/dashboard puis définis `CONTEXT7_API_KEY` dans ton
  environnement.
- Usage : ajoute « use context7 » à une demande, ex. « ajoute expo-camera,
  use context7 ».

## 2. Agent Skills (Expo + Supabase)

Depuis la racine du projet :

```bash
# Skills officielles Expo (build, déploiement, upgrade, debug)
npx skills@latest add expo/skills --skill '*' --agent claude-code

# Skills officielles Supabase (RLS, migrations, edge functions)
npx skills@latest add supabase/agent-skills --agent claude-code
```

Alternative Expo via le marketplace de plugins :
`claude plugin install expo@claude-plugins-official`

Mise à jour : `npx skills@latest update`. Committer ensuite `.claude/skills/`
pour que toutes les sessions (y compris cloud) en profitent.

## 3. Graphify

Nécessite Python 3.10+ et `uv` (ou `pipx`).

```bash
uv tool install graphifyy        # paquet avec deux « y », commande « graphify »
graphify install --project       # écrit le skill + hooks dans .claude/ du dépôt
```

Puis dans Claude Code : `/graphify .` pour construire le graphe.
Committer les fichiers ajoutés sous `.claude/` (le dossier `graphify-out/` est
ignoré par git).

## 4. Strix (tests de sécurité)

Nécessite Docker démarré, Python 3.12+ et une clé d'un fournisseur LLM.

```bash
pipx install strix-agent

# Exemple de configuration (PowerShell : $env:STRIX_LLM="...")
export STRIX_LLM="anthropic/claude-sonnet-5-5"
export LLM_API_KEY="ta-cle"

# Audit du code source
strix --target ./

# Audit du site déployé (uniquement nos propres domaines)
strix --target https://<ton-site>.netlify.app
```

Les rapports sont écrits dans `strix_runs/` (ignoré par git).
⚠️ Ne jamais cibler un site ou un service qui ne nous appartient pas.
