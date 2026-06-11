import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentWinner } from '../api/rankings';
import { getMyFollows } from '../api/social';
import { getMyDogs } from '../api/dogs';
import { useAuth } from '../store/AuthContext';
import { dogHeroPhoto } from '../utils/time';
import { useWeeklyResetCountdown, nextWeeklyReset } from '../utils/weeklyReset';
import { onboarding } from '../utils/onboarding';

const MAX_STRIP_AVATARS = 8;

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
  const resetsIn = useWeeklyResetCountdown();

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
    { key: 'dog', label: 'Add your dog', to: '/dogs/new', done: myDogs.length > 0 },
    { key: 'swipe', label: 'Rate some dogs', to: '/swipe', done: user ? onboarding.hasSwiped(user.id) : false },
    { key: 'follow', label: 'Follow a dog you like', to: '/explore', done: followedDogs.length > 0 },
  ];
  const showOnboarding =
    !!user && !dismissed && !dogsLoading && myDogs.length === 0;
  const handleDismiss = () => {
    if (user) onboarding.dismiss(user.id);
    setDismissed(true);
  };

  if (isRescue) {
    return <Navigate to="/rescue/dashboard" replace />;
  }

  return (
    <div className="flex flex-col">
      {/* Hero: Weekly Winner */}
      <Link
        to="/rankings"
        className="group relative h-56 bg-gradient-to-b from-brand-400 to-brand-600 flex flex-col overflow-hidden rounded-b-3xl active:scale-[0.99] transition-transform duration-200 ease-soft-out"
      >
        {winner?.primary_photo_url && (
          <img
            src={winner.primary_photo_url}
            alt={winner.dog_name || 'Weekly winner'}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative z-10 flex items-center justify-between text-white px-4 pt-5">
          <p className="text-xs uppercase tracking-widest opacity-80">🏆 This Week's Top Dog</p>
          <span className="text-xs font-medium opacity-80 group-hover:opacity-100 transition-opacity">
            Rankings →
          </span>
        </div>
        <div className="relative z-10 mt-auto text-center text-white px-4 pb-4">
          {winner ? (
            <h2 className="text-3xl font-bold drop-shadow-sm">{winner.dog_name}</h2>
          ) : (
            <>
              <h2 className="text-2xl font-bold opacity-90">No winner yet</h2>
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium"
                title={`Winner announced ${nextWeeklyReset().toLocaleString()}`}
              >
                <span aria-hidden>⏳</span>
                <span>Results in {resetsIn}</span>
              </div>
            </>
          )}
        </div>
      </Link>

      <div className="p-4 pt-5 flex flex-col gap-5">
        <h1 className="text-lg font-bold">
          Welcome back{user ? `, ${user.display_name}` : ''}!
        </h1>

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
                      {step.done ? '✓' : i + 1}
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
                    {isNext && <span className="ml-auto text-brand-500 text-sm">→</span>}
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

        {/* Primary CTA — matches the half-size hero style of Rescues / Lost & Found */}
        <Link
          to="/swipe"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white p-3.5 shadow-brand-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest opacity-80">Ready to swipe?</p>
              <p className="text-base font-bold mt-0.5">Rate Dogs</p>
              <p className="text-xs opacity-90 mt-0.5 truncate">Fresh pups waiting for your vote</p>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl">
              <span className="inline-block animate-heartbeat origin-center" aria-hidden>❤️</span>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl" />
        </Link>

        {/* Rescues — half-size hero panel, purple theme */}
        <Link
          to="/rescues"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white p-3.5 shadow-soft-lg hover:shadow-[0_10px_30px_-8px_rgba(147,51,234,0.5)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest opacity-80">Find a forever home</p>
              <p className="text-base font-bold mt-0.5">Rescues</p>
              <p className="text-xs opacity-90 mt-0.5 truncate">
                Browse adoptable dogs from local rescues
              </p>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl">
              <span aria-hidden>🏠</span>
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl"
          />
        </Link>

        {/* Lost & Found — half-size hero panel, red theme */}
        <Link
          to="/lost"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white p-3.5 shadow-soft-lg hover:shadow-[0_10px_30px_-8px_rgba(239,68,68,0.5)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest opacity-80">Help bring them home</p>
              <p className="text-base font-bold mt-0.5">Lost &amp; Found</p>
              <p className="text-xs opacity-90 mt-0.5 truncate">
                Help reunite missing dogs with their owners
              </p>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl">
              <span aria-hidden>🚨</span>
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl"
          />
        </Link>

        {/* Following — strip when the user follows dogs, prompt row otherwise */}
        {stripDogs.length > 0 ? (
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-bold tracking-tight text-gray-800 dark:text-gray-200">Following</h2>
              <Link to="/following" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                See all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
              {stripDogs.map((dog) => {
                const photo = dogHeroPhoto(dog);
                return (
                  <Link
                    key={dog.id}
                    to={`/dogs/${dog.id}`}
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
                          <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-xl">
                            🐶
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-700 dark:text-gray-300 font-medium truncate w-full text-center">
                      {dog.name}
                    </span>
                  </Link>
                );
              })}
              {hasMore && (
                <Link
                  to="/following"
                  className="flex flex-col items-center justify-center gap-1.5 w-16 snap-start flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-brand-600"
                >
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    +{followedDogs.length - MAX_STRIP_AVATARS}
                  </div>
                  <span className="text-[11px] font-medium">More</span>
                </Link>
              )}
            </div>
          </section>
        ) : (
          <Link
            to="/following"
            className="flex items-center justify-between gap-3 p-3 bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 backdrop-blur rounded-2xl shadow-soft-sm hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-100 text-lg" aria-hidden>🐾</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Following</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Follow dogs to see them here</p>
              </div>
            </div>
            <span className="text-gray-300 dark:text-gray-600">›</span>
          </Link>
        )}
      </div>
    </div>
  );
}

