import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import { useLanguageStore } from '../../context/LanguageStore';
import { translations } from '../../lib/translations';
import { siteStrings } from '../../lib/siteStrings';

/**
 * Frame for the public pages other than the landing page: sticky header with a
 * phone menu, language switch, footer, and the RTL/lang handling the landing
 * page does for itself. The admin app stays LTR/English — direction is
 * restored on unmount.
 */
const PublicShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const locale = useLanguageStore(s => s.locale);
  const T = translations[locale];
  const S = siteStrings[locale];
  const isRTL = locale === 'ar';
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    };
  }, [isRTL, locale]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const links = [
    { to: '/', label: T.nav.home },
    { to: '/our-work', label: S.nav.ourWork },
    { to: '/team', label: S.nav.team },
    { to: '/#contact', label: T.nav.contact },
  ];

  const linkClass = (to: string) =>
    `text-sm font-medium whitespace-nowrap py-3 -my-3 transition-colors duration-200 hover:text-primary ${
      pathname === to ? 'text-primary' : 'text-text'
    }`;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-dvh flex flex-col bg-bg text-text font-sans selection:bg-primary/30">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-5 sm:px-8 py-4 bg-bg/88 backdrop-blur-md border-b border-border">
        <Link to="/" className="flex items-center gap-2.5 py-2 -my-2">
          <img src="/logo-icon.png" alt="" className="w-7 h-7 object-contain" />
          <span className="text-lg font-bold tracking-tight text-text">Skillture</span>
        </Link>
        <nav className="flex items-center gap-4 md:gap-7" aria-label="Main">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              aria-current={pathname === l.to ? 'page' : undefined}
              className={`hidden md:inline ${linkClass(l.to)}`}
            >
              {l.label}
            </Link>
          ))}
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={S.nav.menu}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-nav"
            className="md:hidden inline-flex items-center justify-center w-11 h-11 -me-2 rounded-lg text-text hover:text-primary transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>
        {menuOpen && (
          <div
            id="public-mobile-nav"
            className="md:hidden absolute inset-x-0 top-full bg-bg border-b border-border shadow-lg px-5 py-2"
          >
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center min-h-12 text-base font-medium border-b border-border last:border-b-0 hover:text-primary ${
                  pathname === l.to ? 'text-primary' : 'text-text'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border px-5 sm:px-8 py-7 flex items-center justify-between gap-5 flex-wrap max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo-icon.png" alt="" className="w-5 h-5 object-contain" />
          <span className="text-xs text-muted">
            © {new Date().getFullYear()} Skillture. {T.footer.rights}
          </span>
        </div>
        <div className="flex gap-6 flex-wrap">
          <a href="#" className="text-xs text-muted hover:text-text transition-colors duration-200">
            {T.footer.privacy}
          </a>
          <a href="#" className="text-xs text-muted hover:text-text transition-colors duration-200">
            {T.footer.terms}
          </a>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
