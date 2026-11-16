import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import {
  setTokens,
  clearTokens,
  impersonationToken,
  storedRefreshToken,
  rememberRefreshToken,
  forgetRefreshToken,
} from '../api/client';
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
      rememberRefreshToken(refresh_token);
      return getMe();
    })
    .finally(() => {
      restoreInFlight = null;
    });
  return restoreInFlight;
}

// Whose session the shared refresh token belongs to. The token itself is
// opaque, so this is how one tab learns that another signed in as someone else.
const SESSION_USER_KEY = 'fetch.session_user';

function writeSessionUser(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_USER_KEY, id);
    else localStorage.removeItem(SESSION_USER_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const setUser = useCallback((next: User | null) => {
    userRef.current = next;
    setUserState(next);
  }, []);

  const login = useCallback((accessToken: string, refreshToken: string, user: User) => {
    setTokens(accessToken, refreshToken);
    rememberRefreshToken(refreshToken);
    writeSessionUser(user.id);
    setUser(user);
  }, [setUser]);

  const logout = useCallback(() => {
    clearTokens();
    forgetRefreshToken();
    writeSessionUser(null);
    setUser(null);
  }, [setUser]);

  // Tabs share one session, so they have to hear about each other.
  //
  // They did not. Signing out in one tab removed the shared token, but any
  // other tab kept its own copy in memory, refreshed with it a quarter of an
  // hour later and wrote a live token straight back — "Log out" did not log
  // out. And signing in as a second account in one tab left the others showing
  // the first account's name while their requests ran as the second.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (impersonationToken() || !userRef.current) return;
      const signedOut =
        e.key === null || (e.key === 'refresh_token' && e.newValue === null);
      const switched =
        e.key === SESSION_USER_KEY && e.newValue !== null && e.newValue !== userRef.current.id;
      if (signedOut) {
        clearTokens();
        // A full load, as on an ordinary sign-out: pages mid-render with the
        // user suddenly gone is how the error boundary gets reached.
        if (/^\/(app|admin)(\/|$)/.test(window.location.pathname)) window.location.assign('/');
        else setUser(null);
      } else if (switched) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setUser]);

  const refreshUser = useCallback(async () => {
    const u = await getMe();
    setUser(u);
  }, [setUser]);

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

    // Guarded: with cookies blocked, merely touching localStorage throws, and
    // unguarded that took the whole site down — the marketing pages and the
    // QR-tag finder page included — before anything rendered.
    const savedRefresh = storedRefreshToken();
    if (!savedRefresh) {
      setIsLoading(false);
      return;
    }

    const signedIn = (u: User) => {
      writeSessionUser(u.id);
      setUser(u);
    };

    // First refresh the access token, then fetch user
    restoreSession(savedRefresh)
      .then(signedIn)
      .catch(async (err) => {
        let failure = err;
        // Two tabs opening together both read the same single-use token. One
        // wins and stores its replacement; the other gets a 401 — for a token
        // that is merely spent, not a session that is over. Deleting the
        // stored token here threw away the winner's fresh one and signed both
        // tabs out. If storage has moved on, the newer token is the live one.
        const latest = storedRefreshToken();
        const status0 = (err as { response?: { status?: number } })?.response?.status;
        if (status0 === 401 && latest && latest !== savedRefresh) {
          try {
            signedIn(await restoreSession(latest));
            return;
          } catch (again) {
            failure = again;
          }
        }
        // Forget the saved session only when the server rejected it. A dropped
        // connection, a 502 mid-deploy or a 429 are not verdicts on the token;
        // deleting it for those signed people out for good because they
        // opened the app in a tunnel. Kept, the next load simply tries again.
        const status = (failure as { response?: { status?: number } })?.response?.status;
        if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
          forgetRefreshToken();
          writeSessionUser(null);
        }
        clearTokens();
      })
      .finally(() => setIsLoading(false));
  }, [setUser]);

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
