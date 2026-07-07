import { Link } from 'react-router-dom';
import { Ban, PawPrint, Trophy, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import { useSubscription } from '../utils/useSubscription';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const PERKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Undo2, title: 'Unlimited rewinds', body: 'Undo any swipe — no time limit, no daily cap.' },
  { icon: PawPrint, title: 'Unlimited daily swipes', body: 'Free users get 50/day. Pack+ removes the limit.' },
  { icon: Ban, title: 'No ads', body: 'No banners, no rewarded videos, no interruptions.' },
  { icon: Trophy, title: 'Priority winners', body: 'Earlier visibility on the weekly top-pet feed.' },
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
        <p className="text-xs uppercase tracking-wide text-brand-500 font-semibold">Subscription</p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Pack+</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Support Fetch and unlock the good stuff.
        </p>
      </header>

      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-5 shadow-soft mb-6">
        <p className="text-xs uppercase tracking-wide opacity-80">Current status</p>
        <p className="text-xl font-bold mt-1">
          {subscription.isLoading
            ? 'Checking…'
            : subscription.isSubscriber
              ? '🐾 Pack+ active'
              : 'Free plan'}
        </p>
        {!subscription.isSubscriber && (
          <p className="text-sm opacity-90 mt-1">
            Upgrade to remove the swipe cap and ads.
          </p>
        )}
      </section>

      <ul className="space-y-3 mb-6">
        {PERKS.map((perk) => (
          <li key={perk.title} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
            <span
              className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300"
              aria-hidden
            >
              <perk.icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{perk.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{perk.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Payments aren't wired up yet. Ask an admin to grant Pack+ to your account for testing.
        </p>
        <Link to="/app/home" className="mt-3 inline-block">
          <Button variant="secondary" size="sm">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
