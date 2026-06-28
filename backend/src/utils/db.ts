import { Pool } from 'pg';

// Do NOT cache the Pool as a module-level singleton in Cloudflare Workers —
// isolates are short-lived and env bindings are only available per-request.
// Creating a Pool per request is cheap; a stale cached pool causes silent 500s.
export function getDb(env: Env): Pool {
  const connectionString = env.DATABASE_URL || env.HYPERDRIVE?.connectionString;
  if (!connectionString) {
    throw new Error('No database connection string found. Set DATABASE_URL in .dev.vars or configure Hyperdrive.');
  }
  return new Pool({ connectionString, max: 5 });
}
