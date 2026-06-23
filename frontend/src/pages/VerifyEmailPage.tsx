import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/auth.api';
import { AuthLayout, Button, Spinner } from '../components/auth/AuthUI';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('Invalid verification link.'); return; }

    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.message || 'Verification failed. The link may be invalid or expired.');
      });
  }, [params]);

  return (
    <AuthLayout>
      {status === 'loading' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Verifying your email…</h2>
          <Spinner />
        </>
      )}

      {status === 'success' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Email Verified Successfully</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Your account is now awaiting administrator approval.
            You will be able to login after your account has been approved.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">Go to Login</Button>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h2>
          <p className="text-sm text-slate-500 mb-6">{message}</p>
          <Button onClick={() => navigate('/login')} className="w-full">Back to Login</Button>
        </div>
      )}
    </AuthLayout>
  );
}
