import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PenTool, LogOut, FileText, ChevronRight, GamepadIcon, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import { useAuthStore } from '../../context/AuthStore';

const NavItem: React.FC<{ icon: React.ReactNode; label: string; path: string; active: boolean; onClick: () => void; isCollapsed: boolean }> = ({ icon, label, active, onClick, isCollapsed }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group`}
    style={{
      backgroundColor: active ? 'rgba(10,191,188,0.1)' : 'transparent',
      color: active ? '#0ABFBC' : '#888',
      border: active ? '1px solid rgba(10,191,188,0.2)' : '1px solid transparent',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#f0f0f0'; if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#888'; if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <span className="w-5 h-5 flex-shrink-0">{icon}</span>
    {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
    {!isCollapsed && active && <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-60" />}
  </button>
);

const MainLayout: React.FC = () => {
  const { isAuthenticated, admin, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Homepage Editor', path: '/admin/homepage' },
    { icon: <FileText className="w-5 h-5" />, label: 'Forms', path: '/admin/forms' },
    { icon: <GamepadIcon className="w-5 h-5" />, label: 'Quiz Game', path: '/admin/quizzes' },
    { icon: <PenTool className="w-5 h-5" />, label: 'Quiz Builder', path: '/admin/builder' },
  ];

  const initials = admin?.username?.substring(0, 2).toUpperCase() || 'AD';

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Sidebar Desktop & Mobile */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r transition-all duration-300 ease-in-out md:relative ${isSidebarOpen ? 'w-60 translate-x-0' : 'w-20 -translate-x-full md:translate-x-0'}`} 
        style={{ backgroundColor: '#0a0a0a', borderColor: '#2a2a2a' }}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center ${isSidebarOpen ? 'justify-between px-5' : 'justify-center'} border-b flex-shrink-0`} style={{ borderColor: '#2a2a2a' }}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" alt="Skillture Logo" className="w-8 h-8 object-contain flex-shrink-0" />
            {isSidebarOpen && <span className="font-bold text-base tracking-tight whitespace-nowrap" style={{ color: '#f0f0f0' }}>Skillture</span>}
          </div>
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="hidden md:flex p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isSidebarOpen && (
          <div className="hidden md:flex justify-center p-3 border-b border-[#2a2a2a]">
             <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-2 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto overflow-x-hidden">
          {isSidebarOpen && <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: '#888' }}>Navigation</p>}
          {navItems.map(item => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              active={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              isCollapsed={!isSidebarOpen}
            />
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t" style={{ borderColor: '#2a2a2a' }}>
          <div className={`flex items-center ${isSidebarOpen ? 'gap-3 px-2' : 'justify-center'} mb-2 py-2 rounded-lg`} style={{ backgroundColor: '#141414' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(10,191,188,0.15)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.3)' }} title={admin?.username}>
              {initials}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#f0f0f0' }}>{admin?.username}</p>
                <p className="text-xs truncate" style={{ color: '#888' }}>Administrator</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={!isSidebarOpen ? "Sign Out" : undefined}
            className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2 rounded-lg text-sm font-medium transition-colors`}
            style={{ color: '#888' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
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
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b flex-shrink-0" style={{ backgroundColor: '#0a0a0a', borderColor: '#2a2a2a' }}>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            <span className="font-bold" style={{ color: '#f0f0f0' }}>Skillture</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
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
