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

  return (
    <button
      onClick={() => (isFollowing ? unfollowMutation : followMutation).mutate()}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isFollowing
          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          : 'bg-brand-500 text-white hover:bg-brand-600'
      }`}
      disabled={followMutation.isPending || unfollowMutation.isPending}
    >
      {isFollowing ? 'Following' : 'Follow'} ({count})
    </button>
  );
}
