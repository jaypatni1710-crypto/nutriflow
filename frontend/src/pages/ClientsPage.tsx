import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../lib/client.api';
import { ClientListItem } from '../types/client.types';
import { GOAL_OPTIONS, MEDICAL_CONDITIONS, STATUS_OPTIONS, STATUS_LABELS } from '../lib/clientOptions';
import { AddClientModal } from '../components/clients/AddClientModal';
import { Toast } from '../components/clients/Toast';

const LIMIT = 10;

function calcAge(dob: string | null): number | string {
  if (!dob) return '—';
  const b = new Date(dob);
  if (isNaN(b.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function BmiStatusBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-slate-400">—</span>;
  const colors: Record<string, string> = {
    Underweight: 'text-amber-600 bg-amber-50 border-amber-200',
    Normal: 'text-teal-600 bg-teal-50 border-teal-200',
    Overweight: 'text-orange-600 bg-orange-50 border-orange-200',
    Obese: 'text-red-600 bg-red-50 border-red-200',
  };
  const color = colors[category] || 'text-slate-600 bg-slate-50 border-slate-200';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${color}`}>{category}</span>;
}

// Inline icon buttons — no extra dependency needed
function IconButton({ title, onClick, color, children }: { title: string; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${color}`}
    >
      {children}
    </button>
  );
}

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [goal, setGoal] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClientListItem | null>(null);

  useEffect(() => {
    clientApi.listAllTags().then((r) => setAllTags(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await clientApi.list({ page, limit: LIMIT, search, goal, condition, status, tag });
      setClients(res.data);
      setTotalPages(res.total_pages || 1);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [page, search, goal, condition, status, tag]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, goal, condition, status, tag]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await clientApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      setToast('Client deleted');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete client');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Clients</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage all client records, assessments and progress.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          Add Client
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="flex-1 min-w-[220px] px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <select value={goal} onChange={(e) => setGoal(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All Goals</option>
          {GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All Conditions</option>
          {MEDICAL_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">All Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 dark:text-slate-400 font-medium">No clients yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Add your first client to start building their care plan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">BMI Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.phone_number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{calcAge(c.date_of_birth)}</td>
                    <td className="px-4 py-3"><BmiStatusBadge category={c.bmi_category} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton title="View" color="text-teal-600" onClick={() => navigate(`/dashboard/clients/${c.id}`)}>
                          <EyeIcon />
                        </IconButton>
                        <IconButton title="Edit" color="text-slate-500" onClick={() => navigate(`/dashboard/clients/${c.id}?edit=1`)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton title="Delete" color="text-red-500" onClick={() => setDeleteTarget(c)}>
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages} · {total} clients</span>
            <div className="space-x-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddClientModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); setToast('Client added successfully'); load(); }} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Delete Client</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Are you sure you want to permanently delete {deleteTarget.first_name} {deleteTarget.last_name}?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
