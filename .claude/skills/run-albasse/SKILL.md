---
name: run-albasse
description: Build, run, and drive the Albasse Shopping Expo web app. Use when asked to start the site, take a screenshot of it, build it, or interact with its UI (click a button, check a page, verify a visual change).
---

Albasse Shopping is an Expo (React Native + react-native-web) e-commerce site. For agent use,
drive it headless: start the Expo web dev server, then control a headless Chromium against it
via the Playwright REPL at `.claude/skills/run-albasse/driver.mjs` (no GUI, no xvfb needed — this
is a web app, not a desktop app). `chromium-cli` is not installed in this environment, so the
driver talks to Playwright directly with the same command vocabulary.

All paths below are relative to the repo root.

## Prerequisites

Chromium + Playwright are already installed system-wide in this environment
(`/opt/pw-browsers/chromium`, package reachable via `NODE_PATH`). Nothing to install for the
driver itself. For the app's own dependencies:

```bash
npm ci
```

## Run (agent path)

1. Start the Expo web dev server in the background and wait for it to actually serve (don't
   `sleep`, poll the port):

```bash
lsof -ti:4321 -sTCP:LISTEN | xargs -r kill   # free the port if a previous run is still up
(nohup npx expo start --web --port 4321 > /tmp/expo-skill.log 2>&1 &)
timeout 40 bash -c 'until curl -sf http://localhost:4321 >/dev/null; do sleep 1; done'
```

2. Launch the driver under tmux and drive it:

```bash
tmux new-session -d -s app -x 200 -y 50
tmux send-keys -t app 'node .claude/skills/run-albasse/driver.mjs' Enter
timeout 20 bash -c 'until tmux capture-pane -t app -p | grep -q "driver>"; do sleep 0.3; done'
tmux send-keys -t app 'launch' Enter
timeout 30 bash -c 'until tmux capture-pane -t app -p | grep -q "launched"; do sleep 0.3; done'
tmux send-keys -t app 'nav /' Enter
tmux send-keys -t app 'wait-for text=Première plateforme' Enter
tmux send-keys -t app 'screenshot home' Enter
tmux capture-pane -t app -p
```

Screenshots land in `/tmp/shots/` (override: `SCREENSHOT_DIR`). The target site base URL
defaults to `http://localhost:4321` (override: `ALBASSE_URL`).

3. Stop when done:

```bash
tmux send-keys -t app 'quit' Enter
tmux kill-session -t app
pkill -f "expo start"
```

### Driver commands

| command | what it does |
|---|---|
| `launch` | launch headless Chromium (`--no-sandbox`), open one page |
| `nav <path-or-url>` | navigate; a bare path is resolved against `ALBASSE_URL` |
| `wait-for <css-sel>` or `wait-for text=<text>` | wait up to 15s for an element |
| `screenshot [name]` | full-page screenshot -> `/tmp/shots/<name>.png` |
| `screenshot-element <css-sel> [name]` | crop to one element |
| `click <css-sel>` or `click text=<exact text>` | click |
| `fill <css-sel> <text>` | fill an input |
| `type <text>` / `press <key>` | keyboard input |
| `eval <js-expr>` | evaluate in the page, prints JSON |
| `text [css-sel]` | print `innerText` (body if no selector) |
| `console --errors` | print any console.error messages seen since launch |
| `quit` | close the browser |

## Run (human path)

```bash
npx expo start --web --port 4321   # -> prints "Waiting on http://localhost:4321"; Ctrl-C to stop
```

Opens nothing by itself in this headless container — only useful alongside the agent path above
or a real browser elsewhere.

## Test

No automated UI test suite exercises the web build directly; this project's own custom test
runner (`node --import ./tests/zara/register.mjs tests/<path>.test.ts` and
`sh tests/sql/run-<feature>.sh`) covers pure logic and SQL separately — see `docs/` and
individual `tests/*/`.

## Gotchas

- **Node's ESM `import` ignores `NODE_PATH`.** The pre-installed Playwright package is only
  reachable through a `NODE_PATH` symlink chain
  (`/usr/local/lib/node_modules_global` -> `/opt/node22/lib/node_modules` -> a symlink to
  `/opt/node-tools/node_modules/playwright`), which only the CJS loader consults. A plain
  `import { chromium } from 'playwright'` in an `.mjs` file fails with `ERR_MODULE_NOT_FOUND`
  even though `node -e "require('playwright')"` works fine. Fix: use
  `createRequire(import.meta.url)('playwright')` instead of a static `import` — the driver
  already does this.
- **"An unknown error occurred while installing React Native DevTools"** followed by an Electron
  sandbox crash in the dev server log is harmless noise (Expo tries to open a local DevTools
  Electron window and fails because there's no display / `--no-sandbox` as root). The web
  bundler and `http://localhost:4321` are unaffected — confirmed by polling the port and loading
  the page successfully right after this line appears.
- **A "Télécharge l'app Albasse Shopping" install-prompt popup appears automatically a few
  seconds after the home page loads**, on top of whatever else is on screen (it can overlay a
  cookie-consent banner or any other element). If a `click` on something else seems to do
  nothing, `screenshot` first to check whether this popup is sitting on top, and close it (click
  its `×` or "Plus tard") before continuing.
- **Pass `executablePath: '/opt/pw-browsers/chromium'` and `args: ['--no-sandbox']`** when
  launching — this environment has no other Chromium and runs as root, so the default sandbox
  fails to initialize.
