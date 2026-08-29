import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const GRACE_PERIOD_MS = 15 * 60 * 1000; // laisser le temps de finaliser
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // ignorer les paniers trop vieux

export interface AbandonedCartProduct {
  productId: string;
  name: string;
  quantity: number;
}

export interface AbandonedCart {
  userId: string;
  name: string;
  phone: string | null;
  products: AbandonedCartProduct[];
  lastActivityAt: string;
}

export function useAbandonedCarts() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const [cartRes, ordersRes, profilesRes, productsRes] = await Promise.all([
      supabase.from('cart_events').select('user_id,product_id,created_at').not('user_id', 'is', null),
      supabase.from('orders').select('user_id,created_at'),
      supabase.from('profiles').select('id,full_name,phone'),
      supabase.from('products').select('id,name'),
    ]);

    const cartEvents = (cartRes.data as { user_id: string; product_id: string; created_at: string }[]) ?? [];
    const orders = (ordersRes.data as { user_id: string; created_at: string }[]) ?? [];
    const profiles = (profilesRes.data as { id: string; full_name: string | null; phone: string | null }[]) ?? [];
    const products = (productsRes.data as { id: string; name: string }[]) ?? [];

    const productName: Record<string, string> = {};
    products.forEach((p) => (productName[p.id] = p.name));
    const profileById: Record<string, { full_name: string | null; phone: string | null }> = {};
    profiles.forEach((p) => (profileById[p.id] = p));

    const latestOrderByUser: Record<string, string> = {};
    orders.forEach((o) => {
      if (!latestOrderByUser[o.user_id] || o.created_at > latestOrderByUser[o.user_id]) {
        latestOrderByUser[o.user_id] = o.created_at;
      }
    });

    const byUser: Record<string, typeof cartEvents> = {};
    cartEvents.forEach((e) => {
      if (!byUser[e.user_id]) byUser[e.user_id] = [];
      byUser[e.user_id].push(e);
    });

    const now = Date.now();
    const result: AbandonedCart[] = [];

    Object.entries(byUser).forEach(([userId, events]) => {
      const lastActivityAt = events.reduce((max, e) => (e.created_at > max ? e.created_at : max), events[0].created_at);
      const lastActivityMs = new Date(lastActivityAt).getTime();

      const idleFor = now - lastActivityMs;
      if (idleFor < GRACE_PERIOD_MS || idleFor > STALE_AFTER_MS) return;

      const lastOrder = latestOrderByUser[userId];
      if (lastOrder && lastOrder >= lastActivityAt) return; // a deja commande depuis

      const quantities: Record<string, number> = {};
      events.forEach((e) => {
        quantities[e.product_id] = (quantities[e.product_id] ?? 0) + 1;
      });

      const productsList: AbandonedCartProduct[] = Object.entries(quantities).map(([productId, quantity]) => ({
        productId,
        name: productName[productId] ?? 'Produit supprimé',
        quantity,
      }));

      const profile = profileById[userId];
      result.push({
        userId,
        name: profile?.full_name ?? 'Client',
        phone: profile?.phone ?? null,
        products: productsList,
        lastActivityAt,
      });
    });

    result.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));

    setCarts(result);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { carts, isLoading, refresh };
}
