import { z } from 'zod';

export const createClientSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone_number: z.string().min(6).max(20),
  whatsapp_number: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  date_of_birth: z.string().optional(),
  occupation: z.string().max(150).optional(),
  city: z.string().max(150).optional(),
  address: z.string().optional(),

  primary_goal: z.string().max(50).optional(),
  specify_goal: z.string().max(255).optional(),
  secondary_goals: z.array(z.string()).optional(),
  target_weight: z.coerce.number().optional(),
  target_date: z.string().optional(),

  height_cm: z.coerce.number().optional(),
  current_weight_kg: z.coerce.number().optional(),
  goal_weight_kg: z.coerce.number().optional(),
  waist_cm: z.coerce.number().optional(),
  hip_cm: z.coerce.number().optional(),
  chest_cm: z.coerce.number().optional(),
  neck_cm: z.coerce.number().optional(),

  conditions: z.array(z.string()).optional(),
  specify_condition: z.string().max(255).optional(),
  current_medications: z.string().optional(),
  family_medical_history: z.string().optional(),
  medical_notes: z.string().optional(),

  diet_type: z.string().max(30).optional(),
  specify_diet_type: z.string().max(255).optional(),
  food_preferences: z.string().optional(),
  disliked_foods: z.string().optional(),
  food_allergies: z.string().optional(),
  food_intolerances: z.string().optional(),

  wake_up_time: z.string().max(10).optional(),
  sleep_time: z.string().max(10).optional(),
  water_intake_per_day: z.string().max(50).optional(),
  working_hours: z.string().max(50).optional(),
  stress_level: z.enum(['Low', 'Moderate', 'High']).optional(),
  activity_level: z.enum(['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Athlete']).optional(),
  exercise_routine: z.string().optional(),
  lifestyle_notes: z.string().optional(),

  recall_breakfast: z.string().optional(),
  recall_lunch: z.string().optional(),
  recall_dinner: z.string().optional(),
  recall_snacks: z.string().optional(),
  recall_tea_coffee: z.string().optional(),
  recall_water: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const createNoteSchema = z.object({
  content: z.string().min(1),
});

const freqEnum = z.enum(['Daily', '4-6 Times Per Week', '2-3 Times Per Week', 'Weekly', 'Monthly', 'Rarely', 'Never']);

export const foodFrequencySchema = z.object({
  fruits: freqEnum.optional(),
  vegetables: freqEnum.optional(),
  dairy_products: freqEnum.optional(),
  fast_food: freqEnum.optional(),
  sweets: freqEnum.optional(),
  sugary_drinks: freqEnum.optional(),
  tea_coffee: freqEnum.optional(),
  fried_foods: freqEnum.optional(),
  bakery_products: freqEnum.optional(),
  packaged_foods: freqEnum.optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['active', 'inactive', 'completed', 'on_hold']),
});

export const communicationSchema = z.object({
  type: z.enum(['WhatsApp Message', 'Diet Plan Shared', 'Follow-Up Reminder', 'Progress Report Shared', 'Consultation Summary', 'Payment Reminder', 'Custom Note']),
  description: z.string().max(2000).optional(),
});

export const tagSchema = z.object({
  tag: z.string().min(1).max(50),
});

export const duplicateCheckSchema = z.object({
  phone_number: z.string().optional(),
  whatsapp_number: z.string().optional(),
  email: z.string().optional(),
});

export const progressLogSchema = z.object({
  weight_kg: z.coerce.number().optional(),
  bmi: z.coerce.number().optional(),
  waist_cm: z.coerce.number().optional(),
  logged_at: z.string().optional(),
});
