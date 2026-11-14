import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import * as authApi from '../api/auth';

function Probe() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="auth">{String(isAuthenticated)}</div>
      <div data-testid="user">{user?.email ?? ''}</div>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthContext', () => {
  it('lands unauthenticated when no refresh token is stored', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });

  it('hydrates from a stored refresh token by refreshing then loading the user', async () => {
    localStorage.setItem('refresh_token', 'old-refresh');
    const refresh = vi.spyOn(authApi, 'refreshTokens').mockResolvedValue({
      tokens: { access_token: 'new-a', refresh_token: 'new-r' },
    });
    const me = vi
      .spyOn(authApi, 'getMe')
      .mockResolvedValue({ id: 'u1', email: 'me@x.com' } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(refresh).toHaveBeenCalledWith('old-refresh');
    expect(me).toHaveBeenCalled();
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('me@x.com');
    expect(localStorage.getItem('refresh_token')).toBe('new-r');
  });

  it('clears the stored token when the server rejects it', async () => {
    localStorage.setItem('refresh_token', 'bad');
    vi.spyOn(authApi, 'refreshTokens').mockRejectedValue(
      Object.assign(new Error('expired'), { response: { status: 401 } }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('keeps the stored token when the refresh merely could not be reached', async () => {
    // Offline, or a 502 while a deploy restarts the API: no verdict on the
    // session, so the next load must be able to try again.
    for (const failure of [
      new Error('Network Error'),
      Object.assign(new Error('bad gateway'), { response: { status: 502 } }),
      Object.assign(new Error('slow down'), { response: { status: 429 } }),
    ]) {
      localStorage.setItem('refresh_token', 'still-good');
      vi.spyOn(authApi, 'refreshTokens').mockRejectedValue(failure);

      const { unmount } = render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );

      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      expect(screen.getByTestId('auth').textContent).toBe('false');
      expect(localStorage.getItem('refresh_token')).toBe('still-good');
      unmount();
    }
  });

  it('logout clears the user and the stored refresh token', async () => {
    localStorage.setItem('refresh_token', 'r');
    vi.spyOn(authApi, 'refreshTokens').mockResolvedValue({
      tokens: { access_token: 'a', refresh_token: 'r2' },
    });
    vi.spyOn(authApi, 'getMe').mockResolvedValue({ id: 'u1', email: 'me@x.com' } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('true'));

    act(() => {
      screen.getByText('Sign out').click();
    });

    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});
