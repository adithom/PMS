// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../api/apiClient';
import type { AuthResponse, UserInfo } from '../api/authApi';

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  login: (username: string, password: string) => Promise<UserInfo>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      console.log('Initializing auth, token exists:', !!storedToken); // Debug log

      if (storedToken) {
        try {
          const userInfo = await apiClient.get<UserInfo>('/auth/me');
          console.log('User info fetched:', userInfo); // Debug log
          setUser(userInfo);
          setToken(storedToken);
        } catch (error) {
          console.error('Token validation failed:', error); // Debug log
          // Token invalid, clear it
          localStorage.removeItem('accessToken');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<UserInfo> => {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', { username, password });

      localStorage.setItem('accessToken', response.token);
      setToken(response.token);

      // Set user from auth response
      const tempUser: UserInfo = {
        id: '', // Not provided in AuthResponse, will be fetched
        username: response.username,
        email: response.email,
        role: response.role,
        properties: response.properties
      };
      setUser(tempUser);

      // Fetch full user info
      try {
        const userInfo = await apiClient.get<UserInfo>('/auth/me');
        setUser(userInfo);
        return userInfo;
      } catch (fetchError) {
        console.warn('Could not fetch full user info, using temp user:', fetchError);
        return tempUser;
      }
    } catch (error: any) {
      // Clear any stored token on login failure
      localStorage.removeItem('accessToken');
      setToken(null);
      setUser(null);

      // Throw a more user-friendly error
      if (error.status === 401) {
        throw new Error('Invalid username or password');
      } else if (error.status === 403) {
        throw new Error('Access forbidden');
      } else if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  };

  const logout = () => {
    // Optional: Call logout endpoint if exists
    // apiClient.post('/auth/logout', {}).catch(() => {});
    localStorage.removeItem('accessToken');
    setUser(null);
    setToken(null);
  };

  const contextValue: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!token && !!user
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}