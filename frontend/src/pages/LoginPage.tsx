import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero, { AUTH_CARD, AUTH_LINK } from '../components/AuthHero';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import SSOButtons from '../components/SSOButtons';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function LoginPage() {
  useDocumentTitle('Log in · Fetchpawz');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login: authLogin, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to go once signed in: back to the page that bounced us here when it
  // is one of ours (/app, or /admin for staff) — query string included, so a
  // filtered list or ?rescue= link survives the detour — else home by role.
  const destinationFor = (u: { role: string }) => {
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    const path = from?.pathname ?? '';
    const isStaff = u.role === 'admin' || u.role === 'moderator';
    if (path.startsWith('/app') || (isStaff && path.startsWith('/admin'))) {
      return path + (from?.search ?? '');
    }
    return u.role === 'rescue' ? '/app/rescue/dashboard' : '/app/home';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password, needsOtp ? otp : undefined);
      authLogin(data.tokens.access_token, data.tokens.refresh_token, data.user);
      // Return to the deep link that bounced us here, else route by role so
      // rescues land on their dashboard instead of the consumer home.
      navigate(destinationFor(data.user), { replace: true });
    } catch (err) {
      // The backend signals a required second factor with X-2FA-Required.
      const resp = (err as { response?: { headers?: Record<string, string> } })?.response;
      if (resp?.headers?.['x-2fa-required'] === '1') {
        setNeedsOtp(true);
        if (otp) toast.error('Invalid 2FA code');
      } else {
        toast.error(apiErrorMessage(err, 'Invalid email or password'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Already signed in (a bookmark, the back button, a second tab): there is
  // nothing to do here, and a login form in front of a logged-in person only
  // invites them to wonder whether they were signed out.
  if (!isLoading && isAuthenticated && user) {
    return <Navigate to={destinationFor(user)} replace />;
  }

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Welcome back"
        subtitle="Log in to keep swiping and find this week's top pet."
      />

      {/* Form card */}
      <div className="px-1 sm:px-5 mt-7">
        <form onSubmit={handleSubmit} className={`${AUTH_CARD} flex flex-col gap-4`}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Link to="/forgot-password" className={`self-end text-xs ${AUTH_LINK}`}>
              Forgot password?
            </Link>
          </div>

          {needsOtp && (
            <Input
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
              required
            />
          )}

          <Button type="submit" loading={loading} size="lg" className="w-full">
            {needsOtp ? 'Verify' : 'Log in'}
          </Button>
        </form>

        <SSOButtons />

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          New to Fetchpawz?{' '}
          <Link to="/signup" className={AUTH_LINK}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
