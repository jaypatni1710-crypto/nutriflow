import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../../lib/client.api';
import { ClientFormData, DuplicateMatch } from '../../types/client.types';
import { Field, TextInput, TextArea, Select, MultiSelectPills, NumberPickerInput } from './FormFields';
import { MEDICAL_CONDITIONS, STRESS_LEVELS, ACTIVITY_LEVELS, STEP_LABELS } from '../../lib/clientOptions';
import { DuplicateModal } from './ClientExtras';

const TOTAL_STEPS = 3;
const HEIGHT_SUGGESTIONS = Array.from({ length: 13 }, (_, i) => 140 + i * 5); // 140..200
const WEIGHT_SUGGESTIONS = Array.from({ length: 19 }, (_, i) => 40 + i * 5); // 40..130

function calcAgeFromDob(dob?: string): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function calcBmi(heightCm?: number | string, weightKg?: number | string): { bmi: number; category: string; color: string } | null {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w) return null;
  const meters = h / 100;
  const bmi = w / (meters * meters);
  if (!isFinite(bmi) || bmi <= 0) return null;
  let category = 'Normal';
  let color = 'text-teal-600 bg-teal-50 border-teal-200';
  if (bmi < 18.5) { category = 'Underweight'; color = 'text-amber-600 bg-amber-50 border-amber-200'; }
  else if (bmi < 25) { category = 'Normal'; color = 'text-teal-600 bg-teal-50 border-teal-200'; }
  else if (bmi < 30) { category = 'Overweight'; color = 'text-orange-600 bg-orange-50 border-orange-200'; }
  else { category = 'Obese'; color = 'text-red-600 bg-red-50 border-red-200'; }
  return { bmi: Math.round(bmi * 10) / 10, category, color };
}

export function AddClientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ClientFormData>({ first_name: '', last_name: '', phone_number: '', secondary_goals: [], conditions: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  const set = (patch: Partial<ClientFormData>) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!form.first_name || !form.last_name || !form.phone_number) return 'Please fill all required fields.';
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return 'Please enter a valid email address.';
    }
    if (step === 2) {
      if (form.height_cm && (Number(form.height_cm) <= 0 || Number(form.height_cm) > 250)) return 'Please enter a valid height (cm).';
      if (form.current_weight_kg && (Number(form.current_weight_kg) <= 0 || Number(form.current_weight_kg) > 400)) return 'Please enter a valid weight (kg).';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const doCreate = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload: any = { ...form };
      ['target_weight', 'height_cm', 'current_weight_kg', 'goal_weight_kg', 'waist_cm', 'hip_cm', 'chest_cm', 'neck_cm'].forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });
      if (!payload.email) delete payload.email;
      await clientApi.create(payload);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to save client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await clientApi.checkDuplicate(form.phone_number, form.whatsapp_number, form.email);
      if (res.data.length > 0) {
        setDuplicates(res.data);
        setSubmitting(false);
        return;
      }
    } catch {
      // if check fails, proceed
    }
    setSubmitting(false);
    await doCreate();
  };

  const age = calcAgeFromDob(form.date_of_birth);
  const bmiResult = calcBmi(form.height_cm, form.current_weight_kg);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Client</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Step {step} of {TOTAL_STEPS}: {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="px-6 pt-3">
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">{error}</div>}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required>
                <TextInput value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} />
              </Field>
              <Field label="Last Name" required>
                <TextInput value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} />
              </Field>
              <Field label="Phone Number" required>
                <TextInput type="tel" value={form.phone_number} onChange={(e) => set({ phone_number: e.target.value })} />
              </Field>
              <Field label="Email">
                <TextInput type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Gender">
                <Select options={['Male', 'Female', 'Other']} value={form.gender || ''} onChange={(e) => set({ gender: e.target.value })} />
              </Field>
              <Field label="Date Of Birth">
                <TextInput type="date" max={new Date().toISOString().split('T')[0]} value={form.date_of_birth || ''} onChange={(e) => set({ date_of_birth: e.target.value })} />
              </Field>
              <Field label="Age">
                <TextInput value={age ?? ''} readOnly className="opacity-70" />
              </Field>
              <Field label="Occupation">
                <TextInput value={form.occupation || ''} onChange={(e) => set({ occupation: e.target.value })} />
              </Field>
              <Field label="City">
                <TextInput value={form.city || ''} onChange={(e) => set({ city: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Height (cm)">
                  <NumberPickerInput id="height-list" value={form.height_cm} min={50} max={250} step={0.5} suggestions={HEIGHT_SUGGESTIONS} onChange={(v) => set({ height_cm: v })} />
                </Field>
                <Field label="Weight (kg)">
                  <NumberPickerInput id="weight-list" value={form.current_weight_kg} min={10} max={400} step={0.1} suggestions={WEIGHT_SUGGESTIONS} onChange={(v) => set({ current_weight_kg: v })} />
                </Field>
              </div>

              {bmiResult && (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">BMI</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{bmiResult.bmi}</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${bmiResult.color}`}>{bmiResult.category}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Wake Up Time">
                  <TextInput type="time" value={form.wake_up_time || ''} onChange={(e) => set({ wake_up_time: e.target.value })} />
                </Field>
                <Field label="Sleep Time">
                  <TextInput type="time" value={form.sleep_time || ''} onChange={(e) => set({ sleep_time: e.target.value })} />
                </Field>
                <Field label="Water Intake Per Day">
                  <TextInput placeholder="e.g. 2.5 L" value={form.water_intake_per_day || ''} onChange={(e) => set({ water_intake_per_day: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Stress Level">
                  <Select options={STRESS_LEVELS} value={form.stress_level || ''} onChange={(e) => set({ stress_level: e.target.value })} />
                </Field>
                <Field label="Activity Level">
                  <Select options={ACTIVITY_LEVELS} value={form.activity_level || ''} onChange={(e) => set({ activity_level: e.target.value })} />
                </Field>
              </div>
              <Field label="Medical Conditions">
                <MultiSelectPills options={MEDICAL_CONDITIONS} selected={form.conditions || []} onChange={(v) => set({ conditions: v })} />
              </Field>
              {(form.conditions || []).includes('Other') && (
                <Field label="Specify Condition">
                  <TextInput value={form.specify_condition || ''} onChange={(e) => set({ specify_condition: e.target.value })} />
                </Field>
              )}
              <Field label="Current Medications">
                <TextArea rows={2} value={form.current_medications || ''} onChange={(e) => set({ current_medications: e.target.value })} />
              </Field>
              <Field label="Family Medical History">
                <TextArea rows={2} value={form.family_medical_history || ''} onChange={(e) => set({ family_medical_history: e.target.value })} />
              </Field>
              <Field label="Medical Notes">
                <TextArea rows={2} value={form.medical_notes || ''} onChange={(e) => set({ medical_notes: e.target.value })} />
              </Field>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={step === 1 ? onClose : back}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < TOTAL_STEPS ? (
            <button onClick={next} className="px-5 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors">
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Client'}
            </button>
          )}
        </div>
      </div>
    </div>

    {duplicates.length > 0 && (
      <DuplicateModal
        matches={duplicates}
        onViewExisting={(id) => { onClose(); navigate(`/dashboard/clients/${id}`); }}
        onContinue={() => { setDuplicates([]); doCreate(); }}
        onCancel={() => setDuplicates([])}
      />
    )}
    </>
  );
}
