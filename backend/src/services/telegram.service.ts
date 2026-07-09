// Sends a message to a Telegram chat using the Bot API. Telegram's API is
// plain HTTP + JSON, so this works fine with fetch() inside Cloudflare
// Workers — no special libraries needed, unlike web push.
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Telegram send failed', res.status, body);
    }
  } catch (err) {
    console.error('Telegram send failed', err);
  }
}