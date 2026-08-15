import client, { API_BASE } from './client';
import type { AuthResponse, User } from '../types';

// --- SSO / OAuth ---

// Providers to show buttons for (configured AND admin-enabled). [] = feature off.
export async function getOAuthProviders(): Promise<string[]> {
  const res = await client.get('/auth/oauth/providers');
  return res.data;
}

// Top-level navigation target that kicks off the provider redirect.
export function oauthStartUrl(provider: string, returnTo = '/app/home'): string {
  return `${API_BASE}/auth/oauth/${provider}/start?return=${encodeURIComponent(returnTo)}`;
}

// Trade the one-time handoff code (from the callback URL) for real tokens.
// `otp` is required when the account has 2FA on — the backend answers 401 with
// X-2FA-Required and leaves the handoff code unspent so it can be retried.
export async function oauthExchange(
  code: string,
  otp?: string,
): Promise<AuthResponse> {
  const res = await client.post('/auth/oauth/exchange', { code, otp });
  return res.data;
}

export async function signup(
  email: string,
  password: string,
  display_name: string,
  invite_code?: string,
): Promise<AuthResponse> {
  const res = await client.post('/auth/signup', {
    email,
    password,
    display_name,
    ...(invite_code ? { invite_code } : {}),
  });
  return res.data;
}

export async function login(email: string, password: string, otp?: string): Promise<AuthResponse> {
  const res = await client.post('/auth/login', { email, password, ...(otp ? { otp } : {}) });
  return res.data;
}

// --- Two-factor auth (TOTP) ---

export async function totpSetup(): Promise<{ secret: string; otpauth_uri: string }> {
  const res = await client.post('/auth/2fa/setup');
  return res.data;
}

export async function totpEnable(code: string): Promise<{ detail: string }> {
  const res = await client.post('/auth/2fa/enable', { code });
  return res.data;
}

export async function totpDisable(opts: { password?: string; code?: string }): Promise<{ detail: string }> {
  const res = await client.post('/auth/2fa/disable', opts);
  return res.data;
}

export async function refreshTokens(refresh_token: string) {
  const res = await client.post('/auth/refresh', { refresh_token });
  return res.data;
}

export async function logout(refresh_token: string) {
  await client.post('/auth/logout', { refresh_token });
}

export async function getMe(): Promise<User> {
  const res = await client.get('/auth/me');
  return res.data;
}

export async function forgotPassword(email: string): Promise<{ detail: string; debug_token?: string }> {
  const res = await client.post('/auth/forgot-password', { email });
  return res.data;
}

export async function resetPassword(token: string, password: string): Promise<{ detail: string }> {
  const res = await client.post('/auth/reset-password', { token, password });
  return res.data;
}

export async function resendVerification(): Promise<{ detail: string; debug_token?: string }> {
  const res = await client.post('/auth/resend-verification');
  return res.data;
}

export async function verifyEmail(token: string): Promise<{ detail: string }> {
  const res = await client.post('/auth/verify-email', { token });
  return res.data;
}

export async function changePassword(
  current_password: string,
  new_password: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await client.post('/auth/change-password', { current_password, new_password });
  return res.data;
}

export async function changeEmail(
  password: string,
  new_email: string,
): Promise<{ detail: string; debug_token?: string }> {
  const res = await client.post('/auth/change-email', { password, new_email });
  return res.data;
}

export async function confirmEmailChange(token: string): Promise<{ detail: string }> {
  const res = await client.post('/auth/confirm-email-change', { token });
  return res.data;
}

export interface UpdateMePayload {
  display_name?: string;
  location_rough?: string | null;
  date_of_birth?: string | null;
  show_adoption_prompt?: boolean;
  species_preference?: 'dog' | 'cat' | 'both';
}

export async function updateMe(body: UpdateMePayload): Promise<User> {
  const res = await client.patch('/users/me', body);
  return res.data;
}

/**
 * Close the caller's account. Deactivates the profile and every pet they own,
 * which is what the privacy policy describes. Irreversible from the user's
 * side: login rejects inactive accounts, so there is no self-serve way back in.
 */
export async function deleteMyAccount(): Promise<{ detail: string }> {
  const res = await client.delete('/users/me');
  return res.data;
}
