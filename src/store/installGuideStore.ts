import { create } from 'zustand';

// Fenetre « Installer Albasse sur iPhone » (tutoriel video) : ouverte par le bandeau
// et la fenetre d'installation, affichee une seule fois a la racine de l'application.
interface InstallGuideState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useInstallGuideStore = create<InstallGuideState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
