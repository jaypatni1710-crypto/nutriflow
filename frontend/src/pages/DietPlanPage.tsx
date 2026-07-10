import { useEffect, useRef, useState } from 'react';
import { clientApi } from '../lib/client.api';
import { dietPlanApi } from '../lib/diet-plan.api';
import { appointmentApi, ApiAppointment } from '../lib/appointment.api';
import { ClientListItem } from '../types/client.types';
import { GOAL_OPTIONS } from '../lib/clientOptions';
import { Toast } from '../components/clients/Toast';

export interface DietPlan {
  id: string;
  client_id: string;
  client_name: string;
  plan_number: number;
  created_at: string;
  goal: string | null;
  note: string | null;
  morning: string | null;
  breakfast: string | null;
  mid_morning: string | null;
  lunch: string | null;
  evening_snacks: string | null;
  dinner: string | null;
  bed_time: string | null;
  is_editable: boolean;
  closure_status: string | null;
  closure_note: string | null;
}

export const CLOSURE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'sent', label: 'Sent' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'not_appropriate', label: 'Not Appropriate' },
  { value: 'discontinued', label: 'Client Discontinued' },
  { value: 'replaced', label: 'Replaced / Updated' },
  { value: 'other', label: 'Other' },
];

function closureStatusLabel(status: string | null): string {
  if (!status) return '';
  return CLOSURE_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

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
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// For each client, finds their most recent appointment (by date, then start
// time) and returns whether that appointment's tag is "diet_plan_sent". If a
// client has no appointments at all, they're left out of the map — treated
// as "Not Sent" wherever it's read.
function computeSentByClient(appts: ApiAppointment[]): Record<string, boolean> {
  const latestByClient: Record<string, ApiAppointment> = {};
  appts.forEach((a) => {
    const existing = latestByClient[a.client_id];
    const key = `${a.appt_date}T${a.time_from}`;
    const existingKey = existing ? `${existing.appt_date}T${existing.time_from}` : '';
    if (!existing || key > existingKey) latestByClient[a.client_id] = a;
  });
  const result: Record<string, boolean> = {};
  Object.entries(latestByClient).forEach(([clientId, a]) => {
    result[clientId] = a.tag === 'diet_plan_sent';
  });
  return result;
}

export default function DietPlanPage() {
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [sentByClient, setSentByClient] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DietPlan | null>(null);
  const [viewTarget, setViewTarget] = useState<DietPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DietPlan | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([dietPlanApi.list(), appointmentApi.list()])
      .then(([plansRes, apptRes]) => {
        setPlans(plansRes.data);
        setSentByClient(computeSentByClient(apptRes.data));
      })
      .catch(() => setToast('Failed to load diet plans'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSaved = (plan: DietPlan, wasEdit: boolean) => {
    setPlans((prev) =>
      wasEdit
        ? prev.map((p) => (p.id === plan.id ? plan : p))
        : [plan, ...prev.map((p) => (p.client_id === plan.client_id ? { ...p, is_editable: false } : p))]
    );
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
                <th className="px-4 py-3">Diet Plan Sent</th>
                <th className="px-4 py-3">Status</th>
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
                    {sentByClient[p.client_id] ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Not Sent
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_editable ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                        Latest
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        title={p.closure_note || ''}
                      >
                        Locked{p.closure_status ? ` · ${closureStatusLabel(p.closure_status)}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewTarget(p)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="View">
                        <EyeIcon />
                      </button>
                      {p.is_editable ? (
                        <button onClick={() => { setEditTarget(p); setShowModal(true); }} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="Edit">
                          <PencilIcon />
                        </button>
                      ) : (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 dark:text-slate-700 cursor-not-allowed" title="Locked — only the latest plan is editable">
                          <LockIcon />
                        </span>
                      )}
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
export function DietPlanModal({
  existingPlans,
  initial,
  onClose,
  onSaved,
  lockedClientId,
  lockedClientName,
  initialGoal,
}: {
  existingPlans: DietPlan[];
  initial: DietPlan | null;
  onClose: () => void;
  onSaved: (plan: DietPlan, wasEdit: boolean) => void;
  lockedClientId?: string;
  lockedClientName?: string;
  initialGoal?: string;
}) {
  const [clientQuery, setClientQuery] = useState(initial?.client_name || lockedClientName || '');
  const [clientId, setClientId] = useState(initial?.client_id || lockedClientId || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [goal, setGoal] = useState(initial?.goal || initialGoal || '');
  const [note, setNote] = useState(initial?.note || '');
  const [meals, setMeals] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEAL_FIELDS.map((f) => [f.key, (initial?.[f.key] as string) || '']))
  );
  const [prevStatus, setPrevStatus] = useState('');
  const [prevStatusOther, setPrevStatusOther] = useState('');
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
    if (initial || lockedClientId) return; // don't search when editing or client is locked
    const q = clientQuery.trim();
    if (!q) { setClients([]); return; }
    const t = setTimeout(() => {
      clientApi.list({ search: q, limit: 8 }).then((res) => setClients(res.data)).catch(() => setClients([]));
    }, 250);
    return () => clearTimeout(t);
  }, [clientQuery, initial, lockedClientId]);

  const handleSelectClient = (c: ClientListItem) => {
    setClientId(c.id);
    setClientQuery(`${c.first_name} ${c.last_name}`);
    setGoal(c.primary_goal || '');
    setShowDropdown(false);
  };

  const planNumber = initial
    ? initial.plan_number
    : existingPlans.filter((p) => p.client_id === clientId).length + 1;

  // Only relevant when creating a brand-new plan for a client who already has one.
  const hasPreviousPlan = !initial && existingPlans.some((p) => p.client_id === clientId);

  const requiredMealsFilled = MEAL_FIELDS.every((f) => meals[f.key].trim() !== '');
  const canSave = !!clientId && !!goal && requiredMealsFilled;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const body: Record<string, any> = { client_id: clientId, goal, note: note || null, ...meals };
      if (hasPreviousPlan && prevStatus) {
        body.previous_plan_status = prevStatus;
        if (prevStatus === 'other') body.previous_plan_status_other = prevStatusOther || null;
      }
      const res = initial
        ? await dietPlanApi.update(initial.id, body)
        : await dietPlanApi.create(body);
      onSaved(res.data, !!initial);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 pt-6 pb-1 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {initial ? 'Edit Diet Plan' : 'Add Diet Plan'}
          </h3>
          {clientId && (
            <p className="text-sm text-teal-600 dark:text-teal-400 font-medium mb-1">
              Diet Plan #{planNumber} for {clientQuery}
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
          {!initial && !lockedClientId && (
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

          {!initial && lockedClientId && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Client</label>
              <div className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                {lockedClientName}
              </div>
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

          {hasPreviousPlan && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                What happened to the previous diet plan? <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={prevStatus}
                onChange={(e) => setPrevStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select status</option>
                {CLOSURE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {prevStatus === 'other' && (
                <textarea
                  rows={2}
                  value={prevStatusOther}
                  onChange={(e) => setPrevStatusOther(e.target.value)}
                  placeholder="Describe what happened..."
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              )}
              <p className="mt-1 text-xs text-slate-400">The previous plan will be locked once this new plan is saved.</p>
            </div>
          )}

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

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
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

const MEAL_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  morning: { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  breakfast: { dot: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  mid_morning: { dot: 'bg-lime-400', text: 'text-lime-600 dark:text-lime-400', bg: 'bg-lime-50 dark:bg-lime-500/10' },
  lunch: { dot: 'bg-teal-400', text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  evening_snacks: { dot: 'bg-purple-400', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  dinner: { dot: 'bg-indigo-400', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
  bed_time: { dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

export function ViewDietPlanModal({ plan, onClose }: { plan: DietPlan; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Diet Plan #{plan.plan_number}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Client: {plan.client_name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Created on {formatDate(plan.created_at)}</p>
              {!plan.is_editable && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  🔒 Locked{plan.closure_status ? ` · ${closureStatusLabel(plan.closure_status)}` : ''}
                  {plan.closure_note ? ` — ${plan.closure_note}` : ''}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-6 overflow-y-auto max-h-[70vh]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Goal</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{plan.goal || '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Note</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{plan.note || '—'}</p>
            </div>
          </div>

          <div className="grid gap-4">
            {MEAL_FIELDS.map((field) => {
              const value = plan[field.key] || '—';
              const color = MEAL_COLORS[field.key] || MEAL_COLORS.bed_time;
              return (
                <div key={field.key} className={`rounded-2xl p-4 ${color.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${color.dot}`} />
                    <h4 className={`text-sm font-semibold ${color.text}`}>{field.label}</h4>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientDietPlanSection({ clientId, clientName, clientGoal }: { clientId: string; clientName: string; clientGoal?: string }) {
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
      .then((res) => setPlans(res.data.filter((p) => p.client_id === clientId)))
      .catch(() => setToast('Failed to load diet plans'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [clientId]);

  const handleSaved = (plan: DietPlan, wasEdit: boolean) => {
    setPlans((prev) =>
      wasEdit
        ? prev.map((p) => (p.id === plan.id ? plan : p))
        : [plan, ...prev.map((p) => ({ ...p, is_editable: false }))]
    );
    setToast(wasEdit ? 'Diet plan updated' : 'Diet plan created');
    setShowModal(false);
    setEditTarget(null);
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dietPlanApi.remove(deleteTarget.id);
      setPlans((prev) =>
        prev
          .filter((p) => p.id !== deleteTarget.id)
          .map((p) => (p.plan_number > deleteTarget.plan_number ? { ...p, plan_number: p.plan_number - 1 } : p))
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
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Diet Plans</h4>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
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
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Date Created</th>
                <th className="px-4 py-3">Goal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">#{p.plan_number}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.goal || '—'}</td>
                  <td className="px-4 py-3">
                    {p.is_editable ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                        Latest
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        title={p.closure_note || ''}
                      >
                        Locked{p.closure_status ? ` · ${closureStatusLabel(p.closure_status)}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewTarget(p)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="View">
                        <EyeIcon />
                      </button>
                      {p.is_editable ? (
                        <button onClick={() => { setEditTarget(p); setShowModal(true); }} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" title="Edit">
                          <PencilIcon />
                        </button>
                      ) : (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 dark:text-slate-700 cursor-not-allowed" title="Locked — only the latest plan is editable">
                          <LockIcon />
                        </span>
                      )}
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
          lockedClientId={clientId}
          lockedClientName={clientName}
          initialGoal={clientGoal}
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
              This will permanently delete Diet Plan #{deleteTarget.plan_number}. This cannot be undone.
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