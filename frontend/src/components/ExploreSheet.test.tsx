import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExploreSheet from './ExploreSheet';

vi.mock('../api/publicSite', () => ({
  getPublicFlags: () => Promise.resolve({}),
}));

function wrap(open: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ExploreSheet open={open} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Note on what is NOT covered here.
 *
 * The bug that prompted these tests is that AnimatePresence never unmounted the
 * sheet and its backdrop once `open` went false. That cannot be reproduced
 * under jsdom: framer-motion settles animations immediately without a real
 * frame loop, so AnimatePresence tears the children down straight away and a
 * removal assertion passes against the broken and the fixed component alike. I
 * wrote that assertion, watched it pass on both, and deleted it rather than
 * leave a test that can only ever agree with whatever it is pointed at.
 *
 * The invariant it would have guarded is stated in ExploreSheet itself: the
 * children of AnimatePresence must be keyed elements, never a Fragment.
 * Verifying it needs a browser with a live frame loop.
 */
describe('ExploreSheet', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders nothing while closed', () => {
    render(wrap(false));
    expect(screen.queryByRole('dialog', { name: 'Explore' })).toBeNull();
  });

  it('renders the sheet and a backdrop when open', () => {
    const { container } = render(wrap(true));
    expect(screen.getByRole('dialog', { name: 'Explore' })).toBeTruthy();
    expect(container.querySelector('.fixed.inset-0')).toBeTruthy();
  });

  it('offers every enabled destination as a link', () => {
    render(wrap(true));
    const community = screen.getByRole('link', { name: /Community/ });
    expect(community.getAttribute('href')).toBe('/app/community');
  });

  it('restores body scrolling after closing', async () => {
    const { rerender } = render(wrap(true));
    expect(document.body.style.overflow).toBe('hidden');

    rerender(wrap(false));
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });
});
