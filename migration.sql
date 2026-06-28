-- ============================================================
-- NutriFlow: Registration & Admin Approval Flow Migration
-- Run this on your Neon database ONCE
-- ============================================================

-- 1. Rename status value 'active' → 'approved' in the users table
--    (PostgreSQL doesn't support ALTER TYPE ENUM rename directly;
--     we use a workaround via a new type)

-- Step A: Add the new columns needed for the flow
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS decision_date          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temporary_access_type  TEXT CHECK (temporary_access_type IN ('1_week', '1_month')),
  ADD COLUMN IF NOT EXISTS temporary_access_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temporary_access_end   TIMESTAMPTZ;

-- Step B: If status is an ENUM type, we need to add 'approved' and handle 'active'
--         Check if status column is text or enum:
--         If it's TEXT (most likely in your Hono/pg setup), just run the UPDATE below.
--         If it's ENUM, uncomment the ALTER TYPE block instead.

-- For TEXT status column:
UPDATE users SET status = 'approved' WHERE status = 'active';

-- For ENUM status column (uncomment if needed):
-- ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'approved';
-- UPDATE users SET status = 'approved' WHERE status = 'active';

-- 2. Set email_verified = true for all existing pending users
--    (new flow skips email verification)
UPDATE users SET email_verified = true WHERE email_verified = false;

-- 3. Verify
SELECT status, COUNT(*) FROM users GROUP BY status ORDER BY status;
