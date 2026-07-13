import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Spinner } from './ui/Skeleton';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  // Both staff tiers reach the console; admin-only actions are gated per-control.
  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'moderator')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
