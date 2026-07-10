import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { clientApi } from '../lib/client.api';
import { ClientFullProfile, ClientFormData } from '../types/client.types';
import { Field, TextInput, TextArea, Select, MultiSelectPills } from '../components/clients/FormFields';
import { GOAL_OPTIONS, MEDICAL_CONDITIONS, DIET_TYPES, ACTIVITY_LEVELS } from '../lib/clientOptions';
import { Toast } from '../components/clients/Toast';
import { StatusBadge, StatusSelector, ProgressPhotosSection, LabReportsSection, TimelineSection } from '../components/clients/Enhancements';
import { ClientTagsEditor } from '../components/clients/ClientTags';
import { AssessmentCompletionBar, EnhancedSummaryCard } from '../components/clients/ClientExtras';
import { ClientDietPlanSection } from './DietPlanPage';
import { ClientAppointmentsSection } from '../components/clients/ClientAppointmentsSection';

const TABS = ['Overview', 'Assessment', 'Medical History', 'Progress', 'Appointments', 'Diet Plan', 'Notes', 'Timeline'] as const;
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

// Capitalizes only the first character of a string, leaves the rest untouched
function capFirst(v: string): string {
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// Strips the auto-appended " L" so the raw number can be edited
function waterNumberOnly(v?: string | null): string {
  if (!v) return '';
  const match = v.match(/[\d.]+/);
  return match ? match[0] : '';
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
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteEditTarget, setNoteEditTarget] = useState<{ id: string; title: string | null; content: string } | null>(null);
  const [noteViewTarget, setNoteViewTarget] = useState<{ id: string; title: string | null; content: string; created_at: string } | null>(null);
  const [noteTitleInput, setNoteTitleInput] = useState('');
  const [noteDescInput, setNoteDescInput] = useState('');

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
      date_of_birth: c.date_of_birth ? String(c.date_of_birth).slice(0, 10) : '', occupation: c.occupation || '', city: c.city || '',
      primary_goal: c.primary_goal || '', specify_goal: c.specify_goal || '',
      height_cm: a?.height_cm ?? '', current_weight_kg: a?.current_weight_kg ?? '',
      conditions: m?.conditions || [], specify_condition: m?.specify_condition || '', current_medications: m?.current_medications || '',
      family_medical_history: m?.family_medical_history || '', medical_notes: m?.medical_notes || '',
      diet_type: a?.diet_type || '', specify_diet_type: a?.specify_diet_type || '', food_preferences: a?.food_preferences || '',
      disliked_foods: a?.disliked_foods || '',
      wake_up_time: a?.wake_up_time || '', sleep_time: a?.sleep_time || '', water_intake_per_day: a?.water_intake_per_day || '',
      activity_level: a?.activity_level || '',
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
      // Enum fields: backend rejects '' since it must match the enum exactly if present
      ['gender', 'activity_level', 'stress_level'].forEach((k) => {
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

  const openAddNote = () => {
    setNoteEditTarget(null);
    setNoteTitleInput('');
    setNoteDescInput('');
    setShowNoteModal(true);
  };

  const openEditNote = (note: { id: string; title: string | null; content: string }) => {
    setNoteEditTarget(note);
    setNoteTitleInput(note.title || '');
    setNoteDescInput(note.content || '');
    setShowNoteModal(true);
  };

  const handleSaveNote = async () => {
    if (!id || !noteTitleInput.trim()) return;
    if (noteEditTarget) {
      await clientApi.updateNote(id, noteEditTarget.id, noteTitleInput.trim(), noteDescInput.trim() || undefined);
      setToast('Note updated');
    } else {
      await clientApi.addNote(id, noteTitleInput.trim(), noteDescInput.trim() || undefined);
      setToast('Note added');
    }
    setShowNoteModal(false);
    setNoteEditTarget(null);
    load(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!id) return;
    await clientApi.deleteNote(id, noteId);
    setToast('Note deleted');
    load(true);
  };

  function truncateNote(text: string): string {
    if (!text) return '—';
    const words = text.trim().split(/\s+/);
    if (words.length > 5) return words.slice(0, 5).join(' ') + '...';
    if (text.length > 20) return text.slice(0, 20) + '...';
    return text;
  }

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    await clientApi.updateStatus(id, status);
    setToast('Status updated');
    load();
  };

  if (loading) return <div className="text-center text-slate-400 py-12 text-sm">Loading client profile...</div>;
  if (error && !profile) return <div className="text-center text-red-500 py-12 text-sm">{error}</div>;
  if (!profile) return null;

  const { client: c, assessment: a, medical_history: m, notes, progress_photos, lab_reports, timeline, tags } = profile;

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
        {tab !== 'Progress' && tab !== 'Diet Plan' && tab !== 'Appointments' && tab !== 'Notes' && tab !== 'Timeline' && (
          <button onClick={startEdit} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700">Edit</button>
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Client</h3>
              <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          <Section title="Personal & Goal Info">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name"><TextInput value={form.first_name} onChange={(e) => set({ first_name: capFirst(e.target.value) })} /></Field>
              <Field label="Last Name"><TextInput value={form.last_name} onChange={(e) => set({ last_name: capFirst(e.target.value) })} /></Field>
              <Field label="Phone Number"><TextInput value={form.phone_number} onChange={(e) => set({ phone_number: e.target.value })} /></Field>
              <Field label="Email"><TextInput value={form.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Gender"><Select options={['Male', 'Female', 'Other']} value={form.gender || ''} onChange={(e) => set({ gender: e.target.value })} /></Field>
              <Field label="Date of Birth"><TextInput type="date" value={form.date_of_birth || ''} onChange={(e) => set({ date_of_birth: e.target.value })} /></Field>
              <Field label="Occupation"><TextInput value={form.occupation || ''} onChange={(e) => set({ occupation: capFirst(e.target.value) })} /></Field>
              <Field label="City"><TextInput value={form.city || ''} onChange={(e) => set({ city: capFirst(e.target.value) })} /></Field>
              <Field label="Primary Goal"><Select options={GOAL_OPTIONS} value={form.primary_goal || ''} onChange={(e) => set({ primary_goal: e.target.value })} /></Field>
              {form.primary_goal === 'Other' && (
                <Field label="Specify Goal"><TextInput value={form.specify_goal || ''} onChange={(e) => set({ specify_goal: capFirst(e.target.value) })} /></Field>
              )}
            </div>
          </Section>
          <Section title="Anthropometric & Nutrition">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Height (cm)"><TextInput type="number" value={form.height_cm ?? ''} onChange={(e) => set({ height_cm: e.target.value })} /></Field>
              <Field label="Current Weight (kg)"><TextInput type="number" value={form.current_weight_kg ?? ''} onChange={(e) => set({ current_weight_kg: e.target.value })} /></Field>
              <Field label="Wake Up Time"><TextInput type="time" value={form.wake_up_time || ''} onChange={(e) => set({ wake_up_time: e.target.value })} /></Field>
              <Field label="Sleep Time"><TextInput type="time" value={form.sleep_time || ''} onChange={(e) => set({ sleep_time: e.target.value })} /></Field>
              <Field label="Water Intake Per Day">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  min={0}
                  placeholder="e.g. 2.5"
                  value={waterNumberOnly(form.water_intake_per_day)}
                  onChange={(e) => {
                    const num = e.target.value;
                    set({ water_intake_per_day: num === '' ? '' : `${num} L` });
                  }}
                />
              </Field>
              <Field label="Food Preference"><Select options={DIET_TYPES} value={form.diet_type || ''} onChange={(e) => set({ diet_type: e.target.value })} /></Field>
              {form.diet_type === 'Other' && (
                <Field label="Specify Food Preference"><TextInput value={form.specify_diet_type || ''} onChange={(e) => set({ specify_diet_type: capFirst(e.target.value) })} /></Field>
              )}
              <Field label="Activity Level"><Select options={ACTIVITY_LEVELS} value={form.activity_level || ''} onChange={(e) => set({ activity_level: e.target.value })} /></Field>
              <Field label="Client Likes to Eat"><TextInput value={form.food_preferences || ''} onChange={(e) => set({ food_preferences: capFirst(e.target.value) })} /></Field>
              <Field label="Client Doesn't Like to Eat"><TextInput value={form.disliked_foods || ''} onChange={(e) => set({ disliked_foods: capFirst(e.target.value) })} /></Field>
              <Field label="Notes" className="col-span-2"><TextArea rows={2} value={form.lifestyle_notes || ''} onChange={(e) => set({ lifestyle_notes: capFirst(e.target.value) })} /></Field>
            </div>
          </Section>
          <Section title="Medical History">
            <div className="space-y-4">
              <Field label="Conditions"><MultiSelectPills options={MEDICAL_CONDITIONS} selected={form.conditions || []} onChange={(v) => set({ conditions: v })} /></Field>
              {(form.conditions || []).includes('Other') && (
                <Field label="Specify Condition"><TextInput value={form.specify_condition || ''} onChange={(e) => set({ specify_condition: capFirst(e.target.value) })} /></Field>
              )}
              <Field label="Current Medications"><TextArea rows={2} value={form.current_medications || ''} onChange={(e) => set({ current_medications: capFirst(e.target.value) })} /></Field>
              <Field label="Family Medical History"><TextArea rows={2} value={form.family_medical_history || ''} onChange={(e) => set({ family_medical_history: capFirst(e.target.value) })} /></Field>
              <Field label="Medical Notes"><TextArea rows={2} value={form.medical_notes || ''} onChange={(e) => set({ medical_notes: capFirst(e.target.value) })} /></Field>
            </div>
          </Section>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'Progress' && (
        <>
          <ProgressPhotosSection clientId={id!} photos={progress_photos} onChanged={() => { setToast('Photos updated'); load(true); }} />
        </>
      )}

      {tab === 'Appointments' && (
        <>
          <ClientAppointmentsSection clientId={id!} clientName={`${c.first_name} ${c.last_name}`} onChanged={() => load(true)} />
        </>
      )}

      {tab === 'Diet Plan' && (
        <ClientDietPlanSection
          clientId={id!}
          clientName={`${c.first_name} ${c.last_name}`}
          clientGoal={c.primary_goal || ''}
          onGoalChanged={(goal) => {
            setProfile((prev) => (prev ? { ...prev, client: { ...prev.client, primary_goal: goal } } : prev));
          }}
          onChanged={() => load(true)}
        />
      )}

      {tab === 'Timeline' && <TimelineSection events={timeline} onNavigate={(t) => setTab(t as Tab)} />}

      {tab === 'Notes' && (
        <>
          <ClientTagsEditor clientId={id!} tags={tags || []} onChanged={() => load(true)} />

          <div className="flex items-center justify-between mb-4 mt-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Private Dietitian Notes</h4>
            <button
              onClick={openAddNote}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
            >
              Add Note
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No notes yet. Click "Add Note" to create one.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium whitespace-nowrap">{n.title || 'Untitled'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{truncateNote(n.content || '')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setNoteViewTarget(n)}
                            title="View"
                            aria-label="View note"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditNote(n)}
                            title="Edit"
                            aria-label="Edit note"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            title="Delete"
                            aria-label="Delete note"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500"
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {showNoteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  {noteEditTarget ? 'Edit Note' : 'Add Note'}
                </h3>
                <div className="space-y-4">
                  <Field label="Title">
                    <TextInput placeholder="Note title" value={noteTitleInput} onChange={(e) => setNoteTitleInput(e.target.value)} />
                  </Field>
                  <Field label="Description">
                    <TextArea rows={4} placeholder="Add details..." value={noteDescInput} onChange={(e) => setNoteDescInput(e.target.value)} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => { setShowNoteModal(false); setNoteEditTarget(null); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteTitleInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {noteViewTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md relative overflow-hidden ring-4 ring-teal-100 dark:ring-teal-500/20">
                <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-teal-400" />

                <div className="p-6">
                  <button
                    onClick={() => setNoteViewTarget(null)}
                    title="Close"
                    aria-label="Close"
                    className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-3 mb-5 pr-8">
                    <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">Note</p>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{noteViewTarget.title || 'Untitled'}</h3>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 mb-4">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wide">Created</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {new Date(noteViewTarget.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5m-9 8h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v13a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wide">Description</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {noteViewTarget.content || 'No description added for this note.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                  <button
                    onClick={() => { openEditNote(noteViewTarget); setNoteViewTarget(null); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => { handleDeleteNote(noteViewTarget.id); setNoteViewTarget(null); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1.5 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}