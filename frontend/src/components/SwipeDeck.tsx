import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getFeed } from '../api/feed';
import { castVote } from '../api/votes';
import SwipeCard from './SwipeCard';
import AdoptionPrompt from './AdoptionPrompt';
import Button from './ui/Button';
import { CardSkeleton } from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import { useAuth } from '../store/AuthContext';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastVote, setLastVote] = useState<{ dogId: string; index: number } | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: dogs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['feed'],
    queryFn: () => getFeed(20),
  });

  const voteMutation = useMutation({
    mutationFn: ({ dogId, value }: { dogId: string; value: 1 | -1 }) =>
      castVote(dogId, value),
    onError: () => {
      toast.error('Vote failed');
      setCurrentIndex((i) => Math.max(0, i - 1));
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

      const value: 1 | -1 = direction === 'right' ? 1 : -1;
      navigator.vibrate?.(direction === 'right' ? 20 : 10);
      setLastVote({ dogId: dog.id, index: currentIndex });
      setCurrentIndex((i) => i + 1);
      voteMutation.mutate({ dogId: dog.id, value });

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
    [dogs, currentIndex, voteMutation, refetch, user, prompt],
  );

  const handleUndo = () => {
    if (!lastVote) return;
    navigator.vibrate?.([10, 40, 10]);
    setCurrentIndex(lastVote.index);
    setLastVote(null);
    setPrompt(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    toast('Swipe undone', { icon: '\u21a9\ufe0f' });
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
      {/* Vote counter */}
      {ratedCount > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{ratedCount} rated this session</p>
      )}

      <div className="relative w-full h-[480px]">
        {visibleDogs.map((dog, i) => (
          <SwipeCard
            key={dog.id}
            dog={dog}
            isTop={i === 0}
            onSwipe={handleSwipe}
          />
        ))}
      </div>

      {/* Button controls */}
      <div className="flex items-center gap-4 mt-4">
        <motion.button
          onClick={() => handleSwipe('left')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="w-14 h-14 rounded-full bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400 text-2xl font-bold flex items-center justify-center shadow-soft-sm hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors"
          aria-label="Pass"
        >
          ✕
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
              className="h-11 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors overflow-hidden"
              title="Undo last swipe"
              aria-label="Undo last swipe"
            >
              {'\u21a9\ufe0f'}
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => handleSwipe('right')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="w-14 h-14 rounded-full bg-green-100 text-green-500 dark:bg-green-500/15 dark:text-green-400 text-2xl flex items-center justify-center shadow-soft-sm hover:bg-green-200 dark:hover:bg-green-500/25 transition-colors"
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
    </div>
  );
}
