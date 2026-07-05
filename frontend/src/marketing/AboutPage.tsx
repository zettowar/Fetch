import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

export default function AboutPage() {
  useDocumentTitle('About · Fetch');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="About us"
        title="The why and the how"
        subtitle="People ask us why Fetch exists and how it got built. Both answers are shorter than you'd expect."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Origin story */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">Our story</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">
            <p>
              Some ask why. Some ask how. Both answers are shorter than you
              might expect.
            </p>
            <p>
              The why is our founder, Jordan Kelly. He wants to save as many
              dogs as possible in the time he has — and there are more dogs
              who need saving than one person can reach. So he built something
              that turns everyone's attention into help. People already swipe
              through dogs all day for fun. Here, it counts.
            </p>
            <p>
              The how is Sean Oosterveen, our CTO. A software engineer with a
              background in research and development, Sean took Jordan's very
              rough PowerPoint and built it into what you see today: a game
              about good dogs with a rescue mission running through every
              feature.
            </p>
            <p>Welcome to Fetch.</p>
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">The team</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TeamCard
              name="Jordan Kelly"
              role="Founder"
              body="The why. Set the mission and keeps score the only way that matters: in adoptions, not downloads."
            />
            <TeamCard
              name="Sean Oosterveen"
              role="CTO"
              body="The how. Software engineer with an R&D background; built Fetch from the first deck onward."
            />
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            The dogs test everything first and are paid in treats.
          </p>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">What we care about</h2>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            Three rules carried over from that first deck:
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ValueCard emoji="🐾" title="Dogs first" body="The test for every feature is simple: does it help a dog get seen, get found, or get home? If not, it doesn't ship." />
            <ValueCard emoji="🤝" title="Kind by default" body="There is no downvote on Fetch. The harshest thing you can do to a dog here is pass, and someone else will like them within the hour." />
            <ValueCard emoji="🛟" title="Safety net" body="When a dog goes missing, minutes matter. An alert goes out to everyone nearby, and sightings go straight to the owner." />
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-soft-sm">
          <h2 className="text-xl font-bold tracking-tight">Say hello</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The why and the how read every email. Questions, press, or
            partnership ideas? Reach us at{' '}
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

function TeamCard({ name, role, body }: { name: string; role: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-soft-sm">
      <p className="font-bold text-gray-900 dark:text-gray-100">{name}</p>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400 mt-0.5">
        {role}
      </p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
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
