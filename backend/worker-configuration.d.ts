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
  RESEND_API_KEY: string;
  FRONTEND_URL: string;
  SMTP_FROM: string;
}
