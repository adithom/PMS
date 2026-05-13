import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  allowedRoutes: Array<{ path: string; label: string }>;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Navigation({ allowedRoutes }: NavigationProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-emerald-700 shadow-md">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between px-4 sm:h-20 sm:px-8 lg:px-12">

        {/* ─── Left Side: Hamburger (mobile) + Brand + Links ─── */}
        <div className="flex items-center gap-3 md:gap-10">

          {/* Hamburger button — mobile only */}
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="rounded-lg p-2 text-emerald-100 transition hover:bg-emerald-800/60 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-xl shadow-emerald-900/70 ring-1 ring-white/20 overflow-hidden sm:h-10 sm:w-10">
              <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
              Spice Tree <span className="hidden font-medium text-emerald-200 sm:inline">HMS</span>
            </span>
          </Link>

          {/* Desktop page links */}
          <div className="hidden md:flex md:items-center md:gap-2">
            {allowedRoutes.map((route) => {
              const isActive = location.pathname === route.path ||
                (route.path !== '/' && location.pathname.startsWith(route.path + '/'));
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-emerald-800 text-white shadow-inner ring-1 ring-emerald-600/50'
                      : 'text-emerald-100 hover:bg-emerald-800/50 hover:text-white'
                  )}
                >
                  {route.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── Right Side: User Info & Logout ─── */}
        <div className="flex items-center gap-4 sm:gap-6">

          {/* User profile — hidden on mobile (shown in drawer instead) */}
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-bold text-white leading-none">{user?.username || 'User'}</span>
            <span className="mt-1.5 inline-block rounded-md bg-emerald-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-200 shadow-inner ring-1 ring-emerald-600/50">
              {user?.role?.replace('ROLE_', '') || 'STAFF'}
            </span>
          </div>

          <div className="hidden h-10 w-px bg-emerald-600 sm:block" />

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-800/50 px-3 py-2 text-sm font-semibold text-emerald-100 shadow-sm transition-all hover:border-rose-400 hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:px-4"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ─── Mobile drawer ─── */}
      {menuOpen && (
        <div className="border-t border-emerald-600 bg-emerald-800 md:hidden">
          {/* Nav links */}
          <ul className="px-3 py-2 space-y-0.5">
            {allowedRoutes.map((route) => {
              const isActive = location.pathname === route.path ||
                (route.path !== '/' && location.pathname.startsWith(route.path + '/'));
              return (
                <li key={route.path}>
                  <Link
                    to={route.path}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'block rounded-lg px-4 py-3 text-sm font-semibold transition-all',
                      isActive
                        ? 'bg-emerald-700 text-white'
                        : 'text-emerald-100 hover:bg-emerald-700/60 hover:text-white'
                    )}
                  >
                    {route.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}