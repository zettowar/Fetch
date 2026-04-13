import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { setTokens, clearTokens } from '../api/client';
import { getMe, refreshTokens } from '../api/auth';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((accessToken: string, refreshToken: string, user: User) => {
    setTokens(accessToken, refreshToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  useEffect(() => {
    const savedRefresh = localStorage.getItem('refresh_token');
    if (!savedRefresh) {
      setIsLoading(false);
      return;
    }

    // First refresh the access token, then fetch user
    refreshTokens(savedRefresh)
      .then((data) => {
        const { access_token, refresh_token } = data.tokens;
        setTokens(access_token, refresh_token);
        localStorage.setItem('refresh_token', refresh_token);
        return getMe();
      })
      .then((u) => {
        setUser(u);
      })
      .catch(() => {
        localStorage.removeItem('refresh_token');
        clearTokens();
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
