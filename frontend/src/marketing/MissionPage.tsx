import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import BrandIcon, { type BrandIconName } from '../components/brand/BrandIcon';
import PageHero from './PageHero';

export default function MissionPage() {
  useDocumentTitle('Mission · Fetchpawz');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="Our mission"
        title="Why Fetchpawz exists"
        subtitle="Put adoptable pets in front of people who are already here looking at pets, and shorten the wait for a home."
        cast={['scruff', 'black', 'pittie']}
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Statement */}
        <section className="text-center">
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-balance text-navy dark:text-biscuit">
            Too many good pets wait too long in shelters. Fetchpawz exists to put
            every adoptable pet in front of the person who will take them home.
          </p>
        </section>

        {/* Pillars */}
        <section>
          <h2 className="text-center text-2xl font-extrabold text-navy dark:text-biscuit">What that looks like</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Pillar icon="rescue" title="Adoptables in the feed" body="Adoptable pets appear in the main feed, right between the neighborhood regulars. There is no separate tab to forget about." />
            <Pillar icon="chat" title="Tools rescues use" body="Listings, inquiries, and handoffs live in one place, so a volunteer's evening goes to the pets." />
            <Pillar icon="donate" title="Support in a couple of taps" body="Donate to a rescue from their profile. Rescues that prefer their own donation page can link to it instead." />
            <Pillar icon="clock" title="A faster match" body="The right person sees the right pet sooner. Waits get shorter and kennels get emptier." />
          </div>
        </section>

        {/* Commitments — the concrete promises behind the statement */}
        <section className="surface p-8">
          <h2 className="text-xl font-extrabold text-navy dark:text-biscuit">What we're committing to</h2>
          <ul className="mt-4 space-y-3 text-base leading-relaxed text-gray-700 dark:text-gray-300">
            <li>
              <strong className="font-extrabold text-navy dark:text-biscuit">One number matters most:</strong>{' '}
              how many pets found homes because someone saw them on Fetchpawz.
              Once we're live, we'll publish it.
            </li>
            <li>
              <strong className="font-extrabold text-navy dark:text-biscuit">Rescues come first.</strong>{' '}
              Adoptable pets get equal footing in the feed, and the tools
              rescues rely on are built with them, not just for them.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold">
            {/* Rescue links carry Forever Pink's job. */}
            <Link to="/signup-rescue" className="inline-flex items-center gap-1 text-pink-700 dark:text-pink-300 hover:underline">
              Apply as a rescue <span aria-hidden>→</span>
            </Link>
            <Link to="/about" className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-400 hover:underline">
              Meet the team <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Pillar({ icon, title, body }: { icon: BrandIconName; title: string; body: string }) {
  return (
    <div className="surface p-6 text-center">
      {/* The mission is rescue, so the pillars sit on Forever Pink's tint. */}
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-navy dark:bg-pink-500/15 dark:text-biscuit">
        <BrandIcon name={icon} size={26} />
      </span>
      <p className="mt-3 text-base font-extrabold text-navy dark:text-biscuit">{title}</p>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-snug">{body}</p>
    </div>
  );
}
