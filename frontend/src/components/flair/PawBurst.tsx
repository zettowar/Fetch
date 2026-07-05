import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import PawMark from '../ui/PawMark';

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  delay: number;
  colorClass: string;
}

const COLORS = ['text-brand-400', 'text-brand-500', 'text-amber-400'];

/**
 * Celebration burst of paw prints — likes, weekly wins, adoption
 * inquiries. Render `<PawBurstLayer />` once inside a `relative` parent,
 * then call `fire()` on the happy moment. No canvas, no exit phases;
 * each fire() replaces the particle set. Reduced motion → no-op.
 */
export function usePawBurst() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const reduceMotion = useReducedMotion();
  const nextId = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const fire = useCallback(
    (opts?: { count?: number }) => {
      if (reduceMotion) return;
      const count = opts?.count ?? 10;
      const fresh: Particle[] = Array.from({ length: count }, (_, i) => {
        // spread evenly with a little per-index wobble so it never
        // needs Math.random (deterministic + test-friendly)
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.35;
        const distance = 40 + ((i * 17) % 50);
        return {
          id: nextId.current++,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 20,
          rotate: ((i * 53) % 90) - 45,
          scale: 0.5 + ((i * 13) % 10) / 20,
          delay: ((i * 7) % 4) * 0.03,
          colorClass: COLORS[i % COLORS.length],
        };
      });
      setParticles(fresh);
      clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setParticles([]), 1200);
    },
    [reduceMotion],
  );

  const PawBurstLayer: FC<{ className?: string }> = useCallback(
    ({ className = '' }) => (
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible ${className}`}
      >
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className={`absolute ${p.colorClass}`}
            initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: p.y, scale: p.scale, opacity: 0, rotate: p.rotate }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: p.delay }}
          >
            <PawMark decorative className="h-4 w-4" />
          </motion.span>
        ))}
      </span>
    ),
    [particles],
  );

  return { fire, PawBurstLayer };
}
