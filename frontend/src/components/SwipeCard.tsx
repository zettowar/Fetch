import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HousePlus } from 'lucide-react';
import type { Dog } from '../types';
import { dogAge, dogHeroPhoto } from '../utils/time';
import Badge from './ui/Badge';
import DogIllustration from './flair/DogIllustration';

interface SwipeCardProps {
  dog: Dog;
  onSwipe: (direction: 'left' | 'right') => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 120;
const EXIT_X = 500;

export default function SwipeCard({ dog, onSwipe, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const photoUrl = dogHeroPhoto(dog);

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

  return (
    <motion.div
      className="absolute inset-0 bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden cursor-grab active:cursor-grabbing"
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
      {photoUrl ? (
        <img src={photoUrl} alt={dog.name} className="w-full h-[70%] object-cover" />
      ) : (
        <div className="w-full h-[70%] bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 flex flex-col items-center justify-center gap-2">
          <DogIllustration name="sleeping" className="h-24 w-auto text-brand-300 dark:text-brand-400/60" />
          <p className="text-sm text-brand-300 dark:text-brand-400/80 font-medium">No photo yet</p>
        </div>
      )}

      {/* Rescue badge — links to the rescue's profile, on top of the photo */}
      {dog.rescue_id && (
        <Link
          to={`/app/rescues/${dog.rescue_id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-2xs font-semibold px-2.5 py-1 shadow-soft-sm hover:bg-brand-600 transition-colors"
          aria-label={`Rescue · ${dog.rescue_name ?? 'View rescue profile'}`}
        >
          <HousePlus size={12} aria-hidden />
          <span className="max-w-[140px] truncate">
            {dog.rescue_name ?? 'Rescue'}
          </span>
        </Link>
      )}

      {/* Like/Pass overlays */}
      <motion.div
        className="absolute top-6 right-6 bg-success-500 text-white px-4 py-2 rounded-xl text-xl font-bold rotate-12 border-4 border-success-500"
        style={{ opacity: likeOpacity }}
      >
        LIKE
      </motion.div>
      <motion.div
        className="absolute top-6 left-6 bg-danger-400 text-white px-4 py-2 rounded-xl text-xl font-bold -rotate-12 border-4 border-danger-400"
        style={{ opacity: passOpacity }}
      >
        PASS
      </motion.div>

      <div className="p-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold">{dog.name}</h2>
          {dog.birthday && (
            <span className="text-sm text-gray-400 dark:text-gray-500">{dogAge(dog.birthday)}</span>
          )}
        </div>
        {dog.breed_display && <p className="text-gray-500 dark:text-gray-400">{dog.breed_display}</p>}
        {dog.traits && dog.traits.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {dog.traits.slice(0, 3).map((t) => (
              <Badge key={t} variant="brand">
                {t}
              </Badge>
            ))}
            {dog.traits.length > 3 && <Badge variant="neutral">+{dog.traits.length - 3}</Badge>}
          </div>
        )}
        {dog.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{dog.bio}</p>}
      </div>
    </motion.div>
  );
}
