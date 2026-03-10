// src/components/Navigation.tsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

interface NavigationProps {
  allowedRoutes: Array<{ path: string; label: string }>;
}

export default function Navigation({ allowedRoutes }: NavigationProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/Brand */}
        <div className="navbar-brand">
          <Link to="/" className="navbar-logo">
            Spice Tree Munnar
          </Link>

          {/* Navigation Links */}
          <div className="navbar-links">
            {allowedRoutes.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                className="nav-link"
              >
                {route.label}
              </Link>
            ))}
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="navbar-user">
          <div className="user-info">
            <div className="user-name">{user?.username}</div>
            <div className="user-role">
              {user?.role}
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="logout-btn"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}