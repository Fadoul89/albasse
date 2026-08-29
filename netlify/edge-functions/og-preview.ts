// Sert des balises Open Graph propres (titre, description, image) aux robots
// de reseaux sociaux (TikTok, Facebook, WhatsApp...) quand ils visitent une
// page produit ou categorie. Les vrais visiteurs recoivent l'application
// normale (context.next() laisse passer vers le SPA React).
import type { Context } from 'https://edge.netlify.com';

const BOT_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|TikTok|WhatsApp|LinkedInBot|Slackbot|Discordbot|Pinterest|TelegramBot|Googlebot|bingbot|SkypeUriPreview/i;

const SITE_NAME = 'Albasse Shopping';

function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function renderHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  extraMeta?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}" />
<link rel="canonical" href="${opts.url}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:type" content="${opts.type}" />
<meta property="og:title" content="${escapeHtml(opts.title)}" />
<meta property="og:description" content="${escapeHtml(opts.description)}" />
<meta property="og:image" content="${opts.image}" />
<meta property="og:url" content="${opts.url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(opts.title)}" />
<meta name="twitter:description" content="${escapeHtml(opts.description)}" />
<meta name="twitter:image" content="${opts.image}" />
${opts.extraMeta ?? ''}
</head>
<body>
<h1>${escapeHtml(opts.title)}</h1>
<p>${escapeHtml(opts.description)}</p>
<img src="${opts.image}" alt="${escapeHtml(opts.title)}" />
</body>
</html>`;
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_REGEX.test(userAgent)) {
    return context.next();
  }

  const supabaseUrl = Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseKey = Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) return context.next();

  const url = new URL(request.url);
  const headers = { apikey: supabaseKey };

  if (url.pathname.startsWith('/produit/')) {
    const slug = url.pathname.replace('/produit/', '').replace(/\/$/, '');
    const res = await fetch(
      `${supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&select=name,description,price,images`,
      { headers }
    );
    const rows = await res.json().catch(() => []);
    const product = Array.isArray(rows) ? rows[0] : null;
    if (!product) return context.next();

    const price = Number(product.price ?? 0).toLocaleString('fr-FR');
    const html = renderHtml({
      title: `${product.name} — ${SITE_NAME}`,
      description: `${product.description ?? ''} — ${price} FCFA`.slice(0, 200),
      image: product.images?.[0] ?? `${url.origin}/favicon.png`,
      url: url.toString(),
      type: 'product',
      extraMeta: `<meta property="product:price:amount" content="${product.price}" />
<meta property="product:price:currency" content="XAF" />`,
    });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname.startsWith('/categorie/')) {
    const slug = url.pathname.replace('/categorie/', '').replace(/\/$/, '');
    const res = await fetch(
      `${supabaseUrl}/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}&select=name,image_url`,
      { headers }
    );
    const rows = await res.json().catch(() => []);
    const category = Array.isArray(rows) ? rows[0] : null;
    if (!category) return context.next();

    const html = renderHtml({
      title: `${category.name} — ${SITE_NAME}`,
      description: `Découvrez notre collection ${category.name} sur ${SITE_NAME}.`,
      image: category.image_url ?? `${url.origin}/favicon.png`,
      url: url.toString(),
      type: 'website',
    });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  return context.next();
};
