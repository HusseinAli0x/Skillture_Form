import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PenTool, LogOut, FileText, ChevronRight, GamepadIcon } from 'lucide-react';
import { useAuthStore } from '../../context/AuthStore';

const NavItem: React.FC<{ icon: React.ReactNode; label: string; path: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group"
    style={{
      backgroundColor: active ? 'rgba(10,191,188,0.1)' : 'transparent',
      color: active ? '#0ABFBC' : '#888',
      border: active ? '1px solid rgba(10,191,188,0.2)' : '1px solid transparent',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#f0f0f0'; if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#888'; if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <span className="w-5 h-5 flex-shrink-0">{icon}</span>
    <span className="flex-1 text-left">{label}</span>
    {active && <ChevronRight className="w-4 h-4 opacity-60" />}
  </button>
);

const MainLayout: React.FC = () => {
  const { isAuthenticated, admin, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <FileText className="w-5 h-5" />, label: 'Forms', path: '/forms' },
    { icon: <GamepadIcon className="w-5 h-5" />, label: 'Quiz Game', path: '/quizzes' },
    { icon: <PenTool className="w-5 h-5" />, label: 'Quiz Builder', path: '/builder' },
  ];

  const initials = admin?.username?.substring(0, 2).toUpperCase() || 'AD';

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r" style={{ backgroundColor: '#0a0a0a', borderColor: '#2a2a2a' }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: '#2a2a2a' }}>
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Skillture Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-base tracking-tight" style={{ color: '#f0f0f0' }}>Skillture</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#888' }}>Navigation</p>
          {navItems.map(item => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              active={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t" style={{ borderColor: '#2a2a2a' }}>
          <div className="flex items-center gap-3 mb-2 px-2 py-2 rounded-lg" style={{ backgroundColor: '#141414' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(10,191,188,0.15)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.3)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#f0f0f0' }}>{admin?.username}</p>
              <p className="text-xs truncate" style={{ color: '#888' }}>Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: '#888' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 flex items-center px-4 border-b" style={{ backgroundColor: '#0a0a0a', borderColor: '#2a2a2a' }}>
          <span className="font-bold" style={{ color: '#f0f0f0' }}>Skillture</span>
        </header>
        <div className="flex-1 overflow-auto" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
