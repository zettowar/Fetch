import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import PawMark from '../components/ui/PawMark';
import { Spinner } from '../components/ui/Skeleton';

const OWNER_FEATURES = [
  {
    icon: '❤️',
    title: 'Swipe & rate',
    body: 'Tinder-style feed of good boys and girls. One tap, one vote.',
  },
  {
    icon: '🏆',
    title: 'Weekly top dog',
    body: 'Votes reset every Monday. Crown a new community favorite every week.',
  },
  {
    icon: '🚨',
    title: 'Lost & Found',
    body: 'Nearby missing-dog alerts and sighting reports. A safety net for your pack.',
  },
  {
    icon: '🐾',
    title: 'Follow your faves',
    body: "Keep tabs on the pups you can't get enough of.",
  },
];

const RESCUE_FEATURES = [
  {
    icon: '🏠',
    title: 'List adoptables',
    body: 'Photos, traits, and a story — your dogs show up in the swipe feed.',
  },
  {
    icon: '💬',
    title: 'Manage inquiries',
    body: 'Inbound interest, organized. Status, notes, history in one place.',
  },
  {
    icon: '🗺️',
    title: 'Map presence',
    body: 'Adopters discover your org on the rescue map by location.',
  },
  {
    icon: '🤝',
    title: 'Smooth handoff',
    body: 'Mark adoptions complete or transfer the dog to its new family on Fetch.',
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }
  if (isAuthenticated) {
    return (
      <Navigate
        to={user?.role === 'rescue' ? '/rescue/dashboard' : '/home'}
        replace
      />
    );
  }

  return (
    <div className="flex flex-col pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white px-6 pt-12 pb-14">
        {/* Layered ambient blobs for depth. */}
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 w-72 h-72 rounded-full bg-brand-800/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/4 w-32 h-32 rounded-full bg-amber-300/20 blur-2xl" />

        {/* Scattered paw confetti — pure decoration. */}
        <PawMark decorative className="pointer-events-none absolute top-6 left-4 h-8 w-8 text-white/10 -rotate-12" />
        <PawMark decorative className="pointer-events-none absolute top-20 right-6 h-6 w-6 text-white/10 rotate-12" />
        <PawMark decorative className="pointer-events-none absolute bottom-10 right-10 h-10 w-10 text-white/[0.08] -rotate-6" />
        <PawMark decorative className="pointer-events-none absolute bottom-20 left-8 h-7 w-7 text-white/10 rotate-[20deg]" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ring-white/20">
            <span aria-hidden>🐾</span> The home of good dogs
          </span>

          <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance">
            Rate good dogs.
            <br />
            <span className="text-white/85">Crown the top pup.</span>
          </h1>

          <p className="mt-4 text-base font-medium text-white/90 max-w-sm text-balance">
            Swipe the feed, follow your favorites, and crown a new champion
            every week. Adoptable rescue dogs slot right in.
          </p>
        </div>
      </section>

      {/* Two-path chooser — compact cards on a neutral surface */}
      <section className="px-4 mt-7 relative">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center mb-3">
          Pick your path
        </p>
        <div className="flex flex-col gap-3">
          <PathCard
            accent="brand"
            eyebrow="Dog owners"
            iconEmoji="🐶"
            title="Rate, follow, find."
            body="Swipe, follow, crown a weekly top dog. Lost & Found built in."
            primary={{ to: '/signup', label: 'Get started' }}
            secondary={{ to: '/login', label: 'Log in' }}
          />
          <PathCard
            accent="purple"
            eyebrow="Rescues & partners"
            iconEmoji="🏠"
            title="Reach adopters where they swipe."
            body="List adoptable dogs, manage inquiries, find forever-home matches."
            primary={{ to: '/signup-rescue', label: 'Apply to join' }}
            secondary={{ to: '/login', label: 'Rescue log in' }}
          />
        </div>
      </section>

      {/* What's inside — owners */}
      <FeatureSection
        eyebrow="For dog owners"
        title="Everything dog people actually want"
        accent="brand"
        features={OWNER_FEATURES}
      />

      {/* What's inside — rescues */}
      <FeatureSection
        eyebrow="For rescues"
        title="Adoption tools, without the spreadsheet"
        accent="purple"
        features={RESCUE_FEATURES}
      />

      {/* How it works */}
      <section className="px-6 mt-10">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center">
          How it works
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-center">
          Three quick steps
        </h2>

        <ol className="mt-5 flex flex-col gap-3">
          <Step n={1} title="Pick your path" body="Sign up as an owner or apply as a rescue. Same login, separate spaces." />
          <Step n={2} title="Build your profile" body="Owners: photos, breeds, traits. Rescues: org details and your first adoptable." />
          <Step n={3} title="Meet the pack" body="Owners climb the rankings; rescues meet potential adopters. Everybody wins." />
        </ol>
      </section>

      {/* Closing nudge */}
      <section className="px-4 mt-10">
        <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-center shadow-soft-sm">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">Ready to join the pack?</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Free to start. No ads, no feed tricks.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/signup"
              className="block w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl text-center transition-colors active:scale-[0.98]"
            >
              Sign up
            </Link>
            <Link
              to="/signup-rescue"
              className="block w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2.5 rounded-xl text-center transition-colors active:scale-[0.98]"
            >
              Apply as rescue
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Already in?{' '}
            <Link to="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

type Accent = 'brand' | 'purple';

interface PathCardProps {
  accent: Accent;
  eyebrow: string;
  iconEmoji: string;
  title: string;
  body: string;
  primary: { to: string; label: string };
  secondary: { to: string; label: string };
}

function PathCard({ accent, eyebrow, iconEmoji, title, body, primary, secondary }: PathCardProps) {
  // Centralize the per-accent class strings so the card itself stays terse.
  const a = accent === 'brand'
    ? {
        card: 'bg-white dark:bg-gray-900 ring-1 ring-brand-200 dark:ring-brand-500/30 shadow-brand-glow',
        iconRing: 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow',
        eyebrow: 'text-brand-600 dark:text-brand-400',
        primaryBtn: 'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white',
        secondaryLink: 'text-brand-600 dark:text-brand-400 hover:text-brand-700',
      }
    : {
        card: 'bg-white dark:bg-gray-900 ring-1 ring-purple-200 dark:ring-purple-500/30 shadow-[0_8px_24px_-8px_rgba(147,51,234,0.35)]',
        iconRing: 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-[0_8px_24px_-8px_rgba(147,51,234,0.45)]',
        eyebrow: 'text-purple-600 dark:text-purple-400',
        primaryBtn: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white',
        secondaryLink: 'text-purple-600 dark:text-purple-400 hover:text-purple-700',
      };

  return (
    <article className={`relative overflow-hidden rounded-2xl p-5 ${a.card}`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl leading-none ${a.iconRing}`}
        >
          {iconEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] uppercase tracking-widest font-semibold ${a.eyebrow}`}>
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h2>
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-snug">
        {body}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Link
          to={primary.to}
          className={`flex-1 font-semibold py-2.5 rounded-xl text-center transition-colors active:scale-[0.98] ${a.primaryBtn}`}
        >
          {primary.label}
        </Link>
        <Link
          to={secondary.to}
          className={`text-sm font-medium whitespace-nowrap ${a.secondaryLink}`}
        >
          {secondary.label} →
        </Link>
      </div>
    </article>
  );
}

interface FeatureSectionProps {
  eyebrow: string;
  title: string;
  accent: Accent;
  features: { icon: string; title: string; body: string }[];
}

function FeatureSection({ eyebrow, title, accent, features }: FeatureSectionProps) {
  const eyebrowColor =
    accent === 'brand'
      ? 'text-brand-600 dark:text-brand-400'
      : 'text-purple-600 dark:text-purple-400';
  return (
    <section className="px-4 mt-10">
      <p className={`text-[11px] uppercase tracking-widest font-semibold text-center ${eyebrowColor}`}>
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-center text-balance">
        {title}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {features.map(({ icon, title: ftitle, body }) => (
          <div
            key={ftitle}
            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-soft-sm flex flex-col gap-1.5"
          >
            <span className="text-2xl leading-none" aria-hidden>{icon}</span>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{ftitle}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-soft-sm">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{body}</p>
      </div>
    </li>
  );
}
