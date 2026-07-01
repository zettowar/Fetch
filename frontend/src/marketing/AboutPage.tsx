import { Link } from 'react-router-dom';
import PageHero from './PageHero';

/**
 * About Us — SCAFFOLDED.
 *
 * The structure, layout, and styling are done; the words are placeholders.
 * Search this file for `TODO(about-us)` and replace each block with the real
 * story. Delete any block that doesn't apply (e.g. the team grid).
 */
export default function AboutPage() {
  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="About us"
        title="The people behind Fetch"
        subtitle={
          /* TODO(about-us): one or two enticing sentences that sum up who you are. */
          'We’re a small team of dog people building the community we always wished existed. Here’s our story.'
        }
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Origin story */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">Our story</h2>
          {/* TODO(about-us): replace with the real origin story — why Fetch exists,
              what problem it solves, and what makes it different. Make it personal. */}
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            <Placeholder>
              [ Placeholder — how did Fetch begin? What moment or frustration
              made you want to build it? A couple of honest paragraphs here do
              more than any feature list. ]
            </Placeholder>
            <Placeholder>
              [ Placeholder — where are you headed? Paint the picture of what
              Fetch looks like once it's fully open, and why that matters to dog
              owners and rescues alike. ]
            </Placeholder>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">What we care about</h2>
          {/* TODO(about-us): tweak these three values (or add a fourth) to match
              what actually drives the project. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ValueCard emoji="🐾" title="Dogs first" body="[ Every decision starts with what's best for the dogs and the people who love them. ]" />
            <ValueCard emoji="🤝" title="Real community" body="[ A kind, genuine place for dog people — not another engagement machine. ]" />
            <ValueCard emoji="🛟" title="Safety net" body="[ When a dog goes missing, the whole community shows up to help. ]" />
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">The team</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {/* TODO(about-us): swap in real founders/team, or delete this whole section. */}
            [ Introduce the humans (and dogs) behind Fetch. ]
          </p>
          <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
            <TeamCardPlaceholder />
            <TeamCardPlaceholder />
            <TeamCardPlaceholder />
            <TeamCardPlaceholder />
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-soft-sm">
          <h2 className="text-xl font-bold tracking-tight">Say hello</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {/* TODO(about-us): real contact address / socials, or remove. */}
            Questions, press, or partnership ideas? Reach us at{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              fetchpawz.inc@gmail.com
            </a>
            .
          </p>
          <div className="mt-5">
            <Link
              to="/mission"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Read our mission <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 text-gray-500 dark:text-gray-400">
      {children}
    </p>
  );
}

function ValueCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-soft-sm">
      <span className="text-2xl leading-none" aria-hidden>{emoji}</span>
      <p className="mt-3 font-bold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
    </div>
  );
}

function TeamCardPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-col items-center text-center gap-2">
      <span
        aria-hidden
        className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xl font-bold"
      >
        ?
      </span>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Name</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-600">Role</p>
    </div>
  );
}
