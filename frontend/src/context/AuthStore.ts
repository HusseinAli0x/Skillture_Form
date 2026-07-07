import { create } from 'zustand';
import type { Admin } from '../api/types';

interface AuthState {
  token: string | null;
  admin: Admin | null;
  isAuthenticated: boolean;
  login: (token: string, admin: Admin) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const storedToken = localStorage.getItem('token');
  const storedAdmin = localStorage.getItem('admin');

  let parsedAdmin = null;
  try {
    if (storedAdmin && storedAdmin !== 'undefined') {
      parsedAdmin = JSON.parse(storedAdmin);
    }
  } catch (e) {
    localStorage.removeItem('admin');
  }

  return {
    token: storedToken,
    admin: parsedAdmin,
    isAuthenticated: !!storedToken,
    login: (token: string, admin: Admin) => {
      localStorage.setItem('token', token);
      localStorage.setItem('admin', JSON.stringify(admin));
      set({ token, admin, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      set({ token: null, admin: null, isAuthenticated: false });
    },
  };
});
