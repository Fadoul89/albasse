import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CustomerSummary, Profile, Order, VisitorSession } from '../types';
import { countsAsSale, salesTotal } from '../lib/salesRules';
import { fetchAllPages, parseCustomerActivity } from '../lib/visitStats';

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    // La base ne renvoie que 1 000 lignes par demande : les listes qui peuvent grandir (clients, commandes) sont lues page par page.
    // Les visites, articles vus et ajouts de chaque client sont comptés DANS la base (add-visit-stats.sql) : exacts quelle que soit la taille.
    // Tant que ce script n'est pas lancé, l'ancienne lecture ligne par ligne sert de secours.
    const [profilesRows, ordersRows, activityRes] = await Promise.all([
      fetchAllPages<Profile>((from, to) =>
        supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false }).order('id').range(from, to)
      ),
      fetchAllPages<Pick<Order, 'id' | 'user_id' | 'total' | 'status' | 'is_flagged_fake' | 'created_at'>>((from, to) =>
        supabase.from('orders').select('id,user_id,total,status,is_flagged_fake,created_at').order('created_at', { ascending: false }).order('id').range(from, to)
      ),
      supabase.rpc('admin_customer_activity'),
    ]);
    const activity = activityRes.error ? null : parseCustomerActivity(activityRes.data);

    let sessions: Pick<VisitorSession, 'id' | 'user_id' | 'duration_seconds' | 'last_seen_at' | 'referrer_source'>[] = [];
    let views: { user_id: string | null }[] = [];
    let cartAdds: { user_id: string | null }[] = [];
    if (!activity) {
      const [sessionsRes, viewsRes, cartRes] = await Promise.all([
        supabase.from('visitor_sessions').select('id,user_id,duration_seconds,last_seen_at,referrer_source'),
        supabase.from('product_views').select('user_id'),
        supabase.from('cart_events').select('user_id'),
      ]);
      sessions = (sessionsRes.data as typeof sessions) ?? [];
      views = (viewsRes.data as typeof views) ?? [];
      cartAdds = (cartRes.data as typeof cartAdds) ?? [];
    }

    const profiles = profilesRows;
    const orders = ordersRows;

    const summaries: CustomerSummary[] = profiles.map((profile) => {
      // les fausses commandes ne comptent pas ; le montant total ne compte que les commandes livrées
      const userOrders = orders.filter((o) => o.user_id === profile.id && !o.is_flagged_fake);
      const userSessions = activity ? [] : sessions.filter((s) => s.user_id === profile.id);
      const userViews = activity ? [] : views.filter((v) => v.user_id === profile.id);
      const userCartAdds = activity ? [] : cartAdds.filter((c) => c.user_id === profile.id);
      const counted = activity?.get(profile.id);

      const sourceCounts: Record<string, number> = {};
      userSessions.forEach((s) => {
        if (s.referrer_source) sourceCounts[s.referrer_source] = (sourceCounts[s.referrer_source] ?? 0) + 1;
      });
      const topReferrerSource = activity
        ? counted?.topSource ?? null
        : Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const lastOrder = userOrders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const lastSession = userSessions.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];

      return {
        profile,
        orderCount: userOrders.length,
        totalSpent: salesTotal(userOrders),
        lastOrderAt: lastOrder?.created_at ?? null,
        completedOrders: userOrders.filter(countsAsSale).length,
        cancelledOrders: userOrders.filter((o) => o.status === 'cancelled').length,
        sessionCount: activity ? counted?.sessions ?? 0 : userSessions.length,
        totalDurationSeconds: activity ? counted?.durationSeconds ?? 0 : userSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
        lastVisitAt: activity ? counted?.lastSeenAt ?? null : lastSession?.last_seen_at ?? null,
        productViewCount: activity ? counted?.views ?? 0 : userViews.length,
        cartAddCount: activity ? counted?.cartAdds ?? 0 : userCartAdds.length,
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
