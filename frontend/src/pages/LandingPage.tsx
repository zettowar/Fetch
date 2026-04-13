import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/home" replace />;

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center">
      <div className="text-6xl mb-4">{'\ud83d\udc36'}</div>
      <h1 className="text-4xl font-bold text-brand-600 mb-2">Fetch</h1>
      <p className="text-lg text-gray-500 mb-2">Rate dogs. Win hearts. Find the top pup.</p>
      <p className="text-sm text-gray-400 mb-8 max-w-xs">
        Create a profile for your dog, swipe to rate others, and compete for weekly top dog.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link to="/signup">
          <Button className="w-full" size="lg">
            Get Started
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="secondary" className="w-full" size="lg">
            Log In
          </Button>
        </Link>
      </div>
    </div>
  );
}
