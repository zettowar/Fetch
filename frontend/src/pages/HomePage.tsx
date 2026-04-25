import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentWinner } from '../api/rankings';
import { getMyFollows } from '../api/social';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
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

        {/* Primary CTA */}
        <Link
          to="/swipe"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white p-5 shadow-brand-glow active:scale-[0.99] transition-transform"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Ready to swipe?</p>
              <p className="text-xl font-bold mt-0.5">Rate Dogs</p>
              <p className="text-sm opacity-90 mt-0.5">Fresh pups waiting for your vote</p>
            </div>
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl">
              <span className="inline-block animate-heartbeat origin-center" aria-hidden>❤️</span>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        </Link>

        {/* Following strip — direct one-tap to followed dog profiles */}
        {stripDogs.length > 0 && (
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
        )}

        {/* Secondary grid — unified glassy tiles with tinted icon badges */}
        <section className="grid grid-cols-2 gap-3">
          {[
            { to: '/dogs', icon: '🐶', label: 'My Dogs', tint: 'bg-gray-200/70 dark:bg-gray-700/60' },
            { to: '/lost', icon: '🚨', label: 'Lost & Found', tint: 'bg-red-100/80 dark:bg-red-500/20' },
            { to: '/parks', icon: '🌳', label: 'Dog Parks', tint: 'bg-green-100/80 dark:bg-green-500/20' },
            { to: '/rescues', icon: '🏠', label: 'Rescues', tint: 'bg-purple-100/80 dark:bg-purple-500/20' },
          ].map((tile, i) => (
            <div
              key={tile.to}
              className="animate-fade-in-up"
              style={{ animationDelay: `${60 + i * 60}ms`, animationFillMode: 'backwards' }}
            >
              <GlassTile {...tile} />
            </div>
          ))}
        </section>

        {/* Show Following tile in the grid only if the user isn't following anyone
            (the strip above is the richer entry point once they have follows) */}
        {stripDogs.length === 0 && (
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

        <Link to="/rankings">
          <Button variant="secondary" className="w-full">
            🏆 View Rankings
          </Button>
        </Link>
      </div>
    </div>
  );
}

function GlassTile({
  to,
  icon,
  label,
  tint,
}: { to: string; icon: string; label: string; tint: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 p-4 bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 backdrop-blur rounded-2xl shadow-soft-sm hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
    >
      <span
        className={`inline-flex w-11 h-11 items-center justify-center rounded-xl text-2xl ${tint}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</span>
    </Link>
  );
}
