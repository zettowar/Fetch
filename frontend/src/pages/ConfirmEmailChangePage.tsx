import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { confirmEmailChange } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero from '../components/AuthHero';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
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
  useDocumentTitle('Confirm email change · Fetch');

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
        icon={<MailCheck size={32} aria-hidden />}
      />
      <div className="px-5 mt-8">
        <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg flex flex-col items-center text-center">
          {status === 'confirming' && (
            <>
              <Spinner className="h-8 w-8 my-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Confirming your new email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <DogIllustration
                name="ball"
                className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
              />
              <h2 className="text-2xl font-bold mb-2">Email updated</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your account now uses this address. Use it next time you log in.
              </p>
              <Link to={user ? `/app/users/${user.id}` : '/login'}>
                <Button>Continue</Button>
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <DogIllustration
                name="howling"
                className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
              />
              <h2 className="text-2xl font-bold mb-2">Confirmation failed</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{message}</p>
              <Link to={user ? '/app/profile/edit' : '/login'}>
                <Button variant="secondary">{user ? 'Back to settings' : 'Go to login'}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
