-- Enum types for MedEdge
-- These are used across multiple tables

CREATE TYPE submission_method AS ENUM (
  'portal',
  'fax',
  'phone',
  'electronic'
);

CREATE TYPE pa_status AS ENUM (
  'not_needed',
  'needed',
  'in_progress',
  'submitted',
  'approved',
  'denied',
  'appeal_submitted',
  'appeal_approved'
);

CREATE TYPE prior_auth_status AS ENUM (
  'draft',
  'ready',
  'submitted',
  'pending',
  'approved',
  'denied',
  'appeal_draft',
  'appeal_submitted',
  'appeal_approved',
  'appeal_denied',
  'expired'
);

CREATE TYPE pa_outcome_type AS ENUM (
  'approved',
  'denied'
);

CREATE TYPE appeal_outcome_type AS ENUM (
  'approved',
  'denied'
);

CREATE TYPE user_role AS ENUM (
  'practice_admin',
  'staff',
  'billing_manager'
);
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
-- PA activity log
-- Audit trail for all actions taken on prior authorizations.
-- Required for compliance and debugging.

CREATE TABLE pa_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_auth_id uuid NOT NULL REFERENCES prior_auths (id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  user_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for viewing activity on a specific PA
CREATE INDEX idx_pa_activity_log_prior_auth ON pa_activity_log (prior_auth_id);
CREATE INDEX idx_pa_activity_log_user ON pa_activity_log (user_id);
-- User profiles table
-- Links Supabase auth.users to a practice with a role.
-- This is the source of truth for practice_id and role used in RLS policies.

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  practice_id uuid NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'staff',
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_practice ON user_profiles (practice_id);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Row-Level Security policies
-- Every table with practice_id is locked down so users can only access their own practice's data.
-- Uses a helper function to get practice_id from the authenticated user's profile.

-- Helper: get the current user's practice_id from user_profiles
CREATE OR REPLACE FUNCTION public.get_practice_id()
RETURNS uuid AS $$
  SELECT practice_id FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the current user's role from user_profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PRACTICES
-- ============================================================
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own practice"
  ON practices FOR SELECT
  USING (id = public.get_practice_id());

CREATE POLICY "Practice admins can update their own practice"
  ON practices FOR UPDATE
  USING (id = public.get_practice_id() AND public.get_user_role() = 'practice_admin');

-- ============================================================
-- USER PROFILES
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles in their practice"
  ON user_profiles FOR SELECT
  USING (practice_id = public.get_practice_id());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Practice admins can manage profiles in their practice"
  ON user_profiles FOR ALL
  USING (
    practice_id = public.get_practice_id()
    AND public.get_user_role() = 'practice_admin'
  );

-- ============================================================
-- PATIENTS (contains PHI)
-- ============================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access patients in their practice"
  ON patients FOR ALL
  USING (practice_id = public.get_practice_id());

-- ============================================================
-- APPOINTMENTS (contains PHI)
-- ============================================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access appointments in their practice"
  ON appointments FOR ALL
  USING (practice_id = public.get_practice_id());

-- ============================================================
-- PRIOR AUTHS (contains PHI)
-- ============================================================
ALTER TABLE prior_auths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access prior auths in their practice"
  ON prior_auths FOR ALL
  USING (practice_id = public.get_practice_id());

-- ============================================================
-- PA OUTCOMES (anonymized, but still practice-scoped for writes)
-- ============================================================
ALTER TABLE pa_outcomes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read outcomes (powers Payer Intelligence Network)
CREATE POLICY "Authenticated users can read all outcomes"
  ON pa_outcomes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can only insert outcomes for their own practice
CREATE POLICY "Users can insert outcomes for their practice"
  ON pa_outcomes FOR INSERT
  WITH CHECK (practice_id = public.get_practice_id());

-- ============================================================
-- PA ACTIVITY LOG
-- ============================================================
ALTER TABLE pa_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity log for their practice PAs"
  ON pa_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prior_auths
      WHERE prior_auths.id = pa_activity_log.prior_auth_id
        AND prior_auths.practice_id = public.get_practice_id()
    )
  );

CREATE POLICY "Users can insert activity log entries for their practice PAs"
  ON pa_activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prior_auths
      WHERE prior_auths.id = pa_activity_log.prior_auth_id
        AND prior_auths.practice_id = public.get_practice_id()
    )
  );

-- ============================================================
-- PAYER RULES (shared reference data, no practice_id)
-- ============================================================
ALTER TABLE payer_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read payer rules
CREATE POLICY "Authenticated users can read payer rules"
  ON payer_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only practice admins can manage payer rules (for now)
CREATE POLICY "Practice admins can manage payer rules"
  ON payer_rules FOR ALL
  USING (public.get_user_role() = 'practice_admin');
-- Auto-create practice and user_profile on signup
-- When a new user signs up with practice_name in metadata,
-- this trigger creates the practice and links the user as practice_admin.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_practice_id uuid;
BEGIN
  -- Create the practice from signup metadata
  INSERT INTO public.practices (name)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'practice_name', 'My Practice'))
  RETURNING id INTO new_practice_id;

  -- Create the user profile linked to this practice
  INSERT INTO public.user_profiles (id, practice_id, role, full_name)
  VALUES (
    NEW.id,
    new_practice_id,
    'practice_admin',
    NEW.raw_user_meta_data ->> 'full_name'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire after a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
