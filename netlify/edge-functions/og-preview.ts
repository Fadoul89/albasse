// Sert aux robots (Google, Bing, réseaux sociaux : TikTok, Facebook, WhatsApp…) une page lisible avec titre, description, photo,
// données structurées (prix, disponibilité) et liens, pour l'accueil, les pages produit et les pages catégorie.
// Les vrais visiteurs reçoivent l'application normale (context.next() laisse passer vers le SPA React).
// Une adresse produit ou catégorie qui n'existe pas (ou plus) répond 404 aux robots : elle sort de l'index de Google.
// Les textes et les données viennent de ./lib/seo.ts (testé : tests/seo/seo.test.ts).
import type { Context } from 'https://edge.netlify.com';
import { categoryPage, copiesOf, homePage, infoPage, infoPageDef, notFoundPage, oldCategoryRedirect, pickCanonicalSlug, productPage, type CopyRow, type SeoCategory, type SeoProduct } from './lib/seo.ts';

const BOT_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|TikTok|WhatsApp|LinkedInBot|Slackbot|Discordbot|Pinterest|TelegramBot|Googlebot|Google-InspectionTool|bingbot|BingPreview|DuckDuckBot|YandexBot|Applebot|Baiduspider|SkypeUriPreview/i;

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600', vary: 'User-Agent' };

async function rows<T>(supabaseUrl: string, key: string, query: string): Promise<T[]> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers: { apikey: key } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as T[]) : [];
}

async function serve(request: Request, context: Context): Promise<Response> {
  // site « page unique » (docs/site-cafe-separe.md) : rien d'Albasse Shopping n'est servi aux robots, la page fabriquée est déjà neutre
  if (Deno.env.get('EXPO_PUBLIC_SINGLE_PAGE')) return context.next();
  // ancienne adresse d'une catégorie renommée : redirection définitive (301) pour tout le monde, robots et visiteurs
  const moved = oldCategoryRedirect(new URL(request.url).pathname);
  if (moved) return new Response(null, { status: 301, headers: { location: moved, 'cache-control': 'public, max-age=3600' } });
  const userAgent = request.headers.get('user-agent') || '';
  // visiteur normal : exactement la page d'avant, rien n'est modifié
  if (!BOT_REGEX.test(userAgent)) return context.next();

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

    // pages d'information (contact, conditions de retour, confidentialité) : leur propre titre et leur propre adresse canonique
    const info = infoPageDef(url.pathname);
    if (info) return new Response(infoPage(info), { headers: HTML_HEADERS });

    // fiche produit
    if (url.pathname.startsWith('/produit/')) {
      const slug = decodeURIComponent(url.pathname.replace('/produit/', '').replace(/\/$/, ''));
      const found = await rows<SeoProduct & { categories?: SeoCategory | null }>(
        supabaseUrl,
        supabaseKey,
        `products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=name,slug,description,price,images,stock,categories(name,slug)&limit=1`
      );
      const product = found[0];
      // un article caché (désactivé) n'existe plus pour Google : 404, comme une adresse inconnue (avant : la page complète restait lisible, « en stock » compris)
      if (!product) return notFound();
      // copies identiques (même nom, même prix, même description) : on cherche par PRIX (le nom peut avoir une espace en fin ou une majuscule de plus : « AL MADJAZ » / « AL MADJAZ »), puis copiesOf compare nom et description : on dit à Google laquelle est la page principale (voir lib/seo.ts)
      const sameName = await rows<CopyRow>(supabaseUrl, supabaseKey, `products?is_active=eq.true&price=eq.${encodeURIComponent(String(product.price))}&select=slug,name,price,description,stock,created_at&limit=500`);
      const mine: CopyRow = { slug: product.slug, name: product.name, price: product.price, description: product.description };
      const canonicalSlug = pickCanonicalSlug(copiesOf(mine, sameName), product.slug);
      return new Response(productPage(product, product.categories ?? null, canonicalSlug), { headers: HTML_HEADERS });
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
      // sous-catégories : une catégorie principale montre aussi les articles de ses sous-catégories (avant le script add-subcategories.sql : la
      // colonne parent_id n'existe pas, la lecture répond une erreur, `rows` rend une liste vide et rien ne change)
      const children = await rows<{ id: string }>(supabaseUrl, supabaseKey, `categories?parent_id=eq.${encodeURIComponent(category.id)}&select=id`);
      const familyIds = [category.id, ...children.map((c) => c.id)].map(encodeURIComponent).join(',');
      const products = await rows<SeoProduct>(
        supabaseUrl,
        supabaseKey,
        `products?category_id=in.(${familyIds})&is_active=eq.true&select=name,slug,price,images,stock&order=created_at.desc&limit=200`
      );
      return new Response(categoryPage(category, products), { headers: HTML_HEADERS });
    }
  } catch {
    // base injoignable : le robot reçoit la page normale plutôt qu'une erreur
    return context.next();
  }

  return context.next();
}

// filet de sécurité : au moindre problème imprévu, tout le monde reçoit la page normale du site (jamais une erreur)
export default async (request: Request, context: Context): Promise<Response> => {
  try {
    return await serve(request, context);
  } catch {
    return context.next();
  }
};
