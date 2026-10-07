import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguageStore } from '../context/LanguageStore';
import { useTranslations } from '../lib/useSiteContent';

/** Toggle between English and Arabic. Public site only — see LanguageStore. */
const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const locale = useLanguageStore(s => s.locale);
  const toggleLocale = useLanguageStore(s => s.toggleLocale);
  const label = useTranslations().nav.language;

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
      className={[
        'inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-lg text-sm font-semibold cursor-pointer',
        'border border-border-strong text-text transition-colors duration-200',
        'hover:border-primary hover:text-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      ].join(' ')}
    >
      <Languages className="hidden sm:block w-4 h-4" aria-hidden="true" />
      <span lang={locale === 'en' ? 'ar' : 'en'}>{label}</span>
    </button>
  );
};

export default LanguageSwitcher;
