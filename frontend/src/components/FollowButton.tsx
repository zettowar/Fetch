import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { followDog, unfollowDog, getFollowerCount } from '../api/social';
import { apiErrorMessage } from '../utils/apiError';
import BrandIcon from './brand/BrandIcon';

interface FollowButtonProps {
  petId: string;
}

interface FollowerCount {
  is_following: boolean;
  count: number;
}

export default function FollowButton({ petId }: FollowButtonProps) {
  const queryClient = useQueryClient();
  const key = ['follower-count', petId];

  const { data } = useQuery<FollowerCount>({
    queryKey: key,
    queryFn: () => getFollowerCount(petId),
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

  // Following a pet changes this button's count *and* the viewer's follow list,
  // which the Following page and the Home strip both render. Invalidating only
  // the count left those two screens showing a stale list until a hard reload.
  const invalidateAffected = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['my-follows'] });
  };

  const followMutation = useMutation({
    mutationFn: () => followDog(petId),
    onMutate: () => applyOptimistic(true),
    onError: (err, _vars, ctx) => {
      rollback(ctx);
      toast.error(apiErrorMessage(err, "Couldn't follow. Try again."));
    },
    onSettled: invalidateAffected,
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowDog(petId),
    onMutate: () => applyOptimistic(false),
    onError: (err, _vars, ctx) => {
      rollback(ctx);
      toast.error(apiErrorMessage(err, "Couldn't unfollow. Try again."));
    },
    onSettled: invalidateAffected,
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
      // Never btn-primary: this sits on every card in a list, and a screen
      // gets one primary. Follow is the white pill with the follow icon;
      // Following is the selected state (an orange tint on a soft line), and
      // hovering it previews the unfollow in danger ink.
      className={`btn btn-sm ${
        isFollowing
          ? hovered
            ? 'border-[1.5px] border-danger-500 bg-danger-50 text-danger-700 dark:border-danger-400 dark:bg-danger-500/15 dark:text-danger-200'
            : 'border-[1.5px] border-navy/30 bg-brand-100 text-navy dark:border-white/20 dark:bg-brand-500/20 dark:text-brand-100'
          : 'btn-secondary'
      } ${pending ? 'cursor-wait' : ''}`}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        !isFollowing && <BrandIcon name="follow" size={16} />
      )}
      <span>{label}</span>
      <span className="tabular-nums font-bold opacity-70">({count})</span>
    </button>
  );
}
