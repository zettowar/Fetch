import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

export default function MissionPage() {
  useDocumentTitle('Mission · Fetch');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="Our mission"
        title="Why Fetch exists"
        subtitle="Shorten every shelter dog's road to a forever home — by putting adoptable dogs in front of the people already here for the dogs."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Statement */}
        <section className="text-center">
          <blockquote className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-balance text-gray-900 dark:text-gray-100">
            “Too many good dogs wait too long in shelters. Fetch exists to get
            every adoptable dog in front of the person who’ll take them home —
            and make adopting your next dog the easiest thing you do online.”
          </blockquote>
        </section>

        {/* Pillars */}
        <section>
          <h2 className="text-center text-2xl font-bold tracking-tight">What that looks like</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <Pillar emoji="🐶" title="Adoptables in the feed" body="Every adoptable dog shows up right where people already swipe — not buried on a shelter page nobody visits." />
            <Pillar emoji="🤝" title="Tools rescues use" body="Listings, inquiries, and handoffs in one place, so rescues spend their time on dogs, not spreadsheets." />
            <Pillar emoji="🏡" title="A faster match" body="Surface the right dog to the right adopter sooner — and get them home." />
          </div>
        </section>

        {/* Commitment / roadmap teaser */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-soft-sm">
          <h2 className="text-xl font-bold tracking-tight">Building in the open</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            We're building Fetch adoption-first, not adoption-as-an-afterthought.
            Adoptable dogs live in the same swipe feed as everyone else's — no
            separate tab nobody opens. Rescue partners get their listings,
            inquiries, and handoffs in one place, and every rescue profile
            carries a donation link so support goes straight to the dogs. We're
            a small team shipping in the open on the road to launch — this page
            is the standard we expect to be held to.
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
