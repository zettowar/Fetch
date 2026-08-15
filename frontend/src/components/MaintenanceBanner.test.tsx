import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import client from '../api/client';
import MaintenanceBanner from './MaintenanceBanner';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function renderBanner() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MaintenanceBanner />
    </QueryClientProvider>,
  );
}

/** The container is empty on the very first render, before the query resolves,
 *  so `waitFor(empty)` succeeds instantly no matter what the API returned.
 *  Settle the query first, then assert synchronously. */
async function settleQuery(get: { mock: { calls: unknown[] } }) {
  await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(0));
  // Let react-query commit the resolved value to the component.
  await act(async () => {
    await Promise.resolve();
  });
}

describe('MaintenanceBanner', () => {
  it('shows the admin-set message', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: { banner: 'Down at 9pm' } });
    renderBanner();
    expect(await screen.findByText('Down at 9pm')).toBeInTheDocument();
  });

  it('renders nothing when no banner is set', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ data: { banner: '' } });
    const { container } = renderBanner();
    await settleQuery(get);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when only whitespace is set', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ data: { banner: '   ' } });
    const { container } = renderBanner();
    await settleQuery(get);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays dismissed for the same message', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: { banner: 'Down at 9pm' } });
    const { unmount } = renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: /dismiss/i }));
    await waitFor(() => expect(screen.queryByText('Down at 9pm')).toBeNull());

    unmount();
    renderBanner();
    await waitFor(() => expect(screen.queryByText('Down at 9pm')).toBeNull());
  });

  it('re-appears when the message changes', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: { banner: 'First message' } });
    const { unmount } = renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: /dismiss/i }));
    unmount();

    // A new announcement must not inherit the old dismissal.
    vi.spyOn(client, 'get').mockResolvedValue({ data: { banner: 'Second message' } });
    renderBanner();
    expect(await screen.findByText('Second message')).toBeInTheDocument();
  });

  it('stays silent when the endpoint fails', async () => {
    const get = vi.spyOn(client, 'get').mockRejectedValue(new Error('offline'));
    const { container } = renderBanner();
    await settleQuery(get);
    expect(container).toBeEmptyDOMElement();
  });
});
