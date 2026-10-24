import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CATEGORIES as FALLBACK_CATEGORIES } from '../constants/categories';
import { sortCategories } from '../lib/categoryOrder';
import type { Category } from '../types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(
    isSupabaseConfigured ? [] : FALLBACK_CATEGORIES
  );
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    supabase
      .from('categories')
      .select('*')
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setCategories(FALLBACK_CATEGORIES);
        } else {
          setCategories(sortCategories((data as Category[]) ?? []));
        }
        setIsLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  return { categories, isLoading, error, refresh };
}
