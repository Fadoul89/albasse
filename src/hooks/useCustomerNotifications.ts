import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { ProductNotification, Product } from '../types';

export interface CustomerNotificationItem extends ProductNotification {
  productSlug: string | null;
  isUnread: boolean;
}

const LIMIT = 30;

export function useCustomerNotifications() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [items, setItems] = useState<CustomerNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const enabled = Boolean(profile) && profile!.notify_new_products;

  const refresh = async () => {
    if (!isSupabaseConfigured || !enabled) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    const [notifRes, productsRes] = await Promise.all([
      supabase.from('product_notifications').select('*').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('products').select('id,slug'),
    ]);

    const notifications = (notifRes.data as ProductNotification[]) ?? [];
    const products = (productsRes.data as Pick<Product, 'id' | 'slug'>[]) ?? [];
    const slugById: Record<string, string> = {};
    products.forEach((p) => (slugById[p.id] = p.slug));

    const lastSeen = profile?.notifications_last_seen_at;
    const enriched: CustomerNotificationItem[] = notifications.map((n) => ({
      ...n,
      productSlug: slugById[n.product_id] ?? null,
      isUnread: !lastSeen || n.created_at > lastSeen,
    }));

    setItems(enriched);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [enabled, profile?.notifications_last_seen_at]);

  const markAllSeen = async () => {
    if (!profile) return;
    const now = new Date().toISOString();
    await supabase.from('profiles').update({ notifications_last_seen_at: now }).eq('id', profile.id);
    await refreshProfile();
  };

  const unreadCount = items.filter((n) => n.isUnread).length;

  return { items, unreadCount, isLoading, refresh, markAllSeen };
}
