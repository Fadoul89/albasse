// SEO, étape 1 : textes, données structurées (JSON-LD), pages vues par Google, plan du site et robots.txt.
// Les vraies fonctions Netlify (og-preview.ts et sitemap.ts) tournent ici avec un faux Netlify et une fausse base : aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/seo/seo.test.ts
import { readFileSync } from 'node:fs';
import * as seo from '../../netlify/edge-functions/lib/seo.ts';
import ogPreview from '../../netlify/edge-functions/og-preview.ts';
import sitemap from '../../netlify/edge-functions/sitemap.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// --- textes ---
check('cleanText : balises, espaces et retours à la ligne retirés', seo.cleanText('  <b>Montre</b>\n\n  homme   sport ') === 'Montre homme sport');
check('cut : coupe au mot entier et ajoute …', seo.cut('Une très belle montre de sport pour homme avec bracelet', 30) === 'Une très belle montre de…', seo.cut('Une très belle montre de sport pour homme avec bracelet', 30));
check('cut : texte court inchangé', seo.cut('Montre', 30) === 'Montre');
check('fcfa : espace normal (pas d\'espace insécable)', seo.fcfa(15000) === '15 000 FCFA' && !/[  ]/.test(seo.fcfa(1234567)), seo.fcfa(1234567));
check('fcfa : texte « 15000.00 » accepté', seo.fcfa('15000.00') === '15 000 FCFA');

const longName = 'Ensemble survêtement homme coton premium avec capuche et poches zippées édition limitée';
const title = seo.productTitle(longName, 25000);
check('titre produit : 62 caractères au plus pour un nom long', title.length <= 62, { title, n: title.length });
check('titre produit : contient le prix et le nom du site', /25 000 FCFA \| Albasse Shopping$/.test(title), title);
check('titre produit : nom court gardé en entier', seo.productTitle('Montre KEEP MOVING', 11000) === 'Montre KEEP MOVING – 11 000 FCFA | Albasse Shopping');

const withDesc = seo.productDescription({ name: 'X', slug: 'x', price: 15000, description: '110 Degrees Emper pour homme\nParfum frais et boisé, tenue de longue durée, flacon de 100 ml.' }, 'Parfums');
check('description produit : une seule ligne, 160 caractères au plus', !/\n/.test(withDesc) && withDesc.length <= 160, withDesc);
check('description produit : prix et livraison ajoutés', /15 000 FCFA/.test(withDesc) && /Livraison au Tchad/.test(withDesc), withDesc);
const noDesc = seo.productDescription({ name: 'Sandal MS', slug: 's', price: 22500, description: '' }, 'Chaussures');
check('sans description : phrase de secours avec des faits connus seulement', noDesc === "Achetez Sandal MS (Chaussures) à 22 500 FCFA sur Albasse Shopping. Livraison au Tchad, paiement à la livraison à N'Djamena.", noDesc);
const short = seo.productDescription({ name: '110 Degrees', slug: 'x', price: 15000, description: '110 Degrees Emper pour homme' }, 'Parfum');
check('description courte mais utile : gardée, avec le prix', short === '110 Degrees Emper pour homme. Prix : 15 000 FCFA. Livraison au Tchad.', short);
check('description trop vide (< 10 caractères) : phrase de secours', /^Achetez /.test(seo.productDescription({ name: 'X', slug: 'x', price: 1000, description: 'ok' })));
check('description catégorie : nombre d\'articles écrit', /12 articles/.test(seo.categoryDescription('Montres', 12)) && /1 article,/.test(seo.categoryDescription('Montres', 1)));
check('description accueil : 160 caractères au plus', seo.homeDescription([{ name: 'Montres', slug: 'm' }, { name: 'Parfums', slug: 'p' }, { name: 'Chaussures', slug: 'c' }, { name: 'Cosmétique', slug: 'co' }, { name: 'Lunettes', slug: 'l' }, { name: 'Autre', slug: 'a' }]).length <= 160);

// --- données structurées ---
const prod = { name: 'Montre KEEP MOVING', slug: 'montre-keep-moving', description: 'Montre de sport étanche avec bracelet souple et grand cadran lisible.', price: '11000.00', images: ['https://img.example/a.jpg', 'http://insecure/b.jpg', 'https://img.example/c.jpg'], stock: 80 };
const ld: any = seo.productJsonLd(prod, { name: 'Montres', slug: 'montres' });
check('Product : type, nom, SKU', ld['@type'] === 'Product' && ld.name === 'Montre KEEP MOVING' && ld.sku === 'montre-keep-moving');
check('Product : prix en XAF sans décimales', ld.offers.priceCurrency === 'XAF' && ld.offers.price === '11000', ld.offers);
check('Product : en stock', ld.offers.availability === 'https://schema.org/InStock');
check('Product : seulement les photos https', JSON.stringify(ld.image) === JSON.stringify(['https://img.example/a.jpg', 'https://img.example/c.jpg']), ld.image);
check('Product : épuisé quand stock = 0', (seo.productJsonLd({ ...prod, stock: 0 }) as any).offers.availability === 'https://schema.org/OutOfStock');
check('Product : AUCUNE note ni avis (les avis du site peuvent être de démonstration)', !/aggregateRating|reviewRating|"review"|ratingValue/.test(JSON.stringify(ld)));
check('Product : adresse de l\'offre = adresse de la fiche', ld.offers.url === 'https://www.albasseshopping.com/produit/montre-keep-moving');
const bc: any = seo.breadcrumbJsonLd([{ name: 'Accueil', url: 'https://x/' }, { name: 'Montres', url: 'https://x/c' }]);
check('Fil d\'Ariane : positions 1, 2', bc.itemListElement.map((i: any) => i.position).join() === '1,2');
check('jsonLdScript : « < » ne peut pas fermer la balise', !/<\/script>.*<\/script>/s.test(seo.jsonLdScript({ name: '</script><script>alert(1)</script>' }).replace(/<script type="application\/ld\+json">/, '')) && !seo.jsonLdScript({ a: '<' }).slice(40, -9).includes('<'));

// --- faux Netlify + fausse base ---
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
(globalThis as any).Deno = { env: { get: (k: string) => ({ EXPO_PUBLIC_SUPABASE_URL: 'https://db.example', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon' } as Record<string, string>)[k] } };

const categories = [
  { id: 'c1', name: 'Montres', slug: 'montres', image_url: 'https://img.example/cat-montres.jpg' },
  { id: 'c2', name: 'Parfums & Cosmétique', slug: 'parfums', image_url: null },
];
const products = [
  { name: 'Montre KEEP MOVING', slug: 'montre-keep-moving', description: prod.description, price: 11000, images: prod.images, stock: 80, category_id: 'c1', categories: { name: 'Montres', slug: 'montres' } },
  { name: 'Eau <b>"fraîche"</b> & boisée', slug: 'eau-fraiche', description: '', price: 15000, images: ['https://img.example/e.jpg'], stock: 0, category_id: 'c2', categories: { name: 'Parfums & Cosmétique', slug: 'parfums' } },
];
let dbDown = false;
const calls: string[] = [];
globalThis.fetch = (async (input: any) => {
  const u = String(input);
  calls.push(u);
  if (dbDown) throw new Error('réseau coupé');
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  if (u.includes('/rest/v1/categories?slug=eq.')) {
    const slug = decodeURIComponent(u.match(/slug=eq\.([^&]+)/)![1]);
    return json(categories.filter((c) => c.slug === slug));
  }
  if (u.includes('/rest/v1/categories')) return json(categories);
  if (u.includes('/rest/v1/products?slug=eq.')) {
    const slug = decodeURIComponent(u.match(/slug=eq\.([^&]+)/)![1]);
    return json(products.filter((p) => p.slug === slug));
  }
  if (u.includes('/rest/v1/products?category_id=eq.')) {
    const id = u.match(/category_id=eq\.([^&]+)/)![1];
    return json(products.filter((p) => p.category_id === id));
  }
  if (u.includes('/rest/v1/products')) return json(products);
  return new Response('[]', { status: 404 });
}) as typeof fetch;

const ctx = () => {
  const state = { next: 0 };
  return {
    state,
    context: {
      next: async () => {
        state.next++;
        return new Response('<html>application</html>', { headers: { 'content-type': 'text/html' } });
      },
    } as any,
  };
};
const ask = (fn: any, path: string, ua = GOOGLEBOT) => {
  const c = ctx();
  return fn(new Request(`https://www.albasseshopping.com${path}`, { headers: { 'user-agent': ua } }), c.context).then((res: Response) => ({ res, state: c.state }));
};
const ldBlocks = (html: string): any[] => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));

(async () => {
  // visiteur normal : l'application, rien d'autre
  {
    const { res, state } = await ask(ogPreview, '/produit/montre-keep-moving', CHROME);
    check('visiteur normal : l\'application normale (context.next)', state.next === 1 && (await res.text()) === '<html>application</html>');
    check('visiteur normal : réponse non modifiée (aucun en-tête ajouté)', res.headers.get('vary') === null && calls.length === 0, { vary: res.headers.get('vary'), appels: calls.length });
  }

  // accueil
  {
    calls.length = 0;
    const { res, state } = await ask(ogPreview, '/');
    const html = await res.text();
    check('accueil (Google) : page fabriquée, pas l\'application', state.next === 0 && res.status === 200);
    check('accueil : titre, description, adresse canonique', /<title>Albasse Shopping – Boutique en ligne au Tchad<\/title>/.test(html) && /<meta name="description" content="Boutique en ligne au Tchad : Montres/.test(html) && /<link rel="canonical" href="https:\/\/www\.albasseshopping\.com\/" \/>/.test(html));
    const blocks = ldBlocks(html);
    check('accueil : données structurées OnlineStore + WebSite (JSON valide)', blocks.map((b) => b['@type']).join() === 'OnlineStore,WebSite', blocks.map((b) => b['@type']));
    check('accueil : liens vers les catégories et les articles', html.includes('href="https://www.albasseshopping.com/categorie/montres"') && html.includes('href="https://www.albasseshopping.com/produit/montre-keep-moving"'));
    check('accueil : « & » écrit &amp; dans le HTML', html.includes('Parfums &amp; Cosmétique') && !html.includes('Parfums & Cosmétique<'));
    check('accueil : en-tête Vary: User-Agent', /user-agent/i.test(res.headers.get('vary') ?? ''));
  }

  // produit
  {
    const { res } = await ask(ogPreview, '/produit/montre-keep-moving');
    const html = await res.text();
    check('produit : titre avec prix', html.includes('<title>Montre KEEP MOVING – 11 000 FCFA | Albasse Shopping</title>'));
    check('produit : canonical = adresse de la fiche', html.includes('<link rel="canonical" href="https://www.albasseshopping.com/produit/montre-keep-moving" />'));
    check('produit : photo principale pour les réseaux', html.includes('<meta property="og:image" content="https://img.example/a.jpg" />'));
    check('produit : prix et stock en méta', html.includes('product:price:amount" content="11000"') && html.includes('content="in stock"'));
    const blocks = ldBlocks(html);
    const p = blocks.find((b) => b['@type'] === 'Product');
    const b = blocks.find((x) => x['@type'] === 'BreadcrumbList');
    check('produit : données structurées Product valides', p?.offers?.price === '11000' && p?.offers?.availability === 'https://schema.org/InStock', p?.offers);
    check('produit : fil d\'Ariane Accueil › Montres › produit', b?.itemListElement?.map((i: any) => i.name).join(' > ') === 'Accueil > Montres > Montre KEEP MOVING', b);
    check('produit : pas de noindex', !/noindex/.test(html));
  }
  {
    // nom piégé : ne doit jamais casser la page ni ouvrir une balise
    const { res } = await ask(ogPreview, '/produit/eau-fraiche');
    const html = await res.text();
    check('produit piégé : balises du nom retirées, « & » et guillemets échappés dans le HTML', !html.includes('<b>') && html.includes('<h1>Eau &quot;fraîche&quot; &amp; boisée</h1>'), html.match(/<h1>.*<\/h1>/)?.[0]);
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">/g)].length;
    const closes = [...html.matchAll(/<\/script>/g)].length;
    check('produit piégé : chaque balise script est bien fermée une seule fois', scripts === closes && scripts === 2, { scripts, closes });
    check('produit épuisé : OutOfStock', ldBlocks(html).find((b) => b['@type'] === 'Product')?.offers?.availability === 'https://schema.org/OutOfStock');
    check('produit sans description : description de secours (une ligne)', /Achetez .* sur Albasse Shopping/.test(html) && !/content="[^"]*\n/.test(html));
  }
  {
    const { res, state } = await ask(ogPreview, '/produit/inconnu');
    const html = await res.text();
    check('produit inconnu : réponse 404 + noindex pour Google', res.status === 404 && /noindex/.test(html) && state.next === 0, res.status);
  }

  // catégorie
  {
    const { res } = await ask(ogPreview, '/categorie/montres');
    const html = await res.text();
    check('catégorie : titre et description', html.includes('<title>Montres – achat en ligne au Tchad | Albasse Shopping</title>') && /1 article,/.test(html));
    const col = ldBlocks(html).find((b) => b['@type'] === 'CollectionPage');
    check('catégorie : liste d\'articles structurée', col?.mainEntity?.numberOfItems === 1 && col.mainEntity.itemListElement[0].url === 'https://www.albasseshopping.com/produit/montre-keep-moving', col);
    check('catégorie : photo de la catégorie en aperçu', html.includes('og:image" content="https://img.example/cat-montres.jpg"'));
  }
  {
    const { res } = await ask(ogPreview, '/categorie/inconnue');
    check('catégorie inconnue : 404', res.status === 404);
  }

  // filet de sécurité : une erreur imprévue (ici l'environnement qui plante) renvoie la page normale
  {
    const saved = (globalThis as any).Deno;
    (globalThis as any).Deno = { env: { get: () => { throw new Error('boom'); } } };
    const a = await ask(ogPreview, '/', GOOGLEBOT);
    const b = await ask(sitemap, '/sitemap.xml', GOOGLEBOT);
    check('erreur imprévue : la page normale est servie (accueil et plan du site), jamais une erreur', a.state.next === 1 && a.res.status === 200 && b.state.next === 1 && b.res.status === 200, { a: a.state.next, b: b.state.next });
    (globalThis as any).Deno = saved;
  }

  // base injoignable : jamais d'erreur pour le robot
  {
    dbDown = true;
    const { res, state } = await ask(ogPreview, '/produit/montre-keep-moving');
    check('base coupée : le robot reçoit l\'application, pas une erreur', state.next === 1 && res.status === 200);
    const home = await ask(ogPreview, '/');
    check('base coupée : accueil pareil', home.state.next === 1);
    dbDown = false;
  }

  // autres robots utiles
  for (const ua of ['Mozilla/5.0 (compatible; bingbot/2.0)', 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', 'facebookexternalhit/1.1', 'WhatsApp/2.23', 'Mozilla/5.0 (compatible; DuckDuckBot/1.1)']) {
    const { state } = await ask(ogPreview, '/produit/montre-keep-moving', ua);
    check(`robot reconnu : ${ua.slice(0, 40)}`, state.next === 0);
  }

  // plan du site
  {
    const { res } = await ask(sitemap, '/sitemap.xml', CHROME);
    const xml = await res.text();
    check('plan du site : type XML', /application\/xml/.test(res.headers.get('content-type') ?? ''));
    check('plan du site : pages fixes + catégories + produits', (xml.match(/<loc>/g) ?? []).length === 4 + 2 + 2, (xml.match(/<loc>/g) ?? []).length);
    check('plan du site : photos des produits', xml.includes('<image:loc>https://img.example/a.jpg</image:loc>') && xml.includes('xmlns:image='));
    check('plan du site : balises retirées, « & » et guillemets échappés dans le XML', !xml.includes('<b>') && xml.includes('<image:title>Eau &quot;fraîche&quot; &amp; boisée</image:title>'), xml.match(/<image:title>[^<]*<\/image:title>/g));
    check('plan du site : jamais d\'adresse d\'administration', !/\/admin/.test(xml));
    check('plan du site : requête sur les articles actifs seulement', calls.some((c) => c.includes('products?is_active=eq.true')));
  }
  {
    dbDown = true;
    const { state } = await ask(sitemap, '/sitemap.xml', CHROME);
    check('plan du site : base coupée → fichier de la mise en ligne (context.next)', state.next === 1);
    dbDown = false;
  }

  // robots.txt
  {
    const { res } = await ask(sitemap, '/robots.txt', CHROME);
    const txt = await res.text();
    check('robots.txt : texte, autorise le site, cache l\'administration et les comptes', /text\/plain/.test(res.headers.get('content-type') ?? '') && /Allow: \//.test(txt) && /Disallow: \/admin\//.test(txt) && /Disallow: \/connexion/.test(txt) && /Disallow: \/commande/.test(txt));
    check('robots.txt : ne cache ni les produits ni les catégories', !/Disallow: \/(produit|categorie)/.test(txt));
    check('robots.txt : adresse du plan du site', /Sitemap: https:\/\/www\.albasseshopping\.com\/sitemap\.xml/.test(txt));
  }

  // le fichier de secours de la mise en ligne a la même liste de pages privées
  {
    const script = readFileSync(new URL('../../scripts/generate-sitemap.js', import.meta.url), 'utf8');
    const block = script.match(/const PRIVATE_PATHS = \[([\s\S]*?)\];/)?.[1] ?? '';
    const fromScript = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    check('fichier de secours : même liste de pages privées que le site', JSON.stringify(fromScript) === JSON.stringify(seo.PRIVATE_PATHS), { fromScript });
  }

  // la page d'accueil fabriquée par la mise en ligne : description et aperçu par défaut
  {
    const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
    check('index.html : description par défaut', /<meta name="description" content="Albasse Shopping, boutique en ligne au Tchad/.test(html));
    check('index.html : aperçu par défaut (og:title, og:image)', /og:title/.test(html) && /og:image" content="https:\/\/www\.albasseshopping\.com\/icon-512\.png"/.test(html));
    check('index.html : PAS de canonical (la page sert toutes les adresses)', !/rel="canonical"/.test(html));
  }

  // la configuration Netlify branche bien les fonctions
  {
    const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
    const paths = [...toml.matchAll(/path = "([^"]+)"\s+function = "([^"]+)"/g)].map((m) => `${m[1]}=>${m[2]}`);
    check('netlify.toml : accueil, produits, catégories, plan du site, robots.txt', ['/=>og-preview', '/produit/*=>og-preview', '/categorie/*=>og-preview', '/sitemap.xml=>sitemap', '/robots.txt=>sitemap'].every((x) => paths.includes(x)), paths);
  }

  console.log(`\n${ok} vérifications réussies${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
})();
