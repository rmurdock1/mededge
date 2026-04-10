/**
 * Appeal letter generation prompt.
 *
 * HIPAA compliance:
 * - Patient names, DOBs, SSNs, insurance member IDs are NEVER sent to the Claude API.
 * - We use "the patient" as a generic reference.
 * - Diagnosis codes and procedure codes are safe to send (not individually identifiable).
 * - The generated letter uses {{PATIENT_NAME}} and {{DATE}} placeholders that are
 *   filled in AFTER generation, server-side only.
 */

export type DenialCategory =
  | "missing_documentation"
  | "medical_necessity"
  | "step_therapy"
  | "not_covered"
  | "coding_error"
  | "timely_filing"
  | "other";

export interface AppealPromptParams {
  payerName: string;
  procedureOrMedication: string;
  denialReason: string;
  denialCategory: DenialCategory;
  diagnosisCodes: string[];
  procedureCodes: string[];
  documentationChecklist: Array<{
    item: string;
    completed: boolean;
    required: boolean;
  }>;
  stepTherapyHistory?: string;
  priorAuthId: string;
}

const DENIAL_CATEGORY_GUIDANCE: Record<DenialCategory, string> = {
  missing_documentation: `The denial is for missing documentation. The appeal should:
- Identify exactly which documents were allegedly missing
- State that the documents are now attached (or were included in the original submission)
- Reference each document by name and describe what it demonstrates
- Request the reviewer examine the complete record`,

  medical_necessity: `The denial is for lack of medical necessity. The appeal should:
- Cite the patient's specific diagnosis and clinical severity
- Reference published clinical guidelines supporting the treatment
- Quote the payer's own coverage criteria and show how the patient meets each criterion
- Include relevant clinical evidence (BSA assessment, disease severity scores, impact on quality of life)
- Reference peer-reviewed literature if applicable`,

  step_therapy: `The denial is because step therapy requirements were not met. The appeal should:
- Document each prior treatment attempted, including duration and outcome
- Explain why each prior therapy was inadequate, caused adverse effects, or was contraindicated
- Reference the payer's step therapy protocol and demonstrate compliance
- If requesting an exception, cite clinical justification for bypassing remaining steps`,

  not_covered: `The denial states the service is not covered under the patient's plan. The appeal should:
- Reference the specific plan coverage policy and applicable benefit category
- Argue that the service falls within a covered benefit category
- If applicable, cite state or federal mandates requiring coverage
- Reference any payer policy bulletins that may support coverage
- Request a coverage determination review`,

  coding_error: `The denial is due to a coding issue. The appeal should:
- Identify the specific coding discrepancy cited by the payer
- Provide the correct CPT/HCPCS and ICD-10 codes with clinical justification
- Reference coding guidelines (AMA CPT Assistant, CMS NCCI edits) supporting the codes used
- Request reprocessing with the corrected information`,

  timely_filing: `The denial is for untimely filing. The appeal should:
- Document the timeline of submission with dates and confirmation numbers
- If there were extenuating circumstances, describe them clearly
- Reference the plan's timely filing deadline and any good cause exceptions
- Include proof of timely submission if available (fax confirmations, portal timestamps)`,

  other: `The denial reason does not fit a standard category. The appeal should:
- Quote the exact denial reason and address it point by point
- Provide clinical justification for the requested service
- Reference the payer's coverage policy
- Include all relevant supporting documentation`,
};

export function buildAppealPrompt(params: AppealPromptParams): {
  system: string;
  user: string;
} {
  const completedDocs = params.documentationChecklist
    .filter((d) => d.completed)
    .map((d) => `  - ${d.item}`)
    .join("\n");

  const missingDocs = params.documentationChecklist
    .filter((d) => !d.completed && d.required)
    .map((d) => `  - ${d.item} (REQUIRED, not yet gathered)`)
    .join("\n");

  const diagnosisStr =
    params.diagnosisCodes.length > 0
      ? params.diagnosisCodes.join(", ")
      : "Not specified";

  const procedureStr =
    params.procedureCodes.length > 0
      ? params.procedureCodes.join(", ")
      : "Not specified";

  const system = `You are a senior medical billing specialist with 15 years of experience drafting prior authorization appeal letters for dermatology practices. You have an excellent track record of overturning denials.

Your letters are:
- Professional, factual, and firm but never adversarial
- Structured for easy reviewer consumption (numbered points, clear headers)
- Specific to the denial reason — you address it head-on, not generically
- Backed by the payer's own coverage criteria whenever possible

IMPORTANT formatting rules:
- Use {{PATIENT_NAME}} as a placeholder for the patient's name (it will be filled in later)
- Use {{DATE}} as a placeholder for today's date
- Use {{PROVIDER_NAME}} as a placeholder for the referring provider
- Use {{PRACTICE_NAME}} as a placeholder for the practice name
- Format as a standard business letter
- Length: 1-2 pages (approximately 400-800 words)
- Do NOT include any PHI (patient names, dates of birth, member IDs)`;

  const categoryGuidance =
    DENIAL_CATEGORY_GUIDANCE[params.denialCategory] ??
    DENIAL_CATEGORY_GUIDANCE.other;

  const user = `Draft a prior authorization appeal letter for the following denied request.

<denial_details>
Payer: ${params.payerName}
Procedure/Medication: ${params.procedureOrMedication}
Denial reason: ${params.denialReason}
Diagnosis codes: ${diagnosisStr}
Procedure/HCPCS codes: ${procedureStr}
Prior Auth reference: ${params.priorAuthId.substring(0, 8)}
</denial_details>

<denial_category_guidance>
${categoryGuidance}
</denial_category_guidance>

<documentation_status>
Completed documentation:
${completedDocs || "  (none)"}

Missing required documentation:
${missingDocs || "  (none — all required items gathered)"}
</documentation_status>

${
  params.stepTherapyHistory
    ? `<step_therapy_history>\n${params.stepTherapyHistory}\n</step_therapy_history>\n`
    : ""
}
Generate the appeal letter now. Remember to use {{PATIENT_NAME}}, {{DATE}}, {{PROVIDER_NAME}}, and {{PRACTICE_NAME}} as placeholders.`;

  return { system, user };
}

/**
 * Classifies a free-text denial reason into a category.
 * Used to select the appropriate prompt guidance.
 */
export function classifyDenialReason(denialReason: string): DenialCategory {
  const lower = denialReason.toLowerCase();

  if (
    lower.includes("missing") ||
    lower.includes("insufficient documentation") ||
    lower.includes("additional information") ||
    lower.includes("records not received")
  ) {
    return "missing_documentation";
  }

  if (
    lower.includes("medical necessity") ||
    lower.includes("not medically necessary") ||
    lower.includes("clinical criteria") ||
    lower.includes("does not meet criteria")
  ) {
    return "medical_necessity";
  }

  if (
    lower.includes("step therapy") ||
    lower.includes("prior treatment") ||
    lower.includes("tried and failed") ||
    lower.includes("first-line") ||
    lower.includes("formulary")
  ) {
    return "step_therapy";
  }

  if (
    lower.includes("not covered") ||
    lower.includes("excluded") ||
    lower.includes("not a covered benefit") ||
    lower.includes("out of scope")
  ) {
    return "not_covered";
  }

  if (
    lower.includes("coding") ||
    lower.includes("incorrect code") ||
    lower.includes("modifier") ||
    lower.includes("cpt") ||
    lower.includes("invalid code")
  ) {
    return "coding_error";
  }

  if (
    lower.includes("timely") ||
    lower.includes("late filing") ||
    lower.includes("deadline") ||
    lower.includes("untimely")
  ) {
    return "timely_filing";
  }

  return "other";
}
