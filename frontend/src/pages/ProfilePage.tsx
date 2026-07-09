import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      setError('');
      try {
        await refreshUser();
      } catch (err: any) {
        setError(err?.message || 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [refreshUser]);

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() ?? 'U';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
      case 'suspended': return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400';
    }
  };

  const detailItems = [
    { label: 'First Name', value: user?.first_name },
    { label: 'Last Name', value: user?.last_name },
    { label: 'Email', value: user?.email },
    { label: 'Phone Number', value: user?.phone_number },
    { label: 'Organization', value: user?.organization_name },
    { label: 'Account Type', value: user?.account_type },
    { label: 'Status', value: user?.status },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-400 via-teal-500 to-teal-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
            {getInitials()}
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {user?.first_name || 'User'} {user?.last_name || ''}
          </h2>
          <span className={`mt-2 px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(user?.status || '')}`}>
            {user?.status || 'Unknown'}
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Loading profile...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => refreshUser()}
              className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {detailItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{item.label}</label>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value || '-'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}