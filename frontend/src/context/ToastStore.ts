import { create } from 'zustand';
import { newId } from '../lib/id';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastMessage[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

/** Errors stay longer than confirmations: they are the ones people need to read. */
export const toastDuration = (type: ToastType): number => (type === 'error' ? 6000 : 3500);

/** At most this many toasts are stacked; the oldest is dropped first. */
const MAX_TOASTS = 4;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    // A collision here removed the wrong toast, since the timer below matches on id.
    const id = newId();
    set((state) => ({ toasts: [...state.toasts, { id, type, message }].slice(-MAX_TOASTS) }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toastDuration(type));
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
