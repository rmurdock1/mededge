import { BCBS_LICENSEES, SUBMISSION_METHODS, SITE_OF_SERVICE_OPTIONS } from "@/lib/admin/schemas";

export interface ExtractionPromptParams {
  documentText: string;
  sourceUrl: string;
  payerNameHint?: string;
  planTypeHint?: string;
}

/**
 * Builds the system + user messages for the rule extraction prompt.
 *
 * The prompt instructs Claude to read a payer coverage policy document and
 * extract structured PA rules for dermatology drugs and procedures. The
 * output must be valid JSON matching `extractionResponseSchema`.
 *
 * HIPAA note: Coverage policy documents are public payer documents, not PHI.
 * No patient data is included in the prompt.
 */
export function buildExtractionPrompt(params: ExtractionPromptParams): {
  system: string;
  user: string;
} {
  const system = `You are a medical billing policy analyst specializing in dermatology prior authorization requirements. Your task is to read payer coverage policy documents and extract structured PA rules.

You must respond with ONLY valid JSON — no markdown, no commentary, no code fences. The JSON must match the schema described in the user message exactly.

Key extraction principles:
- Only extract rules where the document explicitly states PA requirements. Do not infer or guess.
- Each rule must cite the exact text from the document that supports it (source_document_excerpt).
- Self-assess your confidence for each rule as "high", "medium", or "low".
- Focus on dermatology-relevant drugs (biologics, injectables) and procedures (Mohs, phototherapy, patch testing, etc.).`;

  const bcbsLicensees = BCBS_LICENSEES.join(", ");
  const submissionMethods = SUBMISSION_METHODS.join(", ");
  const siteOptions = SITE_OF_SERVICE_OPTIONS.join(", ");

  const hints = [];
  if (params.payerNameHint) {
    hints.push(`The admin indicated this document is from payer: "${params.payerNameHint}". Use this as guidance but verify against the document content.`);
  }
  if (params.planTypeHint) {
    hints.push(`The admin indicated this covers plan type: "${params.planTypeHint}".`);
  }

  const user = `Extract all dermatology prior authorization rules from the following payer coverage policy document.

<document_source_url>${params.sourceUrl}</document_source_url>

${hints.length > 0 ? `<admin_hints>\n${hints.join("\n")}\n</admin_hints>\n` : ""}
<document>
${params.documentText}
</document>

Respond with a single JSON object matching this exact structure:

{
  "payer_name": "string — the payer name as stated in the document",
  "document_date": "string or null — publication or effective date if found (YYYY-MM-DD format)",
  "drug_rules": [
    {
      "payer_name": "string",
      "plan_type": "Commercial" | "Medicare Advantage" | "Medicaid" | "Exchange",
      "bcbs_licensee": "${bcbsLicensees}" | null,
      "hcpcs_code": "string (J-code) or null — at least one of hcpcs_code or ndc_code required",
      "ndc_code": "string (11-digit NDC) or null",
      "drug_name": "string — brand name (generic name)",
      "icd10_codes": ["string"] | [] (empty = applies to any diagnosis),
      "pa_required": true | false,
      "documentation_requirements": [
        {"item": "string", "required": true|false, "description": "string (optional)"}
      ],
      "step_therapy_required": true | false,
      "step_therapy_details": {"required_drugs": ["string"], "duration_days": number, "exceptions": ["string"]} | null,
      "appeals_pathway": {"levels": [{"name": "string", "deadline_days": number, "submission_method": "${submissionMethods}"}]} | null,
      "lab_requirements": {"tb_test": bool, "hepatitis_panel": bool, "cbc": bool, "liver_function": bool, "other": ["string"]} | null,
      "submission_method": "${submissionMethods}" | null,
      "typical_turnaround_days": number | null,
      "source_document_excerpt": "exact quote from the document supporting this rule",
      "extraction_confidence": "high" | "medium" | "low"
    }
  ],
  "procedure_rules": [
    {
      "payer_name": "string",
      "plan_type": "Commercial" | "Medicare Advantage" | "Medicaid" | "Exchange",
      "bcbs_licensee": "${bcbsLicensees}" | null,
      "cpt_code": "string",
      "procedure_name": "string",
      "icd10_codes": ["string"] | [],
      "pa_required": true | false,
      "documentation_requirements": [
        {"item": "string", "required": true|false, "description": "string (optional)"}
      ],
      "site_of_service_restrictions": {"allowed": ["${siteOptions}"], "notes": "string?"} | null,
      "modifier_requirements": {"required": ["string"], "conditional": [{"modifier": "string", "when": "string"}]} | null,
      "units_or_frequency_limits": {"max_per_period": {"count": number, "period_days": number}, "max_lesions": number, "notes": "string?"} | null,
      "appeals_pathway": same as drug rules | null,
      "submission_method": "${submissionMethods}" | null,
      "typical_turnaround_days": number | null,
      "source_document_excerpt": "exact quote from the document supporting this rule",
      "extraction_confidence": "high" | "medium" | "low"
    }
  ]
}

Important rules:
1. If the document covers multiple plan types, create separate rules for each.
2. For BCBS documents, set payer_name to "BCBS" and populate bcbs_licensee.
3. For drug rules, use the standard HCPCS J-code for dermatology drugs (e.g. J0517 for Dupixent, J0139 for Humira, J1438 for Enbrel).
4. source_document_excerpt is REQUIRED for every rule — copy the exact relevant text.
5. Return an empty array for drug_rules or procedure_rules if the document has no rules of that type.
6. Do NOT include any text outside the JSON object.`;

  return { system, user };
}

/** Maximum characters of document text to send to Claude. */
export const MAX_DOCUMENT_LENGTH = 100_000;
