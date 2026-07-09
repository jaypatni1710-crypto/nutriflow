import { Hono } from 'hono';
import { AuthService } from '../services/auth.service';
import {
  sendTelegramAlertPrompt,
  sendTelegramContactRequest,
  sendTelegramMessage,
  removeTelegramKeyboard,
  answerTelegramCallback,
} from '../services/telegram.service';

// The keyword a user can type any time later to re-open the Get/Cancel
// prompt, in case they hit Cancel (or never linked) the first time.
const RELINK_KEYWORD = 'notify';

export function createTelegramRouter(
  authService: AuthService,
  botToken: string,
  webhookSecret?: string
): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  // POST /webhook — called by Telegram itself for every update (message,
  // button tap, contact share, etc). This endpoint is intentionally NOT
  // behind `authenticate` — Telegram has no JWT. Instead, if a webhook
  // secret is configured, we check Telegram's own secret-token header.
  router.post('/webhook', async (c) => {
    if (webhookSecret) {
      const incomingSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
      if (incomingSecret !== webhookSecret) {
        return c.json({ ok: false }, 401);
      }
    }

    let update: any;
    try {
      update = await c.req.json();
    } catch {
      return c.json({ ok: true }); // ignore malformed bodies, don't let Telegram retry forever
    }

    try {
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = cq.message?.chat?.id;
        await answerTelegramCallback(botToken, cq.id);

        if (cq.data === 'nf_get' && chatId) {
          await sendTelegramContactRequest(botToken, chatId);
        } else if (cq.data === 'nf_cancel' && chatId) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `Okay, no alerts for now. Type <b>${RELINK_KEYWORD}</b> anytime here to link later.`
          );
        }
        return c.json({ ok: true });
      }

      if (update.message) {
        const msg = update.message;
        const chatId = msg.chat?.id;
        if (!chatId) return c.json({ ok: true });

        // User tapped "Share my phone number" — try to match it to a dietitian account.
        if (msg.contact) {
          const linked = await authService.linkTelegramByPhone(msg.contact.phone_number, String(chatId));
          if (linked) {
            await removeTelegramKeyboard(
              botToken,
              chatId,
              `✅ You're linked, ${linked.first_name}! You'll now get NutriFlow alerts here.`
            );
          } else {
            await removeTelegramKeyboard(
              botToken,
              chatId,
              `We couldn't find a NutriFlow account with that phone number. Make sure it matches the number you registered with, then type <b>${RELINK_KEYWORD}</b> to try again.`
            );
          }
          return c.json({ ok: true });
        }

        const text = (msg.text || '').trim().toLowerCase();
        if (text === '/start' || text === RELINK_KEYWORD) {
          await sendTelegramAlertPrompt(botToken, chatId);
        }
        return c.json({ ok: true });
      }

      return c.json({ ok: true });
    } catch (err) {
      console.error('Telegram webhook handling failed:', err);
      return c.json({ ok: true }); // still 200 — don't make Telegram hammer retries
    }
  });

  return router;
}