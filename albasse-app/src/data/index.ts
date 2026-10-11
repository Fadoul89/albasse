// Couche data — point d'entree unique pour lire categories/produits.
// Branchee sur le meme projet Supabase que le site : les produits, prix et
// stocks viennent directement de la base reelle (table `products`).

import { supabase } from '../lib/supabase';
import type { Category, Product } from './types';

export type { Category, Product };

// Emoji affiche pour chaque categorie (la table `categories` n'a pas de
// colonne icone). Complete cette liste si de nouvelles categories sont
// ajoutees cote admin.
const CATEGORY_ICONS: Record<string, string> = {
  'agriculture-jardinage': '🌱',
  'bebe-et-maternite': '🍼',
  chaussures: '👞',
  cosmetique: '💄',
  electrique: '🔌',
  lunettes: '🕶️',
  'maison-mobilier': '🛋️',
  montre: '⌚',
  parfum: '🧴',
  'produits-alimentaires': '🍽️',
  'sacs-et-bagages': '👜',
  'velos-pour-enfants-jouets-et-jeux': '🧸',
  vetements: '👔',
  'vetements-pour-femmes': '👗',
  'vitalite-energie-homme': '💪',
  voiture: '🚗',
};

function mapCategory(row: any): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: CATEGORY_ICONS[row.slug] ?? '✨',
  };
}

function mapProduct(row: any, categoryById: Map<string, Category>): Product {
  const category = row.category_id ? categoryById.get(row.category_id) : undefined;
  return {
    id: row.id,
    categoryId: row.category_id,
    categorySlug: category?.slug ?? '',
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    price: Number(row.price),
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    images: row.images ?? [],
    colors: row.colors ?? [],
    sizes: row.sizes ?? [],
    stock: row.stock ?? 0,
    isFlashSale: Boolean(row.is_flash_sale),
    flashSaleEndsAt: row.flash_sale_ends_at,
    rating: row.rating !== null ? Number(row.rating) : 0,
    reviewCount: row.review_count ?? 0,
    createdAt: row.created_at,
  };
}

let cache: { categories: Category[]; products: Product[] } | null = null;
let inFlight: Promise<{ categories: Category[]; products: Product[] }> | null = null;

async function loadCatalog(): Promise<{ categories: Category[]; products: Product[] }> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [{ data: categoryRows, error: catError }, { data: productRows, error: prodError }] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }),
    ]);

    if (catError) console.error('Erreur chargement categories:', catError.message);
    if (prodError) console.error('Erreur chargement produits:', prodError.message);

    const categories = (categoryRows ?? []).map(mapCategory);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const products = (productRows ?? []).map((row) => mapProduct(row, categoryById));

    cache = { categories, products };
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function invalidateCatalogCache() {
  cache = null;
}

export async function getCategories(): Promise<Category[]> {
  return (await loadCatalog()).categories;
}

export async function getProducts(): Promise<Product[]> {
  return (await loadCatalog()).products;
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  const { products } = await loadCatalog();
  return products.filter((p) => p.categorySlug === categorySlug);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products } = await loadCatalog();
  return products.find((p) => p.slug === slug) ?? null;
}

export async function getFlashSaleProducts(): Promise<Product[]> {
  const { products } = await loadCatalog();
  return products.filter((p) => p.isFlashSale);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const { products } = await loadCatalog();
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  );
}
