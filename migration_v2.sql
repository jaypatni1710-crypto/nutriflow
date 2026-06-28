-- ============================================================
-- NutriFlow: Add missing registration fields
-- Run this on your Neon database ONCE
-- ============================================================

-- Add 'approved' to user_status_enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'user_status_enum'::regtype 
        AND enumlabel = 'approved'
    ) THEN
        ALTER TYPE user_status_enum ADD VALUE 'approved';
    END IF;
END $$;

-- Now this UPDATE will work
UPDATE users SET status = 'approved' WHERE status = 'active';

-- Add missing user profile fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS experience INTEGER CHECK (experience >= 0);
