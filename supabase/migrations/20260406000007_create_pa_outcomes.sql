-- PA outcomes table (Payer Intelligence Network)
-- Stores ANONYMIZED outcome data only. NO patient identifiers.
-- This data powers cross-practice intelligence about payer behavior.

CREATE TABLE pa_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
  payer_name text NOT NULL,
  plan_type text NOT NULL,
  cpt_code text NOT NULL,
  documentation_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome pa_outcome_type NOT NULL,
  denial_reason_category text,
  appeal_outcome appeal_outcome_type,
  turnaround_days integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for intelligence queries
CREATE INDEX idx_pa_outcomes_payer ON pa_outcomes (payer_name, cpt_code);
CREATE INDEX idx_pa_outcomes_practice ON pa_outcomes (practice_id);
CREATE INDEX idx_pa_outcomes_outcome ON pa_outcomes (payer_name, outcome);
