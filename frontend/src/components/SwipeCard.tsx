import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import type { Dog } from '../types';
import { dogAge, dogHeroPhoto } from '../utils/time';

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
    if (info.offset.x > SWIPE_THRESHOLD) {
      animate(x, EXIT_X, { duration: 0.3 });
      onSwipe('right');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      animate(x, -EXIT_X, { duration: 0.3 });
      onSwipe('left');
    }
  };

  return (
    <motion.div
      className="absolute inset-0 bg-white rounded-2xl shadow-lg overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ x, rotate, zIndex: isTop ? 10 : 1 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={dog.name} className="w-full h-[70%] object-cover" />
      ) : (
        <div className="w-full h-[70%] bg-gradient-to-br from-brand-50 to-brand-100 flex flex-col items-center justify-center gap-2">
          <span className="text-5xl opacity-25">🐾</span>
          <p className="text-sm text-brand-300 font-medium">No photo yet</p>
        </div>
      )}

      {/* Like/Pass overlays */}
      <motion.div
        className="absolute top-6 right-6 bg-green-500 text-white px-4 py-2 rounded-xl text-xl font-bold rotate-12 border-4 border-green-500"
        style={{ opacity: likeOpacity }}
      >
        LIKE
      </motion.div>
      <motion.div
        className="absolute top-6 left-6 bg-red-400 text-white px-4 py-2 rounded-xl text-xl font-bold -rotate-12 border-4 border-red-400"
        style={{ opacity: passOpacity }}
      >
        PASS
      </motion.div>

      <div className="p-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold">{dog.name}</h2>
          {dog.birthday && (
            <span className="text-sm text-gray-400">{dogAge(dog.birthday)}</span>
          )}
        </div>
        {dog.breed_display && <p className="text-gray-500">{dog.breed_display}</p>}
        {dog.traits && dog.traits.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {dog.traits.slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[11px] rounded-full font-medium">
                {t}
              </span>
            ))}
            {dog.traits.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded-full font-medium">
                +{dog.traits.length - 3}
              </span>
            )}
          </div>
        )}
        {dog.bio && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{dog.bio}</p>}
      </div>
    </motion.div>
  );
}
