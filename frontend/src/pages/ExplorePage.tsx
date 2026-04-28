import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getExploreDogs } from '../api/dogs';
import { dogAge, dogHeroPhoto } from '../utils/time';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FollowButton from '../components/FollowButton';
import Button from '../components/ui/Button';
import type { Dog } from '../types';

const PAGE_SIZE = 18;
// Cap the feed to keep memory + DOM size sane on long sessions. The
// backend returns random rows each call, so dedup is necessary and the
// pool is finite (eventually shuffles repeat).
const MAX_DOGS = 240;

function ExploreCard({ dog, index }: { dog: Dog; index: number }) {
  const hero = dogHeroPhoto(dog);
  const age = dogAge(dog.birthday);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1],
        // Stagger only within a freshly loaded page; index resets per page
        delay: Math.min((index % PAGE_SIZE) * 0.03, 0.25),
      }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft-sm overflow-hidden flex flex-col"
    >
      <Link to={`/dogs/${dog.id}`} className="block relative group">
        {hero ? (
          <img
            src={hero}
            alt={dog.name}
            loading="lazy"
            className="w-full aspect-square object-cover transition-transform duration-300 ease-soft-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 flex items-center justify-center">
            <span className="text-5xl opacity-40">🐶</span>
          </div>
        )}
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              to={`/dogs/${dog.id}`}
              className="font-semibold text-gray-900 dark:text-gray-100 truncate hover:text-brand-600 transition-colors"
            >
              {dog.name}
            </Link>
            {age && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                {age}
              </span>
            )}
          </div>
          {dog.breed_display && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dog.breed_display}</p>
          )}
        </div>
        <div className="mt-auto pt-1">
          <FollowButton dogId={dog.id} />
        </div>
      </div>
    </motion.div>
  );
}

export default function ExplorePage() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['explore-pack'],
    queryFn: () => {
      // Pull the IDs we've already shown out of the cache so the server
      // can return a genuinely fresh random batch each call. Reading from
      // the cache (rather than from a useState list) keeps the queryFn
      // referentially stable while still seeing the latest pages.
      const cached = queryClient.getQueryData<{ pages: Dog[][] }>(['explore-pack']);
      const seen: string[] = [];
      for (const page of cached?.pages ?? []) {
        for (const dog of page) seen.push(dog.id);
      }
      return getExploreDogs(PAGE_SIZE, seen);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Backend returns up to PAGE_SIZE dogs, excluding ones we've already
      // seen. A short page means the pool is exhausted. Also cap at
      // MAX_DOGS to avoid unbounded memory growth on long sessions.
      if (lastPage.length < PAGE_SIZE) return undefined;
      const total = allPages.reduce((n, p) => n + p.length, 0);
      if (total >= MAX_DOGS) return undefined;
      return allPages.length;
    },
    staleTime: 0,
  });

  // Dedup across pages so a re-rolled random batch doesn't render duplicate keys.
  const dogs = useMemo(() => {
    const seen = new Set<string>();
    const out: Dog[] = [];
    for (const page of data?.pages ?? []) {
      for (const dog of page) {
        if (!seen.has(dog.id)) {
          seen.add(dog.id);
          out.push(dog);
        }
      }
    }
    return out;
  }, [data]);

  // Sentinel for IntersectionObserver-driven infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '400px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="p-4 pb-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span aria-hidden>🐾</span> Explore the Pack
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching && !isLoading && !isFetchingNextPage}
          aria-label="Shuffle"
        >
          Shuffle
        </Button>
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
        Meet new dogs from the community. Follow the ones you love.
      </p>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState message="Couldn't load dogs to explore." onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && dogs.length === 0 && (
        <EmptyState
          icon="🐾"
          title="No dogs to explore yet"
          body="Check back once more dogs join the pack."
          action={
            <Link to="/dogs/new">
              <Button size="sm">Add your dog</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && dogs.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {dogs.map((dog, i) => (
              <ExploreCard key={dog.id} dog={dog} index={i} />
            ))}
          </div>

          {/* Sentinel — loads more when it scrolls into view */}
          <div ref={sentinelRef} className="h-1" aria-hidden />

          {isFetchingNextPage && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {[...Array(2)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {!hasNextPage && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
              You've met the whole pack. 🐾
            </p>
          )}
        </>
      )}
    </div>
  );
}
