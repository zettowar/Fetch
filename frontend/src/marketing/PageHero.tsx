import type { ReactNode } from 'react';
import PawTrail from '../components/flair/PawTrail';
import PetPortrait from '../components/brand/PetPortrait';

/**
 * Compact hero shared by the interior marketing pages (About / Mission /
 * News / legal) so they feel like one website.
 *
 * `orange` (default) is a flat Ball Orange band with navy type — navy on
 * colour, never white — and an optional row of the cast. `quiet` is for the
 * legal pages: the Biscuit page, a hairline, the Bagel title and nothing else.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  tone = 'orange',
  cast,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  tone?: 'orange' | 'quiet';
  /** Portrait ids (`portraitIndex.ts`) to show as a row of faces above the eyebrow. */
  cast?: string[];
}) {
  if (tone === 'quiet') {
    return (
      <section className="border-b border-navy/10 dark:border-white/10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-14 pb-10 lg:pt-16 lg:pb-12 text-center">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 text-[36px] sm:text-[44px] leading-[1.02] text-navy dark:text-biscuit text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 mx-auto max-w-2xl text-base text-gray-600 dark:text-gray-300 leading-relaxed text-balance">
              {subtitle}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border-b-[2.5px] border-navy bg-brand-500 text-navy dark:border-night-raised">
      <PawTrail steps={4} size={16} className="absolute bottom-8 left-[6%] text-navy/15" />
      <PawTrail steps={4} size={14} direction={-150} className="absolute top-10 right-[7%] hidden text-navy/10 sm:inline-flex" />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
        {cast && cast.length > 0 && (
          <div aria-hidden className="mb-6 flex items-end justify-center -space-x-2.5">
            {cast.map((id, i) => {
              // The middle face is raised on the toy shadow; the rest lean in.
              const mid = Math.floor(cast.length / 2);
              return (
                <span
                  key={id}
                  className={`block overflow-hidden rounded-full border-[2.5px] border-navy ${
                    i === mid
                      ? 'relative z-10 h-16 w-16 shadow-toy'
                      : `h-14 w-14 translate-y-1 ${i < mid ? '-rotate-6' : 'rotate-6'}`
                  }`}
                >
                  <PetPortrait id={id} crop="face" background className="block h-full w-full" />
                </span>
              );
            })}
          </div>
        )}
        <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-navy">{eyebrow}</p>
        <h1 className="mt-3 text-[40px] sm:text-[56px] leading-[0.98] text-balance">{title}</h1>
        {subtitle && (
          <p className="mt-4 mx-auto max-w-2xl text-lg font-medium text-navy leading-relaxed text-balance">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
