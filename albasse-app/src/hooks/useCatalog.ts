import { useEffect, useState } from 'react';
import {
  getCategories,
  getFlashSaleProducts,
  getProductBySlug,
  getProducts,
  type Category,
  type Product,
} from '../data';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  return categories;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getProducts().then((data) => {
      setProducts(data);
      setIsLoading(false);
    });
  }, []);

  return { products, isLoading };
}

export function useFlashSaleProducts() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    getFlashSaleProducts().then(setProducts);
  }, []);

  return products;
}

export function useProductBySlug(slug: string | undefined) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    getProductBySlug(slug).then((data) => {
      setProduct(data);
      setIsLoading(false);
    });
  }, [slug]);

  return { product, isLoading };
}
