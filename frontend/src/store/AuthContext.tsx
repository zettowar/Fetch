import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { setTokens, clearTokens, impersonationToken } from '../api/client';
import { getMe, refreshTokens } from '../api/auth';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// One restore at a time. The saved refresh token is single-use, and React
// StrictMode mounts the provider's effect twice in development: two requests
// spending the same token race, and the loser's 401 would look like an expired
// session. Sharing the in-flight promise makes the second mount a no-op.
let restoreInFlight: Promise<User> | null = null;

function restoreSession(savedRefresh: string): Promise<User> {
  restoreInFlight ??= refreshTokens(savedRefresh)
    .then((data) => {
      const { access_token, refresh_token } = data.tokens;
      setTokens(access_token, refresh_token);
      localStorage.setItem('refresh_token', refresh_token);
      return getMe();
    })
    .finally(() => {
      restoreInFlight = null;
    });
  return restoreInFlight;
}

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

  const refreshUser = useCallback(async () => {
    const u = await getMe();
    setUser(u);
  }, []);

  useEffect(() => {
    // Impersonation tab: load the impersonated user straight from their token,
    // bypassing the admin's refresh flow entirely.
    if (impersonationToken()) {
      getMe()
        .then((u) => setUser(u))
        .catch(() => {
          try { sessionStorage.removeItem('imp_token'); } catch { /* ignore */ }
        })
        .finally(() => setIsLoading(false));
      return;
    }

    const savedRefresh = localStorage.getItem('refresh_token');
    if (!savedRefresh) {
      setIsLoading(false);
      return;
    }

    // First refresh the access token, then fetch user
    restoreSession(savedRefresh)
      .then((u) => {
        setUser(u);
      })
      .catch((err) => {
        // Forget the saved session only when the server rejected it. A dropped
        // connection, a 502 mid-deploy or a 429 are not verdicts on the token;
        // deleting it for those signed people out for good because they
        // opened the app in a tunnel. Kept, the next load simply tries again.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
          localStorage.removeItem('refresh_token');
        }
        clearTokens();
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
