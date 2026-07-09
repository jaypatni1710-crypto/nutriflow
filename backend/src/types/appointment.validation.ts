import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const baseAppointmentSchema = z.object({
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

// Appointments are booked in IST, so "now" is computed in IST (UTC+5:30)
// regardless of the server's own timezone, to match what the frontend shows.
function nowInIST(): { date: string; time: string } {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return { date: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16) };
}

export const createAppointmentSchema = baseAppointmentSchema.refine(
  (data) => {
    const { date, time } = nowInIST();
    if (data.appt_date < date) return false;
    if (data.appt_date === date && data.time_from < time) return false;
    return true;
  },
  { message: 'Cannot create an appointment in the past', path: ['appt_date'] }
);

export const updateAppointmentSchema = baseAppointmentSchema.partial();

export const appointmentSettingsSchema = z.object({
  max_per_day: z.coerce.number().int().min(0).nullable().optional(),
  duration_minutes: z.coerce.number().int().min(0).nullable().optional(),
  working_start: z.string().regex(timeRegex).nullable().optional(),
  working_end: z.string().regex(timeRegex).nullable().optional(),
});