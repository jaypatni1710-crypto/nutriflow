interface Env {
  // Hyperdrive binding (Postgres)
  HYPERDRIVE: Hyperdrive;

  // KV for rate limiting
  RATE_LIMIT_KV: KVNamespace;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  FRONTEND_URL: string;
  SMTP_FROM: string;
}
