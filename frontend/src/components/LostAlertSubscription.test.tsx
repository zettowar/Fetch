import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import client from '../api/client';
import LostAlertSubscription from './LostAlertSubscription';

afterEach(() => vi.restoreAllMocks());

// [lng, lat] — the map's order, which is the trap this component has to get
// right when mapping onto the API's home_lat/home_lng.
const CENTER: [number, number] = [-79.38, 43.65];

function renderIt() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <LostAlertSubscription center={CENTER} />
    </QueryClientProvider>,
  );
}

describe('LostAlertSubscription', () => {
  it('offers set-up when there is no subscription', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: null });
    renderIt();
    expect(await screen.findByText(/get emailed when a pet goes missing/i)).toBeInTheDocument();
  });

  it('subscribes with the viewed centre and chosen radius', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: null });
    const post = vi.spyOn(client, 'post').mockResolvedValue({
      data: { id: 's1', enabled: true, radius_km: 25 },
    });

    renderIt();
    fireEvent.click(await screen.findByText(/get emailed when a pet goes missing/i));
    fireEvent.click(screen.getByRole('button', { name: '25 km' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/lost/subscriptions', {
      home_lat: 43.65,
      home_lng: -79.38,
      radius_km: 25,
    });
  });

  it('shows the active radius and can pause', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { id: 's1', enabled: true, radius_km: 10 },
    });
    const patch = vi.spyOn(client, 'patch').mockResolvedValue({
      data: { id: 's1', enabled: false, radius_km: 10 },
    });

    renderIt();
    expect(await screen.findByText(/within 10 km/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(
      '/lost/subscriptions/mine', { enabled: false },
    ));
  });

  it('offers resume when paused', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { id: 's1', enabled: false, radius_km: 10 },
    });
    renderIt();
    expect(await screen.findByText(/alerts are paused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });
});
