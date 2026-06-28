import { Pool } from 'pg';

export function createDbPool(env: Env) {
  // Use direct connection for local dev, Hyperdrive for production
  const connectionString = env.DATABASE_URL || env.HYPERDRIVE?.connectionString;
  if (!connectionString) {
    throw new Error('No database connection string found. Set DATABASE_URL in .dev.vars or configure Hyperdrive.');
  }
  return new Pool({ connectionString });
}