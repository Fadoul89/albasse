import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CustomerSummary, Profile, Order, VisitorSession } from '../types';

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const [profilesRes, ordersRes, sessionsRes, viewsRes, cartRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false }),
      supabase.from('orders').select('id,user_id,total,status,created_at'),
      supabase.from('visitor_sessions').select('id,user_id,duration_seconds,last_seen_at,referrer_source'),
      supabase.from('product_views').select('user_id'),
      supabase.from('cart_events').select('user_id'),
    ]);

    const profiles = (profilesRes.data as Profile[]) ?? [];
    const orders = (ordersRes.data as Pick<Order, 'id' | 'user_id' | 'total' | 'status' | 'created_at'>[]) ?? [];
    const sessions =
      (sessionsRes.data as Pick<VisitorSession, 'id' | 'user_id' | 'duration_seconds' | 'last_seen_at' | 'referrer_source'>[]) ?? [];
    const views = (viewsRes.data as { user_id: string | null }[]) ?? [];
    const cartAdds = (cartRes.data as { user_id: string | null }[]) ?? [];

    const summaries: CustomerSummary[] = profiles.map((profile) => {
      const userOrders = orders.filter((o) => o.user_id === profile.id);
      const userSessions = sessions.filter((s) => s.user_id === profile.id);
      const userViews = views.filter((v) => v.user_id === profile.id);
      const userCartAdds = cartAdds.filter((c) => c.user_id === profile.id);

      const sourceCounts: Record<string, number> = {};
      userSessions.forEach((s) => {
        if (s.referrer_source) sourceCounts[s.referrer_source] = (sourceCounts[s.referrer_source] ?? 0) + 1;
      });
      const topReferrerSource =
        Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const lastOrder = userOrders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const lastSession = userSessions.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];

      return {
        profile,
        orderCount: userOrders.length,
        totalSpent: userOrders.reduce((sum, o) => sum + Number(o.total), 0),
        lastOrderAt: lastOrder?.created_at ?? null,
        completedOrders: userOrders.filter((o) => o.status === 'delivered').length,
        cancelledOrders: userOrders.filter((o) => o.status === 'cancelled').length,
        sessionCount: userSessions.length,
        totalDurationSeconds: userSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
        lastVisitAt: lastSession?.last_seen_at ?? null,
        productViewCount: userViews.length,
        cartAddCount: userCartAdds.length,
        topReferrerSource,
      };
    });

    setCustomers(summaries);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { customers, isLoading, refresh };
}
