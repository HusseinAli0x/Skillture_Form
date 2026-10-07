import { useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query; re-renders when it flips. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Tailwind's `md` breakpoint: where the sidebar stops being a drawer. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');
