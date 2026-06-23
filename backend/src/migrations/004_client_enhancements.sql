-- Migration: 004_client_enhancements
-- Description: Food Frequency Questionnaire, Progress Photos, Status Management, Timeline

ALTER TYPE client_status_enum ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE client_status_enum ADD VALUE IF NOT EXISTS 'on_hold';

ALTER TABLE client_lab_reports ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS client_food_frequency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fruits VARCHAR(20),
  vegetables VARCHAR(20),
  dairy_products VARCHAR(20),
  fast_food VARCHAR(20),
  sweets VARCHAR(20),
  sugary_drinks VARCHAR(20),
  tea_coffee VARCHAR(20),
  fried_foods VARCHAR(20),
  bakery_products VARCHAR(20),
  packaged_foods VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  view_type VARCHAR(10) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_frequency_client_id ON client_food_frequency(client_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_client_id ON client_progress_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_timeline_client_id ON client_timeline(client_id);
