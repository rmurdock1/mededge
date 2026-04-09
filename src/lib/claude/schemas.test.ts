import { describe, it, expect } from "vitest";
import {
  extractedDrugRuleSchema,
  extractedProcedureRuleSchema,
  extractionResponseSchema,
} from "./schemas";

const validDrugRule = {
  payer_name: "UnitedHealthcare",
  plan_type: "Commercial",
  bcbs_licensee: null,
  hcpcs_code: "J0517",
  ndc_code: null,
  drug_name: "Dupixent (dupilumab)",
  icd10_codes: ["L20.9"],
  pa_required: true,
  documentation_requirements: [
    { item: "BSA assessment", required: true, description: "Body surface area" },
  ],
  step_therapy_required: true,
  step_therapy_details: {
    required_drugs: ["topical corticosteroids"],
    duration_days: 90,
  },
  appeals_pathway: null,
  lab_requirements: { tb_test: true, hepatitis_panel: false },
  submission_method: "portal",
  typical_turnaround_days: 10,
  source_document_excerpt: "Dupixent requires PA for all plans.",
  extraction_confidence: "high",
};

const validProcedureRule = {
  payer_name: "Aetna",
  plan_type: "Commercial",
  cpt_code: "17311",
  procedure_name: "Mohs surgery — first stage",
  icd10_codes: [],
  pa_required: true,
  documentation_requirements: [
    { item: "Biopsy report", required: true },
  ],
  site_of_service_restrictions: { allowed: ["office", "asc"] },
  modifier_requirements: null,
  units_or_frequency_limits: null,
  appeals_pathway: null,
  submission_method: "portal",
  typical_turnaround_days: 7,
  source_document_excerpt: "Mohs requires PA.",
  extraction_confidence: "medium",
};

describe("extractedDrugRuleSchema", () => {
  it("accepts a valid drug rule", () => {
    const result = extractedDrugRuleSchema.safeParse(validDrugRule);
    expect(result.success).toBe(true);
  });

  it("rejects drug rule missing both hcpcs_code and ndc_code", () => {
    const rule = { ...validDrugRule, hcpcs_code: null, ndc_code: null };
    const result = extractedDrugRuleSchema.safeParse(rule);
    expect(result.success).toBe(false);
  });

  it("accepts drug rule with ndc_code instead of hcpcs_code", () => {
    const rule = { ...validDrugRule, hcpcs_code: null, ndc_code: "00024-5847-01" };
    const result = extractedDrugRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });

  it("requires source_document_excerpt", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source_document_excerpt, ...noExcerpt } = validDrugRule;
    const result = extractedDrugRuleSchema.safeParse(noExcerpt);
    expect(result.success).toBe(false);
  });

  it("requires extraction_confidence", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { extraction_confidence, ...noConf } = validDrugRule;
    const result = extractedDrugRuleSchema.safeParse(noConf);
    expect(result.success).toBe(false);
  });

  it("rejects invalid extraction_confidence value", () => {
    const rule = { ...validDrugRule, extraction_confidence: "very_high" };
    const result = extractedDrugRuleSchema.safeParse(rule);
    expect(result.success).toBe(false);
  });

  it("accepts valid lab_requirements", () => {
    const rule = {
      ...validDrugRule,
      lab_requirements: {
        tb_test: true,
        hepatitis_panel: true,
        cbc: false,
        liver_function: false,
        other: ["ANA panel"],
      },
    };
    const result = extractedDrugRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });

  it("validates step_therapy_details structure", () => {
    const rule = {
      ...validDrugRule,
      step_therapy_details: {
        required_drugs: ["topicals"],
        duration_days: -1, // invalid
      },
    };
    const result = extractedDrugRuleSchema.safeParse(rule);
    expect(result.success).toBe(false);
  });
});

describe("extractedProcedureRuleSchema", () => {
  it("accepts a valid procedure rule", () => {
    const result = extractedProcedureRuleSchema.safeParse(validProcedureRule);
    expect(result.success).toBe(true);
  });

  it("requires cpt_code", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cpt_code, ...noCpt } = validProcedureRule;
    const result = extractedProcedureRuleSchema.safeParse(noCpt);
    expect(result.success).toBe(false);
  });

  it("validates site_of_service_restrictions", () => {
    const rule = {
      ...validProcedureRule,
      site_of_service_restrictions: { allowed: ["spaceship"] },
    };
    const result = extractedProcedureRuleSchema.safeParse(rule);
    expect(result.success).toBe(false);
  });
});

describe("extractionResponseSchema", () => {
  it("accepts a valid full response (loose arrays)", () => {
    const response = {
      payer_name: "UHC",
      document_date: "2026-01-15",
      drug_rules: [validDrugRule],
      procedure_rules: [validProcedureRule],
    };
    const result = extractionResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("accepts response with empty arrays", () => {
    const response = {
      payer_name: "Cigna",
      document_date: null,
      drug_rules: [],
      procedure_rules: [],
    };
    const result = extractionResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("defaults missing arrays to empty", () => {
    const response = { payer_name: "Cigna" };
    const result = extractionResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drug_rules).toEqual([]);
      expect(result.data.procedure_rules).toEqual([]);
    }
  });

  it("accepts mixed valid and invalid rules (loose arrays)", () => {
    const response = {
      payer_name: "Aetna",
      drug_rules: [validDrugRule, { bad: "rule" }],
      procedure_rules: [validProcedureRule],
    };
    // Top-level parse succeeds because arrays are z.unknown()
    const result = extractionResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});
