import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import PawMark from '../components/ui/PawMark';
import { apiErrorMessage } from '../utils/apiError';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from || '/home';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      authLogin(data.tokens.access_token, data.tokens.refresh_token, data.user);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col pb-10">
      {/* Brand hero */}
      <section className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 text-white px-6 pt-8 pb-10">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-12 w-52 h-52 rounded-full bg-brand-700/30 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-soft-lg ring-1 ring-white/20">
            <PawMark className="h-11 w-11 text-white" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-white/90 max-w-xs">
            Log in to keep swiping and find this week's top pup.
          </p>
        </div>
      </section>

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
          <Link to="/signup" className="text-brand-600 font-semibold hover:text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
