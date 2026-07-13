import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { verifyEmail } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero from '../components/AuthHero';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { apiErrorMessage } from '../utils/apiError';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);
  useDocumentTitle('Verify email · Fetchpawz');

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    verifyEmail(token)
      .then(async () => {
        setStatus('success');
        setMessage('Email verified!');
        if (user) {
          // Refresh user state so the banner disappears on the profile page.
          await refreshUser().catch(() => undefined);
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(apiErrorMessage(err, 'This verification link is invalid or has expired.'));
      });
  }, [token, user, refreshUser]);

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Email verification"
        subtitle="One quick sniff to confirm this address is yours."
        icon={<MailCheck size={32} aria-hidden />}
      />
      <div className="px-5 mt-8">
        <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg flex flex-col items-center text-center">
          {status === 'verifying' && (
            <>
              <Spinner className="h-8 w-8 my-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Verifying your email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <DogIllustration
                name="ball"
                className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
              />
              <h2 className="text-2xl font-bold mb-2">{message}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Thanks for confirming your address.</p>
              <Button onClick={() => navigate(user ? `/app/users/${user.id}` : '/')}>
                Continue
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <DogIllustration
                name="howling"
                className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
              />
              <h2 className="text-2xl font-bold mb-2">Verification failed</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{message}</p>
              {user ? (
                <Link to={`/app/users/${user.id}`}>
                  <Button variant="secondary">Back to profile</Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button variant="secondary">Go to login</Button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
