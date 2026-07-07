import { Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart, HousePlus } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PawMark from '../components/ui/PawMark';
import Badge from '../components/ui/Badge';
import { Spinner } from '../components/ui/Skeleton';
import DogIllustration from '../components/flair/DogIllustration';
import PawTrail from '../components/flair/PawTrail';

const OWNER_FEATURES = [
  { icon: '❤️', title: 'Swipe & rate', body: 'A Tinder-style feed of good boys and girls. One tap, one vote.' },
  { icon: '🏆', title: 'Weekly top pet', body: 'Votes reset every Monday, so every pet gets a fresh shot at the crown.' },
  { icon: '🚨', title: 'Lost & Found', body: "If a pet goes missing nearby, you'll know. Sightings go straight to the owner." },
  { icon: '🐾', title: 'Follow your faves', body: 'Some pets you just need to see again. Follow them and you will.' },
];

const RESCUE_FEATURES = [
  { icon: '🏠', title: 'List adoptables', body: 'Give each pet photos, traits, and a story. They appear in the same feed as everyone else.' },
  { icon: '💬', title: 'Manage inquiries', body: 'Inbound interest, organized. Status, notes, and history in one place.' },
  { icon: '🗺️', title: 'Map presence', body: 'Your organization shows up on the rescue map, so nearby adopters can find you.' },
  { icon: '🤝', title: 'Smooth handoff', body: 'Mark adoptions complete or transfer a pet to its new family on Fetch.' },
];

const SITE_TEASERS = [
  { to: '/about', emoji: '🐕', eyebrow: 'About us', title: 'The people behind Fetch', body: "Who we are, and why this started in a group chat full of shelter listings." },
  { to: '/mission', emoji: '🎯', eyebrow: 'Our mission', title: 'Why Fetch exists', body: "Shelter pets wait too long for homes. Here's what we're doing about it." },
  { to: '/news', emoji: '📰', eyebrow: 'News', title: 'Latest updates', body: 'Short notes from the team as we get Fetch ready.' },
];

export default function MarketingHome() {
  const { isAuthenticated, isLoading, user } = useAuth();
  useDocumentTitle('Fetch · The app that gets cats and dogs adopted');

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
        <PawTrail steps={5} size={20} className="absolute bottom-8 left-8 text-white/10" />

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
                Rate good cats and dogs. Crown the weekly top pet.
              </p>

              <p className="mt-4 mx-auto lg:mx-0 max-w-xl text-base sm:text-lg text-white/85 leading-relaxed text-balance">
                Swipe through the neighborhood's cats and dogs and crown a weekly
                champion. Adoptable rescue pets are in the deck, and if a pet
                goes missing nearby, the whole neighborhood hears about it.
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
                <span aria-hidden>📣</span> Launching soon. Public sign-ups aren't open yet.
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
            eyebrow="Pet owners"
            iconEmoji="🐶"
            title="Rate, follow, find."
            body="Swipe the feed, follow your favorites, and vote for a weekly top pet. Lost & Found is built in for the days you hope never come."
            tag="Coming soon"
          />
          <AudienceCard
            accent="purple"
            eyebrow="Rescues & partners"
            iconEmoji="🏠"
            title="Reach adopters where they swipe."
            body="List adoptable pets in the feed people actually open, and keep every inquiry out of your spreadsheet."
            tag="Applications open"
            tagTo="/signup-rescue"
          />
        </div>
      </section>

      {/* ── Owner features ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <SectionHeading accent="brand" eyebrow="For pet owners" title="The daily pet fix" />
          <FeatureGrid features={OWNER_FEATURES} />
        </div>
      </section>

      {/* ── Rescue features ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading accent="purple" eyebrow="For rescues" title="Adoption tools, without the busywork" />
        <FeatureGrid features={RESCUE_FEATURES} />
        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Run a rescue? Applications are open ahead of launch.{' '}
          <Link to="/signup-rescue" className="font-semibold text-purple-600 dark:text-purple-400 hover:underline">
            Apply as a rescue <span aria-hidden>→</span>
          </Link>
        </p>
      </section>

      {/* ── How it'll work ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <SectionHeading eyebrow="How it'll work" title="Three quick steps" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Pick your path" body="Sign up as an owner or apply as a rescue. Same login, separate spaces." />
            <Step n={2} title="Build your profile" body="Owners add photos, breeds, and traits. Rescues add org details and their first adoptable." />
            <Step n={3} title="Meet the pack" body="Owners climb the weekly rankings. Rescues hear from adopters." />
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
              <p className="mt-4 text-2xs uppercase tracking-widest font-semibold text-brand-600 dark:text-brand-400">{t.eyebrow}</p>
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
            Fetch is still in active development. Check back soon, or{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className="font-semibold underline underline-offset-2 hover:text-white">
              write to us
            </a>{' '}
            if you'd like an invite when testing expands.
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
      <p className={`text-2xs uppercase tracking-widest font-semibold ${color}`}>{eyebrow}</p>
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

function AudienceCard({ accent, eyebrow, iconEmoji, title, body, tag, tagTo }: {
  accent: Accent; eyebrow: string; iconEmoji: string; title: string; body: string;
  tag: string; tagTo?: string;
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
          <p className={`text-2xs uppercase tracking-widest font-semibold ${a.eyebrow}`}>{eyebrow}</p>
          <h3 className="mt-0.5 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-base text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
      {tagTo ? (
        <Link
          to={tagTo}
          className={`mt-5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-2xs font-semibold hover:underline ${a.tag}`}
        >
          {tag} <span aria-hidden>→</span>
        </Link>
      ) : (
        <span className={`mt-5 inline-flex items-center rounded-full px-3 py-1 text-2xs font-semibold ${a.tag}`}>
          {tag}
        </span>
      )}
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

/**
 * Faithful static preview of the real "Rate My Pet" swipe screen, shown inside
 * a phone frame so the whole screen — card AND controls — is contained, the way
 * it is in the app. Mirrors SwipeCard + the SwipeDeck controls verbatim: Pass is
 * a downward-rotated paw, Like is a heart. There is deliberately no thumbs-down
 * — you never vote a pet down. Non-interactive; a mockup of what's coming.
 */
function AppPreview() {
  const reduceMotion = useReducedMotion();
  // One shared 5s timeline: the card sits still, tilts right with a LIKE
  // stamp, then springs back — the fake swipe every visitor came to see.
  const swipeTimes = [0, 0.55, 0.68, 0.82, 0.93, 1];
  return (
    <div className="relative">
      {/* Signals this is a mockup of what's coming, not a live app. */}
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1 text-2xs font-bold uppercase tracking-widest text-white shadow-soft-lg ring-1 ring-white/40">
        <span aria-hidden>🚧</span> Sneak peek
      </span>

      {/* Phone frame — the app viewport (mobile-portrait). */}
      <motion.div
        className="w-[320px] rounded-[2.75rem] bg-gray-900 p-2.5 shadow-soft-lg ring-1 ring-black/10"
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Screen — the app surface; everything below lives on it. */}
        <div className="rounded-[2.25rem] bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 pt-6 pb-5">
            {/* SwipePage heading */}
            <h4 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Rate My Pet
            </h4>

            {/* Card — mirrors SwipeCard */}
            <div className="relative w-full h-[290px]">
              <div aria-hidden className="absolute inset-x-4 top-3 -bottom-1 rounded-2xl bg-black/5 dark:bg-white/5" />
              <motion.div
                className="relative h-full w-full rounded-2xl bg-white dark:bg-gray-900 shadow-soft-lg ring-1 ring-black/5 overflow-hidden"
                animate={
                  reduceMotion
                    ? undefined
                    : { rotate: [0, 0, 8, 8, 0, 0], x: [0, 0, 20, 20, 0, 0] }
                }
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  times: swipeTimes,
                  ease: 'easeInOut',
                }}
              >
                <div className="w-full h-[66%] bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
                  <DogIllustration name="ball" className="h-32 w-auto text-brand-300" />
                </div>

                {/* Rescue badge — a real SwipeCard element; ties into adoption. */}
                <span className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-2xs font-semibold px-2.5 py-1 shadow-soft-sm">
                  <HousePlus size={12} aria-hidden /> Happy Tails Rescue
                </span>

                {/* LIKE stamp — fades in as the fake swipe tilts the card. */}
                {!reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="absolute top-4 right-4 z-20 bg-success-500 text-white px-3 py-1.5 rounded-xl text-base font-bold rotate-12 border-4 border-success-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
                    transition={{ duration: 5, repeat: Infinity, times: swipeTimes }}
                  >
                    LIKE
                  </motion.span>
                )}

                <div className="p-3">
                  <div className="flex items-baseline gap-2">
                    <h5 className="text-lg font-bold text-gray-900 dark:text-gray-100">Biscuit</h5>
                    <span className="text-xs text-gray-400 dark:text-gray-500">3 yrs</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Golden Retriever</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['Playful', 'Gentle', 'Good boy'].map((t) => (
                      <Badge key={t} variant="brand">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Controls — mirror SwipeDeck: Pass (downward paw) + Like (heart). */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <div
                aria-hidden
                className="w-16 h-16 rounded-full bg-danger-100 text-danger-500 dark:bg-danger-500/15 dark:text-danger-400 flex items-center justify-center shadow-soft-sm"
              >
                <PawMark className="h-8 w-8 rotate-180" decorative />
              </div>
              <div
                aria-hidden
                className="w-16 h-16 rounded-full bg-success-100 text-success-500 dark:bg-success-500/15 dark:text-success-400 flex items-center justify-center shadow-soft-sm"
              >
                <Heart size={30} fill="currentColor" strokeWidth={0} aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
