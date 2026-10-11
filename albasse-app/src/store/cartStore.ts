import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '../data';

export interface CartItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  color: string | null;
  size: string | null;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, options: { color: string | null; size: string | null; quantity?: number }) => void;
  removeItem: (productId: string, color: string | null, size: string | null) => void;
  updateQuantity: (productId: string, color: string | null, size: string | null, quantity: number) => void;
  clear: () => void;
}

const sameLine = (a: CartItem, productId: string, color: string | null, size: string | null) =>
  a.productId === productId && a.color === color && a.size === size;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (product, { color, size, quantity = 1 }) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, product.id, color, size));
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, product.id, color, size) ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                image: product.images[0] ?? '',
                price: product.price,
                color,
                size,
                quantity,
              },
            ],
          };
        }),

      removeItem: (productId, color, size) =>
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, productId, color, size)),
        })),

      updateQuantity: (productId, color, size, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => !sameLine(i, productId, color, size))
              : state.items.map((i) => (sameLine(i, productId, color, size) ? { ...i, quantity } : i)),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'albasse-cart',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const useCartTotalItems = () => useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
export const useCartTotalPrice = () => useCartStore((s) => s.items.reduce((n, i) => n + i.quantity * i.price, 0));
