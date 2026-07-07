import { getDb } from '../utils/db';
import { PushService } from '../services/push.service';

// How many minutes before the appointment to fire the reminder.
const REMINDER_LEAD_MINUTES = 10;

// Appointments are entered in the dietitian's local time (no timezone stored),
// and this app is used from India. Workers run in UTC, so we shift "now" by
// this offset to compare against the appt_date/time_from values as-entered.
// IST = UTC+5:30 = 330 minutes. Override via APP_TIMEZONE_OFFSET_MINUTES if
// you ever need a different assumed timezone.
function getTimezoneOffsetMinutes(env: Env): number {
  const raw = env.APP_TIMEZONE_OFFSET_MINUTES;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 330;
}

function formatDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function formatTimeKey(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// Runs on every cron tick (every minute — see wrangler.toml `[triggers]`).
// Finds appointments whose start time is exactly REMINDER_LEAD_MINUTES from
// "now" (in the assumed local timezone) and pushes a reminder to that
// appointment's dietitian, then marks it as sent so it never fires twice.
export async function runAppointmentReminderCheck(env: Env): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured — skipping appointment reminder check');
    return;
  }

  const db = getDb(env);
  const pushService = new PushService(
    db,
    env.VAPID_SUBJECT || 'mailto:noreply@nutriflow.app',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  const offsetMinutes = getTimezoneOffsetMinutes(env);
  const nowUtc = new Date();
  const localNow = new Date(nowUtc.getTime() + offsetMinutes * 60_000);
  const targetLocal = new Date(localNow.getTime() + REMINDER_LEAD_MINUTES * 60_000);

  const targetDate = formatDateKey(targetLocal);
  const targetTime = formatTimeKey(targetLocal);

  const candidates = await pushService.findReminderCandidates(targetDate, targetTime);
  for (const appt of candidates) {
    await pushService.sendToDietitian(appt.dietitian_id, {
      title: 'Upcoming appointment',
      body: `${appt.client_name} in ${REMINDER_LEAD_MINUTES} minutes (${appt.time_from.slice(0, 5)} – ${appt.time_to.slice(0, 5)})`,
      url: '/dashboard/appointments',
    });
    await pushService.markReminderSent(appt.id);
  }
}