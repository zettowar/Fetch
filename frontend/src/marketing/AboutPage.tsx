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
        subtitle="A small team, a few heavily photographed dogs, and one idea we couldn't put down."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Origin story */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">Our story</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            <p>
              Fetch started with a group chat. One of us was forever sending
              shelter listings. Another kept a camera roll that was mostly dog.
              All of us crossed streets to meet strangers' dogs. Meanwhile, the
              dogs who most needed the attention sat on shelter websites nobody
              was refreshing. People will swipe through dogs all day for fun.
              We wanted that attention to land somewhere useful.
            </p>
            <p>
              So we're building Fetch: a swipe feed where rating good dogs is
              the game, and rescue dogs are in the deck from day one. Every
              follow and weekly crown puts a waiting dog in front of more
              people. The rescues behind them get proper tools instead of
              spreadsheets. And Lost & Found looks out for the dogs who already
              have homes.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">What we care about</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ValueCard emoji="🐾" title="Dogs first" body="The test for every feature is simple: does it help a dog get seen, get found, or get home? If not, it doesn't ship." />
            <ValueCard emoji="🤝" title="Kind by default" body="There is no downvote on Fetch. The harshest thing you can do to a dog here is pass, and someone else will like them within the hour." />
            <ValueCard emoji="🛟" title="Safety net" body="When a dog goes missing, minutes matter. An alert goes out to everyone nearby, and sightings go straight to the owner." />
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">The team</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            Right now Fetch is a handful of people and their dogs. The dogs
            test everything first and are paid in treats. When the team grows,
            this is where you'll meet them.
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
