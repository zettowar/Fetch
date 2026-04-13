import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotPassword } from '../api/auth';
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
      // In dev mode the backend may return the token directly
      if (data.debug_token) {
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
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <h1 className="text-2xl font-bold mb-3">Check your email</h1>
        <p className="text-gray-500 mb-6 max-w-sm">
          If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
        </p>
        <Link to="/login" className="text-brand-500 hover:underline text-sm">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <h1 className="text-3xl font-bold mb-2">Forgot password?</h1>
      <p className="text-gray-500 text-sm mb-6 text-center max-w-sm">
        Enter your email and we'll send a reset link.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Button type="submit" loading={loading} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-500">
        <Link to="/login" className="text-brand-500 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
