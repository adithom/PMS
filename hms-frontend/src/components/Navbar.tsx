import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-emerald-700 shadow-md">
      <div className="mx-auto flex h-20 max-w-[1800px] items-center justify-between px-4 sm:px-8 lg:px-12">
        
        {/* ─── Left Side: Brand & Links ─── */}
        <div className="flex items-center gap-10">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xl shadow-emerald-900/70 ring-1 ring-white/20 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Spice Tree <span className="text-emerald-200 font-medium hidden sm:inline">HMS</span>
            </span>
          </Link>

          {/* Page Links */}
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
        <div className="flex items-center gap-6">
          
          {/* User Profile Info */}
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-bold text-white leading-none">
              {user?.username || 'User'}
            </span>
            <span className="mt-1.5 inline-block rounded-md bg-emerald-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-200 shadow-inner ring-1 ring-emerald-600/50">
              {user?.role?.replace('ROLE_', '') || 'STAFF'}
            </span>
          </div>
          
          {/* Divider */}
          <div className="hidden h-10 w-px bg-emerald-600 sm:block"></div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-800/50 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-sm transition-all hover:border-rose-400 hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>

        </div>
        
      </div>
    </nav>
  );
}