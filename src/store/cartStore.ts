import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, Product } from '../types';
import { trackCartEvent } from '../lib/browsingTracker';

// Plus de panier : le client commande un article à la fois (avec sa quantité). Ce magasin garde seulement l'article de la
// commande en cours (fiche produit ou Zara → page de commande), pour la reprendre s'il part avant de confirmer.
interface CartState {
  items: CartItem[];
  updatedAt: number | null;
  setOrderItem: (product: Product, quantity: number, color: string | null, size: string | null) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

const makeItemId = (productId: string, color: string | null, size: string | null) =>
  `${productId}__${color ?? 'nc'}__${size ?? 'ns'}`;

// Pour le suivi de Zara : le produit, tel qu'il est dans la commande commencée.
const metaOf = (p: Product) => ({ id: p.id, name: p.name, slug: p.slug, categoryId: p.category_id });

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      updatedAt: null,

      // l'article choisi remplace le précédent : une commande = un article
      setOrderItem: (product, quantity, color, size) => {
        trackCartEvent(metaOf(product), 'add');
        set({ items: [{ id: makeItemId(product.id, color, size), product, quantity, color, size }], updatedAt: Date.now() });
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
      // les anciens paniers (plusieurs articles) sont vidés : on repart d'une commande à un article
      version: 1,
      migrate: () => ({ items: [], updatedAt: null }),
    }
  )
);
