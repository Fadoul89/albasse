// Genere dist/sitemap.xml et dist/robots.txt a partir des categories et
// produits actuellement en base. A executer APRES `expo export -p web`.
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  });
}

loadEnvFile(path.join(__dirname, '..', '.env'));

const SITE_URL = 'https://www.albasseshopping.com';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('Le dossier dist/ est introuvable. Lancez "expo export -p web" avant ce script.');
    process.exit(1);
  }

  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/recherche`, priority: '0.5' },
    { loc: `${SITE_URL}/contact`, priority: '0.4' },
  ];

  let categoryUrls = [];
  let productUrls = [];

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const headers = { apikey: SUPABASE_ANON_KEY };

      const catRes = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=slug`, { headers });
      const categories = await catRes.json();
      categoryUrls = (categories ?? []).map((c) => ({
        loc: `${SITE_URL}/categorie/${c.slug}`,
        priority: '0.8',
      }));

      const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug`, { headers });
      const products = await prodRes.json();
      productUrls = (products ?? [])
        .filter((p) => p.slug)
        .map((p) => ({ loc: `${SITE_URL}/produit/${p.slug}`, priority: '0.9' }));
    } catch (e) {
      console.warn('Impossible de récupérer catégories/produits pour le sitemap :', e.message);
    }
  } else {
    console.warn('Variables Supabase manquantes : sitemap généré sans produits/catégories.');
  }

  const allUrls = [...staticUrls, ...categoryUrls, ...productUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);

  const robots = `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);

  console.log(`Sitemap généré : ${allUrls.length} URLs (${categoryUrls.length} catégories, ${productUrls.length} produits).`);
}

main();
