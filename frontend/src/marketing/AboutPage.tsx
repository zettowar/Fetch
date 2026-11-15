import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import BrandIcon, { type BrandIconName } from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';
import PageHero from './PageHero';

const LINK = 'font-bold text-brand-700 dark:text-brand-400 hover:underline';

export default function AboutPage() {
  useDocumentTitle('About · Fetchpawz');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="About us"
        title="The why and the how"
        subtitle="People ask us why Fetchpawz exists and how it got built. Both answers are shorter than you'd expect."
        cast={['golden', 'calico', 'frenchie']}
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-14">
        {/* Origin story */}
        <section>
          <h2 className="text-2xl font-extrabold text-navy dark:text-biscuit">Our story</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              The why is our founder, Jordan Kelly. He wants to save as many
              pets as possible in the time he has — and there are more pets
              who need saving than one person can reach. So he built something
              that turns everyone's attention into help. People already swipe
              through pets all day for fun. Here, it counts.
            </p>
            <p>
              The how is Sean Oosterveen, our CTO. A software engineer with a
              background in research and development, Sean took Jordan's very
              rough PowerPoint and built it into what you see today: a game
              about good pets with a rescue mission running through every
              feature.
            </p>
            <p>Welcome to Fetchpawz.</p>
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-2xl font-extrabold text-navy dark:text-biscuit">The team</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TeamCard
              name="Jordan Kelly"
              role="Founder"
              body="The why. Set the mission and keeps score the only way that matters: in adoptions, not downloads."
            />
            <TeamCard
              name="Sean Oosterveen"
              role="CTO"
              body="The how. Software engineer with an R&D background; built Fetchpawz from the first deck onward."
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span aria-hidden className="flex shrink-0 -space-x-2">
              {['beagle', 'tabby', 'pug'].map((id) => (
                <span
                  key={id}
                  className="block h-8 w-8 overflow-hidden rounded-full border-2 border-navy dark:border-night-raised"
                >
                  <PetPortrait id={id} crop="face" background className="block h-full w-full" />
                </span>
              ))}
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              The pets test everything first and are paid in treats.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-extrabold text-navy dark:text-biscuit">What we care about</h2>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-300">
            Three rules carried over from that first deck:
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ValueCard icon="like" title="Pets first" body="The test for every feature is simple: does it help a pet get seen, get found, or get home? If not, it doesn't ship." />
            <ValueCard icon="pass" title="Kind by default" body="There is no downvote on Fetchpawz. The harshest thing you can do to a pet here is pass, and someone else will like them within the hour." />
            <ValueCard icon="park" title="Useful off the couch" body="The app should matter in the real world — a park to meet at, a tag that gets a found pet home, an alert the minute one goes missing." />
          </div>
        </section>

        {/* Contact */}
        <section className="surface p-8 text-center">
          <h2 className="text-xl font-extrabold text-navy dark:text-biscuit">Say hello</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            The why and the how read every email. Questions, press, or
            partnership ideas? Reach us at{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className={LINK}>
              fetchpawz.inc@gmail.com
            </a>
            .
          </p>
          <div className="mt-5">
            <Link to="/mission" className={`inline-flex items-center gap-1 text-sm ${LINK}`}>
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
    <div className="surface p-5">
      <p className="text-base font-extrabold text-navy dark:text-biscuit">{name}</p>
      <p className="mt-0.5 text-2xs font-extrabold uppercase tracking-[0.1em] text-brand-700 dark:text-brand-400">
        {role}
      </p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-snug">{body}</p>
    </div>
  );
}

function ValueCard({ icon, title, body }: { icon: BrandIconName; title: string; body: string }) {
  return (
    <div className="surface p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-navy dark:bg-brand-500/20 dark:text-biscuit">
        <BrandIcon name={icon} size={24} />
      </span>
      <p className="mt-3 text-base font-extrabold text-navy dark:text-biscuit">{title}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-snug">{body}</p>
    </div>
  );
}
