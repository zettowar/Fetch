import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicNews, type PublicNewsPost } from '../api/publicSite';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { Spinner } from '../components/ui/Skeleton';
import PageHero from './PageHero';
import WaitlistForm from './WaitlistForm';

/**
 * News — articles posted from the admin panel (Admin → News). Drafts stay
 * hidden until published; if every post is removed, a friendly empty state
 * shows instead.
 */

function monthYear(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function PostLink({ post }: { post: PublicNewsPost }) {
  if (!post.link_url || !post.link_label) return null;
  const className = 'font-medium text-brand-600 dark:text-brand-400 hover:underline';
  const label = (
    <>
      {post.link_label} <span aria-hidden>→</span>
    </>
  );
  return (
    <p className="mt-3 text-base">
      {/^https?:\/\//.test(post.link_url) ? (
        <a href={post.link_url} target="_blank" rel="noopener noreferrer" className={className}>
          {label}
        </a>
      ) : (
        <Link to={post.link_url} className={className}>
          {label}
        </Link>
      )}
    </p>
  );
}

export default function NewsPage() {
  useDocumentTitle('News · Fetchpawz');
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['public-news'],
    queryFn: getPublicNews,
  });

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="News"
        title="What's new at Fetchpawz"
        subtitle="Short notes from the team as we get Fetchpawz ready."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="space-y-6">
            {posts.map((post) => (
              <li
                key={post.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-soft-sm"
              >
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 font-semibold text-brand-700 dark:text-brand-400">
                    {post.tag}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                    {monthYear(post.published_at)}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  {post.body}
                </p>
                <PostLink post={post} />
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10 mx-auto max-w-md text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Want an invite when testing expands?
          </p>
          <WaitlistForm source="news" variant="neutral" className="mt-3" />
        </div>
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
