import axios from 'axios';

/**
 * Turn an unknown thrown value into a user-facing error string.
 * Prefers the FastAPI `detail` field from the response body, handles
 * rate-limit (429) with a specific message, and falls back to `fallback`.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) {
      return 'Too many requests — try again in a minute.';
    }
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === 'string') {
      return detail[0].msg;
    }
    if (!err.response) return 'Network error — check your connection.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
