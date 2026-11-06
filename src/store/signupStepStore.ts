// « Étape 2 » de l'inscription (docs/ecran-entree.md) : quand un visiteur crée son compte avec le formulaire court de l'écran d'entrée, on garde sur son
// téléphone qu'il lui reste les 3 questions (sexe, date de naissance, situation) : elles s'affichent juste après, et reviennent s'il ferme le site avant de
// finir. Rien n'est écrit dans la base ici : c'est seulement un petit repère sur le téléphone (expire au bout de 3 jours).
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stepTwoStillValid } from '../lib/entryScreen';

const KEY = 'albasse_signup_step2_since';

interface SignupStepState {
  pending: boolean; // les 3 questions de l'étape 2 sont dues
  hydrated: boolean;
  hydrate: () => Promise<void>;
  arm: () => void; // juste avant de créer le compte
  disarm: () => void; // compte pas créé, ou étape 2 terminée
}

const remember = (value: number | null) => {
  (value === null ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, String(value))).catch(() => {});
};

export const useSignupStepStore = create<SignupStepState>((set, get) => ({
  pending: false,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const since = raw ? Number(raw) : null;
      if (stepTwoStillValid(since, Date.now())) {
        set({ pending: true, hydrated: true });
        return;
      }
      if (raw) remember(null);
    } catch {
      // pas de stockage : l'étape 2 ne reviendra pas après une fermeture, rien d'autre
    }
    set({ hydrated: true });
  },
  arm: () => {
    remember(Date.now());
    set({ pending: true });
  },
  disarm: () => {
    remember(null);
    set({ pending: false });
  },
}));
