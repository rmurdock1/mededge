import { z } from "zod";
import {
  BCBS_LICENSEES,
  SUBMISSION_METHODS,
  documentationItemSchema,
  stepTherapyDetailsSchema,
  labRequirementsSchema,
  appealsPathwaySchema,
  siteOfServiceRestrictionsSchema,
  modifierRequirementsSchema,
  unitsOrFrequencyLimitsSchema,
} from "@/lib/admin/schemas";

// ---------------------------------------------------------------------------
// Schemas for Claude's extraction response
//
// These mirror the form schemas in admin/schemas.ts but:
// - Omit fields set by the system: confidence_score, last_verified_date,
//   source_url (comes from the document), change_reason (set on approval)
// - Add extraction_confidence (Claude's self-assessment)
// - source_document_excerpt is required (Claude must cite its source)
// ---------------------------------------------------------------------------

const EXTRACTION_CONFIDENCE = ["high", "medium", "low"] as const;

export const extractedDrugRuleSchema = z.object({
  payer_name: z.string().min(1),
  plan_type: z.string().min(1),
  bcbs_licensee: z.enum(BCBS_LICENSEES).nullable().optional(),

  hcpcs_code: z.string().nullable().optional(),
  ndc_code: z.string().nullable().optional(),
  drug_name: z.string().min(1),

  icd10_codes: z.array(z.string()).default([]),

  pa_required: z.boolean(),
  documentation_requirements: z.array(documentationItemSchema).default([]),

  step_therapy_required: z.boolean().default(false),
  step_therapy_details: stepTherapyDetailsSchema.optional(),
  appeals_pathway: appealsPathwaySchema.optional(),
  lab_requirements: labRequirementsSchema.optional(),

  submission_method: z.enum(SUBMISSION_METHODS).nullable().optional(),
  typical_turnaround_days: z.number().int().positive().nullable().optional(),

  source_document_excerpt: z.string().min(1, "Claude must cite the source text"),
  extraction_confidence: z.enum(EXTRACTION_CONFIDENCE),
}).refine(
  (data) => data.hcpcs_code || data.ndc_code,
  { message: "At least one of hcpcs_code or ndc_code is required", path: ["hcpcs_code"] }
);

export const extractedProcedureRuleSchema = z.object({
  payer_name: z.string().min(1),
  plan_type: z.string().min(1),
  bcbs_licensee: z.enum(BCBS_LICENSEES).nullable().optional(),

  cpt_code: z.string().min(1),
  procedure_name: z.string().min(1),

  icd10_codes: z.array(z.string()).default([]),

  pa_required: z.boolean(),
  documentation_requirements: z.array(documentationItemSchema).default([]),

  site_of_service_restrictions: siteOfServiceRestrictionsSchema.optional(),
  modifier_requirements: modifierRequirementsSchema.optional(),
  units_or_frequency_limits: unitsOrFrequencyLimitsSchema.optional(),
  appeals_pathway: appealsPathwaySchema.optional(),

  submission_method: z.enum(SUBMISSION_METHODS).nullable().optional(),
  typical_turnaround_days: z.number().int().positive().nullable().optional(),

  source_document_excerpt: z.string().min(1, "Claude must cite the source text"),
  extraction_confidence: z.enum(EXTRACTION_CONFIDENCE),
});

/**
 * Top-level response schema — uses `z.unknown()` arrays so that one bad rule
 * doesn't fail the entire parse. Individual rules are validated separately
 * in parseExtractionResponse() using the strict per-rule schemas above.
 */
export const extractionResponseSchema = z.object({
  payer_name: z.string(),
  document_date: z.string().nullable().optional(),
  drug_rules: z.array(z.unknown()).default([]),
  procedure_rules: z.array(z.unknown()).default([]),
});

export type ExtractedDrugRule = z.infer<typeof extractedDrugRuleSchema>;
export type ExtractedProcedureRule = z.infer<typeof extractedProcedureRuleSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
