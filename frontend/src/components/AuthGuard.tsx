import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Splash from './brand/Splash';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Splash />;
  }

  if (!isAuthenticated) {
    // Deep links go to login (not the marketing home) carrying the attempted
    // location, so LoginPage can return the user there after auth.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
