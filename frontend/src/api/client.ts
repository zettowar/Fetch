import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// No default Content-Type, deliberately. axios chooses one per request: JSON
// for a plain object, and for FormData it leaves the header to the browser,
// which adds the multipart boundary. A blanket 'application/json' default
// looks harmless but makes axios *serialise FormData as JSON* — every upload
// that didn't override the header arrived as `{"photo":{}}` and was refused,
// which is why adding a sighting and uploading a rescue logo never worked.
const client = axios.create({ baseURL: API_BASE });

const REFRESH_KEY = 'refresh_token';

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

/** End this tab's "log in as" session and go back to the admin console. The
 *  admin's own session lives in localStorage and is not touched. */
export function exitImpersonation() {
  try {
    sessionStorage.removeItem('imp_token');
    sessionStorage.removeItem('imp_name');
  } catch {
    /* ignore */
  }
  window.location.assign('/admin/users');
}

client.interceptors.request.use((config) => {
  const token = impersonationToken() || accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** The newest refresh token any tab of this browser has stored. */
export function storedRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

// Whether this tab's token has ever reached shared storage. It tells "storage
// is empty because another tab signed out" (true) from "storage never worked
// here" (false: private mode, blocked cookies), where memory is all we have.
let persisted = false;

/** Save the session's refresh token where every tab can find it. */
export function rememberRefreshToken(token: string) {
  try {
    localStorage.setItem(REFRESH_KEY, token);
    persisted = true;
  } catch {
    /* storage unavailable — this tab still has the tokens in memory */
  }
}

/** Remove the shared refresh token (sign-out, or the server rejected it). */
export function forgetRefreshToken() {
  persisted = false;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/** Thrown when there is no session left to refresh — treated like a 401. */
class SignedOutError extends Error {
  response = { status: 401 };
  constructor() {
    super('Signed out');
  }
}

async function requestRefresh(token: string): Promise<string> {
  const res = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: token });
  const { access_token, refresh_token } = res.data.tokens;
  setTokens(access_token, refresh_token);
  rememberRefreshToken(refresh_token);
  return access_token as string;
}

// Memoize an in-flight refresh so concurrent 401s don't each burn the
// one-use refresh token.
let refreshInFlight: Promise<string> | null = null;

async function ensureFreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  // Refresh tokens are single-use, and every tab rotates the shared one when
  // it boots. So the copy in THIS tab's memory goes stale the moment another
  // tab opens — using it here signed the older tab out fifteen minutes after
  // someone opened a link in a new one. localStorage is the one place all
  // tabs agree on, so read from there and keep memory only as a fallback.
  const stored = storedRefreshToken();
  // Storage held our token and now holds nothing: another tab signed out.
  // Falling back to the copy in memory here is what let a tab that had been
  // "logged out" quietly refresh, write a live token back to storage, and
  // sign every new tab in again.
  if (!stored && persisted) throw new SignedOutError();
  const first = stored || refreshToken;
  if (!first) throw new SignedOutError();
  refreshInFlight = requestRefresh(first)
    .catch((err) => {
      // Lost a race: another tab rotated the token between our read and the
      // request. If storage now holds a different one, that is the live token.
      const latest = storedRefreshToken();
      if (err?.response?.status === 401 && latest && latest !== first) {
        return requestRefresh(latest);
      }
      throw err;
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
      } catch (refreshError) {
        // Only the server refusing the token means the session is over. Being
        // offline, or a 502 while a deploy restarts the API, says nothing
        // about it — fail this one request and let the next try again rather
        // than throwing the person out to the login screen.
        const status = (refreshError as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          clearTokens();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default client;
