import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguageStore } from '../context/LanguageStore';
import { translations } from '../lib/translations';

/** Toggle between English and Arabic. Public site only — see LanguageStore. */
const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const locale = useLanguageStore(s => s.locale);
  const toggleLocale = useLanguageStore(s => s.toggleLocale);
  const label = translations[locale].nav.language;

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer',
        'border border-border text-text transition-all duration-200',
        'hover:border-primary-border hover:bg-primary-soft hover:text-primary',
        className,
      ].join(' ')}
    >
      <Languages className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};

export default LanguageSwitcher;
