import client from './client';
import type { AuthResponse, User } from '../types';

export async function signup(
  email: string,
  password: string,
  display_name: string,
): Promise<AuthResponse> {
  const res = await client.post('/auth/signup', { email, password, display_name });
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await client.post('/auth/login', { email, password });
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
