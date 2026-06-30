-- Repurpose client_progress_photos for Before + rolling 3-month photos
ALTER TABLE client_progress_photos
  ADD COLUMN IF NOT EXISTS photo_type TEXT NOT NULL DEFAULT 'monthly' CHECK (photo_type IN ('before', 'monthly')),
  ADD COLUMN IF NOT EXISTS month_number INTEGER,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;