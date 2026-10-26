// Sert aux robots (Google, Bing, réseaux sociaux : TikTok, Facebook, WhatsApp…) une page lisible avec titre, description, photo,
// données structurées (prix, disponibilité) et liens, pour l'accueil, les pages produit et les pages catégorie.
// Les vrais visiteurs reçoivent l'application normale (context.next() laisse passer vers le SPA React).
// Une adresse produit ou catégorie qui n'existe pas (ou plus) répond 404 aux robots : elle sort de l'index de Google.
// Les textes et les données viennent de ./lib/seo.ts (testé : tests/seo/seo.test.ts).
import type { Context } from 'https://edge.netlify.com';
import { categoryPage, homePage, notFoundPage, productPage, type SeoCategory, type SeoProduct } from './lib/seo.ts';

const BOT_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|TikTok|WhatsApp|LinkedInBot|Slackbot|Discordbot|Pinterest|TelegramBot|Googlebot|Google-InspectionTool|bingbot|BingPreview|DuckDuckBot|YandexBot|Applebot|Baiduspider|SkypeUriPreview/i;

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600', vary: 'User-Agent' };

async function rows<T>(supabaseUrl: string, key: string, query: string): Promise<T[]> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers: { apikey: key } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as T[]) : [];
}

// la page normale (pour les vrais visiteurs) : on précise seulement que le contenu dépend du navigateur (consigne de Google)
async function passThrough(context: Context): Promise<Response> {
  const res = await context.next();
  try {
    res.headers.append('vary', 'User-Agent');
  } catch {
    // en-têtes non modifiables : la page part telle quelle
  }
  return res;
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_REGEX.test(userAgent)) return passThrough(context);

  const supabaseUrl = Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseKey = Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) return context.next();

  const url = new URL(request.url);
  const notFound = () => new Response(notFoundPage(url.toString().split('?')[0]), { status: 404, headers: HTML_HEADERS });

  try {
    // accueil
    if (url.pathname === '/' || url.pathname === '') {
      const [categories, products] = await Promise.all([
        rows<SeoCategory>(supabaseUrl, supabaseKey, 'categories?select=name,slug,image_url&order=sort_order.asc'),
        rows<SeoProduct>(supabaseUrl, supabaseKey, 'products?is_active=eq.true&select=name,slug,price,images,stock&order=created_at.desc&limit=24'),
      ]);
      if (categories.length === 0 && products.length === 0) return context.next();
      return new Response(homePage(categories, products), { headers: HTML_HEADERS });
    }

    // fiche produit
    if (url.pathname.startsWith('/produit/')) {
      const slug = decodeURIComponent(url.pathname.replace('/produit/', '').replace(/\/$/, ''));
      const found = await rows<SeoProduct & { categories?: SeoCategory | null }>(
        supabaseUrl,
        supabaseKey,
        `products?slug=eq.${encodeURIComponent(slug)}&select=name,slug,description,price,images,stock,categories(name,slug)&limit=1`
      );
      const product = found[0];
      if (!product) return notFound();
      return new Response(productPage(product, product.categories ?? null), { headers: HTML_HEADERS });
    }

    // catégorie
    if (url.pathname.startsWith('/categorie/')) {
      const slug = decodeURIComponent(url.pathname.replace('/categorie/', '').replace(/\/$/, ''));
      const found = await rows<SeoCategory & { id: string }>(
        supabaseUrl,
        supabaseKey,
        `categories?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,image_url&limit=1`
      );
      const category = found[0];
      if (!category) return notFound();
      const products = await rows<SeoProduct>(
        supabaseUrl,
        supabaseKey,
        `products?category_id=eq.${encodeURIComponent(category.id)}&is_active=eq.true&select=name,slug,price,images,stock&order=created_at.desc&limit=200`
      );
      return new Response(categoryPage(category, products), { headers: HTML_HEADERS });
    }
  } catch {
    // base injoignable : le robot reçoit la page normale plutôt qu'une erreur
    return context.next();
  }

  return context.next();
};
