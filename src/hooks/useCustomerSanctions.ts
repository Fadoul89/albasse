import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CustomerSanction } from '../types';

export interface SanctionWithAdmin extends CustomerSanction {
  admin_name: string | null;
}

export function useCustomerSanctions(userId: string) {
  const [sanctions, setSanctions] = useState<SanctionWithAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const refresh = async () => {
    if (!isSupabaseConfigured || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const { data } = await supabase
      .from('customer_sanctions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const rows = (data as CustomerSanction[]) ?? [];
    const adminIds = [...new Set(rows.map((r) => r.admin_id).filter(Boolean))] as string[];

    let adminNames: Record<string, string> = {};
    if (adminIds.length > 0) {
      const { data: admins } = await supabase.from('profiles').select('id,full_name,email').in('id', adminIds);
      adminNames = Object.fromEntries((admins ?? []).map((a) => [a.id, a.full_name ?? a.email]));
    }

    setSanctions(rows.map((r) => ({ ...r, admin_name: r.admin_id ? adminNames[r.admin_id] ?? null : null })));
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  return { sanctions, isLoading, refresh };
}
