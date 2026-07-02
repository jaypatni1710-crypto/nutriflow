import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { clientApi } from '../lib/client.api';
import { ClientFullProfile, ClientFormData } from '../types/client.types';
import { Field, TextInput, TextArea, Select, MultiSelectPills } from '../components/clients/FormFields';
import { GOAL_OPTIONS, MEDICAL_CONDITIONS, DIET_TYPES, STRESS_LEVELS, ACTIVITY_LEVELS } from '../lib/clientOptions';
import { Toast } from '../components/clients/Toast';
import { StatusBadge, StatusSelector, ProgressPhotosSection, LabReportsSection, TimelineSection } from '../components/clients/Enhancements';
import { CommunicationLog } from '../components/clients/CommunicationLog';
import { ClientTagsEditor } from '../components/clients/ClientTags';
import { AssessmentCompletionBar, EnhancedSummaryCard } from '../components/clients/ClientExtras';

const TABS = ['Overview', 'Assessment', 'Medical History', 'Progress', 'Communication', 'Notes', 'Timeline'] as const;
type Tab = typeof TABS[number];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{title}</h4>
      {children}
    </div>
  );
}

// Word-aware wrap into ~lineLength-character lines. If a single "word" is
// itself longer than lineLength (no spaces to break on, e.g. an ID or a
// run-on string), force-split it into chunks so it still wraps.
function wrapText(text: string, lineLength = 100): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) { lines.push(current); current = ''; }
  };

  for (const word of words) {
    if (word.length > lineLength) {
      pushCurrent();
      for (let i = 0; i < word.length; i += lineLength) {
        lines.push(word.slice(i, i + lineLength));
      }
      continue;
    }
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length > lineLength) {
      pushCurrent();
      current = word;
    } else {
      current = candidate;
    }
  }
  pushCurrent();
  return lines.join('\n');
}

const ROW_PREVIEW_LENGTH = 100;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const isLongText = typeof value === 'string' && value.length > ROW_PREVIEW_LENGTH;
  const fullText = typeof value === 'string' ? value : '';
  const displayText = isLongText
    ? (expanded ? wrapText(fullText, 100) : fullText.slice(0, ROW_PREVIEW_LENGTH).trim() + '...')
    : value;

  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
      <span className="text-slate-500 dark:text-slate-400 w-[30%] shrink-0">{label}</span>
      <div className="w-[70%] text-right">
        <span className="text-slate-900 dark:text-white font-medium whitespace-pre-wrap break-words">
          {displayText ?? '—'}
        </span>
        {isLongText && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="block ml-auto mt-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
          >
            {expanded ? 'View less' : 'View more'}
          </button>
        )}
      </div>
    </div>
  );
}

// Formats a date string (e.g. "1995-08-23" or ISO) as dd-mm-yyyy
function formatDob(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<ClientFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('Overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClientFormData>({} as ClientFormData);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [newNote, setNewNote] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await clientApi.get(id);
      setProfile(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load client');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && profile && searchParams.get('edit') === '1') {
      startEdit();
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [loading, profile]);

  const startEdit = () => {
    if (!profile) return;
    const { client: c, assessment: a, medical_history: m } = profile;
    setForm({
      first_name: c.first_name, last_name: c.last_name, phone_number: c.phone_number,
      email: c.email || '', gender: c.gender || '',
      date_of_birth: c.date_of_birth || '', occupation: c.occupation || '', city: c.city || '',
      primary_goal: c.primary_goal || '', specify_goal: c.specify_goal || '',
      height_cm: a?.height_cm ?? '', current_weight_kg: a?.current_weight_kg ?? '',
      conditions: m?.conditions || [], specify_condition: m?.specify_condition || '', current_medications: m?.current_medications || '',
      family_medical_history: m?.family_medical_history || '', medical_notes: m?.medical_notes || '',
      diet_type: a?.diet_type || '', specify_diet_type: a?.specify_diet_type || '', food_preferences: a?.food_preferences || '',
      disliked_foods: a?.disliked_foods || '',
      wake_up_time: a?.wake_up_time || '', sleep_time: a?.sleep_time || '', water_intake_per_day: a?.water_intake_per_day || '',
      stress_level: a?.stress_level || '', activity_level: a?.activity_level || '',
      lifestyle_notes: a?.lifestyle_notes || '',
    });
    setEditing(true);
  };

  const set = (patch: Partial<ClientFormData>) => setForm((f) => ({ ...f, ...patch }));

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      ['height_cm', 'current_weight_kg'].forEach((k) => {
        if (payload[k] === '') delete payload[k];
      });
      await clientApi.update(id, payload);
      setEditing(false);
      setToast('Changes saved');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    await clientApi.addNote(id, newNote.trim());
    setNewNote('');
    setToast('Note added');
    load();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!id) return;
    await clientApi.deleteNote(id, noteId);
    setToast('Note deleted');
    load();
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    await clientApi.updateStatus(id, status);
    setToast('Status updated');
    load();
  };

  if (loading) return <div className="text-center text-slate-400 py-12 text-sm">Loading client profile...</div>;
  if (error && !profile) return <div className="text-center text-red-500 py-12 text-sm">{error}</div>;
  if (!profile) return null;

  const { client: c, assessment: a, medical_history: m, progress_logs, notes, progress_photos, lab_reports, timeline, communications, tags } = profile;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/clients')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">←</button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-0.5">
              {editing ? 'Edit Detail' : 'View Detail'}
            </p>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {c.first_name} {c.last_name} <StatusBadge status={c.status} />
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.phone_number} · {c.primary_goal || 'No goal set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelector status={c.status} onChange={handleStatusChange} />
        {!editing && tab !== 'Progress' && tab !== 'Notes' && tab !== 'Timeline' && tab !== 'Communication' && (
          <button onClick={startEdit} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700">Edit</button>
        )}
        {editing && (
          <div className="space-x-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        )}
        </div>
      </div>

      {/* Enhanced Summary + Completion */}
      <EnhancedSummaryCard profile={profile} tags={profile.tags || []} />
      <AssessmentCompletionBar profile={profile} />

      <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setEditing(false); }}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">{error}</div>}

      {tab === 'Overview' && !editing && (
        <>
          <Section title="Personal Details">
            <Row label="Email" value={c.email} />
            <Row label="Gender" value={c.gender} />
            <Row label="Date of Birth" value={formatDob(c.date_of_birth)} />
            <Row label="Occupation" value={c.occupation} />
            <Row label="City" value={c.city} />
          </Section>
          <Section title="Goal Information">
            <Row label="Goal" value={c.primary_goal} />
            {c.primary_goal === 'Other' && <Row label="Specify Goal" value={c.specify_goal} />}
          </Section>
          <Section title="Current Measurements">
            <Row label="Height" value={a?.height_cm ? `${a.height_cm} cm` : null} />
            <Row label="Current Weight" value={a?.current_weight_kg ? `${a.current_weight_kg} kg` : null} />
            <Row label="BMI" value={a?.bmi ? `${a.bmi} (${a.bmi_category})` : null} />
            <Row label="BMR" value={a?.bmr} />
            <Row label="Daily Calorie Requirement" value={a?.daily_calories} />
            <Row label="Daily Protein Requirement" value={a?.daily_protein ? `${a.daily_protein} g` : null} />
            <Row label="Ideal Weight Range" value={a?.ideal_weight_min ? `${a.ideal_weight_min} - ${a.ideal_weight_max} kg` : null} />
          </Section>
        </>
      )}

      {tab === 'Assessment' && !editing && (
        <>
          <Section title="Anthropometric Data">
            <Row label="Height" value={a?.height_cm ? `${a.height_cm} cm` : null} />
            <Row label="Current Weight" value={a?.current_weight_kg ? `${a.current_weight_kg} kg` : null} />
          </Section>
          <Section title="Nutrition Assessment">
            <Row label="Food Preference" value={a?.diet_type} />
            {a?.diet_type === 'Other' && <Row label="Specify Food Preference" value={a?.specify_diet_type} />}
            <Row label="Client Likes to Eat" value={a?.food_preferences} />
            <Row label="Client Doesn't Like to Eat" value={a?.disliked_foods} />
          </Section>
          <Section title="Lifestyle Assessment">
            <Row label="Wake Up Time" value={a?.wake_up_time} />
            <Row label="Sleep Time" value={a?.sleep_time} />
            <Row label="Water Intake/Day" value={a?.water_intake_per_day} />
            <Row label="Stress Level" value={a?.stress_level} />
            <Row label="Activity Level" value={a?.activity_level} />
            <Row label="Notes" value={a?.lifestyle_notes} />
          </Section>
        </>
      )}

      {tab === 'Medical History' && !editing && (
        <>
          <Section title="Medical History">
            <Row label="Conditions" value={m?.conditions?.join(', ')} />
            {m?.conditions?.includes('Other') && <Row label="Specify Condition" value={m?.specify_condition} />}
            <Row label="Current Medications" value={m?.current_medications} />
            <Row label="Family Medical History" value={m?.family_medical_history} />
            <Row label="Medical Notes" value={m?.medical_notes} />
          </Section>
          <LabReportsSection clientId={id!} reports={lab_reports || []} onChanged={() => { setToast('Lab reports updated'); load(true); }} />
        </>
      )}

      {editing && (tab === 'Overview' || tab === 'Assessment' || tab === 'Medical History') && (
        <div className="space-y-4">
          <Section title="Personal & Goal Info">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name"><TextInput value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
              <Field label="Last Name"><TextInput value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
              <Field label="Phone Number"><TextInput value={form.phone_number} onChange={(e) => set({ phone_number: e.target.value })} /></Field>
              <Field label="Email"><TextInput value={form.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Gender"><Select options={['Male', 'Female', 'Other']} value={form.gender || ''} onChange={(e) => set({ gender: e.target.value })} /></Field>
              <Field label="Date of Birth"><TextInput type="date" value={form.date_of_birth || ''} onChange={(e) => set({ date_of_birth: e.target.value })} /></Field>
              <Field label="Occupation"><TextInput value={form.occupation || ''} onChange={(e) => set({ occupation: e.target.value })} /></Field>
              <Field label="City"><TextInput value={form.city || ''} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="Primary Goal"><Select options={GOAL_OPTIONS} value={form.primary_goal || ''} onChange={(e) => set({ primary_goal: e.target.value })} /></Field>
              {form.primary_goal === 'Other' && (
                <Field label="Specify Goal"><TextInput value={form.specify_goal || ''} onChange={(e) => set({ specify_goal: e.target.value })} /></Field>
              )}
            </div>
          </Section>
          <Section title="Anthropometric & Nutrition">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Height (cm)"><TextInput type="number" value={form.height_cm ?? ''} onChange={(e) => set({ height_cm: e.target.value })} /></Field>
              <Field label="Current Weight (kg)"><TextInput type="number" value={form.current_weight_kg ?? ''} onChange={(e) => set({ current_weight_kg: e.target.value })} /></Field>
              <Field label="Wake Up Time"><TextInput type="time" value={form.wake_up_time || ''} onChange={(e) => set({ wake_up_time: e.target.value })} /></Field>
              <Field label="Sleep Time"><TextInput type="time" value={form.sleep_time || ''} onChange={(e) => set({ sleep_time: e.target.value })} /></Field>
              <Field label="Water Intake Per Day"><TextInput value={form.water_intake_per_day || ''} onChange={(e) => set({ water_intake_per_day: e.target.value })} /></Field>
              <Field label="Food Preference"><Select options={DIET_TYPES} value={form.diet_type || ''} onChange={(e) => set({ diet_type: e.target.value })} /></Field>
              {form.diet_type === 'Other' && (
                <Field label="Specify Food Preference"><TextInput value={form.specify_diet_type || ''} onChange={(e) => set({ specify_diet_type: e.target.value })} /></Field>
              )}
              <Field label="Activity Level"><Select options={ACTIVITY_LEVELS} value={form.activity_level || ''} onChange={(e) => set({ activity_level: e.target.value })} /></Field>
              <Field label="Stress Level"><Select options={STRESS_LEVELS} value={form.stress_level || ''} onChange={(e) => set({ stress_level: e.target.value })} /></Field>
              <Field label="Client Likes to Eat"><TextInput value={form.food_preferences || ''} onChange={(e) => set({ food_preferences: e.target.value })} /></Field>
              <Field label="Client Doesn't Like to Eat"><TextInput value={form.disliked_foods || ''} onChange={(e) => set({ disliked_foods: e.target.value })} /></Field>
              <Field label="Notes" className="col-span-2"><TextArea rows={2} value={form.lifestyle_notes || ''} onChange={(e) => set({ lifestyle_notes: e.target.value })} /></Field>
            </div>
          </Section>
          <Section title="Medical History">
            <div className="space-y-4">
              <Field label="Conditions"><MultiSelectPills options={MEDICAL_CONDITIONS} selected={form.conditions || []} onChange={(v) => set({ conditions: v })} /></Field>
              {(form.conditions || []).includes('Other') && (
                <Field label="Specify Condition"><TextInput value={form.specify_condition || ''} onChange={(e) => set({ specify_condition: e.target.value })} /></Field>
              )}
              <Field label="Current Medications"><TextArea rows={2} value={form.current_medications || ''} onChange={(e) => set({ current_medications: e.target.value })} /></Field>
              <Field label="Family Medical History"><TextArea rows={2} value={form.family_medical_history || ''} onChange={(e) => set({ family_medical_history: e.target.value })} /></Field>
              <Field label="Medical Notes"><TextArea rows={2} value={form.medical_notes || ''} onChange={(e) => set({ medical_notes: e.target.value })} /></Field>
            </div>
          </Section>
        </div>
      )}

      {tab === 'Progress' && (
        <>
          <ProgressPhotosSection clientId={id!} photos={progress_photos} onChanged={() => { setToast('Photos updated'); load(true); }} />
        </>
      )}

      {tab === 'Timeline' && <TimelineSection events={timeline} />}

      {tab === 'Communication' && (
        <>
          <CommunicationLog clientId={id!} entries={communications || []} onChanged={() => { setToast('Communication updated'); load(true); }} />
        </>
      )}

      {tab === 'Notes' && (
        <>
          <ClientTagsEditor clientId={id!} tags={tags || []} onChanged={() => load(true)} />
          <Section title="Private Dietitian Notes">
          <div className="mb-4">
            <TextArea rows={3} placeholder="Add a private note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <button onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">Add Note</button>
          </div>
          <div className="space-y-3">
            {notes.length === 0 ? <p className="text-sm text-slate-400">No notes yet.</p> : notes.map((n) => (
              <div key={n.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{n.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
                  <button onClick={() => handleDeleteNote(n.id)} className="text-red-500 hover:text-red-600 font-medium text-xs">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Section>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}