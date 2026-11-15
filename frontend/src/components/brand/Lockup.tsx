import PawMark from '../ui/PawMark';
import Wordmark from './Wordmark';

/**
 * Mark + wordmark. The horizontal lockup is the default; `stacked` is for
 * square spaces. The mark takes `markClassName` (Ball Orange by default) and
 * the word takes the surrounding text colour, so on a colour fill pass
 * `markClassName="text-navy"` and set navy text on the parent: navy on color.
 * Sized by the parent's font-size (`text-2xl` etc.).
 */
export default function Lockup({
  stacked = false,
  wag = false,
  markClassName = 'text-brand-500',
  className = '',
  title = 'Fetchpawz',
}: {
  stacked?: boolean;
  wag?: boolean;
  markClassName?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={`inline-flex items-center leading-none ${stacked ? 'flex-col gap-[0.12em]' : 'gap-[0.2em]'} ${className}`}
    >
      <PawMark
        decorative
        className={`shrink-0 ${stacked ? 'h-[1.6em] w-[1.6em]' : 'h-[1.12em] w-[1.12em]'} ${markClassName}`}
      />
      <Wordmark decorative wag={wag} className={stacked ? 'h-[0.88em] w-auto' : 'h-[1em] w-auto'} />
    </span>
  );
}
