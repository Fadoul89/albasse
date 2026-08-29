import type { Category, CategorySlug } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'cat-costumes', slug: 'costumes', name: 'Costumes', image_url: null, affiliate_commission_rate: null },
  { id: 'cat-chemises', slug: 'chemises', name: 'Chemises', image_url: null, affiliate_commission_rate: null },
  { id: 'cat-cravates', slug: 'cravates', name: 'Cravates', image_url: null, affiliate_commission_rate: null },
  { id: 'cat-chaussures', slug: 'chaussures', name: 'Chaussures', image_url: null, affiliate_commission_rate: null },
  { id: 'cat-montres', slug: 'montres', name: 'Montres', image_url: null, affiliate_commission_rate: null },
  { id: 'cat-accessoires', slug: 'accessoires', name: 'Accessoires', image_url: null, affiliate_commission_rate: null },
];

export const categoryBySlug = (slug: CategorySlug) =>
  CATEGORIES.find((c) => c.slug === slug)!;
