import { useEffect, useMemo, useRef, useState } from 'react';
import { clientApi } from '../lib/client.api';
import { dietPlanApi } from '../lib/diet-plan.api';
import { ClientListItem } from '../types/client.types';
import { DietPlan } from '../types/diet-plan.types';
import { GOAL_OPTIONS } from '../lib/clientOptions';
import { Toast } from '../components/clients/Toast';

const MEAL_FIELDS: { key: keyof DietPlan; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'mid_morning', label: 'Mid Morning' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'evening_snacks', label: 'Evening Snacks' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'bed_time', label: 'Bed Time' },
];

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

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DietPlanPage() {
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DietPlan | null>(null);
  const [viewTarget, setViewTarget] = useState<DietPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DietPlan | null>(null);

  const load = () => {
    setLoading(true);
    dietPlanApi.list()
      .then((res) => setPlans(res.data))
      .catch(() => setToast('Failed to load diet plans'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSaved = (plan: DietPlan, wasEdit: boolean) => {
    setPlans((prev) => (wasEdit ? prev.map((p) => (p.id === plan.id ? plan : p)) : [plan, ...prev]));
    setToast(wasEdit ? 'Diet plan updated' : 'Diet plan created');
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dietPlanApi.remove(deleteTarget.id);
      // Renumber locally: any plan for the same client with a higher
      // plan_number shifts down by one, matching the backend's renumbering.
      setPlans((prev) =>
        prev
          .filter((p) => p.id !== deleteTarget.id)
          .map((p) =>
            p.client_id === deleteTarget.client_id && p.plan_number > deleteTarget.plan_number
              ? { ...p, plan_number: p.plan_number - 1 }
              : p
          )
      );
      setToast('Diet plan deleted');
    } catch {
      setToast('Failed to delete diet plan');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">Diet Plan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage diet plans for your clients.</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          Add Diet Plan
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading...</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No diet plans yet. Click "Add Diet Plan" to create one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date Created</th>
                <th className="px-4 py-3">Goal</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                    {p.client_name} <span className="text-slate-400 font-normal">#{p.plan_number}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.goal || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewTarget(p)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="View">
                        <EyeIcon />
                      </button>
                      <button onClick={() => { setEditTarget(p); setShowModal(true); }} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="Edit">
                        <PencilIcon />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500" title="Delete">
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <DietPlanModal
          existingPlans={plans}
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}

      {viewTarget && <ViewDietPlanModal plan={viewTarget} onClose={() => setViewTarget(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete diet plan?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              This will permanently delete Diet Plan #{deleteTarget.plan_number} for {deleteTarget.client_name}. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

// ---- Add / Edit modal ----
function DietPlanModal({
  existingPlans,
  initial,
  onClose,
  onSaved,
}: {
  existingPlans: DietPlan[];
  initial: DietPlan | null;
  onClose: () => void;
  onSaved: (plan: DietPlan, wasEdit: boolean) => void;
}) {
  const [clientQuery, setClientQuery] = useState(initial?.client_name || '');
  const [clientId, setClientId] = useState(initial?.client_id || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [goal, setGoal] = useState(initial?.goal || '');
  const [note, setNote] = useState(initial?.note || '');
  const [meals, setMeals] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEAL_FIELDS.map((f) => [f.key, (initial?.[f.key] as string) || '']))
  );
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (initial) return; // don't re-search once editing an existing plan
    const q = clientQuery.trim();
    if (!q) { setClients([]); return; }
    const t = setTimeout(() => {
      clientApi.list({ search: q, limit: 8 }).then((res) => setClients(res.data)).catch(() => setClients([]));
    }, 250);
    return () => clearTimeout(t);
  }, [clientQuery, initial]);

  const handleSelectClient = (c: ClientListItem) => {
    setClientId(c.id);
    setClientQuery(`${c.first_name} ${c.last_name}`);
    setGoal(c.primary_goal || '');
    setShowDropdown(false);
  };

  // Live plan number preview: count existing plans for this client + 1.
  // When editing, just show the existing plan's number (it doesn't change).
  const planNumber = initial
    ? initial.plan_number
    : existingPlans.filter((p) => p.client_id === clientId).length + 1;

  const canSave = !!clientId;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const body = { client_id: clientId, goal: goal || null, note: note || null, ...meals };
      const res = initial
        ? await dietPlanApi.update(initial.id, body)
        : await dietPlanApi.create(body);
      onSaved(res.data, !!initial);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg my-auto">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          {initial ? 'Edit Diet Plan' : 'Add Diet Plan'}
        </h3>
        {clientId && (
          <p className="text-sm text-teal-600 dark:text-teal-400 font-medium mb-4">
            Diet Plan #{planNumber} for {clientQuery}
          </p>
        )}

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {!initial && (
            <div className="relative" ref={wrapperRef}>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Select Client</label>
              <input
                type="text"
                value={clientQuery}
                onChange={(e) => { setClientQuery(e.target.value); setClientId(''); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type client name..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {showDropdown && clients.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {c.first_name} {c.last_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select goal</option>
              {GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Changing this also updates the client's saved goal everywhere.</p>
          </div>

          {MEAL_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{f.label}</label>
              <textarea
                rows={2}
                value={meals[f.key]}
                onChange={(e) => setMeals((m) => ({ ...m, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Note <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Read-only view modal ----
function ViewDietPlanModal({ plan, onClose }: { plan: DietPlan; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg my-auto">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Diet Plan #{plan.plan_number}</h3>
        <p className="text-sm text-teal-600 dark:text-teal-400 font-medium mb-4">{plan.client_name}</p>

        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Goal</p>
            <p className="text-sm text-slate-900 dark:text-white">{plan.goal || '—'}</p>
          </div>
          {MEAL_FIELDS.map((f) => (
            <div key={f.key}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{f.label}</p>
              <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{(plan[f.key] as string) || '—'}</p>
            </div>
          ))}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Note</p>
            <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{plan.note || '—'}</p>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Close</button>
        </div>
      </div>
    </div>
  );
}