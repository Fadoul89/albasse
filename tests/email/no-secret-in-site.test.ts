// Aucune clé secrète dans le site : tout ce qui commence par EXPO_PUBLIC_ est copié dans le site et lisible par tout le monde.
// Seules les clés faites pour être publiques sont permises (clé anon de Supabase, clé « publishable » de Stripe).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

const root = new URL('../../', import.meta.url).pathname;
const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js)$/.test(f)) files.push(p);
  }
};
walk(join(root, 'src'));
files.push(join(root, 'App.tsx'));

const ALLOWED = new Set(['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY']);
const bad: string[] = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/EXPO_PUBLIC_[A-Z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE)[A-Z0-9_]*/g)) {
    if (!ALLOWED.has(m[0])) bad.push(`${f.replace(root, '')} : ${m[0]}`);
  }
  // clés écrites en dur : clé « service_role » de Supabase (jeton dont le rôle est service_role), clés privées
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) bad.push(`${f.replace(root, '')} : clé privée`);
  if (/sk-ant-[A-Za-z0-9]|xkeysib-[a-f0-9]{20}|sk_live_[A-Za-z0-9]/.test(text)) bad.push(`${f.replace(root, '')} : clé d'API en dur`);
}
check(`${files.length} fichiers du site : aucune variable EXPO_PUBLIC_ secrète, aucune clé en dur`, bad.length === 0, bad);

const env = readFileSync(join(root, '.env.example'), 'utf8');
const envBad = [...env.matchAll(/^(EXPO_PUBLIC_[A-Z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE)[A-Z0-9_]*)=/gm)].map((m) => m[1]).filter((k) => !ALLOWED.has(k));
check('.env.example : aucune clé secrète proposée sous un nom EXPO_PUBLIC_', envBad.length === 0, envBad);

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
