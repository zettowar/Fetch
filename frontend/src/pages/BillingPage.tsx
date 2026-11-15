import { Link } from 'react-router-dom';
import BrandIcon, { type BrandIconName } from '../components/brand/BrandIcon';
import BackButton from '../components/ui/BackButton';
import { useSubscription } from '../utils/useSubscription';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Pack+ is Leash Navy: premium wears the ink, never gold (gold is earned).
const PERKS: { icon: BrandIconName; title: string; body: string }[] = [
  { icon: 'undo', title: 'Unlimited rewinds', body: 'Undo any swipe — no time limit, no daily cap.' },
  { icon: 'like', title: 'Unlimited daily swipes', body: 'Free users get 50/day. Pack+ removes the limit.' },
  { icon: 'close', title: 'No ads', body: 'No banners, no rewarded videos, no interruptions.' },
  { icon: 'eye', title: 'Priority winners', body: 'Earlier visibility on the weekly top-pet feed.' },
];

export default function BillingPage() {
  useDocumentTitle('Pack+');
  const subscription = useSubscription();

  return (
    <div className="px-4 pb-24 max-w-app mx-auto">
      <div className="py-3">
        <BackButton fallback="/app/home" />
      </div>

      <header className="mb-6">
        <p className="eyebrow">Subscription</p>
        <h1 className="text-[28px] leading-none text-navy dark:text-biscuit mt-1.5">Pack+</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">
          Support Fetchpawz and unlock the good stuff.
        </p>
      </header>

      <section className="rounded-2xl border-2 border-navy bg-navy text-biscuit p-5 mb-6 dark:border-white/15 dark:bg-night-raised">
        <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-biscuit/75">Current status</p>
        <p className="text-xl font-extrabold mt-1 flex items-center gap-2">
          {subscription.isSubscriber && !subscription.isLoading && (
            <BrandIcon name="check" size={22} />
          )}
          {subscription.isLoading
            ? 'Checking…'
            : subscription.isSubscriber
              ? 'Pack+ active'
              : 'Free plan'}
        </p>
        {!subscription.isSubscriber && (
          <p className="text-sm text-biscuit/85 mt-1">
            Upgrade to remove the swipe cap and ads.
          </p>
        )}
      </section>

      <ul className="space-y-3 mb-6">
        {PERKS.map((perk) => (
          <li key={perk.title} className="surface flex gap-3 p-3">
            <span
              className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-navy dark:bg-white/10 dark:text-biscuit"
              aria-hidden
            >
              <BrandIcon name={perk.icon} size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-extrabold text-navy dark:text-biscuit">{perk.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{perk.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 p-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Pack+ isn't on sale yet. During the beta the Fetchpawz team switches it on —{' '}
          <Link
            to="/app/support"
            className="font-extrabold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit"
          >
            get in touch
          </Link>{' '}
          if you'd like to try it.
        </p>
        <Link to="/app/home" className="btn btn-secondary btn-sm mt-3">
          Back to home
        </Link>
      </div>
    </div>
  );
}
