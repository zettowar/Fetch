import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotPassword } from '../api/auth';
import AuthHero, { AUTH_CARD, AUTH_LINK } from '../components/AuthHero';
import BrandIcon from '../components/brand/BrandIcon';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password · Fetchpawz');
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
        <div className="px-1 sm:px-5 mt-7">
          <div className={`${AUTH_CARD} text-center`}>
            <DogIllustration name="sniffing" className="mx-auto mb-4 h-28 w-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              If an account exists for <strong className="font-extrabold text-navy dark:text-biscuit">{email}</strong>, you'll receive a password reset link shortly.
            </p>
          </div>
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className={AUTH_LINK}>
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
        icon={<BrandIcon name="lock" size={32} />}
      />
      <div className="px-1 sm:px-5 mt-7">
        <form onSubmit={handleSubmit} className={`${AUTH_CARD} flex flex-col gap-4`}>
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
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className={AUTH_LINK}>
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
