import React from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  Calendar,
  FileText,
  GamepadIcon,
  Globe,
  Home,
  LayoutDashboard,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Users,
  X,
} from 'lucide-react';
import { Logo, Pattern } from '../brand';
import { NAV_GROUPS, isActivePath, type NavIconName } from '../../lib/adminNav';

const ICONS: Record<NavIconName, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  home: <Home className="w-5 h-5" />,
  site: <Globe className="w-5 h-5" />,
  workshops: <Calendar className="w-5 h-5" />,
  team: <Users className="w-5 h-5" />,
  messages: <Mail className="w-5 h-5" />,
  forms: <FileText className="w-5 h-5" />,
  quizzes: <GamepadIcon className="w-5 h-5" />,
  builder: <PenTool className="w-5 h-5" />,
};

interface Props {
  /** Icon-only rail. Ignored in the mobile drawer, which is always full width. */
  collapsed: boolean;
  /** Rendered inside the off-canvas drawer: shows a close button, no collapse toggle. */
  drawer?: boolean;
  unreadMessages: number;
  onToggleCollapsed: () => void;
  /** Called after any link is followed (closes the drawer). */
  onNavigate: () => void;
  onCloseDrawer: () => void;
}

const Sidebar: React.FC<Props> = ({
  collapsed,
  drawer = false,
  unreadMessages,
  onToggleCollapsed,
  onNavigate,
  onCloseDrawer,
}) => {
  const { pathname } = useLocation();
  const rail = collapsed && !drawer;

  return (
    <div className="relative flex h-full flex-col bg-bg overflow-hidden">
      {/* Brand */}
      <div
        className={`h-16 flex items-center border-b border-border shrink-0 ${
          rail ? 'justify-center' : 'justify-between ps-5 pe-3'
        }`}
      >
        <NavLink
          to="/admin/dashboard"
          onClick={onNavigate}
          aria-label="Skillture admin home"
          className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {rail ? <Logo variant="icon" className="h-8" /> : <Logo variant="full" className="h-6" />}
        </NavLink>
        {drawer && (
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="Close navigation"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-muted hover:text-text hover:bg-hover-overlay-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? 'top'} className={gi > 0 ? 'mt-6' : ''}>
            {group.label &&
              (rail ? (
                <div className="mx-3 mb-2 h-px bg-border" aria-hidden="true" />
              ) : (
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {group.label}
                </p>
              ))}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = isActivePath(pathname, item.path);
                const badge = item.icon === 'messages' ? unreadMessages : 0;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onNavigate}
                      title={rail ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'group relative flex items-center min-h-11 rounded-lg text-sm font-medium transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        rail ? 'justify-center px-2' : 'gap-3 px-3',
                        active
                          ? 'bg-primary-soft text-primary'
                          : 'text-muted hover:text-text hover:bg-hover-overlay-strong',
                      ].join(' ')}
                    >
                      {/* Active marker: a turquoise bar on the start edge. */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute start-0 top-2 bottom-2 w-[3px] rounded-full bg-primary"
                        />
                      )}
                      <span className="relative shrink-0">
                        {ICONS[item.icon]}
                        {rail && badge > 0 && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-bg"
                          />
                        )}
                      </span>
                      {!rail && <span className="flex-1 truncate">{item.label}</span>}
                      {!rail && badge > 0 && (
                        <span
                          title={`${badge} new since you last opened Messages`}
                          className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-bg text-[11px] font-bold leading-5 text-center tabular-nums"
                        >
                          {badge > 99 ? '99+' : badge}
                          <span className="sr-only"> new</span>
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: a calm strip of the brand pattern, the tagline, and the collapse toggle. */}
      <div className="relative shrink-0 border-t border-border">
        {!rail && <Pattern className="text-primary opacity-[0.05]" />}
        <div className={`relative flex items-center ${rail ? 'justify-center p-3' : 'justify-between gap-2 ps-5 pe-3 py-3'}`}>
          {!rail && (
            <p className="font-display text-sm leading-tight text-muted">
              Where ideas
              <br />
              find their way.
            </p>
          )}
          {!drawer && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-muted hover:text-text hover:bg-hover-overlay-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
