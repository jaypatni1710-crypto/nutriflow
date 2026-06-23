import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/auth.api';
import { useAuth } from '../hooks/useAuth';
import { Alert, AuthLayout, Button, Input } from '../components/auth/AuthUI';

interface LoginForm { email: string; password: string; remember_me: boolean; }

const ERROR_CODES: Record<string, { message: string; action?: string }> = {
  'Please verify your email before logging in': { message: 'Please verify your email before logging in.', action: 'resend' },
  'Your account is awaiting administrator approval': { message: 'Your account is awaiting administrator approval. Please wait.' },
  'Your registration request has been declined. Please contact support': { message: 'Your registration request has been declined. Please contact support.' },
  'Your account has been suspended. Please contact support': { message: 'Your account has been suspended. Please contact support.' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens } = useAuth();
  const [form, setForm] = useState<LoginForm>({ email: '', password: '', remember_me: false });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [apiError, setApiError] = useState('');
  const [apiErrorAction, setApiErrorAction] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (field: keyof LoginForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = field === 'remember_me' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setApiError('');
    setApiErrorAction(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<keyof LoginForm, string>> = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.password) errs.password = 'Password is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await authApi.login(form);
      if (res.data) {
        setTokens(res.data);
        const payload = JSON.parse(atob(res.data.access_token.split('.')[1]));
        navigate(payload.account_type === 'admin' ? '/admin/dashboard' : '/dashboard');
      }
    } catch (err: any) {
      const msg: string = err?.message || 'Login failed. Please try again.';
      const mapped = ERROR_CODES[msg];
      setApiError(mapped?.message || msg);
      setApiErrorAction(mapped?.action);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!form.email) return;
    setResendLoading(true);
    try {
      await authApi.resendVerification(form.email);
      setApiError('Verification email sent. Please check your inbox.');
      setApiErrorAction(undefined);
    } catch {
      setApiError('Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1">Sign in to your NutriFlow account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label="Email Address" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" autoFocus />

        <div className="relative">
          <Input label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 text-xs">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.remember_me}
              onChange={set('remember_me')}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          <button type="button" onClick={() => navigate('/forgot-password')}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium">
            Forgot password?
          </button>
        </div>

        {apiError && (
          <Alert
            type={apiError.includes('sent') ? 'success' : 'error'}
            message={apiError}
            action={
              apiErrorAction === 'resend'
                ? { label: 'Resend Verification Email', onClick: handleResend, loading: resendLoading }
                : undefined
            }
          />
        )}

        <Button type="submit" loading={loading} className="w-full mt-2">Login</Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Don&apos;t have an account?{' '}
        <button onClick={() => navigate('/register')} className="text-teal-600 font-semibold hover:text-teal-700">
          Register
        </button>
      </p>


    </AuthLayout>
  );
}
