import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '../../lib/client.api';
import { ClientFormData, DuplicateMatch } from '../../types/client.types';
import { Field, TextInput, TextArea, Select, MultiSelectPills, NumberPickerInput } from './FormFields';
import { MEDICAL_CONDITIONS, ACTIVITY_LEVELS, STEP_LABELS, DIET_TYPES, GOAL_OPTIONS } from '../../lib/clientOptions';
import { DuplicateModal } from './ClientExtras';

const TOTAL_STEPS = 3;
const HEIGHT_SUGGESTIONS = Array.from({ length: 13 }, (_, i) => 140 + i * 5); // 140..200
const WEIGHT_SUGGESTIONS = Array.from({ length: 19 }, (_, i) => 40 + i * 5); // 40..130
const ADMIN_CONTACT = { phone: '7874994587', email: 'jd.software2025@gmail.com' };

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

// Strips the auto-appended " L" so the raw number can be edited
function waterNumberOnly(v?: string | null): string {
  if (!v) return '';
  const match = v.match(/[\d.]+/);
  return match ? match[0] : '';
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
      if (!/^\d{10}$/.test(form.phone_number)) return 'Phone number must be exactly 10 digits.';
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
  const isClientLimitError = /client limit reached/i.test(error);

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

          {error && (
            isClientLimitError ? (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm">
                <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
                <p className="text-red-500 dark:text-red-400/80 mt-1.5">
                  Contact your admin to increase your client limit:
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <a
                    href={`tel:${ADMIN_CONTACT.phone}`}
                    className="inline-flex items-center gap-1.5 w-fit text-red-700 dark:text-red-300 font-medium hover:underline"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h1.5a1.5 1.5 0 001.5-1.5v-2.14a1.5 1.5 0 00-1.207-1.472l-3.13-.626a1.5 1.5 0 00-1.51.44l-.943.943a1.5 1.5 0 01-1.628.34 12.09 12.09 0 01-5.62-5.62a1.5 1.5 0 01.34-1.628l.942-.943a1.5 1.5 0 00.441-1.51l-.627-3.129A1.5 1.5 0 006.42 2.25H4.5a1.5 1.5 0 00-1.5 1.5v3z" />
                    </svg>
                    {ADMIN_CONTACT.phone}
                  </a>
                  <a
                    href={`mailto:${ADMIN_CONTACT.email}`}
                    className="inline-flex items-center gap-1.5 w-fit text-red-700 dark:text-red-300 font-medium hover:underline"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0a2.25 2.25 0 00-2.25-2.25h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {ADMIN_CONTACT.email}
                  </a>
                </div>
              </div>
            ) : (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">{error}</div>
            )
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required>
                <TextInput value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} />
              </Field>
              <Field label="Last Name" required>
                <TextInput value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} />
              </Field>
              <Field label="Phone Number" required>
                <TextInput
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10 digit number"
                  value={form.phone_number}
                  onChange={(e) => set({ phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
              </Field>
              <Field label="Email">
                <TextInput type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Gender">
                <Select options={['Male', 'Female', 'Other']} value={form.gender || ''} onChange={(e) => set({ gender: e.target.value })} />
              </Field>
              <Field label="Occupation">
                <TextInput value={form.occupation || ''} onChange={(e) => set({ occupation: e.target.value })} />
              </Field>
              <Field label="Date Of Birth">
                <TextInput type="date" max={new Date().toISOString().split('T')[0]} value={form.date_of_birth || ''} onChange={(e) => set({ date_of_birth: e.target.value })} />
              </Field>
              <Field label="Age">
                <TextInput value={age ?? ''} readOnly className="opacity-70" />
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
                <Field label="Food Preference">
                  <Select options={DIET_TYPES} value={form.diet_type || ''} onChange={(e) => set({ diet_type: e.target.value })} />
                </Field>
              </div>

              {form.diet_type === 'Other' && (
                <Field label="Specify Food Preference">
                  <TextInput value={form.specify_diet_type || ''} onChange={(e) => set({ specify_diet_type: e.target.value })} />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4 items-end">
                <Field label="Goal">
                  <Select options={GOAL_OPTIONS} value={form.primary_goal || ''} onChange={(e) => set({ primary_goal: e.target.value })} />
                </Field>
                {form.primary_goal === 'Other' && (
                  <Field label="Specify Goal">
                    <TextInput value={form.specify_goal || ''} onChange={(e) => set({ specify_goal: e.target.value })} />
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Client Likes to Eat">
                  <TextInput value={form.food_preferences || ''} onChange={(e) => set({ food_preferences: e.target.value })} placeholder="e.g. Paneer, Fruits, Khichdi" />
                </Field>
                <Field label="Client Doesn't Like to Eat">
                  <TextInput value={form.disliked_foods || ''} onChange={(e) => set({ disliked_foods: e.target.value })} placeholder="e.g. Bitter gourd, Fish" />
                </Field>
              </div>

              <Field label="Notes (optional)">
                <TextArea rows={2} value={form.lifestyle_notes || ''} onChange={(e) => set({ lifestyle_notes: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              <Field label="Medical Notes (optional)">
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
              disabled={submitting || isClientLimitError}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Saving...' : isClientLimitError ? 'Limit Reached' : 'Save Client'}
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