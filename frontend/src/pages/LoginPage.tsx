import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import AuthHero from '../components/AuthHero';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { apiErrorMessage } from '../utils/apiError';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      authLogin(data.tokens.access_token, data.tokens.refresh_token, data.user);
      // Return to the deep link that bounced us here, else route by role so
      // rescues land on their dashboard instead of the consumer home.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      const dest =
        from && from.startsWith('/app')
          ? from
          : data.user.role === 'rescue' ? '/app/rescue/dashboard' : '/app/home';
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Welcome back"
        subtitle="Log in to keep swiping and find this week's top pet."
      />

      {/* Form card */}
      <div className="px-5 mt-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg flex flex-col gap-4"
        >
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
            <Link
              to="/forgot-password"
              className="self-end text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} size="lg" className="w-full">
            Log In
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          New to Fetch?{' '}
          <Link
            to="/signup"
            className="text-brand-600 font-semibold hover:text-brand-700 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
