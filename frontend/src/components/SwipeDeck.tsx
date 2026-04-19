import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
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
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <span className="text-4xl mb-3">{'\ud83c\udf89'}</span>
        <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          You've rated everyone this week!
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-1">
          {ratedCount > 0 ? `You rated ${ratedCount} dog${ratedCount > 1 ? 's' : ''} this session.` : ''}
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Come back Monday for a fresh batch of pups.</p>
        <Link to="/dogs/new">
          <Button>Share Your Dog</Button>
        </Link>
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
      </div>
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
        <button
          onClick={() => handleSwipe('left')}
          className="w-14 h-14 rounded-full bg-red-100 text-red-500 dark:text-red-400 text-2xl font-bold flex items-center justify-center hover:bg-red-200 transition-colors"
          aria-label="Pass"
        >
          ✕
        </button>

        {lastVote && (
          <button
            onClick={handleUndo}
            className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Undo last swipe"
            aria-label="Undo last swipe"
          >
            {'\u21a9\ufe0f'}
          </button>
        )}

        <button
          onClick={() => handleSwipe('right')}
          className="w-14 h-14 rounded-full bg-green-100 text-green-500 dark:text-green-400 text-2xl flex items-center justify-center hover:bg-green-200 transition-colors"
          aria-label="Like"
        >
          &#x2764;
        </button>
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
