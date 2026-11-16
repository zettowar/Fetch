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
  it('signs out when another tab removes the shared session', async () => {
    // "Log out" in one tab used to leave every other tab signed in, and they
    // would write a live token back to storage on their next refresh.
    localStorage.setItem('refresh_token', 'old-refresh');
    vi.spyOn(authApi, 'refreshTokens').mockResolvedValue({
      tokens: { access_token: 'a', refresh_token: 'r' },
    });
    vi.spyOn(authApi, 'getMe').mockResolvedValue({ id: 'u1', email: 'me@x.com' } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('true'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'refresh_token', oldValue: 'r', newValue: null }),
      );
    });
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('false'));
  });

  it('keeps the winner\'s token when two tabs boot on the same one', async () => {
    // Both tabs read T; the other tab's refresh won and stored T2. Our 401 is
    // for a spent token, not an ended session.
    localStorage.setItem('refresh_token', 'T');
    const refresh = vi.spyOn(authApi, 'refreshTokens').mockImplementation(async (token: string) => {
      if (token === 'T') {
        localStorage.setItem('refresh_token', 'T2'); // the other tab got there first
        throw Object.assign(new Error('spent'), { response: { status: 401 } });
      }
      return { tokens: { access_token: 'a3', refresh_token: 'T3' } };
    });
    vi.spyOn(authApi, 'getMe').mockResolvedValue({ id: 'u1', email: 'me@x.com' } as never);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(refresh).toHaveBeenCalledWith('T2');
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(localStorage.getItem('refresh_token')).toBe('T3');
  });

  it('boots signed out, not crashed, when storage is blocked', async () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('auth').textContent).toBe('false');
    blocked.mockRestore();
  });
});
