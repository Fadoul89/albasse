// Site « page unique » (docs/site-cafe-separe.md) : à lancer APRÈS `expo export -p web` (et generate-sitemap.js).
// Si la variable EXPO_PUBLIC_SINGLE_PAGE n'est pas « cafe » (le vrai site albasseshopping.com), le script ne fait RIEN et quitte tout de suite.
// Sinon il retire le nom d'Albasse Shopping de ce qui entoure l'application, dans le dossier dist/ :
//   - index.html : titre, description, aperçus des liens (WhatsApp, Facebook, TikTok…), nom sous l'icône du téléphone ;
//   - manifest.json (raccourci sur l'écran d'accueil), icônes et favicon (public/single/cafe/) ;
//   - sw.js et offline.html (textes visibles) ;
//   - robots.txt simple, plus de plan du site, plus de fichier de vérification Google d'Albasse ni de logo animé d'Albasse.
// Si, après cela, il reste « Albasse » dans la coquille de la page, la fabrication ÉCHOUE : jamais de site à moitié neutre mis en ligne.
const fs = require('fs');
const path = require('path');

const NAME = 'Vitalité & Énergie Homme';
const SHORT_NAME = 'V&É Homme';
const DESCRIPTION =
  'Café Homme : lot de 5 sachets individuels, préparation rapide, format pratique à emporter. Produit destiné aux hommes. Livraison dans une enveloppe kaki.';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const isEnabled = (env) => String((env || {}).EXPO_PUBLIC_SINGLE_PAGE || '').trim().toLowerCase() === 'cafe';

// la coquille d'une page : tout ce qui est avant la première balise <style> de la page (titre, description, aperçus, manifeste)
const shellOf = (html) => html.split('<style')[0];
const brandLeft = (text) => /albasse/i.test(text);

function neutralHtml(html, { siteUrl = '' } = {}) {
  const image = `${String(siteUrl).replace(/\/$/, '')}/icon-512.png`;
  let out = html;
  const set = (re, replacement) => {
    out = out.replace(re, replacement);
  };
  set(/<title>[^<]*<\/title>/, `<title>${esc(NAME)}</title>`);
  set(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(DESCRIPTION)}" />\n    <meta name="robots" content="noindex" />`);
  set(/<meta property="og:site_name" content="[^"]*"\s*\/?>/, `<meta property="og:site_name" content="${esc(NAME)}" />`);
  set(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(NAME)}" />`);
  set(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(DESCRIPTION)}" />`);
  set(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${esc(image)}" />`);
  set(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/, `<meta name="apple-mobile-web-app-title" content="${esc(SHORT_NAME)}" />`);
  return out;
}

function neutralManifest() {
  return {
    name: NAME,
    short_name: SHORT_NAME,
    description: DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#072469',
    theme_color: '#072469',
    orientation: 'portrait',
    prefer_related_applications: false,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

// les textes visibles d'un fichier (service worker, page « pas de connexion ») : le nom d'Albasse Shopping devient celui de la page
const neutralText = (text, { html = false } = {}) => text.replace(/Albasse Shopping/g, html ? esc(NAME) : NAME);

const robotsTxt = () => 'User-agent: *\nAllow: /\n';

function apply(distDir, { env = process.env, publicDir = path.join(__dirname, '..', 'public') } = {}) {
  const read = (f) => fs.readFileSync(path.join(distDir, f), 'utf8');
  const write = (f, content) => fs.writeFileSync(path.join(distDir, f), content);
  const exists = (f) => fs.existsSync(path.join(distDir, f));

  write('index.html', neutralHtml(read('index.html'), { siteUrl: env.URL || env.DEPLOY_PRIME_URL || '' }));
  write('manifest.json', JSON.stringify(neutralManifest(), null, 2) + '\n');
  for (const icon of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico']) {
    fs.copyFileSync(path.join(publicDir, 'single', 'cafe', icon), path.join(distDir, icon));
  }
  if (exists('sw.js')) write('sw.js', neutralText(read('sw.js')));
  if (exists('offline.html')) write('offline.html', neutralText(read('offline.html'), { html: true }));
  write('robots.txt', robotsTxt());
  for (const f of ['sitemap.xml', 'google80a7957df67d5261.html', 'logo-albasse.gif', 'zara-avatar.jpg']) {
    fs.rmSync(path.join(distDir, f), { force: true });
  }
  // dossier interne copié par erreur dans dist : jamais servi
  fs.rmSync(path.join(distDir, 'single'), { recursive: true, force: true });

  const left = [];
  if (brandLeft(shellOf(read('index.html')))) left.push('index.html');
  if (brandLeft(read('manifest.json'))) left.push('manifest.json');
  if (exists('offline.html') && brandLeft(read('offline.html'))) left.push('offline.html');
  if (left.length) throw new Error(`Le nom « Albasse » est encore dans : ${left.join(', ')}. Le modèle public/index.html a changé : adapter scripts/single-page-shell.js.`);
  return { name: NAME };
}

function main() {
  if (!isEnabled(process.env)) {
    console.log('Site normal (EXPO_PUBLIC_SINGLE_PAGE absent) : rien à faire.');
    return;
  }
  const arg = process.argv.indexOf('--dist');
  const distDir = path.resolve(arg > -1 ? process.argv[arg + 1] : path.join(__dirname, '..', 'dist'));
  apply(distDir);
  console.log(`Site « page unique » : coquille neutre (${NAME}) écrite dans ${distDir}`);
}

module.exports = { NAME, SHORT_NAME, DESCRIPTION, isEnabled, shellOf, brandLeft, neutralHtml, neutralManifest, neutralText, robotsTxt, apply };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
