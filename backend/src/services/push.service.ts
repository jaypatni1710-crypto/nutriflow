import { Pool } from 'pg';
import { buildPushPayload, type VapidKeys } from '@block65/webcrypto-web-push';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface ReminderCandidate {
  id: string;
  dietitian_id: string;
  client_name: string;
  appt_date: string;
  time_from: string;
  time_to: string;
  telegram_chat_id: string | null;
}

export class PushService {
  private vapid: VapidKeys;

  constructor(private db: Pool, vapidSubject: string, vapidPublicKey: string, vapidPrivateKey: string) {
    this.vapid = { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey };
  }

  async saveSubscription(dietitianId: string, sub: PushSubscriptionInput) {
    await this.db.query(
      `INSERT INTO push_subscriptions (dietitian_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET
         dietitian_id = EXCLUDED.dietitian_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth`,
      [dietitianId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
  }

  async removeSubscription(endpoint: string) {
    await this.db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
  }

  async listForDietitian(dietitianId: string) {
    const res = await this.db.query(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE dietitian_id = $1`,
      [dietitianId]
    );
    return res.rows as { endpoint: string; p256dh: string; auth: string }[];
  }

  // Sends `payload` to every subscription this dietitian has registered
  // (they may have more than one — e.g. desktop + phone browser). Dead
  // subscriptions (410 Gone / 404 Not Found) are cleaned up automatically.
  //
  // Uses @block65/webcrypto-web-push + fetch() instead of the `web-push`
  // npm package, because `web-push` relies on Node's `https.request`,
  // which Cloudflare Workers does not implement — it only supports fetch().
  async sendToDietitian(dietitianId: string, payload: { title: string; body: string; url?: string }) {
    const subs = await this.listForDietitian(dietitianId);
    await Promise.all(
      subs.map(async (row) => {
        const subscription = {
          endpoint: row.endpoint,
          expirationTime: null,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        try {
          const { headers, body } = await buildPushPayload({ data: payload }, subscription, this.vapid);
          const res = await fetch(row.endpoint, { method: 'POST', headers, body: body as BodyInit });
          if (res.status === 404 || res.status === 410) {
            await this.removeSubscription(row.endpoint);
          } else if (!res.ok) {
            console.error('Push send failed for', row.endpoint, res.status, await res.text());
          }
        } catch (err: any) {
          console.error('Push send failed for', row.endpoint, err);
        }
      })
    );
  }

  // Finds appointments landing on `apptDate` at exactly `timeFrom` that
  // haven't had a reminder sent yet, and are not cancelled. Joins `users`
  // so each candidate carries its own dietitian's telegram_chat_id — that's
  // what lets reminders route to the right person's chat instead of one
  // shared fallback chat.
  async findReminderCandidates(apptDate: string, timeFrom: string): Promise<ReminderCandidate[]> {
    const res = await this.db.query(
      `SELECT a.id, a.dietitian_id, a.client_name,
              a.appt_date::text AS appt_date, a.time_from::text AS time_from, a.time_to::text AS time_to,
              u.telegram_chat_id
       FROM appointments a
       JOIN users u ON u.id = a.dietitian_id
       WHERE a.appt_date = $1::date
         AND a.time_from::time = $2::time
         AND a.status != 'cancelled'
         AND a.reminder_sent_at IS NULL`,
      [apptDate, timeFrom]
    );
    return res.rows;
  }

  async markReminderSent(id: string) {
    await this.db.query(`UPDATE appointments SET reminder_sent_at = now() WHERE id = $1`, [id]);
  }
}