import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentWinner } from '../api/rankings';
import { getMyFollows } from '../api/social';
import { useAuth } from '../store/AuthContext';
import { dogHeroPhoto } from '../utils/time';
import { useWeeklyResetCountdown, nextWeeklyReset } from '../utils/weeklyReset';

const MAX_STRIP_AVATARS = 8;

export default function HomePage() {
  const { user } = useAuth();
  const { data: winner } = useQuery({
    queryKey: ['weekly-winner'],
    queryFn: getCurrentWinner,
  });
  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows'],
    queryFn: getMyFollows,
  });
  const resetsIn = useWeeklyResetCountdown();

  const followedDogs = follows.map((f) => f.dog).filter((d) => !!d);
  const stripDogs = followedDogs.slice(0, MAX_STRIP_AVATARS);
  const hasMore = followedDogs.length > MAX_STRIP_AVATARS;

  return (
    <div className="flex flex-col">
      {/* Hero: Weekly Winner */}
      <div className="relative h-56 bg-gradient-to-b from-brand-400 to-brand-600 flex items-center justify-center overflow-hidden rounded-b-3xl">
        {winner?.primary_photo_url && (
          <img
            src={winner.primary_photo_url}
            alt={winner.dog_name || 'Weekly winner'}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative z-10 text-center text-white px-4">
          <p className="text-xs uppercase tracking-widest opacity-80">🏆 This Week's Top Dog</p>
          {winner ? (
            <>
              <h2 className="text-3xl font-bold mt-1">{winner.dog_name}</h2>
              {winner.breed && <p className="text-base opacity-90">{winner.breed}</p>}
              <p className="text-sm opacity-70 mt-1">Score: {winner.score}</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mt-2">No winner yet</h2>
              <p className="text-sm opacity-70 mt-1">Start swiping to cast your vote!</p>
              <div
                className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium"
                title={`Winner announced ${nextWeeklyReset().toLocaleString()}`}
              >
                <span aria-hidden>⏳</span>
                <span>Results in {resetsIn}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-4 pt-5 flex flex-col gap-5">
        <h1 className="text-lg font-bold">
          Welcome back{user ? `, ${user.display_name}` : ''}!
        </h1>

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

