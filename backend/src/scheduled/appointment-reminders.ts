import { getDb } from '../utils/db';
import { PushService } from '../services/push.service';
import { sendTelegramMessage } from '../services/telegram.service';

// How many minutes before the appointment to fire the reminder.
const REMINDER_LEAD_MINUTES = 10;

// What local time to send the "today's appointments" summary.
const DAILY_SUMMARY_TIME = '09:00';

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

function getLocalNow(env: Env): Date {
  const offsetMinutes = getTimezoneOffsetMinutes(env);
  return new Date(Date.now() + offsetMinutes * 60_000);
}

// ── 10-minutes-before reminder ────────────────────────────────────────────
// Runs on every cron tick (every minute — see wrangler.toml `[triggers]`).
// Finds appointments whose start time is exactly REMINDER_LEAD_MINUTES from
// "now" (in the assumed local timezone) and sends a reminder (browser push +
// Telegram, whichever are configured), then marks it as sent so it never
// fires twice.
export async function runAppointmentReminderCheck(env: Env): Promise<void> {
  const havePush = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  const haveTelegram = !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  if (!havePush && !haveTelegram) {
    console.warn('Neither VAPID nor Telegram configured — skipping appointment reminder check');
    return;
  }

  const db = getDb(env);
  const pushService = new PushService(
    db,
    env.VAPID_SUBJECT || 'mailto:noreply@nutriflow.app',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  const localNow = getLocalNow(env);
  const targetLocal = new Date(localNow.getTime() + REMINDER_LEAD_MINUTES * 60_000);

  const targetDate = formatDateKey(targetLocal);
  const targetTime = formatTimeKey(targetLocal);

  const candidates = await pushService.findReminderCandidates(targetDate, targetTime);
  for (const appt of candidates) {
    const title = 'Upcoming appointment';
    const body = `${appt.client_name} in ${REMINDER_LEAD_MINUTES} minutes (${appt.time_from.slice(0, 5)} – ${appt.time_to.slice(0, 5)})`;

    if (havePush) {
      await pushService.sendToDietitian(appt.dietitian_id, {
        title,
        body,
        url: '/dashboard/appointments',
      });
    }

    if (haveTelegram) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN!, env.TELEGRAM_CHAT_ID!, `⏰ <b>${title}</b>\n${body}`);
    }

    await pushService.markReminderSent(appt.id);
  }
}

// ── Daily 9 AM summary ────────────────────────────────────────────────────
// Runs on every cron tick too, but only actually does anything once the
// local clock hits DAILY_SUMMARY_TIME. Uses RATE_LIMIT_KV (if bound) to make
// sure it only sends once even if the tick fires more than once that minute.
export async function runDailySummaryCheck(env: Env): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const localNow = getLocalNow(env);
  if (formatTimeKey(localNow) !== DAILY_SUMMARY_TIME) return;

  const todayKey = formatDateKey(localNow);

  if (env.RATE_LIMIT_KV) {
    const dedupeKey = `telegram_daily_summary:${todayKey}`;
    const already = await env.RATE_LIMIT_KV.get(dedupeKey);
    if (already) return;
    await env.RATE_LIMIT_KV.put(dedupeKey, '1', { expirationTtl: 60 * 60 * 20 });
  }

  const db = getDb(env);
  const res = await db.query(
    `SELECT client_name, time_from::text AS time_from, time_to::text AS time_to
     FROM appointments
     WHERE appt_date = $1::date AND status != 'cancelled'
     ORDER BY time_from ASC`,
    [todayKey]
  );
  const rows = res.rows as { client_name: string; time_from: string; time_to: string }[];

  if (rows.length === 0) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, 'Good morning! You have no appointments today.');
    return;
  }

  const lines = rows
    .map((r, i) => `${i + 1}. ${r.client_name} — ${r.time_from.slice(0, 5)} to ${r.time_to.slice(0, 5)}`)
    .join('\n');

  const message = `Good morning! You have ${rows.length} appointment${rows.length > 1 ? 's' : ''} today:\n\n${lines}`;

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);
}