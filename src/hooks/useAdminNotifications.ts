import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AdminNotification } from '../types';

const POLL_INTERVAL_MS = 30 * 1000;
const LIMIT = 50;

export function useAdminNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(enabled && isSupabaseConfigured);

  const refresh = async () => {
    if (!enabled || !isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    setNotifications((data as AdminNotification[]) ?? []);
    setIsLoading(false);
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('admin_notifications').update({ is_read: true }).in('id', unreadIds);
  };

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead };
}
