import type { CSSProperties, ReactNode } from 'react';
import PetPortrait from './brand/PetPortrait';

/** `purple` is the old name for the rescue tone, kept for existing callers. */
type Tone = 'brand' | 'rescue' | 'purple';

interface AuthHeroProps {
  title: string;
  subtitle?: ReactNode;
  /** Replaces the default cast row with one icon on a colour disc. */
  icon?: ReactNode;
  tone?: Tone;
}

/**
 * The form card every auth screen sits its form (or result) in: white, the
 * 2.5px Leash Navy line and the toy shadow.
 */
export const AUTH_CARD =
  'toy w-full max-w-sm mx-auto rounded-3xl bg-white dark:bg-night-surface p-5 sm:p-6';

/** Small text links under and inside the auth cards. */
export const AUTH_LINK = 'font-bold text-brand-700 dark:text-brand-400 hover:underline';

// Three of the cast, one cat between two dogs, the middle one raised.
const CAST = [
  { id: 'corgi', className: 'h-16 w-16 -rotate-6 translate-y-1' },
  { id: 'tuxedo', className: 'relative z-10 h-20 w-20 shadow-toy' },
  { id: 'pittie', className: 'h-16 w-16 rotate-6 translate-y-1' },
];

// On a colour disc the drawn icon's bean turns white, the stroke stays navy.
const BEAN_ON_COLOUR = { '--bean': '#fff' } as CSSProperties;

/**
 * The flat mini-hero shared by the auth screens (login / signup / reset /
 * verify): a row of the cast — or one icon on a Ball Orange disc (Forever
 * Pink for rescues) — over a Bagel Fat One title and a plain subtitle. No
 * gradient, navy on colour.
 */
export default function AuthHero({ title, subtitle, icon, tone = 'brand' }: AuthHeroProps) {
  const rescue = tone === 'rescue' || tone === 'purple';
  return (
    <section className="flex flex-col items-center px-4 pt-4 text-center">
      {icon ? (
        <div
          style={BEAN_ON_COLOUR}
          className={`toy flex h-16 w-16 items-center justify-center rounded-full text-navy ${
            rescue ? 'bg-pink-500' : 'bg-brand-500'
          }`}
        >
          {icon}
        </div>
      ) : (
        <div aria-hidden className="flex items-end justify-center -space-x-3">
          {CAST.map((c) => (
            <span
              key={c.id}
              className={`block overflow-hidden rounded-full border-[2.5px] border-navy dark:border-night-raised ${c.className}`}
            >
              <PetPortrait id={c.id} crop="face" background className="block h-full w-full" />
            </span>
          ))}
        </div>
      )}
      <h1 className="mt-5 text-[34px] leading-[1.05] text-navy dark:text-biscuit text-balance">{title}</h1>
      {subtitle && (
        <p className="mt-2 max-w-sm text-[15px] leading-snug text-gray-600 dark:text-gray-300 text-balance">
          {subtitle}
        </p>
      )}
    </section>
  );
}
