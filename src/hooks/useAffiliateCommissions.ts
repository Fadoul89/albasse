import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AdminCommissionRow {
  id: string;
  affiliate_id: string;
  affiliate_name: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'validated' | 'cancelled';
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export function useAffiliateCommissions() {
  const [commissions, setCommissions] = useState<AdminCommissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from('affiliate_commissions')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    const rows: AdminCommissionRow[] = ((data as any[]) ?? []).map((c) => ({
      id: c.id,
      affiliate_id: c.affiliate_id,
      affiliate_name: c.profiles?.full_name ?? c.profiles?.email ?? '—',
      order_id: c.order_id,
      amount: Number(c.amount),
      status: c.status,
      paid: c.paid,
      paid_at: c.paid_at,
      created_at: c.created_at,
    }));

    setCommissions(rows);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  // vrai seulement si la base a bien enregistré le paiement (avant : affiché « payée » même en cas de refus)
  const markPaid = async (id: string): Promise<boolean> => {
    const paidAt = new Date().toISOString();
    const { error } = await supabase.from('affiliate_commissions').update({ paid: true, paid_at: paidAt }).eq('id', id);
    if (error) return false;
    setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, paid: true, paid_at: paidAt } : c)));
    return true;
  };

  return { commissions, isLoading, refresh, markPaid };
}
