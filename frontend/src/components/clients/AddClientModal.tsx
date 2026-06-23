import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../../lib/client.api';
import { ClientFormData, DuplicateMatch } from '../../types/client.types';
import { Field, TextInput, TextArea, Select, MultiSelectPills } from './FormFields';
import { GOAL_OPTIONS, MEDICAL_CONDITIONS, DIET_TYPES, STRESS_LEVELS, ACTIVITY_LEVELS, STEP_LABELS } from '../../lib/clientOptions';
import { DuplicateModal } from './ClientExtras';

const TOTAL_STEPS = 7;

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
                <TextInput value={form.phone_number} onChange={(e) => set({ phone_number: e.target.value })} />
              </Field>
              <Field label="WhatsApp Number">
                <TextInput value={form.whatsapp_number || ''} onChange={(e) => set({ whatsapp_number: e.target.value })} />
              </Field>
              <Field label="Email">
                <TextInput type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Gender">
                <Select options={['Male', 'Female', 'Other']} value={form.gender || ''} onChange={(e) => set({ gender: e.target.value })} />
              </Field>
              <Field label="Date Of Birth">
                <TextInput type="date" value={form.date_of_birth || ''} onChange={(e) => set({ date_of_birth: e.target.value })} />
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
              <Field label="Address" className="col-span-2">
                <TextArea rows={2} value={form.address || ''} onChange={(e) => set({ address: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary Goal" className="col-span-2">
                <Select options={GOAL_OPTIONS} value={form.primary_goal || ''} onChange={(e) => set({ primary_goal: e.target.value })} />
              </Field>
              {form.primary_goal === 'Other' && (
                <Field label="Specify Goal" className="col-span-2">
                  <TextInput value={form.specify_goal || ''} onChange={(e) => set({ specify_goal: e.target.value })} />
                </Field>
              )}
              <Field label="Secondary Goals" className="col-span-2">
                <MultiSelectPills options={GOAL_OPTIONS.filter((g) => g !== 'Other')} selected={form.secondary_goals || []} onChange={(v) => set({ secondary_goals: v })} />
              </Field>
              <Field label="Target Weight (kg)">
                <TextInput type="number" value={form.target_weight ?? ''} onChange={(e) => set({ target_weight: e.target.value })} />
              </Field>
              <Field label="Target Date">
                <TextInput type="date" value={form.target_date || ''} onChange={(e) => set({ target_date: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Height (cm)">
                <TextInput type="number" value={form.height_cm ?? ''} onChange={(e) => set({ height_cm: e.target.value })} />
              </Field>
              <Field label="Current Weight (kg)">
                <TextInput type="number" value={form.current_weight_kg ?? ''} onChange={(e) => set({ current_weight_kg: e.target.value })} />
              </Field>
              <Field label="Goal Weight (kg)">
                <TextInput type="number" value={form.goal_weight_kg ?? ''} onChange={(e) => set({ goal_weight_kg: e.target.value })} />
              </Field>
              <Field label="Waist (cm)">
                <TextInput type="number" value={form.waist_cm ?? ''} onChange={(e) => set({ waist_cm: e.target.value })} />
              </Field>
              <Field label="Hip (cm)">
                <TextInput type="number" value={form.hip_cm ?? ''} onChange={(e) => set({ hip_cm: e.target.value })} />
              </Field>
              <Field label="Chest (cm)">
                <TextInput type="number" value={form.chest_cm ?? ''} onChange={(e) => set({ chest_cm: e.target.value })} />
              </Field>
              <Field label="Neck (cm)">
                <TextInput type="number" value={form.neck_cm ?? ''} onChange={(e) => set({ neck_cm: e.target.value })} />
              </Field>
              <p className="col-span-2 text-xs text-slate-400">BMI, BMR, calorie & protein targets, and ideal weight range are calculated automatically on save.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
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

          {step === 5 && (
            <div className="space-y-4">
              <Field label="Diet Type">
                <Select options={DIET_TYPES} value={form.diet_type || ''} onChange={(e) => set({ diet_type: e.target.value })} />
              </Field>
              {form.diet_type === 'Other' && (
                <Field label="Specify Diet Type">
                  <TextInput value={form.specify_diet_type || ''} onChange={(e) => set({ specify_diet_type: e.target.value })} />
                </Field>
              )}
              <Field label="Food Preferences">
                <TextArea rows={2} value={form.food_preferences || ''} onChange={(e) => set({ food_preferences: e.target.value })} />
              </Field>
              <Field label="Disliked Foods">
                <TextArea rows={2} value={form.disliked_foods || ''} onChange={(e) => set({ disliked_foods: e.target.value })} />
              </Field>
              <Field label="Food Allergies">
                <TextArea rows={2} value={form.food_allergies || ''} onChange={(e) => set({ food_allergies: e.target.value })} />
              </Field>
              <Field label="Food Intolerances">
                <TextArea rows={2} value={form.food_intolerances || ''} onChange={(e) => set({ food_intolerances: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 6 && (
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
              <Field label="Working Hours">
                <TextInput placeholder="e.g. 9 AM - 6 PM" value={form.working_hours || ''} onChange={(e) => set({ working_hours: e.target.value })} />
              </Field>
              <Field label="Stress Level">
                <Select options={STRESS_LEVELS} value={form.stress_level || ''} onChange={(e) => set({ stress_level: e.target.value })} />
              </Field>
              <Field label="Activity Level">
                <Select options={ACTIVITY_LEVELS} value={form.activity_level || ''} onChange={(e) => set({ activity_level: e.target.value })} />
              </Field>
              <Field label="Exercise Routine" className="col-span-2">
                <TextArea rows={2} value={form.exercise_routine || ''} onChange={(e) => set({ exercise_routine: e.target.value })} />
              </Field>
              <Field label="Additional Notes" className="col-span-2">
                <TextArea rows={2} value={form.lifestyle_notes || ''} onChange={(e) => set({ lifestyle_notes: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <Field label="Breakfast">
                <TextArea rows={2} value={form.recall_breakfast || ''} onChange={(e) => set({ recall_breakfast: e.target.value })} />
              </Field>
              <Field label="Lunch">
                <TextArea rows={2} value={form.recall_lunch || ''} onChange={(e) => set({ recall_lunch: e.target.value })} />
              </Field>
              <Field label="Dinner">
                <TextArea rows={2} value={form.recall_dinner || ''} onChange={(e) => set({ recall_dinner: e.target.value })} />
              </Field>
              <Field label="Snacks">
                <TextArea rows={2} value={form.recall_snacks || ''} onChange={(e) => set({ recall_snacks: e.target.value })} />
              </Field>
              <Field label="Tea/Coffee">
                <TextInput value={form.recall_tea_coffee || ''} onChange={(e) => set({ recall_tea_coffee: e.target.value })} />
              </Field>
              <Field label="Water Intake">
                <TextInput value={form.recall_water || ''} onChange={(e) => set({ recall_water: e.target.value })} />
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
