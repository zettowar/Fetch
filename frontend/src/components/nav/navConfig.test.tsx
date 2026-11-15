import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { isWithin, primaryNav, useActiveNavPath, EXPLORE_SHEET } from './navConfig';
import type { User } from '../../types';

const user = (role: string): User =>
  ({ id: 'u1', role, display_name: 'Test', species_preference: 'dog' }) as User;

function activeAt(pathname: string, role = 'user') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );
  return renderHook(() => useActiveNavPath(primaryNav(user(role))), { wrapper }).result.current;
}

describe('isWithin', () => {
  it('matches the path and its subpages, not a sibling that shares a prefix', () => {
    expect(isWithin('/app/rescues', '/app/rescues')).toBe(true);
    expect(isWithin('/app/rescues/browse', '/app/rescues')).toBe(true);
    expect(isWithin('/app/rescues-x', '/app/rescues')).toBe(false);
    expect(isWithin('/app/donations', '/app/donate')).toBe(false);
  });
});

describe('primaryNav', () => {
  it('gives rescue accounts their own items, with no Swipe or Explore', () => {
    const paths = primaryNav(user('rescue')).map((i) => i.path);
    expect(paths).toContain('/app/rescue/dashboard');
    expect(paths).toContain('/app/users/u1');
    expect(paths).not.toContain('/app/swipe');
    expect(paths).not.toContain(EXPLORE_SHEET);
  });
});

describe('useActiveNavPath', () => {
  it('keeps a tab lit on its subpages', () => {
    expect(activeAt('/app/lost/42')).toBe('/app/lost');
    expect(activeAt('/app/rescues/map')).toBe('/app/rescues');
  });

  it('lights Explore for every Explore destination', () => {
    for (const p of ['/app/parks/1', '/app/vets', '/app/shop', '/app/community', '/app/donate', '/app/explore']) {
      expect(activeAt(p)).toBe(EXPLORE_SHEET);
    }
  });

  it('lights nothing on a page outside the bar', () => {
    expect(activeAt('/app/security')).toBeUndefined();
  });
});
