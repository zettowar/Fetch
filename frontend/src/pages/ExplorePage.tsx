import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PawPrint } from 'lucide-react';
import { getExplorePets } from '../api/pets';
import { useSpeciesFilter, filterToSpecies } from '../hooks/useSpeciesFilter';
import SpeciesTabs from '../components/SpeciesTabs';
import { petAge, petHeroPhoto } from '../utils/time';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FollowButton from '../components/FollowButton';
import Button from '../components/ui/Button';
import type { Pet } from '../types';

const PAGE_SIZE = 18;
// Cap the feed to keep memory + DOM size sane on long sessions. The
// backend returns random rows each call, so dedup is necessary and the
// pool is finite (eventually shuffles repeat).
const MAX_DOGS = 240;

function ExploreCard({ pet, index }: { pet: Pet; index: number }) {
  const hero = petHeroPhoto(pet);
  const age = petAge(pet.birthday);

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
      <Link to={`/app/pets/${pet.id}`} className="block relative group">
        {hero ? (
          <img
            src={hero}
            alt={pet.name}
            loading="lazy"
            className="w-full aspect-square object-cover transition-transform duration-300 ease-soft-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 flex items-center justify-center">
            <span className="text-5xl opacity-40">{pet.species === 'cat' ? '🐱' : '🐶'}</span>
          </div>
        )}
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              to={`/app/pets/${pet.id}`}
              className="font-semibold text-gray-900 dark:text-gray-100 truncate hover:text-brand-600 transition-colors"
            >
              {pet.name}
            </Link>
            {age && (
              <span className="text-2xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {age}
              </span>
            )}
          </div>
          {pet.breed_display && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pet.breed_display}</p>
          )}
        </div>
        <div className="mt-auto pt-1">
          <FollowButton petId={pet.id} />
        </div>
      </div>
    </motion.div>
  );
}

export default function ExplorePage() {
  const queryClient = useQueryClient();
  const [filter] = useSpeciesFilter();
  const species = filterToSpecies(filter);

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
    queryKey: ['explore-pack', filter],
    queryFn: () => {
      // Pull the IDs we've already shown out of the cache so the server
      // can return a genuinely fresh random batch each call. Reading from
      // the cache (rather than from a useState list) keeps the queryFn
      // referentially stable while still seeing the latest pages.
      const cached = queryClient.getQueryData<{ pages: Pet[][] }>(['explore-pack', filter]);
      const seen: string[] = [];
      for (const page of cached?.pages ?? []) {
        for (const pet of page) seen.push(pet.id);
      }
      return getExplorePets(PAGE_SIZE, seen, species);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Backend returns up to PAGE_SIZE pets, excluding ones we've already
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
  const pets = useMemo(() => {
    const seen = new Set<string>();
    const out: Pet[] = [];
    for (const page of data?.pages ?? []) {
      for (const pet of page) {
        if (!seen.has(pet.id)) {
          seen.add(pet.id);
          out.push(pet);
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
          <PawPrint size={20} aria-hidden className="text-brand-500" /> Explore the Pack
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
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
        Meet new pets from the community. Follow the ones you love.
      </p>
      <div className="mb-5">
        <SpeciesTabs />
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState message="Couldn't load pets to explore." onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && pets.length === 0 && (
        <EmptyState
          illustration="sniffing"
          title="No pets to explore yet"
          body="Check back once more pets join the pack."
          action={
            <Link to="/app/pets/new">
              <Button size="sm">Add your pet</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && pets.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {pets.map((pet, i) => (
              <ExploreCard key={pet.id} pet={pet} index={i} />
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
