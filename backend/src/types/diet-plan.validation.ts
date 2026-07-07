import { z } from 'zod';

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
});

export const updateDietPlanSchema = createDietPlanSchema.partial().omit({ client_id: true });