import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { useAuth } from '../store/AuthContext';
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
  useDocumentTitle('Verify email · Fetch');

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
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      {status === 'verifying' && (
        <>
          <Spinner className="h-8 w-8 mb-4" />
          <p className="text-gray-500">Verifying your email…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <span className="text-4xl mb-2">✅</span>
          <h1 className="text-2xl font-bold mb-2">{message}</h1>
          <p className="text-gray-500 mb-6">Thanks for confirming your address.</p>
          <Button onClick={() => navigate(user ? `/users/${user.id}` : '/')}>
            Continue
          </Button>
        </>
      )}
      {status === 'error' && (
        <>
          <span className="text-4xl mb-2">⚠️</span>
          <h1 className="text-2xl font-bold mb-2">Verification failed</h1>
          <p className="text-gray-500 mb-6 max-w-sm">{message}</p>
          {user ? (
            <Link to={`/users/${user.id}`}>
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
  );
}
