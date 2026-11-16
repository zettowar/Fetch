import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PetWeekCard from './PetWeekCard';
import * as rankingsApi from '../api/rankings';
import type { LeaderboardEntry, Pet, PetStats } from '../types';

const APPROVED = [{ id: 'ph', storage_key: 'k', width: 1, height: 1, content_type: 'image/jpeg', sort_order: 0, created_at: '', moderation_status: 'approved' }];

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'luna', owner_id: 'me', name: 'Luna', species: 'dog', mix_type: 'mystery_mutt', breeds: [],
    breed_display: 'Mystery mutt', birthday: null, bio: null, location_rough: null, traits: [],
    primary_photo_id: null, primary_photo_url: null, is_active: true, is_public: true,
    created_at: '', photos: APPROVED, adoptable: false, adopted_at: null, rescue_name: null, rescue_id: null,
    ...over,
  } as Pet;
}

function stats(over: Partial<PetStats> = {}): PetStats {
  return { likes: 0, passes: 0, week_score: null, week_rank: null, week_total: 5, crown_weeks: [], ...over } as PetStats;
}

const entry = (pet_id: string, score: number): LeaderboardEntry =>
  ({ rank: 0, pet_id, pet_name: pet_id, species: 'dog', breed: null, score, total_votes: score });

async function show(p: Pet, s: PetStats, board: LeaderboardEntry[]) {
  vi.spyOn(rankingsApi, 'getPetStats').mockResolvedValue(s);
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PetWeekCard pets={[p]} species="dog" board={board} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return screen.findByText("Luna's week");
}

afterEach(() => vi.restoreAllMocks());

describe('PetWeekCard', () => {
  it('says how far behind the crown, with the rank', async () => {
    await show(pet(), stats({ week_score: 3, week_rank: 2 }), [entry('pete', 7), entry('luna', 3)]);
    expect(screen.getByText('4 likes behind the crown')).toBeInTheDocument();
    expect(screen.getByText('#2 of 5 dogs this week.')).toBeInTheDocument();
    expect(screen.getByLabelText('Rank 2')).toBeInTheDocument();
  });

  it('crowns the board leader — the tiebreak decides, not the raw count', async () => {
    await show(pet(), stats({ week_score: 4, week_rank: 1 }), [entry('luna', 4), entry('pete', 4)]);
    expect(screen.getByText('Wearing the crown')).toBeInTheDocument();
  });

  it('explains a tie it is losing on the tiebreak, without a contradicting rank', async () => {
    // Stats count only pets strictly ahead, so this tied pet reads "#1" there.
    await show(pet(), stats({ week_score: 4, week_rank: 1 }), [entry('pete', 4), entry('luna', 4)]);
    expect(screen.getByText('Tied for the lead')).toBeInTheDocument();
    expect(screen.queryByText('Wearing the crown')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Rank /)).not.toBeInTheDocument();
  });

  it('is honest about a pet that is not in the deck, and says how to fix it', async () => {
    await show(pet({ photos: [] }), stats(), [entry('pete', 2)]);
    expect(screen.getByText('Not in the deck yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add a photo/i })).toHaveAttribute('href', '/app/pets/luna');
  });

  it('waits out a photo in review rather than asking for another', async () => {
    await show(pet({ photos: [{ ...APPROVED[0], moderation_status: 'flagged' }] }), stats(), []);
    expect(screen.getByText('Photo in review')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add a photo/i })).not.toBeInTheDocument();
  });

  it('a pet in the deck with no votes yet gets a fresh-week line, not a rank', async () => {
    await show(pet(), stats(), [entry('pete', 2)]);
    expect(screen.getByText('No votes yet this week')).toBeInTheDocument();
  });
  it('does not crown a leader whose score is not net-positive', async () => {
    // The crown needs more likes than passes; the live board has no such floor.
    await show(pet(), stats({ week_score: -1, week_rank: 1 }), [entry('luna', -1)]);
    expect(screen.getByText('Out in front, no crown yet')).toBeInTheDocument();
    expect(screen.queryByText('Wearing the crown')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Rank /)).not.toBeInTheDocument();
  });

  it('does not invent a tie when the board has not loaded', async () => {
    // Stats say #3; with no board there is no leader to measure against.
    await show(pet(), stats({ week_score: 2, week_rank: 3 }), []);
    expect(screen.getByText('#3 this week')).toBeInTheDocument();
    expect(screen.queryByText('Tied for the lead')).not.toBeInTheDocument();
  });

  it('survives a failed stats request for a pet that is on the board', async () => {
    // `stats!.week_total` here used to throw and take Home down with it.
    vi.spyOn(rankingsApi, 'getPetStats').mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <PetWeekCard pets={[pet()]} species="dog" board={[entry('pete', 7), entry('luna', 3)]} />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('4 likes behind the crown')).toBeInTheDocument();
    expect(screen.getByText('#2 this week.')).toBeInTheDocument();
  });
});
