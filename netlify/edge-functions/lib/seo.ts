// Référencement (SEO) : textes de page, données structurées (JSON-LD), pages vues par Google, plan du site et robots.txt.
// Aucun réseau, aucune base : tout est testable (tests/seo/seo.test.ts). Utilisé par og-preview.ts et sitemap.ts (fonctions Netlify).
// Règles : on n'écrit que des faits connus (nom, catégorie, prix, stock, conditions de retour, frais et délai de livraison). Jamais de note ni d'avis dans les données structurées
// (les avis du site peuvent être de démonstration : Google interdit les faux avis).

export const SITE_URL = 'https://www.albasseshopping.com';
export const SITE_NAME = 'Albasse Shopping';
export const SITE_LOGO = `${SITE_URL}/icon-512.png`;
export const HOME_CITY = "N'Djamena";

// Les robots qui reçoivent la page lisible (titre, description, texte, liens, données structurées) au lieu de l'application :
// moteurs de recherche, aperçus des réseaux sociaux, et (21 novembre 2026, inspection Bunzy : « 0 mot lisible ») les robots des IA
// (ChatGPT, Claude, Perplexity, Gemini passe par Googlebot…) et les outils d'analyse qui se présentent comme « …Bot/1.0 ».
// Jamais un vrai téléphone : « CUBOT X30 » (une marque de téléphone) n'est pas un robot, il faut « bot/ » suivi d'un chiffre.
export const BOT_REGEX = new RegExp(
  [
    'facebookexternalhit', 'Facebot', 'Twitterbot', 'TikTok', 'WhatsApp', 'LinkedInBot', 'Slackbot', 'Discordbot', 'Pinterest', 'TelegramBot',
    'Googlebot', 'Google-InspectionTool', 'Google-CloudVertexBot', 'bingbot', 'BingPreview', 'DuckDuckBot', 'DuckAssistBot', 'YandexBot', 'Applebot',
    'Baiduspider', 'SkypeUriPreview',
    'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User',
    'Amazonbot', 'CCBot', 'cohere-ai', 'Meta-ExternalAgent', 'Meta-ExternalFetcher', 'Bytespider', 'MistralAI-User', 'YouBot',
    '[a-z0-9._-]*(?:bot|crawler|spider)/\\d',
  ].join('|'),
  'i'
);
export function isBot(userAgent: string | null | undefined): boolean {
  return BOT_REGEX.test(userAgent || '');
}

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
  created_at?: string | null;
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
// réception. Les échanges de taille n'ont pas de délai écrit : on n'en dit rien.
// Réponse au message Search Console du 1er novembre 2026 (Fiches de marchand : « returnMethod » et « returnFees » manquants, non critiques) :
// - returnMethod : le patron a répondu (15 novembre 2026) que le client renvoie l'article PAR COLIS OU LIVREUR et/ou en le DÉPOSANT À LA BOUTIQUE (« Les deux ») ;
// - returnFees : par défaut les frais de retour sont à la charge du client (échange de taille : « Les frais de retour sont à la charge du client ») ;
// - itemDefectReturnFees : article incorrect ou défectueux : « Les frais de retour sont à notre charge » = retour gratuit, SEULEMENT pour ce cas (jamais « retour gratuit » en général).
// Le montant des frais de retour n'est pas connu : on ne l'invente pas (pas de returnShippingFeesAmount).
export const RETURN_WINDOW_DAYS = 3;
export function returnPolicyJsonLd(): Record<string, unknown> {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'TD',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: RETURN_WINDOW_DAYS,
    returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
    returnFees: 'https://schema.org/ReturnShippingFees',
    itemDefectReturnFees: 'https://schema.org/FreeReturn',
    merchantReturnLink: `${SITE_URL}/conditions-de-retour`,
  };
}

// Livraison (Admin › Livraison (Villes)) : gratuite à N'Djamena, 2 500 FCFA dans toutes les autres villes ; délai donné par le patron : 1 à 2 jours à
// N'Djamena, 1 à 3 jours ailleurs. Une seule description pour tout le Tchad : frais de 0 à 2 500 FCFA, délai de 1 à 3 jours (le plus long des deux).
// Google veut un délai total : on le compte tout en « transit » (préparation 0 jour), sans inventer de répartition. À mettre à jour ici si les frais ou
// les délais changent.
export const SHIPPING_MAX_FEE = 2500;
export const DELIVERY_DAYS = { min: 1, max: 3 };
export function shippingDetailsJsonLd(): Record<string, unknown> {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', minValue: 0, maxValue: SHIPPING_MAX_FEE, currency: 'XAF' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'TD' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: DELIVERY_DAYS.min, maxValue: DELIVERY_DAYS.max, unitCode: 'DAY' },
    },
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
      shippingDetails: shippingDetailsJsonLd(),
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

export function productPage(p: SeoProduct, category?: SeoCategory | null, canonicalSlug?: string | null): string {
  const inStock = Number(p.stock ?? 0) > 0;
  const images = (p.images ?? []).filter((i) => typeof i === 'string' && i.startsWith('https://')).slice(0, 5);
  const crumbs = [{ name: 'Accueil', url: `${SITE_URL}/` }];
  if (category?.slug) crumbs.push({ name: category.name, url: categoryUrl(category.slug) });
  // une copie identique (même nom, même prix) annonce la page « principale » comme adresse canonique : Google garde une seule page au lieu de les mélanger
  const canonicalUrl = productUrl(canonicalSlug || p.slug);
  crumbs.push({ name: p.name, url: canonicalUrl });
  return renderPage({
    title: productTitle(p.name, p.price),
    description: productDescription(p, category?.name),
    canonical: canonicalUrl,
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

// --- copies identiques ------------------------------------------------------------------------------------------------------------------
// Le patron a parfois ajouté deux fois la même annonce (même nom, même prix, MÊME DESCRIPTION, adresses « …-2 », « …-3 »). Google les prend pour des doublons et choisit seul laquelle garder,
// souvent pas celle qu'on lui dit. On lui dit donc nous-mêmes laquelle : la plus ancienne qui est EN STOCK (sinon la plus ancienne). Rien n'est supprimé : toutes les pages restent
// ouvertes pour les clients, seule l'adresse « canonique » est commune.
// Deux articles de même nom et de même prix mais de DESCRIPTION différente (autres photos, autre texte : autre modèle) ne sont PAS des copies : chacun garde sa page et son adresse.
// (15 novembre 2026 : vérifié sur la vraie boutique : sur 38 groupes « même nom et même prix », aucune paire n'avait les mêmes photos et 8 seulement avaient la même description ;
// ce sont ces 8 que Google signalait comme doublons. La première version, trop large, regroupait aussi des modèles différents.)
export interface CopyRow {
  slug: string;
  name?: string | null;
  price?: number | string | null;
  description?: string | null;
  stock?: number | null;
  created_at?: string | null;
}

export const copyKey = (name: unknown, price: unknown, description?: unknown): string =>
  `${cleanText(name).toLowerCase()}|${Math.round(Number(price) || 0)}|${cleanText(description).toLowerCase()}`;

const createdMs = (row: CopyRow): number => {
  const t = row.created_at ? Date.parse(row.created_at) : NaN;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

// L'adresse canonique d'un groupe de copies (toutes de même nom et de même prix) : la plus ancienne en stock, sinon la plus ancienne ; en cas d'égalité, l'adresse la plus courte.
export function pickCanonicalSlug(copies: readonly CopyRow[], fallback: string): string {
  const rows = copies.filter((c) => c.slug);
  if (rows.length === 0) return fallback;
  const inStock = rows.filter((c) => Number(c.stock ?? 0) > 0);
  const pool = inStock.length > 0 ? inStock : rows;
  return [...pool].sort((a, b) => createdMs(a) - createdMs(b) || a.slug.length - b.slug.length || a.slug.localeCompare(b.slug))[0].slug;
}

// Les copies d'un article parmi une liste (même nom et même prix, sans tenir compte des majuscules ni des espaces en double)
export function copiesOf(product: CopyRow, all: readonly CopyRow[]): CopyRow[] {
  const key = copyKey(product.name, product.price, product.description);
  return all.filter((c) => copyKey(c.name, c.price, c.description) === key);
}

// --- anciennes adresses de catégories renommées ----------------------------------------------------------------------------------------
// Le patron a renommé deux catégories : « Maison & Mobilier » → « Maison & Bureau » et « Bébé et Maternité » → « Produits pour bébés ». Google (et les anciens liens, publicités, QR codes)
// connaissent encore les anciennes adresses : elles renvoient maintenant vers la nouvelle (301, « déplacée définitivement ») au lieu d'une page introuvable.
export const OLD_CATEGORY_SLUGS: Record<string, string> = { 'maison-mobilier': 'maison-bureau', 'bebe-et-maternite': 'produits-pour-bebes' };
export function oldCategoryRedirect(pathname: string): string | null {
  const m = /^\/categorie\/([^/]+)\/?$/.exec(pathname);
  const target = m ? OLD_CATEGORY_SLUGS[decodeURIComponent(m[1])] : undefined;
  return target ? `${SITE_URL}/categorie/${target}` : null;
}

// --- pages d'information (contact, conditions de retour, confidentialité) -----------------------------------------------------------------
// Avant : Google recevait pour ces adresses la même coquille vide que pour toutes les autres pages (même titre, aucune adresse canonique) et les prenait pour des doublons.
// Textes : seulement ce que disent les vraies pages du site (voir ReturnPolicyScreen, PrivacyPolicyScreen, ContactScreen).
export const CONTACT_EMAIL = 'contact@albasseshopping.com';

export interface InfoPageDef {
  path: string;
  title: string;
  description: string;
  h1: string;
  paragraphs: string[];
}

export const INFO_PAGE_DEFS: InfoPageDef[] = [
  {
    path: '/contact',
    title: `Contact | ${SITE_NAME}`,
    description: `Contactez ${SITE_NAME} : e-mail ${CONTACT_EMAIL}. Nos services de livraison sont ouverts de 8h30 à 16h.`,
    h1: `Contacter ${SITE_NAME}`,
    paragraphs: [`E-mail : ${CONTACT_EMAIL}`, 'Nos services de livraison sont ouverts de 8h30 à 16h.', `Livraison à ${HOME_CITY} et dans les autres villes du Tchad.`],
  },
  {
    path: '/conditions-de-retour',
    title: `Conditions de retour | ${SITE_NAME}`,
    description: `Article incorrect ou défectueux : contactez-nous dans les 72 heures, les frais de retour sont à notre charge. Erreur de taille : échange possible. ${SITE_NAME}.`,
    h1: 'Conditions de retour',
    paragraphs: [
      'Article incorrect ou défectueux : contactez notre service client dans les 72 heures suivant la réception, en joignant une photo ou une vidéo de l’article reçu. Après vérification et confirmation de l’erreur, nous vous communiquons la procédure de retour. Les frais de retour sont à notre charge.',
      'Erreur de taille : si l’article correspond à votre commande mais que la taille ne convient pas, nous procédons à un échange. Les frais de retour sont à la charge du client. L’article doit être non porté, non lavé, avec les étiquettes d’origine.',
      'Dans tous les cas, conservez l’article et son emballage d’origine jusqu’à la confirmation du retour.',
    ],
  },
  {
    path: '/conditions-generales',
    title: `Conditions générales | ${SITE_NAME}`,
    description: `Conditions générales de ${SITE_NAME} : commande valable 48 heures, livraison à N'Djamena et dans les autres villes du Tchad, paiement, retours et points de fidélité.`,
    h1: 'Conditions générales',
    paragraphs: [
      'Dernière mise à jour : novembre 2026.',
      'Ces conditions expliquent : 1. qui nous sommes, 2. votre compte, 3. commander (une commande non confirmée reste valable 48 heures), 4. la livraison (services de livraison ouverts de 8h30 à 16h), 5. le paiement (à la livraison à N’Djamena, à l’avance par Moov Money ou Airtel Money dans les autres villes), 6. les retours et échanges (72 heures pour un article incorrect ou défectueux), 7. la fidélité et les offres, 8. vos données, 9. le bon usage du site.',
      `Contact : ${CONTACT_EMAIL}`,
    ],
  },
  {
    path: '/confidentialite',
    title: `Politique de confidentialité | ${SITE_NAME}`,
    description: `Les données que ${SITE_NAME} collecte, comment elles sont utilisées et partagées, la sécurité, les notifications et vos droits.`,
    h1: 'Politique de confidentialité',
    paragraphs: [
      'Dernière mise à jour : novembre 2026.',
      'Cette politique explique : 1. les données que nous collectons, 2. l’utilisation des données, 3. le partage des données, 4. les notifications, 5. les cookies et la mesure publicitaire (le pixel TikTok n’est utilisé qu’avec votre accord), 6. la sécurité, 7. vos droits, 8. comment nous contacter.',
      `Contact : ${CONTACT_EMAIL}`,
    ],
  },
];

/** Les pages d'information servies à Google (« /contact », « /contact/ » : la même page). */
export function infoPageDef(pathname: string): InfoPageDef | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  return INFO_PAGE_DEFS.find((d) => d.path === path) ?? null;
}

export function infoPage(def: InfoPageDef): string {
  return renderPage({
    title: def.title,
    description: def.description,
    canonical: `${SITE_URL}${def.path}`,
    image: SITE_LOGO,
    type: 'website',
    jsonLd: [breadcrumbJsonLd([{ name: 'Accueil', url: `${SITE_URL}/` }, { name: def.h1, url: `${SITE_URL}${def.path}` }])],
    body: `<main>
<h1>${escapeHtml(def.h1)}</h1>
${def.paragraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join('\n')}
<p><a href="${SITE_URL}/">Accueil ${SITE_NAME}</a></p>
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

export const STATIC_PAGES = ['/', '/contact', '/conditions-generales', '/conditions-de-retour', '/confidentialite'];

// Les copies identiques (même nom, même prix, même description) : seule l'adresse canonique reste dans le plan du site
export function withoutCopies<T extends SeoProduct>(products: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const p of products) {
    const k = copyKey(p.name, p.price, p.description);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const keep = new Set<string>();
  for (const list of groups.values()) keep.add(pickCanonicalSlug(list, list[0].slug));
  return products.filter((p) => keep.has(p.slug));
}

export function buildSitemapXml(categories: SeoCategory[], products: SeoProduct[]): string {
  const url = (loc: string, extra = '') => `  <url>\n    <loc>${escapeXml(loc)}</loc>${extra}\n  </url>`;
  const lines = [
    ...STATIC_PAGES.map((p) => url(`${SITE_URL}${p === '/' ? '/' : p}`)),
    ...categories.filter((c) => c.slug).map((c) => url(categoryUrl(c.slug))),
    ...withoutCopies(products)
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
