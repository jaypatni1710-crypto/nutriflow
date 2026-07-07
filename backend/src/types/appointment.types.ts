export type AppointmentStatus = 'new' | 'ongoing' | 'follow_up' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  dietitian_id: string;
  client_id: string;
  client_name: string;
  status: AppointmentStatus;
  appt_date: string;
  time_from: string;
  time_to: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentInput {
  client_id: string;
  client_name: string;
  status: AppointmentStatus;
  appt_date: string;
  time_from: string;
  time_to: string;
}

export interface AppointmentSettings {
  max_per_day: number | null;
  duration_minutes: number | null;
  working_start: string | null;
  working_end: string | null;
}