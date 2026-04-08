import type { DocumentationItem, SubmissionMethod } from "@/lib/types";

/**
 * Result of a PA requirement lookup.
 * When no rule exists, pa_required is "unknown" and confidence is 0.
 */
export interface PARequirement {
  cpt_code: string;
  pa_required: boolean | "unknown";
  confidence: number;
  documentation_requirements: DocumentationItem[];
  submission_method: SubmissionMethod | null;
  typical_turnaround_days: number | null;
  step_therapy_required: boolean;
  step_therapy_details: string | null;
  payer_name: string;
  plan_type: string;
  source_url: string | null;
  last_verified_date: string | null;
  rule_id: string | null;
}

/**
 * A missed lookup — no rule found for this combination.
 * Logged so we know which rules to add next.
 */
export interface LookupMiss {
  payer_name: string;
  plan_type: string;
  cpt_code: string;
  icd10_codes: string[];
  looked_up_at: string;
}
