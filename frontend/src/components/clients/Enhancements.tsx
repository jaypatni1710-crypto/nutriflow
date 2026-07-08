import { useEffect, useState } from 'react';
import { clientApi } from '../../lib/client.api';
import { ClientFoodFrequency, ClientLabReport, ClientProgressPhoto, ClientTimelineEvent } from '../../types/client.types';
import { FOOD_FREQUENCY_OPTIONS, FOOD_FREQUENCY_ITEMS, STATUS_OPTIONS, STATUS_LABELS, LAB_REPORT_TYPES } from '../../lib/clientOptions';
import { Select } from './FormFields';
import { compressImage } from '../../lib/imageCompress';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  completed: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.active}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function StatusSelector({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}

// Feature 4: Goal Progress Bar
export function GoalProgressBar({ start, current, goal }: { start: number | null; current: number | null; goal: number | null }) {
  if (!current || !goal) return <p className="text-sm text-slate-400">Set current weight and goal weight to track progress.</p>;
  const base = start ?? current;
  let pct = 0;
  if (base !== goal) pct = Math.max(0, Math.min(100, Math.round(((base - current) / (base - goal)) * 100)));
  const remaining = Math.abs(current - goal);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-semibold text-slate-900 dark:text-white">{pct}% Complete</span>
        <span className="text-slate-500 dark:text-slate-400">{remaining.toFixed(1)} kg remaining</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Feature 1: Food Frequency Questionnaire
export function FoodFrequencySection({ clientId, history, onSaved }: { clientId: string; history: ClientFoodFrequency[]; onSaved: () => void }) {
  const latest = history[0];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const init: Record<string, string> = {};
    FOOD_FREQUENCY_ITEMS.forEach(({ key }) => { init[key] = (latest as any)?.[key] || ''; });
    setForm(init);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await clientApi.addFoodFrequency(clientId, form);
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Food Frequency Questionnaire</h4>
        {!editing && (
          <button onClick={startEdit} className="text-teal-600 hover:text-teal-700 font-medium text-xs">
            {latest ? 'Update' : 'Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {FOOD_FREQUENCY_ITEMS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>
                <Select options={FOOD_FREQUENCY_OPTIONS} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      ) : !latest ? (
        <p className="text-sm text-slate-400">No food frequency data recorded yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm mb-3">
            {FOOD_FREQUENCY_ITEMS.map(({ key, label }) => (
              <div key={key} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-slate-900 dark:text-white font-medium">{(latest as any)[key] || '—'}</span>
              </div>
            ))}
          </div>
          {history.length > 1 && (
            <p className="text-xs text-slate-400">{history.length} historical entries · Latest recorded {new Date(latest.created_at).toLocaleDateString()}</p>
          )}
        </>
      )}
    </div>
  );
}

// Feature 2: Progress Photos (Before + rolling 3-month window)
function PhotoThumb({ clientId, photo, label, onDelete }: { clientId: string; photo: ClientProgressPhoto; label: string; onDelete?: () => void }) {
  const [url, setUrl] = useState('');
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    let active = true;
    clientApi.getProgressPhotoBlobUrl(clientId, photo.id).then((u) => { if (active) setUrl(u); }).catch(() => {});
    return () => { active = false; };
  }, [clientId, photo.id]);

  return (
    <>
      <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        {url ? (
          <img src={url} alt={label} onClick={() => setFullScreen(true)} className="w-full h-40 object-cover cursor-pointer" />
        ) : (
          <div className="w-full h-40 flex items-center justify-center text-slate-400 text-xs">Loading...</div>
        )}
        <div className="p-2 text-xs">
          <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
          <span className="block text-slate-400">{new Date(photo.uploaded_at).toLocaleDateString()}</span>
        </div>
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => clientApi.downloadProgressPhoto(clientId, photo.id, photo.original_filename)}
            title="Download"
            aria-label="Download photo"
            className="p-1.5 rounded bg-white/90 text-slate-700 hover:bg-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete"
              aria-label="Delete photo"
              className="p-1.5 rounded bg-red-500/90 text-white hover:bg-red-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {fullScreen && url && (
        <div onClick={() => setFullScreen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out">
          <img src={url} alt={label} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}

function PhotoSlot({ label, photo, clientId, uploading, onUpload, onDelete }: {
  label: string;
  photo: ClientProgressPhoto | null;
  clientId: string;
  uploading: boolean;
  onUpload?: (file: File) => void;
  onDelete?: () => void;
}) {
  if (photo) {
    return <PhotoThumb clientId={clientId} photo={photo} label={label} onDelete={onDelete} />;
  }
  return (
    <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-xs cursor-pointer hover:border-teal-400 hover:text-teal-500 transition-colors">
      {uploading ? 'Uploading...' : (
        <>
          <span className="text-2xl mb-1">+</span>
          <span>{label}</span>
        </>
      )}
      <input
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && onUpload) onUpload(f);
          // Reset so selecting the same file again always fires onChange
          e.target.value = '';
        }}
      />
    </label>
  );
}

export function ProgressPhotosSection({ clientId, photos, onChanged }: { clientId: string; photos: ClientProgressPhoto[]; onChanged: () => void }) {
  const [uploading, setUploading] = useState<'before' | 'monthly' | null>(null);
  const [error, setError] = useState('');

  const before = photos.find((p) => p.photo_type === 'before') || null;
  const monthly = photos.filter((p) => p.photo_type === 'monthly').sort((a, b) => (a.month_number ?? 0) - (b.month_number ?? 0));
  // Matches the backend's numbering rule exactly: the next upload always gets
  // (highest existing month_number) + 1, never a count-based guess. This keeps
  // the empty-slot placeholder label accurate even after a mid-sequence delete.
  const nextMonthNumber = monthly.reduce((max, p) => Math.max(max, p.month_number ?? 0), 0) + 1;

  const handleUpload = async (photoType: 'before' | 'monthly', file: File) => {
    setUploading(photoType);
    setError('');
    try {
      const compressed = await compressImage(file);
      await clientApi.uploadProgressPhoto(clientId, photoType, compressed);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const remove = async (photoId: string) => {
    setError('');
    try {
      await clientApi.deleteProgressPhoto(clientId, photoId);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete photo. Please try again.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Progress Photos</h4>
      <p className="text-xs text-slate-400 mb-4">1 Before photo (permanent) + last 3 monthly photos. Older monthly photos are removed automatically.</p>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PhotoSlot
          key="before"
          label="Before"
          photo={before}
          clientId={clientId}
          uploading={uploading === 'before'}
          onUpload={(f) => handleUpload('before', f)}
          onDelete={before ? () => remove(before.id) : undefined}
        />
        {monthly.map((p) => (
          <PhotoSlot
            key={p.id}
            label={`Month ${p.month_number}`}
            photo={p}
            clientId={clientId}
            uploading={false}
            onDelete={() => remove(p.id)}
          />
        ))}
        {monthly.length < 3 && (
          <PhotoSlot
            key={`monthly-slot-${nextMonthNumber}`}
            label={`Month ${nextMonthNumber}`}
            photo={null}
            clientId={clientId}
            uploading={uploading === 'monthly'}
            onUpload={(f) => handleUpload('monthly', f)}
          />
        )}
      </div>
    </div>
  );
}

// Feature: Lab Reports (PDF / JPG / PNG upload)
function reportFileIcon(filename: string) {
  return filename.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️';
}

function LabReportRow({ clientId, report, onDelete }: { clientId: string; report: ClientLabReport; onDelete: () => void }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await clientApi.downloadLabReport(clientId, report.id, report.original_filename);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl shrink-0">{reportFileIcon(report.original_filename)}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{report.report_type}</p>
          <p className="text-xs text-slate-400 truncate">{report.original_filename} · {new Date(report.uploaded_at).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={download}
          disabled={busy}
          title="Download"
          aria-label="Download report"
          className="p-1.5 rounded text-slate-500 hover:text-teal-600 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          aria-label="Delete report"
          className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-white dark:hover:bg-slate-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const MAX_REPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB, must match backend
const MAX_REPORT_COUNT = 2; // must match backend

export function LabReportsSection({ clientId, reports, onChanged }: { clientId: string; reports: ClientLabReport[]; onChanged: () => void }) {
  const [reportType, setReportType] = useState(LAB_REPORT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [inputKey, setInputKey] = useState(0);

  const atLimit = reports.length >= MAX_REPORT_COUNT;

  const handleFile = (f: File | null) => {
    setError('');
    if (f && f.size > MAX_REPORT_FILE_SIZE) {
      setError('File size must be under 5MB');
      setFile(null);
      setInputKey((k) => k + 1);
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file || atLimit) return;
    setUploading(true);
    setError('');
    try {
      await clientApi.uploadLabReport(clientId, reportType, file);
      setFile(null);
      setInputKey((k) => k + 1);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (reportId: string) => {
    await clientApi.deleteLabReport(clientId, reportId);
    onChanged();
  };

  const sorted = [...reports].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Lab Reports & Documents</h4>
      <p className="text-xs text-slate-400 mb-4">Upload prescriptions and lab reports (PDF, JPG, PNG · up to 5MB · max {MAX_REPORT_COUNT} files).</p>

      {atLimit ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">Maximum of {MAX_REPORT_COUNT} reports reached. Delete one below to upload another.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Report Type</label>
            <Select options={LAB_REPORT_TYPES} value={reportType} onChange={(e) => setReportType(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">File (PDF, JPG, PNG)</label>
            <input
              key={inputKey}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-600 dark:text-slate-300"
            />
          </div>
          <button onClick={upload} disabled={!file || uploading} className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">No lab reports uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r) => (
            <LabReportRow key={r.id} clientId={clientId} report={r} onDelete={() => remove(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Feature 7: Client Timeline
const TIMELINE_ICONS: Record<string, string> = {
  client_created: '🧑', assessment_updated: '📋', weight_updated: '⚖️',
  report_uploaded: '🧪', note_added: '📝', status_changed: '🔄', photo_uploaded: '📸',
  communication_logged: '💬', goal_updated: '🎯', archived: '📦', restored: '✅',
};

// Same order as the profile page tabs (Overview, Assessment, Medical History,
// Progress, Appointments, Diet Plan, Notes) so the dropdown matches the tabs.
// Same order as the profile page tabs (Overview, Assessment, Medical History,
// Progress, Appointments, Diet Plan, Notes) so the dropdown matches the tabs.
const FILTER_OPTIONS: { label: string; values: string[] }[] = [
  { label: 'All', values: [] },
  { label: 'Overview', values: ['client_created', 'goal_updated', 'status_changed', 'overview_updated', 'archived', 'restored'] },
  { label: 'Assessment', values: ['assessment_updated'] },
  { label: 'Medical History', values: ['medical_history_updated', 'report_uploaded', 'report_deleted'] },
  { label: 'Progress', values: ['photo_uploaded', 'photo_deleted', 'weight_updated'] },
  { label: 'Appointments', values: ['appointment_scheduled'] },
  { label: 'Diet Plan', values: ['diet_plan_created'] },
  { label: 'Notes', values: ['note_added', 'note_updated'] },
];

// Maps each event type to the profile tab it should jump to on click.
// Events with no entry here (e.g. client_created) aren't clickable.
const EVENT_TAB_MAP: Record<string, string> = {
  goal_updated: 'Overview', status_changed: 'Overview', overview_updated: 'Overview',
  archived: 'Overview', restored: 'Overview',
  assessment_updated: 'Assessment',
  medical_history_updated: 'Medical History', report_uploaded: 'Medical History', report_deleted: 'Medical History',
  photo_uploaded: 'Progress', photo_deleted: 'Progress', weight_updated: 'Progress',
  appointment_scheduled: 'Appointments',
  diet_plan_created: 'Diet Plan',
  note_added: 'Notes', note_updated: 'Notes',
};

// One color + icon per tab category. "Created" (no tab) gets its own look.
const CATEGORY_META: Record<string, { style: string; icon: React.ReactNode }> = {
  Overview: {
    style: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  Assessment: {
    style: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v2h6V3M9 10h6M9 14h6M9 18h3" />
      </svg>
    ),
  },
  'Medical History': {
    style: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2v4M15 2v4M4 8h16l-1 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 8Z" />
        <path d="M12 11v6M9 14h6" />
      </svg>
    ),
  },
  Progress: {
    style: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" />
      </svg>
    ),
  },
  Appointments: {
    style: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  'Diet Plan': {
    style: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      </svg>
    ),
  },
  Notes: {
    style: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v13l-4 3H4z" /><path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
};

const CREATED_META = {
  style: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 12h18" />
    </svg>
  ),
};

function formatTimelineDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function TimelineSection({ events, onNavigate }: { events: ClientTimelineEvent[]; onNavigate: (tab: string) => void }) {
  const [filter, setFilter] = useState('All');
  const activeValues = FILTER_OPTIONS.find((o) => o.label === filter)?.values || [];
  const filtered = activeValues.length ? events.filter((e) => activeValues.includes(e.event_type)) : events;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Client Timeline</h4>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {FILTER_OPTIONS.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">No activity recorded yet.</p>
      ) : (
        <div>
          {filtered.map((e, idx) => {
            const targetTab = EVENT_TAB_MAP[e.event_type];
            const meta = (targetTab && CATEGORY_META[targetTab]) || CREATED_META;
            const isLast = idx === filtered.length - 1;

            const inner = (
              <>
                <span className={`relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${meta.style}`}>
                  {meta.icon}
                </span>
                <div className="flex-1 min-w-0 pt-1">
                  <p className={`text-sm text-slate-800 dark:text-slate-100 ${targetTab ? 'group-hover:text-teal-600 dark:group-hover:text-teal-400' : ''}`}>
                    {e.description}
                  </p>
                  <span className="block mt-0.5 text-xs text-slate-400">{formatTimelineDate(e.created_at)}</span>
                </div>
                {targetTab && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-2 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </>
            );

            return (
              <div key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && <span className="absolute left-4 top-8 bottom-0 w-px bg-slate-150 dark:bg-slate-800" />}
                {targetTab ? (
                  <button onClick={() => onNavigate(targetTab)} className="group flex gap-3 w-full text-left rounded-lg -mx-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    {inner}
                  </button>
                ) : (
                  <div className="flex gap-3 w-full">{inner}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}