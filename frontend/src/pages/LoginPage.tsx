import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/auth.api';
import { useAuth } from '../hooks/useAuth';
import { Alert, AuthLayout, Button, Input } from '../components/auth/AuthUI';

interface LoginForm { email: string; password: string; remember_me: boolean; }

const CONTACT_INFO = (
  <span>
    <strong>📞 7874994587</strong> &nbsp;|&nbsp; <strong>✉️ jd.software2025@gmail.com</strong>
  </span>
);

type LoginErrorKind =
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_TEMP_ACCESS_EXPIRED'
  | 'ACCOUNT_SUSPENDED'
  | 'generic';

function getErrorKind(msg: string): LoginErrorKind {
  if (msg === 'ACCOUNT_PENDING') return 'ACCOUNT_PENDING';
  if (msg === 'ACCOUNT_REJECTED') return 'ACCOUNT_REJECTED';
  if (msg === 'ACCOUNT_TEMP_ACCESS_EXPIRED') return 'ACCOUNT_TEMP_ACCESS_EXPIRED';
  if (msg === 'ACCOUNT_SUSPENDED') return 'ACCOUNT_SUSPENDED';
  return 'generic';
}

function StatusMessage({ kind, genericMessage }: { kind: LoginErrorKind; genericMessage: string }) {
  if (kind === 'ACCOUNT_PENDING') {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">Account Under Review</p>
        <p>Your account is currently under review. Please wait for administrator approval.</p>
        <p className="mt-2 text-xs text-amber-700">For assistance contact: {CONTACT_INFO}</p>
      </div>
    );
  }
  if (kind === 'ACCOUNT_REJECTED') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800 space-y-1">
        <p className="font-semibold">Account Rejected</p>
        <p>Your account has been rejected by the administrator.</p>
        <p className="mt-2 text-xs text-red-700">Please contact: {CONTACT_INFO}</p>
      </div>
    );
  }
  if (kind === 'ACCOUNT_TEMP_ACCESS_EXPIRED') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800 space-y-1">
        <p className="font-semibold">Temporary Access Expired</p>
        <p>Your temporary access has expired. Please contact the administrator.</p>
        <p className="mt-2 text-xs text-red-700">📞 7874994587 &nbsp;|&nbsp; ✉️ jd.software2025@gmail.com</p>
      </div>
    );
  }
  if (kind === 'ACCOUNT_SUSPENDED') {
    return (
      <div className="rounded-lg bg-slate-100 border border-slate-300 p-4 text-sm text-slate-800 space-y-1">
        <p className="font-semibold">Account Suspended</p>
        <p>Your account has been suspended. Please contact the administrator.</p>
        <p className="mt-2 text-xs text-slate-600">📞 7874994587 &nbsp;|&nbsp; ✉️ jd.software2025@gmail.com</p>
      </div>
    );
  }
  return <Alert type="error" message={genericMessage} />;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens } = useAuth();
  const [form, setForm] = useState<LoginForm>({ email: '', password: '', remember_me: false });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [apiError, setApiError] = useState('');
  const [errorKind, setErrorKind] = useState<LoginErrorKind>('generic');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (field: keyof LoginForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = field === 'remember_me' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setApiError('');
    setErrorKind('generic');
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
        // Store temporary_access_end if present
        if (res.data.temporary_access_end) {
          localStorage.setItem('temporary_access_end', res.data.temporary_access_end);
        } else {
          localStorage.removeItem('temporary_access_end');
        }
        const payload = JSON.parse(atob(res.data.access_token.split('.')[1]));
        navigate(payload.account_type === 'admin' ? '/admin/dashboard' : '/dashboard');
      }
    } catch (err: any) {
      const msg: string = err?.message || 'Login failed. Please try again.';
      setErrorKind(getErrorKind(msg));
      setApiError(msg);
    } finally {
      setLoading(false);
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

        {apiError && <StatusMessage kind={errorKind} genericMessage={apiError} />}

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
