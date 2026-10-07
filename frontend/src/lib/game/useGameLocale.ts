import { useEffect } from 'react';
import { useLanguageStore } from '../../context/LanguageStore';
import { gameStrings } from './strings';

/**
 * Language, direction and copy for a game screen. Sets the document direction
 * (the game screens are full-page, outside the public site's shell) and
 * restores it on leave, so the English-only admin is never left right-to-left.
 */
export function useGameLocale() {
  const locale = useLanguageStore(s => s.locale);
  const isRTL = locale === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    };
  }, [isRTL, locale]);

  return { locale, isRTL, dir: isRTL ? ('rtl' as const) : ('ltr' as const), G: gameStrings[locale] };
}
