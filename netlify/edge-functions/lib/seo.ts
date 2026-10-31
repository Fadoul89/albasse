// Référencement (SEO) : textes de page, données structurées (JSON-LD), pages vues par Google, plan du site et robots.txt.
// Aucun réseau, aucune base : tout est testable (tests/seo/seo.test.ts). Utilisé par og-preview.ts et sitemap.ts (fonctions Netlify).
// Règles : on n'écrit que des faits connus (nom, catégorie, prix, stock, conditions de retour). Jamais de note ni d'avis dans les données structurées
// (les avis du site peuvent être de démonstration : Google interdit les faux avis).

export const SITE_URL = 'https://www.albasseshopping.com';
export const SITE_NAME = 'Albasse Shopping';
export const SITE_LOGO = `${SITE_URL}/icon-512.png`;
export const HOME_CITY = "N'Djamena";

export interface SeoCategory {
  id?: string;
  name: string;
  slug: string;
  image_url?: string | null;
}

export interface SeoProduct {
  name: string;
  slug: string;
  description?: string | null;
  price: number | string;
  images?: string[] | null;
  stock?: number | null;
}

// --- petits outils de texte ---------------------------------------------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function escapeXml(value: unknown): string {
  return escapeHtml(value).replace(/&#39;/g, '&apos;');
}

// texte sur une seule ligne, sans balises, sans espaces doubles
export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// coupe au dernier mot entier avant « max » caractères et ajoute « … »
export function cut(text: string, max: number): string {
  const t = cleanText(text);
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const lastSpace = head.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head;
  return `${base.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

export function fcfa(value: number | string): string {
  const n = Number(value);
  return `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString('fr-FR').replace(/[\u00a0\u202f]/g, ' ')} FCFA`;
}

const productUrl = (slug: string) => `${SITE_URL}/produit/${encodeURIComponent(slug)}`;
const categoryUrl = (slug: string) => `${SITE_URL}/categorie/${encodeURIComponent(slug)}`;

const firstImage = (images?: string[] | null): string | null => {
  const url = (images ?? []).find((i) => typeof i === 'string' && i.startsWith('https://'));
  return url ?? null;
};

// --- titres et descriptions ---------------------------------------------------------------------------------------------------------

export function homeTitle(): string {
  return `${SITE_NAME} – Boutique en ligne au Tchad`;
}

export function homeDescription(categories: SeoCategory[]): string {
  const names = categories.map((c) => cleanText(c.name)).filter(Boolean).slice(0, 5);
  const list = names.length > 0 ? `${names.join(', ')} et plus encore. ` : '';
  return cut(
    `Boutique en ligne au Tchad : ${list}Prix en FCFA, livraison à ${HOME_CITY} et dans les autres villes, paiement à la livraison à ${HOME_CITY}, Airtel Money et Moov Money.`,
    160
  );
}

// « Montre KEEP MOVING – 11 000 FCFA | Albasse Shopping » (60 caractères au plus quand c'est possible)
export function productTitle(name: string, price: number | string): string {
  const suffix = ` – ${fcfa(price)} | ${SITE_NAME}`;
  const room = Math.max(20, 62 - suffix.length);
  return `${cut(name, room)}${suffix}`;
}

export function productDescription(p: SeoProduct, categoryName?: string | null): string {
  const base = cleanText(p.description);
  const price = fcfa(p.price);
  // une description courte mais utile (« 110 Degrees Emper pour homme ») est gardée ; la phrase de secours ne sert que sans description
  if (base.length >= 10) return cut(`${cut(base, 105).replace(/[.\s]+$/, '')}. Prix : ${price}. Livraison au Tchad.`, 160);
  const cat = categoryName ? ` (${cleanText(categoryName)})` : '';
  return cut(`Achetez ${cleanText(p.name)}${cat} à ${price} sur ${SITE_NAME}. Livraison au Tchad, paiement à la livraison à ${HOME_CITY}.`, 160);
}

export function categoryTitle(name: string): string {
  const suffix = ` – achat en ligne au Tchad | ${SITE_NAME}`;
  return `${cut(name, Math.max(15, 62 - suffix.length))}${suffix}`;
}

export function categoryDescription(name: string, count: number): string {
  const n = count > 0 ? `${count} article${count > 1 ? 's' : ''}, ` : '';
  return cut(`Achetez ${cleanText(name)} en ligne au Tchad : ${n}prix en FCFA, livraison à ${HOME_CITY} et dans les autres villes. ${SITE_NAME}.`, 160);
}

// --- données structurées (JSON-LD) --------------------------------------------------------------------------------------------------

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: SITE_LOGO,
    image: SITE_LOGO,
    areaServed: { '@type': 'Country', name: 'Tchad' },
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'fr',
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: SITE_LOGO },
  };
}

// Retours : seulement ce que dit la page « Conditions de retour » : un article incorrect ou défectueux se signale dans les 72 heures (3 jours) après la
// réception. Les échanges de taille n'ont pas de délai écrit : on n'en dit rien. Pas de « retour gratuit » (les frais dépendent du cas).
export const RETURN_WINDOW_DAYS = 3;
export function returnPolicyJsonLd(): Record<string, unknown> {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'TD',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: RETURN_WINDOW_DAYS,
    merchantReturnLink: `${SITE_URL}/conditions-de-retour`,
  };
}

export function productJsonLd(p: SeoProduct, category?: SeoCategory | null): Record<string, unknown> {
  const images = (p.images ?? []).filter((i) => typeof i === 'string' && i.startsWith('https://')).slice(0, 5);
  const inStock = Number(p.stock ?? 0) > 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: cleanText(p.name),
    description: productDescription(p, category?.name),
    sku: p.slug,
    ...(images.length > 0 ? { image: images } : {}),
    ...(category?.name ? { category: cleanText(category.name) } : {}),
    offers: {
      '@type': 'Offer',
      url: productUrl(p.slug),
      priceCurrency: 'XAF',
      price: String(Math.round(Number(p.price) || 0)),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
      hasMerchantReturnPolicy: returnPolicyJsonLd(),
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: cleanText(it.name), item: it.url })),
  };
}

export function categoryJsonLd(c: SeoCategory, products: SeoProduct[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cleanText(c.name),
    url: categoryUrl(c.slug),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p.slug), name: cleanText(p.name) })),
    },
  };
}

// dans une balise <script> : « < » est écrit en \u003c pour que le texte ne puisse jamais fermer la balise
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// --- page vue par Google ------------------------------------------------------------------------------------------------------------

export interface PageOptions {
  title: string;
  description: string;
  canonical: string;
  image: string;
  type: 'website' | 'product';
  jsonLd?: unknown[];
  extraMeta?: string;
  noindex?: boolean;
  body: string;
}

export function renderPage(o: PageOptions): string {
  const robots = o.noindex ? '<meta name="robots" content="noindex" />\n' : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}" />
${robots}<link rel="canonical" href="${escapeHtml(o.canonical)}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:type" content="${o.type}" />
<meta property="og:title" content="${escapeHtml(o.title)}" />
<meta property="og:description" content="${escapeHtml(o.description)}" />
<meta property="og:image" content="${escapeHtml(o.image)}" />
<meta property="og:url" content="${escapeHtml(o.canonical)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(o.title)}" />
<meta name="twitter:description" content="${escapeHtml(o.description)}" />
<meta name="twitter:image" content="${escapeHtml(o.image)}" />
${o.extraMeta ?? ''}${(o.jsonLd ?? []).map(jsonLdScript).join('\n')}
</head>
<body>
${o.body}
</body>
</html>`;
}

export function homePage(categories: SeoCategory[], products: SeoProduct[]): string {
  const description = homeDescription(categories);
  const cats = categories.map((c) => `<li><a href="${categoryUrl(c.slug)}">${escapeHtml(cleanText(c.name))}</a></li>`).join('\n');
  const prods = products
    .map((p) => `<li><a href="${productUrl(p.slug)}">${escapeHtml(cleanText(p.name))}</a> – ${escapeHtml(fcfa(p.price))}</li>`)
    .join('\n');
  return renderPage({
    title: homeTitle(),
    description,
    canonical: `${SITE_URL}/`,
    image: SITE_LOGO,
    type: 'website',
    jsonLd: [organizationJsonLd(), websiteJsonLd()],
    body: `<main>
<h1>${SITE_NAME} : boutique en ligne au Tchad</h1>
<p>${escapeHtml(description)}</p>
${cats ? `<h2>Nos catégories</h2>\n<ul>\n${cats}\n</ul>` : ''}
${prods ? `<h2>Nouveautés</h2>\n<ul>\n${prods}\n</ul>` : ''}
</main>`,
  });
}

export function categoryPage(category: SeoCategory, products: SeoProduct[]): string {
  const list = products
    .map((p) => `<li><a href="${productUrl(p.slug)}">${escapeHtml(cleanText(p.name))}</a> – ${escapeHtml(fcfa(p.price))}</li>`)
    .join('\n');
  const image = category.image_url && category.image_url.startsWith('https://') ? category.image_url : firstImage(products[0]?.images) ?? SITE_LOGO;
  return renderPage({
    title: categoryTitle(category.name),
    description: categoryDescription(category.name, products.length),
    canonical: categoryUrl(category.slug),
    image,
    type: 'website',
    jsonLd: [
      categoryJsonLd(category, products),
      breadcrumbJsonLd([
        { name: 'Accueil', url: `${SITE_URL}/` },
        { name: category.name, url: categoryUrl(category.slug) },
      ]),
    ],
    body: `<main>
<h1>${escapeHtml(cleanText(category.name))}</h1>
<p>${escapeHtml(categoryDescription(category.name, products.length))}</p>
${list ? `<ul>\n${list}\n</ul>` : ''}
<p><a href="${SITE_URL}/">Accueil ${SITE_NAME}</a></p>
</main>`,
  });
}

export function productPage(p: SeoProduct, category?: SeoCategory | null): string {
  const inStock = Number(p.stock ?? 0) > 0;
  const images = (p.images ?? []).filter((i) => typeof i === 'string' && i.startsWith('https://')).slice(0, 5);
  const crumbs = [{ name: 'Accueil', url: `${SITE_URL}/` }];
  if (category?.slug) crumbs.push({ name: category.name, url: categoryUrl(category.slug) });
  crumbs.push({ name: p.name, url: productUrl(p.slug) });
  return renderPage({
    title: productTitle(p.name, p.price),
    description: productDescription(p, category?.name),
    canonical: productUrl(p.slug),
    image: images[0] ?? SITE_LOGO,
    type: 'product',
    extraMeta: `<meta property="product:price:amount" content="${escapeHtml(String(Math.round(Number(p.price) || 0)))}" />
<meta property="product:price:currency" content="XAF" />
<meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}" />
`,
    jsonLd: [productJsonLd(p, category), breadcrumbJsonLd(crumbs)],
    body: `<main>
<h1>${escapeHtml(cleanText(p.name))}</h1>
${cleanText(p.description) ? `<p>${escapeHtml(cleanText(p.description))}</p>` : ''}
<p>Prix : ${escapeHtml(fcfa(p.price))} – ${inStock ? 'En stock' : 'Épuisé'}</p>
${images.map((src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(cleanText(p.name))}" />`).join('\n')}
<p>${category?.slug ? `<a href="${categoryUrl(category.slug)}">${escapeHtml(cleanText(category.name))}</a> · ` : ''}<a href="${SITE_URL}/">Accueil ${SITE_NAME}</a></p>
</main>`,
  });
}

// page « introuvable » vue par Google (code 404 : l'adresse sort de l'index)
export function notFoundPage(url: string): string {
  return renderPage({
    title: `Page introuvable | ${SITE_NAME}`,
    description: `Cette page n'existe plus sur ${SITE_NAME}.`,
    canonical: url,
    image: SITE_LOGO,
    type: 'website',
    noindex: true,
    body: `<main><h1>Page introuvable</h1><p><a href="${SITE_URL}/">Retour à l'accueil ${SITE_NAME}</a></p></main>`,
  });
}

// --- plan du site et robots.txt -----------------------------------------------------------------------------------------------------

export const STATIC_PAGES = ['/', '/contact', '/conditions-de-retour', '/confidentialite'];

export function buildSitemapXml(categories: SeoCategory[], products: SeoProduct[]): string {
  const url = (loc: string, extra = '') => `  <url>\n    <loc>${escapeXml(loc)}</loc>${extra}\n  </url>`;
  const lines = [
    ...STATIC_PAGES.map((p) => url(`${SITE_URL}${p === '/' ? '/' : p}`)),
    ...categories.filter((c) => c.slug).map((c) => url(categoryUrl(c.slug))),
    ...products
      .filter((p) => p.slug)
      .map((p) => {
        const img = firstImage(p.images);
        const extra = img ? `\n    <image:image>\n      <image:loc>${escapeXml(img)}</image:loc>\n      <image:title>${escapeXml(cut(cleanText(p.name), 100))}</image:title>\n    </image:image>` : '';
        return url(productUrl(p.slug), extra);
      }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${lines.join('\n')}
</urlset>
`;
}

// pages privées ou sans intérêt pour Google (compte, commande, administration…)
export const PRIVATE_PATHS = [
  '/admin/',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/commande',
  '/facture/',
  '/mes-commandes',
  '/panier',
  '/compte',
  '/mes-messages',
  '/mes-favoris',
  '/notifications',
  '/espace-affilie',
  '/desinscription',
  '/roue-de-la-chance',
];

export function buildRobotsTxt(): string {
  return `User-agent: *
Allow: /
${PRIVATE_PATHS.map((p) => `Disallow: ${p}`).join('\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
