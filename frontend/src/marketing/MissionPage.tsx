import { Link } from 'react-router-dom';
import PageHero from './PageHero';

/**
 * Mission — SCAFFOLDED.
 *
 * Layout + styling are done; the copy is placeholder. Replace the
 * `TODO(mission)` blocks with your real mission statement and pillars.
 */
export default function MissionPage() {
  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="Our mission"
        title="Why Fetch exists"
        subtitle={
          /* TODO(mission): a single, memorable sentence that captures the mission. */
          'To celebrate every dog and make sure no lost dog stays lost.'
        }
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Statement */}
        <section className="text-center">
          {/* TODO(mission): the full mission statement in your own words. */}
          <blockquote className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance text-gray-900 dark:text-gray-100">
            “[ Placeholder — write the mission statement here. Keep it bold,
            clear, and human. This is the sentence people should remember. ]”
          </blockquote>
        </section>

        {/* Pillars */}
        <section>
          <h2 className="text-center text-2xl font-bold tracking-tight">What that looks like</h2>
          {/* TODO(mission): adjust these pillars to match how you'll deliver on the mission. */}
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <Pillar emoji="🏆" title="Celebrate every dog" body="[ A fun, positive place where every good boy and girl gets their moment. ]" />
            <Pillar emoji="🚨" title="Bring lost dogs home" body="[ A real-time safety net that mobilizes the community when a dog goes missing. ]" />
            <Pillar emoji="🏠" title="Support rescues" body="[ Tools that help rescues reach adopters and find forever homes faster. ]" />
          </div>
        </section>

        {/* Commitment / roadmap teaser */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-soft-sm">
          <h2 className="text-xl font-bold tracking-tight">Building in the open</h2>
          {/* TODO(mission): describe your commitment / how you'll build. */}
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            [ Placeholder — a short paragraph on how you're building Fetch:
            community-first, privacy-respecting, and shipped in the open. Set the
            expectations you want to be held to. ]
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
            <Link to="/about" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
              Meet the team <span aria-hidden>→</span>
            </Link>
            <Link to="/news" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
              Follow our progress <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Pillar({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-6 text-center shadow-soft-sm">
      <span className="text-3xl leading-none" aria-hidden>{emoji}</span>
      <p className="mt-3 font-bold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
    </div>
  );
}
