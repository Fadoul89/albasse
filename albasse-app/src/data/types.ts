// Memes formes que les tables Supabase du site (products, categories) —
// alimentees par de vraies requetes dans data/index.ts.

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
}

export interface Product {
  id: string;
  categoryId: string | null;
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  isFlashSale: boolean;
  flashSaleEndsAt: string | null;
  rating: number;
  reviewCount: number;
  createdAt: string;
}
