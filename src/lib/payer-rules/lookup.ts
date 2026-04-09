import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PALookupResult,
  PALookupResultDrug,
  PALookupResultProcedure,
  PALookupResultUnknown,
  LookupMiss,
} from "./types";
import { classifyCode } from "./code-utils";
import type { CodeKind } from "./types";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Core PA requirement lookup — deterministic database query, NOT AI.
// ---------------------------------------------------------------------------

/**
 * Given a payer, plan type, and list of billing codes (HCPCS or CPT),
 * returns whether PA is required for each. The function automatically
 * classifies each code as drug or procedure and queries the appropriate
 * typed table (`payer_rules_drug` or `payer_rules_procedure`).
 *
 * When no rule exists for a combination, returns kind:"unknown" and logs
 * the miss so we know which rules to add next.
 *
 * Optionally narrows by ICD-10 diagnosis codes — rules whose `icd10_codes`
 * array overlaps the provided diagnoses are preferred over generic rules.
 */
export async function checkPARequired(
  supabase: SupabaseClient,
  payerName: string,
  planType: string,
  codes: string[],
  icd10Codes?: string[],
  codeKindHint?: CodeKind
): Promise<PALookupResult[]> {
  const results: PALookupResult[] = [];
  const misses: LookupMiss[] = [];

  for (const code of codes) {
    const kind = classifyCode(code, codeKindHint);

    const result =
      kind === "drug"
        ? await lookupDrugRule(supabase, payerName, planType, code, icd10Codes)
        : await lookupProcedureRule(supabase, payerName, planType, code, icd10Codes);

    if (result.kind === "unknown") {
      misses.push({
        payer_name: payerName,
        plan_type: planType,
        code,
        code_kind: kind,
        icd10_codes: icd10Codes ?? [],
        looked_up_at: new Date().toISOString(),
      });
    }

    results.push(result);
  }

  if (misses.length > 0) {
    logger.warn("Payer rules lookup misses", {
      count: misses.length,
      misses: misses.map((m) => `${m.payer_name}/${m.plan_type}/${m.code} (${m.code_kind})`),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Drug rule lookup
// ---------------------------------------------------------------------------

async function lookupDrugRule(
  supabase: SupabaseClient,
  payerName: string,
  planType: string,
  hcpcsCode: string,
  icd10Codes?: string[]
): Promise<PALookupResultDrug | PALookupResultUnknown> {
  const { data: rules, error } = await supabase
    .from("payer_rules_drug")
    .select("*")
    .ilike("payer_name", payerName)
    .ilike("plan_type", planType)
    .eq("hcpcs_code", hcpcsCode.toUpperCase())
    .is("deleted_at", null);

  if (error) {
    logger.error("Drug rule lookup failed", {
      payer: payerName,
      plan: planType,
      code: hcpcsCode,
      error: error.message,
    });
    return createUnknownResult(hcpcsCode, payerName, planType);
  }

  if (!rules || rules.length === 0) {
    return createUnknownResult(hcpcsCode, payerName, planType);
  }

  // Pick the best match — prefer diagnosis-specific over generic
  const matched = pickBestMatch(rules, icd10Codes);

  return {
    kind: "drug",
    code: hcpcsCode,
    payer_name: matched.payer_name,
    plan_type: matched.plan_type,
    pa_required: matched.pa_required,
    confidence: matched.confidence_score,
    documentation_requirements: matched.documentation_requirements ?? [],
    submission_method: matched.submission_method,
    typical_turnaround_days: matched.typical_turnaround_days,
    appeals_pathway: matched.appeals_pathway,
    source_url: matched.source_url,
    last_verified_date: matched.last_verified_date,
    rule_id: matched.id,
    drug_name: matched.drug_name,
    hcpcs_code: matched.hcpcs_code,
    ndc_code: matched.ndc_code,
    step_therapy_required: matched.step_therapy_required,
    step_therapy_details: matched.step_therapy_details,
    lab_requirements: matched.lab_requirements,
  };
}

// ---------------------------------------------------------------------------
// Procedure rule lookup
// ---------------------------------------------------------------------------

async function lookupProcedureRule(
  supabase: SupabaseClient,
  payerName: string,
  planType: string,
  cptCode: string,
  icd10Codes?: string[]
): Promise<PALookupResultProcedure | PALookupResultUnknown> {
  const { data: rules, error } = await supabase
    .from("payer_rules_procedure")
    .select("*")
    .ilike("payer_name", payerName)
    .ilike("plan_type", planType)
    .eq("cpt_code", cptCode)
    .is("deleted_at", null);

  if (error) {
    logger.error("Procedure rule lookup failed", {
      payer: payerName,
      plan: planType,
      code: cptCode,
      error: error.message,
    });
    return createUnknownResult(cptCode, payerName, planType);
  }

  if (!rules || rules.length === 0) {
    return createUnknownResult(cptCode, payerName, planType);
  }

  const matched = pickBestMatch(rules, icd10Codes);

  return {
    kind: "procedure",
    code: cptCode,
    payer_name: matched.payer_name,
    plan_type: matched.plan_type,
    pa_required: matched.pa_required,
    confidence: matched.confidence_score,
    documentation_requirements: matched.documentation_requirements ?? [],
    submission_method: matched.submission_method,
    typical_turnaround_days: matched.typical_turnaround_days,
    appeals_pathway: matched.appeals_pathway,
    source_url: matched.source_url,
    last_verified_date: matched.last_verified_date,
    rule_id: matched.id,
    procedure_name: matched.procedure_name,
    cpt_code: matched.cpt_code,
    site_of_service_restrictions: matched.site_of_service_restrictions,
    modifier_requirements: matched.modifier_requirements,
    units_or_frequency_limits: matched.units_or_frequency_limits,
  };
}

// ---------------------------------------------------------------------------
// ICD-10 array overlap matching
// ---------------------------------------------------------------------------

/**
 * Pick the best rule from a set of candidates.
 *
 * Priority:
 * 1. Rules whose `icd10_codes` array overlaps the provided diagnoses
 * 2. Generic rules (empty `icd10_codes` array = applies to any diagnosis)
 * 3. First candidate as fallback
 *
 * Within each tier, prefer higher confidence_score.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBestMatch(rules: any[], icd10Codes?: string[]): any {
  if (rules.length === 1) return rules[0];

  if (icd10Codes && icd10Codes.length > 0) {
    // Find rules with matching diagnoses
    const diagnosisSpecific = rules.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) =>
        Array.isArray(r.icd10_codes) &&
        r.icd10_codes.length > 0 &&
        r.icd10_codes.some((code: string) => icd10Codes.includes(code))
    );

    if (diagnosisSpecific.length > 0) {
      // Among matching, pick highest confidence
      return diagnosisSpecific.sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0)
      )[0];
    }
  }

  // Fall back to generic rules (empty icd10_codes)
  const generic = rules.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => !Array.isArray(r.icd10_codes) || r.icd10_codes.length === 0
  );

  if (generic.length > 0) {
    return generic.sort(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any, b: any) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0)
    )[0];
  }

  // Absolute fallback: first rule
  return rules[0];
}

// ---------------------------------------------------------------------------
// Stale rules check — queries both typed tables
// ---------------------------------------------------------------------------

/**
 * Check if any rules are stale (not verified in the last N months).
 * Returns rules from both tables that need re-verification.
 */
export async function getStaleRules(
  supabase: SupabaseClient,
  monthsOld: number = 12
): Promise<{ id: string; table: "drug" | "procedure"; payer_name: string; code: string; last_verified_date: string }[]> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);
  const cutoff = cutoffDate.toISOString().split("T")[0]!;

  const [drugResult, procedureResult] = await Promise.all([
    supabase
      .from("payer_rules_drug")
      .select("id, payer_name, hcpcs_code, last_verified_date")
      .lt("last_verified_date", cutoff)
      .is("deleted_at", null),
    supabase
      .from("payer_rules_procedure")
      .select("id, payer_name, cpt_code, last_verified_date")
      .lt("last_verified_date", cutoff)
      .is("deleted_at", null),
  ]);

  if (drugResult.error) {
    logger.error("Failed to fetch stale drug rules", { error: drugResult.error.message });
  }
  if (procedureResult.error) {
    logger.error("Failed to fetch stale procedure rules", { error: procedureResult.error.message });
  }

  const stale: { id: string; table: "drug" | "procedure"; payer_name: string; code: string; last_verified_date: string }[] = [];

  for (const rule of drugResult.data ?? []) {
    stale.push({
      id: rule.id,
      table: "drug",
      payer_name: rule.payer_name,
      code: rule.hcpcs_code,
      last_verified_date: rule.last_verified_date,
    });
  }

  for (const rule of procedureResult.data ?? []) {
    stale.push({
      id: rule.id,
      table: "procedure",
      payer_name: rule.payer_name,
      code: rule.cpt_code,
      last_verified_date: rule.last_verified_date,
    });
  }

  return stale;
}

// ---------------------------------------------------------------------------
// Unknown result factory
// ---------------------------------------------------------------------------

function createUnknownResult(
  code: string,
  payerName: string,
  planType: string
): PALookupResultUnknown {
  return {
    kind: "unknown",
    code,
    pa_required: "unknown",
    confidence: 0,
    documentation_requirements: [],
    submission_method: null,
    typical_turnaround_days: null,
    appeals_pathway: null,
    source_url: null,
    last_verified_date: null,
    rule_id: null,
    payer_name: payerName,
    plan_type: planType,
  };
}
