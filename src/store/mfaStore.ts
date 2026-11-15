// État de la double vérification de l'administrateur connecté (voir src/lib/adminMfa.ts).
import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mfaErrorText, needsCode, verifiedTotp, isCompleteCode } from '../lib/adminMfa';

interface MfaState {
  /** 'code' : l'admin doit taper son code avant d'utiliser le site ; 'none' : rien à demander. */
  status: 'none' | 'code';
  check: (isAdmin: boolean) => Promise<void>;
  verify: (code: string) => Promise<{ ok: boolean; error?: string }>;
  /** Après « Code correct » (affiché un instant par l'écran du code) : on laisse entrer. */
  done: () => void;
}

export const useMfaStore = create<MfaState>((set) => ({
  status: 'none',

  check: async (isAdmin) => {
    if (!isAdmin || !isSupabaseConfigured) {
      set({ status: 'none' });
      return;
    }
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      set({ status: needsCode(isAdmin, data) ? 'code' : 'none' });
    } catch {
      // en cas de panne on ne bloque pas l'écran : la base refuse de toute façon l'accès admin sans le code
      set({ status: 'none' });
    }
  },

  verify: async (code) => {
    if (!isCompleteCode(code)) return { ok: false, error: 'Tapez les 6 chiffres du code.' };
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = verifiedTotp(factors?.all as never);
      if (!factor) {
        set({ status: 'none' });
        return { ok: true };
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) return { ok: false, error: mfaErrorText(error.message) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mfaErrorText(e instanceof Error ? e.message : String(e)) };
    }
  },

  done: () => set({ status: 'none' }),
}));
