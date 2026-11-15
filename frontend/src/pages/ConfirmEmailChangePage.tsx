import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmEmailChange } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero, { AUTH_CARD } from '../components/AuthHero';
import BrandIcon from '../components/brand/BrandIcon';
import DogIllustration from '../components/flair/DogIllustration';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { apiErrorMessage } from '../utils/apiError';

type Status = 'confirming' | 'success' | 'error';

export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('confirming');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);
  useDocumentTitle('Confirm email change · Fetchpawz');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    if (!token) {
      setStatus('error');
      setMessage('This confirmation link is missing a token.');
      return;
    }
    confirmEmailChange(token)
      .then(async () => {
        setStatus('success');
        if (user) {
          await refreshUser().catch(() => undefined);
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(apiErrorMessage(err, 'This confirmation link is invalid or has expired.'));
      });
  }, [token, user, refreshUser]);

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Email change"
        subtitle="Switching your account to a new address."
        icon={<BrandIcon name="mail" size={32} />}
      />
      <div className="px-1 sm:px-5 mt-7">
        <div className={`${AUTH_CARD} flex flex-col items-center text-center`}>
          {status === 'confirming' && (
            <>
              <Spinner size="lg" className="my-4" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Confirming your new email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <DogIllustration name="ball" className="mb-4 h-28 w-auto" />
              <h2 className="mb-1.5 text-xl font-extrabold text-navy dark:text-biscuit">Email updated</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Your account now uses this address. Use it next time you log in.
              </p>
              <Link to={user ? `/app/users/${user.id}` : '/login'} className="btn btn-primary">
                Continue
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <DogIllustration name="howling" className="mb-4 h-28 w-auto" />
              <h2 className="mb-1.5 text-xl font-extrabold text-navy dark:text-biscuit">Confirmation failed</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-sm">{message}</p>
              <Link to={user ? '/app/profile/edit' : '/login'} className="btn btn-secondary">
                {user ? 'Back to settings' : 'Go to login'}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
