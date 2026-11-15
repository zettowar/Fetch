import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createComment, getComments, deleteComment } from '../api/social';
import { useAuth } from '../store/AuthContext';
import Button from './ui/Button';
import Avatar from './ui/Avatar';
import Linkify from './Linkify';
import { ReportButton } from './ReportDialog';
import TimeAgo from './TimeAgo';

interface CommentSectionProps {
  targetType: string;
  targetId: string;
}

const INITIAL_SHOW = 5;

export default function CommentSection({ targetType, targetId }: CommentSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [showAll, setShowAll] = useState(false);

  const { data: comments = [], isError, refetch } = useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: () => getComments(targetType, targetId),
  });

  const createMutation = useMutation({
    mutationFn: () => createComment(targetType, targetId, body),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    },
    onError: () => toast.error("Couldn't post your comment. Try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    },
  });

  const visibleComments = showAll ? comments : comments.slice(0, INITIAL_SHOW);
  const hasMore = comments.length > INITIAL_SHOW && !showAll;

  return (
    <div className="mt-4">
      <h3 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">
        Comments{isError ? '' : ` (${comments.length})`}
      </h3>

      {isError ? (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Couldn't load comments.{' '}
          <button onClick={() => refetch()} className="font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit">
            Retry
          </button>
        </p>
      ) : comments.length > 0 ? (
        <div className="flex flex-col gap-2 mb-3">
          {visibleComments.map((c) => (
            <div key={c.id} className="surface flex gap-2.5 p-3">
              <Avatar name={c.author_name || 'U'} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-navy dark:text-biscuit">
                      {c.author_name || 'Unknown'}
                    </span>
                    <TimeAgo value={c.created_at} className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  {user?.id === c.author_id ? (
                    <button
                      onClick={() => {
                        if (confirm('Delete this comment?')) deleteMutation.mutate(c.id);
                      }}
                      className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors px-1"
                    >
                      Delete
                    </button>
                  ) : (
                    user && (
                      <ReportButton
                        targetType="comment"
                        targetId={c.id}
                        targetLabel="this comment"
                        className="px-1"
                      />
                    )
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5 whitespace-pre-wrap break-words">
                  <Linkify>{c.body}</Linkify>
                </p>
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit text-center py-1"
            >
              View all {comments.length} comments
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No comments yet.</p>
      )}

      {/* Post comment */}
      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 min-h-[40px] rounded-full border-2 border-navy/25 bg-white px-4 py-2 text-sm font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400"
          placeholder="Add a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim()) createMutation.mutate();
          }}
          maxLength={1000}
        />
        {/* Secondary: the comment box sits under a pet or post that owns the
            screen's one primary. */}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => createMutation.mutate()}
          disabled={!body.trim()}
          loading={createMutation.isPending}
        >
          Post
        </Button>
      </div>
    </div>
  );
}
