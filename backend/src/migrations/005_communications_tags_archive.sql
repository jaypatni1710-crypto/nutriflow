-- Migration: 005_communications_tags_archive
-- Description: Client Communication Log, Client Tags, Archive support

ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_communications_client_id ON client_communications(client_id);
CREATE INDEX IF NOT EXISTS idx_tags_client_id ON client_tags(client_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON client_tags(tag);
CREATE INDEX IF NOT EXISTS idx_clients_is_archived ON clients(is_archived);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone_number);
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp ON clients(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'client_communications_updated_at'
  ) THEN
    CREATE TRIGGER client_communications_updated_at
      BEFORE UPDATE ON client_communications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
