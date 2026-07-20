CREATE TABLE IF NOT EXISTS client_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  bmi NUMERIC(4,1),
  bmi_category TEXT,
  bmr INTEGER,
  daily_calories INTEGER,
  daily_protein NUMERIC(5,1),
  ideal_weight_min NUMERIC(5,1),
  ideal_weight_max NUMERIC(5,1),
  activity_level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  file_path TEXT,
  notes TEXT,
  report_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_limit INTEGER;

CREATE INDEX IF NOT EXISTS idx_assessments_client ON client_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_tags_client ON client_tags(client_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_client ON client_lab_reports(client_id);
