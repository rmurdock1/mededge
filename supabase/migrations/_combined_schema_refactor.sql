-- ============================================================================
-- Sprint 3 schema refactor — combined migration
-- Paste this whole file into the Supabase SQL editor and Run.
-- Idempotent where possible (CREATE...IF NOT EXISTS, ON CONFLICT).
-- ============================================================================


-- -------------------------------------------------
-- 20260408000001_schema_refactor_enums_and_practices.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Part 1 of 6: enum additions and practices.is_internal
--
-- Adds:
--   * super_admin role for MedEdge Operations users
--   * is_internal flag on practices to mark MedEdge-owned tenants
--   * bcbs_licensee enum (placeholder for Sprint 5+ rule cleanup; not
--     populated in this sprint)
--   * audit_action / audit_source enums for the new rule_audit_log

-- ---------------------------------------------------------------------------
-- 1. Extend user_role with super_admin
-- ---------------------------------------------------------------------------
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- Postgres, but Supabase runs migrations one statement at a time so this is
-- safe. IF NOT EXISTS makes the migration idempotent.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ---------------------------------------------------------------------------
-- 2. is_internal flag on practices
-- ---------------------------------------------------------------------------
-- Marks MedEdge-owned tenants (e.g. "MedEdge Operations") so we can exclude
-- them from customer-facing reports and filter them in admin views.
ALTER TABLE practices
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_practices_is_internal
  ON practices (is_internal)
  WHERE is_internal = true;

-- ---------------------------------------------------------------------------
-- 3. New enums for rule schema v2
-- ---------------------------------------------------------------------------

-- BCBS is a federation of ~33 independent licensees with their own coverage
-- policies. We add the enum now so the new rule tables can reference it,
-- but no rules use it yet — Sprint 5 will populate BCBS rules per licensee.
DO $$ BEGIN
  CREATE TYPE bcbs_licensee AS ENUM (
    'anthem',
    'highmark',
    'bcbsil',
    'bcbsmi',
    'bcbsma',
    'bcbsnc',
    'bcbsfl',
    'bcbstx',
    'horizon_bcbsnj',
    'carefirst',
    'independence',
    'regence',
    'premera',
    'wellmark',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Audit log action types
DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'insert',
    'update',
    'delete',
    'soft_delete',
    'restore'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Where the audit-logged change came from. Lets us distinguish manual admin
-- edits from automated Policy Watch updates and bulk imports.
DO $$ BEGIN
  CREATE TYPE audit_source AS ENUM (
    'manual',         -- super_admin via admin dashboard
    'bootstrap',      -- one-time setup scripts
    'seed',           -- bulk seed from JSON files
    'policy_watch',   -- future automated policy scraper
    'api'             -- programmatic API caller
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- -------------------------------------------------
-- 20260408000002_schema_refactor_new_rule_tables.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Part 2 of 6: payer_rules_drug + payer_rules_procedure
--
-- The original payer_rules table conflated drug PA rules (J-codes, biologics,
-- step therapy, lab requirements) with procedure PA rules (Mohs, phototherapy,
-- patch testing). They have meaningfully different documentation patterns and
-- different audit needs, so we split them.
--
-- DESIGN NOTES
-- ============
-- 1. Hybrid drug/procedure rules are NOT supported. A rule references either
--    a drug (HCPCS J-code or NDC) OR a procedure (CPT). If a payer's policy
--    bundles both (e.g. "biologic injection administered in office"), it must
--    be entered as two separate rules. We document this in the agent doc.
--
-- 2. submission_method and typical_turnaround_days are nullable here. They
--    exist on both new tables specifically so the payer_rules compatibility
--    view (Part 4) has somewhere to source those columns from. They will be
--    populated naturally as rules are entered through the admin dashboard.
--
-- 3. Soft delete via deleted_at + deleted_by. The audit triggers in Part 3
--    treat this as 'soft_delete' rather than 'delete'.
--
-- 4. confidence_score < 0.8 will display a "not fully verified" warning in
--    the UI. We keep the same convention as the old table.

-- ---------------------------------------------------------------------------
-- payer_rules_drug
-- ---------------------------------------------------------------------------
CREATE TABLE payer_rules_drug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Payer identification
  payer_name text NOT NULL,
  plan_type text NOT NULL,
  bcbs_licensee bcbs_licensee, -- nullable: only set when payer_name = 'BCBS'

  -- Drug identification (one of these MUST be set)
  hcpcs_code text,    -- J-code (e.g. J7500 for Dupixent)
  ndc_code text,      -- 11-digit NDC
  drug_name text NOT NULL,
  CHECK (hcpcs_code IS NOT NULL OR ndc_code IS NOT NULL),

  -- Diagnosis scoping
  icd10_codes text[] NOT NULL DEFAULT '{}',  -- empty = applies to any diagnosis

  -- The rule
  pa_required boolean NOT NULL,
  documentation_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Drug-specific fields
  step_therapy_required boolean NOT NULL DEFAULT false,
  step_therapy_details jsonb, -- structured: required_drugs, duration, exceptions
  appeals_pathway jsonb,      -- structured: levels, deadlines, required forms
  lab_requirements jsonb,     -- structured: TB test, CBC, LFT, etc.

  -- Compatibility shim columns (nullable, exist for the payer_rules view)
  submission_method submission_method,
  typical_turnaround_days integer,

  -- Provenance
  source_url text NOT NULL,
  source_document_excerpt text, -- the exact policy snippet this rule was derived from
  last_verified_date date NOT NULL,
  last_verified_by uuid REFERENCES auth.users(id),
  confidence_score real NOT NULL DEFAULT 0.7
    CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Lifecycle
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_drug_lookup ON payer_rules_drug (payer_name, plan_type, hcpcs_code)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_drug_ndc ON payer_rules_drug (ndc_code)
  WHERE ndc_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_drug_payer ON payer_rules_drug (payer_name)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_drug_stale ON payer_rules_drug (last_verified_date)
  WHERE deleted_at IS NULL;

CREATE TRIGGER payer_rules_drug_updated_at
  BEFORE UPDATE ON payer_rules_drug
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE payer_rules_drug IS
  'PA rules for drugs (biologics, injectables) identified by HCPCS J-code or NDC. Separated from procedure rules because drugs have different audit patterns (step therapy, lab requirements, NDC-level precision).';

-- ---------------------------------------------------------------------------
-- payer_rules_procedure
-- ---------------------------------------------------------------------------
CREATE TABLE payer_rules_procedure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Payer identification
  payer_name text NOT NULL,
  plan_type text NOT NULL,
  bcbs_licensee bcbs_licensee,

  -- Procedure identification
  cpt_code text NOT NULL,
  procedure_name text NOT NULL,

  -- Diagnosis scoping
  icd10_codes text[] NOT NULL DEFAULT '{}',

  -- The rule
  pa_required boolean NOT NULL,
  documentation_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Procedure-specific fields
  site_of_service_restrictions jsonb, -- e.g. office vs ASC vs HOPD
  modifier_requirements jsonb,        -- e.g. -25, -59, anatomic modifiers
  units_or_frequency_limits jsonb,    -- e.g. 1 per 12 months, max 4 lesions
  appeals_pathway jsonb,

  -- Compatibility shim columns
  submission_method submission_method,
  typical_turnaround_days integer,

  -- Provenance
  source_url text NOT NULL,
  source_document_excerpt text,
  last_verified_date date NOT NULL,
  last_verified_by uuid REFERENCES auth.users(id),
  confidence_score real NOT NULL DEFAULT 0.7
    CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Lifecycle
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_proc_lookup ON payer_rules_procedure (payer_name, plan_type, cpt_code)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_proc_payer ON payer_rules_procedure (payer_name)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_proc_cpt ON payer_rules_procedure (cpt_code)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_proc_stale ON payer_rules_procedure (last_verified_date)
  WHERE deleted_at IS NULL;

CREATE TRIGGER payer_rules_procedure_updated_at
  BEFORE UPDATE ON payer_rules_procedure
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE payer_rules_procedure IS
  'PA rules for procedures (Mohs, phototherapy, patch testing) identified by CPT. Separated from drug rules because procedures have different audit patterns (site-of-service, modifiers, frequency limits).';


-- -------------------------------------------------
-- 20260408000003_schema_refactor_audit_log.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Part 3 of 6: rule_audit_log table + immutability constraints + triggers
--
-- The audit log captures every change to payer_rules_drug and
-- payer_rules_procedure. It is intentionally separate from pa_activity_log:
--   * Different audience: super_admins reviewing rule changes vs practice
--     staff reviewing PA workflow
--   * Different retention: rule audit must be kept indefinitely for
--     compliance; PA activity is scoped to the PA lifecycle
--   * Different RLS: rule audit is super_admin only; PA activity is
--     practice-scoped
--
-- Triggers read actor / reason / source from session GUCs:
--   * app.current_user_id  — auth.uid() at the start of the request
--   * app.change_reason    — short string explaining why
--   * app.audit_source     — enum value (manual, bootstrap, seed, ...)
-- The app sets these via set_config() before any rule mutation; the audit
-- helper module in src/lib/audit-context.ts wraps that.

-- ---------------------------------------------------------------------------
-- rule_audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE rule_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which row was changed (one of these is set, never both)
  drug_rule_id uuid REFERENCES payer_rules_drug(id) ON DELETE SET NULL,
  procedure_rule_id uuid REFERENCES payer_rules_procedure(id) ON DELETE SET NULL,
  CHECK (
    (drug_rule_id IS NOT NULL AND procedure_rule_id IS NULL) OR
    (drug_rule_id IS NULL AND procedure_rule_id IS NOT NULL)
  ),

  -- What kind of change
  action audit_action NOT NULL,
  source audit_source NOT NULL,

  -- Who and why
  actor_user_id uuid REFERENCES auth.users(id),
  change_reason text,

  -- Full snapshots so we can reconstruct any historical version
  row_before jsonb,
  row_after jsonb,

  -- Diff for cheap rendering in the admin UI (computed in the trigger)
  changed_fields text[],

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Immutability: once a row exists in the audit log it cannot be updated
-- or deleted. Even super_admins are blocked. The only legitimate operation
-- is INSERT (from the triggers).
CREATE OR REPLACE FUNCTION rule_audit_log_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'rule_audit_log is immutable: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rule_audit_log_no_update
  BEFORE UPDATE ON rule_audit_log
  FOR EACH ROW EXECUTE FUNCTION rule_audit_log_block_mutation();

CREATE TRIGGER rule_audit_log_no_delete
  BEFORE DELETE ON rule_audit_log
  FOR EACH ROW EXECUTE FUNCTION rule_audit_log_block_mutation();

CREATE INDEX idx_audit_drug_rule ON rule_audit_log (drug_rule_id, created_at DESC)
  WHERE drug_rule_id IS NOT NULL;
CREATE INDEX idx_audit_procedure_rule ON rule_audit_log (procedure_rule_id, created_at DESC)
  WHERE procedure_rule_id IS NOT NULL;
CREATE INDEX idx_audit_actor ON rule_audit_log (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_source ON rule_audit_log (source, created_at DESC);

COMMENT ON TABLE rule_audit_log IS
  'Immutable audit log of all changes to payer_rules_drug and payer_rules_procedure. Insert-only. Reads restricted to super_admin role via RLS.';

-- ---------------------------------------------------------------------------
-- Trigger function shared by both rule tables
-- ---------------------------------------------------------------------------
-- Reads context from session GUCs. Falls back to NULL/'manual' if the app
-- forgot to set them — better to log an incomplete audit row than to fail
-- the underlying mutation.
CREATE OR REPLACE FUNCTION rule_audit_capture()
RETURNS TRIGGER AS $$
DECLARE
  v_actor uuid;
  v_reason text;
  v_source audit_source;
  v_action audit_action;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_drug_id uuid;
  v_proc_id uuid;
BEGIN
  -- Pull session context (true = missing_ok, returns NULL instead of error)
  BEGIN
    v_actor := nullif(current_setting('app.current_user_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN v_actor := NULL;
  END;

  v_reason := nullif(current_setting('app.change_reason', true), '');

  BEGIN
    v_source := nullif(current_setting('app.audit_source', true), '')::audit_source;
  EXCEPTION WHEN OTHERS THEN v_source := NULL;
  END;
  IF v_source IS NULL THEN
    v_source := 'manual';
  END IF;

  -- Determine action and snapshots
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect soft delete vs restore vs ordinary update
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'soft_delete';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'restore';
    ELSE
      v_action := 'update';
    END IF;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    -- Compute changed field names by comparing the two jsonbs
    SELECT array_agg(key) INTO v_changed
    FROM jsonb_each(v_after)
    WHERE v_after -> key IS DISTINCT FROM v_before -> key
      AND key NOT IN ('updated_at'); -- updated_at always changes; not interesting
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Figure out which table fired this trigger
  IF TG_TABLE_NAME = 'payer_rules_drug' THEN
    v_drug_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'payer_rules_procedure' THEN
    v_proc_id := COALESCE(NEW.id, OLD.id);
  END IF;

  INSERT INTO rule_audit_log (
    drug_rule_id,
    procedure_rule_id,
    action,
    source,
    actor_user_id,
    change_reason,
    row_before,
    row_after,
    changed_fields
  ) VALUES (
    v_drug_id,
    v_proc_id,
    v_action,
    v_source,
    v_actor,
    v_reason,
    v_before,
    v_after,
    v_changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach to both rule tables, AFTER the change so we capture the final state
CREATE TRIGGER payer_rules_drug_audit
  AFTER INSERT OR UPDATE OR DELETE ON payer_rules_drug
  FOR EACH ROW EXECUTE FUNCTION rule_audit_capture();

CREATE TRIGGER payer_rules_procedure_audit
  AFTER INSERT OR UPDATE OR DELETE ON payer_rules_procedure
  FOR EACH ROW EXECUTE FUNCTION rule_audit_capture();


-- -------------------------------------------------
-- 20260408000004_schema_refactor_migrate_data.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Part 4 of 6: rename old payer_rules table and migrate data
--
-- We rename the existing payer_rules table to payer_rules_legacy_v1 instead
-- of dropping it. This preserves the original rows in case the migration
-- heuristic gets anything wrong, and the next migration (Part 5) replaces
-- the payer_rules name with a VIEW unioning the two new tables.
--
-- Migration heuristic: rules where cpt_code starts with 'J' are drugs
-- (HCPCS J-codes); everything else is a procedure (CPT). This holds for
-- the current 25 seed rules but is best-effort — the 'seed' audit_source
-- and confidence_score = 0.5 mark every migrated row for re-verification
-- in Sprint 5.

-- ---------------------------------------------------------------------------
-- 1. Rename old table out of the way (preserves data, drops nothing)
-- ---------------------------------------------------------------------------
ALTER TABLE payer_rules RENAME TO payer_rules_legacy_v1;
ALTER INDEX idx_payer_rules_lookup RENAME TO idx_payer_rules_legacy_v1_lookup;
ALTER INDEX idx_payer_rules_payer  RENAME TO idx_payer_rules_legacy_v1_payer;
ALTER INDEX idx_payer_rules_cpt    RENAME TO idx_payer_rules_legacy_v1_cpt;
ALTER TRIGGER payer_rules_updated_at ON payer_rules_legacy_v1
  RENAME TO payer_rules_legacy_v1_updated_at;

COMMENT ON TABLE payer_rules_legacy_v1 IS
  'Frozen snapshot of the original payer_rules table before the Sprint 3 schema refactor. Read-only reference. Do not write to this table.';

-- ---------------------------------------------------------------------------
-- 2. Set audit context for the bulk migration so the trigger logs source=seed
-- ---------------------------------------------------------------------------
-- We must set these GUCs in this same session so the audit triggers on the
-- new tables tag every inserted row with the right source. The audit rows
-- become the historical record of "this came from the v1 → v2 migration".
SELECT set_config('app.audit_source', 'seed', true);
SELECT set_config('app.change_reason', 'Sprint 3 schema refactor: best-effort migration from payer_rules_legacy_v1', true);

-- ---------------------------------------------------------------------------
-- 3. Migrate J-code rules into payer_rules_drug
-- ---------------------------------------------------------------------------
-- Confidence is forced to 0.5 (well below the 0.8 verification threshold)
-- so the UI flags every migrated rule for review. Sprint 5 cleans these up.
INSERT INTO payer_rules_drug (
  payer_name,
  plan_type,
  hcpcs_code,
  drug_name,
  icd10_codes,
  pa_required,
  documentation_requirements,
  step_therapy_required,
  step_therapy_details,
  submission_method,
  typical_turnaround_days,
  source_url,
  last_verified_date,
  confidence_score
)
SELECT
  payer_name,
  plan_type,
  cpt_code AS hcpcs_code,
  -- We don't know the drug name from the legacy row; use the J-code as a
  -- placeholder. Sprint 5 cleanup will fill in real drug names.
  'UNKNOWN (' || cpt_code || ')' AS drug_name,
  CASE
    WHEN icd10_code IS NOT NULL THEN ARRAY[icd10_code]
    ELSE '{}'::text[]
  END AS icd10_codes,
  pa_required,
  documentation_requirements,
  step_therapy_required,
  -- Step therapy was a text column in v1 but is jsonb in v2. Wrap as
  -- structured payload so the field is queryable later.
  CASE
    WHEN step_therapy_details IS NOT NULL
      THEN jsonb_build_object('legacy_text', step_therapy_details)
    ELSE NULL
  END AS step_therapy_details,
  submission_method,
  typical_turnaround_days,
  source_url,
  last_verified_date,
  0.5 AS confidence_score
FROM payer_rules_legacy_v1
WHERE cpt_code LIKE 'J%';

-- ---------------------------------------------------------------------------
-- 4. Migrate non-J-code rules into payer_rules_procedure
-- ---------------------------------------------------------------------------
INSERT INTO payer_rules_procedure (
  payer_name,
  plan_type,
  cpt_code,
  procedure_name,
  icd10_codes,
  pa_required,
  documentation_requirements,
  submission_method,
  typical_turnaround_days,
  source_url,
  last_verified_date,
  confidence_score
)
SELECT
  payer_name,
  plan_type,
  cpt_code,
  'UNKNOWN (' || cpt_code || ')' AS procedure_name,
  CASE
    WHEN icd10_code IS NOT NULL THEN ARRAY[icd10_code]
    ELSE '{}'::text[]
  END AS icd10_codes,
  pa_required,
  documentation_requirements,
  submission_method,
  typical_turnaround_days,
  source_url,
  last_verified_date,
  0.5 AS confidence_score
FROM payer_rules_legacy_v1
WHERE cpt_code NOT LIKE 'J%';


-- -------------------------------------------------
-- 20260408000005_schema_refactor_compat_view.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Part 5 of 6: payer_rules compatibility view
--
-- ============================================================================
-- DOCUMENTED SEMANTIC LOSSINESS
-- ============================================================================
-- This view exists ONLY so the existing checkPARequired() function and its
-- tests keep working until Sprint 6 rewrites them against the new tables.
-- It is NOT a long-term API. Two intentional points of lossiness:
--
-- 1. ICD-10 matching: the v1 schema had a single nullable icd10_code column.
--    The v2 tables use icd10_codes text[] (multiple). The view collapses the
--    array by emitting one row per element, OR a single row with NULL when
--    the array is empty. checkPARequired's existing .find() logic happens to
--    work with this shape because it does .find(r => icd10Codes.includes(...)).
--    But two distinct v2 rules with overlapping ICD-10 sets will produce
--    duplicate rows in the view. This is acceptable because:
--      a) the existing seed data has zero rules with non-null icd10_code
--      b) Sprint 6 replaces checkPARequired anyway
--    DO NOT add new ICD-10-scoped rules through this view.
--
-- 2. step_therapy_details: was text in v1, is jsonb in v2. The view casts
--    jsonb to text via the ->> operator on a 'legacy_text' key (set during
--    the migration in Part 4) and falls back to the raw jsonb stringified
--    via #>>. New rules entered through the admin dashboard with structured
--    step_therapy_details (required_drugs, duration, exceptions) will appear
--    as an opaque JSON string in this view. The PA lookup ignores the field
--    structure, so this is harmless for reads.
--
-- 3. WRITES through this view are not supported. INSTEAD OF triggers are
--    intentionally NOT created — any INSERT/UPDATE/DELETE against payer_rules
--    will fail with a clear error directing the writer to use the new tables.
--    This forces all rule mutations to go through the admin dashboard or
--    bootstrap scripts that target the typed tables directly.
--
-- Tracked as a "Known Issue" in PROGRESS.md, severity Medium — sprint-bounded,
-- resolution Sprint 6 (rewrite checkPARequired against typed tables).
-- ============================================================================

CREATE VIEW payer_rules AS
-- Drug rules (J-codes / NDCs)
SELECT
  d.id,
  d.payer_name,
  d.plan_type,
  d.hcpcs_code AS cpt_code,
  -- Explode icd10_codes array; emit one row per code, or one row with NULL
  -- if the array is empty. unnest(NULL::text[]) yields zero rows, so we
  -- coalesce the empty case to a single-element array containing NULL.
  unnest(
    CASE
      WHEN array_length(d.icd10_codes, 1) IS NULL THEN ARRAY[NULL::text]
      ELSE d.icd10_codes
    END
  ) AS icd10_code,
  d.pa_required,
  d.documentation_requirements,
  d.submission_method,
  d.typical_turnaround_days,
  d.step_therapy_required,
  -- Lossy: structured step_therapy_details collapses to a string
  COALESCE(
    d.step_therapy_details ->> 'legacy_text',
    d.step_therapy_details #>> '{}'
  ) AS step_therapy_details,
  d.last_verified_date,
  d.source_url,
  d.confidence_score,
  d.created_at,
  d.updated_at
FROM payer_rules_drug d
WHERE d.deleted_at IS NULL

UNION ALL

-- Procedure rules (CPT)
SELECT
  p.id,
  p.payer_name,
  p.plan_type,
  p.cpt_code,
  unnest(
    CASE
      WHEN array_length(p.icd10_codes, 1) IS NULL THEN ARRAY[NULL::text]
      ELSE p.icd10_codes
    END
  ) AS icd10_code,
  p.pa_required,
  p.documentation_requirements,
  p.submission_method,
  p.typical_turnaround_days,
  -- Procedure rules don't have step therapy; expose stable defaults so the
  -- v1 result shape is preserved
  false AS step_therapy_required,
  NULL::text AS step_therapy_details,
  p.last_verified_date,
  p.source_url,
  p.confidence_score,
  p.created_at,
  p.updated_at
FROM payer_rules_procedure p
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW payer_rules IS
  'COMPATIBILITY SHIM. Read-only union of payer_rules_drug and payer_rules_procedure that mimics the pre-Sprint-3 payer_rules table shape. Has documented lossiness on ICD-10 array matching and step_therapy_details structure. Used by the legacy checkPARequired() function only. Will be removed in Sprint 6 when checkPARequired is rewritten. DO NOT use for new code.';

-- ---------------------------------------------------------------------------
-- Block writes through the view with a clear error
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION payer_rules_view_block_write()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'payer_rules is a read-only compatibility view. Write to payer_rules_drug or payer_rules_procedure directly. See docs/agent/rule-schema.md.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payer_rules_view_no_insert
  INSTEAD OF INSERT ON payer_rules
  FOR EACH ROW EXECUTE FUNCTION payer_rules_view_block_write();

CREATE TRIGGER payer_rules_view_no_update
  INSTEAD OF UPDATE ON payer_rules
  FOR EACH ROW EXECUTE FUNCTION payer_rules_view_block_write();

CREATE TRIGGER payer_rules_view_no_delete
  INSTEAD OF DELETE ON payer_rules
  FOR EACH ROW EXECUTE FUNCTION payer_rules_view_block_write();


-- -------------------------------------------------
-- 20260408000006_schema_refactor_rls_and_seed.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Part 6 of 6: RLS policies for new tables + MedEdge Operations practice
--
-- RLS model for v2 rule tables:
--   * READ: any authenticated user (rules are shared reference data, like
--     the old payer_rules table). Soft-deleted rows are filtered out.
--   * INSERT/UPDATE/DELETE: super_admin role only. Practice admins lose
--     write access to rules — Sprint 3 onward, only MedEdge Operations
--     edits payer rules.
--
-- RLS model for rule_audit_log:
--   * READ: super_admin only. Audit history is staff-internal.
--   * INSERT: never via direct policy. The audit triggers fire as the
--     trigger owner (definer privileges) and bypass RLS.
--   * UPDATE/DELETE: blocked at the trigger layer in Part 3, RLS is
--     belt-and-suspenders.
--
-- Compat view payer_rules:
--   The view itself runs with definer privileges (Postgres default), so
--   it sees all underlying rows regardless of RLS. We grant SELECT to the
--   authenticated role explicitly so anonymous users cannot read it.

-- ---------------------------------------------------------------------------
-- payer_rules_drug
-- ---------------------------------------------------------------------------
ALTER TABLE payer_rules_drug ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drug rules"
  ON payer_rules_drug FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Super admins can read all drug rules including soft-deleted"
  ON payer_rules_drug FOR SELECT
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can insert drug rules"
  ON payer_rules_drug FOR INSERT
  WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can update drug rules"
  ON payer_rules_drug FOR UPDATE
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can delete drug rules"
  ON payer_rules_drug FOR DELETE
  USING (public.get_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- payer_rules_procedure
-- ---------------------------------------------------------------------------
ALTER TABLE payer_rules_procedure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read procedure rules"
  ON payer_rules_procedure FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Super admins can read all procedure rules including soft-deleted"
  ON payer_rules_procedure FOR SELECT
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can insert procedure rules"
  ON payer_rules_procedure FOR INSERT
  WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can update procedure rules"
  ON payer_rules_procedure FOR UPDATE
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY "Super admins can delete procedure rules"
  ON payer_rules_procedure FOR DELETE
  USING (public.get_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- rule_audit_log
-- ---------------------------------------------------------------------------
ALTER TABLE rule_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read rule audit log"
  ON rule_audit_log FOR SELECT
  USING (public.get_user_role() = 'super_admin');

-- No INSERT policy. Audit rows are inserted by SECURITY DEFINER triggers
-- which bypass RLS. No UPDATE/DELETE policies — those operations are
-- blocked unconditionally by the triggers in Part 3.

-- ---------------------------------------------------------------------------
-- Compat view: explicit grant to authenticated role
-- ---------------------------------------------------------------------------
GRANT SELECT ON payer_rules TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON payer_rules FROM authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- MedEdge Operations: the internal practice that owns super_admin users
-- ---------------------------------------------------------------------------
-- Idempotent: only inserts if no internal practice exists yet. The
-- grant-super-admin.ts bootstrap script reads this row to assign the
-- practice_id when promoting a user to super_admin.
INSERT INTO practices (name, is_internal, settings)
SELECT
  'MedEdge Operations',
  true,
  '{"description": "Internal MedEdge tenant for super_admin users. Not a real customer practice."}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM practices WHERE is_internal = true
);


-- -------------------------------------------------
-- 20260408000007_schema_refactor_audit_helpers.sql
-- -------------------------------------------------
-- Schema refactor: Sprint 3
-- Audit context helper functions and bootstrap RPC
--
-- The audit triggers in Part 3 read context from session GUCs:
--   * app.current_user_id
--   * app.change_reason
--   * app.audit_source
--
-- These functions provide the supported ways to set those GUCs.

-- ---------------------------------------------------------------------------
-- bootstrap_super_admin: idempotent promotion to super_admin
-- ---------------------------------------------------------------------------
-- Used by scripts/grant-super-admin.ts. Sets the audit context locally
-- (transaction-scoped) so the user_profiles update lands in the audit log
-- with source='bootstrap' even though user_profiles isn't itself audited
-- by the rule trigger — the audit context propagates if any rule mutation
-- happens in the same tx.
--
-- Idempotency: ON CONFLICT DO UPDATE means re-running the script is safe.
-- The user must already exist in auth.users (created via signup or the
-- Supabase admin UI) before calling this.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(
  p_user_id uuid,
  p_reason text DEFAULT 'Initial super_admin bootstrap'
) RETURNS void AS $$
DECLARE
  v_internal_practice_id uuid;
BEGIN
  -- Set audit context for this transaction
  PERFORM set_config('app.current_user_id', p_user_id::text, true);
  PERFORM set_config('app.change_reason', p_reason, true);
  PERFORM set_config('app.audit_source', 'bootstrap', true);

  -- Find the MedEdge Operations practice
  SELECT id INTO v_internal_practice_id
  FROM practices
  WHERE is_internal = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_internal_practice_id IS NULL THEN
    RAISE EXCEPTION 'No internal practice found. The schema refactor migration must have created MedEdge Operations.';
  END IF;

  -- Verify the user exists in auth.users (helpful error if not)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist in auth.users. Sign up first via the app or the Supabase admin UI.', p_user_id;
  END IF;

  -- Upsert the profile to super_admin in the internal practice
  INSERT INTO user_profiles (id, practice_id, role, full_name)
  VALUES (p_user_id, v_internal_practice_id, 'super_admin', NULL)
  ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin',
        practice_id = v_internal_practice_id,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.bootstrap_super_admin(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin(uuid, text) TO service_role;

COMMENT ON FUNCTION public.bootstrap_super_admin(uuid, text) IS
  'Idempotently promotes an existing auth.users row to super_admin in the MedEdge Operations practice. Service-role only. Called by scripts/grant-super-admin.ts.';

