export interface ClientListItem {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string | null;
  primary_goal: string | null;
  diet_type: string | null;
  status: 'active' | 'inactive' | 'completed' | 'on_hold';
  is_archived: boolean;
  archived_at: string | null;
  updated_at: string;
  current_weight_kg: number | null;
  bmi: number | null;
  bmi_category: string | null;
  tags: string[];
}

export interface ClientListResponse {
  success: boolean;
  data: ClientListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Client {
  id: string;
  dietitian_id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  occupation: string | null;
  city: string | null;
  address: string | null;
  primary_goal: string | null;
  specify_goal: string | null;
  secondary_goals: string[];
  target_weight: number | null;
  target_date: string | null;
  status: 'active' | 'inactive' | 'completed' | 'on_hold';
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFoodFrequency {
  id: string;
  client_id: string;
  fruits: string | null;
  vegetables: string | null;
  dairy_products: string | null;
  fast_food: string | null;
  sweets: string | null;
  sugary_drinks: string | null;
  tea_coffee: string | null;
  fried_foods: string | null;
  bakery_products: string | null;
  packaged_foods: string | null;
  created_at: string;
}

export interface ClientProgressPhoto {
  id: string;
  client_id: string;
  view_type: 'Front' | 'Side' | 'Back';
  file_path: string;
  original_filename: string;
  uploaded_at: string;
}

export interface ClientTimelineEvent {
  id: string;
  client_id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export interface ClientAssessment {
  client_id: string;
  height_cm: number | null;
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  neck_cm: number | null;
  bmi: number | null;
  bmi_category: string | null;
  bmr: number | null;
  daily_calories: number | null;
  daily_protein: number | null;
  ideal_weight_min: number | null;
  ideal_weight_max: number | null;
  diet_type: string | null;
  specify_diet_type: string | null;
  food_preferences: string | null;
  disliked_foods: string | null;
  food_allergies: string | null;
  food_intolerances: string | null;
  wake_up_time: string | null;
  sleep_time: string | null;
  water_intake_per_day: string | null;
  working_hours: string | null;
  stress_level: string | null;
  activity_level: string | null;
  exercise_routine: string | null;
  lifestyle_notes: string | null;
  recall_breakfast: string | null;
  recall_lunch: string | null;
  recall_dinner: string | null;
  recall_snacks: string | null;
  recall_tea_coffee: string | null;
  recall_water: string | null;
}

export interface ClientMedicalHistory {
  client_id: string;
  conditions: string[];
  specify_condition: string | null;
  current_medications: string | null;
  family_medical_history: string | null;
  medical_notes: string | null;
}

export interface ClientProgressLog {
  id: string;
  client_id: string;
  weight_kg: number | null;
  bmi: number | null;
  waist_cm: number | null;
  logged_at: string;
}

export interface ClientLabReport {
  id: string;
  client_id: string;
  report_type: string;
  file_path: string;
  original_filename: string;
  uploaded_at: string;
  uploaded_by?: string | null;
}

export interface ClientNote {
  id: string;
  client_id: string;
  dietitian_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ClientCommunication {
  id: string;
  client_id: string;
  dietitian_id: string;
  type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateMatch {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  email: string | null;
}

export interface ClientFullProfile {
  client: Client;
  assessment: ClientAssessment | null;
  medical_history: ClientMedicalHistory | null;
  progress_logs: ClientProgressLog[];
  lab_reports: ClientLabReport[];
  notes: ClientNote[];
  food_frequency: ClientFoodFrequency[];
  progress_photos: ClientProgressPhoto[];
  timeline: ClientTimelineEvent[];
  communications: ClientCommunication[];
  tags: string[];
}

export interface ClientFormData {
  first_name: string;
  last_name: string;
  phone_number: string;
  whatsapp_number?: string;
  email?: string;
  gender?: string;
  date_of_birth?: string;
  occupation?: string;
  city?: string;
  address?: string;

  primary_goal?: string;
  specify_goal?: string;
  secondary_goals?: string[];
  target_weight?: number | string;
  target_date?: string;
  status?: 'active' | 'inactive' | 'completed' | 'on_hold';

  height_cm?: number | string;
  current_weight_kg?: number | string;
  goal_weight_kg?: number | string;
  waist_cm?: number | string;
  hip_cm?: number | string;
  chest_cm?: number | string;
  neck_cm?: number | string;

  conditions?: string[];
  specify_condition?: string;
  current_medications?: string;
  family_medical_history?: string;
  medical_notes?: string;

  diet_type?: string;
  specify_diet_type?: string;
  food_preferences?: string;
  disliked_foods?: string;
  food_allergies?: string;
  food_intolerances?: string;

  wake_up_time?: string;
  sleep_time?: string;
  water_intake_per_day?: string;
  working_hours?: string;
  stress_level?: string;
  activity_level?: string;
  exercise_routine?: string;
  lifestyle_notes?: string;

  recall_breakfast?: string;
  recall_lunch?: string;
  recall_dinner?: string;
  recall_snacks?: string;
  recall_tea_coffee?: string;
  recall_water?: string;
}