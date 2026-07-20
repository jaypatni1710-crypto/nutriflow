-- ============================================================
-- NutriFlow: COMPLETE Missing Tables Fix
-- ============================================================

CREATE TABLE IF NOT EXISTS client_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  height_cm NUMERIC(5,2),
  current_weight_kg NUMERIC(5,2),
  goal_weight_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  hip_cm NUMERIC(5,2),
  chest_cm NUMERIC(5,2),
  neck_cm NUMERIC(5,2),
  bmi NUMERIC(4,1),
  bmi_category TEXT,
  bmr INTEGER,
  daily_calories INTEGER,
  daily_protein NUMERIC(5,1),
  ideal_weight_min NUMERIC(5,1),
  ideal_weight_max NUMERIC(5,1),
  diet_type TEXT,
  specify_diet_type TEXT,
  food_preferences TEXT[],
  disliked_foods TEXT[],
  allergies TEXT[],
  activity_level TEXT,
  sleep_hours NUMERIC(3,1),
  water_intake_liters NUMERIC(4,1),
  meal_frequency TEXT,
  cooking_frequency TEXT,
  eating_out_frequency TEXT,
  supplement_usage TEXT,
  stress_level TEXT,
  smoking_status TEXT,
  alcohol_consumption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS client_medical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conditions TEXT[],
  specify_condition TEXT,
  current_medications TEXT,
  family_medical_history TEXT,
  medical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS client_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2),
  bmi NUMERIC(4,1),
  waist_cm NUMERIC(5,2),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_food_frequency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fruits TEXT,
  vegetables TEXT,
  dairy_products TEXT,
  fast_food TEXT,
  sweets TEXT,
  sugary_drinks TEXT,
  tea_coffee TEXT,
  fried_foods TEXT,
  bakery_products TEXT,
  packaged_foods TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS specify_goal TEXT,
  ADD COLUMN IF NOT EXISTS secondary_goals TEXT[],
  ADD COLUMN IF NOT EXISTS target_weight NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE client_progress_photos
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE client_lab_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE client_tags
  ADD CONSTRAINT IF NOT EXISTS unique_client_tag UNIQUE (client_id, tag);

CREATE INDEX IF NOT EXISTS idx_progress_logs_client ON client_progress_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_client ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_food_freq_client ON client_food_frequency(client_id);
CREATE INDEX IF NOT EXISTS idx_timeline_client ON client_timeline(client_id);
CREATE INDEX IF NOT EXISTS idx_communications_client ON client_communications(client_id);
CREATE INDEX IF NOT EXISTS idx_assessments_client ON client_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_medical_history_client ON client_medical_history(client_id);