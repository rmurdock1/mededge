/**
 * Integration test helpers: test payload builders and audit log reader.
 */
import { testUserId } from "./setup";

let testCounter = 0;

/** Unique suffix for test data to avoid collisions between runs */
function uniqueSuffix(): string {
  testCounter++;
  return `${Date.now()}-${testCounter}`;
}

/**
 * Build a valid drug rule payload for RPC insertion.
 * Uses test.example.com source_url for cleanup identification.
 */
export function buildTestDrugPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const suffix = uniqueSuffix();
  return {
    payer_name: "TestPayer",
    plan_type: "Commercial",
    hcpcs_code: `J9999`,
    drug_name: `TEST_DRUG_${suffix}`,
    icd10_codes: ["L20.9"],
    pa_required: true,
    documentation_requirements: [
      { item: "Clinical notes", required: true, description: "Test doc req" },
    ],
    step_therapy_required: false,
    step_therapy_details: null,
    lab_requirements: null,
    appeals_pathway: null,
    submission_method: "portal",
    typical_turnaround_days: 7,
    source_url: `https://test.example.com/drug-${suffix}`,
    source_document_excerpt: null,
    last_verified_date: "2026-04-09",
    confidence_score: 0.7,
    ...overrides,
  };
}

/**
 * Build a valid procedure rule payload for RPC insertion.
 */
export function buildTestProcedurePayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const suffix = uniqueSuffix();
  return {
    payer_name: "TestPayer",
    plan_type: "Commercial",
    cpt_code: `99999`,
    procedure_name: `TEST_PROC_${suffix}`,
    icd10_codes: [],
    pa_required: true,
    documentation_requirements: [
      { item: "Clinical notes", required: true, description: "Test doc req" },
    ],
    site_of_service_restrictions: null,
    modifier_requirements: null,
    units_or_frequency_limits: null,
    appeals_pathway: null,
    submission_method: "fax",
    typical_turnaround_days: 5,
    source_url: `https://test.example.com/proc-${suffix}`,
    source_document_excerpt: null,
    last_verified_date: "2026-04-09",
    confidence_score: 0.7,
    ...overrides,
  };
}

/** Standard audit parameters for test RPC calls */
export function testAuditParams(reason: string) {
  return {
    p_actor_user_id: testUserId,
    p_change_reason: reason,
    p_audit_source: "manual" as const,
  };
}
