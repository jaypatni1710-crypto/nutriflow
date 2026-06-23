import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/auth.api';
import { Alert, AuthLayout, Button, Input } from '../components/auth/AuthUI';

// ── Forgot Password ─────────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setEmailError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Invalid email format'); return; }

    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Always show success to prevent enumeration
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {submitted ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Password reset instructions have been sent to your email address.
          </p>
          <Button onClick={() => navigate('/login')} variant="secondary" className="w-full">Back to Login</Button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot password?</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your email and we&apos;ll send a reset link</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
              error={emailError}
              autoFocus
            />
            <Button type="submit" loading={loading} className="w-full">Send Reset Link</Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            <button onClick={() => navigate('/login')} className="text-teal-600 font-semibold hover:text-teal-700">
              ← Back to Login
            </button>
          </p>
        </>
      )}
    </AuthLayout>
  );
}

// ── Reset Password ──────────────────────────────────────────────────────────
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState<{ new_password?: string; confirm_password?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setApiError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.new_password) errs.new_password = 'Password is required';
    else if (!PASSWORD_RE.test(form.new_password)) errs.new_password = 'Min 8 chars with uppercase, lowercase, number & special character';
    if (!form.confirm_password) errs.confirm_password = 'Please confirm your password';
    else if (form.new_password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const token = params.get('token');
    if (!token) { setApiError('Invalid or expired reset link.'); return; }

    setLoading(true);
    try {
      await authApi.resetPassword(token, form.new_password, form.confirm_password);
      setSuccess(true);
    } catch (err: any) {
      setApiError(err?.message || 'Password reset failed. The link may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Updated</h2>
          <p className="text-sm text-slate-500 mb-6">Your password has been updated successfully.</p>
          <Button onClick={() => navigate('/login')} className="w-full">Login</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Set new password</h2>
        <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="relative">
          <Input label="New Password" type={showNew ? 'text' : 'password'} value={form.new_password} onChange={set('new_password')} error={errors.new_password} autoComplete="new-password" />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 text-xs">
            {showNew ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="relative">
          <Input label="Confirm Password" type={showConfirm ? 'text' : 'password'} value={form.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} autoComplete="new-password" />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 text-xs">
            {showConfirm ? 'Hide' : 'Show'}
          </button>
        </div>

        {apiError && <Alert type="error" message={apiError} />}
        <Button type="submit" loading={loading} className="w-full">Update Password</Button>
      </form>
    </AuthLayout>
  );
}
