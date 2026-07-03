import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Spinner } from './ui/Skeleton';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Deep links go to login (not the marketing home) carrying the attempted
    // location, so LoginPage can return the user there after auth.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
