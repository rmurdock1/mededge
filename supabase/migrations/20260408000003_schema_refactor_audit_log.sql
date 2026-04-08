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
--
-- TODO (Sprint 6 or 7): flip to strict mode. Once every writer (admin
-- dashboard, seed scripts, Policy Watch) reliably sets app.audit_source,
-- this function should RAISE EXCEPTION when the GUC is missing instead
-- of silently defaulting to 'manual'. The RAISE NOTICE warnings emitted
-- below give us visibility into which call sites still need to be fixed
-- before we can turn strict mode on.
CREATE OR REPLACE FUNCTION rule_audit_capture()
RETURNS TRIGGER AS $$
DECLARE
  v_actor uuid;
  v_reason text;
  v_source audit_source;
  v_source_raw text;
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

  v_source_raw := nullif(current_setting('app.audit_source', true), '');
  BEGIN
    v_source := v_source_raw::audit_source;
  EXCEPTION WHEN OTHERS THEN v_source := NULL;
  END;

  -- Fallback path: emit a NOTICE so we can see in the Postgres logs which
  -- writers still need to be retrofitted to set the audit context. Do NOT
  -- raise — the cost of a missing GUC is a less informative audit entry,
  -- not data loss, and failing the underlying mutation would be worse.
  IF v_source IS NULL THEN
    RAISE NOTICE
      'rule_audit_capture: app.audit_source not set on % of %; falling back to manual. actor=% reason=%',
      TG_OP, TG_TABLE_NAME, v_actor, v_reason;
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
