import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Check, ChevronRight } from 'lucide-react';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';
import { Crown } from '../components/brand/RankMedal';
import SpeciesTabs from '../components/SpeciesTabs';
import { getCurrentWinner } from '../api/rankings';
import { useSpeciesFilter } from '../hooks/useSpeciesFilter';
import type { WeeklyWinner, Species } from '../types';
import { getMyFollows } from '../api/social';
import { getMyPets } from '../api/pets';
import { listMyTransfers } from '../api/petTransfers';
import { getNearbyReports } from '../api/lost';
import { getDonationConfig } from '../api/donations';
import { useAuth } from '../store/AuthContext';
import { petHeroPhoto } from '../utils/time';
import { useWeeklyResetCountdown, nextWeeklyReset } from '../utils/weeklyReset';
import { onboarding } from '../utils/onboarding';
import { useSwipeQuota } from '../utils/swipeQuota';
import { useSubscription } from '../utils/useSubscription';
import { DEFAULT_MAP_CENTER, useUserLocation } from '../utils/useUserLocation';
import { useSectionOpen } from '../hooks/usePublicFlags';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const MAX_STRIP_AVATARS = 8;

function weekdayLine(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long' });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Staggered entrance for the card stack (pair with `animate-fade-in-up`);
// backwards fill keeps delayed cards invisible until their turn.
function stagger(step: number) {
  return { animationDelay: `${step * 70}ms`, animationFillMode: 'backwards' as const };
}

/**
 * This week's crown for one species (Brand Book, The app → Home). The crown
 * comes first: a Crown Gold card — gold appears once, on the card it was
 * earned for — with the winner in a gold-ringed circle wearing the crown,
 * the name in Bagel Fat One, and the countdown and Rankings link underneath.
 */
function CrownHero({
  species,
  winner,
  resetsIn,
  failed = false,
}: {
  species: Species;
  winner: WeeklyWinner | null;
  resetsIn: string;
  /** The winner request failed: say so instead of claiming there is none. */
  failed?: boolean;
}) {
  const label = species === 'cat' ? "This week's Top Cat" : "This week's Top Dog";
  return (
    <Link
      to={`/app/rankings?species=${species}`}
      className="group block rounded-3xl border-[2.5px] border-navy bg-gold-100 px-4 pt-4 pb-3 text-navy shadow-toy transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-gold-500 dark:bg-night-surface dark:text-biscuit dark:shadow-none"
    >
      <p className="eyebrow text-center !text-navy/80 dark:!text-gold-300">{label}</p>
      <div className="mt-9 flex flex-col items-center text-center">
        <span className="relative inline-flex">
          <span className="block h-[88px] w-[88px] overflow-hidden rounded-full border-[2.5px] border-navy ring-4 ring-gold-500 bg-white">
            {winner?.primary_photo_url ? (
              <img
                src={winner.primary_photo_url}
                alt={winner.pet_name || 'Weekly winner'}
                className="h-full w-full object-cover"
              />
            ) : winner ? (
              <PetPortrait species={species} breed={winner.breed} seed={winner.pet_id} crop="face" background className="h-full w-full" />
            ) : (
              <PetPortrait species={species} seed="no-winner" crop="face" className="h-full w-full opacity-30 grayscale" />
            )}
          </span>
          <Crown className="absolute -top-[30px] left-1/2 w-11 -translate-x-1/2 -rotate-6 animate-crown-drop" />
        </span>
        {winner ? (
          <>
            <p className="mt-3 font-display text-[32px] leading-none">{winner.pet_name}</p>
            <p className="mt-1 text-sm font-semibold text-navy/70 dark:text-gray-300">
              {winner.breed ? `${winner.breed} · ` : ''}
              {winner.score} {winner.score === 1 ? 'like' : 'likes'}
            </p>
          </>
        ) : failed ? (
          <>
            <p className="mt-3 text-lg font-extrabold leading-tight">The crown didn't load</p>
            <p className="mt-1 text-sm font-semibold text-navy/70 dark:text-gray-300">Open Rankings, or try again in a moment.</p>
          </>
        ) : (
          <>
            <p className="mt-3 font-display text-[26px] leading-none">No winner yet</p>
            <p className="mt-1 text-sm font-semibold text-navy/70 dark:text-gray-300">The crown is up for grabs.</p>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t-[1.5px] border-dashed border-navy/25 pt-2.5 text-xs font-semibold dark:border-white/20">
        <span className="inline-flex items-center gap-1.5" title={`Winner announced ${nextWeeklyReset().toLocaleString()}`}>
          <BrandIcon name="clock" size={15} />
          Results in {resetsIn}
        </span>
        <span className="font-extrabold transition-transform group-hover:translate-x-0.5">Rankings →</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  useDocumentTitle('Home · Fetchpawz');
  const { user } = useAuth();
  // Rescues are distinct content-producer accounts — they don't get the
  // consumer home. Skip the consumer queries and send them to their dashboard.
  const isRescue = user?.role === 'rescue';
  const [speciesFilter] = useSpeciesFilter();
  // Home shows exactly one species — no "All"/dual-crown view. A "both" user
  // gets a Dogs/Cats toggle (the shared filter, with a mixed value read as dog);
  // a single-species preference locks Home to that species and hides the switch.
  const speciesPref = user?.species_preference ?? 'both';
  const homeSpecies: Species =
    speciesPref === 'both'
      ? speciesFilter === 'cat' ? 'cat' : 'dog'
      : speciesPref;
  const { data: dogWinner, isError: dogWinnerFailed } = useQuery({
    queryKey: ['weekly-winner', 'dog'],
    queryFn: () => getCurrentWinner('dog'),
    enabled: !isRescue,
  });
  const { data: catWinner, isError: catWinnerFailed } = useQuery({
    queryKey: ['weekly-winner', 'cat'],
    queryFn: () => getCurrentWinner('cat'),
    enabled: !isRescue,
  });
  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows'],
    queryFn: getMyFollows,
    enabled: !isRescue,
  });
  const { data: myDogs = [], isLoading: dogsLoading } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
    enabled: !isRescue,
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ['my-transfers'],
    queryFn: listMyTransfers,
    enabled: !isRescue,
  });
  const pendingTransfers = transfers.filter((t) => t.status === 'pending');
  const resetsIn = useWeeklyResetCountdown();

  // Live bits for the CTA cards: swipes left today + missing pets nearby.
  const { isSubscriber } = useSubscription();
  const homeQuota = useSwipeQuota(Boolean(user) && !isRescue && !isSubscriber);
  const swipesLeft = user && !isRescue ? homeQuota.remaining : 0;
  const [lng, lat] = useUserLocation(DEFAULT_MAP_CENTER);
  const { data: nearbyLost = [] } = useQuery({
    queryKey: ['nearby-lost-count', lat.toFixed(2), lng.toFixed(2)],
    queryFn: () => getNearbyReports(lat, lng, 25, 'missing'),
    enabled: !isRescue,
    staleTime: 5 * 60_000,
  });
  const missingNearby = nearbyLost.filter((r) => r.status === 'open').length;
  // Both destinations sit behind Explore flags (FlagGate on the routes), so
  // the links below follow the same switches instead of opening "Coming soon".
  const donateOpen = useSectionOpen('explore_donate_enabled');
  const packOpen = useSectionOpen('explore_pack_enabled');
  const { data: donationConfig } = useQuery({
    queryKey: ['donation-config'],
    queryFn: getDonationConfig,
    enabled: !isRescue && donateOpen,
    staleTime: 5 * 60_000,
  });

  const followedDogs = follows.map((f) => f.pet).filter((d) => !!d);
  const stripDogs = followedDogs.slice(0, MAX_STRIP_AVATARS);
  const hasMore = followedDogs.length > MAX_STRIP_AVATARS;

  // First-run checklist. The customer asked specifically to surface "add your
  // pet" when the user owns none, so step 1 is the gate: once they have a pet
  // the card disappears. Swipe/follow are shown as the path that follows.
  const [dismissed, setDismissed] = useState(() =>
    user ? onboarding.isDismissed(user.id) : false,
  );
  const steps: { key: string; label: string; to: string; done: boolean }[] = [
    { key: 'pet', label: 'Add your pet', to: '/app/pets/new', done: myDogs.length > 0 },
    { key: 'swipe', label: 'Rate some pets', to: '/app/swipe', done: user ? onboarding.hasSwiped(user.id) : false },
    // Explore's pet grid is the natural place to find one; with it switched
    // off, the leaderboard is the next-best list of pets to open and follow.
    { key: 'follow', label: 'Follow a pet you like', to: packOpen ? '/app/explore' : '/app/rankings', done: followedDogs.length > 0 },
  ];
  const showOnboarding =
    !!user && !dismissed && !dogsLoading && myDogs.length === 0;
  const handleDismiss = () => {
    if (user) onboarding.dismiss(user.id);
    setDismissed(true);
  };

  if (isRescue) {
    return <Navigate to="/app/rescue/dashboard" replace />;
  }

  return (
    <div className="flex flex-col">
      <div className="p-4 pt-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 animate-fade-in-up" style={stagger(0)}>
          <div className="min-w-0">
            <p className="eyebrow">{weekdayLine()}</p>
            <h1 className="mt-1.5 text-[26px] leading-none text-navy dark:text-biscuit text-balance">
              {greeting()}
              {user ? `, ${user.display_name}` : ''}
            </h1>
          </div>
          {/* Species switch only for "both" users — Dogs/Cats, no "All". */}
          {speciesPref === 'both' && <SpeciesTabs hideAll />}
        </div>

        {/* Hero: this week's crown for the home species (single species, no dual view) */}
        <CrownHero
          species={homeSpecies}
          winner={(homeSpecies === 'cat' ? catWinner : dogWinner) ?? null}
          resetsIn={resetsIn}
          failed={homeSpecies === 'cat' ? catWinnerFailed : dogWinnerFailed}
        />

        {/* Pending pet transfers — only shown when an invitation is waiting */}
        {pendingTransfers.length > 0 && (
          <Link
            to="/app/transfers"
            className="flex items-center justify-between gap-3 p-3 bg-brand-100 dark:bg-brand-500/15 border-2 border-navy dark:border-brand-400/50 rounded-2xl transition-transform duration-150 ease-soft-out hover:-translate-y-px active:translate-y-[2px]"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full border-2 border-navy bg-white text-navy dark:bg-night-surface dark:text-biscuit" aria-hidden>
                <ArrowLeftRight size={18} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-navy dark:text-biscuit">
                  {pendingTransfers.length === 1
                    ? 'A pet transfer is waiting for you'
                    : `${pendingTransfers.length} pet transfers are waiting for you`}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">Review the invitation to take ownership.</p>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden className="text-navy dark:text-biscuit" />
          </Link>
        )}

        {/* First-run checklist — shown until the user adds their first pet */}
        {showOnboarding && (
          <section className="surface relative overflow-hidden p-4 animate-fade-in-up">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="btn-icon absolute right-3 top-3 h-8 w-8"
            >
              <BrandIcon name="close" size={16} />
            </button>
            <p className="pr-10 font-display text-2xl leading-none text-navy dark:text-biscuit">
              Join the pack
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">
              Add your pet to get rated, climb the rankings, and follow other pets.
            </p>
            <ol className="mt-3 flex flex-col gap-1.5">
              {steps.map((step, i) => {
                const isNext = !step.done && steps.slice(0, i).every((s) => s.done);
                const row = (
                  <>
                    <span
                      className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        step.done
                          ? 'border-2 border-navy bg-green-500 text-navy'
                          : isNext
                            ? 'border-2 border-navy bg-brand-500 text-navy'
                            : 'border-2 border-navy/25 bg-white text-gray-500 dark:border-white/20 dark:bg-night-raised dark:text-gray-400'
                      }`}
                      aria-hidden
                    >
                      {step.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        step.done
                          ? 'font-semibold text-gray-500 line-through dark:text-gray-400'
                          : isNext
                            ? 'font-extrabold text-navy dark:text-biscuit'
                            : 'font-semibold text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isNext && (
                      <ArrowRight size={16} aria-hidden className="ml-auto text-navy dark:text-biscuit" />
                    )}
                  </>
                );
                return (
                  <li key={step.key}>
                    {step.done ? (
                      <div className="flex items-center gap-2.5 py-1">{row}</div>
                    ) : (
                      <Link
                        to={step.to}
                        className="flex items-center gap-2.5 py-1 rounded-lg active:scale-[0.99] transition-transform"
                      >
                        {row}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Primary CTA — the one big card; carries a live swipes-left line.
            The next swipe comes second: a Ball Orange card, navy ink. */}
        <Link
          to="/app/swipe"
          style={stagger(1)}
          className="group flex items-center justify-between gap-3 rounded-3xl border-[2.5px] border-navy bg-brand-500 p-4 text-navy shadow-toy transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none animate-fade-in-up dark:border-brand-500"
        >
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">Ready to swipe?</p>
            <p className="mt-0.5 text-sm font-semibold">
              {isSubscriber
                ? 'Unlimited swipes, fresh pets waiting'
                : swipesLeft > 0
                  ? `${swipesLeft} swipes left today`
                  : 'Out of swipes. They reset tomorrow.'}
            </p>
          </div>
          <span className="btn btn-secondary btn-sm shrink-0 pointer-events-none">
            <BrandIcon name="like" size={16} className="animate-heartbeat" />
            Rate pets
          </span>
        </Link>

        {/* Rescues + Lost & Found — compact half-width pair under the hero CTA.
            White tiles: pink is the rescue's bean, and a lost pet is never red. */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={stagger(2)}>
          <Link
            to="/app/rescues"
            className="flex flex-col gap-1 rounded-2xl border-2 border-navy bg-white p-3.5 text-navy shadow-toy-sm transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-white/15 dark:bg-night-surface dark:text-biscuit"
          >
            <BrandIcon name="rescue" size={24} className="mb-1" />
            <p className="text-sm font-extrabold">Rescues</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Meet adoptable pets</p>
          </Link>

          <Link
            to="/app/lost"
            className="flex flex-col gap-1 rounded-2xl border-2 border-navy bg-white p-3.5 text-navy shadow-toy-sm transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-white/15 dark:bg-night-surface dark:text-biscuit"
          >
            <BrandIcon name="lost" size={24} className="mb-1" />
            <p className="text-sm font-extrabold">Lost &amp; Found</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {missingNearby > 0 ? `${missingNearby} missing nearby` : 'Help bring them home'}
            </p>
          </Link>
        </div>

        {/* Donations — compact row, only when Stripe is configured */}
        {donateOpen && donationConfig?.enabled && (
          <Link
            to="/app/donate"
            style={stagger(3)}
            className="surface flex items-center justify-between gap-3 p-3 transition-colors hover:border-navy/40 animate-fade-in-up dark:hover:border-white/30"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-brand-100 text-navy dark:bg-brand-500/20 dark:text-biscuit" aria-hidden>
                <BrandIcon name="donate" size={20} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-navy dark:text-biscuit">Donate</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Every bone counts. Support rescues and keep Fetchpawz running.
                </p>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden className="text-navy dark:text-biscuit" />
          </Link>
        )}

        {/* Following — strip when the user follows pets, prompt row otherwise */}
        {stripDogs.length > 0 ? (
          <section className="animate-fade-in-up" style={stagger(3)}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="eyebrow">Following</h2>
              <Link to="/app/following" className="text-xs font-extrabold text-brand-700 hover:underline dark:text-brand-400">
                See all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
              {stripDogs.map((pet) => {
                const photo = petHeroPhoto(pet);
                return (
                  <Link
                    key={pet.id}
                    to={`/app/pets/${pet.id}`}
                    className="flex flex-col items-center gap-1.5 w-16 snap-start flex-shrink-0"
                  >
                    <div className="w-14 h-14 overflow-hidden rounded-full border-2 border-navy dark:border-white/30">
                      {photo ? (
                        <img
                          src={photo}
                          alt={pet.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PetPortrait species={pet.species} breed={pet.breed_display} seed={pet.id} crop="face" background className="h-full w-full" />
                      )}
                    </div>
                    <span className="text-2xs text-gray-700 dark:text-gray-300 font-bold truncate w-full text-center">
                      {pet.name}
                    </span>
                  </Link>
                );
              })}
              {hasMore && (
                <Link
                  to="/app/following"
                  className="flex flex-col items-center justify-center gap-1.5 w-16 snap-start flex-shrink-0 text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-biscuit"
                >
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-navy/30 dark:border-white/25 flex items-center justify-center font-extrabold">
                    +{followedDogs.length - MAX_STRIP_AVATARS}
                  </div>
                  <span className="text-2xs font-medium">More</span>
                </Link>
              )}
            </div>
          </section>
        ) : (
          <Link
            to="/app/following"
            style={stagger(3)}
            className="surface flex items-center justify-between gap-3 p-3 transition-colors hover:border-navy/40 animate-fade-in-up dark:hover:border-white/30"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-navy-100 text-navy dark:bg-white/10 dark:text-biscuit" aria-hidden>
                <BrandIcon name="follow" size={20} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-navy dark:text-biscuit">Following</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">Follow pets to see them here</p>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden className="text-navy dark:text-biscuit" />
          </Link>
        )}
      </div>
    </div>
  );
}

