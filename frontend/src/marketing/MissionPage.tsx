import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

export default function MissionPage() {
  useDocumentTitle('Mission · Fetchpawz');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="Our mission"
        title="Why Fetchpawz exists"
        subtitle="Put adoptable pets in front of people who are already here looking at pets, and shorten the wait for a home."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Statement */}
        <section className="text-center">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance text-gray-900 dark:text-gray-100">
            Too many good pets wait too long in shelters. Fetchpawz exists to put
            every adoptable pet in front of the person who will take them home.
          </p>
        </section>

        {/* Pillars */}
        <section>
          <h2 className="text-center text-2xl font-bold tracking-tight">What that looks like</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <Pillar emoji="🐾" title="Adoptables in the feed" body="Adoptable pets appear in the main feed, right between the neighborhood regulars. There is no separate tab to forget about." />
            <Pillar emoji="🤝" title="Tools rescues use" body="Listings, inquiries, and handoffs live in one place, so a volunteer's evening goes to the pets." />
            <Pillar emoji="🏡" title="A faster match" body="The right person sees the right pet sooner. Waits get shorter and kennels get emptier." />
          </div>
        </section>

        {/* Commitments — the concrete promises behind the statement */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-soft-sm">
          <h2 className="text-xl font-bold tracking-tight">What we're committing to</h2>
          <ul className="mt-4 space-y-3 text-base leading-relaxed text-gray-600 dark:text-gray-400">
            <li>
              <strong className="text-gray-900 dark:text-gray-100">One number matters most:</strong>{' '}
              how many pets found homes because someone saw them on Fetchpawz.
              Once we're live, we'll publish it.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Donations skip the middleman.</strong>{' '}
              Links on rescue profiles point to the rescue's own donation page.
              The money never passes through us.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Listing is free for rescues.</strong>{' '}
              Adoptable-pet listings and inquiry tools don't cost rescues
              anything. That part is the mission, not the business.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
            <Link to="/signup-rescue" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
              Apply as a rescue <span aria-hidden>→</span>
            </Link>
            <Link to="/about" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
              Meet the team <span aria-hidden>→</span>
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
