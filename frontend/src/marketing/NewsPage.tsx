import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicNews, type PublicNewsPost } from '../api/publicSite';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { Spinner } from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';
import BrandEmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
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
  const className = 'font-bold text-brand-700 dark:text-brand-400 hover:underline';
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
  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public-news'],
    queryFn: getPublicNews,
  });

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="News"
        title="What's new at Fetchpawz"
        subtitle="Short notes from the team as we get Fetchpawz ready."
        cast={['dachshund', 'ginger', 'corgi']}
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : isError ? (
          <ErrorState message="Couldn't load the news." onRetry={() => refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="space-y-6">
            {posts.map((post) => (
              <li key={post.id} className="surface p-6">
                <div className="flex items-center gap-3">
                  <Badge variant="brand" size="md">
                    {post.tag}
                  </Badge>
                  <span className="text-2xs font-extrabold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                    {monthYear(post.published_at)}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-extrabold text-navy dark:text-biscuit">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-gray-700 dark:text-gray-300">
                  {post.body}
                </p>
                <PostLink post={post} />
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10 mx-auto max-w-md text-center">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Want an invite when testing expands?
          </p>
          <WaitlistForm source="news" variant="neutral" className="mt-3" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return <BrandEmptyState illustration="sleeping" title="No news yet" body="Check back soon." className="py-12" />;
}
