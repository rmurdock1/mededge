import { describe, it, expect } from "vitest";
import { parseExtractionResponse } from "./extraction";

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
  lab_requirements: null,
  submission_method: "portal",
  typical_turnaround_days: 10,
  source_document_excerpt: "Dupixent requires prior authorization for all commercial plans.",
  extraction_confidence: "high",
};

const validProcedureRule = {
  payer_name: "UnitedHealthcare",
  plan_type: "Commercial",
  bcbs_licensee: null,
  cpt_code: "17311",
  procedure_name: "Mohs surgery — first stage",
  icd10_codes: [],
  pa_required: true,
  documentation_requirements: [
    { item: "Biopsy pathology report", required: true },
  ],
  site_of_service_restrictions: null,
  modifier_requirements: null,
  units_or_frequency_limits: null,
  appeals_pathway: null,
  submission_method: "portal",
  typical_turnaround_days: 7,
  source_document_excerpt: "Mohs micrographic surgery requires PA when performed in an ASC or HOPD.",
  extraction_confidence: "medium",
};

const validResponse = JSON.stringify({
  payer_name: "UnitedHealthcare",
  document_date: "2026-01-15",
  drug_rules: [validDrugRule],
  procedure_rules: [validProcedureRule],
});

describe("parseExtractionResponse", () => {
  it("parses a valid extraction response", () => {
    const result = parseExtractionResponse(validResponse);

    expect(result.success).toBe(true);
    expect(result.payer_name).toBe("UnitedHealthcare");
    expect(result.document_date).toBe("2026-01-15");
    expect(result.rules).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.error).toBeUndefined();

    // Drug rule
    expect(result.rules[0]!.rule_kind).toBe("drug");
    expect(result.rules[0]!.extraction_confidence).toBe("high");
    expect(result.rules[0]!.source_excerpt).toBe(
      "Dupixent requires prior authorization for all commercial plans."
    );
    // extracted_data should NOT contain extraction_confidence or source_document_excerpt
    expect(result.rules[0]!.extracted_data).not.toHaveProperty("extraction_confidence");
    expect(result.rules[0]!.extracted_data).not.toHaveProperty("source_document_excerpt");
    expect(result.rules[0]!.extracted_data).toHaveProperty("drug_name", "Dupixent (dupilumab)");

    // Procedure rule
    expect(result.rules[1]!.rule_kind).toBe("procedure");
    expect(result.rules[1]!.extraction_confidence).toBe("medium");
  });

  it("handles markdown code fences around JSON", () => {
    const wrapped = "```json\n" + validResponse + "\n```";
    const result = parseExtractionResponse(wrapped);
    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(2);
  });

  it("returns error for invalid JSON", () => {
    const result = parseExtractionResponse("not json at all");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  it("returns error for valid JSON that doesn't match schema", () => {
    const result = parseExtractionResponse(JSON.stringify({ foo: "bar" }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("schema validation failed");
  });

  it("skips individual invalid rules while keeping valid ones", () => {
    const response = JSON.stringify({
      payer_name: "Aetna",
      document_date: null,
      drug_rules: [
        validDrugRule,
        {
          // Missing required fields — will fail validation
          payer_name: "Aetna",
          plan_type: "Commercial",
          drug_name: "BadDrug",
          pa_required: true,
          // Missing hcpcs_code AND ndc_code
          extraction_confidence: "low",
          source_document_excerpt: "Some text",
        },
      ],
      procedure_rules: [],
    });

    const result = parseExtractionResponse(response);
    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(1); // valid drug rule kept
    expect(result.skipped).toHaveLength(1); // bad drug rule skipped
    expect(result.skipped[0]!.kind).toBe("drug");
  });

  it("handles empty arrays for both rule types", () => {
    const response = JSON.stringify({
      payer_name: "Cigna",
      document_date: null,
      drug_rules: [],
      procedure_rules: [],
    });

    const result = parseExtractionResponse(response);
    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(0);
    expect(result.payer_name).toBe("Cigna");
  });

  it("preserves all rule fields in extracted_data", () => {
    const result = parseExtractionResponse(validResponse);
    const drugData = result.rules[0]!.extracted_data;

    expect(drugData).toHaveProperty("payer_name", "UnitedHealthcare");
    expect(drugData).toHaveProperty("hcpcs_code", "J0517");
    expect(drugData).toHaveProperty("pa_required", true);
    expect(drugData).toHaveProperty("step_therapy_required", true);
    expect(drugData).toHaveProperty("step_therapy_details");
    expect(drugData).toHaveProperty("documentation_requirements");
    expect(drugData).toHaveProperty("icd10_codes");
  });
});
