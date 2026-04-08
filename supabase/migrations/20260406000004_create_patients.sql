-- Patients table
-- Synced from ModMed. Contains PHI — RLS enforced, name encrypted at app level.
-- HIPAA: name_encrypted is encrypted before storage. Never store plaintext names.

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
  modmed_patient_id text,
  name_encrypted text NOT NULL, -- encrypted at application level
  insurance_payer text,
  plan_id text,
  plan_type text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for practice-scoped queries and ModMed sync
CREATE INDEX idx_patients_practice ON patients (practice_id);
CREATE INDEX idx_patients_modmed ON patients (practice_id, modmed_patient_id);
CREATE INDEX idx_patients_payer ON patients (insurance_payer);

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
