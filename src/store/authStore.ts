import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { attachUserToSession } from '../lib/analytics';
import { useToastStore } from './toastStore';
import { useFavoritesStore } from './favoritesStore';
import type { Profile } from '../types';

export interface SignUpDetails {
  fullName: string;
  phone: string;
  profession: string;
  region?: string;
  country?: string;
  address?: string;
  acceptsNotifications: boolean;
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

// Supabase declenche automatiquement un evenement SIGNED_IN (capte par
// onAuthStateChange dans init()) en meme temps que l'appel explicite fait
// depuis signIn()/signUp(). Sans garde-fou, ces deux appels a refreshProfile()
// partent en parallele et peuvent se doubler : si l'un des deux echoue (reseau
// lent, quota Supabase depasse...), il peut ecraser le resultat correct de
// l'autre et remettre isAuthenticated a false juste apres une connexion reussie.
// On fait donc partager le meme appel en cours a tous les appelants.
let refreshInFlight: Promise<void> | null = null;

async function recordLogin(userId: string) {
  const { data: current } = await supabase
    .from('profiles')
    .select('login_count')
    .eq('id', userId)
    .single();

  await supabase
    .from('profiles')
    .update({
      last_login_at: new Date().toISOString(),
      login_count: (current?.login_count ?? 0) + 1,
    })
    .eq('id', userId);

  attachUserToSession(userId);
}

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
          .select('*')
          .eq('id', userData.user.id)
          .single();
        if (profileError) throw profileError;

        if ((profile as Profile | null)?.banned) {
          await supabase.auth.signOut();
          set({ profile: null, isAuthenticated: false });
          return;
        }

        set({ profile: profile as Profile | null, isAuthenticated: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        useToastStore.getState().show(`Erreur technique : ${message}`, {
          title: 'Connexion impossible',
          type: 'error',
        });
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

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('banned')
        .eq('id', data.user.id)
        .single();
      if (profileError) {
        return { error: `Erreur technique (profil) : ${profileError.message}` };
      }

      if (profileRow?.banned) {
        await supabase.auth.signOut();
        return {
          error: "Votre compte a été suspendu. Veuillez contacter notre service client pour plus d'informations.",
        };
      }

      await recordLogin(data.user.id);
      await get().refreshProfile();

      if (!get().isAuthenticated) {
        return { error: 'La connexion a échoué de façon inattendue. Merci de réessayer.' };
      }

      return { error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: `Erreur technique inattendue : ${message}` };
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
        // Le projet Supabase exige une confirmation par e-mail : aucune session
        // n'est ouverte tant que le lien de confirmation n'a pas ete clique, donc
        // impossible d'ecrire le profil (RLS) ou de connecter l'utilisateur ici.
        return { error: null, needsEmailConfirmation: true };
      }

      if (data.user) {
        await supabase
          .from('profiles')
          .update({
            full_name: details.fullName,
            phone: details.phone,
            profession: details.profession,
            region: details.region || null,
            country: details.country || null,
            address: details.address || null,
            notify_new_products: details.acceptsNotifications,
            notify_promotions: details.acceptsNotifications,
            notify_flash_sale: details.acceptsNotifications,
          })
          .eq('id', data.user.id);
        await recordLogin(data.user.id);
      }

      await get().refreshProfile();

      if (!get().isAuthenticated) {
        return { error: "L'inscription a échoué de façon inattendue. Merci de réessayer." };
      }

      return { error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: `Erreur technique inattendue : ${message}` };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, isAuthenticated: false });
    useFavoritesStore.getState().reset();
  },
}));
