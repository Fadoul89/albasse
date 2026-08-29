import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface FavoritesState {
  ids: Set<string>;
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  toggle: (userId: string, productId: string) => Promise<void>;
  reset: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  loaded: false,

  load: async (userId) => {
    const { data } = await supabase.from('favorites').select('product_id').eq('user_id', userId);
    set({ ids: new Set((data ?? []).map((r: { product_id: string }) => r.product_id)), loaded: true });
  },

  toggle: async (userId, productId) => {
    const { ids } = get();
    const isFav = ids.has(productId);
    const next = new Set(ids);
    if (isFav) next.delete(productId);
    else next.add(productId);
    set({ ids: next });

    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
    } else {
      await supabase.from('favorites').insert({ user_id: userId, product_id: productId });
    }
  },

  reset: () => set({ ids: new Set(), loaded: false }),
}));
