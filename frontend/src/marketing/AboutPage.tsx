import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

export default function AboutPage() {
  useDocumentTitle('About · Fetch');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="About us"
        title="The people behind Fetch"
        subtitle="We’re a small team of dog people building the community we always wished existed. Here’s our story."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Origin story */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">Our story</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            <p>
              Fetch started the way most dog things do: with a phone full of dog
              photos and no good place to share them. We were the friends
              trading shelter listings in the group chat, the people who cross
              the street to meet a stranger's dog. Somewhere between another
              round of “look at this good boy” and another adoptable dog sitting
              unnoticed on a shelter page, it clicked — people will happily
              swipe through dogs all day for fun. What if all that attention
              actually went somewhere?
            </p>
            <p>
              So we're building Fetch: a swipe feed where rating good dogs is
              the game, and rescue dogs are in the deck from day one. Once we
              open up, every swipe, follow, and weekly top-dog crown doubles as
              a spotlight for dogs still waiting on a home — backed by real
              tools for the rescues working to get them there, and a Lost &
              Found safety net for the dogs who already have one.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">What we care about</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ValueCard emoji="🐾" title="Dogs first" body="Every decision starts with what's best for the dogs and the people who love them. If a feature doesn't help a dog, it doesn't ship." />
            <ValueCard emoji="🤝" title="Real community" body="A kind, genuine corner of the internet for dog people — good dogs and the humans who show up for them, not another engagement machine." />
            <ValueCard emoji="🛟" title="Safety net" body="When a dog goes missing, minutes matter. Lost & Found alerts put the whole neighborhood on watch until they're back home." />
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">The team</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            Fetch is built by a small team of dog people who'd rather ship
            something great than grow a headcount. Our own dogs serve as chief
            product testers, and every feature earns its place by making life
            better for a dog somewhere. We're keeping the pack tiny while we
            build — when there's more of us to introduce, you'll meet everyone
            here first.
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-soft-sm">
          <h2 className="text-xl font-bold tracking-tight">Say hello</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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

function ValueCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-soft-sm">
      <span className="text-2xl leading-none" aria-hidden>{emoji}</span>
      <p className="mt-3 font-bold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
    </div>
  );
}
