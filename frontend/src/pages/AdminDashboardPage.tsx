import { ReactNode, useEffect, useState } from 'react';
import { authApi } from '../lib/auth.api';
import { User, UserStatus } from '../types/auth.types';
import { Button, Spinner } from '../components/auth/AuthUI';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useNavigate } from 'react-router-dom';
import { NutriFlowLogoIcon } from '../components/Logo';

type PendingAction = 'approve' | 'reject' | 'suspend';
type UsersAction = 'active' | 'rejected' | 'suspended';
type Tab = 'pending' | 'users';

interface ConfirmDialog {
  open: boolean;
  kind: 'pending' | 'users' | 'delete' | null;
  action: PendingAction | UsersAction | 'delete' | null;
  userId: string;
  userName: string;
}

const PENDING_CONFIG: Record<PendingAction, { label: string; color: string; confirmMessage: string }> = {
  approve: { label: 'Approve', color: 'bg-emerald-600 hover:bg-emerald-700 text-white', confirmMessage: 'Approve this account?' },
  reject: { label: 'Reject', color: 'bg-red-600 hover:bg-red-700 text-white', confirmMessage: 'Reject this account? The user will be notified.' },
  suspend: { label: 'Suspend', color: 'bg-amber-600 hover:bg-amber-700 text-white', confirmMessage: 'Suspend this account? The user will be logged out immediately.' },
};

const USERS_CONFIG: Record<UsersAction, { label: string; color: string; confirmMessage: string }> = {
  active: { label: 'Activate', color: 'bg-emerald-600 hover:bg-emerald-700 text-white', confirmMessage: 'Set this account to active?' },
  rejected: { label: 'Reject', color: 'bg-red-600 hover:bg-red-700 text-white', confirmMessage: 'Reject this account? The user will be notified.' },
  suspended: { label: 'Suspend', color: 'bg-amber-600 hover:bg-amber-700 text-white', confirmMessage: 'Suspend this account? The user will be logged out immediately.' },
};

const DELETE_CONFIG = {
  label: 'Delete',
  color: 'bg-red-600 hover:bg-red-700 text-white',
  confirmMessage: 'This will permanently delete the user and all of their data. This action cannot be undone.',
};

function StatusPill({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    active: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    suspended: 'bg-slate-200 text-slate-600',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[status]}`}>{status}</span>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">{children}</th>;
}

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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({ open: false, kind: null, action: null, userId: '', userName: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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

  const openPendingConfirm = (action: PendingAction, user: User) => {
    setConfirmDialog({ open: true, kind: 'pending', action, userId: user.id, userName: `${user.first_name} ${user.last_name}` });
  };

  const openUsersConfirm = (action: UsersAction, user: User) => {
    setConfirmDialog({ open: true, kind: 'users', action, userId: user.id, userName: `${user.first_name} ${user.last_name}` });
  };

  const openDeleteConfirm = (user: User) => {
    setConfirmDialog({ open: true, kind: 'delete', action: 'delete', userId: user.id, userName: `${user.first_name} ${user.last_name}` });
  };

  const openUserDetail = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const handleAction = async () => {
    if (!confirmDialog.action || !confirmDialog.kind) return;
    setActionLoading(confirmDialog.userId);
    setConfirmDialog((c) => ({ ...c, open: false }));

    try {
      if (confirmDialog.kind === 'pending') {
        const action = confirmDialog.action as PendingAction;
        if (action === 'approve') await authApi.approveAccount(confirmDialog.userId);
        else if (action === 'reject') await authApi.rejectAccount(confirmDialog.userId);
        else if (action === 'suspend') await authApi.suspendAccount(confirmDialog.userId);
        setPendingUsers((u) => u.filter((x) => x.id !== confirmDialog.userId));
        showToast(`Account ${action === 'approve' ? 'approved' : action}d successfully.`, 'success');
      } else if (confirmDialog.kind === 'users') {
        const status = confirmDialog.action as UsersAction;
        await authApi.changeUserStatus(confirmDialog.userId, status);
        setAllUsers((u) => u.map((x) => (x.id === confirmDialog.userId ? { ...x, status } : x)));
        showToast('Status updated successfully.', 'success');
      } else if (confirmDialog.kind === 'delete') {
        await authApi.deleteUser(confirmDialog.userId);
        setAllUsers((u) => u.filter((x) => x.id !== confirmDialog.userId));
        showToast('User deleted successfully.', 'success');
      }
      fetchAllUsers();
      fetchPending();
    } catch {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(null);
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

  const confirmConfig =
    confirmDialog.kind === 'pending'
      ? PENDING_CONFIG[confirmDialog.action as PendingAction]
      : confirmDialog.kind === 'users'
      ? USERS_CONFIG[confirmDialog.action as UsersAction]
      : DELETE_CONFIG;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Left Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out z-40`}
        style={{ width: sidebarWidth }}
      >
        {/* Header with Logo and Hamburger */}
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

        {/* Navigation */}
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

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300" style={{ marginLeft: sidebarWidth }}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 h-16 px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
            Admin Panel
          </h1>
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

          {!loading && tab === 'pending' && (
            <PendingPanel users={pendingUsers} actionLoading={actionLoading} onAction={openPendingConfirm} />
          )}

          {!loading && tab === 'users' && (
            <UsersPanel users={allUsers} actionLoading={actionLoading} onAction={openUsersConfirm} onViewDetail={openUserDetail} onDeleteUser={openDeleteConfirm} />
          )}
        </main>
      </div>

      {/* Confirm Dialog */}
      {confirmDialog.open && confirmDialog.action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmDialog((c) => ({ ...c, open: false }))} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-sm">
            {confirmDialog.kind === 'delete' && (
              <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            )}
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2 capitalize">
              {confirmConfig.label} {confirmDialog.kind === 'delete' ? 'User' : 'Account'}
            </h3>
            <p className="text-sm text-slate-500 mb-1">{confirmConfig.confirmMessage}</p>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-5">{confirmDialog.userName}</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDialog((c) => ({ ...c, open: false }))}>Cancel</Button>
              <button
                onClick={handleAction}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors capitalize ${confirmConfig.color}`}
              >
                {confirmDialog.kind === 'delete' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">User Details</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900 dark:text-white">{selectedUser.first_name} {selectedUser.last_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900 dark:text-white">{selectedUser.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="font-medium text-slate-900 dark:text-white">{selectedUser.phone_number}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Organization:</span> <span className="font-medium text-slate-900 dark:text-white">{selectedUser.organization_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status:</span> <span className="font-medium capitalize text-slate-900 dark:text-white">{selectedUser.status}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Registered:</span> <span className="font-medium text-slate-900 dark:text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</span></div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

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

function PendingPanel({ users, actionLoading, onAction }: { users: User[]; actionLoading: string | null; onAction: (action: PendingAction, user: User) => void }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Pending Users</h1>
        <p className="text-sm text-slate-500 mt-1">Review and approve dietitian account requests</p>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No pending requests" subtitle="All caught up! New registrations will appear here" />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Registered</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => (
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
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {(['approve', 'reject', 'suspend'] as PendingAction[]).map((action) => (
                          <button
                            key={action}
                            onClick={() => onAction(action, user)}
                            disabled={actionLoading === user.id}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed capitalize ${PENDING_CONFIG[action].color}`}
                          >
                            {actionLoading === user.id ? '…' : PENDING_CONFIG[action].label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            {users.length} pending {users.length === 1 ? 'account' : 'accounts'}
          </div>
        </div>
      )}
    </div>
  );
}

function UsersPanel({
  users, actionLoading, onAction, onViewDetail, onDeleteUser,
}: { users: User[]; actionLoading: string | null; onAction: (action: UsersAction, user: User) => void; onViewDetail: (user: User) => void; onDeleteUser: (user: User) => void }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Users</h1>
        <p className="text-sm text-slate-500 mt-1">Active, rejected, and suspended dietitian accounts — change status anytime</p>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users yet" subtitle="Approved, rejected, or suspended accounts will appear here" />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Registered</Th><Th>Status</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => (
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewDetail(user)}
                          className="px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded transition-colors"
                        >
                          View
                        </button>
                        {(['active', 'rejected', 'suspended'] as UsersAction[])
                          .filter((s) => s !== user.status)
                          .map((action) => (
                            <button
                              key={action}
                              onClick={() => onAction(action, user)}
                              disabled={actionLoading === user.id}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed capitalize ${USERS_CONFIG[action].color}`}
                            >
                              {actionLoading === user.id ? '…' : USERS_CONFIG[action].label}
                            </button>
                          ))}
                        <button
                          onClick={() => onDeleteUser(user)}
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </div>
        </div>
      )}
    </div>
  );
}