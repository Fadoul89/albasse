// Le parrainage du client connecté : son code, ses amis et ses gains. Tant que le script SQL add-friend-invites.sql n'est pas lancé, `state` vaut « missing »
// et l'application n'affiche rien du parrainage (docs/parrainage.md).
import { useCallback, useEffect, useState } from 'react';
import { fetchMyProgress } from '../lib/friendInvitesApi';
import type { InviteProgress } from '../lib/friendInvites';

export type InvitesState = 'loading' | 'ready' | 'missing' | 'error';

export function useMyInvites(enabled: boolean = true) {
  const [state, setState] = useState<InvitesState>('loading');
  const [progress, setProgress] = useState<InviteProgress | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const res = await fetchMyProgress();
    if (res.ok) {
      setProgress(res.data);
      setState('ready');
    } else {
      setState(res.reason);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, progress, refresh };
}
