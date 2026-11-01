// Site « page unique » : le script scripts/single-page-shell.js retire le nom d'Albasse Shopping de la coquille du site fabriqué.
// Aucun réseau. Lancer : node tests/single/shell.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const shell = require('../../scripts/single-page-shell.js');

let ok = 0;
const check = (label, cond, detail) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

const root = path.join(__dirname, '..', '..');
const pub = (f) => fs.readFileSync(path.join(root, 'public', f), 'utf8');

// une copie réaliste de dist/ (ce que « expo export » fabrique : index.html avec le titre rempli + les fichiers de public/)
const makeDist = (htmlTweak) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'single-dist-'));
  const html = pub('index.html').replace('%WEB_TITLE%', 'Albasse Shopping');
  fs.writeFileSync(path.join(dir, 'index.html'), htmlTweak ? htmlTweak(html) : html);
  for (const f of ['manifest.json', 'sw.js', 'offline.html']) fs.writeFileSync(path.join(dir, f), pub(f));
  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, 'public', f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'favicon.ico'), 'ancien');
  for (const f of ['sitemap.xml', 'robots.txt', 'google80a7957df67d5261.html', 'logo-albasse.gif', 'zara-avatar.jpg']) fs.writeFileSync(path.join(dir, f), 'albasse');
  return dir;
};
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const has = (dir, f) => fs.existsSync(path.join(dir, f));

// --- activation
check('seul EXPO_PUBLIC_SINGLE_PAGE=cafe active le script', shell.isEnabled({ EXPO_PUBLIC_SINGLE_PAGE: 'cafe' }) && shell.isEnabled({ EXPO_PUBLIC_SINGLE_PAGE: ' Cafe ' }) && !shell.isEnabled({}) && !shell.isEnabled({ EXPO_PUBLIC_SINGLE_PAGE: '' }) && !shell.isEnabled({ EXPO_PUBLIC_SINGLE_PAGE: 'autre' }));
const noop = spawnSync('node', [path.join(root, 'scripts', 'single-page-shell.js'), '--dist', '/tmp/dossier-inexistant-xyz'], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
check('SANS la variable (vrai site albasseshopping.com) : le script ne fait rien et ne plante jamais (code 0, même si dist/ est introuvable)', noop.status === 0 && /rien à faire/.test(noop.stdout), { status: noop.status, out: noop.stdout, err: noop.stderr });

// --- le site neutre
const dist = makeDist();
const res = shell.apply(dist, { env: { URL: 'https://vitalite-homme.netlify.app' } });
const html = read(dist, 'index.html');
const head = shell.shellOf(html);
check('index.html : titre « Vitalité & Énergie Homme » (écrit avec &amp; dans le HTML)', /<title>Vitalité &amp; Énergie Homme<\/title>/.test(head), head.match(/<title>.*<\/title>/)?.[0]);
check('index.html : plus aucun « Albasse » dans la coquille de la page (titre, description, aperçus, nom sous l\'icône)', !shell.brandLeft(head), head.match(/.*[Aa]lbasse.*/g));
check('aperçu des liens (WhatsApp, Facebook, TikTok) : nom, description du café et icône neutre en adresse complète', /og:title" content="Vitalité &amp; Énergie Homme"/.test(head) && /og:description" content="Café Homme : lot de 5 sachets/.test(head) && /og:image" content="https:\/\/vitalite-homme\.netlify\.app\/icon-512\.png"/.test(head) && /og:site_name" content="Vitalité &amp; Énergie Homme"/.test(head), head.match(/og:[a-z_]+" content="[^"]*"/g));
check('index.html : « noindex » pour Google (adresse cachée)', /<meta name="robots" content="noindex" \/>/.test(head));
check('nom sous l\'icône du téléphone : « V&É Homme »', /apple-mobile-web-app-title" content="V&amp;É Homme"/.test(head));
check('le reste de la page (style, scripts, application) n\'est pas modifié', html.includes('<div id="root"></div>') && html.includes('beforeinstallprompt') && html.length > 3000);
const manifest = JSON.parse(read(dist, 'manifest.json'));
check('manifest.json (raccourci sur l\'écran d\'accueil) : nom neutre, démarre sur « / », sans lien vers albasseshopping.com', manifest.name === 'Vitalité & Énergie Homme' && manifest.short_name === 'V&É Homme' && manifest.start_url === '/' && !/albasse/i.test(JSON.stringify(manifest)) && !manifest.related_applications, manifest);
check('icônes : les icônes neutres « V&É » remplacent celles d\'Albasse (192, 512, iPhone, favicon)', ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico'].every((f) => fs.readFileSync(path.join(dist, f)).equals(fs.readFileSync(path.join(root, 'public', 'single', 'cafe', f)))));
check('page « pas de connexion » : texte neutre', !/albasse/i.test(read(dist, 'offline.html')) && /Vitalité &amp; Énergie Homme a besoin d'internet/.test(read(dist, 'offline.html')), read(dist, 'offline.html').match(/.*Vitalité.*/g));
check('service worker : notification par défaut au nom de la page, le reste inchangé', !/'Albasse Shopping'/.test(read(dist, 'sw.js')) && /title: 'Vitalité & Énergie Homme'/.test(read(dist, 'sw.js')) && /addEventListener\('push'/.test(read(dist, 'sw.js')));
check('robots.txt simple (tout autorisé, aucun plan du site)', read(dist, 'robots.txt') === 'User-agent: *\nAllow: /\n');
check('plan du site, fichier Google d\'Albasse, logo animé et photo de Zara retirés', !has(dist, 'sitemap.xml') && !has(dist, 'google80a7957df67d5261.html') && !has(dist, 'logo-albasse.gif') && !has(dist, 'zara-avatar.jpg'));
check('le script rend le nom de la page', res.name === 'Vitalité & Énergie Homme');

// --- relancer le script sur un site déjà neutre ne casse rien
shell.apply(dist, { env: {} });
check('relancé une 2ᵉ fois : même résultat (le titre n\'est pas doublé)', (read(dist, 'index.html').match(/<title>/g) || []).length === 1 && !shell.brandLeft(shell.shellOf(read(dist, 'index.html'))));

// --- sans adresse du site (Netlify donne la variable URL) : l'icône reste en chemin relatif, jamais « undefined »
const dist2 = makeDist();
shell.apply(dist2, { env: {} });
check('sans la variable URL : og:image = /icon-512.png (jamais « undefined »)', /og:image" content="\/icon-512\.png"/.test(read(dist2, 'index.html')) && !/undefined/.test(shell.shellOf(read(dist2, 'index.html'))));

// --- jamais de site à moitié neutre : si le modèle change et laisse « Albasse » dans la coquille, la fabrication ÉCHOUE
const dist3 = makeDist((h) => h.replace('<meta name="theme-color"', '<meta name="author" content="Albasse Shopping" />\n    <meta name="theme-color"'));
let failed = null;
try {
  shell.apply(dist3, { env: {} });
} catch (e) {
  failed = e.message;
}
check('« Albasse » oublié dans la coquille : la fabrication échoue avec un message clair', !!failed && /index\.html/.test(failed) && /Albasse/.test(failed), failed);

// --- l'enveloppe complète en ligne de commande
const dist4 = makeDist();
const cli = spawnSync('node', [path.join(root, 'scripts', 'single-page-shell.js'), '--dist', dist4], { env: { PATH: process.env.PATH, EXPO_PUBLIC_SINGLE_PAGE: 'cafe', URL: 'https://x.netlify.app' }, encoding: 'utf8' });
check('en ligne de commande avec la variable : code 0 et site neutre', cli.status === 0 && !shell.brandLeft(shell.shellOf(read(dist4, 'index.html'))), { status: cli.status, err: cli.stderr });
const cliBad = spawnSync('node', [path.join(root, 'scripts', 'single-page-shell.js'), '--dist', '/tmp/dossier-inexistant-xyz'], { env: { PATH: process.env.PATH, EXPO_PUBLIC_SINGLE_PAGE: 'cafe' }, encoding: 'utf8' });
check('avec la variable mais sans dist/ : code 1 (la fabrication s\'arrête)', cliBad.status === 1, cliBad.status);

console.log(`\n${ok} contrôles réussis`);
