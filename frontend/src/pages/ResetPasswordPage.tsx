import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPassword } from '../api/auth';
import AuthHero, { AUTH_CARD, AUTH_LINK } from '../components/AuthHero';
import BrandIcon from '../components/brand/BrandIcon';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import PasswordInput from '../components/ui/PasswordInput';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function ResetPasswordPage() {
  useDocumentTitle('Reset password · Fetchpawz');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!token) {
    return (
      <div className="flex flex-col pb-10">
        <AuthHero
          title="Invalid link"
          subtitle="This reset link is missing a token."
          icon={<BrandIcon name="help" size={32} />}
        />
        <div className="px-1 sm:px-5 mt-7">
          <div className={`${AUTH_CARD} text-center`}>
            <DogIllustration name="howling" className="mx-auto mb-4 h-28 w-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Reset links only work when opened straight from the email. Request a fresh one and try again.
            </p>
          </div>
          <p className="mt-6 text-center text-sm">
            <Link to="/forgot-password" className={AUTH_LINK}>
              Request a new link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success('Password updated! Please log in.');
      navigate('/login');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Invalid or expired reset link.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        title="Pick a new password"
        subtitle="At least 8 characters — make it one only you would guess."
        icon={<BrandIcon name="lock" size={32} />}
      />
      <div className="px-1 sm:px-5 mt-7">
        <form onSubmit={handleSubmit} className={`${AUTH_CARD} flex flex-col gap-4`}>
          <PasswordInput
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            showStrength
          />
          <PasswordInput
            label="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} size="lg" className="w-full">
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
