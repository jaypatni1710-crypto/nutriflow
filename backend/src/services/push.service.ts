import { Pool } from 'pg';
import * as webpush from 'web-push';
import type { PushSubscription as WebPushSubscription } from 'web-push';

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
}

export class PushService {
  constructor(private db: Pool, vapidSubject: string, vapidPublicKey: string, vapidPrivateKey: string) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
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
  async sendToDietitian(dietitianId: string, payload: { title: string; body: string; url?: string }) {
    const subs = await this.listForDietitian(dietitianId);
    await Promise.all(
      subs.map(async (row) => {
        const subscription: WebPushSubscription = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await this.removeSubscription(row.endpoint);
          } else {
            console.error('Push send failed for', row.endpoint, err);
          }
        }
      })
    );
  }

  // Finds appointments landing on `apptDate` at exactly `timeFrom` that
  // haven't had a reminder sent yet, and are not cancelled.
  async findReminderCandidates(apptDate: string, timeFrom: string): Promise<ReminderCandidate[]> {
    const res = await this.db.query(
      `SELECT id, dietitian_id, client_name, appt_date::text AS appt_date, time_from::text AS time_from, time_to::text AS time_to
       FROM appointments
       WHERE appt_date = $1::date
         AND time_from = $2::time
         AND status != 'cancelled'
         AND reminder_sent_at IS NULL`,
      [apptDate, timeFrom]
    );
    return res.rows;
  }

  async markReminderSent(id: string) {
    await this.db.query(`UPDATE appointments SET reminder_sent_at = now() WHERE id = $1`, [id]);
  }
}