import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
import PawMark from '../components/ui/PawMark';

const FEATURES = [
  {
    icon: '❤️',
    title: 'Swipe & rate',
    body: 'Tinder-style feed of good boys and girls. One tap, one vote.',
  },
  {
    icon: '🏆',
    title: 'Weekly top dog',
    body: "Votes reset every Monday. Crown a new community favorite every week.",
  },
  {
    icon: '🐶',
    title: 'Build their profile',
    body: 'Photos, traits, breed, bio — give your pup a proper showcase.',
  },
  {
    icon: '🚨',
    title: 'Lost & found',
    body: 'Nearby missing-dog alerts and sighting reports. A safety net for your pack.',
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/home" replace />;

  return (
    <div className="flex flex-col pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 text-white px-6 pt-10 pb-14">
        {/* decorative blobs */}
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-12 w-52 h-52 rounded-full bg-brand-700/30 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-soft-lg ring-1 ring-white/20">
            <PawMark className="h-14 w-14 text-white" />
          </div>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Fetch</h1>
          <p className="mt-2 text-lg font-medium text-white/95 text-balance">
            Rate dogs. Win hearts. Find the top pup.
          </p>
          <p className="mt-2 text-sm text-white/80 max-w-xs">
            A tiny social club for dog people — swipe, follow, and crown the week's best good boy.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 w-full max-w-xs">
            <Link to="/signup" className="block">
              <button className="w-full bg-white dark:bg-gray-900 text-brand-600 font-semibold py-3 rounded-xl shadow-soft-lg hover:shadow-soft transition-all active:scale-[0.98]">
                Get Started — it's free
              </button>
            </Link>
            <Link to="/login" className="block">
              <button className="w-full bg-white/15 hover:bg-white/25 text-white font-medium py-3 rounded-xl backdrop-blur-sm border border-white/25 transition-colors active:scale-[0.98]">
                Log In
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-4 mt-8">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center">
          What's inside
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-center text-balance">
          Everything dog people actually want
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon, title, body }) => (
            <div
              key={title}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-soft-sm flex flex-col gap-1.5"
            >
              <span className="text-2xl leading-none" aria-hidden>{icon}</span>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 mt-10">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold text-center">
          How it works
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-center">Three quick steps</h2>

        <ol className="mt-5 flex flex-col gap-3">
          <Step n={1} title="Add your dog" body="Photos, age, breed, a few traits. Takes under a minute." />
          <Step n={2} title="Swipe the feed" body="Rate every pup with a quick left or right. Your votes feed the leaderboard." />
          <Step n={3} title="Climb the rankings" body="A new top dog is crowned every Monday. Yours could be next." />
        </ol>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 mt-10">
        <div className="bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-brand-800">Ready to meet the pack?</p>
          <p className="text-sm text-brand-700/80 mt-1">
            Join free. No ads. No feed tricks. Just dogs.
          </p>
          <Link to="/signup" className="block mt-4">
            <Button size="lg" className="w-full">Get Started</Button>
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-soft-sm">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{body}</p>
      </div>
    </li>
  );
}
