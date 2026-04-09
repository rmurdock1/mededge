import { z } from "zod";

// ---- Enum values (statically defined, not queried from DB) ----

export const BCBS_LICENSEES = [
  "anthem", "highmark", "bcbsil", "bcbsmi", "bcbsma", "bcbsnc",
  "bcbsfl", "bcbstx", "horizon_bcbsnj", "carefirst", "independence",
  "regence", "premera", "wellmark", "other",
] as const;

export const SUBMISSION_METHODS = [
  "portal", "fax", "phone", "electronic",
] as const;

export const AUDIT_SOURCES = [
  "manual", "bootstrap", "seed", "policy_watch", "api",
] as const;

export const AUDIT_ACTIONS = [
  "insert", "update", "delete", "soft_delete", "restore",
] as const;

export const PLAN_TYPES = [
  "Commercial", "Medicare Advantage", "Medicaid", "Exchange",
] as const;

export const SITE_OF_SERVICE_OPTIONS = [
  "office", "asc", "hopd", "inpatient",
] as const;

// ---- JSONB sub-schemas with actionable error messages ----

export const documentationItemSchema = z.object({
  item: z.string().min(1, "item is required and must be a non-empty string"),
  required: z.boolean({
    required_error: "required must be a boolean (true or false)",
    invalid_type_error: "required must be a boolean (true or false)",
  }),
  description: z.string().optional(),
}).strict("Each documentation item only allows fields: item, required, description");

export const documentationRequirementsSchema = z.array(
  documentationItemSchema,
  {
    invalid_type_error: "documentation_requirements must be an array of objects with fields {item: string, required: boolean, description?: string}",
  }
);

export const stepTherapyDetailsSchema = z.object({
  required_drugs: z.array(z.string(), {
    invalid_type_error: "required_drugs must be an array of drug name strings",
  }).optional(),
  duration_days: z.number({
    invalid_type_error: "duration_days must be a positive integer",
  }).int().positive("duration_days must be a positive integer").optional(),
  exceptions: z.array(z.string(), {
    invalid_type_error: "exceptions must be an array of strings",
  }).optional(),
  legacy_text: z.string().optional(),
}).strict("step_therapy_details only allows fields: required_drugs, duration_days, exceptions, legacy_text")
  .nullable();

export const appealsPathwayLevelSchema = z.object({
  name: z.string().min(1, "Each appeal level must have a name"),
  deadline_days: z.number({
    invalid_type_error: "deadline_days must be a number",
  }).int().positive("deadline_days must be a positive integer"),
  submission_method: z.enum(SUBMISSION_METHODS, {
    errorMap: () => ({ message: `submission_method must be one of: ${SUBMISSION_METHODS.join(", ")}` }),
  }),
  forms: z.array(z.string()).optional(),
}).strict("Each appeal level only allows fields: name, deadline_days, submission_method, forms");

export const appealsPathwaySchema = z.object({
  levels: z.array(appealsPathwayLevelSchema, {
    invalid_type_error: "levels must be an array of appeal level objects",
  }).min(1, "appeals_pathway.levels must have at least one entry"),
}).strict("appeals_pathway only allows fields: levels")
  .nullable();

export const labRequirementsSchema = z.object({
  tb_test: z.boolean().optional(),
  hepatitis_panel: z.boolean().optional(),
  cbc: z.boolean().optional(),
  liver_function: z.boolean().optional(),
  other: z.array(z.string(), {
    invalid_type_error: "other must be an array of lab test name strings",
  }).optional(),
}).strict("lab_requirements only allows fields: tb_test, hepatitis_panel, cbc, liver_function, other")
  .nullable();

export const siteOfServiceRestrictionsSchema = z.object({
  allowed: z.array(z.enum(SITE_OF_SERVICE_OPTIONS, {
    errorMap: () => ({ message: `Each site must be one of: ${SITE_OF_SERVICE_OPTIONS.join(", ")}` }),
  }), {
    invalid_type_error: "allowed must be an array of site-of-service strings",
  }).min(1, "allowed must have at least one site"),
  notes: z.string().optional(),
}).strict("site_of_service_restrictions only allows fields: allowed, notes")
  .nullable();

export const modifierRequirementsSchema = z.object({
  required: z.array(z.string(), {
    invalid_type_error: "required must be an array of modifier strings (e.g. ['-25', '-59'])",
  }),
  conditional: z.array(z.object({
    modifier: z.string().min(1, "modifier is required"),
    when: z.string().min(1, "when is required"),
  }).strict("Each conditional modifier only allows fields: modifier, when")).optional(),
}).strict("modifier_requirements only allows fields: required, conditional")
  .nullable();

export const unitsOrFrequencyLimitsSchema = z.object({
  max_per_period: z.object({
    count: z.number().int().positive("count must be a positive integer"),
    period_days: z.number().int().positive("period_days must be a positive integer"),
  }).strict("max_per_period only allows fields: count, period_days").optional(),
  max_lesions: z.number().int().positive("max_lesions must be a positive integer").optional(),
  notes: z.string().optional(),
}).strict("units_or_frequency_limits only allows fields: max_per_period, max_lesions, notes")
  .nullable();

// ---- Form-level schemas ----

export const drugRuleFormSchema = z.object({
  // Payer identification
  payer_name: z.string().min(1, "Payer name is required"),
  plan_type: z.string().min(1, "Plan type is required"),
  bcbs_licensee: z.enum(BCBS_LICENSEES).nullable().optional(),

  // Drug identification
  hcpcs_code: z.string().nullable().optional(),
  ndc_code: z.string().nullable().optional(),
  drug_name: z.string().min(1, "Drug name is required"),

  // Diagnosis
  icd10_codes: z.array(z.string()).default([]),

  // Rule
  pa_required: z.boolean(),
  documentation_requirements: documentationRequirementsSchema.default([]),

  // Drug-specific
  step_therapy_required: z.boolean().default(false),
  step_therapy_details: stepTherapyDetailsSchema.optional(),
  appeals_pathway: appealsPathwaySchema.optional(),
  lab_requirements: labRequirementsSchema.optional(),

  // Submission
  submission_method: z.enum(SUBMISSION_METHODS).nullable().optional(),
  typical_turnaround_days: z.number().int().positive().nullable().optional(),

  // Provenance
  source_url: z.string().url("Source URL must be a valid URL").min(1, "Source URL is required"),
  source_document_excerpt: z.string().nullable().optional(),
  last_verified_date: z.string().min(1, "Last verified date is required"),
  confidence_score: z.number().min(0, "Confidence score must be between 0 and 1").max(1, "Confidence score must be between 0 and 1"),

  // Audit (required for every mutation)
  change_reason: z.string().min(1, "Change reason is required — explain why this rule is being added or changed"),
}).refine(
  (data) => data.hcpcs_code || data.ndc_code,
  { message: "At least one of HCPCS code or NDC code is required", path: ["hcpcs_code"] }
);

export const procedureRuleFormSchema = z.object({
  // Payer identification
  payer_name: z.string().min(1, "Payer name is required"),
  plan_type: z.string().min(1, "Plan type is required"),
  bcbs_licensee: z.enum(BCBS_LICENSEES).nullable().optional(),

  // Procedure identification
  cpt_code: z.string().min(1, "CPT code is required"),
  procedure_name: z.string().min(1, "Procedure name is required"),

  // Diagnosis
  icd10_codes: z.array(z.string()).default([]),

  // Rule
  pa_required: z.boolean(),
  documentation_requirements: documentationRequirementsSchema.default([]),

  // Procedure-specific
  site_of_service_restrictions: siteOfServiceRestrictionsSchema.optional(),
  modifier_requirements: modifierRequirementsSchema.optional(),
  units_or_frequency_limits: unitsOrFrequencyLimitsSchema.optional(),
  appeals_pathway: appealsPathwaySchema.optional(),

  // Submission
  submission_method: z.enum(SUBMISSION_METHODS).nullable().optional(),
  typical_turnaround_days: z.number().int().positive().nullable().optional(),

  // Provenance
  source_url: z.string().url("Source URL must be a valid URL").min(1, "Source URL is required"),
  source_document_excerpt: z.string().nullable().optional(),
  last_verified_date: z.string().min(1, "Last verified date is required"),
  confidence_score: z.number().min(0, "Confidence score must be between 0 and 1").max(1, "Confidence score must be between 0 and 1"),

  // Audit
  change_reason: z.string().min(1, "Change reason is required — explain why this rule is being added or changed"),
});

export type DrugRuleFormData = z.infer<typeof drugRuleFormSchema>;
export type ProcedureRuleFormData = z.infer<typeof procedureRuleFormSchema>;

// ---- JSONB field parsing helper ----

/**
 * Parse a JSONB textarea value with a Zod schema, producing actionable errors.
 * Returns { success: true, data } or { success: false, error: string }.
 */
export function parseJsonField<T>(
  raw: string,
  schema: z.ZodType<T>,
  fieldName: string
): { success: true; data: T } | { success: false; error: string } {
  if (!raw.trim()) {
    return { success: true, data: null as T };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : "Unknown parse error";
    return { success: false, error: `Invalid JSON in ${fieldName}: ${msg}` };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0
        ? `${fieldName}.${issue.path.join(".")}`
        : fieldName;
      return `${path}: ${issue.message}`;
    });
    return { success: false, error: issues.join("\n") };
  }

  return { success: true, data: result.data };
}
