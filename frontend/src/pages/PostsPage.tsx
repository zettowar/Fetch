import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pin, Plus } from 'lucide-react';
import { createPost, listPosts, type Post, type PostKind } from '../api/posts';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { useDebounced } from '../utils/useDebounced';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';

const KIND_FILTERS: { label: string; value: PostKind | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Community', value: 'community' },
  { label: 'Spotlights', value: 'rescue_spotlight' },
];

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

// Pink is the rescue colour, so a spotlight wears the rescue badge; a
// sponsored post is plainly neutral (never gold — nothing was earned).
export const KIND_BADGE: Record<PostKind, { label: string; variant: BadgeVariant } | null> = {
  community: null,
  sponsor: { label: 'Sponsored', variant: 'neutral' },
  rescue_spotlight: { label: 'Rescue spotlight', variant: 'rescue' },
};

export default function PostsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<PostKind | 'all'>('all');
  const [search, setSearch] = useState('');
  // The input stays responsive; only the settled value reaches the query key,
  // so typing a term is one request rather than one per keystroke.
  const debouncedSearch = useDebounced(search);
  const [composerOpen, setComposerOpen] = useState(false);

  useDocumentTitle('Community · Fetchpawz');

  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['posts', kind, debouncedSearch],
    queryFn: () =>
      listPosts({
        kind: kind === 'all' ? undefined : kind,
        search: debouncedSearch.trim() || undefined,
      }),
  });

  return (
    // A feed stays a readable column at every size: centred from `sm`. Only
    // at xl, where there is room beside a full-width feed, do search and the
    // filter move into a sticky side column — so they are still in reach a
    // long way down the feed. The grid wrapper is `contents` below xl.
    <div className="pb-6 sm:mx-auto sm:max-w-2xl xl:max-w-[62rem]">
      <PageHeader
        title="Community"
        subtitle="Questions, tips and good news from other Fetchpawz humans."
        className="px-4 pt-4 mb-4"
        action={
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            <Plus size={16} aria-hidden /> Post
          </Button>
        }
      />

      <div className="contents xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <div className="px-4 flex flex-col gap-3 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-20">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search posts…"
          aria-label="Search posts"
        />

        {/* One-of-a-few: the segmented control (aria-pressed paints it). */}
        <div className="seg self-start" role="group" aria-label="Filter by kind">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setKind(f.value)}
              aria-pressed={kind === f.value}
              className={kind === f.value ? 'seg-on' : 'hover:bg-navy/5 dark:hover:bg-white/10'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 xl:mt-0 xl:col-start-1 xl:row-start-1">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState message="Couldn't load posts." onRetry={() => refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState
            illustration="digging"
            title={search.trim() ? 'Nothing matched that' : 'No posts yet'}
            body={
              search.trim()
                ? 'Try a different word, or clear the search.'
                : 'Be the first to start a conversation.'
            }
            action={
              !search.trim() ? (
                // The header's Post button is this screen's primary.
                <Button size="sm" variant="secondary" onClick={() => setComposerOpen(true)}>
                  Write the first post
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((p) => (
              <li key={p.id}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          setComposerOpen(false);
        }}
        canPickKind={user?.role === 'admin' || user?.role === 'moderator'}
      />
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const badge = KIND_BADGE[post.kind];
  return (
    <Card as={Link} to={`/app/community/${post.id}`} interactive>
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar name={post.author_name || 'U'} size="sm" />
        <span className="text-sm font-bold text-navy dark:text-biscuit truncate">
          {post.author_name || 'Unknown'}
        </span>
        <TimeAgo
          value={post.created_at}
          className="text-xs text-gray-500 dark:text-gray-400"
        />
        {post.pinned && (
          <Pin
            size={13}
            className="text-brand-500 ml-auto flex-shrink-0"
            aria-label="Pinned"
          />
        )}
      </div>

      <h2 className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit text-balance">{post.title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 whitespace-pre-wrap">
        {post.body}
      </p>

      {(badge || (post.tags && post.tags.length > 0)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          {post.tags?.map((t) => (
            <Badge key={t} variant="neutral">
              #{t}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function Composer({
  open,
  onClose,
  onCreated,
  canPickKind,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  canPickKind: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [kind, setKind] = useState<PostKind>('community');

  const mutation = useMutation({
    mutationFn: () =>
      createPost({
        title: title.trim(),
        body: body.trim(),
        kind,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Posted');
      setTitle('');
      setBody('');
      setTags('');
      setKind('community');
      onCreated();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't publish that post")),
  });

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} title="New post">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !mutation.isPending) mutation.mutate();
        }}
      >
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="post-body" className="field-label">
            Post
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={10000}
            required
            className="w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400"
          />
        </div>

        <Input
          label="Tags"
          placeholder="training, puppies (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        {canPickKind && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="post-kind" className="field-label">
              Kind
            </label>
            <select
              id="post-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as PostKind)}
              className="w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400 min-h-[48px]"
            >
              <option value="community">Community</option>
              <option value="rescue_spotlight">Rescue spotlight</option>
              <option value="sponsor">Sponsored</option>
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={!canSubmit}
            loading={mutation.isPending}
          >
            Publish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
