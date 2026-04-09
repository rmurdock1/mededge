-- Sprint 9-10: ModMed sync infrastructure tables
-- Creates: modmed_sync_log, pa_lookup_log, practice_sync_state
-- Adds: specialty column to practices table

-- ---------------------------------------------------------------------------
-- 1. Add specialty column to practices
-- ---------------------------------------------------------------------------
ALTER TABLE practices ADD COLUMN IF NOT EXISTS specialty text;

-- ---------------------------------------------------------------------------
-- 2. modmed_sync_log — tracks each sync run
-- ---------------------------------------------------------------------------
CREATE TYPE sync_type AS ENUM ('full', 'incremental');
CREATE TYPE sync_status AS ENUM ('running', 'completed', 'failed', 'partial');
CREATE TYPE sync_trigger AS ENUM ('cron', 'manual', 'initial_setup');

CREATE TABLE modmed_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  sync_type sync_type NOT NULL,
  status sync_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  records_fetched jsonb DEFAULT '{}',
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  errors jsonb,
  cursor jsonb,
  triggered_by sync_trigger NOT NULL,
  breaker_state text, -- 'closed', 'open', 'half_open' at time of sync
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_practice ON modmed_sync_log(practice_id, started_at DESC);
CREATE INDEX idx_sync_log_status ON modmed_sync_log(status) WHERE status = 'running';

-- RLS: practice_admin+ can read their own practice's sync logs
ALTER TABLE modmed_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice admins can view their sync logs"
  ON modmed_sync_log FOR SELECT
  USING (
    practice_id IN (
      SELECT up.practice_id FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('practice_admin', 'billing_manager', 'super_admin')
    )
  );

CREATE POLICY "Super admins can view all sync logs"
  ON modmed_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

-- Service role inserts (sync orchestrator runs server-side)
CREATE POLICY "Service role can insert sync logs"
  ON modmed_sync_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update sync logs"
  ON modmed_sync_log FOR UPDATE
  USING (true);

-- ---------------------------------------------------------------------------
-- 3. pa_lookup_log — captures every PA rule lookup for observability
-- ---------------------------------------------------------------------------
-- No PHI in this table. Only codes, payer names, and lookup results.

CREATE TABLE pa_lookup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  payer_name text NOT NULL,
  plan_type text NOT NULL,
  code text NOT NULL,
  code_kind text NOT NULL, -- 'drug' or 'procedure'
  icd10_codes text[] NOT NULL DEFAULT '{}',
  lookup_result text NOT NULL, -- 'required', 'not_required', 'unknown'
  confidence real,
  rule_id uuid, -- FK to whichever rule table matched (nullable = unknown)
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lookup_log_practice ON pa_lookup_log(practice_id, created_at DESC);
CREATE INDEX idx_lookup_log_unknown ON pa_lookup_log(practice_id, code)
  WHERE lookup_result = 'unknown';
CREATE INDEX idx_lookup_log_payer ON pa_lookup_log(payer_name, code)
  WHERE lookup_result = 'unknown';

ALTER TABLE pa_lookup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice admins can view their lookup logs"
  ON pa_lookup_log FOR SELECT
  USING (
    practice_id IN (
      SELECT up.practice_id FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('practice_admin', 'billing_manager', 'super_admin')
    )
  );

CREATE POLICY "Super admins can view all lookup logs"
  ON pa_lookup_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Service role can insert lookup logs"
  ON pa_lookup_log FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. practice_sync_state — persistent circuit breaker + sync cursor
-- ---------------------------------------------------------------------------

CREATE TABLE practice_sync_state (
  practice_id uuid PRIMARY KEY REFERENCES practices(id) ON DELETE CASCADE,
  breaker_status text NOT NULL DEFAULT 'closed',
  breaker_failure_count integer NOT NULL DEFAULT 0,
  breaker_last_failure_at timestamptz,
  breaker_last_failure_error text,
  breaker_opened_at timestamptz,
  last_successful_sync_at timestamptz,
  last_sync_cursor jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice admins can view their sync state"
  ON practice_sync_state FOR SELECT
  USING (
    practice_id IN (
      SELECT up.practice_id FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('practice_admin', 'billing_manager', 'super_admin')
    )
  );

CREATE POLICY "Super admins can view all sync states"
  ON practice_sync_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Service role can manage sync state"
  ON practice_sync_state FOR ALL
  USING (true);

-- Auto-update trigger for updated_at
CREATE TRIGGER practice_sync_state_updated_at
  BEFORE UPDATE ON practice_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
