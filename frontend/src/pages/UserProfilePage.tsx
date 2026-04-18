import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import TimeAgo from '../components/TimeAgo';
import { getUserProfile } from '../api/social';
import { resendVerification } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (data) => {
      if (data.debug_token) {
        // Dev mode: surface the link so the user can verify without SMTP.
        setDebugToken(data.debug_token);
        toast.success('Verification email sent (dev token below)');
      } else {
        toast.success('Verification email sent');
      }
    },
    onError: () => toast.error('Could not send verification email'),
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

      {isMe && currentUser && !currentUser.is_verified && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-amber-800">Email not verified</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Verify <span className="font-mono">{currentUser.email}</span> so we can reach you about account and safety updates.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={resendMutation.isPending}
              onClick={() => resendMutation.mutate()}
            >
              Resend email
            </Button>
          </div>
          {debugToken && (
            <div className="mt-2 p-2 bg-white border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700 mb-1">
                Dev mode: no SMTP configured. Use this link to verify:
              </p>
              <Link
                to={`/verify-email/${debugToken}`}
                className="text-xs text-brand-500 break-all hover:underline"
              >
                {window.location.origin}/verify-email/{debugToken}
              </Link>
            </div>
          )}
        </div>
      )}

      {isMe && (
        <div className="flex flex-col gap-2 mt-4">
          <Link
            to="/profile/edit"
            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-700">Edit profile</span>
            <span className="text-gray-400">›</span>
          </Link>
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
