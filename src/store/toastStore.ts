import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  title: string | null;
  message: string;
  type: ToastType;
  visible: boolean;
  show: (message: string, options?: { title?: string; type?: ToastType }) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  title: null,
  message: '',
  type: 'info',
  visible: false,
  show: (message, options) =>
    set({ message, title: options?.title ?? null, type: options?.type ?? 'info', visible: true }),
  hide: () => set({ visible: false }),
}));
