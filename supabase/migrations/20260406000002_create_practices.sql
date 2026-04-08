-- Practices table
-- Each practice is a tenant in the multi-tenant architecture.
-- ModMed credentials and URL prefix are stored encrypted.

CREATE TABLE practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  modmed_url_prefix text, -- encrypted at application level
  modmed_credentials jsonb, -- encrypted at application level
  address text,
  city text,
  state text,
  zip text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER practices_updated_at
  BEFORE UPDATE ON practices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for lookups
CREATE INDEX idx_practices_name ON practices (name);
