// Administrateur seulement : à chaque nouvelle commande (notification « new_order » créée par la base, voir
// add-admin-notifications.sql), le son d'alerte du patron et un message, sur toutes les pages tant que le site est ouvert.
// Relu toutes les 15 s. Le téléphone peut bloquer le son tant que l'admin n'a rien touché sur la page : le message reste.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

const ORDER_SOUND = '/nouvelle-commande.mp3';
const CHECK_EVERY_MS = 15000;

export function AdminOrderAlert() {
  const isAdmin = useAuthStore((s) => !!s.profile?.is_admin);
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    if (!isAdmin || Platform.OS !== 'web' || !isSupabaseConfigured || typeof Audio === 'undefined') return;
    let alive = true;
    let since: string | null = null; // date (de la base) de la dernière commande déjà connue
    const audio = new Audio(ORDER_SOUND);
    const latest = () =>
      supabase.from('admin_notifications').select('message,created_at').eq('type', 'new_order').order('created_at', { ascending: false }).limit(20);

    const check = async () => {
      const { data, error } = await latest();
      if (!alive || error || !data) return;
      if (since === null) {
        since = data[0]?.created_at ?? ''; // au démarrage : les commandes d'avant ne sonnent pas
        return;
      }
      const fresh = data.filter((n) => n.created_at > (since as string));
      if (fresh.length === 0) return;
      since = fresh[0].created_at;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      showToast(fresh.length > 1 ? `${fresh.length} nouvelles commandes` : fresh[0].message, { title: '🛒 Nouvelle commande', type: 'success' });
    };

    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAdmin]);

  return null;
}
