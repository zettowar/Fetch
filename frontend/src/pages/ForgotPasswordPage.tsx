import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { forgotPassword } from '../api/auth';
import AuthHero from '../components/AuthHero';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      setSent(true);
      // Only ever surface the token in a dev build, even if a misconfigured
      // backend returns one in production.
      if (import.meta.env.DEV && data.debug_token) {
        toast.success(`Dev token: ${data.debug_token}`, { duration: 30000 });
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col pb-10">
        <AuthHero
          title="Check your email"
          subtitle="We're on the trail of your reset link."
        />
        <div className="px-5 mt-8">
          <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg text-center">
            <DogIllustration
              name="sniffing"
              className="mx-auto mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
            </p>
          </div>
          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 hover:underline">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Fetch your password"
        subtitle="Enter your email and we'll send a reset link."
        icon={<KeyRound size={32} aria-hidden />}
      />
      <div className="px-5 mt-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg flex flex-col gap-4"
        >
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <Button type="submit" loading={loading} size="lg" className="w-full">
            Send reset link
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
