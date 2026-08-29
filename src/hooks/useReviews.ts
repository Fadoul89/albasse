import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MOCK_REVIEWS } from '../constants/mockData';
import type { Review } from '../types';

export function useReviews(productId: string) {
  const initial = isSupabaseConfigured
    ? []
    : MOCK_REVIEWS.filter((r) => r.product_id === productId);
  const [reviews, setReviews] = useState<Review[]>(initial);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = () => {
    if (!isSupabaseConfigured || !productId) return;
    setIsLoading(true);
    supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        setReviews(error ? [] : ((data as Review[]) ?? []));
        setIsLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, [productId]);

  return { reviews, isLoading, refresh };
}
