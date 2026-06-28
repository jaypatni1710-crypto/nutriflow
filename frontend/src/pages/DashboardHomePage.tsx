import { useEffect, useState } from 'react';

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}

function TemporaryAccessBanner({ expiryDate, onDismiss }: { expiryDate: Date; onDismiss: () => void }) {
  const formatted = expiryDate.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return (
    <div className="mb-6 rounded-xl bg-amber-50 border border-amber-300 px-5 py-4 flex items-start gap-3">
      <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-amber-800 text-sm">⚠️ Temporary Access Enabled</p>
        <p className="text-amber-700 text-sm mt-0.5">
          Your access is valid until <strong>{formatted}</strong>. Please contact the administrator to restore your account.
        </p>
        <p className="text-amber-600 text-xs mt-1">📞 7874994587 &nbsp;|&nbsp; ✉️ jd.software2025@gmail.com</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-amber-500 hover:text-amber-700 shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function TemporaryAccessExpiredBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 rounded-xl bg-red-50 border border-red-300 px-5 py-4 flex items-start gap-3">
      <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-red-800 text-sm">❌ Temporary Access Expired</p>
        <p className="text-red-700 text-sm mt-0.5">
          Your temporary access has expired. Please contact the administrator.
        </p>
        <p className="text-red-600 text-xs mt-1">📞 7874994587 &nbsp;|&nbsp; ✉️ jd.software2025@gmail.com</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-red-500 hover:text-red-700 shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function DashboardHomePage() {
  const [tempAccessEnd, setTempAccessEnd] = useState<Date | null>(null);
  const [tempAccessExpired, setTempAccessExpired] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('temporary_access_end');
    if (stored) {
      const d = new Date(stored);
      if (!isNaN(d.getTime())) {
        if (d > new Date()) {
          setTempAccessEnd(d);
        } else {
          setTempAccessExpired(true);
        }
      }
    }
  }, []);

  return (
    <div>
      {!dismissed && tempAccessEnd && (
        <TemporaryAccessBanner expiryDate={tempAccessEnd} onDismiss={() => setDismissed(true)} />
      )}
      {!dismissed && !tempAccessEnd && tempAccessExpired && (
        <TemporaryAccessExpiredBanner onDismiss={() => setDismissed(true)} />
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome back</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here&apos;s an overview of your practice.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Active Clients" value="0" hint="No clients added yet" />
        <StatCard label="Upcoming Sessions" value="0" hint="Nothing scheduled" />
        <StatCard label="Meal Plans Sent" value="0" hint="No plans sent yet" />
      </div>

      <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
        <div className="w-12 h-12 bg-teal-50 dark:bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-slate-700 dark:text-slate-200 font-semibold">Your dashboard is ready</p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
          Client and scheduling data will appear here as you start using NutriFlow.
        </p>
      </div>
    </div>
  );
}
