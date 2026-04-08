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
