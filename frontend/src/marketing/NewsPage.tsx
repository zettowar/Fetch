import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

/**
 * News — a simple update feed maintained by hand for now (a CMS or backend
 * feed can replace `POSTS` later). If every post is removed, a friendly empty
 * state shows instead.
 */

type NewsPost = {
  date: string; // e.g. 'June 2026'
  tag: string; // e.g. 'Product', 'Milestone', 'Behind the scenes'
  title: string;
  body: string;
};

const POSTS: NewsPost[] = [
  {
    date: 'June 2026',
    tag: 'Milestone',
    title: 'Fetch enters private beta',
    body: "The first pack is in. A small group of invited dog owners and rescue partners is now swiping, rating, and crowning weekly top dogs while we tighten the last screws. Their feedback is already reshaping the feed — next stop, a public launch date.",
  },
  {
    date: 'May 2026',
    tag: 'Partnerships',
    title: 'Partnering with rescues for launch',
    body: "Adoption is the whole point of Fetch, so rescues come first. We've started onboarding our first rescue partners, whose adoptable dogs will appear right in the swipe feed at launch — with listings, inquiry tools, and donation links included. Run a rescue and want in? We'd love to hear from you.",
  },
];

export default function NewsPage() {
  useDocumentTitle('News · Fetch');

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
