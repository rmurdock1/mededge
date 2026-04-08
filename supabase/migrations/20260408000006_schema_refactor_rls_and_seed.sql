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
