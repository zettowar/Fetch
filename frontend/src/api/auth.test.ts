import { afterEach, describe, expect, it, vi } from 'vitest';
import client from './client';
import {
  forgotPassword,
  getMe,
  login,
  logout,
  refreshTokens,
  resendVerification,
  resetPassword,
  signup,
  updateMe,
  verifyEmail,
} from './auth';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('auth api', () => {
  it('signup posts to /auth/signup with the request body', async () => {
    const post = vi
      .spyOn(client, 'post')
      .mockResolvedValue({ data: { user: { id: 'u1' }, tokens: { access_token: 'a', refresh_token: 'r' } } });

    const result = await signup('a@b.com', 'pw', 'Display');

    expect(post).toHaveBeenCalledWith('/auth/signup', {
      email: 'a@b.com',
      password: 'pw',
      display_name: 'Display',
    });
    expect(result.user.id).toBe('u1');
  });

  it('login posts credentials and returns the auth payload', async () => {
    const post = vi
      .spyOn(client, 'post')
      .mockResolvedValue({ data: { user: { id: 'u2' }, tokens: { access_token: 'aa', refresh_token: 'rr' } } });

    const result = await login('a@b.com', 'pw');

    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pw' });
    expect(result.tokens.access_token).toBe('aa');
  });

  it('refreshTokens posts the refresh token', async () => {
    const post = vi
      .spyOn(client, 'post')
      .mockResolvedValue({ data: { tokens: { access_token: 'new-a', refresh_token: 'new-r' } } });

    const result = await refreshTokens('old-r');

    expect(post).toHaveBeenCalledWith('/auth/refresh', { refresh_token: 'old-r' });
    expect(result.tokens.access_token).toBe('new-a');
  });

  it('logout posts the refresh token to /auth/logout', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: {} });
    await logout('r');
    expect(post).toHaveBeenCalledWith('/auth/logout', { refresh_token: 'r' });
  });

  it('getMe issues GET /auth/me', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ data: { id: 'u3', email: 'x@y.com' } });
    const me = await getMe();
    expect(get).toHaveBeenCalledWith('/auth/me');
    expect(me.id).toBe('u3');
  });

  it('forgotPassword + resetPassword + resendVerification + verifyEmail use the right URLs', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { detail: 'ok' } });
    await forgotPassword('a@b.com');
    await resetPassword('tok', 'newpw');
    await resendVerification();
    await verifyEmail('vt');
    expect(post).toHaveBeenNthCalledWith(1, '/auth/forgot-password', { email: 'a@b.com' });
    expect(post).toHaveBeenNthCalledWith(2, '/auth/reset-password', { token: 'tok', password: 'newpw' });
    expect(post).toHaveBeenNthCalledWith(3, '/auth/resend-verification');
    expect(post).toHaveBeenNthCalledWith(4, '/auth/verify-email', { token: 'vt' });
  });

  it('updateMe PATCHes /users/me', async () => {
    const patch = vi.spyOn(client, 'patch').mockResolvedValue({ data: { id: 'u', display_name: 'X' } });
    const result = await updateMe({ display_name: 'X' });
    expect(patch).toHaveBeenCalledWith('/users/me', { display_name: 'X' });
    expect(result.display_name).toBe('X');
  });

  it('rejects when the underlying request fails', async () => {
    vi.spyOn(client, 'post').mockRejectedValue(new Error('500 Internal'));
    await expect(login('x@y.com', 'pw')).rejects.toThrow('500 Internal');
  });
});
