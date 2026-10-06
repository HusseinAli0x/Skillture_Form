import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import {
  LayoutDashboard,
  PenTool,
  LogOut,
  FileText,
  ChevronRight,
  GamepadIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Home,
  Calendar,
  Mail,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../context/AuthStore';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, isCollapsed }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    aria-current={active ? 'page' : undefined}
    className={[
      'w-full flex items-center min-h-11 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 border',
      isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
      active
        ? 'bg-primary-soft text-primary border-primary-border'
        : 'bg-transparent text-muted border-transparent hover:text-text hover:bg-hover-overlay-strong',
    ].join(' ')}
  >
    <span className="w-5 h-5 flex-shrink-0">{icon}</span>
    {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
    {!isCollapsed && active && <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-60" />}
  </button>
);

const navItems = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', path: '/admin/dashboard' },
  { icon: <Home className="w-5 h-5" />, label: 'Homepage Editor', path: '/admin/homepage' },
  { icon: <Calendar className="w-5 h-5" />, label: 'Workshops', path: '/admin/workshops' },
  { icon: <Users className="w-5 h-5" />, label: 'Team', path: '/admin/team' },
  { icon: <FileText className="w-5 h-5" />, label: 'Forms', path: '/admin/forms' },
  { icon: <GamepadIcon className="w-5 h-5" />, label: 'Quiz Game', path: '/admin/quizzes' },
  { icon: <PenTool className="w-5 h-5" />, label: 'Quiz Builder', path: '/admin/builder' },
  { icon: <Mail className="w-5 h-5" />, label: 'Messages', path: '/admin/messages' },
];

const isDesktopViewport = () => window.matchMedia('(min-width: 768px)').matches;

const MainLayout: React.FC = () => {
  const { isAuthenticated, admin, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  // Desktop starts expanded; on phones the sidebar is an off-canvas drawer
  // that must start closed or it covers the page on load.
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktopViewport);

  // A UX affordance only — the real boundary is RequireAdmin on the server.
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = admin?.username?.substring(0, 2).toUpperCase() || 'AD';

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-bg transition-all duration-300 ease-in-out md:relative ${
          isSidebarOpen ? 'w-60 translate-x-0' : 'w-20 -translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div
          className={`h-16 flex items-center border-b border-border flex-shrink-0 ${
            isSidebarOpen ? 'justify-between px-5' : 'justify-center'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" alt="" className="w-8 h-8 object-contain flex-shrink-0" />
            {isSidebarOpen && (
              <span className="font-bold text-base tracking-tight whitespace-nowrap text-text">Skillture</span>
            )}
          </div>
          {isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Collapse sidebar"
              className="hidden md:flex p-2 rounded-md text-muted hover:text-text hover:bg-hover-overlay-strong transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isSidebarOpen && (
          <div className="hidden md:flex justify-center p-3 border-b border-border">
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Expand sidebar"
              className="p-2 rounded-md text-muted hover:text-text hover:bg-hover-overlay-strong transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto overflow-x-hidden">
          {isSidebarOpen && (
            <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap text-muted">
              Navigation
            </p>
          )}
          {navItems.map(item => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname.startsWith(item.path)}
              onClick={() => {
                navigate(item.path);
                if (!isDesktopViewport()) setIsSidebarOpen(false);
              }}
              isCollapsed={!isSidebarOpen}
            />
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div
            className={`flex items-center mb-2 py-2 rounded-lg bg-panel ${
              isSidebarOpen ? 'gap-3 px-2' : 'justify-center'
            }`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-primary-soft text-primary border border-primary-border"
              title={admin?.username}
            >
              {initials}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-text">{admin?.username}</p>
                <p className="text-xs truncate text-muted">Administrator</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={!isSidebarOpen ? 'Sign Out' : undefined}
            className={`w-full flex items-center min-h-11 py-2 rounded-lg text-sm font-medium transition-colors text-muted hover:text-danger hover:bg-danger-soft ${
              isSidebarOpen ? 'gap-3 px-3' : 'justify-center'
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          role="presentation"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-bg flex-shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-6 h-6 object-contain" />
            <span className="font-bold text-text">Skillture</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle navigation"
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-muted hover:text-text transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-bg">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
