import { Pool } from 'pg';
import { CreateAppointmentInput, AppointmentSettings } from '../types/appointment.types';
import { logClientTimelineEvent } from './client.service';

// Every appointments query selects appt_date cast to text (appt_date::text).
// Reason: node-postgres parses SQL DATE columns into JS Date objects by
// default, which then serialize to ISO strings like
// "2026-07-08T00:00:00.000Z" over JSON — not the plain "YYYY-MM-DD" the
// frontend calendar uses as its lookup key. Without the cast, appointments
// save fine but silently fail to appear on the calendar grid.
const APPT_COLUMNS = `id, dietitian_id, client_id, client_name, status, appt_date::text AS appt_date, time_from, time_to, notes, tag, tag_other, created_at, updated_at`;

export class AppointmentService {
  constructor(private db: Pool) {}

  async list(dietitianId: string) {
    const res = await this.db.query(
      `SELECT ${APPT_COLUMNS} FROM appointments WHERE dietitian_id = $1 ORDER BY appt_date ASC, time_from ASC`,
      [dietitianId]
    );
    return res.rows;
  }

  async create(dietitianId: string, input: CreateAppointmentInput) {
    const res = await this.db.query(
      `INSERT INTO appointments (dietitian_id, client_id, client_name, status, appt_date, time_from, time_to, notes, tag, tag_other)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${APPT_COLUMNS}`,
      [dietitianId, input.client_id, input.client_name, input.status, input.appt_date, input.time_from, input.time_to, input.notes ?? null, input.tag ?? null, input.tag_other ?? null]
    );
    await logClientTimelineEvent(
      this.db,
      input.client_id,
      'appointment_scheduled',
      `Appointment scheduled for ${input.appt_date} at ${input.time_from}`
    );
    return res.rows[0];
  }

  async update(dietitianId: string, id: string, input: Partial<CreateAppointmentInput>) {
    const fields: string[] = [];
    const params: any[] = [dietitianId, id];
    Object.entries(input).forEach(([key, value]) => {
      if (value === undefined) return;
      params.push(value);
      fields.push(`${key} = $${params.length}`);
    });
    // If the date or start time changed, this is effectively a new
    // appointment time — clear reminder_sent_at so the 10-min-before
    // reminder fires again for the new time instead of staying silent.
    if (input.appt_date !== undefined || input.time_from !== undefined) {
      fields.push(`reminder_sent_at = NULL`);
    }
    if (fields.length === 0) return this.getById(dietitianId, id);

    const res = await this.db.query(
      `UPDATE appointments SET ${fields.join(', ')}, updated_at = now()
       WHERE dietitian_id = $1 AND id = $2 RETURNING ${APPT_COLUMNS}`,
      params
    );
    return res.rows[0] || null;
  }

  async getById(dietitianId: string, id: string) {
    const res = await this.db.query(
      `SELECT ${APPT_COLUMNS} FROM appointments WHERE dietitian_id = $1 AND id = $2`,
      [dietitianId, id]
    );
    return res.rows[0] || null;
  }

  async remove(dietitianId: string, id: string) {
    const res = await this.db.query(
      `DELETE FROM appointments WHERE dietitian_id = $1 AND id = $2 RETURNING id`,
      [dietitianId, id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getSettings(dietitianId: string): Promise<AppointmentSettings> {
    const res = await this.db.query(
      `SELECT max_per_day, duration_minutes, working_start, working_end
       FROM appointment_settings WHERE dietitian_id = $1`,
      [dietitianId]
    );
    return res.rows[0] || { max_per_day: null, duration_minutes: null, working_start: null, working_end: null };
  }

  async saveSettings(dietitianId: string, settings: AppointmentSettings) {
    const res = await this.db.query(
      `INSERT INTO appointment_settings (dietitian_id, max_per_day, duration_minutes, working_start, working_end)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (dietitian_id) DO UPDATE SET
         max_per_day = EXCLUDED.max_per_day,
         duration_minutes = EXCLUDED.duration_minutes,
         working_start = EXCLUDED.working_start,
         working_end = EXCLUDED.working_end,
         updated_at = now()
       RETURNING max_per_day, duration_minutes, working_start, working_end`,
      [dietitianId, settings.max_per_day, settings.duration_minutes, settings.working_start, settings.working_end]
    );
    return res.rows[0];
  }
}