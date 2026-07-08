interface Env {
  // Hyperdrive binding (Postgres) — used in production. Optional locally,
  // where DATABASE_URL is used instead (see .dev.vars).
  HYPERDRIVE?: Hyperdrive;

  // Direct Postgres connection string for local dev (set in .dev.vars).
  // Not used in production — Hyperdrive is used instead.
  DATABASE_URL?: string;

  // KV for rate limiting (optional — if missing, rate limiting is skipped)
  RATE_LIMIT_KV?: KVNamespace;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  BREVO_API_KEY: string;
  FRONTEND_URL: string;
  SMTP_FROM: string;

  // Web Push (VAPID) — set via wrangler secret put
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT?: string; // e.g. "mailto:you@example.com"

  // Minutes to add to UTC to get the dietitian's local time (IST = 330).
  // Only needed if you want to override the default.
  APP_TIMEZONE_OFFSET_MINUTES?: string;
}