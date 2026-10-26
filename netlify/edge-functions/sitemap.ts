// Plan du site (/sitemap.xml) et robots.txt toujours à jour : refaits à chaque demande à partir de la base
// (un nouvel article apparaît tout de suite, un article désactivé disparaît). Si la base ne répond pas, le fichier
// fabriqué à la mise en ligne (scripts/generate-sitemap.js) est servi à la place (context.next()).
import type { Context } from 'https://edge.netlify.com';
import { buildRobotsTxt, buildSitemapXml, type SeoCategory, type SeoProduct } from './lib/seo.ts';

async function rows<T>(supabaseUrl: string, key: string, query: string): Promise<T[] | null> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers: { apikey: key } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as T[]) : null;
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  if (url.pathname === '/robots.txt') {
    return new Response(buildRobotsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }

  const supabaseUrl = Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseKey = Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) return context.next();

  try {
    const [categories, products] = await Promise.all([
      rows<SeoCategory>(supabaseUrl, supabaseKey, 'categories?select=name,slug&order=sort_order.asc'),
      rows<SeoProduct>(supabaseUrl, supabaseKey, 'products?is_active=eq.true&select=name,slug,price,images&order=created_at.desc&limit=5000'),
    ]);
    // jamais de plan vide : si la base ne répond pas, on garde le fichier de la mise en ligne
    if (!categories || !products || products.length === 0) return context.next();
    return new Response(buildSitemapXml(categories, products), {
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
  } catch {
    return context.next();
  }
};
