import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import PawMark from '../components/ui/PawMark';
import { Spinner } from '../components/ui/Skeleton';

const OWNER_FEATURES = [
  { icon: '❤️', title: 'Swipe & rate', body: 'A Tinder-style feed of good boys and girls. One tap, one vote.' },
  { icon: '🏆', title: 'Weekly top dog', body: 'Votes reset every Monday. A new community champion is crowned each week.' },
  { icon: '🚨', title: 'Lost & Found', body: 'Nearby missing-dog alerts and sighting reports — a safety net for your pack.' },
  { icon: '🐾', title: 'Follow your faves', body: "Keep tabs on the pups you can't get enough of and never miss an update." },
];

const RESCUE_FEATURES = [
  { icon: '🏠', title: 'List adoptables', body: 'Photos, traits, and a story — your dogs show up right in the swipe feed.' },
  { icon: '💬', title: 'Manage inquiries', body: 'Inbound interest, organized. Status, notes, and history in one place.' },
  { icon: '🗺️', title: 'Map presence', body: 'Adopters discover your organization on the rescue map by location.' },
  { icon: '🤝', title: 'Smooth handoff', body: 'Mark adoptions complete or transfer a dog to its new family on Fetch.' },
];

const SITE_TEASERS = [
  { to: '/about', emoji: '🐕', eyebrow: 'About us', title: 'The people behind Fetch', body: 'Who we are and why we started building a better home for dog people.' },
  { to: '/mission', emoji: '🎯', eyebrow: 'Our mission', title: 'Why Fetch exists', body: 'Every dog celebrated, every lost dog found. The north star we build toward.' },
  { to: '/news', emoji: '📰', eyebrow: 'News', title: 'Latest updates', body: 'Follow along as we build in the open on the road to launch.' },
];

export default function MarketingHome() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }
  // A logged-in visitor at the front door belongs in the app, not the website.
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'rescue' ? '/app/rescue/dashboard' : '/app/home'} replace />;
  }

  return (
    <div className="animate-fade-in">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-brand-800/40 blur-3xl" />
        <PawMark decorative className="pointer-events-none absolute top-10 left-[8%] h-10 w-10 text-white/10 -rotate-12" />
        <PawMark decorative className="pointer-events-none absolute bottom-16 right-[12%] h-14 w-14 text-white/[0.08] rotate-6" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Copy — lead with the status; the product pitch is the flavor. */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs sm:text-sm font-semibold tracking-widest uppercase ring-1 ring-white/25">
                <span aria-hidden>🚧</span> In development
              </span>

              <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tight text-balance">
                Fetch is
                <br />
                almost here.
              </h1>

              <p className="mt-5 text-xl sm:text-2xl font-bold text-white/85 text-balance">
                Rate good dogs. Crown the top pup.
              </p>

              <p className="mt-4 mx-auto lg:mx-0 max-w-xl text-base sm:text-lg text-white/85 leading-relaxed text-balance">
                A home for dog people — swipe the feed, follow your favorites,
                crown a weekly champion, and help lost dogs find their way home.
                We're putting the final touches on it now.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
                <Link
                  to="/about"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-brand-700 shadow-soft-lg transition-transform duration-200 ease-soft-out hover:scale-[1.02] active:scale-95"
                >
                  Learn about Fetch
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm px-6 py-3 text-base font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/25"
                >
                  Beta / team log in
                </Link>
              </div>

              <p className="mt-6 text-sm text-white/75">
                <span aria-hidden>📣</span> Launching soon — public sign-ups aren't open yet.
              </p>
            </div>

            {/* Visual — a decorative "app preview" that hints at the swipe UI */}
            <div className="hidden lg:flex justify-center">
              <AppPreview />
            </div>
          </div>
        </div>

        {/* soft fade into the page */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent" />
      </section>

      {/* ── Audience split ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading eyebrow="Who it's for" title="Made for the whole pack" />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <AudienceCard
            accent="brand"
            eyebrow="Dog owners"
            iconEmoji="🐶"
            title="Rate, follow, find."
            body="Swipe through the feed, follow your favorites, and crown a weekly top dog — with Lost & Found built right in."
          />
          <AudienceCard
            accent="purple"
            eyebrow="Rescues & partners"
            iconEmoji="🏠"
            title="Reach adopters where they swipe."
            body="List adoptable dogs, manage inquiries, and find forever-home matches — no spreadsheet required."
          />
        </div>
      </section>

      {/* ── Owner features ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <SectionHeading accent="brand" eyebrow="For dog owners" title="Everything dog people actually want" />
          <FeatureGrid features={OWNER_FEATURES} />
        </div>
      </section>

      {/* ── Rescue features ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading accent="purple" eyebrow="For rescues" title="Adoption tools, without the busywork" />
        <FeatureGrid features={RESCUE_FEATURES} />
      </section>

      {/* ── How it'll work ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <SectionHeading eyebrow="How it'll work" title="Three quick steps" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Pick your path" body="Sign up as an owner or apply as a rescue. Same login, separate spaces." />
            <Step n={2} title="Build your profile" body="Owners add photos, breeds, and traits. Rescues add org details and their first adoptable." />
            <Step n={3} title="Meet the pack" body="Owners climb the rankings; rescues meet potential adopters. Everybody wins." />
          </div>
        </div>
      </section>

      {/* ── Explore the site ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading eyebrow="More about us" title="Get to know Fetch" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SITE_TEASERS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-soft-sm transition-all duration-200 ease-soft-out hover:-translate-y-1 hover:shadow-soft-lg hover:border-brand-200 dark:hover:border-brand-500/40"
            >
              <span className="text-3xl leading-none" aria-hidden>{t.emoji}</span>
              <p className="mt-4 text-[11px] uppercase tracking-widest font-semibold text-brand-600 dark:text-brand-400">{t.eyebrow}</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">{t.title}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-snug">{t.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
                Read more
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-14 text-center text-white shadow-soft-lg">
          <PawMark decorative className="pointer-events-none absolute -top-6 -left-6 h-24 w-24 text-white/10 -rotate-12" />
          <PawMark decorative className="pointer-events-none absolute -bottom-8 -right-4 h-28 w-28 text-white/[0.08] rotate-12" />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">We're not open yet.</h2>
          <p className="relative mt-3 mx-auto max-w-xl text-white/90 text-balance">
            Fetch is still in active development. Come back soon for the full
            launch — the whole pack is almost ready.
          </p>
          <p className="relative mt-6 text-sm text-white/80">
            Beta tester or team member?{' '}
            <Link to="/login" className="font-semibold underline underline-offset-2 hover:text-white">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────── */

type Accent = 'brand' | 'purple';

function SectionHeading({ eyebrow, title, accent }: { eyebrow: string; title: string; accent?: Accent }) {
  const color =
    accent === 'purple'
      ? 'text-purple-600 dark:text-purple-400'
      : 'text-brand-600 dark:text-brand-400';
  return (
    <div className="text-center">
      <p className={`text-[11px] uppercase tracking-widest font-semibold ${color}`}>{eyebrow}</p>
      <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-balance">{title}</h2>
    </div>
  );
}

function FeatureGrid({ features }: { features: { icon: string; title: string; body: string }[] }) {
  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-6 shadow-soft-sm transition-transform duration-200 ease-soft-out hover:-translate-y-1"
        >
          <span className="text-3xl leading-none" aria-hidden>{f.icon}</span>
          <p className="mt-4 text-base font-bold text-gray-900 dark:text-gray-100">{f.title}</p>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

function AudienceCard({ accent, eyebrow, iconEmoji, title, body }: {
  accent: Accent; eyebrow: string; iconEmoji: string; title: string; body: string;
}) {
  const a =
    accent === 'brand'
      ? {
          card: 'ring-1 ring-brand-200 dark:ring-brand-500/30 shadow-brand-glow',
          iconRing: 'bg-gradient-to-br from-brand-400 to-brand-600 shadow-brand-glow',
          eyebrow: 'text-brand-600 dark:text-brand-400',
          tag: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
        }
      : {
          card: 'ring-1 ring-purple-200 dark:ring-purple-500/30 shadow-[0_8px_24px_-8px_rgba(147,51,234,0.35)]',
          iconRing: 'bg-gradient-to-br from-purple-500 to-purple-700 shadow-[0_8px_24px_-8px_rgba(147,51,234,0.45)]',
          eyebrow: 'text-purple-600 dark:text-purple-400',
          tag: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
        };
  return (
    <article className={`relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 p-7 ${a.card}`}>
      <div className="flex items-start gap-4">
        <span aria-hidden className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl leading-none text-white ${a.iconRing}`}>
          {iconEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] uppercase tracking-widest font-semibold ${a.eyebrow}`}>{eyebrow}</p>
          <h3 className="mt-0.5 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
      <span className={`mt-5 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${a.tag}`}>
        Coming soon
      </span>
    </article>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-6 shadow-soft-sm">
      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold flex items-center justify-center text-base tabular-nums">
        {n}
      </span>
      <p className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
    </div>
  );
}

/** Decorative mock of the swipe card — pure illustration, not interactive. */
function AppPreview() {
  return (
    <div className="relative w-[300px] h-[420px]">
      {/* Signals this is a mockup of what's coming, not a live app. */}
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-soft-lg ring-1 ring-white/40">
        <span aria-hidden>🚧</span> Sneak peek
      </span>
      <div aria-hidden className="absolute inset-0 translate-x-5 translate-y-4 rotate-6 rounded-[2rem] bg-white/20" />
      <div aria-hidden className="absolute inset-0 -translate-x-3 translate-y-2 -rotate-3 rounded-[2rem] bg-white/25" />
      <div className="relative h-full w-full rounded-[2rem] bg-white shadow-soft-lg ring-1 ring-black/5 overflow-hidden flex flex-col">
        <div className="flex-1 bg-gradient-to-br from-brand-100 to-brand-300 flex items-center justify-center">
          <span className="text-[7rem] leading-none" aria-hidden>🐕</span>
        </div>
        <div className="p-5 text-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-extrabold tracking-tight">Biscuit, 3</p>
              <p className="text-sm text-gray-500">Golden Retriever</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
              🏆 #1
            </span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <span aria-hidden className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👎</span>
            <span aria-hidden className="w-16 h-16 rounded-full bg-brand-500 text-white flex items-center justify-center text-3xl shadow-brand-glow">❤️</span>
            <span aria-hidden className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">⭐</span>
          </div>
        </div>
      </div>
    </div>
  );
}
