// Mêmes formes que les tables Supabase du site (products, categories) : quand on
// branchera Supabase ici, ces types n'ont pas besoin de changer, seule data/index.ts
// sera réécrite pour interroger la base au lieu des tableaux locaux.

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
}

export interface Product {
  id: string;
  categoryId: string;
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
