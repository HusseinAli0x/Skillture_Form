import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import { useLanguageStore } from '../../context/LanguageStore';
import { translations } from '../../lib/translations';
import { siteStrings } from '../../lib/siteStrings';
import { WRAP } from './layout';

/**
 * Frame for every public page: solid header with a phone menu, language
 * switch, footer, and the RTL/lang handling. Applies the `site` theme class,
 * which re-themes the shared tokens for the public pages only — the admin app
 * and the live quiz screens stay dark. Direction is restored on unmount.
 */
const PublicShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const locale = useLanguageStore(s => s.locale);
  const T = translations[locale];
  const S = siteStrings[locale];
  const isRTL = locale === 'ar';
  const { pathname, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    };
  }, [isRTL, locale]);

  // New page: start at the top, unless the link points at a section (#contact).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname, hash]);

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
  const isActive = (to: string) => (to === '/' ? pathname === '/' && !hash : pathname === to);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="site min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-bg border-b border-border">
        <div className={`${WRAP} h-16 flex items-center justify-between gap-4`}>
          <Link to="/" className="flex items-center gap-2.5 py-2 -my-2">
            <img src="/logo-icon.png" alt="" className="w-7 h-7 object-contain" />
            <span className="text-lg font-semibold tracking-tight">Skillture</span>
          </Link>

          <nav className="flex items-center gap-3 md:gap-6" aria-label="Main">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={isActive(l.to) ? 'page' : undefined}
                className={`hidden md:inline-flex items-center min-h-11 text-sm font-medium border-b-2 transition-colors hover:text-primary ${
                  isActive(l.to) ? 'border-ink' : 'border-transparent'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <LanguageSwitcher />
            <Link
              to="/play"
              className="hidden sm:inline-flex items-center justify-center min-h-10 px-4 rounded-md bg-ink text-white text-sm font-semibold whitespace-nowrap hover:bg-black transition-colors"
            >
              {S.nav.joinGame}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={S.nav.menu}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              className="md:hidden inline-flex items-center justify-center w-11 h-11 -me-2 rounded-md hover:text-primary transition-colors"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div id="public-mobile-nav" className="md:hidden absolute inset-x-0 top-full bg-bg border-b border-border">
            <div className={`${WRAP} py-2`}>
              {links.map(l => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="flex items-center min-h-12 text-base font-medium border-b border-border hover:text-primary"
                >
                  {l.label}
                </Link>
              ))}
              <Link to="/play" className="flex items-center min-h-12 text-base font-semibold text-primary">
                {S.nav.joinGame}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className={`${WRAP} py-8 flex items-center justify-between gap-x-8 gap-y-4 flex-wrap`}>
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="" className="w-5 h-5 object-contain" />
            <span className="text-sm text-muted">
              © {new Date().getFullYear()} Skillture. {T.footer.rights}
            </span>
          </div>
          <div className="flex items-center gap-x-6 flex-wrap text-sm">
            <Link to="/our-work" className="inline-flex items-center min-h-11 text-muted hover:text-text transition-colors">
              {S.nav.ourWork}
            </Link>
            <Link to="/team" className="inline-flex items-center min-h-11 text-muted hover:text-text transition-colors">
              {S.nav.team}
            </Link>
            <a href="#" className="inline-flex items-center min-h-11 text-muted hover:text-text transition-colors">
              {T.footer.privacy}
            </a>
            <a href="#" className="inline-flex items-center min-h-11 text-muted hover:text-text transition-colors">
              {T.footer.terms}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
