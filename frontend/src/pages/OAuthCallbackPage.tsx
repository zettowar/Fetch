import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { oauthExchange } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero, { AUTH_CARD, AUTH_LINK } from '../components/AuthHero';
import BrandIcon from '../components/brand/BrandIcon';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { apiErrorMessage } from '../utils/apiError';

type Status = 'working' | 'error' | 'needs-otp';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const attempted = useRef(false);
  // Held so the 2FA prompt can retry the same handoff code; the backend does
  // not spend it until the second factor checks out.
  const handoffCode = useRef<string | null>(null);
  useDocumentTitle('Signing in · Fetchpawz');

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const error = params.get('error');
    const code = params.get('code');

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
    handoffCode.current = code;
    finish(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, authLogin, navigate]);

  function finish(code: string, otpCode?: string) {
    setSubmitting(true);
    oauthExchange(code, otpCode)
      .then((data) => {
        // Same storage path as password login → refresh + reload bootstrap just work.
        authLogin(data.tokens.access_token, data.tokens.refresh_token, data.user);
        const next = params.get('next') || '/app/home';
        const dest = next.startsWith('/app')
          ? next
          : data.user.role === 'rescue'
            ? '/app/rescue/dashboard'
            : '/app/home';
        navigate(dest, { replace: true });
      })
      .catch((err) => {
        // Same signal password login uses.
        const resp = (err as { response?: { headers?: Record<string, string> } }).response;
        if (resp?.headers?.['x-2fa-required'] === '1') {
          setStatus('needs-otp');
          setMessage(otpCode ? 'That code was not right — try the current one.' : '');
          setOtp('');
          return;
        }
        setStatus('error');
        setMessage(apiErrorMessage(err, 'We could not complete sign-in. Please try again.'));
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Signing you in"
        subtitle="Hang tight — finishing up with your provider."
        icon={<BrandIcon name="user" size={32} />}
      />
      <div className="px-1 sm:px-5 mt-7">
        <div className={`${AUTH_CARD} flex flex-col items-center text-center`}>
          {status === 'working' && (
            <>
              <Spinner size="lg" className="my-4" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Completing sign-in…</p>
            </>
          )}
          {status === 'needs-otp' && (
            <form
              className="w-full"
              onSubmit={(e) => {
                e.preventDefault();
                if (handoffCode.current && otp.length >= 6) {
                  finish(handoffCode.current, otp);
                }
              }}
            >
              <h2 className="mb-1 text-xl font-extrabold text-navy dark:text-biscuit">Two-factor code</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Your account has 2FA on. Enter the current code from your
                authenticator app to finish signing in.
              </p>
              <Input
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                error={message || undefined}
              />
              <Button
                type="submit"
                className="w-full mt-4"
                disabled={otp.length < 6}
                loading={submitting}
              >
                Verify and continue
              </Button>
              <Link to="/login" className={`mt-4 inline-block text-sm ${AUTH_LINK}`}>
                Use a different sign-in
              </Link>
            </form>
          )}
          {status === 'error' && (
            <>
              <DogIllustration name="howling" className="mb-4 h-28 w-auto" />
              <h2 className="mb-1.5 text-xl font-extrabold text-navy dark:text-biscuit">Sign-in failed</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-sm">{message}</p>
              <Link to="/login" className="btn btn-secondary">
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
