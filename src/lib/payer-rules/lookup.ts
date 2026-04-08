import type { SupabaseClient } from "@supabase/supabase-js";
import type { PARequirement, LookupMiss } from "./types";
import { logger } from "@/lib/logger";

/**
 * Core PA requirement lookup — deterministic database query, NOT AI.
 *
 * Given a payer, plan type, and list of CPT codes, returns whether PA
 * is required for each procedure. Optionally narrows by ICD-10 diagnosis.
 *
 * When no rule exists for a combination, returns pa_required: "unknown"
 * and logs the miss so we know which rules to add next.
 */
export async function checkPARequired(
  supabase: SupabaseClient,
  payerName: string,
  planType: string,
  cptCodes: string[],
  icd10Codes?: string[]
): Promise<PARequirement[]> {
  const results: PARequirement[] = [];
  const misses: LookupMiss[] = [];

  for (const cptCode of cptCodes) {
    // Build query: match payer + plan + CPT
    const query = supabase
      .from("payer_rules")
      .select("*")
      .ilike("payer_name", payerName)
      .ilike("plan_type", planType)
      .eq("cpt_code", cptCode);

    const { data: rules, error } = await query;

    if (error) {
      logger.error("Payer rules lookup failed", {
        payer: payerName,
        plan: planType,
        cpt: cptCode,
        error: error.message,
      });
      // On error, return unknown — never silently skip
      results.push(createUnknownResult(cptCode, payerName, planType));
      continue;
    }

    if (!rules || rules.length === 0) {
      // No rule found — log the miss and return unknown
      misses.push({
        payer_name: payerName,
        plan_type: planType,
        cpt_code: cptCode,
        icd10_codes: icd10Codes ?? [],
        looked_up_at: new Date().toISOString(),
      });
      results.push(createUnknownResult(cptCode, payerName, planType));
      continue;
    }

    // If ICD-10 codes provided, try to find a diagnosis-specific rule first
    let matchedRule = null;

    if (icd10Codes && icd10Codes.length > 0) {
      matchedRule = rules.find(
        (r) => r.icd10_code && icd10Codes.includes(r.icd10_code)
      );
    }

    // Fall back to the general rule (no ICD-10 restriction)
    if (!matchedRule) {
      matchedRule = rules.find((r) => !r.icd10_code) ?? rules[0];
    }

    if (!matchedRule) {
      results.push(createUnknownResult(cptCode, payerName, planType));
      continue;
    }

    results.push({
      cpt_code: cptCode,
      pa_required: matchedRule.pa_required,
      confidence: matchedRule.confidence_score,
      documentation_requirements: matchedRule.documentation_requirements ?? [],
      submission_method: matchedRule.submission_method,
      typical_turnaround_days: matchedRule.typical_turnaround_days,
      step_therapy_required: matchedRule.step_therapy_required,
      step_therapy_details: matchedRule.step_therapy_details,
      payer_name: matchedRule.payer_name,
      plan_type: matchedRule.plan_type,
      source_url: matchedRule.source_url,
      last_verified_date: matchedRule.last_verified_date,
      rule_id: matchedRule.id,
    });
  }

  // Log any lookup misses for future rule expansion
  if (misses.length > 0) {
    logger.warn("Payer rules lookup misses", {
      count: misses.length,
      misses: misses.map((m) => `${m.payer_name}/${m.plan_type}/${m.cpt_code}`),
    });
  }

  return results;
}

/**
 * Check if any rules are stale (not verified in the last 12 months).
 * Returns rules that need re-verification.
 */
export async function getStaleRules(
  supabase: SupabaseClient,
  monthsOld: number = 12
): Promise<{ id: string; payer_name: string; cpt_code: string; last_verified_date: string }[]> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);

  const { data, error } = await supabase
    .from("payer_rules")
    .select("id, payer_name, cpt_code, last_verified_date")
    .lt("last_verified_date", cutoffDate.toISOString().split("T")[0]!);

  if (error) {
    logger.error("Failed to fetch stale rules", { error: error.message });
    return [];
  }

  return data ?? [];
}

function createUnknownResult(
  cptCode: string,
  payerName: string,
  planType: string
): PARequirement {
  return {
    cpt_code: cptCode,
    pa_required: "unknown",
    confidence: 0,
    documentation_requirements: [],
    submission_method: null,
    typical_turnaround_days: null,
    step_therapy_required: false,
    step_therapy_details: null,
    payer_name: payerName,
    plan_type: planType,
    source_url: null,
    last_verified_date: null,
    rule_id: null,
  };
}
