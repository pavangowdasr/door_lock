import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  History,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Server,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { healthService } from '../services/health.service.js';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState({
    status: 'checking',
    database: 'checking',
    error: null,
  });

  // Check health periodically (every 30s)
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const data = await healthService.getHealth();
        if (isMounted) {
          setHealthStatus({
            status: data.status || 'ok',
            database: data.database || 'connected',
            error: null,
          });
        }
      } catch (err) {
        if (isMounted) {
          setHealthStatus({
            status: 'unreachable',
            database: 'unknown',
            error: err.message,
          });
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Failed to log out');
    }
  };

  const navItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'RFID Cards', to: '/cards', icon: CreditCard },
    { label: 'Access Logs', to: '/logs', icon: History },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  // Derive current page title
  const currentNav = navItems.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );
  const pageTitle = currentNav ? currentNav.label : 'Dashboard';

  const isHealthy = healthStatus.status === 'ok';
  const isUnreachable = healthStatus.status === 'unreachable';

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-zinc-100">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-800/80 bg-zinc-900/40 shrink-0">
        {/* Brand header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-800/80">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-1.5">
              RFID Access Hub
            </div>
            <div className="text-[11px] text-zinc-500 font-mono tracking-wider">
              IoT Door Lock Admin
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Backend status indicator in sidebar */}
        <div className="p-4 border-t border-zinc-800/80">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                Backend API
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider ${
                  isHealthy
                    ? 'text-emerald-400'
                    : isUnreachable
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isHealthy
                      ? 'bg-emerald-400 animate-pulse'
                      : isUnreachable
                      ? 'bg-rose-400'
                      : 'bg-amber-400'
                  }`}
                />
                {healthStatus.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Database</span>
              <span className="font-mono text-zinc-300 text-[10px]">
                {healthStatus.database}
              </span>
            </div>
          </div>
        </div>

        {/* Admin profile & logout */}
        <div className="p-4 border-t border-zinc-800/80 flex items-center justify-between bg-zinc-900/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-200 truncate">
                {user?.username || 'admin'}
              </div>
              <div className="text-[10px] text-zinc-500 truncate font-mono">
                Administrator
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            RFID Access Hub
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-900/95 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              Logged in as <strong className="text-zinc-200">{user?.username || 'admin'}</strong>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium py-1 px-2 rounded"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 border-b border-zinc-800/80 bg-zinc-900/20 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-zinc-100">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time system health pill */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy
                    ? 'bg-emerald-400'
                    : isUnreachable
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-mono text-zinc-400">
                {isHealthy
                  ? 'System Healthy'
                  : isUnreachable
                  ? 'API Unreachable'
                  : 'Degraded Mode'}
              </span>
            </div>

            <div className="text-xs text-zinc-400 font-mono">
              Admin: <span className="text-zinc-200 font-medium">{user?.username || 'admin'}</span>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {/* Banner if backend unreachable */}
          {isUnreachable && (
            <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between">
              <div>
                <strong className="font-semibold block text-rose-200 mb-0.5">
                  Backend API Offline or Unreachable
                </strong>
                The frontend cannot communicate with the Node.js backend. Please ensure the backend server is running on port 5000.
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 font-medium transition-colors shrink-0 ml-4"
              >
                Retry
              </button>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
