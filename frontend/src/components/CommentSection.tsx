import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createComment, getComments, deleteComment } from '../api/social';
import { useAuth } from '../store/AuthContext';
import Button from './ui/Button';
import Avatar from './ui/Avatar';
import { relativeTime } from '../utils/time';

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

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: () => getComments(targetType, targetId),
  });

  const createMutation = useMutation({
    mutationFn: () => createComment(targetType, targetId, body),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    },
    onError: () => toast.error('Failed to post comment'),
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
      <h3 className="font-semibold mb-2">Comments ({comments.length})</h3>

      {comments.length > 0 ? (
        <div className="flex flex-col gap-2 mb-3">
          {visibleComments.map((c) => (
            <div key={c.id} className="flex gap-2.5 p-2.5 bg-gray-50 rounded-xl">
              <Avatar name={c.author_name || 'U'} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {c.author_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">{relativeTime(c.created_at)}</span>
                  </div>
                  {user?.id === c.author_id && (
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{c.body}</p>
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-brand-500 hover:underline text-center py-1"
            >
              View all {comments.length} comments
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-3">No comments yet.</p>
      )}

      {/* Post comment */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
          placeholder="Add a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim()) createMutation.mutate();
          }}
          maxLength={1000}
        />
        <Button
          size="sm"
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
