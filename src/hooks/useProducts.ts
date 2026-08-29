import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MOCK_PRODUCTS } from '../constants/mockData';
import type { Product } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(isSupabaseConfigured ? [] : MOCK_PRODUCTS);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    const { data, error: err } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setProducts(MOCK_PRODUCTS);
    } else {
      setProducts((data as Product[]) ?? []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { products, isLoading, error, refresh };
}

export function useProduct(productId: string) {
  const { products, isLoading, error } = useProducts();
  const product = products.find((p) => p.id === productId) ?? null;
  return { product, isLoading, error };
}

export function useProductBySlug(slug: string) {
  const { products, isLoading, error } = useProducts();
  const [redirectSlug, setRedirectSlug] = useState<string | null>(null);
  const [checkedHistory, setCheckedHistory] = useState(false);

  const product = products.find((p) => p.slug === slug) ?? null;

  useEffect(() => {
    setRedirectSlug(null);
    setCheckedHistory(false);

    if (!isSupabaseConfigured || isLoading || product) {
      if (!isLoading) setCheckedHistory(true);
      return;
    }

    let cancelled = false;
    supabase
      .from('product_slug_history')
      .select('product_id')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.product_id) {
          const match = products.find((p) => p.id === data.product_id);
          if (match) setRedirectSlug(match.slug);
        }
        setCheckedHistory(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, isLoading, product?.id]);

  return { product, redirectSlug, isLoading: isLoading || !checkedHistory, error };
}
