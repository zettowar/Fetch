import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SwipeDeck from './SwipeDeck';
import * as feedApi from '../api/feed';
import * as votesApi from '../api/votes';
import { AuthProvider } from '../store/AuthContext';

// react-hot-toast paints a portal that we don't care about; stub it.
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

function makeDog(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Pet ${id}`,
    mix_type: 'mystery_mutt',
    breeds: [],
    breed_display: 'Mystery mutt',
    bio: null,
    location_rough: null,
    photos: [],
    primary_photo_id: null,
    traits: [],
    is_active: true,
    owner_id: 'owner',
    adoptable: false,
    rescue_name: null,
    rescue_id: null,
    adopted_at: null,
    created_at: '2026-04-30T00:00:00Z',
    ...overrides,
  };
}

function renderDeck() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <SwipeDeck />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SwipeDeck', () => {
  it('right-swipe casts a +1 vote and advances past the top card', async () => {
    const pets = [makeDog('d1'), makeDog('d2'), makeDog('d3')];
    vi.spyOn(feedApi, 'getFeed').mockResolvedValue(pets as never);
    const cast = vi.spyOn(votesApi, 'castVote').mockResolvedValue({} as never);

    renderDeck();
    const like = await screen.findByLabelText('Like');
    fireEvent.click(like);

    await waitFor(() => expect(cast).toHaveBeenCalledWith('d1', 1));
    expect(screen.getByText(/1 rated this session/)).toBeInTheDocument();
  });

  it('left-swipe casts a -1 vote', async () => {
    const pets = [makeDog('d1'), makeDog('d2')];
    vi.spyOn(feedApi, 'getFeed').mockResolvedValue(pets as never);
    const cast = vi.spyOn(votesApi, 'castVote').mockResolvedValue({} as never);

    renderDeck();
    const pass = await screen.findByLabelText('Pass');
    fireEvent.click(pass);

    await waitFor(() => expect(cast).toHaveBeenCalledWith('d1', -1));
  });

  it('renders the empty state when the feed has no pets', async () => {
    vi.spyOn(feedApi, 'getFeed').mockResolvedValue([] as never);

    renderDeck();
    expect(
      await screen.findByText(/rated everyone this week/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Like')).toBeNull();
  });

  it('rolls back the index when the vote mutation rejects', async () => {
    const pets = [makeDog('d1'), makeDog('d2')];
    vi.spyOn(feedApi, 'getFeed').mockResolvedValue(pets as never);
    vi.spyOn(votesApi, 'castVote').mockRejectedValue(new Error('500'));

    renderDeck();
    const like = await screen.findByLabelText('Like');
    fireEvent.click(like);

    // After the rejection settles, the rated counter should reset to 0
    // (so the user can retry the same card).
    await waitFor(() =>
      expect(screen.queryByText(/1 rated this session/)).toBeNull(),
    );
  });

  it('shows an error state when the feed query fails', async () => {
    vi.spyOn(feedApi, 'getFeed').mockRejectedValue(new Error('boom'));
    renderDeck();
    expect(await screen.findByText(/Couldn't load the feed/i)).toBeInTheDocument();
  });

  it('restarts from the top when a refill replaces the deck', async () => {
    const first = [makeDog('d1'), makeDog('d2'), makeDog('d3')];
    const refill = [makeDog('d4'), makeDog('d5'), makeDog('d6')];
    vi.spyOn(feedApi, 'getFeed')
      .mockResolvedValueOnce(first as never)
      .mockResolvedValue(refill as never);
    const cast = vi.spyOn(votesApi, 'castVote').mockResolvedValue({} as never);

    renderDeck();
    const like = await screen.findByLabelText('Like');
    fireEvent.click(like);
    fireEvent.click(like);
    fireEvent.click(like);
    await waitFor(() => expect(cast).toHaveBeenCalledTimes(3));

    // The refill returned a brand-new batch: the deck should show its first
    // card instead of the premature end state.
    expect(await screen.findByText('Pet d4')).toBeInTheDocument();
    expect(screen.queryByText(/rated everyone this week/i)).toBeNull();
  });
});
