/**
 * PA Detection — runs after appointment sync.
 *
 * For each newly synced appointment with CPT codes, checks the payer
 * rules engine to determine if prior authorization is required. Updates
 * the appointment's pa_status and creates prior_auth records as needed.
 *
 * Also logs every lookup to pa_lookup_log for the "Unknown Rules Report"
 * that drives ongoing rule gap analysis.
 *
 * HIPAA: No PHI is logged. Only codes, payer names, and lookup results.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPARequired } from "@/lib/payer-rules/lookup";
import type { PALookupResult } from "@/lib/payer-rules/types";
import { generateChecklist } from "@/lib/payer-rules/checklist";
import { logger } from "@/lib/logger";

export interface PADetectionResult {
  appointmentsChecked: number;
  paRequired: number;
  paNotRequired: number;
  unknown: number;
  priorAuthsCreated: number;
}

/**
 * Run PA detection on all appointments for a practice that haven't
 * been checked yet (pa_status = 'not_needed' and have CPT codes).
 *
 * Called after sync completes. Scans appointments with codes but
 * no prior PA check.
 */
export async function runPADetection(
  supabase: SupabaseClient,
  practiceId: string
): Promise<PADetectionResult> {
  const result: PADetectionResult = {
    appointmentsChecked: 0,
    paRequired: 0,
    paNotRequired: 0,
    unknown: 0,
    priorAuthsCreated: 0,
  };

  // Find appointments that need PA checking:
  // - Have CPT codes (not empty array)
  // - pa_status is 'not_needed' (haven't been checked yet)
  // - appointment_date is in the future
  const today = new Date().toISOString().substring(0, 10);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, patient_id, cpt_codes, icd10_codes, appointment_date")
    .eq("practice_id", practiceId)
    .eq("pa_status", "not_needed")
    .gte("appointment_date", today)
    .not("cpt_codes", "eq", "{}");

  if (error) {
    logger.error("Failed to fetch appointments for PA detection", {
      practice_id: practiceId,
      error: error.message,
    });
    return result;
  }

  if (!appointments || appointments.length === 0) {
    return result;
  }

  for (const appt of appointments) {
    result.appointmentsChecked++;

    // Get patient insurance info for payer rule matching
    const { data: patient } = await supabase
      .from("patients")
      .select("insurance_payer, plan_type")
      .eq("id", appt.patient_id)
      .single();

    if (!patient?.insurance_payer || !patient?.plan_type) {
      // No insurance info — can't check PA. Log as unknown.
      for (const code of appt.cpt_codes) {
        await logLookup(supabase, practiceId, {
          payer_name: patient?.insurance_payer ?? "unknown",
          plan_type: patient?.plan_type ?? "unknown",
          code,
          code_kind: "procedure", // conservative default
          icd10_codes: appt.icd10_codes ?? [],
          lookup_result: "unknown",
          confidence: null,
          rule_id: null,
          appointment_id: appt.id,
        });
      }
      result.unknown++;
      continue;
    }

    // Run PA lookup
    const lookupResults = await checkPARequired(
      supabase,
      patient.insurance_payer,
      patient.plan_type,
      appt.cpt_codes,
      appt.icd10_codes
    );

    // Log each lookup result
    for (const lr of lookupResults) {
      await logLookup(supabase, practiceId, {
        payer_name: lr.payer_name,
        plan_type: lr.plan_type,
        code: lr.code,
        code_kind: lr.kind === "unknown" ? "procedure" : lr.kind,
        icd10_codes: appt.icd10_codes ?? [],
        lookup_result: lookupResultToString(lr),
        confidence: lr.confidence > 0 ? lr.confidence : null,
        rule_id: lr.rule_id,
        appointment_id: appt.id,
      });
    }

    // Determine if any code requires PA
    const anyRequired = lookupResults.some(
      (r) => r.pa_required === true
    );
    const allNotRequired = lookupResults.every(
      (r) => r.pa_required === false
    );
    const anyUnknown = lookupResults.some(
      (r) => r.kind === "unknown" || r.pa_required === "unknown"
    );

    if (anyRequired) {
      result.paRequired++;

      // Update appointment status
      await supabase
        .from("appointments")
        .update({ pa_status: "needed" })
        .eq("id", appt.id);

      // Create prior_auth record with documentation checklist
      const checklist = generateChecklist(lookupResults);
      const requiredResults = lookupResults.filter((r) => r.pa_required === true);
      const procedureOrMedication = requiredResults
        .map((r) => {
          if (r.kind === "drug") return r.drug_name;
          if (r.kind === "procedure") return r.procedure_name;
          return r.code;
        })
        .join(", ");

      const { error: paError } = await supabase.from("prior_auths").insert({
        practice_id: practiceId,
        patient_id: appt.patient_id,
        appointment_id: appt.id,
        payer_name: patient.insurance_payer,
        procedure_or_medication: procedureOrMedication,
        status: "draft",
        documentation_checklist: checklist,
      });

      if (!paError) {
        result.priorAuthsCreated++;
      } else {
        logger.error("Failed to create prior_auth", {
          practice_id: practiceId,
          appointment_id: appt.id,
          error: paError.message,
        });
      }
    } else if (allNotRequired) {
      result.paNotRequired++;
      // pa_status stays 'not_needed' — no action required
    } else if (anyUnknown) {
      result.unknown++;
      // Don't change pa_status — staff should investigate
    }
  }

  logger.info("PA detection completed", {
    practice_id: practiceId,
    checked: result.appointmentsChecked,
    pa_required: result.paRequired,
    not_required: result.paNotRequired,
    unknown: result.unknown,
    prior_auths_created: result.priorAuthsCreated,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Lookup logging
// ---------------------------------------------------------------------------

interface LookupLogEntry {
  payer_name: string;
  plan_type: string;
  code: string;
  code_kind: string;
  icd10_codes: string[];
  lookup_result: string;
  confidence: number | null;
  rule_id: string | null;
  appointment_id: string;
}

async function logLookup(
  supabase: SupabaseClient,
  practiceId: string,
  entry: LookupLogEntry
): Promise<void> {
  const { error } = await supabase.from("pa_lookup_log").insert({
    practice_id: practiceId,
    payer_name: entry.payer_name,
    plan_type: entry.plan_type,
    code: entry.code,
    code_kind: entry.code_kind,
    icd10_codes: entry.icd10_codes,
    lookup_result: entry.lookup_result,
    confidence: entry.confidence,
    rule_id: entry.rule_id,
    appointment_id: entry.appointment_id,
  });

  if (error) {
    // Best-effort logging — don't fail the sync
    logger.warn("Failed to log PA lookup", {
      error: error.message,
      code: entry.code,
    });
  }
}

function lookupResultToString(lr: PALookupResult): string {
  if (lr.kind === "unknown") return "unknown";
  return lr.pa_required ? "required" : "not_required";
}
