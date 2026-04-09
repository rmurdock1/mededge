import type {
  DocumentationItem,
  SubmissionMethod,
  StepTherapyDetails,
  LabRequirements,
  AppealsPathway,
  SiteOfServiceRestrictions,
  ModifierRequirements,
  UnitsOrFrequencyLimits,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Code classification
// ---------------------------------------------------------------------------

/** Whether a billing code refers to a drug (HCPCS J-code / NDC) or a procedure (CPT). */
export type CodeKind = "drug" | "procedure";

// ---------------------------------------------------------------------------
// PA lookup result — discriminated union on `kind`
// ---------------------------------------------------------------------------

/** Fields shared by every lookup result variant. */
interface PALookupResultBase {
  /** The code that was looked up (HCPCS or CPT). */
  code: string;
  payer_name: string;
  plan_type: string;
  pa_required: boolean | "unknown";
  confidence: number;
  documentation_requirements: DocumentationItem[];
  submission_method: SubmissionMethod | null;
  typical_turnaround_days: number | null;
  appeals_pathway: AppealsPathway | null;
  source_url: string | null;
  last_verified_date: string | null;
  rule_id: string | null;
}

/** Result when the matched rule is from `payer_rules_drug`. */
export interface PALookupResultDrug extends PALookupResultBase {
  kind: "drug";
  drug_name: string;
  hcpcs_code: string | null;
  ndc_code: string | null;
  step_therapy_required: boolean;
  step_therapy_details: StepTherapyDetails | null;
  lab_requirements: LabRequirements | null;
}

/** Result when the matched rule is from `payer_rules_procedure`. */
export interface PALookupResultProcedure extends PALookupResultBase {
  kind: "procedure";
  procedure_name: string;
  cpt_code: string;
  site_of_service_restrictions: SiteOfServiceRestrictions | null;
  modifier_requirements: ModifierRequirements | null;
  units_or_frequency_limits: UnitsOrFrequencyLimits | null;
}

/** Result when no rule is found (or a DB error occurred). */
export interface PALookupResultUnknown extends PALookupResultBase {
  kind: "unknown";
  pa_required: "unknown";
  confidence: 0;
}

/**
 * Discriminated union returned by `checkPARequired()`.
 *
 * Consumers can narrow on `result.kind`:
 * ```ts
 * if (result.kind === "drug") { result.step_therapy_details … }
 * ```
 */
export type PALookupResult =
  | PALookupResultDrug
  | PALookupResultProcedure
  | PALookupResultUnknown;

// ---------------------------------------------------------------------------
// Lookup miss (unchanged from v1)
// ---------------------------------------------------------------------------

/**
 * A missed lookup — no rule found for this combination.
 * Logged so we know which rules to add next.
 */
export interface LookupMiss {
  payer_name: string;
  plan_type: string;
  code: string;
  code_kind: CodeKind;
  icd10_codes: string[];
  looked_up_at: string;
}

