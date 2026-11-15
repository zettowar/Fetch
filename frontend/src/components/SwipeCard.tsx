import type React from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Pet } from '../types';
import { petAge, petHeroPhoto } from '../utils/time';
import BrandIcon from './brand/BrandIcon';
import PetPortrait, { portraitFor, portraitTint } from './brand/PetPortrait';

interface SwipeCardProps {
  pet: Pet;
  onSwipe: (direction: 'left' | 'right') => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 120;
const EXIT_X = 500;

export default function SwipeCard({ pet, onSwipe, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const photoUrl = petHeroPhoto(pet);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocityBoost = Math.min(Math.abs(info.velocity.x) / 4, 300);
    if (info.offset.x > SWIPE_THRESHOLD) {
      animate(x, EXIT_X + velocityBoost, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
      onSwipe('right');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      animate(x, -(EXIT_X + velocityBoost), { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
      onSwipe('left');
    } else {
      // Snap back with a soft spring
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 28 });
    }
  };

  const portrait = portraitFor(pet.species, pet.breed_display, pet.id);

  // The trading card (Brand Book, The app → Swipe): white, a 2.5px Leash Navy
  // line and the toy shadow, the photo on top over a navy rule, the name in
  // Bagel Fat One. Pass is white, Like is orange — the card never shows red.
  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-3xl border-[2.5px] border-navy bg-white shadow-toy cursor-grab active:cursor-grabbing dark:border-white/15 dark:bg-night-surface"
      style={{ x, rotate, zIndex: isTop ? 10 : 1 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      initial={{ scale: isTop ? 0.96 : 0.92, y: isTop ? 0 : 10, opacity: 0 }}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 8, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div className="relative h-[62%] shrink-0 border-b-[2.5px] border-navy dark:border-white/15">
        {photoUrl ? (
          <img src={photoUrl} alt={pet.name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div
            className="flex h-full w-full items-end justify-center"
            style={{ background: portraitTint(portrait) }}
          >
            <PetPortrait id={portrait} className="h-[96%] w-auto" title={`${pet.name}, no photo yet`} />
          </div>
        )}

        {/* Rescue pill — Forever Pink means a pet who needs a home. Links to
            the rescue's profile, on top of the photo. */}
        {pet.rescue_id && (
          <Link
            to={`/app/rescues/${pet.rescue_id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 rounded-full border-2 border-navy bg-pink-500 px-2.5 py-1 text-2xs font-extrabold text-navy transition-transform hover:-translate-y-px"
            aria-label={`Rescue · ${pet.rescue_name ?? 'View rescue profile'}`}
          >
            <BrandIcon name="rescue" size={14} style={{ '--bean': '#FFFFFF' } as React.CSSProperties} />
            <span className="max-w-[140px] truncate">{pet.rescue_name ?? 'Needs a home'}</span>
          </Link>
        )}

        {/* Species tag */}
        <span
          className="absolute top-3 right-3 z-20 inline-flex items-center rounded-full border-2 border-navy bg-white px-2.5 py-1 text-2xs font-extrabold text-navy"
          aria-label={pet.species === 'cat' ? 'Cat' : 'Dog'}
          title={pet.species === 'cat' ? 'Cat' : 'Dog'}
        >
          {pet.species === 'cat' ? 'Cat' : 'Dog'}
        </span>

        {/* Like / Pass stamps */}
        <motion.div
          className="absolute top-14 right-5 z-20 rotate-12 rounded-xl border-[3px] border-navy bg-brand-500 px-4 py-1.5 font-display text-2xl text-navy shadow-toy-sm"
          style={{ opacity: likeOpacity }}
        >
          Like
        </motion.div>
        <motion.div
          className="absolute top-14 left-5 z-20 -rotate-12 rounded-xl border-[3px] border-navy bg-white px-4 py-1.5 font-display text-2xl text-navy shadow-toy-sm"
          style={{ opacity: passOpacity }}
        >
          Pass
        </motion.div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 pt-3 pb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="truncate font-display text-[30px] leading-none text-navy dark:text-biscuit">{pet.name}</h2>
          {pet.birthday && (
            <span className="shrink-0 text-sm font-bold text-gray-500 dark:text-gray-400">
              {petAge(pet.birthday, pet.species)}
            </span>
          )}
        </div>
        {pet.breed_display && (
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{pet.breed_display}</p>
        )}
        {pet.traits && pet.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pet.traits.slice(0, 3).map((t) => (
              <span key={t} className="chip px-2 py-0.5 text-xs">
                {t}
              </span>
            ))}
            {pet.traits.length > 3 && (
              <span className="chip chip-add px-2 py-0.5 text-xs">+{pet.traits.length - 3}</span>
            )}
          </div>
        )}
        {pet.bio && (
          <p className="line-clamp-2 text-sm leading-snug text-navy/80 dark:text-biscuit/80">{pet.bio}</p>
        )}
      </div>
    </motion.div>
  );
}
