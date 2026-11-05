import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CATEGORIES as FALLBACK_CATEGORIES } from '../constants/categories';
import { sortCategories } from '../lib/categoryOrder';
import { mainCategories as mainOf, rootIdOf as rootIdIn } from '../lib/subCategories';
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

  // Sous-catégories (lib/subCategories) : `categories` garde TOUTES les catégories (pour retrouver n'importe quel article) ;
  // `mainCategories` = les principales seulement (accueil, boutons) ; `rootIdOf` = la catégorie principale d'un article.
  const mainCategories = useMemo(() => mainOf(categories), [categories]);
  const rootIdOf = useCallback((id: string | null | undefined) => rootIdIn(categories, id), [categories]);

  return { categories, mainCategories, rootIdOf, isLoading, error, refresh };
}
