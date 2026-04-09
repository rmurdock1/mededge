import { describe, it, expect } from "vitest";
import {
  documentationItemSchema,
  documentationRequirementsSchema,
  stepTherapyDetailsSchema,
  appealsPathwaySchema,
  labRequirementsSchema,
  siteOfServiceRestrictionsSchema,
  modifierRequirementsSchema,
  unitsOrFrequencyLimitsSchema,
  drugRuleFormSchema,
  procedureRuleFormSchema,
  parseJsonField,
} from "./schemas";
import { z } from "zod";

// ---- Helpers ----

function validDrugFormData(overrides: Record<string, unknown> = {}) {
  return {
    payer_name: "UnitedHealthcare",
    plan_type: "Commercial",
    drug_name: "Dupixent",
    hcpcs_code: "J0517",
    ndc_code: null,
    icd10_codes: ["L20.9"],
    pa_required: true,
    documentation_requirements: [],
    step_therapy_required: false,
    source_url: "https://example.com/policy",
    last_verified_date: "2026-04-01",
    confidence_score: 0.85,
    change_reason: "Initial entry from payer website",
    ...overrides,
  };
}

function validProcedureFormData(overrides: Record<string, unknown> = {}) {
  return {
    payer_name: "Aetna",
    plan_type: "Commercial",
    cpt_code: "17311",
    procedure_name: "Mohs surgery, first stage",
    icd10_codes: ["C44.91"],
    pa_required: true,
    documentation_requirements: [],
    source_url: "https://example.com/policy",
    last_verified_date: "2026-04-01",
    confidence_score: 0.9,
    change_reason: "Initial entry",
    ...overrides,
  };
}

// ---- documentationItemSchema ----

describe("documentationItemSchema", () => {
  it("accepts a valid item", () => {
    const result = documentationItemSchema.safeParse({
      item: "BSA assessment",
      required: true,
      description: "Body surface area percentage",
    });
    expect(result.success).toBe(true);
  });

  it("accepts item without optional description", () => {
    const result = documentationItemSchema.safeParse({
      item: "Clinical notes",
      required: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty item string", () => {
    const result = documentationItemSchema.safeParse({
      item: "",
      required: true,
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("non-empty string");
  });

  it("rejects non-boolean required field", () => {
    const result = documentationItemSchema.safeParse({
      item: "Notes",
      required: "yes",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("boolean");
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = documentationItemSchema.safeParse({
      item: "Notes",
      required: true,
      extra_field: "oops",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("only allows fields");
  });
});

// ---- documentationRequirementsSchema ----

describe("documentationRequirementsSchema", () => {
  it("accepts an array of valid items", () => {
    const result = documentationRequirementsSchema.safeParse([
      { item: "BSA assessment", required: true },
      { item: "Lab results", required: false, description: "TB test" },
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts an empty array", () => {
    const result = documentationRequirementsSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("rejects non-array input with actionable message", () => {
    const result = documentationRequirementsSchema.safeParse("not an array");
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("must be an array");
  });
});

// ---- stepTherapyDetailsSchema ----

describe("stepTherapyDetailsSchema", () => {
  it("accepts null", () => {
    const result = stepTherapyDetailsSchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  it("accepts valid details", () => {
    const result = stepTherapyDetailsSchema.safeParse({
      required_drugs: ["methotrexate", "cyclosporine"],
      duration_days: 90,
      exceptions: ["severe flare"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative duration_days", () => {
    const result = stepTherapyDetailsSchema.safeParse({
      duration_days: -5,
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("positive integer");
  });

  it("rejects unknown fields", () => {
    const result = stepTherapyDetailsSchema.safeParse({
      foo: "bar",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("only allows fields");
  });
});

// ---- appealsPathwaySchema ----

describe("appealsPathwaySchema", () => {
  it("accepts null", () => {
    const result = appealsPathwaySchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  it("accepts valid pathway with one level", () => {
    const result = appealsPathwaySchema.safeParse({
      levels: [
        { name: "First-level", deadline_days: 30, submission_method: "portal" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty levels array", () => {
    const result = appealsPathwaySchema.safeParse({ levels: [] });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("at least one entry");
  });

  it("rejects invalid submission_method in level with actionable message", () => {
    const result = appealsPathwaySchema.safeParse({
      levels: [
        { name: "First-level", deadline_days: 30, submission_method: "email" },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("must be one of");
  });
});

// ---- labRequirementsSchema ----

describe("labRequirementsSchema", () => {
  it("accepts null", () => {
    expect(labRequirementsSchema.safeParse(null).success).toBe(true);
  });

  it("accepts valid lab requirements", () => {
    const result = labRequirementsSchema.safeParse({
      tb_test: true,
      hepatitis_panel: false,
      other: ["Quantiferon Gold"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = labRequirementsSchema.safeParse({ urinalysis: true });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("only allows fields");
  });
});

// ---- siteOfServiceRestrictionsSchema ----

describe("siteOfServiceRestrictionsSchema", () => {
  it("accepts null", () => {
    expect(siteOfServiceRestrictionsSchema.safeParse(null).success).toBe(true);
  });

  it("accepts valid restriction", () => {
    const result = siteOfServiceRestrictionsSchema.safeParse({
      allowed: ["office", "asc"],
      notes: "Outpatient only",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty allowed array", () => {
    const result = siteOfServiceRestrictionsSchema.safeParse({ allowed: [] });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("at least one site");
  });

  it("rejects invalid site value", () => {
    const result = siteOfServiceRestrictionsSchema.safeParse({
      allowed: ["home"],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("must be one of");
  });
});

// ---- modifierRequirementsSchema ----

describe("modifierRequirementsSchema", () => {
  it("accepts null", () => {
    expect(modifierRequirementsSchema.safeParse(null).success).toBe(true);
  });

  it("accepts valid modifiers with conditionals", () => {
    const result = modifierRequirementsSchema.safeParse({
      required: ["-25"],
      conditional: [{ modifier: "-59", when: "Distinct procedural service" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty conditional modifier name", () => {
    const result = modifierRequirementsSchema.safeParse({
      required: ["-25"],
      conditional: [{ modifier: "", when: "Always" }],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("modifier is required");
  });
});

// ---- unitsOrFrequencyLimitsSchema ----

describe("unitsOrFrequencyLimitsSchema", () => {
  it("accepts null", () => {
    expect(unitsOrFrequencyLimitsSchema.safeParse(null).success).toBe(true);
  });

  it("accepts valid limits", () => {
    const result = unitsOrFrequencyLimitsSchema.safeParse({
      max_per_period: { count: 5, period_days: 365 },
      max_lesions: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative count", () => {
    const result = unitsOrFrequencyLimitsSchema.safeParse({
      max_per_period: { count: -1, period_days: 30 },
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("positive integer");
  });
});

// ---- drugRuleFormSchema ----

describe("drugRuleFormSchema", () => {
  it("accepts valid complete drug rule data", () => {
    const result = drugRuleFormSchema.safeParse(validDrugFormData());
    expect(result.success).toBe(true);
  });

  it("accepts data with ndc_code instead of hcpcs_code", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ hcpcs_code: null, ndc_code: "12345678901" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects when both hcpcs_code and ndc_code are missing", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ hcpcs_code: null, ndc_code: null })
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("HCPCS code or NDC code");
  });

  it("rejects empty payer_name", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ payer_name: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid source_url", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ source_url: "not-a-url" })
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("valid URL");
  });

  it("rejects confidence_score > 1", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ confidence_score: 1.5 })
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("between 0 and 1");
  });

  it("rejects confidence_score < 0", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ confidence_score: -0.1 })
    );
    expect(result.success).toBe(false);
  });

  it("rejects empty change_reason with actionable message", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ change_reason: "" })
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("explain why");
  });

  it("accepts valid BCBS licensee", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ bcbs_licensee: "anthem" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects invalid BCBS licensee", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ bcbs_licensee: "fake_licensee" })
    );
    expect(result.success).toBe(false);
  });

  it("accepts valid submission_method", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ submission_method: "fax" })
    );
    expect(result.success).toBe(true);
  });

  it("accepts null submission_method", () => {
    const result = drugRuleFormSchema.safeParse(
      validDrugFormData({ submission_method: null })
    );
    expect(result.success).toBe(true);
  });
});

// ---- procedureRuleFormSchema ----

describe("procedureRuleFormSchema", () => {
  it("accepts valid complete procedure rule data", () => {
    const result = procedureRuleFormSchema.safeParse(validProcedureFormData());
    expect(result.success).toBe(true);
  });

  it("rejects empty cpt_code", () => {
    const result = procedureRuleFormSchema.safeParse(
      validProcedureFormData({ cpt_code: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects empty procedure_name", () => {
    const result = procedureRuleFormSchema.safeParse(
      validProcedureFormData({ procedure_name: "" })
    );
    expect(result.success).toBe(false);
  });

  it("accepts valid site_of_service_restrictions", () => {
    const result = procedureRuleFormSchema.safeParse(
      validProcedureFormData({
        site_of_service_restrictions: { allowed: ["office", "asc"] },
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts valid modifier_requirements", () => {
    const result = procedureRuleFormSchema.safeParse(
      validProcedureFormData({
        modifier_requirements: { required: ["-25"] },
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts valid units_or_frequency_limits", () => {
    const result = procedureRuleFormSchema.safeParse(
      validProcedureFormData({
        units_or_frequency_limits: { max_lesions: 5 },
      })
    );
    expect(result.success).toBe(true);
  });
});

// ---- parseJsonField ----

describe("parseJsonField", () => {
  it("returns null for empty input", () => {
    const result = parseJsonField("", labRequirementsSchema, "lab_requirements");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    const result = parseJsonField("   ", labRequirementsSchema, "lab_requirements");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns error for invalid JSON syntax", () => {
    const result = parseJsonField("{bad json}", labRequirementsSchema, "lab_requirements");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid JSON");
      expect(result.error).toContain("lab_requirements");
    }
  });

  it("returns error for valid JSON that fails Zod schema", () => {
    const result = parseJsonField(
      JSON.stringify({ unknown_field: true }),
      labRequirementsSchema,
      "lab_requirements"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("lab_requirements");
    }
  });

  it("returns parsed data for valid JSON matching schema", () => {
    const input = { tb_test: true, cbc: false };
    const result = parseJsonField(
      JSON.stringify(input),
      labRequirementsSchema,
      "lab_requirements"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it("includes field path in Zod validation errors", () => {
    const input = [{ item: "", required: true }];
    const result = parseJsonField(
      JSON.stringify(input),
      documentationRequirementsSchema,
      "documentation_requirements"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("documentation_requirements");
      expect(result.error).toContain("non-empty string");
    }
  });
});
