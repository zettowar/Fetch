import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signup } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';

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
      toast.success('Account created! Check your email to verify your address.');
      navigate('/home');
    } catch {
      toast.error('Signup failed. Email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <h1 className="text-3xl font-bold mb-6">Sign Up</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoComplete="name"
        />
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
          minLength={8}
          showStrength
          autoComplete="new-password"
        />
        <Button type="submit" loading={loading} className="w-full">
          Create Account
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-500 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
