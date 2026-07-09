import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createAppointmentSchema = z.object({
  client_id: z.string().uuid(),
  client_name: z.string().min(1).max(200),
  status: z.enum(['new', 'ongoing', 'follow_up', 'completed', 'cancelled']),
  appt_date: z.string().regex(dateRegex),
  time_from: z.string().regex(timeRegex),
  time_to: z.string().regex(timeRegex),
  notes: z.string().max(2000).nullable().optional(),
  tag: z.enum(['discussion', 'diet_plan_discussion', 'diet_plan_sent', 'follow_up_tag', 'consultation', 'other']).nullable().optional(),
  tag_other: z.string().max(200).nullable().optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const appointmentSettingsSchema = z.object({
  max_per_day: z.coerce.number().int().min(0).nullable().optional(),
  duration_minutes: z.coerce.number().int().min(0).nullable().optional(),
  working_start: z.string().regex(timeRegex).nullable().optional(),
  working_end: z.string().regex(timeRegex).nullable().optional(),
});