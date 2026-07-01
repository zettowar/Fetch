import type { ReactNode } from 'react';
import PawMark from '../components/ui/PawMark';

/**
 * Compact gradient hero shared by the interior marketing pages
 * (About / Mission / News) so they feel like one website.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
      <PawMark decorative className="pointer-events-none absolute bottom-6 right-[10%] h-12 w-12 text-white/10 rotate-6" />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-white/80">{eyebrow}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-balance">{title}</h1>
        {subtitle && (
          <p className="mt-4 mx-auto max-w-2xl text-lg text-white/90 leading-relaxed text-balance">{subtitle}</p>
        )}
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent" />
    </section>
  );
}
