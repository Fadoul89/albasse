// Vraie page 404 : une adresse inconnue reçoit le code 404, tout le reste reste intact (netlify/edge-functions/not-found.ts).
import { readFileSync } from 'node:fs';
import notFound from '../../netlify/edge-functions/not-found.ts';
import { isKnownPath, KNOWN_PATHS, KNOWN_PREFIXES, looksLikeFile } from '../../netlify/edge-functions/lib/routes.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

// faux Deno.env (la fonction regarde si le site est en mode « page unique »)
const env: Record<string, string> = {};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] } };

const SHELL = '<html>application</html>';
async function ask(path: string, opts: { method?: string; status?: number; type?: string; body?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ 'content-type': opts.type ?? 'text/html; charset=utf-8', ...(opts.headers ?? {}) });
  const origin = new Response(opts.body ?? SHELL, { status: opts.status ?? 200, headers });
  const res = await notFound(new Request(`https://www.albasseshopping.com${path}`, { method: opts.method ?? 'GET' }), { next: async () => origin } as any);
  return { res, origin };
}

(async () => {
  // adresses inconnues -> 404, avec la page de l'application (elle affiche « Page introuvable »)
  for (const p of ['/nimporte-quoi', '/produit', '/produit/', '/categorie', '/admin', '/admin/', '/wp-login', '/a/b/c', '/mes-commandes/x']) {
    const { res } = await ask(p);
    check(`${p} : code 404`, res.status === 404, res.status);
    check(`${p} : la page de l'application est servie (pas une page vide)`, (await res.text()) === SHELL);
  }
  const unk = await ask('/nimporte-quoi');
  check('404 : pas d\'indexation, pas de cache', unk.res.headers.get('x-robots-tag') === 'noindex' && unk.res.headers.get('cache-control') === 'no-store');
  check('404 : le type de contenu reste de l\'HTML', /text\/html/.test(unk.res.headers.get('content-type') ?? ''));
  const head = await ask('/nimporte-quoi', { method: 'HEAD' });
  check('HEAD sur une adresse inconnue : 404 aussi', head.res.status === 404);

  // adresses connues -> la réponse normale, intacte
  for (const p of ['/', '/recherche', '/contact', '/contact/', '/conditions-generales', '/conditions-de-retour', '/confidentialite', '/produit/montre-keep-moving', '/categorie/montres', '/facture/abc', '/admin/produits', '/commande', '/commande/confirmation', '/mes-commandes', '/panier', '/app', '/installer']) {
    const { res, origin } = await ask(p);
    check(`${p} : réponse normale (200, non modifiée)`, res.status === 200 && res === origin && res.headers.get('x-robots-tag') === null);
  }

  // fichiers et réponses qui ne sont pas la coquille
  for (const [p, o] of [
    ['/google80a7957df67d5261.html', { type: 'text/html' }],
    ['/offline.html', { type: 'text/html' }],
    ['/sw.js', { type: 'application/javascript' }],
    ['/manifest.json', { type: 'application/json' }],
    ['/sitemap.xml', { type: 'application/xml' }],
    ['/robots.txt', { type: 'text/plain' }],
    ['/_expo/static/js/web/index-abc.js', { type: 'application/javascript' }],
    ['/logo.png', { type: 'image/png' }],
    ['/inconnue', { status: 301 }],
    ['/inconnue', { status: 404 }],
    ['/inconnue', { status: 500 }],
    ['/inconnue', { type: 'application/json' }],
    ['/inconnue', { method: 'POST' }],
  ] as [string, any][]) {
    const { res, origin } = await ask(p, o);
    check(`${p} ${JSON.stringify(o)} : jamais modifié`, res === origin && res.status === (o.status ?? 200), res.status);
  }

  // site « page unique » : rien ne change
  env.EXPO_PUBLIC_SINGLE_PAGE = 'cafe';
  const single = await ask('/nimporte-quoi');
  check('site « page unique » : aucune modification', single.res === single.origin && single.res.status === 200);
  delete env.EXPO_PUBLIC_SINGLE_PAGE;

  // la fonction ne casse jamais le site : si la réponse est illisible, on la renvoie telle quelle
  const bad = await notFound(new Request('https://x.td/inconnue'), { next: async () => ({ status: 200, headers: null }) } as any).catch((e: unknown) => 'plante');
  check('réponse inattendue : la fonction ne plante pas', bad !== 'plante');

  // fichiers reconnus
  check('looksLikeFile : /a/b.js et le fichier Google oui', looksLikeFile('/a/b.js') && looksLikeFile('/google80a7957df67d5261.html') && looksLikeFile('/sw.js'));
  check('looksLikeFile : /contact et /produit/montre-keep-moving non (ce sont des pages)', !looksLikeFile('/contact') && !looksLikeFile('/produit/montre-keep-moving'));

  // la liste du serveur doit couvrir TOUTES les adresses de l'application (linking de RootNavigator.tsx)
  {
    const src = readFileSync(new URL('../../src/navigation/RootNavigator.tsx', import.meta.url), 'utf8');
    const block = src.slice(src.indexOf('screens: {'), src.indexOf('const navTheme'));
    const found = new Set<string>();
    for (const m of block.matchAll(/(?:path: )?'([a-z][a-z0-9/:-]*)'/g)) found.add(m[1]);
    found.delete('Tabs');
    const wanted = [...found].filter((x) => x !== 'NotFound');
    const missing: string[] = [];
    for (const raw of wanted) {
      const withParam = raw.split('/').map((seg) => (seg.startsWith(':') ? 'x' : seg)).join('/');
      if (!isKnownPath(`/${withParam}`)) missing.push(raw);
    }
    check(`toutes les adresses de l'application sont connues du serveur (${wanted.length} vérifiées)`, wanted.length > 40 && missing.length === 0, missing);
    check('NotFound: \'*\' est bien déclaré dans l\'application', /NotFound: '\*'/.test(block));
    check('NotFound est libre d\'accès même sans compte (WALL_FREE_ROUTES)', /'NotFound'/.test(readFileSync(new URL('../../src/lib/accountWall.ts', import.meta.url), 'utf8')));
    check('listes cohérentes : pas de doublon', new Set(KNOWN_PATHS).size === KNOWN_PATHS.length && KNOWN_PREFIXES.every((x) => x.startsWith('/') && x.endsWith('/')));
  }

  // la configuration Netlify
  {
    const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
    const block = toml.slice(toml.indexOf('function = "not-found"') - 40, toml.indexOf('function = "not-found"') + 700);
    check('netlify.toml : not-found sur /* avec les fichiers exclus', /path = "\/\*"\s+function = "not-found"\s+excludedPath = \[/.test(block) && ['/_expo/*', '/assets/*', '/*.js', '/*.css', '/*.png', '/*.jpg', '/*.html', '/*.xml'].every((x) => block.includes(`"${x}"`)), block.slice(0, 200));
    check('netlify.toml : cache d\'un an pour les fichiers au nom unique, et seulement pour eux', /for = "\/_expo\/static\/\*"\s+\[headers\.values\]\s+Cache-Control = "public, max-age=31536000, immutable"/.test(toml) && /for = "\/assets\/\*"\s+\[headers\.values\]\s+Cache-Control = "public, max-age=31536000, immutable"/.test(toml) && (toml.match(/immutable/g) ?? []).length === 2);
    check('netlify.toml : en-têtes de sécurité', /X-Content-Type-Options = "nosniff"/.test(toml) && /Referrer-Policy = "strict-origin-when-cross-origin"/.test(toml) && /X-Frame-Options = "SAMEORIGIN"/.test(toml));
    check('netlify.toml : pas de Content-Security-Policy ni de HSTS ajoutés à la main (risque de casser le site / déjà géré par Netlify)', !/Content-Security-Policy|Strict-Transport-Security/i.test(toml));
  }

  console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
  process.exit(ko ? 1 : 0);
})();
