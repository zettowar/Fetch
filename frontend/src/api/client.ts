import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function getRefreshToken() {
  return refreshToken;
}

// Admin "log in as" stores a short-lived token in sessionStorage (per-tab, so
// it never touches the admin's persistent session in other tabs). When present
// it overrides the normal access token for this tab only.
export function impersonationToken(): string | null {
  try {
    return sessionStorage.getItem('imp_token');
  } catch {
    return null;
  }
}

client.interceptors.request.use((config) => {
  const token = impersonationToken() || accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Memoize an in-flight refresh so concurrent 401s don't each burn the
// one-use refresh token.
let refreshInFlight: Promise<string> | null = null;

async function ensureFreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  if (!refreshToken) throw new Error('No refresh token');
  refreshInFlight = axios
    .post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
    .then((res) => {
      const { access_token, refresh_token } = res.data.tokens;
      setTokens(access_token, refresh_token);
      localStorage.setItem('refresh_token', refresh_token);
      return access_token as string;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Don't burn the admin refresh token while impersonating; an expired
    // impersonation token just ends the impersonated session.
    if (error.response?.status === 401 && !original._retry && refreshToken && !impersonationToken()) {
      original._retry = true;
      try {
        const access = await ensureFreshAccessToken();
        original.headers.Authorization = `Bearer ${access}`;
        return client(original);
      } catch {
        clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default client;
