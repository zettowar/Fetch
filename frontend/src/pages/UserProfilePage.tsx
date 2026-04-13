import { useParams } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { relativeTime } from '../utils/time';
import { useQuery } from '@tanstack/react-query';
import { getUserProfile } from '../api/social';
import { useAuth } from '../store/AuthContext';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!profile) return <div className="p-4 text-gray-500">User not found</div>;

  const isMe = currentUser?.id === profile.id;

  return (
    <div className="p-4">
      <BackButton />
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-brand-100 flex items-center justify-center text-3xl text-brand-600 font-bold mb-3">
          {profile.display_name[0].toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold">{profile.display_name}</h1>
        {profile.location_rough && (
          <p className="text-gray-500">{profile.location_rough}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Joined {relativeTime(profile.created_at)}
        </p>
      </div>

      <div className="flex justify-center gap-8 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-brand-600">{profile.dog_count}</p>
          <p className="text-xs text-gray-500">Dogs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-brand-600">{profile.follower_count}</p>
          <p className="text-xs text-gray-500">Followers</p>
        </div>
      </div>

      {isMe && (
        <p className="text-sm text-gray-400 text-center">This is your profile</p>
      )}
    </div>
  );
}
