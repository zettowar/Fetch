import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pin, Trash2 } from 'lucide-react';
import { deletePost, getPost } from '../api/posts';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage, isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Avatar from '../components/ui/Avatar';
import BackButton from '../components/ui/BackButton';
import ErrorState from '../components/ui/ErrorState';
import Skeleton from '../components/ui/Skeleton';
import CommentSection from '../components/CommentSection';
import Linkify from '../components/Linkify';
import TimeAgo from '../components/TimeAgo';
import { ReportButton } from '../components/ReportDialog';
import { KIND_BADGE } from './PostsPage';

export default function PostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: post,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  useDocumentTitle(post ? `${post.title} · Fetchpawz` : null);

  const removeMutation = useMutation({
    mutationFn: () => deletePost(id!),
    onSuccess: () => {
      toast.success('Post deleted');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/app/community', { replace: true });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't delete that post")),
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-6 w-40 mb-3" />
        <Skeleton className="h-4 w-24 mb-6" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState message="Couldn't load this post." onRetry={() => refetch()} />;
  }
  if (!post) {
    return <ErrorState message="Post not found." />;
  }

  const badge = KIND_BADGE[post.kind];
  const canDelete = user?.id === post.author_id || user?.role === 'admin';

  return (
    <div className="pb-8">
      <div className="px-4 pt-3">
        <BackButton fallback="/app/community" />
      </div>

      <article className="px-4 mt-2">
        <div className="flex items-center gap-2">
          <Avatar name={post.author_name || 'U'} size="sm" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {post.author_name || 'Unknown'}
          </span>
          <TimeAgo
            value={post.created_at}
            className="text-xs text-gray-400 dark:text-gray-500"
          />
          {post.pinned && (
            <Pin size={13} className="text-brand-500" aria-label="Pinned" />
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-balance">
          {post.title}
        </h1>

        {(badge || (post.tags && post.tags.length > 0)) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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

        <div className="mt-4 text-base leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
          <Linkify>{post.body}</Linkify>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this post? This cannot be undone.')) {
                  removeMutation.mutate();
                }
              }}
              disabled={removeMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-danger-600 dark:text-gray-500 dark:hover:text-danger-400"
            >
              <Trash2 size={13} aria-hidden />
              Delete
            </button>
          ) : (
            user && (
              <ReportButton
                targetType="post"
                targetId={post.id}
                targetLabel="this post"
              />
            )
          )}
        </div>
      </article>

      <div className="px-4">
        <CommentSection targetType="post" targetId={post.id} />
      </div>
    </div>
  );
}
