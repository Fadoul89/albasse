// Couche data — point d'entrée unique pour lire catégories/produits.
//
// Aujourd'hui : données locales (CATEGORIES / PRODUCTS).
// Plus tard : remplacer le contenu de ces fonctions par des appels
// `supabase.from('categories'|'products').select(...)`, en gardant les mêmes
// signatures (toutes déjà async) — aucun écran n'a besoin de changer.

import { CATEGORIES } from './categories';
import { PRODUCTS } from './products';
import type { Category, Product } from './types';

export type { Category, Product };

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export async function getProducts(): Promise<Product[]> {
  return PRODUCTS;
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  return PRODUCTS.filter((p) => p.categorySlug === categorySlug);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export async function getFlashSaleProducts(): Promise<Product[]> {
  return PRODUCTS.filter((p) => p.isFlashSale);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return PRODUCTS;
  return PRODUCTS.filter(
    (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  );
}
