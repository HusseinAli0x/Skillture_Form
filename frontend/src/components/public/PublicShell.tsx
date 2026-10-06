import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import { Frieze, Logo, Pattern } from '../brand';
import { useLanguageStore } from '../../context/LanguageStore';
import { translations } from '../../lib/translations';
import { siteStrings } from '../../lib/siteStrings';
import { BTN_CORAL, FOCUS_RING, WRAP } from './layout';

/**
 * Frame for every public page: black header with the full wordmark, a phone
 * menu, the language switch, a black footer, and the RTL/lang handling.
 * Applies the `site` theme class, which re-themes the shared tokens for the
 * public pages only — the admin app and the live quiz screens stay dark.
 * Direction is restored on unmount.
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
  const isActive = (to: string) => (to === '/' ? pathname === '/' && !hash : to === '/#contact' ? pathname === '/' && hash === '#contact' : pathname === to);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="site min-h-dvh flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[60] focus:bg-brand focus:text-ink focus:px-4 focus:py-2 focus:rounded-md focus:font-semibold"
      >
        {S.common.skip}
      </a>

      <header className="on-ink sticky top-0 z-50 border-b border-border">
        <div className={`${WRAP} h-16 flex items-center justify-between gap-3`}>
          <Link to="/" aria-label="Skillture" className={`flex items-center py-2 -my-2 rounded-sm ${FOCUS_RING}`}>
            <Logo variant="full" className="h-5 sm:h-7" />
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3 md:gap-6" aria-label="Main">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={isActive(l.to) ? 'page' : undefined}
                className={`hidden md:inline-flex items-center min-h-11 text-sm font-medium border-b-2 transition-colors hover:text-primary ${FOCUS_RING} ${
                  isActive(l.to) ? 'border-brand' : 'border-transparent'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <LanguageSwitcher />
            <Link to="/play" className={`${BTN_CORAL} !min-h-10 !px-3 sm:!px-4 text-sm whitespace-nowrap`}>
              {S.nav.joinGame}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={S.nav.menu}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              className={`md:hidden inline-flex items-center justify-center w-11 h-11 -me-2 rounded-md hover:text-primary transition-colors cursor-pointer ${FOCUS_RING}`}
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div id="public-mobile-nav" className="on-ink md:hidden absolute inset-x-0 top-full border-b border-border">
            <div className={`${WRAP} py-2`}>
              {links.map(l => (
                <Link
                  key={l.to}
                  to={l.to}
                  aria-current={isActive(l.to) ? 'page' : undefined}
                  className="flex items-center min-h-12 text-base font-medium border-b border-border hover:text-primary"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="on-ink relative overflow-hidden">
        <Pattern className="text-white opacity-[0.035]" />
        <div className="relative">
          <Frieze className="text-brand/60" />
          <div className={`${WRAP} py-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end`}>
            <div>
              <Logo variant="full" className="h-8" />
              <p className="mt-3 text-base text-muted">{S.common.tagline}</p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 text-sm">
              {links.slice(1).map(l => (
                <Link key={l.to} to={l.to} className="inline-flex items-center min-h-11 text-muted hover:text-text transition-colors">
                  {l.label}
                </Link>
              ))}
              <Link to="/play" className="inline-flex items-center min-h-11 text-muted hover:text-text transition-colors">
                {S.nav.joinGame}
              </Link>
            </nav>
            <p className="text-sm text-muted md:col-span-2">
              © {new Date().getFullYear()} Skillture. {T.footer.rights}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
