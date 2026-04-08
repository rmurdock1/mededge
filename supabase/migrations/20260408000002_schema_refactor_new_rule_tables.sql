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
