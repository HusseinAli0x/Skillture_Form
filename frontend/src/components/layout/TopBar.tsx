import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, ExternalLink, LogOut, Menu } from 'lucide-react';
import type { Admin } from '../../api/types';
import type { Crumb } from '../../lib/adminNav';
import { Logo } from '../brand';

interface UserMenuProps {
  admin: Admin | null;
  onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ admin, onSignOut }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const username = admin?.username ?? 'admin';
  const initials = username.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        className="flex items-center gap-2 ps-1 pe-2 h-11 rounded-full text-sm text-text hover:bg-hover-overlay-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-bg">
          {initials}
        </span>
        <span className="hidden sm:block max-w-32 truncate font-medium">{username}</span>
        <ChevronDown className="w-4 h-4 text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute end-0 mt-2 w-56 rounded-xl border border-border bg-panel shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="text-sm font-medium text-text truncate">{username}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 min-h-11 text-sm text-text hover:bg-danger-soft hover:text-danger focus:outline-none focus-visible:bg-danger-soft focus-visible:text-danger"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

interface Props {
  crumbs: Crumb[];
  admin: Admin | null;
  onOpenDrawer: () => void;
  drawerOpen: boolean;
  onSignOut: () => void;
}

const TopBar: React.FC<Props> = ({ crumbs, admin, onOpenDrawer, drawerOpen, onSignOut }) => (
  <header className="h-14 shrink-0 flex items-center gap-2 ps-2 pe-3 sm:pe-5 md:ps-6 border-b border-border bg-bg">
    <button
      type="button"
      onClick={onOpenDrawer}
      aria-label="Open navigation"
      aria-expanded={drawerOpen}
      className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-muted hover:text-text hover:bg-hover-overlay-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Menu className="w-6 h-6" />
    </button>
    <Logo variant="icon" className="h-6 md:hidden" />

    <nav aria-label="Breadcrumb" className="flex-1 min-w-0">
      <ol className="flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className={`flex items-center gap-1.5 min-w-0 ${last ? '' : 'max-sm:hidden'}`}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0 rtl:rotate-180 max-sm:hidden" aria-hidden="true" />}
              {crumb.to && !last ? (
                <Link to={crumb.to} className="text-muted hover:text-text truncate rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={`truncate ${last ? 'font-semibold text-text' : 'text-muted'}`}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>

    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-hover-overlay-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="max-sm:sr-only">View site</span>
      <ExternalLink className="w-4 h-4" aria-hidden="true" />
    </a>

    <UserMenu admin={admin} onSignOut={onSignOut} />
  </header>
);

export default TopBar;
