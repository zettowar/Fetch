import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExploreSheet from './ExploreSheet';

vi.mock('../api/publicSite', () => ({
  getPublicFlags: () => Promise.resolve({}),
}));

function wrap(open: boolean, onClose: () => void = () => {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <button type="button">Opener</button>
        <ExploreSheet open={open} onClose={onClose} />
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

  // aria-modal is a promise the sheet used to break: focus stayed on the page
  // behind it. These wait for the rAF autofocus first (see Modal.test.tsx),
  // so a trap test can't pass on the autofocus alone.
  it('moves focus into the sheet when it opens', async () => {
    render(wrap(true));
    const dialog = screen.getByRole('dialog', { name: 'Explore' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('keeps Tab inside the sheet', async () => {
    render(wrap(true));
    const dialog = screen.getByRole('dialog', { name: 'Explore' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and hands focus back to what opened it', async () => {
    const onClose = vi.fn();
    const { rerender } = render(wrap(false, onClose));
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();

    rerender(wrap(true, onClose));
    const dialog = screen.getByRole('dialog', { name: 'Explore' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(wrap(false, onClose));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
