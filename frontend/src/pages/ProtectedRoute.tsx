import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/auth/AuthUI';
import { AccountType } from '../types/auth.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AccountType;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, accountType, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && accountType !== requiredRole) {
    return <Navigate to={accountType === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}
