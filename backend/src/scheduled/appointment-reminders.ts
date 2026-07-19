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

// Formats a "HH:MM:SS" (or "HH:MM") string as 12-hour time, e.g. "17:00:00" -> "5:00 PM".
function formatTime12h(hhmmss: string): string {
  const [hStr, mStr] = hhmmss.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

function formatTimeRange(timeFrom: string, timeTo: string): string {
  return `${formatTime12h(timeFrom)} – ${formatTime12h(timeTo)}`;
}

// ── 10-minutes-before reminder ────────────────────────────────────────────
// Runs on every cron tick (every minute — see wrangler.toml `[triggers]`).
// Finds appointments whose start time is exactly REMINDER_LEAD_MINUTES from
// "now" (in the assumed local timezone) and sends a reminder (browser push +
// Telegram, whichever are configured), then marks it as sent so it never
// fires twice. Telegram reminders go to the dietitian's own linked chat;
// TELEGRAM_CHAT_ID is only used as a fallback if that dietitian hasn't
// linked their own chat yet.
export async function runAppointmentReminderCheck(env: Env): Promise<void> {
  const havePush = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  const haveTelegramToken = !!env.TELEGRAM_BOT_TOKEN;
  if (!havePush && !haveTelegramToken) {
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
  console.log(`[reminder-check] target=${targetDate} ${targetTime} havePush=${havePush} haveTelegram=${haveTelegramToken} candidates=${candidates.length}`);
  for (const appt of candidates) {
    console.log(`[reminder-check] processing appt=${appt.id} dietitian=${appt.dietitian_id} chatId=${appt.telegram_chat_id}`);
    const title = `Reminder — ${appt.client_name}`;
    const body = `Starts in ${REMINDER_LEAD_MINUTES} minutes, ${formatTimeRange(appt.time_from, appt.time_to)}`;

    if (havePush) {
      await pushService.sendToDietitian(appt.dietitian_id, {
        title,
        body,
        url: '/dashboard/appointments',
      });
    }

    const chatId = appt.telegram_chat_id || env.TELEGRAM_CHAT_ID;
    if (haveTelegramToken && chatId) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN!, chatId, `⏰ <b>${title}</b>\n${body}`);
    }

    await pushService.markReminderSent(appt.id);
  }
}

// ── Daily 9 AM summary ────────────────────────────────────────────────────
// Runs on every cron tick too, but only actually does anything once the
// local clock hits DAILY_SUMMARY_TIME. Uses RATE_LIMIT_KV (if bound) to make
// sure it only sends once even if the tick fires more than once that minute.
// Sends each linked dietitian their own schedule; TELEGRAM_CHAT_ID is used
// only as a fallback for anyone who hasn't linked a personal chat.
export async function runDailySummaryCheck(env: Env): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;

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

  // Every dietitian who has linked a personal Telegram chat.
  const usersRes = await db.query(`SELECT id, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL`);
  const telegramUsers = usersRes.rows as { id: string; telegram_chat_id: string }[];

  // Today's appointments across everyone, grouped by dietitian below.
  const apptRes = await db.query(
    `SELECT dietitian_id, client_name, time_from::text AS time_from, time_to::text AS time_to
     FROM appointments
     WHERE appt_date = $1::date AND status != 'cancelled'
     ORDER BY dietitian_id, time_from ASC`,
    [todayKey]
  );
  const appts = apptRes.rows as { dietitian_id: string; client_name: string; time_from: string; time_to: string }[];

  const apptsByDietitian = new Map<string, typeof appts>();
  for (const appt of appts) {
    const list = apptsByDietitian.get(appt.dietitian_id) ?? [];
    list.push(appt);
    apptsByDietitian.set(appt.dietitian_id, list);
  }

  const buildMessage = (list: typeof appts): string => {
    if (list.length === 0) {
      return '☀️ Good morning! No appointments today — enjoy the free day! 🎉';
    }
    const lines = list
      .map((r, i) => `${i + 1}. ${r.client_name} — ${formatTimeRange(r.time_from, r.time_to)}`)
      .join('\n');
    return `☀️ Good morning! Here's today's schedule:\n\n${lines}`;
  };

  if (telegramUsers.length > 0) {
    // Each linked dietitian gets their own schedule in their own chat.
    for (const user of telegramUsers) {
      const list = apptsByDietitian.get(user.id) ?? [];
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, user.telegram_chat_id, buildMessage(list));
    }
  } else if (env.TELEGRAM_CHAT_ID) {
    // Nobody has linked a personal chat yet — fall back to the old
    // behavior of one combined summary to the legacy global chat.
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, buildMessage(appts));
  }
}