import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { CustomerMessage } from '../types';

export function useCustomerMessages() {
  const profile = useAuthStore((s) => s.profile);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured || !profile) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from('customer_messages')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setMessages((data as CustomerMessage[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [profile?.id]);

  const markAllRead = async () => {
    if (!profile) return;
    const unreadIds = messages.filter((m) => !m.is_read).map((m) => m.id);
    if (unreadIds.length === 0) return;
    await supabase.from('customer_messages').update({ is_read: true }).in('id', unreadIds);
    setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return { messages, unreadCount, isLoading, refresh, markAllRead };
}
