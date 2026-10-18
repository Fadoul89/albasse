import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, Product } from '../types';
import { trackCartEvent } from '../lib/browsingTracker';

interface CartState {
  items: CartItem[];
  updatedAt: number | null;
  addItem: (product: Product, quantity: number, color: string | null, size: string | null) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

const makeItemId = (productId: string, color: string | null, size: string | null) =>
  `${productId}__${color ?? 'nc'}__${size ?? 'ns'}`;

// Pour le suivi de Zara : le produit, tel qu'il est dans le panier.
const metaOf = (p: Product) => ({ id: p.id, name: p.name, slug: p.slug, categoryId: p.category_id });

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      updatedAt: null,

      addItem: (product, quantity, color, size) => {
        trackCartEvent(metaOf(product), 'add');
        const id = makeItemId(product.id, color, size);
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === id ? { ...i, quantity: i.quantity + quantity } : i
              ),
              updatedAt: Date.now(),
            };
          }
          return {
            items: [...state.items, { id, product, quantity, color, size }],
            updatedAt: Date.now(),
          };
        });
      },

      removeItem: (itemId) => {
        const gone = get().items.find((i) => i.id === itemId);
        if (gone) trackCartEvent(metaOf(gone.product), 'remove');
        set((state) => ({ items: state.items.filter((i) => i.id !== itemId), updatedAt: Date.now() }));
      },

      updateQuantity: (itemId, quantity) => {
        const line = get().items.find((i) => i.id === itemId);
        if (line && quantity <= 0) trackCartEvent(metaOf(line.product), 'remove');
        set((state) => ({
          items: state.items
            .map((i) => (i.id === itemId ? { ...i, quantity } : i))
            .filter((i) => i.quantity > 0),
          updatedAt: Date.now(),
        }));
      },

      clear: () => set({ items: [], updatedAt: null }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'albasse-cart',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
