import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { followDog, unfollowDog, getFollowerCount } from '../api/social';
import { apiErrorMessage } from '../utils/apiError';

interface FollowButtonProps {
  dogId: string;
}

interface FollowerCount {
  is_following: boolean;
  count: number;
}

export default function FollowButton({ dogId }: FollowButtonProps) {
  const queryClient = useQueryClient();
  const key = ['follower-count', dogId];

  const { data } = useQuery<FollowerCount>({
    queryKey: key,
    queryFn: () => getFollowerCount(dogId),
  });

  const applyOptimistic = async (nextIsFollowing: boolean) => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<FollowerCount>(key);
    queryClient.setQueryData<FollowerCount>(key, (prev) => {
      const base = prev ?? { is_following: !nextIsFollowing, count: 0 };
      const delta = nextIsFollowing === base.is_following ? 0 : nextIsFollowing ? 1 : -1;
      return {
        is_following: nextIsFollowing,
        count: Math.max(0, base.count + delta),
      };
    });
    return { previous };
  };

  const rollback = (ctx: { previous?: FollowerCount } | undefined) => {
    if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
  };

  const followMutation = useMutation({
    mutationFn: () => followDog(dogId),
    onMutate: () => applyOptimistic(true),
    onError: (err, _vars, ctx) => {
      rollback(ctx);
      toast.error(apiErrorMessage(err, 'Failed to follow'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowDog(dogId),
    onMutate: () => applyOptimistic(false),
    onError: (err, _vars, ctx) => {
      rollback(ctx);
      toast.error(apiErrorMessage(err, 'Failed to unfollow'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const isFollowing = data?.is_following ?? false;
  const count = data?.count ?? 0;
  const pending = followMutation.isPending || unfollowMutation.isPending;
  const [hovered, setHovered] = useState(false);

  const label = isFollowing ? (hovered ? 'Unfollow' : 'Following') : 'Follow';

  return (
    <button
      onClick={() => (isFollowing ? unfollowMutation : followMutation).mutate()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ease-soft-out active:scale-[0.97] ${
        isFollowing
          ? hovered
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
          : 'bg-brand-500 text-white shadow-soft-sm hover:bg-brand-600 hover:shadow-brand-glow'
      } ${pending ? 'opacity-75 cursor-wait' : ''}`}
      disabled={pending}
      aria-busy={pending}
    >
      {pending && (
        <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      <span>{label}</span>
      <span className="tabular-nums opacity-80">({count})</span>
    </button>
  );
}
