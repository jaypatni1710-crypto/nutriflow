import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../lib/client.api';
import { ClientListItem } from '../types/client.types';
import { GOAL_OPTIONS, MEDICAL_CONDITIONS, STATUS_OPTIONS, STATUS_LABELS } from '../lib/clientOptions';
import { AddClientModal } from '../components/clients/AddClientModal';
import { Toast } from '../components/clients/Toast';
import { TagPill } from '../components/clients/ClientTags';
import { StatusBadge } from '../components/clients/Enhancements';

const LIMIT = 10;

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
  const [showArchived, setShowArchived] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClientListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientListItem | null>(null);

  useEffect(() => {
    clientApi.listAllTags().then((r) => setAllTags(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await clientApi.list({ page, limit: LIMIT, search, goal, condition, status, tag, archived: showArchived });
      setClients(res.data);
      setTotalPages(res.total_pages || 1);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [page, search, goal, condition, status, tag, showArchived]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, goal, condition, status, tag, showArchived]);

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

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await clientApi.archiveClient(archiveTarget.id);
      setArchiveTarget(null);
      setToast('Client archived');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive client');
      setArchiveTarget(null);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await clientApi.restoreClient(id);
      setToast('Client restored');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore client');
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
      </div>

      {/* Second filter row: tags + archive toggle */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">All Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300 ml-auto">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-4 h-4 rounded accent-teal-600" />
          Show Archived
        </label>
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
                  <th className="px-4 py-3">Primary Goal</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Current Weight</th>
                  <th className="px-4 py-3">BMI</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className={`border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${c.is_archived ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.phone_number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.primary_goal || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
                        {(c.tags || []).length > 3 && <span className="text-xs text-slate-400">+{c.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.current_weight_kg ? `${c.current_weight_kg} kg` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.bmi ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                      {c.is_archived && <span className="ml-1 text-xs text-slate-400">(archived)</span>}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => navigate(`/dashboard/clients/${c.id}`)} className="text-teal-600 hover:text-teal-700 font-medium text-xs">View</button>
                      {!c.is_archived && (
                        <button onClick={() => navigate(`/dashboard/clients/${c.id}?edit=1`)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-xs">Edit</button>
                      )}
                      {c.is_archived ? (
                        <button onClick={() => handleRestore(c.id)} className="text-emerald-600 hover:text-emerald-700 font-medium text-xs">Restore</button>
                      ) : (
                        <button onClick={() => setArchiveTarget(c)} className="text-amber-600 hover:text-amber-700 font-medium text-xs">Archive</button>
                      )}
                      <button onClick={() => setDeleteTarget(c)} className="text-red-500 hover:text-red-600 font-medium text-xs">Delete</button>
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

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Archive Client</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Archive {archiveTarget.first_name} {archiveTarget.last_name}? They won't appear in the default list but all data is preserved.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setArchiveTarget(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleArchive} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700">Archive</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
