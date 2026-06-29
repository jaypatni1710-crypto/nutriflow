// KV-based rate limiting — replaces express-rate-limit
// Each key stores a count with a TTL equal to the window

export interface RateLimitConfig {
  windowMs: number;  // milliseconds
  max: number;
  keyPrefix: string;
}

export async function checkRateLimit(
  kv: KVNamespace | undefined,
  identifier: string,
  config: RateLimitConfig
): Promise<{ limited: boolean; remaining: number }> {
  if (!kv) return { limited: false, remaining: config.max };
  const key = `rl:${config.keyPrefix}:${identifier}`;
  const windowSecs = Math.ceil(config.windowMs / 1000);

  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= config.max) {
    return { limited: true, remaining: 0 };
  }

  // Always set expirationTtl so the key expires and resets properly
  await kv.put(key, String(count + 1), {
    expirationTtl: windowSecs,
  });

  return { limited: false, remaining: config.max - count - 1 };
}

export const AUTH_LIMITER: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 100,                   // raised from 20 — shared Codespaces IP inflates count
  keyPrefix: 'auth',
};

export const RESEND_LIMITER: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,
  keyPrefix: 'resend',
};