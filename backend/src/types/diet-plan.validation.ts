import { z } from 'zod';

export const CLOSURE_STATUS_VALUES = [
  'sent',
  'rejected',
  'not_appropriate',
  'discontinued',
  'replaced',
  'other',
] as const;

export const createDietPlanSchema = z.object({
  client_id: z.string().uuid(),
  goal: z.string().max(255),
  morning: z.string(),
  breakfast: z.string(),
  mid_morning: z.string(),
  lunch: z.string(),
  evening_snacks: z.string(),
  dinner: z.string(),
  bed_time: z.string(),
  note: z.string().nullable().optional(),
  // Optional — describes what happened to the client's PREVIOUS plan (if any)
  // now that this new one is being created. Saved against the old plan, not this one.
  previous_plan_status: z.enum(CLOSURE_STATUS_VALUES).optional(),
  previous_plan_status_other: z.string().max(255).optional(),
});

export const updateDietPlanSchema = createDietPlanSchema
  .omit({ previous_plan_status: true, previous_plan_status_other: true })
  .partial()
  .omit({ client_id: true });