import { useState } from 'react';
import { clientApi } from '../../lib/client.api';
import { ClientCommunication } from '../../types/client.types';
import { COMMUNICATION_TYPES } from '../../lib/clientOptions';
import { Select, TextArea } from './FormFields';

const TYPE_ICONS: Record<string, string> = {
  'WhatsApp Message': '💬',
  'Diet Plan Shared': '🥗',
  'Follow-Up Reminder': '🔔',
  'Progress Report Shared': '📊',
  'Consultation Summary': '📋',
  'Payment Reminder': '💰',
  'Custom Note': '📝',
};

interface Props {
  clientId: string;
  entries: ClientCommunication[];
  onChanged: () => void;
}

interface EditState { id: string; type: string; description: string }

export function CommunicationLog({ clientId, entries, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(COMMUNICATION_TYPES[0]);
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);

  const quickLog = async (type: string) => {
    await clientApi.addCommunication(clientId, type);
    onChanged();
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      await clientApi.addCommunication(clientId, formType, formDesc || undefined);
      setFormType(COMMUNICATION_TYPES[0]);
      setFormDesc('');
      setShowForm(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (e: ClientCommunication) => {
    setEditState({ id: e.id, type: e.type, description: e.description || '' });
  };

  const saveEdit = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      await clientApi.updateCommunication(clientId, editState.id, editState.type, editState.description || undefined);
      setEditState(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (commId: string) => {
    await clientApi.deleteCommunication(clientId, commId);
    onChanged();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Communication Log</h4>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors">
          + Add Entry
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['WhatsApp Message', 'Diet Plan Shared', 'Follow-Up Reminder'].map((t) => (
          <button key={t} onClick={() => quickLog(t)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
            {TYPE_ICONS[t]} Log {t}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Type</label>
            <Select options={COMMUNICATION_TYPES as unknown as string[]} value={formType} onChange={(e) => setFormType(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Description (optional)</label>
            <TextArea rows={2} placeholder="Add details..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* History Table */}
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No communication logged yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((e) => (
            <div key={e.id} className="py-3">
              {editState?.id === e.id ? (
                <div className="space-y-2">
                  <Select options={COMMUNICATION_TYPES as unknown as string[]} value={editState.type} onChange={(ev) => setEditState((s) => s ? { ...s, type: ev.target.value } : null)} />
                  <TextArea rows={2} value={editState.description} onChange={(ev) => setEditState((s) => s ? { ...s, description: ev.target.value } : null)} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditState(null)} className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                    <button onClick={saveEdit} disabled={saving} className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <span className="text-base mt-0.5">{TYPE_ICONS[e.type] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{e.type}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    {e.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{e.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => startEdit(e)} className="text-xs text-slate-400 hover:text-teal-600 font-medium">Edit</button>
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-slate-400 hover:text-red-500 font-medium">Del</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
