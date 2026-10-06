import { create } from 'zustand';

export type Locale = 'en' | 'ar';

const STORAGE_KEY = 'skillture-locale';

function readStored(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'ar' ? 'ar' : 'en';
  } catch {
    // Private browsing / storage disabled — default to English rather than throw.
    return 'en';
  }
}

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

/**
 * Language for the public site only (Navbar + HomePage) — the Admin
 * Dashboard, Form Builder and Quiz tools stay English-only by design, so
 * nothing outside those two consumes this store.
 */
export const useLanguageStore = create<LanguageState>((set, get) => ({
  locale: readStored(),
  setLocale: locale => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore — the in-memory value below still takes effect this session.
    }
    set({ locale });
  },
  toggleLocale: () => get().setLocale(get().locale === 'en' ? 'ar' : 'en'),
}));
