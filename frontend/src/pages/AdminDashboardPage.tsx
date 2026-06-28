import { ReactNode, useEffect, useState } from 'react';
import { authApi } from '../lib/auth.api';
import { User, UserStatus } from '../types/auth.types';
import { Button, Spinner } from '../components/auth/AuthUI';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useNavigate } from 'react-router-dom';
import { NutriFlowLogoIcon } from '../components/Logo';

type Tab = 'pending' | 'users';
type ChangeStatusAction = 'approved' | 'rejected' | 'suspended';
type TempAccessType = 'N/A' | '1_week' | '1_month';

const STATUS_PILL_STYLES: Record<UserStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-slate-200 text-slate-600',
};

function StatusPill({ status }: { status: UserStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_PILL_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">{children}</th>;
}

// ─── Icon buttons ─────────────────────────────────────────────────────────────
function IconBtn({ title, onClick, disabled, color, children }: {
  title: string; onClick: () => void; disabled?: boolean; color: string; children: ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
    >
      {children}
    </button>
  );
}

function ViewIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ChangeStatusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

// ─── Allowed status transitions ───────────────────────────────────────────────
// Only toggle between approved ↔ rejected (no suspend in Users tab per spec)
function getAllowedTransitions(status: UserStatus): ChangeStatusAction[] {
  if (status === 'approved') return ['rejected'];
  if (status === 'rejected') return ['approved'];
  if (status === 'suspended') return ['approved', 'rejected'];
  return [];
}

const CHANGE_STATUS_LABELS: Record<ChangeStatusAction, string> = {
  approved: 'Approve',
  rejected: 'Reject',
  suspended: 'Suspend',
};

const CHANGE_STATUS_COLORS: Record<ChangeStatusAction, string> = {
  approved: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  rejected: 'bg-red-600 hover:bg-red-700 text-white',
  suspended: 'bg-amber-600 hover:bg-amber-700 text-white',
};

// ─── Temporary Access Dropdown ────────────────────────────────────────────────
function TempAccessDropdown({ user, onGranted }: { user: User; onGranted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const isRejected = user.status === 'rejected';
  // Dropdown is only interactive when status is rejected
  const isDisabled = !isRejected || loading;

  // If not rejected (e.g. approved), always display None regardless of stored value
  const currentValue: TempAccessType = (() => {
    if (!isRejected) return 'N/A';
    if (!user.temporary_access_type) return 'N/A';
    return user.temporary_access_type as TempAccessType;
  })();

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as TempAccessType;
    setLoading(true);
    try {
      if (val === 'N/A') {
        await authApi.clearTemporaryAccess(user.id);
      } else {
        await authApi.grantTemporaryAccess(user.id, val as '1_week' | '1_month');
      }
      onGranted();
    } catch {
      setToast('Failed to update temporary access.');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <select
        value={currentValue}
        onChange={handleChange}
        disabled={isDisabled}
        className={`text-xs rounded-lg border px-2 py-1.5 pr-6 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors appearance-none
          ${isDisabled
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700'
            : 'bg-white border-slate-300 text-slate-700 cursor-pointer hover:border-teal-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200'
          }`}
      >
        <option value="N/A">None</option>
        <option value="1_week">1 Week</option>
        <option value="1_month">1 Month</option>
      </select>
      {toast && (
        <div className="absolute top-full left-0 mt-1 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────
function UserDetailModal({ user, onClose }: { user: User; onClose: () => void }) {
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const hasTempAccess = !!user.temporary_access_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">User Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {[
            ['Full Name', `${user.first_name} ${user.last_name}`],
            ['Email', user.email],
            ['Phone', user.phone_number],
            ['Organization', user.organization_name],
            ...(user.address ? [['Address', user.address]] : []),
            ...(user.qualification ? [['Qualification', user.qualification]] : []),
            ...(user.experience !== null && user.experience !== undefined ? [['Experience', `${user.experience} year${user.experience === 1 ? '' : 's'}`]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">{label}:</span>
              <span className="font-medium text-slate-900 dark:text-white text-right">{value}</span>
            </div>
          ))}

          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Status:</span>
            <StatusPill status={user.status} />
          </div>

          {/* Dates section */}
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dates</p>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">Date of Registration:</span>
              <span className="font-medium text-slate-900 dark:text-white text-right">{fmtDate(user.created_at)}</span>
            </div>
            {user.decision_date && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">Date of Action Taken:</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">{fmtDate(user.decision_date)}</span>
              </div>
            )}
          </div>

          {/* Temporary Access section — only show when rejected AND temp access was granted */}
          {hasTempAccess && user.status === 'rejected' && (
            <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Temporary Access</p>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">Type:</span>
                <span className="font-medium text-slate-900 dark:text-white">{user.temporary_access_type === '1_week' ? '1 Week' : '1 Month'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">From:</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">{fmt(user.temporary_access_start)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">To:</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">{fmt(user.temporary_access_end)}</span>
              </div>
              {user.temporary_access_end && new Date(user.temporary_access_end) < new Date() && (
                <p className="text-xs text-red-500 font-medium">⚠ Temporary access has expired</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Change Status Dialog ─────────────────────────────────────────────────────
function ChangeStatusDialog({
  user, onClose, onConfirm, loading,
}: {
  user: User; onClose: () => void; onConfirm: (action: ChangeStatusAction) => void; loading: boolean;
}) {
  const transitions = getAllowedTransitions(user.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">Change Status</h3>
        <p className="text-sm text-slate-500 mb-4">
          <strong>{user.first_name} {user.last_name}</strong> is currently <StatusPill status={user.status} />
        </p>
        <div className="space-y-2 mb-4">
          {transitions.map((action) => (
            <button
              key={action}
              onClick={() => onConfirm(action)}
              disabled={loading}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${CHANGE_STATUS_COLORS[action]}`}
            >
              {loading ? '…' : CHANGE_STATUS_LABELS[action]}
            </button>
          ))}
        </div>
        <Button variant="secondary" className="w-full" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────
function DeleteDialog({ userName, onClose, onConfirm, loading }: {
  userName: string; onClose: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Delete User</h3>
        <p className="text-sm text-slate-500 mb-1">Are you sure you want to permanently delete this user?</p>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-5">{userName}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
          >
            {loading ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Confirm Dialog ───────────────────────────────────────────────────
function PendingConfirmDialog({ action, userName, onClose, onConfirm, loading }: {
  action: 'approve' | 'reject'; userName: string; onClose: () => void; onConfirm: () => void; loading: boolean;
}) {
  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">
          {isApprove ? 'Approve Account' : 'Reject Account'}
        </h3>
        <p className="text-sm text-slate-500 mb-1">
          {isApprove ? 'Approve this account? The user will be able to log in.' : 'Reject this account? The user will be notified.'}
        </p>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-5">{userName}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            {loading ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.003A9.38 9.38 0 0112.375 21c-2.156 0-4.16-.584-5.892-1.594M18 10.5h.008v.008H18V10.5zm-3 .375h.008v.008H15V10.875zm-3 .375h.008v.008H12V11.25zm-3 .375h.008v.008H9V11.625zm-3 .375h.008v.008H6V12zm12-3.375h.008v.008H18V8.625zm-3 .375h.008v.008H15V9zm-3 .375h.008v.008H12V9.375zm-3 .375h.008v.008H9V9.75zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs">{subtitle}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { clearAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pending');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [changeStatusUser, setChangeStatusUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ action: 'approve' | 'reject'; user: User } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPending = async () => {
    try {
      const res = await authApi.getPendingAccounts();
      setPendingUsers(res.data?.users ?? []);
    } catch {
      setError('Failed to load pending accounts.');
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await authApi.getAllUsers();
      setAllUsers(res.data?.users ?? []);
    } catch {
      setError('Failed to load users.');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPending(), fetchAllUsers()]).finally(() => setLoading(false));
  }, []);

  // Pending: approve
  const handlePendingApprove = async () => {
    if (!pendingConfirm) return;
    setActionLoading(pendingConfirm.user.id);
    try {
      await authApi.approveAccount(pendingConfirm.user.id);
      setPendingUsers((u) => u.filter((x) => x.id !== pendingConfirm.user.id));
      showToast('Account approved successfully.', 'success');
      fetchAllUsers();
    } catch {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(null);
      setPendingConfirm(null);
    }
  };

  // Pending: reject
  const handlePendingReject = async () => {
    if (!pendingConfirm) return;
    setActionLoading(pendingConfirm.user.id);
    try {
      await authApi.rejectAccount(pendingConfirm.user.id);
      setPendingUsers((u) => u.filter((x) => x.id !== pendingConfirm.user.id));
      showToast('Account rejected.', 'success');
      fetchAllUsers();
    } catch {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(null);
      setPendingConfirm(null);
    }
  };

  // Users: change status
  const handleChangeStatus = async (action: ChangeStatusAction) => {
    if (!changeStatusUser) return;
    setActionLoading(changeStatusUser.id);
    try {
      await authApi.changeUserStatus(changeStatusUser.id, action);
      setAllUsers((u) => u.map((x) => x.id === changeStatusUser.id ? { ...x, status: action } : x));
      showToast('Status updated successfully.', 'success');
    } catch {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(null);
      setChangeStatusUser(null);
    }
  };

  // Users: delete
  const handleDelete = async () => {
    if (!deleteUser) return;
    setActionLoading(deleteUser.id);
    try {
      await authApi.deleteUser(deleteUser.id);
      setAllUsers((u) => u.filter((x) => x.id !== deleteUser.id));
      showToast('User deleted successfully.', 'success');
    } catch {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(null);
      setDeleteUser(null);
    }
  };

  const handleLogout = async () => {
    const rt = localStorage.getItem('refresh_token') ?? '';
    await authApi.logout(rt).catch(() => {});
    clearAuth();
    navigate('/login');
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'pending', label: `Pending Users${pendingUsers.length ? ` (${pendingUsers.length})` : ''}` },
    { id: 'users', label: 'Users' },
  ];

  const sidebarWidth = sidebarCollapsed ? 80 : 260;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out z-40"
        style={{ width: sidebarWidth }}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <NutriFlowLogoIcon size={28} />
            {!sidebarCollapsed && (
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                NutriFlow
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
          >
            {sidebarCollapsed ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto overflow-x-hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={sidebarCollapsed ? t.label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              } ${
                tab === t.id
                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t.id === 'pending' ? (
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.003A9.38 9.38 0 0112.375 21c-2.156 0-4.16-.584-5.892-1.594M18 10.5h.008v.008H18V10.5zm-3 .375h.008v.008H15V10.875zm-3 .375h.008v.008H12V11.25zm-3 .375h.008v.008H9V11.625zm-3 .375h.008v.008H6V12zm12-3.375h.008v.008H18V8.625zm-3 .375h.008v.008H15V9zm-3 .375h.008v.008H12V9.375zm-3 .375h.008v.008H9V9.75zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {!sidebarCollapsed && <span className="truncate">{t.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 transition-all duration-300" style={{ marginLeft: sidebarWidth }}>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 h-16 px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">Admin Panel</h1>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <Button variant="secondary" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-6">
          {loading && <Spinner />}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4">{error}</div>}

          {/* ── Pending Tab ── */}
          {!loading && tab === 'pending' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Pending Users</h1>
                <p className="text-sm text-slate-500 mt-1">Review and approve dietitian account requests</p>
              </div>
              {pendingUsers.length === 0 ? (
                <EmptyState title="No pending requests" subtitle="All caught up! New registrations will appear here" />
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                          <Th>Full Name</Th><Th>Email</Th><Th>Phone</Th><Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pendingUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900 dark:text-white">{user.first_name} {user.last_name}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{user.organization_name}</div>
                            </td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{user.email}</td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{user.phone_number}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setPendingConfirm({ action: 'approve', user })}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                                >
                                  ✅ Approve
                                </button>
                                <button
                                  onClick={() => setPendingConfirm({ action: 'reject', user })}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                                >
                                  ❌ Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                    {pendingUsers.length} pending {pendingUsers.length === 1 ? 'account' : 'accounts'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Users Tab ── */}
          {!loading && tab === 'users' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Users</h1>
                <p className="text-sm text-slate-500 mt-1">Approved, rejected, and suspended dietitian accounts</p>
              </div>
              {allUsers.length === 0 ? (
                <EmptyState title="No users yet" subtitle="Approved, rejected, or suspended accounts will appear here" />
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                          <Th>Full Name</Th><Th>Email</Th><Th>Phone</Th>
                          <Th>Created Date</Th><Th>Status</Th>
                          <Th>Temporary Access</Th><Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {allUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900 dark:text-white">{user.first_name} {user.last_name}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{user.organization_name}</div>
                            </td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{user.email}</td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{user.phone_number}</td>
                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {new Date(user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-4"><StatusPill status={user.status} /></td>
                            <td className="px-5 py-4">
                              <TempAccessDropdown
                                user={user}
                                onGranted={() => {
                                  fetchAllUsers();
                                  showToast('Temporary access granted.', 'success');
                                }}
                              />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <IconBtn
                                  title="View Details"
                                  onClick={() => setDetailUser(user)}
                                  color="text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                                >
                                  <ViewIcon />
                                </IconBtn>
                                <IconBtn
                                  title="Change Status"
                                  onClick={() => setChangeStatusUser(user)}
                                  disabled={actionLoading === user.id}
                                  color="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <ChangeStatusIcon />
                                </IconBtn>
                                <IconBtn
                                  title="Delete User"
                                  onClick={() => setDeleteUser(user)}
                                  disabled={actionLoading === user.id}
                                  color="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <DeleteIcon />
                                </IconBtn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                    {allUsers.length} {allUsers.length === 1 ? 'user' : 'users'}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {detailUser && <UserDetailModal user={detailUser} onClose={() => setDetailUser(null)} />}

      {changeStatusUser && (
        <ChangeStatusDialog
          user={changeStatusUser}
          onClose={() => setChangeStatusUser(null)}
          onConfirm={handleChangeStatus}
          loading={actionLoading === changeStatusUser.id}
        />
      )}

      {deleteUser && (
        <DeleteDialog
          userName={`${deleteUser.first_name} ${deleteUser.last_name}`}
          onClose={() => setDeleteUser(null)}
          onConfirm={handleDelete}
          loading={actionLoading === deleteUser.id}
        />
      )}

      {pendingConfirm && (
        <PendingConfirmDialog
          action={pendingConfirm.action}
          userName={`${pendingConfirm.user.first_name} ${pendingConfirm.user.last_name}`}
          onClose={() => setPendingConfirm(null)}
          onConfirm={pendingConfirm.action === 'approve' ? handlePendingApprove : handlePendingReject}
          loading={actionLoading === pendingConfirm.user.id}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
