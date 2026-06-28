-- ============================================================
-- NutriFlow: Combined migration (run this ONCE on your Neon DB)
--
-- This replaces running migration.sql then migration_v2.sql
-- separately — doing them in that order fails, because
-- migration.sql tries to set status = 'approved' before that
-- value exists on the enum type, which migration_v2.sql only
-- adds afterwards. This script does it in the working order:
--   1. add 'approved' to the enum (if status is an enum)
--   2. add all new columns
--   3. backfill data
-- ============================================================

-- 1. Add 'approved' to user_status_enum if it doesn't exist yet
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'user_status_enum'::regtype
            AND enumlabel = 'approved'
        ) THEN
            ALTER TYPE user_status_enum ADD VALUE 'approved';
        END IF;
    END IF;
END $$;

-- 2. Add all new columns (approval flow + extended registration fields)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS decision_date          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temporary_access_type  TEXT CHECK (temporary_access_type IN ('1_week', '1_month')),
  ADD COLUMN IF NOT EXISTS temporary_access_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temporary_access_end   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address                TEXT,
  ADD COLUMN IF NOT EXISTS qualification          TEXT,
  ADD COLUMN IF NOT EXISTS experience             INTEGER CHECK (experience >= 0);

-- 3. Backfill existing data for the new flow
UPDATE users SET status = 'approved' WHERE status = 'active';
UPDATE users SET email_verified = true WHERE email_verified = false;

-- 4. Verify
SELECT status, COUNT(*) FROM users GROUP BY status ORDER BY status;
