// REPL driver for Albasse Shopping (Expo web). Run headless on Linux — no xvfb needed,
// this drives a headless Chromium against the Expo web dev server, not a desktop window.
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output. No chromium-cli
// in this environment, so this adapts the same command vocabulary directly on Playwright.
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

// Node's ESM `import` resolver ignores NODE_PATH, but the pre-installed Playwright in this
// environment is only reachable through it (NODE_PATH -> .../node_modules_global -> a symlink
// to the real playwright package). CJS `require()` does honor NODE_PATH, so we go through it.
const { chromium } = createRequire(import.meta.url)('playwright');

const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const BASE_URL = process.env.ALBASSE_URL || 'http://localhost:4321';

let browser = null;
let page = null;
const consoleErrors = [];

const COMMANDS = {
  async launch() {
    if (browser) return console.log('already launched');
    // --no-sandbox: running as root in this container, Chromium's sandbox needs
    // user namespaces/CAP_SYS_ADMIN that aren't available here.
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
    page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })).newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    console.log('launched.');
  },

  async nav(url) {
    if (!page) return console.log('ERROR: launch first');
    const target = /^https?:\/\//.test(url) ? url : `${BASE_URL}${url ? '/' + url.replace(/^\//, '') : ''}`;
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
    console.log('nav ->', target);
  },

  async 'wait-for'(sel) {
    if (!page) return console.log('ERROR: launch first');
    try {
      if (sel.startsWith('text=')) await page.getByText(sel.slice(5)).first().waitFor({ timeout: 15_000 });
      else await page.waitForSelector(sel, { timeout: 15_000 });
      console.log('found:', sel);
    } catch {
      console.log('TIMEOUT:', sel);
    }
  },

  async screenshot(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  async 'screenshot-element'(args) {
    if (!page) return console.log('ERROR: launch first');
    const [sel, name] = args.split(/\s+(?=\S+$)/);
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    try {
      await page.locator(sel).first().screenshot({ path: f });
      console.log('screenshot:', f);
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try {
      if (sel.startsWith('text=')) await page.getByText(sel.slice(5), { exact: true }).first().click();
      else await page.locator(sel).first().click();
      console.log('click', sel, '-> OK');
    } catch (e) {
      console.log('click', sel, '-> ERROR:', e.message);
    }
  },

  async fill(args) {
    if (!page) return console.log('ERROR: launch first');
    const [sel, ...rest] = args.split(' ');
    await page.locator(sel).first().fill(rest.join(' '));
    console.log('fill', sel, '-> OK');
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 20 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null
    ));
  },

  'console'(flag) {
    if (flag === '--errors' || flag === '') {
      console.log(consoleErrors.length === 0 ? 'no console errors' : consoleErrors.join('\n'));
    }
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    browser = null;
    page = null;
  },
  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '));
  },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  const sp = trimmed.indexOf(' ');
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp);
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log('unknown:', cmd, '- try: help');
    return rl.prompt();
  }
  try {
    await fn(rest);
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  if (cmd === 'quit') {
    rl.close();
    process.exit(0);
  }
  rl.prompt();
});
rl.on('close', async () => {
  await COMMANDS.quit();
  process.exit(0);
});

console.log('albasse driver - "help" for commands, "launch" to start, then "nav /" to open the home page');
rl.prompt();
