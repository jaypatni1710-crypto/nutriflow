-- Migration: 003_create_clients
-- Description: Client Management System tables

CREATE TYPE client_status_enum AS ENUM ('active', 'inactive');

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  whatsapp_number VARCHAR(20),
  email VARCHAR(255),
  gender VARCHAR(10),
  date_of_birth DATE,
  occupation VARCHAR(150),
  city VARCHAR(150),
  address TEXT,
  primary_goal VARCHAR(50),
  specify_goal VARCHAR(255),
  secondary_goals TEXT[] DEFAULT '{}',
  target_weight NUMERIC(5,2),
  target_date DATE,
  status client_status_enum NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_assessments (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  height_cm NUMERIC(5,2),
  current_weight_kg NUMERIC(5,2),
  goal_weight_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  hip_cm NUMERIC(5,2),
  chest_cm NUMERIC(5,2),
  neck_cm NUMERIC(5,2),
  bmi NUMERIC(5,2),
  bmi_category VARCHAR(30),
  bmr NUMERIC(7,2),
  daily_calories NUMERIC(7,2),
  daily_protein NUMERIC(6,2),
  ideal_weight_min NUMERIC(5,2),
  ideal_weight_max NUMERIC(5,2),
  diet_type VARCHAR(30),
  specify_diet_type VARCHAR(255),
  food_preferences TEXT,
  disliked_foods TEXT,
  food_allergies TEXT,
  food_intolerances TEXT,
  wake_up_time VARCHAR(10),
  sleep_time VARCHAR(10),
  water_intake_per_day VARCHAR(50),
  working_hours VARCHAR(50),
  stress_level VARCHAR(20),
  activity_level VARCHAR(30),
  exercise_routine TEXT,
  lifestyle_notes TEXT,
  recall_breakfast TEXT,
  recall_lunch TEXT,
  recall_dinner TEXT,
  recall_snacks TEXT,
  recall_tea_coffee TEXT,
  recall_water TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_medical_history (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  conditions TEXT[] DEFAULT '{}',
  specify_condition VARCHAR(255),
  current_medications TEXT,
  family_medical_history TEXT,
  medical_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2),
  bmi NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_type VARCHAR(30) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_dietitian_id ON clients(dietitian_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_primary_goal ON clients(primary_goal);
CREATE INDEX idx_progress_logs_client_id ON client_progress_logs(client_id);
CREATE INDEX idx_lab_reports_client_id ON client_lab_reports(client_id);
CREATE INDEX idx_notes_client_id ON client_notes(client_id);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER client_assessments_updated_at
  BEFORE UPDATE ON client_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER client_medical_history_updated_at
  BEFORE UPDATE ON client_medical_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER client_notes_updated_at
  BEFORE UPDATE ON client_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
