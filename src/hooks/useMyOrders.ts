import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order } from '../types';

export function useMyOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = () => {
    if (!isSupabaseConfigured || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase.rpc('auto_flag_stale_orders').then(() => {
      supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setOrders((data as Order[]) ?? []);
          setIsLoading(false);
        });
    });
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  return { orders, isLoading, refresh };
}
