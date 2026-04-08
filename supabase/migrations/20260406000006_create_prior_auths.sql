-- Prior authorizations table
-- Core tracking table for all PA requests. Links to patients and appointments.
-- documentation_checklist is a JSON array of required items with completion status.

CREATE TABLE prior_auths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments (id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  payer_name text NOT NULL,
  procedure_or_medication text NOT NULL,
  status prior_auth_status NOT NULL DEFAULT 'draft',
  documentation_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_date timestamptz,
  decision_date timestamptz,
  expiration_date date,
  denial_reason text,
  appeal_letter text,
  notes text,
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX idx_prior_auths_practice ON prior_auths (practice_id);
CREATE INDEX idx_prior_auths_patient ON prior_auths (patient_id);
CREATE INDEX idx_prior_auths_status ON prior_auths (practice_id, status);
CREATE INDEX idx_prior_auths_expiration ON prior_auths (expiration_date)
  WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_prior_auths_payer ON prior_auths (payer_name);

CREATE TRIGGER prior_auths_updated_at
  BEFORE UPDATE ON prior_auths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
