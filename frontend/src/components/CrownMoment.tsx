import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { WeeklyWinner } from '../types';
import Rosette from './brand/Rosette';
import Accent from './brand/Accent';
import BrandIcon from './brand/BrandIcon';
import PetPortrait from './brand/PetPortrait';
import { Crown } from './brand/RankMedal';
import { shareLink } from '../utils/shareLink';
import { formatWeekOf } from '../utils/weeklyReset';
import { photoIn } from '../utils/photoIn';

const SEEN_PREFIX = 'fetch.crown-moment.';
const seenKey = (w: WeeklyWinner) => `${SEEN_PREFIX}${w.week_bucket}.${w.pet_id}`;

// Remembered for this page load as well as in storage. Storage can be readable
// and not writable (full, or a locked-down browser); then nothing was recorded,
// the win still looked unseen, and Close and Escape did nothing at all.
const seenThisLoad = new Set<string>();

/** Has this owner already had the moment for this win? */
export function crownMomentSeen(w: WeeklyWinner): boolean {
  if (seenThisLoad.has(seenKey(w))) return true;
  try {
    return localStorage.getItem(seenKey(w)) === '1';
  } catch {
    return true; // no storage: don't risk showing it on every visit
  }
}

function markSeen(w: WeeklyWinner) {
  seenThisLoad.add(seenKey(w));
  try {
    localStorage.setItem(seenKey(w), '1');
  } catch {
    /* ignore */
  }
}

/**
 * The crown moment (Brand Book, The app → The crown moment). After the Monday
 * reset settles last week, the owners of the two winners — one Top Dog, one
 * Top Cat — get the only full-gold screen in the app: the rosette, the crown
 * dropping onto it, and the only accent marks the product allows itself.
 * Shown once per win. Pass `shareable` only when the pet's share page is
 * public; otherwise the link would land a friend on a 404.
 */
export default function CrownMoment({
  winner,
  shareable,
  onClose,
}: {
  winner: WeeklyWinner;
  shareable: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const title = winner.species === 'cat' ? 'Top Cat' : 'Top Dog';
  const name = winner.pet_name || 'Your pet';
  const week = formatWeekOf(winner.week_bucket);

  const close = () => {
    markSeen(winner);
    onClose();
  };

  // Escape reaches the latest `close` without re-binding the listener.
  const closeLatest = useRef(close);
  useEffect(() => {
    closeLatest.current = close;
  });

  // A drumroll in the hand on phones: two taps and a long one as the crown
  // lands. Not under reduced motion.
  useEffect(() => {
    if (!reduce) navigator.vibrate?.([30, 70, 30, 70, 140]);
  }, [reduce]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLatest.current();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  const share = () =>
    shareLink(`${window.location.origin}/pets/${winner.pet_id}`, `${name} won ${title} on Fetchpawz`);

  // Portalled: the page sits in a transformed (animated) column, which would
  // trap a fixed overlay under the app's top bar and tab bar.
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} is ${title}`}
      // Orange focus rings vanish on gold; on this one screen they are navy.
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-gold-500 px-6 text-navy [&_:focus-visible]:outline-navy"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* The only accent marks in the product. */}
      <Accent name="sparkle" className="absolute left-[9%] top-[12%] h-9 w-9 text-navy" />
      <Accent name="sparkle" className="absolute right-[12%] top-[22%] h-6 w-6 text-navy" />
      <Accent name="burst" className="absolute bottom-[16%] right-[10%] h-10 w-10 text-navy" />

      <button
        ref={closeRef}
        type="button"
        onClick={close}
        aria-label="Close"
        className="btn-icon absolute right-4 top-[max(1rem,env(safe-area-inset-top))] border-navy/40 bg-gold-400 text-navy hover:bg-gold-300"
      >
        <BrandIcon name="close" size={18} />
      </button>

      <div className="relative flex max-w-sm flex-col items-center text-center">
        <p className="eyebrow !text-navy">The votes are in</p>
        <motion.div
          className="relative mt-12"
          initial={reduce ? false : { scale: 0.6, rotate: -14, opacity: 0 }}
          animate={{ scale: 1, rotate: -4, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
        >
          <Rosette title={title} caption={week} className="w-48">
            {winner.primary_photo_url ? (
              <img ref={photoIn} src={winner.primary_photo_url} alt="" className="photo-in h-full w-full object-cover" />
            ) : (
              <PetPortrait species={winner.species} breed={winner.breed} seed={winner.pet_id} crop="face" background className="h-full w-full" />
            )}
          </Rosette>
          <span className="absolute -top-[42px] left-1/2 w-16 -translate-x-1/2 -rotate-6">
            <Crown className="block w-full animate-crown-drop [animation-delay:450ms]" />
          </span>
        </motion.div>
        <h2 className="mt-5 font-display text-[40px] leading-[0.95] tracking-tight text-balance">
          {name} is {title}
        </h2>
        <p className="mt-3 text-base font-semibold text-balance">
          {winner.score} {winner.score === 1 ? 'like' : 'likes'} in the week of {week}. The win stays on their profile for good.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {shareable ? (
            <button type="button" onClick={share} className="btn btn-paper btn-lg">
              <BrandIcon name="share" size={20} />
              Share the crown
            </button>
          ) : (
            <Link to={`/app/pets/${winner.pet_id}`} onClick={close} className="btn btn-paper btn-lg">
              <BrandIcon name="crown" size={20} />
              See {name}'s profile
            </Link>
          )}
          <Link to={`/app/rankings?species=${winner.species}`} onClick={close} className="link !text-navy !decoration-navy">
            See the rankings
          </Link>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
