import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero, { AUTH_CARD } from '../components/AuthHero';
import BrandIcon from '../components/brand/BrandIcon';
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
        icon={<BrandIcon name="mail" size={32} />}
      />
      <div className="px-1 sm:px-5 mt-7">
        <div className={`${AUTH_CARD} flex flex-col items-center text-center`}>
          {status === 'verifying' && (
            <>
              <Spinner size="lg" className="my-4" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Verifying your email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <DogIllustration name="ball" className="mb-4 h-28 w-auto" />
              <h2 className="mb-1.5 text-xl font-extrabold text-navy dark:text-biscuit">{message}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Thanks for confirming your address.</p>
              <Button onClick={() => navigate(user ? `/app/users/${user.id}` : '/')}>
                Continue
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <DogIllustration name="howling" className="mb-4 h-28 w-auto" />
              <h2 className="mb-1.5 text-xl font-extrabold text-navy dark:text-biscuit">Verification failed</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-sm">{message}</p>
              {user ? (
                <Link to={`/app/users/${user.id}`} className="btn btn-secondary">
                  Back to profile
                </Link>
              ) : (
                <Link to="/login" className="btn btn-secondary">
                  Go to login
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
