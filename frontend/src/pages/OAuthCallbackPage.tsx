import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { oauthExchange } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero from '../components/AuthHero';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { apiErrorMessage } from '../utils/apiError';

type Status = 'working' | 'error';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);
  useDocumentTitle('Signing in · Fetchpawz');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const error = params.get('error');
    const code = params.get('code');
    const next = params.get('next') || '/app/home';

    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('Missing sign-in code. Please try again.');
      return;
    }
    oauthExchange(code)
      .then((data) => {
        // Same storage path as password login → refresh + reload bootstrap just work.
        authLogin(data.tokens.access_token, data.tokens.refresh_token, data.user);
        const dest = next.startsWith('/app')
          ? next
          : data.user.role === 'rescue'
            ? '/app/rescue/dashboard'
            : '/app/home';
        navigate(dest, { replace: true });
      })
      .catch((err) => {
        setStatus('error');
        setMessage(apiErrorMessage(err, 'We could not complete sign-in. Please try again.'));
      });
  }, [params, authLogin, navigate]);

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Signing you in"
        subtitle="Hang tight — finishing up with your provider."
        icon={<LogIn size={32} aria-hidden />}
      />
      <div className="px-5 mt-8">
        <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg flex flex-col items-center text-center">
          {status === 'working' && (
            <>
              <Spinner className="h-8 w-8 my-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Completing sign-in…</p>
            </>
          )}
          {status === 'error' && (
            <>
              <DogIllustration name="howling" className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500" />
              <h2 className="text-2xl font-bold mb-2">Sign-in failed</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{message}</p>
              <Link to="/login">
                <Button variant="secondary">Back to login</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
