import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/auth.api';
import { RegisterFormData, RegisterPayload } from '../types/auth.types';
import { Alert, AuthLayout, Button, Input, Modal } from '../components/auth/AuthUI';

const INITIAL: RegisterFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
  organization_name: '',
  address: '',
  qualification: '',
  experience: '',
  password: '',
  confirm_password: '',
};

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function validate(data: RegisterFormData): Partial<Record<keyof RegisterFormData, string>> {
  const errors: Partial<Record<keyof RegisterFormData, string>> = {};
  if (!data.first_name.trim()) errors.first_name = 'First name is required';
  if (!data.last_name.trim()) errors.last_name = 'Last name is required';
  if (!data.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email format';
  if (!data.phone_number.trim()) errors.phone_number = 'Phone number is required';
  if (!data.organization_name.trim()) errors.organization_name = 'Organization name is required';
  if (data.experience.trim()) {
    const num = Number(data.experience);
    if (!Number.isFinite(num) || num < 0) errors.experience = 'Enter a valid number of years';
  }
  if (!data.password) errors.password = 'Password is required';
  else if (!PASSWORD_RE.test(data.password))
    errors.password = 'Min 8 chars with uppercase, lowercase, number & special character';
  if (!data.confirm_password) errors.confirm_password = 'Please confirm your password';
  else if (data.password !== data.confirm_password) errors.confirm_password = 'Passwords do not match';
  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field: keyof RegisterFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setApiError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const payload: RegisterPayload = {
        ...form,
        address: form.address.trim(),
        qualification: form.qualification.trim(),
        experience: form.experience.trim() === '' ? undefined : Number(form.experience),
      };
      await authApi.register(payload);
      setShowSuccess(true);
    } catch (err: any) {
      setApiError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">Start managing your dietitian practice</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} autoComplete="given-name" />
          <Input label="Last Name" value={form.last_name} onChange={set('last_name')} error={errors.last_name} autoComplete="family-name" />
        </div>
        <Input label="Email Address" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Input label="Phone Number" type="tel" value={form.phone_number} onChange={set('phone_number')} error={errors.phone_number} placeholder="+91 98765 43210" />
        <Input label="Organization Name" value={form.organization_name} onChange={set('organization_name')} error={errors.organization_name} placeholder="Your clinic or practice name" />
        <Input label="Address" value={form.address} onChange={set('address')} error={errors.address} placeholder="Full address" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Qualification" value={form.qualification} onChange={set('qualification')} error={errors.qualification} placeholder="e.g. B.Sc Nutrition" />
          <Input label="Experience (years)" type="number" min={0} value={form.experience} onChange={set('experience')} error={errors.experience} placeholder="e.g. 3" />
        </div>

        <div className="relative">
          <Input label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 text-xs">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="relative">
          <Input label="Confirm Password" type={showConfirm ? 'text' : 'password'} value={form.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} autoComplete="new-password" />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 text-xs">
            {showConfirm ? 'Hide' : 'Show'}
          </button>
        </div>

        {apiError && <Alert type="error" message={apiError} />}

        <Button type="submit" loading={loading} className="w-full mt-2">
          Sign Up
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{' '}
        <button onClick={() => navigate('/login')} className="text-teal-600 font-semibold hover:text-teal-700">
          Login
        </button>
      </p>

      {/* Registration Success Modal */}
      <Modal open={showSuccess}>
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2 text-center">Registration Successful</h3>
        <div className="text-sm text-slate-600 mb-6 leading-relaxed space-y-2 text-center">
          <p>Your account has been submitted successfully.</p>
          <p>Your account is currently <strong className="text-slate-700">under review</strong> by the administrator.</p>
          <p>You will be able to log in only after approval.</p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">For any queries, contact:</p>
            <p className="font-semibold text-slate-700">📞 7874994587</p>
            <p className="font-semibold text-slate-700">✉️ jd.software2025@gmail.com</p>
          </div>
        </div>
        <Button onClick={() => navigate('/login')} className="w-full">Go to Login</Button>
      </Modal>
    </AuthLayout>
  );
}
