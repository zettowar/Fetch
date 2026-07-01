import PageHero from './PageHero';

/**
 * News — SCAFFOLDED.
 *
 * A simple, styled update feed you can maintain by hand for now. Replace the
 * `POSTS` array below with real entries (or wire it to a CMS / the backend
 * later). If you delete every post, a friendly empty state shows instead.
 */

type NewsPost = {
  date: string; // e.g. 'June 2026'
  tag: string; // e.g. 'Product', 'Milestone', 'Behind the scenes'
  title: string;
  body: string;
};

// TODO(news): replace these placeholder entries with real updates.
const POSTS: NewsPost[] = [
  {
    date: 'Coming soon',
    tag: 'Milestone',
    title: 'Fetch is heading to beta',
    body: '[ Placeholder — announce your first milestone here: closed beta, waitlist opening, a launch date. ]',
  },
  {
    date: 'Coming soon',
    tag: 'Behind the scenes',
    title: 'Building the swipe feed',
    body: '[ Placeholder — a short behind-the-scenes note on what you shipped or learned this month. ]',
  },
];

export default function NewsPage() {
  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="News"
        title="What's new at Fetch"
        subtitle="Follow along as we build in the open on the road to launch."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        {POSTS.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="space-y-6">
            {POSTS.map((post, i) => (
              <li
                key={i}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-soft-sm"
              >
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 font-semibold text-brand-700 dark:text-brand-400">
                    {post.tag}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{post.date}</span>
                </div>
                <h2 className="mt-3 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{post.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">{post.body}</p>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-10 text-center text-sm text-gray-400 dark:text-gray-500">
          Want updates in your inbox?{' '}
          {/* TODO(news): wire up a real newsletter/waitlist, or remove this line. */}
          <a href="mailto:fetchpawz.inc@gmail.com" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
            Drop us a note
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-12 text-center">
      <span className="text-4xl" aria-hidden>📰</span>
      <p className="mt-3 font-semibold text-gray-700 dark:text-gray-300">No news yet</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Check back soon — updates are on the way.</p>
    </div>
  );
}
