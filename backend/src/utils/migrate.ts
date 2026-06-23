import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await pool.query(sql);
      console.log(`✅ Migration applied: ${file}`);
    }
  }

  await pool.end();
  console.log('All migrations completed successfully.');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
