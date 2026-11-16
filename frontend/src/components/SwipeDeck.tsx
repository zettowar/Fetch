import { useState, useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getFeed } from '../api/feed';
import { castVote, takeBackVote } from '../api/votes';
import SwipeCard from './SwipeCard';
import AdoptionPrompt from './AdoptionPrompt';
import RewardedAdModal from './RewardedAdModal';
import Button from './ui/Button';
import BrandIcon from './brand/BrandIcon';
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
import { apiErrorMessage } from '../utils/apiError';
import { dailyResetAt, weeklyResetAt } from '../utils/weeklyReset';
import type { Pet } from '../types';

const SEEN_PROMPTS_KEY = 'fetch.adoption_prompts_seen';

/**
 * A bigger deck where there is room for it: desktop width AND a tall window.
 * Width alone isn't enough — on a 768px-tall laptop a taller card pushes
 * Pass and Like below the fold, and the buttons are the point. Width and
 * height grow together (352×480 → 416×560) so the card keeps its shape and
 * the photo still shows ~90% of its square. Everything that lines up with the
 * card takes the same width.
 */
const ROOMY_WIDTH = '[@media(min-width:1024px)_and_(min-height:900px)]:max-w-md';
const ROOMY_HEIGHT = '[@media(min-width:1024px)_and_(min-height:900px)]:h-[560px]';
const KBD =
  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border-[1.5px] border-navy/30 bg-white px-1 font-mono text-2xs text-navy dark:border-white/25 dark:bg-night-surface dark:text-biscuit';

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
  const [likes, setLikes] = useState(0);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const quota = useSwipeQuota(Boolean(user) && !isSubscriber);
  const [adOpen, setAdOpen] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVoteRequest = useRef<Promise<unknown> | null>(null);
  const { fire: fireLikeBurst, PawBurstLayer } = usePawBurst();

  const quotaBlocked = !isSubscriber && quota.blocked;
  const remaining = quota.remaining;
  // The meter is for people on a daily allowance. A Pack+ member whose billing
  // status hasn't loaded yet (or failed to) is `!isSubscriber` with an
  // unlimited quota, and the counter read "Infinity swipes left today".
  const metered = Boolean(user) && !isSubscriber && !quota.unlimited;

  const [speciesFilter, setSpeciesFilter] = useSpeciesFilter();
  const {
    data: batch,
    dataUpdatedAt,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['feed', speciesFilter],
    queryFn: () => getFeed(30, filterToSpecies(speciesFilter)),
    // Never reuse a deck across visits. The cached batch still contains the
    // pets just voted on, and this component's index restarts at 0 on every
    // mount — so coming back within the cache window dealt the same cards
    // again, each of which the server then refused as a duplicate.
    gcTime: 0,
    // The deck asks for more cards when it runs low. Coming back to the tab is
    // not a reason to deal.
    refetchOnWindowFocus: false,
  });

  // The deck belongs to this component; the query only supplies cards for it.
  //
  // It used to *be* the query's data. Every refill returned a fresh shuffled
  // batch that replaced the deck and reset the index to 0, and a great deal
  // went wrong from that one decision: Rewind lost its button on the last
  // three cards of every batch (the refill cleared it), or restored an index
  // into a deck that no longer existed and skipped two dozen unrated pets;
  // "N rated this session" counted from the last refill; a refill racing the
  // vote that triggered it dealt the pet just swiped a second time; and a
  // refill that failed in the background replaced a deck that still had cards
  // in it with an error screen.
  //
  // Now a batch is appended: pets already dealt are skipped, the index only
  // ever means "position in this deck", and the deck starts over in exactly
  // one case — the species tab changed.
  const [deck, setDeck] = useState<{ filter: typeof speciesFilter; pets: Pet[]; mergedAt: number }>({
    filter: speciesFilter,
    pets: [],
    mergedAt: 0,
  });
  if (deck.filter !== speciesFilter) {
    setDeck({ filter: speciesFilter, pets: [], mergedAt: 0 });
    setCurrentIndex(0);
    setLastVote(null);
    setPrompt(null);
  } else if (batch && dataUpdatedAt !== deck.mergedAt) {
    const dealt = new Set(deck.pets.map((p) => p.id));
    const fresh = batch.filter((p) => !dealt.has(p.id));
    setDeck({
      filter: deck.filter,
      pets: fresh.length ? [...deck.pets, ...fresh] : deck.pets,
      mergedAt: dataUpdatedAt,
    });
  }
  const pets = deck.pets;

  const voteMutation = useMutation({
    mutationFn: ({ petId, value }: { petId: string; value: 1 | -1; index: number }) =>
      castVote(petId, value),
    onError: (err, vars) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // Already voted on this pet this week — the vote the user wanted is
        // (or was) recorded, so there is nothing to retry. Rewinding to the
        // card here made it un-passable: every swipe earned the same 409.
        // Give the local swipe back (the server counted nothing new) and
        // let the deck move on.
        if (!isSubscriber) quota.refund();
        return;
      }
      if (status === 404 || status === 400) {
        // The pet left the deck after it was dealt: deactivated, its owner's
        // account closed or suspended, or a block between you. That will never
        // succeed, and rewinding to the card (as for a network failure) wedged
        // the deck on it — every swipe earned the same 404. Same remedy as the
        // 409: give the swipe back and move on. There is no vote to rewind.
        if (!isSubscriber) quota.refund();
        setLastVote((lv) => (lv?.petId === vars.petId ? null : lv));
        return;
      }
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
      if (direction === 'right') {
        fireLikeBurst();
        setLikes((n) => n + 1);
      }
      setLastVote({ petId: pet.id, index: currentIndex });
      setCurrentIndex((i) => i + 1);
      // Kept so Rewind can wait for this request to land before taking it back.
      lastVoteRequest.current = voteMutation
        .mutateAsync({ petId: pet.id, value, index: currentIndex })
        .catch(() => undefined);
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

  // On a keyboard the arrows are the swipe: ← pass, → like. Not while typing,
  // with a modifier held, or with a dialog (an ad, a report) on top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      handleSwipe(e.key === 'ArrowRight' ? 'right' : 'left');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSwipe]);

  const handleUndo = async () => {
    if (!lastVote) return;
    if (!isSubscriber) {
      toast('Rewind is a Pack+ perk', { icon: <BrandIcon name="lock" size={18} /> });
      return;
    }
    const target = lastVote;
    setLastVote(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    navigator.vibrate?.([10, 40, 10]);
    try {
      // The vote has to actually come back, not just the card. Wait for the
      // swipe's own request first — taking back a vote that hasn't landed yet
      // would leave it in place once it does.
      await lastVoteRequest.current;
      await takeBackVote(target.petId);
    } catch {
      toast.error("Couldn't undo that swipe");
      return;
    }
    setCurrentIndex(target.index);
    setPrompt(null);
    toast('Swipe undone.');
  };

  // Say it worked once it has. The toast used to fire before the request was
  // even sent, so a failed grant read "+25 swipes unlocked" over a deck that
  // stayed blocked. The ref stops a double tap claiming twice while the modal
  // animates out.
  const claiming = useRef(false);
  const handleReward = async () => {
    if (!user || claiming.current) return;
    claiming.current = true;
    try {
      await quota.grantReward();
      toast.success(`+${REWARD_INCREMENT} swipes unlocked`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't unlock more swipes. Try again."));
    } finally {
      claiming.current = false;
    }
  };

  if (isLoading) {
    return (
      // Card-width on wider screens too, not a 640px-wide placeholder.
      <div className={`px-4 sm:mx-auto sm:max-w-sm ${ROOMY_WIDTH}`}>
        <CardSkeleton />
      </div>
    );
  }

  const remainingDogs = pets.slice(currentIndex);

  // Only when there is nothing to show. A refill that fails in the background
  // also sets `isError`, and the cards already dealt are still good.
  if (isError && remainingDogs.length === 0) {
    return (
      <ErrorState
        message="Couldn't load the feed."
        onRetry={() => refetch()}
      />
    );
  }

  // The last card went while a refill was still on its way: wait for it rather
  // than flash "you've rated everyone" and then deal more.
  if (remainingDogs.length === 0 && isFetching) {
    return (
      <div className={`px-4 sm:mx-auto sm:max-w-sm ${ROOMY_WIDTH}`}>
        <CardSkeleton />
      </div>
    );
  }

  // Position in this deck, which is the number rated on this tab: the deck is
  // only ever appended to, and starts again when the species tab changes.
  const ratedCount = currentIndex;
  // The end state has to tell two different stories. "You've rated everyone"
  // is only true for someone who just rated; a first-time visitor whose deck
  // came back empty (a species tab with nobody in it yet, a quiet launch city)
  // has rated nothing, and congratulating them reads as a bug.
  const scopedSpecies = filterToSpecies(speciesFilter);
  const endTitle =
    ratedCount === 0
      ? "You're all caught up"
      : scopedSpecies
        ? `You've rated every ${scopedSpecies} this week!`
        : "You've rated everyone this week!";
  // The week turns over at Monday 00:00 UTC, which is Sunday evening across
  // the Americas. "Come back Monday" sent people in Toronto a day late, so the
  // copy names the reset in the reader's own time.
  const resetAt = weeklyResetAt();
  const endBody = scopedSpecies
    ? `No more ${scopedSpecies}s to rate right now. Try the full deck, or come back ${resetAt} for a fresh round.`
    : ratedCount === 0
      ? `No pets to rate right now. New pets join all the time, and votes reset ${resetAt}.`
      : `Come back ${resetAt} for a fresh batch of pets.`;

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
          <PetIllustration species={filterToSpecies(speciesFilter) ?? 'dog'} name={ratedCount > 0 ? 'ball' : 'sleeping'} className="h-32 w-auto" />
        </motion.span>
        <motion.p
          className="text-xl font-extrabold tracking-tight text-navy dark:text-biscuit mb-2 text-balance"
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        >
          {endTitle}
        </motion.p>
        {ratedCount > 0 && (
          <motion.p
            className="text-gray-600 dark:text-gray-300 mb-1"
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
          >
            {`You rated ${ratedCount} pet${ratedCount > 1 ? 's' : ''} this session.`}
          </motion.p>
        )}
        <motion.p
          className="text-gray-600 dark:text-gray-300 text-sm mb-6 text-balance max-w-xs"
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
        >
          {endBody}
        </motion.p>
        <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
          {scopedSpecies ? (
            // A scoped deck that ran dry is rarely the whole app running dry —
            // one tap widens it rather than sending them away.
            <Button onClick={() => setSpeciesFilter('all')}>See all pets</Button>
          ) : (
            <Link to="/app/home" className="btn btn-secondary">
              Back to Home
            </Link>
          )}
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
      <div className={`w-full max-w-sm px-4 mb-2 flex flex-col gap-1 ${ROOMY_WIDTH}`}>
        {metered ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">
                <b className="font-extrabold text-navy dark:text-biscuit">{remaining}</b>{' '}
                {remaining === 1 ? 'swipe' : 'swipes'} left today
              </span>
              {ratedCount > 0 && (
                <span className="text-gray-500 dark:text-gray-400">{ratedCount} rated</span>
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
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {ratedCount} rated this session
            </span>
          )
        )}
      </div>

      <div className={`relative w-full max-w-sm px-4 h-[480px] ${ROOMY_WIDTH} ${ROOMY_HEIGHT}`}>
        <div className="relative h-full w-full">
        {visibleDogs.map((pet, i) => (
          <SwipeCard
            key={pet.id}
            pet={pet}
            isTop={i === 0}
            onSwipe={handleSwipe}
          />
        ))}

        {quotaBlocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            {/* The ball doodle is waiting to play. The offer is honest: an
                ad for more swipes, or Pack+. */}
            <div className="w-full rounded-3xl border-[2.5px] border-navy bg-white p-5 text-center shadow-toy dark:border-white/15 dark:bg-night-surface">
              <PetIllustration
                species={filterToSpecies(speciesFilter) ?? 'dog'}
                name="ball"
                className="mx-auto mb-2 h-24 w-auto"
              />
              <h3 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit text-balance">
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">Daily cap reached. Swipes refill at {dailyResetAt()}.</p>
                )}
                <Link to="/app/billing" className="text-sm font-extrabold text-brand-700 hover:underline dark:text-brand-400">
                  Subscribe to Pack+ →
                </Link>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Button controls: Pass is white, Like is orange, Undo is the small
          one in between. All round, all on a navy ledge. */}
      <div className="flex items-center gap-4 mt-4">
        <motion.button
          onClick={() => handleSwipe('left')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="w-16 h-16 rounded-full border-[2.5px] border-navy bg-white text-navy flex items-center justify-center shadow-ledge transition-colors hover:bg-gray-50"
          aria-label="Pass"
          aria-keyshortcuts="ArrowLeft"
          title="Pass (←)"
        >
          <BrandIcon name="pass" size={30} />
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
              className={`h-11 rounded-full border-2 text-sm flex items-center justify-center transition-colors overflow-hidden ${
                isSubscriber
                  ? 'border-navy bg-white text-navy shadow-ledge-sm hover:bg-gray-50'
                  : 'border-dashed border-navy/40 bg-white/60 text-gray-500 dark:border-white/30 dark:bg-night-surface dark:text-gray-400'
              }`}
              title={isSubscriber ? 'Undo last swipe' : 'Rewind is a Pack+ perk'}
              aria-label={isSubscriber ? 'Undo last swipe' : 'Rewind (Pack+ only)'}
            >
              {isSubscriber ? <BrandIcon name="undo" size={20} /> : <BrandIcon name="lock" size={18} />}
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => handleSwipe('right')}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="relative w-16 h-16 rounded-full border-[2.5px] border-navy bg-brand-500 text-navy flex items-center justify-center shadow-ledge transition-colors hover:bg-brand-400"
          aria-label="Like"
          aria-keyshortcuts="ArrowRight"
          title="Like (→)"
        >
          {/* Re-keyed per like so the heart wags every time (Brand Book, Motion → wag). */}
          <span key={likes} className={likes ? 'animate-wag' : undefined}>
            <BrandIcon name="like" size={30} style={{ '--bean': '#FFFFFF' } as React.CSSProperties} />
          </span>
          <PawBurstLayer />
        </motion.button>
      </div>

      {/* The arrow keys swipe too (the handler above). Said once, quietly, and
          only where there is a keyboard and a mouse: never on a phone, and
          not on a touch tablet, where it would be a hint about nothing. */}
      {!quotaBlocked && (
        <p className="mt-3 hidden items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 [@media(min-width:640px)_and_(hover:hover)]:flex">
          <kbd className={KBD}>←</kbd> pass
          <span aria-hidden className="px-0.5">·</span>
          <kbd className={KBD}>→</kbd> like
        </p>
      )}

      {/* Adoption prompt (after right-swipe on a rescue pet) */}
      {prompt && (
        <div className={`w-full max-w-sm mt-3 px-4 ${ROOMY_WIDTH}`}>
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
        <div className={`w-full max-w-sm mt-4 px-4 ${ROOMY_WIDTH}`}>
          <Link
            to="/app/billing"
            className="block rounded-2xl bg-white dark:bg-night-surface border border-dashed border-navy/25 dark:border-white/20 px-3.5 py-2.5 hover:border-navy/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="eyebrow leading-none">
                  Ad
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                  Go ad-free with Pack+
                </p>
              </div>
              <span className="text-xs font-extrabold text-brand-700 dark:text-brand-400 flex-shrink-0">Upgrade →</span>
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
