import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { WheelPrize } from '../types';

export function useWheel() {
  const profile = useAuthStore((s) => s.profile);
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [nextMilestone, setNextMilestone] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured || !profile) return;
    setIsLoading(true);

    const [prizesRes, ordersRes, spinsRes] = await Promise.all([
      supabase.from('wheel_prizes').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'delivered'),
      supabase.from('wheel_spins').select('milestone').eq('user_id', profile.id).gt('milestone', 0),
    ]);

    setPrizes((prizesRes.data as WheelPrize[]) ?? []);
    const delivered = ordersRes.count ?? 0;
    setDeliveredCount(delivered);
    const usedMilestones = ((spinsRes.data as { milestone: number }[]) ?? []).map((s) => s.milestone);
    const next = usedMilestones.length > 0 ? Math.max(...usedMilestones) + 1 : 1;
    setNextMilestone(next);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [profile?.id]);

  const canSpinMilestone = deliveredCount >= nextMilestone * 5;
  const ordersUntilNextSpin = canSpinMilestone ? 0 : nextMilestone * 5 - deliveredCount;

  const spin = async (): Promise<{ label: string; icon: string; isLose: boolean } | { error: string }> => {
    const { data, error } = await supabase.rpc('spin_wheel');
    if (error) return { error: error.message };
    const row = (data as any[])?.[0];
    if (!row) return { error: 'Réponse invalide.' };
    await refresh();
    return { label: row.out_label, icon: row.out_icon, isLose: row.out_is_lose };
  };

  return { prizes, deliveredCount, canSpinMilestone, ordersUntilNextSpin, isLoading, spin, refresh };
}
