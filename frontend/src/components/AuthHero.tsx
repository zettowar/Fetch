import type { ReactNode } from 'react';
import PawMark from './ui/PawMark';

type Tone = 'brand' | 'purple';

interface AuthHeroProps {
  title: string;
  subtitle?: ReactNode;
  /** Replaces the default PawMark inside the glass circle. */
  icon?: ReactNode;
  tone?: Tone;
}

const TONES: Record<Tone, { gradient: string; blob: string }> = {
  brand: {
    gradient: 'from-brand-400 via-brand-500 to-brand-600',
    blob: 'bg-brand-700/30',
  },
  purple: {
    gradient: 'from-purple-500 via-purple-600 to-purple-700',
    blob: 'bg-purple-800/30',
  },
};

/**
 * Gradient mini-hero shared by the auth screens (login / signup / reset /
 * verify): brand gradient, soft blur blobs, a glass icon circle, and a
 * title + subtitle. Rescue signup uses the purple tone.
 */
export default function AuthHero({ title, subtitle, icon, tone = 'brand' }: AuthHeroProps) {
  const t = TONES[tone];
  return (
    <section
      className={`relative overflow-hidden rounded-b-3xl bg-gradient-to-br ${t.gradient} text-white px-6 pt-8 pb-10`}
    >
      <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className={`pointer-events-none absolute -bottom-16 -left-12 w-52 h-52 rounded-full ${t.blob} blur-3xl`} />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-soft-lg ring-1 ring-white/20">
          {icon ?? <PawMark className="h-11 w-11 text-white" />}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-white/90 max-w-xs">{subtitle}</p>}
      </div>
    </section>
  );
}
