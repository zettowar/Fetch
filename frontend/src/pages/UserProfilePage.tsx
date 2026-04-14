import { useParams, Link } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import TimeAgo from '../components/TimeAgo';
import { useQuery } from '@tanstack/react-query';
import { getUserProfile } from '../api/social';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  });

  useDocumentTitle(profile ? `${profile.display_name} · Fetch` : null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!profile) return <div className="p-4 text-gray-500">User not found</div>;

  const isMe = currentUser?.id === profile.id;

  const handleShare = () => {
    const url = `${window.location.origin}/users/${profile.id}`;
    shareLink(url, `${profile.display_name} on Fetch`);
  };

  return (
    <div className="p-4">
      <BackButton />
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-brand-100 flex items-center justify-center text-3xl text-brand-600 font-bold mb-3">
          {profile.display_name[0].toUpperCase()}
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <button
            onClick={handleShare}
            className="text-xs text-gray-400 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
            title="Share profile"
          >
            Share
          </button>
        </div>
        {profile.location_rough && (
          <p className="text-gray-500">{profile.location_rough}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Joined <TimeAgo value={profile.created_at} />
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
        <div className="flex flex-col gap-2 mt-4">
          <Link
            to="/following"
            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-700">Dogs I follow</span>
            <span className="text-gray-400">›</span>
          </Link>
          <Link
            to="/notifications"
            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-700">Notification settings</span>
            <span className="text-gray-400">›</span>
          </Link>
        </div>
      )}
    </div>
  );
}
