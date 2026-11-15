import { Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type React from 'react';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import WaitlistForm from './WaitlistForm';
import { Spinner } from '../components/ui/Skeleton';
import BrandIcon, { type BrandIconName } from '../components/brand/BrandIcon';
import PetPortrait, { portraitTint } from '../components/brand/PetPortrait';
import { Crown } from '../components/brand/RankMedal';

type Feature = { icon: BrandIconName; title: string; body: string };

const OWNER_FEATURES: Feature[] = [
  { icon: 'like', title: 'Swipe & rate', body: 'A swipe feed of neighborhood cats and dogs. One tap, one vote.' },
  { icon: 'crown', title: 'Weekly top pet', body: 'Votes reset every Monday, so every pet gets a fresh shot at the crown.' },
  { icon: 'follow', title: 'Follow your faves', body: 'Some pets you just need to see again. Follow them and you will.' },
  { icon: 'star', title: 'Your likes, kept', body: 'Every pet you like lands in a list you can wander back through anytime.' },
];

const NEIGHBORHOOD_FEATURES: Feature[] = [
  { icon: 'park', title: 'Parks & playdates', body: 'Find nearby dog parks, check in, read reviews, and set up playdates with pets from the feed.' },
  { icon: 'qr', title: 'QR pet tags', body: "A tag on the collar links to your pet's page — whoever finds them scans it and knows exactly who they belong to." },
  { icon: 'lost', title: 'Lost & Found', body: 'If a pet goes missing nearby, neighbors get the alert and sightings go straight to the owner.' },
  { icon: 'rescue', title: 'Rescues near you', body: 'Browse rescues on the map, meet their adoptable pets, and donate in a couple of taps.' },
];

const RESCUE_FEATURES: Feature[] = [
  { icon: 'rescue', title: 'List adoptables', body: 'Give each pet photos, traits, and a story. They appear in the same feed as everyone else.' },
  { icon: 'chat', title: 'Manage inquiries', body: 'Inbound interest, organized. Status, notes, and history in one place.' },
  { icon: 'lost', title: 'Map presence', body: 'Your organization shows up on the rescue map, so nearby adopters can find you.' },
  { icon: 'check', title: 'Smooth handoff', body: 'Mark adoptions complete or transfer a pet to its new family on Fetchpawz.' },
  { icon: 'donate', title: 'Accept donations', body: 'Take donations right on your profile via Stripe — or keep sending supporters to your own donation page.' },
  { icon: 'share', title: 'A page to share', body: 'Every rescue gets a public page — your story and your adoptables — to link from anywhere.' },
];

const SITE_TEASERS: { to: string; icon: BrandIconName; eyebrow: string; title: string; body: string }[] = [
  { to: '/about', icon: 'user', eyebrow: 'About us', title: 'The people behind Fetchpawz', body: "Who we are, and why this started in a group chat full of shelter listings." },
  { to: '/mission', icon: 'rescue', eyebrow: 'Our mission', title: 'Why Fetchpawz exists', body: "Shelter pets wait too long for homes. Here's what we're doing about it." },
  { to: '/news', icon: 'bell', eyebrow: 'News', title: 'Latest updates', body: 'Short notes from the team as we get Fetchpawz ready.' },
];

/** The cast strip: every pet is somebody's whole world. */
const CAST = ['corgi', 'tuxedo', 'pittie', 'calico', 'husky', 'ginger', 'dachshund', 'siamese', 'scruff', 'black', 'golden', 'bengal'];

export default function MarketingHome() {
  const { isAuthenticated, isLoading, user } = useAuth();
  useDocumentTitle('Fetchpawz · The pet app with a rescue mission');

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
      {/* ── Hero: one loud orange page, navy ink (navy on colour) ───── */}
      <section className="relative overflow-hidden bg-brand-500 text-navy">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Copy — lead with the status; the product pitch is the flavor. */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-navy px-4 py-1.5 text-xs sm:text-sm font-extrabold tracking-[0.1em] uppercase">
                <BrandIcon name="clock" size={16} style={{ '--bean': '#FFFFFF' } as React.CSSProperties} /> In development
              </span>

              <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-tight text-balance">
                The pet app with a rescue mission.
              </h1>

              <p className="mt-5 text-xl sm:text-2xl font-extrabold text-balance">
                Rate good cats and dogs. Crown the weekly top pet.
              </p>

              <p className="mt-4 mx-auto lg:mx-0 max-w-xl text-base sm:text-lg font-medium leading-relaxed text-balance">
                Swipe through the neighborhood's cats and dogs, meet up at the
                dog park, and bring lost pets home — with adoptable rescue pets
                right in the deck. We're putting the final touches on it now.
              </p>

              <WaitlistForm source="hero" className="mt-8 mx-auto lg:mx-0 max-w-xl" />

              <p className="mt-4 text-sm font-medium">
                Launching soon. Sign-ups are invite-only until then.{' '}
                <Link to="/about" className="font-extrabold underline underline-offset-2">
                  Learn about Fetchpawz
                </Link>
              </p>
              <p className="mt-2 text-sm font-medium">
                Beta tester or team member?{' '}
                <Link to="/login" className="font-extrabold underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </div>

            {/* Visual — the real swipe screen in a phone */}
            <div className="hidden lg:flex justify-center">
              <AppPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── The cast: every pet is somebody's whole world ──────────── */}
      <section aria-label="Cats and dogs of Fetchpawz" className="border-b-[2.5px] border-navy bg-navy dark:border-white/10">
        <div className="mx-auto flex max-w-7xl items-end justify-center gap-0 overflow-hidden px-4 pt-6">
          {CAST.map((id, i) => (
            <PetPortrait
              key={id}
              id={id}
              className={`-mx-1.5 h-24 w-24 shrink-0 sm:h-28 sm:w-28 ${i > 7 ? 'hidden lg:block' : i > 5 ? 'hidden sm:block' : ''}`}
            />
          ))}
        </div>
      </section>

      {/* ── Audience split ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading eyebrow="Who it's for" title="Made for cats, dogs & their people" />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <AudienceCard
            accent="brand"
            eyebrow="Pet owners"
            icon="like"
            title="Rate, follow, find."
            body="Swipe the feed, crown a weekly top pet, and meet up at the dog park. Lost & Found is built in for the days you hope never come."
            tag="Coming soon"
          />
          <AudienceCard
            accent="rescue"
            eyebrow="Rescues & partners"
            icon="rescue"
            title="Reach adopters where they swipe."
            body="List adoptable pets in the feed people actually open, and keep every inquiry out of your spreadsheet."
            tag="Applications open"
            tagTo="/signup-rescue"
          />
        </div>
      </section>

      {/* ── Owner features ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-night-surface border-y border-navy/10 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <SectionHeading eyebrow="For pet owners" title="Your daily pet fix, with a purpose" />
          <FeatureGrid features={OWNER_FEATURES} />
        </div>
      </section>

      {/* ── Neighborhood features ──────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading eyebrow="Beyond the feed" title="Made for the real world" />
        <FeatureGrid features={NEIGHBORHOOD_FEATURES} />
      </section>

      {/* ── Rescue features ────────────────────────────────────── */}
      <section className="bg-white dark:bg-night-surface border-y border-navy/10 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <SectionHeading accent="rescue" eyebrow="For rescues" title="Adoption tools, without the busywork" />
          <FeatureGrid features={RESCUE_FEATURES} cols={3} tone="rescue" />
          <p className="mt-10 text-center text-sm text-gray-600 dark:text-gray-300">
            Run a rescue? Applications are open ahead of launch.{' '}
            <Link to="/signup-rescue" className="btn btn-rescue btn-sm ml-2 align-middle">
              Apply as a rescue <span aria-hidden>→</span>
            </Link>
          </p>
        </div>
      </section>

      {/* ── How it'll work ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <SectionHeading eyebrow="How it'll work" title="From invite to top pet" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Step n={1} title="Get in" body="Join the waitlist and grab your invite. Rescues skip the line — applications are already open." />
          <Step n={2} title="Show off your pet" body="A minute of setup: photos, breed, and the traits that make them them." />
          <Step n={3} title="Chase the crown" body="Your pet hits the feed, the votes roll in, and every Monday resets the race for the weekly crown." />
        </div>
      </section>

      {/* ── Explore the site ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 lg:pb-20">
        <SectionHeading eyebrow="More about us" title="Get to know Fetchpawz" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SITE_TEASERS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-3xl border-[2.5px] border-navy bg-white p-6 text-navy shadow-toy transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-white/15 dark:bg-night-surface dark:text-biscuit"
            >
              <BrandIcon name={t.icon} size={32} />
              <p className="mt-4 eyebrow">{t.eyebrow}</p>
              <h3 className="mt-1 text-lg font-extrabold tracking-tight">{t.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-snug">{t.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold">
                Read more
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative overflow-hidden rounded-3xl border-[2.5px] border-navy bg-brand-500 px-6 pt-14 text-center text-navy shadow-toy dark:border-brand-500">
          <h2 className="relative font-display text-4xl sm:text-5xl leading-none tracking-tight text-balance">We're not open yet.</h2>
          <p className="relative mt-4 mx-auto max-w-xl font-medium text-balance">
            Fetchpawz is still in active development. Leave your email and
            we'll send an invite when testing expands.
          </p>
          <WaitlistForm source="closing" className="relative mt-6 mx-auto max-w-md" />
          <p className="relative mt-6 text-sm font-medium">
            Beta tester or team member?{' '}
            <Link to="/login" className="font-extrabold underline underline-offset-2">
              Log in
            </Link>
          </p>
          <div aria-hidden className="mt-8 flex items-end justify-center">
            {['beagle', 'tabby', 'frenchie', 'ragdoll', 'pom'].map((id) => (
              <PetPortrait key={id} id={id} className="-mx-2 h-24 w-24 sm:h-28 sm:w-28" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────── */

type Accent = 'brand' | 'rescue';

function SectionHeading({ eyebrow, title, accent }: { eyebrow: string; title: string; accent?: Accent }) {
  return (
    <div className="text-center">
      <p className={`eyebrow ${accent === 'rescue' ? '!text-pink-700 dark:!text-pink-300' : ''}`}>{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl leading-none tracking-tight text-balance text-navy dark:text-biscuit">
        {title}
      </h2>
    </div>
  );
}

function FeatureGrid({
  features,
  cols = 4,
  tone = 'brand',
}: {
  features: Feature[];
  cols?: 3 | 4;
  tone?: Accent;
}) {
  return (
    <div className={`mt-10 grid gap-5 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
      {features.map((f) => (
        <div key={f.title} className="surface p-6">
          <span
            aria-hidden
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-navy ${
              tone === 'rescue' ? 'bg-pink-100' : 'bg-brand-100'
            }`}
          >
            <BrandIcon name={f.icon} size={26} />
          </span>
          <p className="mt-4 text-base font-extrabold text-navy dark:text-biscuit">{f.title}</p>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-snug">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

function AudienceCard({ accent, eyebrow, icon, title, body, tag, tagTo }: {
  accent: Accent; eyebrow: string; icon: BrandIconName; title: string; body: string;
  tag: string; tagTo?: string;
}) {
  // Owners get Ball Orange; rescues get Forever Pink — the rescue's colour.
  const fill = accent === 'brand' ? 'bg-brand-500' : 'bg-pink-500';
  return (
    <article className="relative overflow-hidden rounded-3xl border-[2.5px] border-navy bg-white p-7 text-navy shadow-toy dark:border-white/15 dark:bg-night-surface dark:text-biscuit">
      <div className="flex items-start gap-4">
        <span aria-hidden className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-navy text-navy ${fill}`}>
          <BrandIcon name={icon} size={30} style={{ '--bean': '#FFFFFF' } as React.CSSProperties} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h3 className="mt-1 font-display text-2xl leading-none tracking-tight">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-base text-gray-600 dark:text-gray-300 leading-relaxed">{body}</p>
      {tagTo ? (
        <Link to={tagTo} className={`btn btn-sm mt-5 ${accent === 'brand' ? 'btn-primary' : 'btn-rescue'}`}>
          {tag} <span aria-hidden>→</span>
        </Link>
      ) : (
        <span className="mt-5 inline-flex items-center rounded-full border-[1.5px] border-navy/40 px-3 py-1 text-2xs font-extrabold uppercase tracking-[0.1em] dark:border-white/30">
          {tag}
        </span>
      )}
    </article>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="surface p-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-brand-500 font-display text-2xl leading-none text-navy">
        {n}
      </span>
      <p className="mt-4 text-base font-extrabold text-navy dark:text-biscuit">{title}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-snug">{body}</p>
    </div>
  );
}

/**
 * Faithful static preview of the real swipe screen, inside a phone frame:
 * the trading card (white, navy line, toy shadow, name in Bagel), a pink
 * rescue pill, and the controls — Pass is white, Like is orange. There is
 * deliberately no thumbs-down; you never vote a pet down. Non-interactive.
 */
function AppPreview() {
  const reduceMotion = useReducedMotion();
  // One shared 5s timeline: the card sits still, tilts right with a Like
  // stamp, then springs back — the fake swipe every visitor came to see.
  const swipeTimes = [0, 0.55, 0.68, 0.82, 0.93, 1];
  return (
    <div className="relative">
      {/* Signals this is a mockup of what's coming, not a live app. */}
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1 rounded-full border-2 border-navy bg-white px-3 py-1 text-2xs font-extrabold uppercase tracking-[0.1em] text-navy">
        Sneak peek
      </span>
      <Crown className="absolute -right-6 -top-8 z-30 w-16 rotate-12" />

      {/* Phone frame — the app viewport (mobile-portrait). */}
      <motion.div
        className="w-[320px] rounded-[2.75rem] border-[2.5px] border-navy bg-navy p-2.5 shadow-toy"
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="rounded-[2.25rem] bg-biscuit overflow-hidden">
          <div className="px-4 pt-6 pb-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-[26px] leading-none text-navy">Rate</p>
              {/* Explicit light classes: the mockup is a light screen even
                  when the site is dark. */}
              <span className="inline-flex gap-1 rounded-full border-[1.5px] border-navy/25 bg-white p-1 text-xs font-extrabold text-navy">
                <span className="rounded-full bg-brand-500 px-2.5 py-1">All</span>
                <span className="px-2.5 py-1">Dogs</span>
                <span className="px-2.5 py-1">Cats</span>
              </span>
            </div>

            <div className="relative w-full h-[300px]">
              <motion.div
                className="relative h-full w-full overflow-hidden rounded-3xl border-[2.5px] border-navy bg-white shadow-toy"
                animate={
                  reduceMotion
                    ? undefined
                    : { rotate: [0, 0, 8, 8, 0, 0], x: [0, 0, 20, 20, 0, 0] }
                }
                transition={{ duration: 5, repeat: Infinity, times: swipeTimes, ease: 'easeInOut' }}
              >
                <div
                  className="flex h-[62%] w-full items-end justify-center border-b-[2.5px] border-navy"
                  style={{ background: portraitTint('golden') }}
                >
                  <PetPortrait id="golden" className="h-[96%] w-auto" />
                </div>

                <span className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1 rounded-full border-2 border-navy bg-pink-500 px-2.5 py-1 text-2xs font-extrabold text-navy">
                  Happy Tails Rescue
                </span>

                {!reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="absolute top-12 right-4 z-20 rotate-12 rounded-xl border-[3px] border-navy bg-brand-500 px-3 py-1 font-display text-xl text-navy"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
                    transition={{ duration: 5, repeat: Infinity, times: swipeTimes }}
                  >
                    Like
                  </motion.span>
                )}

                <div className="px-3 pt-2.5">
                  <div className="flex items-baseline gap-2">
                    <p className="font-display text-[26px] leading-none text-navy">Biscuit</p>
                    <span className="text-xs font-bold text-gray-500">3 yrs</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-600">Golden Retriever</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {['Zoomies', 'Gentle'].map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-navy bg-white px-2 py-0.5 text-2xs font-bold text-navy"
                      >
                        <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-navy" aria-hidden />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4" aria-hidden>
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-[2.5px] border-navy bg-white text-navy shadow-ledge">
                <BrandIcon name="pass" size={26} />
              </span>
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-[2.5px] border-navy bg-brand-500 text-navy shadow-ledge">
                <BrandIcon name="like" size={26} style={{ '--bean': '#FFFFFF' } as React.CSSProperties} />
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
