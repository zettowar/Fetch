import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pin, Plus } from 'lucide-react';
import { createPost, listPosts, type Post, type PostKind } from '../api/posts';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Avatar from '../components/ui/Avatar';
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

export const KIND_BADGE: Record<PostKind, { label: string; className: string } | null> = {
  community: null,
  sponsor: {
    label: 'Sponsored',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
  rescue_spotlight: {
    label: 'Rescue spotlight',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  },
};

export default function PostsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<PostKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  useDocumentTitle('Community · Fetchpawz');

  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['posts', kind, search],
    queryFn: () =>
      listPosts({
        kind: kind === 'all' ? undefined : kind,
        search: search.trim() || undefined,
      }),
  });

  return (
    <div className="pb-6">
      <PageHeader
        title="Community"
        subtitle="Questions, tips and good news from other Fetchpawz humans."
        action={
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            <Plus size={16} aria-hidden /> Post
          </Button>
        }
      />

      <div className="px-4 flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search posts…"
          aria-label="Search posts"
        />

        <div className="flex gap-1.5" role="group" aria-label="Filter by kind">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setKind(f.value)}
              aria-pressed={kind === f.value}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                kind === f.value
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4">
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
                <Button size="sm" onClick={() => setComposerOpen(true)}>
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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {post.author_name || 'Unknown'}
        </span>
        <TimeAgo
          value={post.created_at}
          className="text-xs text-gray-400 dark:text-gray-500"
        />
        {post.pinned && (
          <Pin
            size={13}
            className="text-brand-500 ml-auto flex-shrink-0"
            aria-label="Pinned"
          />
        )}
      </div>

      <h2 className="font-semibold tracking-tight text-balance">{post.title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 whitespace-pre-wrap">
        {post.body}
      </p>

      {(badge || (post.tags && post.tags.length > 0)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
          {post.tags?.map((t) => (
            <span
              key={t}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              #{t}
            </span>
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
          <label
            htmlFor="post-body"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Post
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={10000}
            required
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
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
            <label
              htmlFor="post-kind"
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Kind
            </label>
            <select
              id="post-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as PostKind)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
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
