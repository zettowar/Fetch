import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signup } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import PawMark from '../components/ui/PawMark';
import { apiErrorMessage } from '../utils/apiError';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const data = await signup(email, password, displayName);
      login(data.tokens.access_token, data.tokens.refresh_token, data.user);
      toast.success('Welcome to Fetch!');
      navigate('/home');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Signup failed. Email may already be registered.'));
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
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Join the pack</h1>
          <p className="mt-1.5 text-sm text-white/90 max-w-xs">
            Under a minute. No ads, no feed tricks — just dogs.
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
            label="Display name"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            showStrength
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} size="lg" className="w-full">
            Create account
          </Button>

          <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 leading-snug">
            By creating an account you agree to be a good dog person.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
