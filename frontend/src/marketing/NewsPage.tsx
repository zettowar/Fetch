import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
  body: ReactNode;
};

const POSTS: NewsPost[] = [
  {
    date: 'June 2026',
    tag: 'Milestone',
    title: 'Fetch enters private beta',
    body: (
      <>
        The first invites went out. A small group of dog owners and rescue
        partners is using Fetch daily now, and their feedback has already
        changed how the feed works. A public launch date comes next.
      </>
    ),
  },
  {
    date: 'May 2026',
    tag: 'Partnerships',
    title: 'Partnering with rescues for launch',
    body: (
      <>
        Adoption is the whole point of Fetch, so rescues got the first look.
        Our earliest partners are setting up their profiles now, and their
        adoptable dogs will be in the feed on day one. If you run a rescue and
        want in,{' '}
        <Link to="/signup-rescue" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          applications are open
        </Link>
        .
      </>
    ),
  },
];

export default function NewsPage() {
  useDocumentTitle('News · Fetch');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="News"
        title="What's new at Fetch"
        subtitle="Short notes from the team as we get Fetch ready."
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
                <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-400">{post.body}</p>
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
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Check back soon.</p>
    </div>
  );
}
