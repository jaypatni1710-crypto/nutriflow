import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import AdminDashboardPage from './pages/AdminDashboardPage';
import { ProtectedRoute } from './pages/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';
import DashboardHomePage from './pages/DashboardHomePage';
import ClientsPage from './pages/ClientsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import ProfilePage from './pages/ProfilePage';
import DietPlanPage from './pages/DietPlanPage';
import AppointmentsPage from './pages/AppointmentsPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole="dietitian">
                  <DashboardLayout>
                    <Outlet />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHomePage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="clients/:id" element={<ClientProfilePage />} />
              <Route path="diet-plan" element={<DietPlanPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
            </Route>

            <Route
              path="/profile"
              element={
                <ProtectedRoute requiredRole="dietitian">
                  <DashboardLayout pageTitle="My Profile">
                    <ProfilePage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}