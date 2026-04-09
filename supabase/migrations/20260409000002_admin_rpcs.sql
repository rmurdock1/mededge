-- Sprint 4: Admin CRUD RPCs for payer_rules_drug and payer_rules_procedure
--
-- These 6 SECURITY DEFINER functions are the sole write path for rules from
-- the admin dashboard. Each function:
--   1. Guards: caller must be super_admin
--   2. Guards: change_reason must be non-empty
--   3. Sets audit GUCs transaction-locally so the rule_audit_capture trigger
--      records the right actor, reason, and source
--   4. Performs the mutation
--   5. Returns the affected row (upsert) or void (soft-delete/restore)
--
-- All functions pin search_path = pg_catalog, public per Sprint 3 hardening.
-- Granted to authenticated only; the internal get_user_role() check narrows
-- access to super_admin.

-- ============================================================================
-- Helper: set_audit_context (DRY across all 6 RPCs)
-- ============================================================================
-- Not exposed via PostgREST (no GRANT). Called internally by each RPC.
CREATE OR REPLACE FUNCTION public._set_audit_context(
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS void AS $$
BEGIN
  IF p_change_reason IS NULL OR trim(p_change_reason) = '' THEN
    RAISE EXCEPTION 'change_reason is required for all rule mutations';
  END IF;

  PERFORM set_config('app.current_user_id', COALESCE(p_actor_user_id::text, ''), true);
  PERFORM set_config('app.change_reason', p_change_reason, true);
  PERFORM set_config('app.audit_source', p_audit_source::text, true);
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

-- No public access — only called by other functions in this file
REVOKE EXECUTE ON FUNCTION public._set_audit_context(uuid, text, audit_source) FROM public, anon, authenticated;

-- ============================================================================
-- 1. admin_upsert_drug_rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_drug_rule(
  p_payload jsonb,
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS jsonb AS $$
DECLARE
  v_id uuid;
  v_result payer_rules_drug;
BEGIN
  -- Guard: super_admin only
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  -- Set audit context
  PERFORM public._set_audit_context(p_actor_user_id, p_change_reason, p_audit_source);

  v_id := (p_payload->>'id')::uuid;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM payer_rules_drug WHERE id = v_id) THEN
    -- UPDATE existing rule
    UPDATE payer_rules_drug SET
      payer_name = COALESCE(p_payload->>'payer_name', payer_name),
      plan_type = COALESCE(p_payload->>'plan_type', plan_type),
      bcbs_licensee = (p_payload->>'bcbs_licensee')::bcbs_licensee,
      hcpcs_code = p_payload->>'hcpcs_code',
      ndc_code = p_payload->>'ndc_code',
      drug_name = COALESCE(p_payload->>'drug_name', drug_name),
      icd10_codes = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(p_payload->'icd10_codes')),
        icd10_codes
      ),
      pa_required = COALESCE((p_payload->>'pa_required')::boolean, pa_required),
      documentation_requirements = COALESCE(p_payload->'documentation_requirements', documentation_requirements),
      step_therapy_required = COALESCE((p_payload->>'step_therapy_required')::boolean, step_therapy_required),
      step_therapy_details = p_payload->'step_therapy_details',
      appeals_pathway = p_payload->'appeals_pathway',
      lab_requirements = p_payload->'lab_requirements',
      submission_method = (p_payload->>'submission_method')::submission_method,
      typical_turnaround_days = (p_payload->>'typical_turnaround_days')::integer,
      source_url = COALESCE(p_payload->>'source_url', source_url),
      source_document_excerpt = p_payload->>'source_document_excerpt',
      last_verified_date = COALESCE((p_payload->>'last_verified_date')::date, CURRENT_DATE),
      last_verified_by = p_actor_user_id,
      confidence_score = COALESCE((p_payload->>'confidence_score')::real, confidence_score)
    WHERE id = v_id
    RETURNING * INTO v_result;
  ELSE
    -- INSERT new rule
    INSERT INTO payer_rules_drug (
      payer_name,
      plan_type,
      bcbs_licensee,
      hcpcs_code,
      ndc_code,
      drug_name,
      icd10_codes,
      pa_required,
      documentation_requirements,
      step_therapy_required,
      step_therapy_details,
      appeals_pathway,
      lab_requirements,
      submission_method,
      typical_turnaround_days,
      source_url,
      source_document_excerpt,
      last_verified_date,
      last_verified_by,
      confidence_score
    ) VALUES (
      p_payload->>'payer_name',
      p_payload->>'plan_type',
      (p_payload->>'bcbs_licensee')::bcbs_licensee,
      p_payload->>'hcpcs_code',
      p_payload->>'ndc_code',
      p_payload->>'drug_name',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_payload->'icd10_codes')), '{}'::text[]),
      (p_payload->>'pa_required')::boolean,
      COALESCE(p_payload->'documentation_requirements', '[]'::jsonb),
      COALESCE((p_payload->>'step_therapy_required')::boolean, false),
      p_payload->'step_therapy_details',
      p_payload->'appeals_pathway',
      p_payload->'lab_requirements',
      (p_payload->>'submission_method')::submission_method,
      (p_payload->>'typical_turnaround_days')::integer,
      p_payload->>'source_url',
      p_payload->>'source_document_excerpt',
      COALESCE((p_payload->>'last_verified_date')::date, CURRENT_DATE),
      p_actor_user_id,
      COALESCE((p_payload->>'confidence_score')::real, 0.7)
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN to_jsonb(v_result);
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.admin_upsert_drug_rule(jsonb, uuid, text, audit_source) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_drug_rule(jsonb, uuid, text, audit_source) TO authenticated;

-- ============================================================================
-- 2. admin_upsert_procedure_rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_procedure_rule(
  p_payload jsonb,
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS jsonb AS $$
DECLARE
  v_id uuid;
  v_result payer_rules_procedure;
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  PERFORM public._set_audit_context(p_actor_user_id, p_change_reason, p_audit_source);

  v_id := (p_payload->>'id')::uuid;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM payer_rules_procedure WHERE id = v_id) THEN
    UPDATE payer_rules_procedure SET
      payer_name = COALESCE(p_payload->>'payer_name', payer_name),
      plan_type = COALESCE(p_payload->>'plan_type', plan_type),
      bcbs_licensee = (p_payload->>'bcbs_licensee')::bcbs_licensee,
      cpt_code = COALESCE(p_payload->>'cpt_code', cpt_code),
      procedure_name = COALESCE(p_payload->>'procedure_name', procedure_name),
      icd10_codes = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(p_payload->'icd10_codes')),
        icd10_codes
      ),
      pa_required = COALESCE((p_payload->>'pa_required')::boolean, pa_required),
      documentation_requirements = COALESCE(p_payload->'documentation_requirements', documentation_requirements),
      site_of_service_restrictions = p_payload->'site_of_service_restrictions',
      modifier_requirements = p_payload->'modifier_requirements',
      units_or_frequency_limits = p_payload->'units_or_frequency_limits',
      appeals_pathway = p_payload->'appeals_pathway',
      submission_method = (p_payload->>'submission_method')::submission_method,
      typical_turnaround_days = (p_payload->>'typical_turnaround_days')::integer,
      source_url = COALESCE(p_payload->>'source_url', source_url),
      source_document_excerpt = p_payload->>'source_document_excerpt',
      last_verified_date = COALESCE((p_payload->>'last_verified_date')::date, CURRENT_DATE),
      last_verified_by = p_actor_user_id,
      confidence_score = COALESCE((p_payload->>'confidence_score')::real, confidence_score)
    WHERE id = v_id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO payer_rules_procedure (
      payer_name,
      plan_type,
      bcbs_licensee,
      cpt_code,
      procedure_name,
      icd10_codes,
      pa_required,
      documentation_requirements,
      site_of_service_restrictions,
      modifier_requirements,
      units_or_frequency_limits,
      appeals_pathway,
      submission_method,
      typical_turnaround_days,
      source_url,
      source_document_excerpt,
      last_verified_date,
      last_verified_by,
      confidence_score
    ) VALUES (
      p_payload->>'payer_name',
      p_payload->>'plan_type',
      (p_payload->>'bcbs_licensee')::bcbs_licensee,
      p_payload->>'cpt_code',
      p_payload->>'procedure_name',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_payload->'icd10_codes')), '{}'::text[]),
      (p_payload->>'pa_required')::boolean,
      COALESCE(p_payload->'documentation_requirements', '[]'::jsonb),
      p_payload->'site_of_service_restrictions',
      p_payload->'modifier_requirements',
      p_payload->'units_or_frequency_limits',
      p_payload->'appeals_pathway',
      (p_payload->>'submission_method')::submission_method,
      (p_payload->>'typical_turnaround_days')::integer,
      p_payload->>'source_url',
      p_payload->>'source_document_excerpt',
      COALESCE((p_payload->>'last_verified_date')::date, CURRENT_DATE),
      p_actor_user_id,
      COALESCE((p_payload->>'confidence_score')::real, 0.7)
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN to_jsonb(v_result);
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.admin_upsert_procedure_rule(jsonb, uuid, text, audit_source) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_procedure_rule(jsonb, uuid, text, audit_source) TO authenticated;

-- ============================================================================
-- 3. admin_soft_delete_drug_rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_soft_delete_drug_rule(
  p_rule_id uuid,
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS void AS $$
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  PERFORM public._set_audit_context(p_actor_user_id, p_change_reason, p_audit_source);

  UPDATE payer_rules_drug
  SET deleted_at = now(), deleted_by = p_actor_user_id
  WHERE id = p_rule_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Drug rule % not found or already deleted', p_rule_id;
  END IF;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.admin_soft_delete_drug_rule(uuid, uuid, text, audit_source) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_drug_rule(uuid, uuid, text, audit_source) TO authenticated;

-- ============================================================================
-- 4. admin_soft_delete_procedure_rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_soft_delete_procedure_rule(
  p_rule_id uuid,
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS void AS $$
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  PERFORM public._set_audit_context(p_actor_user_id, p_change_reason, p_audit_source);

  UPDATE payer_rules_procedure
  SET deleted_at = now(), deleted_by = p_actor_user_id
  WHERE id = p_rule_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procedure rule % not found or already deleted', p_rule_id;
  END IF;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.admin_soft_delete_procedure_rule(uuid, uuid, text, audit_source) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_procedure_rule(uuid, uuid, text, audit_source) TO authenticated;

-- ============================================================================
-- 5. admin_restore_drug_rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_restore_drug_rule(
  p_rule_id uuid,
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS void AS $$
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  PERFORM public._set_audit_context(p_actor_user_id, p_change_reason, p_audit_source);

  UPDATE payer_rules_drug
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_rule_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Drug rule % not found or not deleted', p_rule_id;
  END IF;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.admin_restore_drug_rule(uuid, uuid, text, audit_source) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_drug_rule(uuid, uuid, text, audit_source) TO authenticated;

-- ============================================================================
-- 6. admin_restore_procedure_rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_restore_procedure_rule(
  p_rule_id uuid,
  p_actor_user_id uuid,
  p_change_reason text,
  p_audit_source audit_source DEFAULT 'manual'
) RETURNS void AS $$
BEGIN
  IF public.get_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  PERFORM public._set_audit_context(p_actor_user_id, p_change_reason, p_audit_source);

  UPDATE payer_rules_procedure
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_rule_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procedure rule % not found or not deleted', p_rule_id;
  END IF;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.admin_restore_procedure_rule(uuid, uuid, text, audit_source) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_procedure_rule(uuid, uuid, text, audit_source) TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION public.admin_upsert_drug_rule(jsonb, uuid, text, audit_source) IS
  'Insert or update a drug PA rule. Sets audit context atomically. Super_admin only.';
COMMENT ON FUNCTION public.admin_upsert_procedure_rule(jsonb, uuid, text, audit_source) IS
  'Insert or update a procedure PA rule. Sets audit context atomically. Super_admin only.';
COMMENT ON FUNCTION public.admin_soft_delete_drug_rule(uuid, uuid, text, audit_source) IS
  'Soft-delete a drug PA rule (set deleted_at/deleted_by). Super_admin only.';
COMMENT ON FUNCTION public.admin_soft_delete_procedure_rule(uuid, uuid, text, audit_source) IS
  'Soft-delete a procedure PA rule. Super_admin only.';
COMMENT ON FUNCTION public.admin_restore_drug_rule(uuid, uuid, text, audit_source) IS
  'Restore a soft-deleted drug PA rule. Super_admin only.';
COMMENT ON FUNCTION public.admin_restore_procedure_rule(uuid, uuid, text, audit_source) IS
  'Restore a soft-deleted procedure PA rule. Super_admin only.';
