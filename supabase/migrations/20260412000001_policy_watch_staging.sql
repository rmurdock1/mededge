-- Sprint 7: Policy Watch — staging tables for AI-extracted payer rules
--
-- Policy Watch lets super_admins feed payer coverage policy documents into the
-- system. Claude AI extracts structured PA rules, stages them for human review,
-- and upon approval writes them to the production rule tables.
--
-- Two tables:
--   1. policy_watch_documents — tracks ingested documents and extraction state
--   2. policy_watch_staged_rules — review queue of extracted rules
--
-- No existing tables are modified. The audit_source='policy_watch' enum value
-- and source_document_excerpt columns were added in Sprint 3.

-- ---- Enums ----

CREATE TYPE policy_watch_document_status AS ENUM (
  'pending_extraction',
  'extracting',
  'extracted',
  'extraction_failed',
  'completed',
  'archived'
);

CREATE TYPE staged_rule_status AS ENUM (
  'pending_review',
  'approved',
  'rejected'
);

CREATE TYPE staged_rule_kind AS ENUM (
  'drug',
  'procedure'
);

-- ---- Documents table ----

CREATE TABLE policy_watch_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was ingested
  source_url text NOT NULL,
  source_text text NOT NULL,
  payer_name_hint text,
  plan_type_hint text,

  -- Extraction state
  status policy_watch_document_status NOT NULL DEFAULT 'pending_extraction',
  extraction_started_at timestamptz,
  extraction_completed_at timestamptz,
  extraction_error text,

  -- Claude API metadata (debugging + cost tracking)
  claude_model text,
  claude_input_tokens integer,
  claude_output_tokens integer,
  raw_extraction_json jsonb,

  -- Provenance
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE policy_watch_documents IS
  'Payer coverage policy documents ingested for AI extraction. Each document yields 0-N staged rules.';

CREATE INDEX idx_pw_doc_status ON policy_watch_documents (status);
CREATE INDEX idx_pw_doc_uploaded_by ON policy_watch_documents (uploaded_by);

CREATE TRIGGER policy_watch_documents_updated_at
  BEFORE UPDATE ON policy_watch_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- Staged rules table (review queue) ----

CREATE TABLE policy_watch_staged_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to source document
  document_id uuid NOT NULL REFERENCES policy_watch_documents(id) ON DELETE CASCADE,

  -- What kind of rule
  rule_kind staged_rule_kind NOT NULL,

  -- The extracted rule data — validated against drugRuleFormSchema / procedureRuleFormSchema on approval
  extracted_data jsonb NOT NULL,

  -- The exact text excerpt Claude cited for this rule
  source_excerpt text,

  -- Claude's self-assessed confidence in this extraction
  extraction_confidence text CHECK (extraction_confidence IN ('high', 'medium', 'low')),

  -- Review state
  status staged_rule_status NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,

  -- If approved, link to the production rule that was created
  production_drug_rule_id uuid REFERENCES payer_rules_drug(id),
  production_procedure_rule_id uuid REFERENCES payer_rules_procedure(id),

  -- Lifecycle
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Integrity: approved rules must link to exactly one production rule
  CHECK (
    (status <> 'approved') OR
    (production_drug_rule_id IS NOT NULL AND rule_kind = 'drug') OR
    (production_procedure_rule_id IS NOT NULL AND rule_kind = 'procedure')
  )
);

COMMENT ON TABLE policy_watch_staged_rules IS
  'Review queue of AI-extracted rules. Each row is a single rule awaiting human approval before entering production.';

CREATE INDEX idx_pw_staged_document ON policy_watch_staged_rules (document_id);
CREATE INDEX idx_pw_staged_status ON policy_watch_staged_rules (status);
CREATE INDEX idx_pw_staged_review_queue ON policy_watch_staged_rules (status, created_at)
  WHERE status = 'pending_review';

CREATE TRIGGER policy_watch_staged_rules_updated_at
  BEFORE UPDATE ON policy_watch_staged_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- RLS ----

ALTER TABLE policy_watch_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all" ON policy_watch_documents
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

ALTER TABLE policy_watch_staged_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all" ON policy_watch_staged_rules
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');
