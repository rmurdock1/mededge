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
