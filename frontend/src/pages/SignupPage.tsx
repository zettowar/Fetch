import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signup } from '../api/auth';
import { lookupInvite } from '../api/publicSite';
import { useAuth } from '../store/AuthContext';
import AuthHero from '../components/AuthHero';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import SSOButtons from '../components/SSOButtons';
import { apiErrorMessage } from '../utils/apiError';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [searchParams] = useSearchParams();
  // Pre-fill the code when arriving from an emailed invite link (?invite=…).
  const [inviteCode, setInviteCode] = useState(() => searchParams.get('invite') ?? '');
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Arriving from an emailed invite link: resolve the code to the address it
  // was sent to and prefill it. Prefill is a convenience only — the field stays
  // editable, and a lookup failure leaves signup working exactly as before.
  useEffect(() => {
    const code = searchParams.get('invite');
    if (!code) return;
    let cancelled = false;
    lookupInvite(code)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'valid') {
          // Never clobber something the user has already typed.
          if (res.email) setEmail((current) => current || res.email!);
        } else {
          setInviteNotice(
            res.status === 'used'
              ? 'That invite code has already been used.'
              : "We didn't recognize that invite code.",
          );
        }
      })
      .catch(() => {
        /* Prefill is best-effort; the form is still fully usable. */
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const data = await signup(email, password, displayName, inviteCode.trim() || undefined);
      login(data.tokens.access_token, data.tokens.refresh_token, data.user);
      toast.success('Welcome to Fetchpawz!');
      navigate('/app/home');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Signup failed. Email may already be registered.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Join the pack"
        subtitle="Under a minute. No ads, no feed tricks — just pets."
      />

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
          <div className="flex flex-col gap-1.5">
            <Input
              label="Invite code"
              placeholder="FETCH-XXXXXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
            />
            <p
              className={`text-xs ${
                inviteNotice
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {inviteNotice ?? 'Required while Fetchpawz is in private beta.'}
            </p>
          </div>

          <Button type="submit" loading={loading} size="lg" className="w-full">
            Create account
          </Button>

          <p className="text-2xs text-center text-gray-400 dark:text-gray-500 leading-snug">
            By creating an account you agree to the{' '}
            <Link to="/terms" className="underline hover:text-gray-600 dark:hover:text-gray-300">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-gray-600 dark:hover:text-gray-300">Privacy Policy</Link>
            , and to be a good pet person.
          </p>
        </form>

        <SSOButtons />

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          Are you a rescue?{' '}
          <Link to="/signup-rescue" className="font-medium text-purple-600 dark:text-purple-400 hover:underline">
            Apply here →
          </Link>
        </p>
      </div>
    </div>
  );
}
