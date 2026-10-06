import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '../../context/AuthStore';
import { useMessagesStore } from '../../context/MessagesStore';
import { breadcrumbsFor, pageTitleFor } from '../../lib/adminNav';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useIsDesktop } from '../../lib/useMediaQuery';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const COLLAPSED_KEY = 'skillture.sidebar.collapsed';
/** How often the "new messages" badge re-checks the inbox. */
const UNREAD_POLL_MS = 120_000;

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MainLayout: React.FC = () => {
  const { isAuthenticated, admin, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonFocus = useRef<HTMLElement | null>(null);
  const unread = useMessagesStore(s => s.unread);
  const refreshMessages = useMessagesStore(s => s.refresh);

  useDocumentTitle(`${pageTitleFor(location.pathname)} · Skillture Admin`);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Not persisted; the choice still holds for this session.
      }
      return next;
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonFocus.current?.focus();
  }, []);

  const openDrawer = () => {
    menuButtonFocus.current = document.activeElement as HTMLElement | null;
    setDrawerOpen(true);
  };

  // A drawer left open while the window grows to desktop width would linger.
  const drawerVisible = drawerOpen && !isDesktop;

  // Unread badge: check on load, when the tab regains focus, and now and then.
  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshMessages();
    const timer = window.setInterval(() => void refreshMessages(), UNREAD_POLL_MS);
    const onFocus = () => void refreshMessages();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, refreshMessages]);

  // Drawer behaviour: Escape closes, Tab stays inside, the page behind is locked.
  useEffect(() => {
    if (!drawerVisible) return;
    const drawer = drawerRef.current;
    const first = drawer?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab' || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerVisible, closeDrawer]);

  // A UX affordance only — the real boundary is RequireAdmin on the server.
  // The current path rides along so signing in lands back where the admin was.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[70] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-bg focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Desktop rail / sidebar */}
      <aside
        className={`hidden md:block shrink-0 border-e border-border transition-[width] duration-200 motion-reduce:transition-none ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <Sidebar
          collapsed={collapsed}
          unreadMessages={unread}
          onToggleCollapsed={toggleCollapsed}
          onNavigate={() => undefined}
          onCloseDrawer={closeDrawer}
        />
      </aside>

      {/* Mobile drawer. `inert` keeps it out of the tab order while closed. */}
      <div
        className={`md:hidden fixed inset-0 z-40 ${drawerVisible ? '' : 'pointer-events-none'}`}
        aria-hidden={!drawerVisible}
        inert={!drawerVisible}
      >
        <div
          onClick={closeDrawer}
          className={`absolute inset-0 bg-black/70 transition-opacity duration-200 motion-reduce:transition-none ${
            drawerVisible ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`absolute inset-y-0 start-0 w-72 max-w-[85vw] border-e border-border shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
            drawerVisible ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
          }`}
        >
          <Sidebar
            collapsed={false}
            drawer
            unreadMessages={unread}
            onToggleCollapsed={toggleCollapsed}
            onNavigate={() => setDrawerOpen(false)}
            onCloseDrawer={closeDrawer}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          crumbs={breadcrumbsFor(location.pathname)}
          admin={admin}
          onOpenDrawer={openDrawer}
          drawerOpen={drawerVisible}
          onSignOut={handleSignOut}
        />
        <main id="admin-main" tabIndex={-1} className="flex-1 overflow-auto bg-bg focus:outline-none">
          <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
