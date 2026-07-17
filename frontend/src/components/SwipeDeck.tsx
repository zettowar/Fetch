import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Lock, Undo2 } from 'lucide-react';
import { getFeed } from '../api/feed';
import { castVote } from '../api/votes';
import SwipeCard from './SwipeCard';
import AdoptionPrompt from './AdoptionPrompt';
import RewardedAdModal from './RewardedAdModal';
import Button from './ui/Button';
import PawMark from './ui/PawMark';
import { CardSkeleton } from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import BoneProgress from './flair/BoneProgress';
import PetIllustration from './flair/PetIllustration';
import { usePawBurst } from './flair/PawBurst';
import { useAuth } from '../store/AuthContext';
import { useSpeciesFilter, filterToSpecies } from '../hooks/useSpeciesFilter';
import { useSubscription } from '../utils/useSubscription';
import { useSwipeQuota, REWARD_INCREMENT } from '../utils/swipeQuota';
import { onboarding } from '../utils/onboarding';

const SEEN_PROMPTS_KEY = 'fetch.adoption_prompts_seen';

function loadSeenPrompts(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_PROMPTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markPromptSeen(petId: string) {
  try {
    const seen = loadSeenPrompts();
    seen.add(petId);
    localStorage.setItem(SEEN_PROMPTS_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage unavailable — fail silent, prompt will just reappear.
  }
}

interface PromptState {
  petId: string;
  dogName: string;
  rescueName: string | null;
}

export default function SwipeDeck() {
  const { user } = useAuth();
  const { isSubscriber } = useSubscription();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastVote, setLastVote] = useState<{ petId: string; index: number } | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const quota = useSwipeQuota(Boolean(user) && !isSubscriber);
  const [adOpen, setAdOpen] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fire: fireLikeBurst, PawBurstLayer } = usePawBurst();

  const quotaBlocked = !isSubscriber && quota.blocked;
  const remaining = quota.remaining;

  const [speciesFilter] = useSpeciesFilter();
  const { data: pets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['feed', speciesFilter],
    queryFn: () => getFeed(30, filterToSpecies(speciesFilter)),
  });

  // A feed refetch returns a fresh re-shuffled batch that excludes pets the
  // user already voted on — it replaces the deck wholesale, so any index into
  // the old deck is meaningless. When the data's identity changes, restart
  // from the top of the new batch and drop state tied to the old one. An
  // empty refill keeps the current index so the end state can report the
  // session count (and any adoption prompt) from the deck just finished.
  const feedIdentity = `${pets[0]?.id ?? 'none'}:${pets.length}`;
  const [deckIdentity, setDeckIdentity] = useState(feedIdentity);
  if (feedIdentity !== deckIdentity) {
    setDeckIdentity(feedIdentity);
    if (pets.length > 0) {
      setCurrentIndex(0);
      setLastVote(null);
      setPrompt(null);
    }
  }

  const voteMutation = useMutation({
    mutationFn: ({ petId, value }: { petId: string; value: 1 | -1; index: number }) =>
      castVote(petId, value),
    onError: (err, vars) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const quotaHit = status === 429;
      toast.error(quotaHit ? "You've hit today's swipe limit" : 'Vote failed');
      // Only rewind when the failed vote is the one the deck just advanced
      // past — an older failure from a rapid-swipe burst must not yank the
      // user off the card they're currently on.
      setCurrentIndex((i) => (i === vars.index + 1 ? vars.index : i));
      // Undo would re-rewind and re-refund the same failed vote; drop it.
      setLastVote((lv) => (lv?.petId === vars.petId ? null : lv));
      // The vote didn't land server-side — give the swipe back so the user
      // isn't punished for our flaky network. On a 429 the server is the
      // authority: re-sync so the blocked overlay reflects the real cap.
      if (!isSubscriber) {
        quota.refund();
        if (quotaHit) quota.sync();
      }
    },
  });

  const dismissPrompt = useCallback(() => {
    if (prompt) markPromptSeen(prompt.petId);
    setPrompt(null);
  }, [prompt]);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const pet = pets[currentIndex];
      if (!pet) return;
      if (!isSubscriber && quota.blocked) {
        // Quota exhausted — block the swipe; the overlay handles unlock paths.
        return;
      }

      const value: 1 | -1 = direction === 'right' ? 1 : -1;
      navigator.vibrate?.(direction === 'right' ? 20 : 10);
      if (direction === 'right') fireLikeBurst();
      setLastVote({ petId: pet.id, index: currentIndex });
      setCurrentIndex((i) => i + 1);
      voteMutation.mutate({ petId: pet.id, value, index: currentIndex });
      if (user) onboarding.markSwiped(user.id);

      if (!isSubscriber) quota.consume();

      // Clear undo after 5 seconds
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLastVote(null), 5000);

      // Surface an adoption prompt AFTER the vote if:
      //   - user hasn't disabled the prompt globally
      //   - pet is adoptable
      //   - user hasn't already seen a prompt for this pet
      //   - the swipe was a right-swipe (a thumbs-up). Left-swipes don't prompt.
      if (
        direction === 'right' &&
        pet.adoptable &&
        user?.show_adoption_prompt !== false &&
        !loadSeenPrompts().has(pet.id)
      ) {
        setPrompt({
          petId: pet.id,
          dogName: pet.name,
          rescueName: pet.rescue_name,
        });
      } else if (prompt && prompt.petId !== pet.id) {
        // Any other swipe dismisses a stale prompt.
        setPrompt(null);
      }

      if (currentIndex >= pets.length - 3) {
        refetch();
      }
    },
    [pets, currentIndex, voteMutation, refetch, user, prompt, isSubscriber, quota, fireLikeBurst],
  );

  const handleUndo = () => {
    if (!lastVote) return;
    if (!isSubscriber) {
      toast('Rewind is a Pack+ perk', { icon: '\ud83d\udd12' });
      return;
    }
    navigator.vibrate?.([10, 40, 10]);
    setCurrentIndex(lastVote.index);
    setLastVote(null);
    setPrompt(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    // Refund quota on undo (subscribers can't reach here \u2014 undo is Pack+ only,
    // and they're uncapped regardless).
    if (!isSubscriber) quota.refund();
    toast('Swipe undone', { icon: '\u21a9\ufe0f' });
  };

  const handleReward = () => {
    if (!user) return;
    quota.grantReward();
    toast.success(`+${REWARD_INCREMENT} swipes unlocked`);
  };

  if (isLoading) {
    return (
      <div className="px-4">
        <CardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Couldn't load the feed."
        onRetry={() => refetch()}
      />
    );
  }

  const remainingDogs = pets.slice(currentIndex);
  const ratedCount = currentIndex;

  if (remainingDogs.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-16 text-center px-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
      >
        <motion.span
          className="mb-3"
          variants={{
            hidden: { opacity: 0, scale: 0.6 },
            visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 16 } },
          }}
        >
          <PetIllustration species={filterToSpecies(speciesFilter) ?? 'dog'} name="ball" className="h-32 w-auto text-gray-400 dark:text-gray-500" />
        </motion.span>
        <motion.p
          className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2"
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        >
          You've rated everyone this week!
        </motion.p>
        <motion.p
          className="text-gray-500 dark:text-gray-400 mb-1"
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        >
          {ratedCount > 0 ? `You rated ${ratedCount} pet${ratedCount > 1 ? 's' : ''} this session.` : ''}
        </motion.p>
        <motion.p
          className="text-gray-400 dark:text-gray-500 text-sm mb-6"
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        >
          Come back Monday for a fresh batch of pets.
        </motion.p>
        <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
          <Link to="/app/home">
            <Button>Back to Home</Button>
          </Link>
        </motion.div>
        {prompt && (
          <div className="w-full max-w-sm mt-4">
            <AdoptionPrompt
              petId={prompt.petId}
              dogName={prompt.dogName}
              rescueName={prompt.rescueName}
              onDismiss={dismissPrompt}
            />
          </div>
        )}
      </motion.div>
    );
  }

  const visibleDogs = remainingDogs.slice(0, 3);

  return (
    <div className="flex flex-col items-center">
      {/* Vote counter / quota indicator */}
      <div className="w-full max-w-sm px-4 mb-2 flex flex-col gap-1">
        {!isSubscriber && user ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                🐾 {remaining} {remaining === 1 ? 'swipe' : 'swipes'} left today
              </span>
              {ratedCount > 0 && (
                <span className="text-gray-400 dark:text-gray-500">{ratedCount} rated</span>
              )}
            </div>
            <BoneProgress
              value={remaining}
              max={quota.cap}
              size="sm"
              label={`${remaining} of ${quota.cap} daily swipes remaining`}
            />
          </>
        ) : (
          ratedCount > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {ratedCount} rated this session
            </span>
          )
        )}
      </div>

      <div className="relative w-full h-[480px]">
        {visibleDogs.map((pet, i) => (
          <SwipeCard
            key={pet.id}
            pet={pet}
            isTop={i === 0}
            onSwipe={handleSwipe}
          />
        ))}

        {quotaBlocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-soft-lg ring-1 ring-gray-200 dark:ring-gray-800 p-5 text-center">
              <PetIllustration
                species={filterToSpecies(speciesFilter) ?? 'dog'}
                name="sleeping"
                className="mx-auto mb-2 h-24 w-auto text-gray-400 dark:text-gray-500"
              />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                You've used today's free swipes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Watch a quick video to unlock {REWARD_INCREMENT} more, or go ad-free with Pack+.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {quota.canEarnMore ? (
                  <Button onClick={() => setAdOpen(true)}>
                    Watch ad · +{REWARD_INCREMENT} swipes
                  </Button>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Daily cap reached. Come back tomorrow.</p>
                )}
                <Link to="/app/billing" className="text-sm text-brand-500 hover:underline">
                  Subscribe to Pack+ →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Button controls */}
      <div className="flex items-center gap-4 mt-4">
        <motion.button
          onClick={() => handleSwipe('left')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="w-[84px] h-[84px] rounded-full bg-danger-100 text-danger-500 dark:bg-danger-500/15 dark:text-danger-400 flex items-center justify-center shadow-soft-sm hover:bg-danger-200 dark:hover:bg-danger-500/25 transition-colors"
          aria-label="Pass"
        >
          <PawMark className="h-[42px] w-[42px] rotate-180" decorative />
        </motion.button>

        <AnimatePresence initial={false}>
          {lastVote && (
            <motion.button
              key="undo"
              onClick={handleUndo}
              initial={{ opacity: 0, scale: 0.6, width: 0, marginLeft: -16 }}
              animate={{ opacity: 1, scale: 1, width: 44, marginLeft: 0 }}
              exit={{ opacity: 0, scale: 0.6, width: 0, marginLeft: -16 }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={`h-11 rounded-full text-sm flex items-center justify-center shadow-soft-sm transition-colors overflow-hidden ${
                isSubscriber
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-gray-50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
              title={isSubscriber ? 'Undo last swipe' : 'Rewind is a Pack+ perk'}
              aria-label={isSubscriber ? 'Undo last swipe' : 'Rewind (Pack+ only)'}
            >
              {isSubscriber ? <Undo2 size={18} aria-hidden /> : <Lock size={16} aria-hidden />}
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => handleSwipe('right')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="relative w-[84px] h-[84px] rounded-full bg-success-100 text-success-500 dark:bg-success-500/15 dark:text-success-400 flex items-center justify-center shadow-soft-sm hover:bg-success-200 dark:hover:bg-success-500/25 transition-colors"
          aria-label="Like"
        >
          <Heart size={40} fill="currentColor" strokeWidth={0} aria-hidden />
          <PawBurstLayer />
        </motion.button>
      </div>

      {/* Adoption prompt (after right-swipe on a rescue pet) */}
      {prompt && (
        <div className="w-full max-w-sm mt-3 px-4">
          <AdoptionPrompt
            petId={prompt.petId}
            dogName={prompt.dogName}
            rescueName={prompt.rescueName}
            onDismiss={dismissPrompt}
          />
        </div>
      )}

      {/* Banner ad slot — non-subscribers only. Placeholder until a real ad
          network is wired up. */}
      {!isSubscriber && (
        <div className="w-full max-w-sm mt-4 px-4">
          <Link
            to="/app/billing"
            className="block rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xs uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none">
                  Ad
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                  Go ad-free with Pack+
                </p>
              </div>
              <span className="text-xs font-semibold text-brand-500 flex-shrink-0">Upgrade →</span>
            </div>
          </Link>
        </div>
      )}

      <RewardedAdModal
        open={adOpen}
        onReward={handleReward}
        onClose={() => setAdOpen(false)}
        rewardAmount={REWARD_INCREMENT}
      />
    </div>
  );
}
