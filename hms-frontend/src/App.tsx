// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navbar';
import Login from './pages/Login';
import LoadingSpinner from './components/LoadingSpinner';
import { getRoutesForRole, getDefaultRouteForRole } from './config/roleConfig';

// Import your page components
import Properties from './pages/Properties';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Guests from './pages/Guests';
import PosInterface from './pages/PosInterface';
import AdminBillingManager from './pages/AdminBillingManager';
import FrontDeskBillingManager from './pages/FrontDeskBillingManager';
import Sandbox from './pages/Sandbox';
import Reports from './pages/Reports'


function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Get routes allowed for current user's role
  const allowedRoutes = user ? getRoutesForRole(user.role) : [];

  // Get the default (first) route for the user's role
  const defaultRoute = user ? getDefaultRouteForRole(user.role) : '/login';

  return (
    <Routes>
      {/* Public route - Login */}
      <Route path="/login" element={<Login />} />

      {/* Root path redirects to user's first allowed page */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={defaultRoute} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Protected routes with role-based access */}
      <Route
        path="/properties"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <Properties />
            </>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rooms"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'FRONTDESK', 'HOUSEKEEPING']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <Rooms />
            </>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookings"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <Bookings />
            </>
          </ProtectedRoute>
        }
      />

      <Route
        path="/guests"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'FRONTDESK']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <Guests />
            </>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pos"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'POS']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <PosInterface />
            </>
          </ProtectedRoute>
        }
      />


      <Route
        path="/billing"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'FRONTDESK']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              
              {user?.role === 'ADMIN' ? (
                <AdminBillingManager />
              ) : (
                <FrontDeskBillingManager 
                  propertyId={user?.properties?.[0]?.id || ''} 
                />
              )}
            </>
          </ProtectedRoute>
        }
      />

       <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'FRONTDESK', 'HOUSEKEEPING']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <Reports />
            </>
          </ProtectedRoute>
        }
      />
    

      <Route
        path="/frontdesk-billing"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <>
              <Navigation allowedRoutes={allowedRoutes} />
              <FrontDeskBillingManager 
            propertyId="4ce85cf7-cb84-4c87-b405-c11be2f64ac6" />
            </>
          </ProtectedRoute>
        }
      />


      {/* Developer Sandbox - Hidden from normal navigation */}
      <Route
        path="/sandbox"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Sandbox />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to user's default page or login */}
      <Route
        path="*"
        element={<Navigate to={user ? defaultRoute : '/login'} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
