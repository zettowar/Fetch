import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login } from '../api/auth';
import { useAuth } from '../store/AuthContext';
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

  // Redirect to the page they were trying to visit, or /home
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
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <h1 className="text-3xl font-bold mb-6">Log In</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <Input
          label="Email"
          type="email"
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
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} className="w-full">
          Log In
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-500">
        Don't have an account?{' '}
        <Link to="/signup" className="text-brand-500 hover:underline">
          Sign up
        </Link>
      </p>
      <p className="mt-2 text-sm text-gray-500">
        <Link to="/forgot-password" className="text-brand-500 hover:underline">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
