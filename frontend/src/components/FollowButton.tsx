import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { followDog, unfollowDog, getFollowerCount } from '../api/social';

interface FollowButtonProps {
  dogId: string;
}

export default function FollowButton({ dogId }: FollowButtonProps) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['follower-count', dogId],
    queryFn: () => getFollowerCount(dogId),
  });

  const followMutation = useMutation({
    mutationFn: () => followDog(dogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follower-count', dogId] });
    },
    onError: () => toast.error('Failed to follow'),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowDog(dogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follower-count', dogId] });
    },
    onError: () => toast.error('Failed to unfollow'),
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
