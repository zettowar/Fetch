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
            <span aria-hidden>🚧</span> In development &middot; Available soon
          </span>

          <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance">
            Rate good dogs.
            <br />
            <span className="text-white/85">Crown the top pup.</span>
          </h1>

          <p className="mt-4 text-base font-medium text-white/90 max-w-sm text-balance">
            Fetch is a home for dog people — swipe the feed, follow your
            favorites, and crown a new weekly champion. We're still building
            it. Check back soon.
          </p>
        </div>
      </section>

      {/* Who it's for — preview only, no live signup yet */}
      <section className="px-4 mt-7 relative">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center mb-3">
          Who it's for
        </p>
        <div className="flex flex-col gap-3">
          <AudienceCard
            accent="brand"
            eyebrow="Dog owners"
            iconEmoji="🐶"
            title="Rate, follow, find."
            body="Swipe, follow, crown a weekly top dog. Lost & Found built in."
          />
          <AudienceCard
            accent="purple"
            eyebrow="Rescues & partners"
            iconEmoji="🏠"
            title="Reach adopters where they swipe."
            body="List adoptable dogs, manage inquiries, find forever-home matches."
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

      {/* How it'll work */}
      <section className="px-6 mt-10">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center">
          How it'll work
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

      {/* About us — scaffolded, fill in with the real story */}
      <section className="px-4 mt-10">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center">
          About us
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-center text-balance">
          The people behind Fetch
        </h2>

        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-soft-sm">
          {/* TODO(about-us): replace with the real origin story — why Fetch exists, what problem it solves, what makes it different. */}
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            [ Placeholder — write a short paragraph about why Fetch was
            started and what you're building toward. This is your chance to
            make it personal. ]
          </p>
        </div>

        {/* TODO(about-us): swap in real founders/team, or delete this row entirely if it doesn't apply. */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TeamCardPlaceholder />
          <TeamCardPlaceholder />
        </div>

        <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
          {/* TODO(about-us): link real socials/contact, or remove. */}
          Say hello — <span className="font-medium">hello@fetchapp.dev</span>
        </p>
      </section>

      {/* Closing nudge */}
      <section className="px-4 mt-10">
        <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-center shadow-soft-sm">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">We're not open yet.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Fetch is still in active development. Come back soon for the
            full launch.
          </p>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Beta tester or team member?{' '}
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

interface AudienceCardProps {
  accent: Accent;
  eyebrow: string;
  iconEmoji: string;
  title: string;
  body: string;
}

function AudienceCard({ accent, eyebrow, iconEmoji, title, body }: AudienceCardProps) {
  // Centralize the per-accent class strings so the card itself stays terse.
  const a = accent === 'brand'
    ? {
        card: 'bg-white dark:bg-gray-900 ring-1 ring-brand-200 dark:ring-brand-500/30 shadow-brand-glow',
        iconRing: 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow',
        eyebrow: 'text-brand-600 dark:text-brand-400',
        tag: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
      }
    : {
        card: 'bg-white dark:bg-gray-900 ring-1 ring-purple-200 dark:ring-purple-500/30 shadow-[0_8px_24px_-8px_rgba(147,51,234,0.35)]',
        iconRing: 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-[0_8px_24px_-8px_rgba(147,51,234,0.45)]',
        eyebrow: 'text-purple-600 dark:text-purple-400',
        tag: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
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

      <span className={`mt-4 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${a.tag}`}>
        Coming soon
      </span>
    </article>
  );
}

function TeamCardPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-col items-center text-center gap-2">
      <span
        aria-hidden
        className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-lg font-bold"
      >
        ?
      </span>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Name</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-600">Role</p>
    </div>
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
