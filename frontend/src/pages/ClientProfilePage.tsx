import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { clientApi } from '../lib/client.api';
import { ClientFullProfile, ClientFormData } from '../types/client.types';
import { Field, TextInput, TextArea, Select, MultiSelectPills } from '../components/clients/FormFields';
import { GOAL_OPTIONS, MEDICAL_CONDITIONS, DIET_TYPES, STRESS_LEVELS, ACTIVITY_LEVELS, LAB_REPORT_TYPES } from '../lib/clientOptions';
import { Toast } from '../components/clients/Toast';
import { StatusBadge, StatusSelector, GoalProgressBar, FoodFrequencySection, ProgressPhotosSection, TimelineSection } from '../components/clients/Enhancements';
import { CommunicationLog } from '../components/clients/CommunicationLog';
import { ClientTagsEditor } from '../components/clients/ClientTags';
import { AssessmentCompletionBar, EnhancedSummaryCard } from '../components/clients/ClientExtras';

const TABS = ['Overview', 'Assessment', 'Medical History', 'Lab Reports', 'Progress', 'Communication', 'Notes', 'Timeline'] as const;
type Tab = typeof TABS[number];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-4">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-white font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ClientFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('Overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClientFormData>({} as ClientFormData);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [reportType, setReportType] = useState(LAB_REPORT_TYPES[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [newNote, setNewNote] = useState('');
  const [labFilter, setLabFilter] = useState('');
  const [labSort, setLabSort] = useState<'newest' | 'oldest'>('newest');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await clientApi.get(id);
      setProfile(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    if (!profile) return;
    const { client: c, assessment: a, medical_history: m } = profile;
    setForm({
      first_name: c.first_name, last_name: c.last_name, phone_number: c.phone_number,
      whatsapp_number: c.whatsapp_number || '', email: c.email || '', gender: c.gender || '',
      date_of_birth: c.date_of_birth || '', occupation: c.occupation || '', city: c.city || '', address: c.address || '',
      primary_goal: c.primary_goal || '', specify_goal: c.specify_goal || '', secondary_goals: c.secondary_goals || [],
      target_weight: c.target_weight ?? '', target_date: c.target_date || '',
      height_cm: a?.height_cm ?? '', current_weight_kg: a?.current_weight_kg ?? '', goal_weight_kg: a?.goal_weight_kg ?? '',
      waist_cm: a?.waist_cm ?? '', hip_cm: a?.hip_cm ?? '', chest_cm: a?.chest_cm ?? '', neck_cm: a?.neck_cm ?? '',
      conditions: m?.conditions || [], specify_condition: m?.specify_condition || '', current_medications: m?.current_medications || '',
      family_medical_history: m?.family_medical_history || '', medical_notes: m?.medical_notes || '',
      diet_type: a?.diet_type || '', specify_diet_type: a?.specify_diet_type || '', food_preferences: a?.food_preferences || '',
      disliked_foods: a?.disliked_foods || '', food_allergies: a?.food_allergies || '', food_intolerances: a?.food_intolerances || '',
      wake_up_time: a?.wake_up_time || '', sleep_time: a?.sleep_time || '', water_intake_per_day: a?.water_intake_per_day || '',
      working_hours: a?.working_hours || '', stress_level: a?.stress_level || '', activity_level: a?.activity_level || '',
      exercise_routine: a?.exercise_routine || '', lifestyle_notes: a?.lifestyle_notes || '',
      recall_breakfast: a?.recall_breakfast || '', recall_lunch: a?.recall_lunch || '', recall_dinner: a?.recall_dinner || '',
      recall_snacks: a?.recall_snacks || '', recall_tea_coffee: a?.recall_tea_coffee || '', recall_water: a?.recall_water || '',
    });
    setEditing(true);
  };

  const set = (patch: Partial<ClientFormData>) => setForm((f) => ({ ...f, ...patch }));

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      ['target_weight', 'height_cm', 'current_weight_kg', 'goal_weight_kg', 'waist_cm', 'hip_cm', 'chest_cm', 'neck_cm'].forEach((k) => {
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

  const handleUpload = async () => {
    if (!id || !uploadFile) return;
    try {
      await clientApi.uploadLabReport(id, reportType, uploadFile);
      setUploadFile(null);
      setToast('Report uploaded');
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload report');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!id) return;
    await clientApi.deleteLabReport(id, reportId);
    setToast('Report deleted');
    load();
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

  const handleArchive = async () => {
    if (!id) return;
    await clientApi.archiveClient(id);
    setToast('Client archived');
    load();
  };

  const handleRestore = async () => {
    if (!id) return;
    await clientApi.restoreClient(id);
    setToast('Client restored');
    load();
  };

  if (loading) return <div className="text-center text-slate-400 py-12 text-sm">Loading client profile...</div>;
  if (error && !profile) return <div className="text-center text-red-500 py-12 text-sm">{error}</div>;
  if (!profile) return null;

  const { client: c, assessment: a, medical_history: m, progress_logs, lab_reports, notes, food_frequency, progress_photos, timeline, communications, tags } = profile;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/clients')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">←</button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {c.first_name} {c.last_name} <StatusBadge status={c.status} />
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.phone_number} · {c.primary_goal || 'No goal set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelector status={c.status} onChange={handleStatusChange} />
          {!c.is_archived ? (
            <button onClick={handleArchive} className="px-3 py-2 rounded-lg text-xs font-semibold text-amber-600 border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10">Archive</button>
          ) : (
            <button onClick={handleRestore} className="px-3 py-2 rounded-lg text-xs font-semibold text-emerald-600 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">Restore</button>
          )}
        {!editing && tab !== 'Lab Reports' && tab !== 'Progress' && tab !== 'Notes' && tab !== 'Timeline' && tab !== 'Communication' && (
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
            <Row label="WhatsApp" value={c.whatsapp_number} />
            <Row label="Gender" value={c.gender} />
            <Row label="Date of Birth" value={c.date_of_birth} />
            <Row label="Occupation" value={c.occupation} />
            <Row label="City" value={c.city} />
            <Row label="Address" value={c.address} />
          </Section>
          <Section title="Goal Information">
            <Row label="Primary Goal" value={c.primary_goal} />
            {c.primary_goal === 'Other' && <Row label="Specify Goal" value={c.specify_goal} />}
            <Row label="Secondary Goals" value={c.secondary_goals?.join(', ')} />
            <Row label="Target Weight" value={c.target_weight ? `${c.target_weight} kg` : null} />
            <Row label="Target Date" value={c.target_date} />
            <div className="mt-3">
              <GoalProgressBar start={progress_logs[0]?.weight_kg ?? null} current={a?.current_weight_kg ?? null} goal={c.target_weight ?? null} />
            </div>
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
            <Row label="Goal Weight" value={a?.goal_weight_kg ? `${a.goal_weight_kg} kg` : null} />
            <Row label="Waist" value={a?.waist_cm ? `${a.waist_cm} cm` : null} />
            <Row label="Hip" value={a?.hip_cm ? `${a.hip_cm} cm` : null} />
            <Row label="Chest" value={a?.chest_cm ? `${a.chest_cm} cm` : null} />
            <Row label="Neck" value={a?.neck_cm ? `${a.neck_cm} cm` : null} />
          </Section>
          <Section title="Nutrition Assessment">
            <Row label="Diet Type" value={a?.diet_type} />
            <Row label="Food Preferences" value={a?.food_preferences} />
            <Row label="Disliked Foods" value={a?.disliked_foods} />
            <Row label="Food Allergies" value={a?.food_allergies} />
            <Row label="Food Intolerances" value={a?.food_intolerances} />
          </Section>
          <Section title="Lifestyle Assessment">
            <Row label="Wake Up Time" value={a?.wake_up_time} />
            <Row label="Sleep Time" value={a?.sleep_time} />
            <Row label="Water Intake/Day" value={a?.water_intake_per_day} />
            <Row label="Working Hours" value={a?.working_hours} />
            <Row label="Stress Level" value={a?.stress_level} />
            <Row label="Activity Level" value={a?.activity_level} />
            <Row label="Exercise Routine" value={a?.exercise_routine} />
          </Section>
          <Section title="24 Hour Recall">
            <Row label="Breakfast" value={a?.recall_breakfast} />
            <Row label="Lunch" value={a?.recall_lunch} />
            <Row label="Dinner" value={a?.recall_dinner} />
            <Row label="Snacks" value={a?.recall_snacks} />
            <Row label="Tea/Coffee" value={a?.recall_tea_coffee} />
            <Row label="Water Intake" value={a?.recall_water} />
          </Section>
          <FoodFrequencySection clientId={id!} history={food_frequency} onSaved={() => { setToast('Food frequency saved'); load(); }} />
        </>
      )}

      {tab === 'Medical History' && !editing && (
        <Section title="Medical History">
          <Row label="Conditions" value={m?.conditions?.join(', ')} />
          {m?.conditions?.includes('Other') && <Row label="Specify Condition" value={m?.specify_condition} />}
          <Row label="Current Medications" value={m?.current_medications} />
          <Row label="Family Medical History" value={m?.family_medical_history} />
          <Row label="Medical Notes" value={m?.medical_notes} />
        </Section>
      )}

      {editing && (tab === 'Overview' || tab === 'Assessment' || tab === 'Medical History') && (
        <div className="space-y-4">
          <Section title="Personal & Goal Info">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name"><TextInput value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
              <Field label="Last Name"><TextInput value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
              <Field label="Phone Number"><TextInput value={form.phone_number} onChange={(e) => set({ phone_number: e.target.value })} /></Field>
              <Field label="WhatsApp"><TextInput value={form.whatsapp_number || ''} onChange={(e) => set({ whatsapp_number: e.target.value })} /></Field>
              <Field label="Email"><TextInput value={form.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Gender"><Select options={['Male', 'Female', 'Other']} value={form.gender || ''} onChange={(e) => set({ gender: e.target.value })} /></Field>
              <Field label="Date of Birth"><TextInput type="date" value={form.date_of_birth || ''} onChange={(e) => set({ date_of_birth: e.target.value })} /></Field>
              <Field label="Occupation"><TextInput value={form.occupation || ''} onChange={(e) => set({ occupation: e.target.value })} /></Field>
              <Field label="City"><TextInput value={form.city || ''} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="Address" className="col-span-2"><TextArea rows={2} value={form.address || ''} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="Primary Goal"><Select options={GOAL_OPTIONS} value={form.primary_goal || ''} onChange={(e) => set({ primary_goal: e.target.value })} /></Field>
              <Field label="Target Weight"><TextInput type="number" value={form.target_weight ?? ''} onChange={(e) => set({ target_weight: e.target.value })} /></Field>
              <Field label="Secondary Goals" className="col-span-2"><MultiSelectPills options={GOAL_OPTIONS.filter((g) => g !== 'Other')} selected={form.secondary_goals || []} onChange={(v) => set({ secondary_goals: v })} /></Field>
            </div>
          </Section>
          <Section title="Anthropometric & Nutrition">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Height (cm)"><TextInput type="number" value={form.height_cm ?? ''} onChange={(e) => set({ height_cm: e.target.value })} /></Field>
              <Field label="Current Weight (kg)"><TextInput type="number" value={form.current_weight_kg ?? ''} onChange={(e) => set({ current_weight_kg: e.target.value })} /></Field>
              <Field label="Goal Weight (kg)"><TextInput type="number" value={form.goal_weight_kg ?? ''} onChange={(e) => set({ goal_weight_kg: e.target.value })} /></Field>
              <Field label="Waist (cm)"><TextInput type="number" value={form.waist_cm ?? ''} onChange={(e) => set({ waist_cm: e.target.value })} /></Field>
              <Field label="Diet Type"><Select options={DIET_TYPES} value={form.diet_type || ''} onChange={(e) => set({ diet_type: e.target.value })} /></Field>
              <Field label="Activity Level"><Select options={ACTIVITY_LEVELS} value={form.activity_level || ''} onChange={(e) => set({ activity_level: e.target.value })} /></Field>
              <Field label="Stress Level"><Select options={STRESS_LEVELS} value={form.stress_level || ''} onChange={(e) => set({ stress_level: e.target.value })} /></Field>
              <Field label="Food Allergies"><TextInput value={form.food_allergies || ''} onChange={(e) => set({ food_allergies: e.target.value })} /></Field>
            </div>
          </Section>
          <Section title="Medical History">
            <div className="space-y-4">
              <Field label="Conditions"><MultiSelectPills options={MEDICAL_CONDITIONS} selected={form.conditions || []} onChange={(v) => set({ conditions: v })} /></Field>
              <Field label="Current Medications"><TextArea rows={2} value={form.current_medications || ''} onChange={(e) => set({ current_medications: e.target.value })} /></Field>
              <Field label="Family Medical History"><TextArea rows={2} value={form.family_medical_history || ''} onChange={(e) => set({ family_medical_history: e.target.value })} /></Field>
              <Field label="Medical Notes"><TextArea rows={2} value={form.medical_notes || ''} onChange={(e) => set({ medical_notes: e.target.value })} /></Field>
            </div>
          </Section>
        </div>
      )}

      {tab === 'Lab Reports' && (
        <>
          <Section title="Upload Report">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Report Type">
                <Select options={LAB_REPORT_TYPES} value={reportType} onChange={(e) => setReportType(e.target.value)} />
              </Field>
              <Field label="File (PDF, JPG, PNG)">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="text-sm text-slate-600 dark:text-slate-300" />
              </Field>
              <button onClick={handleUpload} disabled={!uploadFile} className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">Upload</button>
            </div>
          </Section>
          <Section title="Upload History">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Select options={LAB_REPORT_TYPES} value={labFilter} onChange={(e) => setLabFilter(e.target.value)} placeholder="All Types" />
              <select value={labSort} onChange={(e) => setLabSort(e.target.value as 'newest' | 'oldest')} className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                <option value="newest">Latest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
            {(() => {
              const filtered = lab_reports
                .filter((r) => !labFilter || r.report_type === labFilter)
                .slice()
                .sort((x, y) => labSort === 'newest'
                  ? new Date(y.uploaded_at).getTime() - new Date(x.uploaded_at).getTime()
                  : new Date(x.uploaded_at).getTime() - new Date(y.uploaded_at).getTime());
              if (filtered.length === 0) return <p className="text-sm text-slate-400">No lab reports found.</p>;
              return (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <span className="font-medium text-slate-900 dark:text-white">{r.report_type}</span>
                        <span className="text-slate-400 ml-2">{r.original_filename}</span>
                        <span className="text-slate-400 ml-2 text-xs">{new Date(r.uploaded_at).toLocaleDateString()}</span>
                      </div>
                      <div className="space-x-3">
                        <button onClick={() => clientApi.downloadLabReport(id!, r.id, r.original_filename)} className="text-teal-600 hover:text-teal-700 font-medium text-xs">Preview</button>
                        <button onClick={() => clientApi.downloadLabReport(id!, r.id, r.original_filename)} className="text-teal-600 hover:text-teal-700 font-medium text-xs">Download</button>
                        <button onClick={() => handleDeleteReport(r.id)} className="text-red-500 hover:text-red-600 font-medium text-xs">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>
        </>
      )}

      {tab === 'Progress' && (
        <>
          <Section title="Weight Trend">
            {progress_logs.length === 0 ? <p className="text-sm text-slate-400">No progress data yet.</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progress_logs.map((p) => ({ date: new Date(p.logged_at).toLocaleDateString(), weight: p.weight_kg }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Section>
          <Section title="BMI Trend">
            {progress_logs.length === 0 ? <p className="text-sm text-slate-400">No progress data yet.</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progress_logs.map((p) => ({ date: new Date(p.logged_at).toLocaleDateString(), bmi: p.bmi }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="bmi" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Section>
          <ProgressPhotosSection clientId={id!} photos={progress_photos} onChanged={() => { setToast('Photos updated'); load(); }} />
        </>
      )}

      {tab === 'Timeline' && <TimelineSection events={timeline} />}

      {tab === 'Communication' && (
        <>
          <CommunicationLog clientId={id!} entries={communications || []} onChanged={() => { setToast('Communication updated'); load(); }} />
        </>
      )}

      {tab === 'Notes' && (
        <>
          <ClientTagsEditor clientId={id!} tags={tags || []} onChanged={() => load()} />
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
