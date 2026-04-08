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
