import { ClientFullProfile } from '../types/client.types';

export interface CompletionResult {
  percent: number;
  completed: number;
  total: number;
  missing: string[];
}

// Feature 2: Assessment Completion Indicator
export function calcCompletion(profile: ClientFullProfile): CompletionResult {
  const { client: c, assessment: a, medical_history: m, food_frequency, lab_reports, progress_photos, notes } = profile;

  const sections: { name: string; done: boolean }[] = [
    { name: 'Basic Information', done: !!(c.gender && c.date_of_birth && c.occupation && c.city) },
    { name: 'Medical History', done: !!(m && (m.conditions?.length || m.current_medications || m.medical_notes)) },
    { name: 'Assessment', done: !!(a && a.height_cm && a.current_weight_kg) },
    { name: 'Lifestyle', done: !!(a && a.activity_level && a.stress_level && a.wake_up_time && a.sleep_time) },
    { name: 'Nutrition Assessment', done: !!(a && a.diet_type && (a.food_preferences || a.food_allergies)) },
    { name: 'Food Frequency Questionnaire', done: food_frequency.length > 0 },
    { name: 'Lab Reports', done: lab_reports.length > 0 },
    { name: 'Progress Photos', done: progress_photos.length > 0 },
    { name: 'Notes', done: notes.length > 0 },
  ];

  const completed = sections.filter((s) => s.done).length;
  return {
    percent: Math.round((completed / sections.length) * 100),
    completed,
    total: sections.length,
    missing: sections.filter((s) => !s.done).map((s) => s.name),
  };
}
