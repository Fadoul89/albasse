import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';

export interface SignUpDetails {
  fullName: string;
  phone: string;
}

interface AuthState {
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    details: SignUpDetails
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user_already_exists')) {
    return 'Un compte existe déjà avec cet e-mail.';
  }
  if (m.includes('banned') || m.includes('suspended')) {
    return "Votre compte a été suspendu. Veuillez contacter notre service client pour plus d'informations.";
  }
  if (m.includes('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }
  if (m.includes('email not confirmed')) {
    return 'Veuillez confirmer votre e-mail avant de vous connecter.';
  }
  return message;
}

let refreshInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await get().refreshProfile();
    }
    set({ isLoading: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await get().refreshProfile();
      } else {
        set({ profile: null, isAuthenticated: false });
      }
    });
  },

  refreshProfile: async () => {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          set({ profile: null, isAuthenticated: false });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone, is_admin, banned, loyalty_points, created_at')
          .eq('id', userData.user.id)
          .single();
        if (profileError) throw profileError;

        if ((profile as Profile | null)?.banned) {
          await supabase.auth.signOut();
          set({ profile: null, isAuthenticated: false });
          return;
        }

        set({ profile: profile as Profile | null, isAuthenticated: true });
      } catch {
        set({ profile: null, isAuthenticated: false });
      }
    })();

    try {
      await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: translateAuthError(error.message) };
      if (!data.user) return { error: null };

      await get().refreshProfile();
      if (!get().isAuthenticated) {
        return { error: "Votre compte a été suspendu ou la connexion a échoué. Merci de réessayer." };
      }
      return { error: null };
    } catch (e) {
      return { error: `Erreur technique inattendue : ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  signUp: async (email, password, details) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: translateAuthError(error.message) };
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { error: 'Un compte existe déjà avec cet e-mail.' };
      }

      if (!data.session) {
        return { error: null, needsEmailConfirmation: true };
      }

      if (data.user) {
        await supabase
          .from('profiles')
          .update({ full_name: details.fullName, phone: details.phone })
          .eq('id', data.user.id);
      }

      await get().refreshProfile();
      if (!get().isAuthenticated) {
        return { error: "L'inscription a échoué de façon inattendue. Merci de réessayer." };
      }
      return { error: null };
    } catch (e) {
      return { error: `Erreur technique inattendue : ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, isAuthenticated: false });
  },
}));
