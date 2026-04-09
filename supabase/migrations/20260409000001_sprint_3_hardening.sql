-- Sprint 3 hardening: address Supabase advisor findings on the v2 schema
--
-- This migration cleans up two classes of advisor findings introduced (or
-- newly visible) by the Sprint 3 schema refactor. It is intentionally
-- scoped to objects created in Sprint 3 — pre-existing functions
-- (update_updated_at, get_practice_id, get_user_role, handle_new_user)
-- have the same search_path warning but predate this work and will be
-- handled in a separate hardening pass to avoid scope creep.
--
-- ============================================================================
-- 1. payer_rules compat view: switch to security_invoker = on  (ADVISOR ERROR)
-- ============================================================================
-- By default Postgres views run with the privileges of the view owner, which
-- effectively bypasses RLS on the underlying tables. The Supabase linter flags
-- this as ERROR (`security_definer_view`, lint 0010). We want the compat view
-- to honor the calling user's RLS, so:
--   * Authenticated users still see all non-deleted rules (matches the SELECT
--     policies on payer_rules_drug and payer_rules_procedure).
--   * The service_role bypasses RLS regardless, so server-side reads continue
--     to work.
--   * Anonymous role has no GRANT on the view (revoked in Part 6) so it
--     cannot reach the view at all.
-- This is a no-op for current callers but closes the linter ERROR and makes
-- the view safe to keep around until Sprint 6 retires it.

ALTER VIEW public.payer_rules SET (security_invoker = on);

-- ============================================================================
-- 2. Pin search_path on the 4 functions Sprint 3 added  (ADVISOR WARN x4)
-- ============================================================================
-- Linter rule `function_search_path_mutable` (0011) flags any function whose
-- search_path is not pinned. The vector is: a malicious user creates a
-- shadow object in their own schema (e.g. a fake `practices` table), and a
-- function that looks up `practices` without qualification could resolve to
-- the attacker's object instead. SECURITY DEFINER functions are the most
-- dangerous because they run with elevated privileges; trigger functions
-- are also affected because their search_path is inherited from the calling
-- session.
--
-- Fix: pin search_path = pg_catalog, public on all four. We use this exact
-- value (rather than empty + full qualification) because:
--   * pg_catalog gives us built-ins like current_setting, nullif, now,
--     to_jsonb, jsonb_each, set_config, RAISE, COALESCE, etc.
--   * public is where every table these functions touch already lives.
--   * No third-party schemas appear in the search_path, so shadow objects
--     in user-controlled schemas (e.g. an attacker creates `myschema.practices`)
--     can never resolve.

-- bootstrap_super_admin: SECURITY DEFINER, called by service_role only.
-- Highest priority because it can promote users to super_admin.
ALTER FUNCTION public.bootstrap_super_admin(uuid, text)
  SET search_path = pg_catalog, public;

-- rule_audit_capture: trigger function, fires on every drug/procedure mutation.
-- Reads GUCs and writes to rule_audit_log.
ALTER FUNCTION public.rule_audit_capture()
  SET search_path = pg_catalog, public;

-- rule_audit_log_block_mutation: trigger function, blocks update/delete on
-- the audit log.
ALTER FUNCTION public.rule_audit_log_block_mutation()
  SET search_path = pg_catalog, public;

-- payer_rules_view_block_write: INSTEAD OF trigger function on the compat view
ALTER FUNCTION public.payer_rules_view_block_write()
  SET search_path = pg_catalog, public;

-- ============================================================================
-- Verification (manual after applying):
-- ============================================================================
--   SELECT mcp.get_advisors('security')
-- should return zero `security_definer_view` and zero `function_search_path_mutable`
-- entries for the four functions above. The four pre-existing functions
-- (update_updated_at, get_practice_id, get_user_role, handle_new_user) will
-- still appear; that is intentional and tracked separately.
