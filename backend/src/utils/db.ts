import { Pool } from 'pg';

// Cloudflare Hyperdrive provides a connection string that routes through their
// connection pooler — same pg API, no cold-start latency, no idle timeouts.
// The HYPERDRIVE binding exposes `.connectionString` at runtime.

let pool: Pool | null = null;

export function getDb(hyperdrive: Hyperdrive): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: hyperdrive.connectionString });
  }
  return pool;
}
