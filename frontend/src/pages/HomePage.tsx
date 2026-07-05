import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  Bone,
  Check,
  ChevronRight,
  Heart,
  HeartHandshake,
  Hourglass,
  HousePlus,
  Siren,
  Trophy,
} from 'lucide-react';
import PawTrail from '../components/flair/PawTrail';
import { getCurrentWinner } from '../api/rankings';
import { getMyFollows } from '../api/social';
import { getMyDogs } from '../api/dogs';
import { listMyTransfers } from '../api/dogTransfers';
import { getNearbyReports } from '../api/lost';
import { getDonationConfig } from '../api/donations';
import { useAuth } from '../store/AuthContext';
import { dogHeroPhoto } from '../utils/time';
import { useWeeklyResetCountdown, nextWeeklyReset } from '../utils/weeklyReset';
import { onboarding } from '../utils/onboarding';
import { swipeQuota } from '../utils/swipeQuota';
import { useSubscription } from '../utils/useSubscription';
import { useUserLocation } from '../utils/useUserLocation';

const MAX_STRIP_AVATARS = 8;
const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // same fallback as Lost/Parks

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

export default function HomePage() {
  const { user } = useAuth();
  // Rescues are distinct content-producer accounts — they don't get the
  // consumer home. Skip the consumer queries and send them to their dashboard.
  const isRescue = user?.role === 'rescue';
  const { data: winner } = useQuery({
    queryKey: ['weekly-winner'],
    queryFn: getCurrentWinner,
    enabled: !isRescue,
  });
  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows'],
    queryFn: getMyFollows,
    enabled: !isRescue,
  });
  const { data: myDogs = [], isLoading: dogsLoading } = useQuery({
    queryKey: ['my-dogs'],
    queryFn: getMyDogs,
    enabled: !isRescue,
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ['my-transfers'],
    queryFn: listMyTransfers,
    enabled: !isRescue,
  });
  const pendingTransfers = transfers.filter((t) => t.status === 'pending');
  const resetsIn = useWeeklyResetCountdown();

  // Live bits for the CTA cards: swipes left today + missing dogs nearby.
  const { isSubscriber } = useSubscription();
  const swipesLeft = user && !isRescue ? swipeQuota.remaining(user.id) : 0;
  const [lng, lat] = useUserLocation(DEFAULT_CENTER);
  const { data: nearbyLost = [] } = useQuery({
    queryKey: ['nearby-lost-count', lat.toFixed(2), lng.toFixed(2)],
    queryFn: () => getNearbyReports(lat, lng, 25, 'missing'),
    enabled: !isRescue,
    staleTime: 5 * 60_000,
  });
  const missingNearby = nearbyLost.filter((r) => r.status === 'open').length;
  const { data: donationConfig } = useQuery({
    queryKey: ['donation-config'],
    queryFn: getDonationConfig,
    enabled: !isRescue,
    staleTime: 5 * 60_000,
  });

  const followedDogs = follows.map((f) => f.dog).filter((d) => !!d);
  const stripDogs = followedDogs.slice(0, MAX_STRIP_AVATARS);
  const hasMore = followedDogs.length > MAX_STRIP_AVATARS;

  // First-run checklist. The customer asked specifically to surface "add your
  // dog" when the user owns none, so step 1 is the gate: once they have a dog
  // the card disappears. Swipe/follow are shown as the path that follows.
  const [dismissed, setDismissed] = useState(() =>
    user ? onboarding.isDismissed(user.id) : false,
  );
  const steps: { key: string; label: string; to: string; done: boolean }[] = [
    { key: 'dog', label: 'Add your dog', to: '/app/dogs/new', done: myDogs.length > 0 },
    { key: 'swipe', label: 'Rate some dogs', to: '/app/swipe', done: user ? onboarding.hasSwiped(user.id) : false },
    { key: 'follow', label: 'Follow a dog you like', to: '/app/explore', done: followedDogs.length > 0 },
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
      {/* Hero: Weekly Winner */}
      <Link
        to="/app/rankings"
        className="group relative h-56 bg-gradient-to-b from-brand-400 to-brand-600 flex flex-col overflow-hidden rounded-b-3xl active:scale-[0.99] transition-transform duration-200 ease-soft-out"
      >
        {winner?.primary_photo_url && (
          <img
            src={winner.primary_photo_url}
            alt={winner.dog_name || 'Weekly winner'}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <PawTrail
          steps={4}
          direction={-24}
          size={18}
          className="absolute top-10 right-4 text-white/15"
        />
        <div className="relative z-10 flex items-center justify-between text-white px-4 pt-5">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest opacity-80">
            <Trophy size={14} aria-hidden /> This Week's Top Dog
          </p>
          <span className="text-xs font-medium opacity-80 group-hover:opacity-100 transition-opacity">
            Rankings →
          </span>
        </div>
        <div className="relative z-10 mt-auto text-center text-white px-4 pb-4">
          {winner ? (
            <p className="text-3xl font-bold tracking-tight drop-shadow-sm">{winner.dog_name}</p>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight opacity-90">No winner yet</p>
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium"
                title={`Winner announced ${nextWeeklyReset().toLocaleString()}`}
              >
                <Hourglass size={12} aria-hidden />
                <span>Results in {resetsIn}</span>
              </div>
            </>
          )}
        </div>
      </Link>

      <div className="p-4 pt-5 flex flex-col gap-5">
        <h1 className="text-lg font-bold animate-fade-in-up" style={stagger(0)}>
          {greeting()}
          {user ? `, ${user.display_name}` : ''}!
        </h1>

        {/* Pending dog transfers — only shown when an invitation is waiting */}
        {pendingTransfers.length > 0 && (
          <Link
            to="/app/transfers"
            className="flex items-center justify-between gap-3 p-3 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 rounded-2xl shadow-soft-sm hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-white dark:bg-gray-900 text-brand-500" aria-hidden>
                <ArrowLeftRight size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {pendingTransfers.length === 1
                    ? 'A dog transfer is waiting for you'
                    : `${pendingTransfers.length} dog transfers are waiting for you`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Review the invitation to take ownership.</p>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden className="text-gray-300 dark:text-gray-600" />
          </Link>
        )}

        {/* First-run checklist — shown until the user adds their first dog */}
        {showOnboarding && (
          <section className="relative overflow-hidden rounded-2xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/80 dark:bg-brand-500/10 p-4 shadow-soft-sm animate-fade-in-up">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute right-3 top-3 leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg"
            >
              ×
            </button>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">
              🐾 Join the pack
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Add your dog to get rated, climb the rankings, and follow other pups.
            </p>
            <ol className="mt-3 flex flex-col gap-1.5">
              {steps.map((step, i) => {
                const isNext = !step.done && steps.slice(0, i).every((s) => s.done);
                const row = (
                  <>
                    <span
                      className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        step.done
                          ? 'bg-brand-500 text-white'
                          : isNext
                            ? 'bg-white dark:bg-gray-900 text-brand-600 ring-2 ring-brand-400'
                            : 'bg-white/70 dark:bg-gray-800 text-gray-400'
                      }`}
                      aria-hidden
                    >
                      {step.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        step.done
                          ? 'text-gray-400 line-through'
                          : isNext
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isNext && (
                      <ArrowRight size={16} aria-hidden className="ml-auto text-brand-500" />
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

        {/* Primary CTA — the one big card; carries a live swipes-left line */}
        <Link
          to="/app/swipe"
          style={stagger(1)}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white p-4 shadow-brand-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out animate-fade-in-up"
        >
          <PawTrail
            steps={3}
            direction={-18}
            size={14}
            className="absolute top-3 right-14 text-white/15"
          />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-widest opacity-80">Ready to swipe?</p>
              <p className="text-lg font-bold mt-0.5">Rate Dogs</p>
              <p className="inline-flex items-center gap-1.5 text-xs opacity-90 mt-1">
                <Bone size={13} aria-hidden className="-rotate-12" />
                {isSubscriber
                  ? 'Unlimited swipes — fresh pups waiting'
                  : swipesLeft > 0
                    ? `${swipesLeft} swipes left today`
                    : 'Out of swipes — resets tomorrow'}
              </p>
            </div>
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="inline-block animate-heartbeat origin-center" aria-hidden>
                <Heart size={24} fill="currentColor" strokeWidth={0} />
              </span>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl" />
        </Link>

        {/* Rescues + Lost & Found — compact half-width pair under the hero CTA */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={stagger(2)}>
          <Link
            to="/app/rescues"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white p-3.5 shadow-soft-lg hover:shadow-[0_10px_30px_-8px_rgba(147,51,234,0.5)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
          >
            <div className="relative z-10 flex flex-col gap-2">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm" aria-hidden>
                <HousePlus size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">Rescues</p>
                <p className="text-2xs opacity-90 mt-0.5">Meet adoptable pups</p>
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10 blur-xl"
            />
          </Link>

          <Link
            to="/app/lost"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-danger-500 to-danger-700 text-white p-3.5 shadow-soft-lg hover:shadow-[0_10px_30px_-8px_rgba(239,68,68,0.5)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
          >
            <div className="relative z-10 flex flex-col gap-2">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm" aria-hidden>
                <Siren size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">Lost &amp; Found</p>
                <p className="text-2xs opacity-90 mt-0.5">
                  {missingNearby > 0
                    ? `${missingNearby} missing nearby`
                    : 'Help bring them home'}
                </p>
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10 blur-xl"
            />
          </Link>
        </div>

        {/* Donations — compact row, only when Stripe is configured */}
        {donationConfig?.enabled && (
          <Link
            to="/app/donate"
            style={stagger(3)}
            className="flex items-center justify-between gap-3 p-3 bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 backdrop-blur rounded-2xl shadow-soft-sm hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out animate-fade-in-up"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white" aria-hidden>
                <HeartHandshake size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Donate</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Support rescues and keep Fetch running
                </p>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden className="text-gray-300 dark:text-gray-600" />
          </Link>
        )}

        {/* Following — strip when the user follows dogs, prompt row otherwise */}
        {stripDogs.length > 0 ? (
          <section className="animate-fade-in-up" style={stagger(3)}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-bold tracking-tight text-gray-800 dark:text-gray-200">Following</h2>
              <Link to="/app/following" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                See all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
              {stripDogs.map((dog) => {
                const photo = dogHeroPhoto(dog);
                return (
                  <Link
                    key={dog.id}
                    to={`/app/dogs/${dog.id}`}
                    className="flex flex-col items-center gap-1.5 w-16 snap-start flex-shrink-0"
                  >
                    <div className="p-[2px] rounded-full bg-gradient-to-br from-brand-300 to-brand-500 shadow-soft-sm">
                      <div className="rounded-full bg-white dark:bg-gray-900 p-[2px]">
                        {photo ? (
                          <img
                            src={photo}
                            alt={dog.name}
                            loading="lazy"
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center text-xl">
                            🐶
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-2xs text-gray-700 dark:text-gray-300 font-medium truncate w-full text-center">
                      {dog.name}
                    </span>
                  </Link>
                );
              })}
              {hasMore && (
                <Link
                  to="/app/following"
                  className="flex flex-col items-center justify-center gap-1.5 w-16 snap-start flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-brand-600"
                >
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
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
            className="flex items-center justify-between gap-3 p-3 bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 backdrop-blur rounded-2xl shadow-soft-sm hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out animate-fade-in-up"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-500/15 text-lg" aria-hidden>🐾</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Following</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Follow dogs to see them here</p>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden className="text-gray-300 dark:text-gray-600" />
          </Link>
        )}
      </div>
    </div>
  );
}

