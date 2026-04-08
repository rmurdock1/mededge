-- Payer rules table
-- Core lookup table for PA requirements. This is NOT AI — it's deterministic.
-- Every rule must have a source_url and last_verified_date.

CREATE TABLE payer_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name text NOT NULL,
  plan_type text NOT NULL,
  cpt_code text NOT NULL,
  icd10_code text, -- nullable: some rules are diagnosis-specific
  pa_required boolean NOT NULL,
  documentation_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  submission_method submission_method NOT NULL DEFAULT 'portal',
  typical_turnaround_days integer,
  step_therapy_required boolean NOT NULL DEFAULT false,
  step_therapy_details text,
  last_verified_date date NOT NULL,
  source_url text NOT NULL,
  confidence_score real NOT NULL DEFAULT 0.7
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the core lookup: payer + plan + cpt
CREATE INDEX idx_payer_rules_lookup ON payer_rules (payer_name, plan_type, cpt_code);
CREATE INDEX idx_payer_rules_payer ON payer_rules (payer_name);
CREATE INDEX idx_payer_rules_cpt ON payer_rules (cpt_code);

CREATE TRIGGER payer_rules_updated_at
  BEFORE UPDATE ON payer_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
