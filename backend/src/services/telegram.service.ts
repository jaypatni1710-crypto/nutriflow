// Generic Telegram Bot API caller. Telegram's API is plain HTTP + JSON, so
// this works fine with fetch() inside Cloudflare Workers — no special
// libraries needed, unlike web push.
async function callTelegramApi(botToken: string, method: string, payload: Record<string, unknown>): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Telegram ${method} failed`, res.status, body);
    }
  } catch (err) {
    console.error(`Telegram ${method} failed`, err);
  }
}

// Sends a message to a Telegram chat using the Bot API.
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  await callTelegramApi(botToken, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

// Sends the "📢 Receive NutriFlow Alerts?" prompt with Get / Cancel inline buttons.
export async function sendTelegramAlertPrompt(botToken: string, chatId: string | number): Promise<void> {
  await callTelegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text: '📢 <b>Receive NutriFlow Alerts?</b>\n\nGet appointment reminders and daily summaries here on Telegram.',
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Get', callback_data: 'nf_get' },
          { text: '❌ Cancel', callback_data: 'nf_cancel' },
        ],
      ],
    },
  });
}

// Asks the user to share their phone number via Telegram's built-in
// "Share Contact" button (one tap, no typing).
export async function sendTelegramContactRequest(botToken: string, chatId: string | number): Promise<void> {
  await callTelegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text: 'Tap the button below to share the phone number you used to register with NutriFlow.',
    reply_markup: {
      keyboard: [[{ text: '📱 Share my phone number', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// Removes the reply keyboard (e.g. after Cancel, or once linking is done).
export async function removeTelegramKeyboard(botToken: string, chatId: string | number, text: string): Promise<void> {
  await callTelegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { remove_keyboard: true },
  });
}

// Acknowledges a button tap so Telegram stops showing the little loading
// spinner on it. Doesn't need to be awaited by the caller for correctness,
// but we do anyway to keep error handling in one place.
export async function answerTelegramCallback(botToken: string, callbackQueryId: string, text?: string): Promise<void> {
  await callTelegramApi(botToken, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}