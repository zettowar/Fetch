import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { LeaderboardEntry, Pet, PetStats, Species } from '../types';
import { getPetStats } from '../api/rankings';
import BrandIcon from './brand/BrandIcon';
import PetPortrait from './brand/PetPortrait';
import RankMedal from './brand/RankMedal';
import { petHeroPhoto } from '../utils/time';
import { photoIn } from '../utils/photoIn';
import { weeklyResetAt } from '../utils/weeklyReset';

const MAX_PETS = 4;

/** In the deck = at least one approved photo (the feed's own rule). */
function photoState(pet: Pet): 'ok' | 'review' | 'none' {
  if (pet.photos.some((p) => !p.moderation_status || p.moderation_status === 'approved')) return 'ok';
  return pet.photos.length > 0 ? 'review' : 'none';
}

/**
 * The race to the crown: an orange run, the pet's bean on it, and the crown
 * waiting at the finish as a navy line — gold is for the earned. Once it's
 * won the line runs full and the medal beside it wears the crown instead.
 */
function RaceTrack({ pct, won }: { pct: number; won: boolean }) {
  const reduce = useReducedMotion();
  const ease = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay: 0.15 };
  return (
    <div className={`relative mt-2.5 h-2 rounded-full bg-navy/10 dark:bg-white/10 ${won ? 'mr-2' : 'mr-7'}`} aria-hidden>
      <motion.div
        className="h-full rounded-full bg-brand-500"
        initial={reduce ? false : { width: '0%' }}
        animate={{ width: `${pct}%` }}
        transition={ease}
      />
      <motion.span
        className="absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-navy bg-white dark:bg-biscuit"
        initial={reduce ? false : { left: '0%' }}
        animate={{ left: `${pct}%` }}
        transition={ease}
      />
      {!won && (
        <BrandIcon name="crown" size={20} className="absolute -right-7 top-1/2 -translate-y-1/2 text-navy/60 dark:text-biscuit/60" />
      )}
    </div>
  );
}

function Face({ pet }: { pet: Pet }) {
  const photo = petHeroPhoto(pet);
  return (
    <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-navy bg-brand-100 dark:border-white/25 dark:bg-night-raised">
      {photo ? (
        <img ref={photoIn} src={photo} alt="" className="photo-in h-full w-full object-cover" />
      ) : (
        <PetPortrait species={pet.species} breed={pet.breed_display} seed={pet.id} crop="face" background className="h-full w-full" />
      )}
    </span>
  );
}

/**
 * Your pet's week (beyond the brand book, in its spirit: lead with the game).
 * The crown card says who's winning; this says where *yours* stands — the
 * rank, the gap to the crown, and the race in one line. When the pet can't
 * be in the race at all (no approved photo, so not in the deck), it says so
 * and says what to do, rather than showing a rank that will never move.
 */
export default function PetWeekCard({
  pets,
  species,
  board,
}: {
  pets: Pet[];
  species: Species;
  /**
   * The live leaderboard for the species. Its order — ties broken by who got
   * there first, the crown's own rule — decides who is #1; the pet stats only
   * count pets strictly ahead, so two tied leaders would both read "#1".
   */
  board: LeaderboardEntry[];
}) {
  const mine = pets.slice(0, MAX_PETS);
  const results = useQueries({
    queries: mine.map((p) => ({
      queryKey: ['pet-stats', p.id],
      queryFn: () => getPetStats(p.id),
      staleTime: 60_000,
    })),
  });
  if (mine.length === 0 || results.some((r) => r.isLoading)) return null;

  const rows = mine.map((pet, i) => ({ pet, stats: results[i].data as PetStats | undefined }));
  const ranked = rows
    .filter((r) => r.stats?.week_rank != null)
    .sort((a, b) => a.stats!.week_rank! - b.stats!.week_rank!);
  // Best placed first; otherwise the one that needs a hand to get in the deck.
  const featured = ranked[0] ?? rows.find((r) => photoState(r.pet) !== 'ok') ?? rows[0];
  const { pet, stats } = featured;
  const plural = species === 'cat' ? 'cats' : 'dogs';
  const state = photoState(pet);

  const shell =
    'flex items-center gap-3.5 rounded-3xl border-2 border-navy bg-white p-4 text-navy shadow-toy-sm dark:border-white/15 dark:bg-night-surface dark:text-biscuit';

  if (state !== 'ok' && stats?.week_rank == null) {
    return (
      <section className={`${shell} animate-fade-in-up`}>
        <Face pet={pet} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{pet.name}'s week</p>
          <p className="mt-0.5 text-[17px] font-extrabold leading-tight">
            {state === 'review' ? 'Photo in review' : 'Not in the deck yet'}
          </p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
            {state === 'review'
              ? `${pet.name} joins the deck as soon as it's approved.`
              : `Add a photo so people nearby can start rating ${pet.name}.`}
          </p>
          {state === 'none' && (
            <Link to={`/app/pets/${pet.id}`} className="btn btn-secondary btn-sm mt-2.5">
              <BrandIcon name="camera" size={16} />
              Add a photo
            </Link>
          )}
        </div>
      </section>
    );
  }

  const onBoard = board.findIndex((e) => e.pet_id === pet.id);
  // Nothing to go on: this pet's stats request failed and it isn't on the
  // board we have. Saying "No votes yet this week" would be a guess.
  if (!stats && onBoard < 0) return null;

  const rank = onBoard >= 0 ? onBoard + 1 : stats?.week_rank ?? null;
  const score = stats?.week_score ?? board[onBoard]?.score ?? 0;
  // First on the board is not the crown. The crown needs a net-positive score
  // (the tally's `HAVING sum(value) > 0`), and the live board has no such
  // floor — so early in the week, a pet whose only vote was a pass read
  // "Wearing the crown, -1 likes so far" under a hero saying "No winner yet".
  const leading = rank === 1;
  const won = leading && score > 0;
  // Behind the leader, the gap needs the leader's score. With the board still
  // loading (or failed) it used to fall back to this pet's own score, which
  // made every pet "Tied for the lead".
  const leaderScore = leading ? score : board[0]?.score;
  const raceKnown = leaderScore != null;
  const gap = raceKnown ? Math.max(0, leaderScore - score) : 0;
  const pct =
    rank == null || !raceKnown || leaderScore <= 0
      ? 0
      : Math.min(100, Math.max(4, (score / leaderScore) * 100));

  let headline: string;
  let sub: string;
  if (rank == null) {
    headline = 'No votes yet this week';
    sub = `${pet.name} is in the deck. Fresh week, fresh shot.`;
  } else if (won) {
    headline = 'Wearing the crown';
    sub = `${score} ${score === 1 ? 'like' : 'likes'} so far. Hold on until ${weeklyResetAt()}.`;
  } else if (leading) {
    headline = 'Out in front, no crown yet';
    sub = 'A crown takes more likes than passes. One like would do it.';
  } else if (!raceKnown) {
    headline = `#${rank} this week`;
    sub = `${score} ${score === 1 ? 'like' : 'likes'} so far.`;
  } else if (gap === 0) {
    // Level on likes but behind on the tiebreak (earliest votes win), so a
    // rank number here would contradict the headline. Explain it instead.
    headline = 'Tied for the lead';
    sub = 'Ties go to whoever got there first. One more like takes it.';
  } else {
    headline = `${gap} ${gap === 1 ? 'like' : 'likes'} behind the crown`;
    // The rank can come from the live board while this pet's own stats request
    // failed, so the total may be missing. `stats!` here took Home down with it.
    sub = stats?.week_total
      ? `#${rank} of ${stats.week_total} ${plural} this week.`
      : `#${rank} this week.`;
  }

  return (
    <Link
      to={`/app/rankings?species=${species}`}
      aria-label={`${pet.name}'s week: ${headline}. ${sub}`}
      className={`${shell} animate-fade-in-up transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none`}
    >
      <Face pet={pet} />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{pet.name}'s week</p>
        <p className="mt-0.5 text-[17px] font-extrabold leading-tight">{headline}</p>
        {rank != null && raceKnown && <RaceTrack pct={pct} won={won} />}
        <p className="mt-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{sub}</p>
      </div>
      {rank != null && (won || (raceKnown && gap > 0)) && <RankMedal rank={rank} size="lg" className={won ? 'mt-2' : ''} />}
    </Link>
  );
}
