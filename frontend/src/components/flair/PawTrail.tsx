import PawMark from '../ui/PawMark';

interface PawTrailProps {
  steps?: number;
  /** Walk angle in degrees; default heads up-and-right. */
  direction?: number;
  /** Paw size in px. */
  size?: number;
  className?: string;
}

/**
 * Decorative trail of paw prints "walking away" — alternating left/right
 * steps, fading toward the tail. Pure ornament for hero sections; the
 * caller positions and colors it, e.g.
 * `className="absolute -top-1 right-2 text-brand-300/40 dark:text-brand-500/20"`.
 */
export default function PawTrail({ steps = 5, direction = -30, size = 16, className = '' }: PawTrailProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none inline-flex items-center ${className}`}
      style={{ transform: `rotate(${direction}deg)`, gap: size * 0.6 }}
    >
      {Array.from({ length: steps }).map((_, i) => (
        <span
          key={i}
          style={{
            transform: `translateY(${i % 2 === 0 ? size * 0.3 : -size * 0.3}px)`,
            opacity: Math.max(0.15, 1 - i * 0.12),
          }}
        >
          <PawMark decorative className="rotate-90" style={{ width: size, height: size }} />
        </span>
      ))}
    </div>
  );
}
