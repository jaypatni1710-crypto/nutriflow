import { z } from 'zod';

export const createDietPlanSchema = z.object({
  client_id: z.string().uuid(),
  goal: z.string().max(255).optional(),
  morning: z.string().optional(),
  breakfast: z.string().optional(),
  mid_morning: z.string().optional(),
  lunch: z.string().optional(),
  evening_snacks: z.string().optional(),
  dinner: z.string().optional(),
  bed_time: z.string().optional(),
  note: z.string().optional(),
});

export const updateDietPlanSchema = createDietPlanSchema.partial().omit({ client_id: true });