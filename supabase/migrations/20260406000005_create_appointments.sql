-- Appointments table
-- Synced from ModMed. Links patients to scheduled procedures.
-- pa_status tracks whether PA has been checked/submitted for this appointment.

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  modmed_appointment_id text,
  provider_id text,
  appointment_date date NOT NULL,
  cpt_codes text[] NOT NULL DEFAULT '{}',
  icd10_codes text[] NOT NULL DEFAULT '{}',
  pa_status pa_status NOT NULL DEFAULT 'not_needed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for upcoming appointment scans and practice-scoped queries
CREATE INDEX idx_appointments_practice ON appointments (practice_id);
CREATE INDEX idx_appointments_date ON appointments (practice_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments (patient_id);
CREATE INDEX idx_appointments_pa_status ON appointments (pa_status) WHERE pa_status != 'not_needed';
CREATE INDEX idx_appointments_modmed ON appointments (practice_id, modmed_appointment_id);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
