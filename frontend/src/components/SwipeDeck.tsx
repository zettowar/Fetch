import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getFeed } from '../api/feed';
import { castVote } from '../api/votes';
import SwipeCard from './SwipeCard';
import AdoptionPrompt from './AdoptionPrompt';
import RewardedAdModal from './RewardedAdModal';
import Button from './ui/Button';
import PawMark from './ui/PawMark';
import { CardSkeleton } from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import { useAuth } from '../store/AuthContext';
import { useSubscription } from '../utils/useSubscription';
import { swipeQuota } from '../utils/swipeQuota';
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

function markPromptSeen(dogId: string) {
  try {
    const seen = loadSeenPrompts();
    seen.add(dogId);
    localStorage.setItem(SEEN_PROMPTS_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage unavailable — fail silent, prompt will just reappear.
  }
}

interface PromptState {
  dogId: string;
  dogName: string;
  rescueName: string | null;
}

export default function SwipeDeck() {
  const { user } = useAuth();
  const { isSubscriber } = useSubscription();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastVote, setLastVote] = useState<{ dogId: string; index: number } | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [quota, setQuota] = useState(() =>
    user ? swipeQuota.get(user.id) : { used: 0, cap: swipeQuota.FREE_DAILY },
  );
  const [adOpen, setAdOpen] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-read quota when the user resolves (initial load) or changes (logout/login).
  useEffect(() => {
    if (!user) return;
    setQuota(swipeQuota.get(user.id));
  }, [user?.id]);

  const quotaBlocked = !isSubscriber && quota.used >= quota.cap;
  const remaining = Math.max(0, quota.cap - quota.used);

  const { data: dogs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['feed'],
    queryFn: () => getFeed(30),
  });

  const voteMutation = useMutation({
    mutationFn: ({ dogId, value }: { dogId: string; value: 1 | -1 }) =>
      castVote(dogId, value),
    onError: () => {
      toast.error('Vote failed');
      setCurrentIndex((i) => Math.max(0, i - 1));
      // The vote didn't land server-side — give the swipe back so the user
      // isn't punished for our flaky network.
      if (!isSubscriber && user) {
        setQuota(swipeQuota.refund(user.id));
      }
    },
  });

  const dismissPrompt = useCallback(() => {
    if (prompt) markPromptSeen(prompt.dogId);
    setPrompt(null);
  }, [prompt]);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const dog = dogs[currentIndex];
      if (!dog) return;
      if (!isSubscriber && user && quota.used >= quota.cap) {
        // Quota exhausted — block the swipe; the overlay handles unlock paths.
        return;
      }

      const value: 1 | -1 = direction === 'right' ? 1 : -1;
      navigator.vibrate?.(direction === 'right' ? 20 : 10);
      setLastVote({ dogId: dog.id, index: currentIndex });
      setCurrentIndex((i) => i + 1);
      voteMutation.mutate({ dogId: dog.id, value });
      if (user) onboarding.markSwiped(user.id);

      if (!isSubscriber && user) {
        const next = swipeQuota.consume(user.id);
        setQuota(next);
      }

      // Clear undo after 5 seconds
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLastVote(null), 5000);

      // Surface an adoption prompt AFTER the vote if:
      //   - user hasn't disabled the prompt globally
      //   - dog is adoptable
      //   - user hasn't already seen a prompt for this dog
      //   - the swipe was a right-swipe (a thumbs-up). Left-swipes don't prompt.
      if (
        direction === 'right' &&
        dog.adoptable &&
        user?.show_adoption_prompt !== false &&
        !loadSeenPrompts().has(dog.id)
      ) {
        setPrompt({
          dogId: dog.id,
          dogName: dog.name,
          rescueName: dog.rescue_name,
        });
      } else if (prompt && prompt.dogId !== dog.id) {
        // Any other swipe dismisses a stale prompt.
        setPrompt(null);
      }

      if (currentIndex >= dogs.length - 3) {
        refetch();
      }
    },
    [dogs, currentIndex, voteMutation, refetch, user, prompt, isSubscriber, quota.used, quota.cap],
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
    // Refund quota on undo. Subscribers bypass the cap anyway so this is a
    // no-op for them \u2014 but keeping the call site uniform avoids surprise if
    // we later let free users undo once.
    if (user) setQuota(swipeQuota.refund(user.id));
    toast('Swipe undone', { icon: '\u21a9\ufe0f' });
  };

  const handleReward = () => {
    if (!user) return;
    const next = swipeQuota.grantReward(user.id);
    setQuota(next);
    toast.success(`+${swipeQuota.REWARD_INCREMENT} swipes unlocked`);
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

  const remainingDogs = dogs.slice(currentIndex);
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
          className="text-5xl mb-3"
          variants={{
            hidden: { opacity: 0, scale: 0.6 },
            visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 16 } },
          }}
        >
          {'\ud83c\udf89'}
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
          {ratedCount > 0 ? `You rated ${ratedCount} dog${ratedCount > 1 ? 's' : ''} this session.` : ''}
        </motion.p>
        <motion.p
          className="text-gray-400 dark:text-gray-500 text-sm mb-6"
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        >
          Come back Monday for a fresh batch of pups.
        </motion.p>
        <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
          <Link to="/home">
            <Button>Back to Home</Button>
          </Link>
        </motion.div>
        {prompt && (
          <div className="w-full max-w-sm mt-4">
            <AdoptionPrompt
              dogId={prompt.dogId}
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
            <div
              className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={quota.cap}
              aria-valuenow={remaining}
              aria-label={`${remaining} of ${quota.cap} daily swipes remaining`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ease-soft-out ${
                  remaining === 0
                    ? 'bg-red-400'
                    : remaining <= quota.cap * 0.2
                      ? 'bg-amber-400'
                      : 'bg-brand-500'
                }`}
                style={{ width: `${quota.cap > 0 ? (remaining / quota.cap) * 100 : 0}%` }}
              />
            </div>
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
        {visibleDogs.map((dog, i) => (
          <SwipeCard
            key={dog.id}
            dog={dog}
            isTop={i === 0}
            onSwipe={handleSwipe}
          />
        ))}

        {quotaBlocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-soft-lg ring-1 ring-gray-200 dark:ring-gray-800 p-5 text-center">
              <p className="text-2xl mb-1">🐾</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                You've used today's free swipes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Watch a quick video to unlock {swipeQuota.REWARD_INCREMENT} more, or go ad-free with Pack+.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {swipeQuota.canEarnMore(user?.id ?? '') ? (
                  <Button onClick={() => setAdOpen(true)}>
                    Watch ad · +{swipeQuota.REWARD_INCREMENT} swipes
                  </Button>
                ) : (
                  <p className="text-xs text-gray-500">Daily cap reached. Come back tomorrow.</p>
                )}
                <Link to="/billing" className="text-sm text-brand-500 hover:underline">
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
          className="w-[84px] h-[84px] rounded-full bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400 flex items-center justify-center shadow-soft-sm hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors"
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
              {isSubscriber ? '\u21a9\ufe0f' : '\ud83d\udd12'}
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => handleSwipe('right')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="w-[84px] h-[84px] rounded-full bg-green-100 text-green-500 dark:bg-green-500/15 dark:text-green-400 text-4xl flex items-center justify-center shadow-soft-sm hover:bg-green-200 dark:hover:bg-green-500/25 transition-colors"
          aria-label="Like"
        >
          &#x2764;
        </motion.button>
      </div>

      {/* Adoption prompt (after right-swipe on a rescue dog) */}
      {prompt && (
        <div className="w-full max-w-sm mt-3 px-4">
          <AdoptionPrompt
            dogId={prompt.dogId}
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
            to="/billing"
            className="block rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none">
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
        rewardAmount={swipeQuota.REWARD_INCREMENT}
      />
    </div>
  );
}
