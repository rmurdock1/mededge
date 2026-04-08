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
