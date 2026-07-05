import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { resetPassword } from '../api/auth';
import AuthHero from '../components/AuthHero';
import DogIllustration from '../components/flair/DogIllustration';
import Button from '../components/ui/Button';
import PasswordInput from '../components/ui/PasswordInput';
import { apiErrorMessage } from '../utils/apiError';

export default function ResetPasswordPage() {
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
          icon={<TriangleAlert size={32} aria-hidden />}
        />
        <div className="px-5 mt-8">
          <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg text-center">
            <DogIllustration
              name="howling"
              className="mx-auto mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">This reset link is missing a token.</p>
          </div>
          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/forgot-password" className="text-brand-600 font-semibold hover:text-brand-700 hover:underline">
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
        icon={<KeyRound size={32} aria-hidden />}
      />
      <div className="px-5 mt-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-soft-lg flex flex-col gap-4"
        >
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
