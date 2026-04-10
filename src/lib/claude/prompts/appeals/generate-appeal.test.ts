import { describe, it, expect } from "vitest";
import {
  buildAppealPrompt,
  classifyDenialReason,
} from "./generate-appeal";
import type { AppealPromptParams } from "./generate-appeal";

const baseParams: AppealPromptParams = {
  payerName: "UnitedHealthcare",
  procedureOrMedication: "Dupixent (dupilumab) - J0517",
  denialReason: "Medical necessity not established",
  denialCategory: "medical_necessity",
  diagnosisCodes: ["L20.9"],
  procedureCodes: ["J0517"],
  documentationChecklist: [
    { item: "BSA assessment", completed: true, required: true },
    { item: "Prior treatment history", completed: true, required: true },
    { item: "Lab results (TB test)", completed: false, required: true },
  ],
  priorAuthId: "12345678-abcd-efgh-ijkl-123456789012",
};

describe("buildAppealPrompt", () => {
  it("returns system and user messages", () => {
    const { system, user } = buildAppealPrompt(baseParams);
    expect(system).toBeTruthy();
    expect(user).toBeTruthy();
  });

  it("system message instructs use of placeholders", () => {
    const { system } = buildAppealPrompt(baseParams);
    expect(system).toContain("{{PATIENT_NAME}}");
    expect(system).toContain("{{DATE}}");
    expect(system).toContain("{{PROVIDER_NAME}}");
    expect(system).toContain("{{PRACTICE_NAME}}");
  });

  it("system message warns against PHI", () => {
    const { system } = buildAppealPrompt(baseParams);
    expect(system.toLowerCase()).toContain("phi");
  });

  it("user message includes payer and procedure", () => {
    const { user } = buildAppealPrompt(baseParams);
    expect(user).toContain("UnitedHealthcare");
    expect(user).toContain("Dupixent");
  });

  it("user message includes denial reason", () => {
    const { user } = buildAppealPrompt(baseParams);
    expect(user).toContain("Medical necessity not established");
  });

  it("user message includes diagnosis codes", () => {
    const { user } = buildAppealPrompt(baseParams);
    expect(user).toContain("L20.9");
  });

  it("user message lists completed and missing docs", () => {
    const { user } = buildAppealPrompt(baseParams);
    expect(user).toContain("BSA assessment");
    expect(user).toContain("Lab results (TB test)");
    expect(user).toContain("REQUIRED, not yet gathered");
  });

  it("includes denial category guidance for medical_necessity", () => {
    const { user } = buildAppealPrompt(baseParams);
    expect(user).toContain("clinical guidelines");
  });

  it("includes step therapy guidance when category is step_therapy", () => {
    const { user } = buildAppealPrompt({
      ...baseParams,
      denialCategory: "step_therapy",
      denialReason: "Step therapy requirements not met",
    });
    expect(user).toContain("step therapy");
    expect(user).toContain("prior treatment");
  });

  it("includes step therapy history when provided", () => {
    const { user } = buildAppealPrompt({
      ...baseParams,
      stepTherapyHistory:
        "Patient tried topical corticosteroids for 3 months with no improvement",
    });
    expect(user).toContain("topical corticosteroids");
  });

  it("truncates priorAuthId to 8 chars", () => {
    const { user } = buildAppealPrompt(baseParams);
    expect(user).toContain("12345678");
    expect(user).not.toContain("12345678-abcd");
  });

  it("does NOT include any patient-identifying information", () => {
    const { system, user } = buildAppealPrompt(baseParams);
    const combined = system + user;
    // Should not have any obvious PHI patterns
    expect(combined).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN
    expect(combined).not.toMatch(/\b\d{2}\/\d{2}\/\d{4}\b/); // DOB
    expect(combined).not.toContain("Jane Doe");
    expect(combined).not.toContain("John Smith");
  });
});

describe("classifyDenialReason", () => {
  it("classifies missing documentation", () => {
    expect(classifyDenialReason("Missing clinical records")).toBe(
      "missing_documentation"
    );
    expect(
      classifyDenialReason("Insufficient documentation submitted")
    ).toBe("missing_documentation");
    expect(classifyDenialReason("Records not received by deadline")).toBe(
      "missing_documentation"
    );
  });

  it("classifies medical necessity", () => {
    expect(
      classifyDenialReason("Service is not medically necessary")
    ).toBe("medical_necessity");
    expect(classifyDenialReason("Does not meet clinical criteria")).toBe(
      "medical_necessity"
    );
  });

  it("classifies step therapy", () => {
    expect(
      classifyDenialReason("Step therapy requirements not satisfied")
    ).toBe("step_therapy");
    expect(
      classifyDenialReason("Must try first-line agents before biologic")
    ).toBe("step_therapy");
    expect(
      classifyDenialReason("Prior treatment requirement not met")
    ).toBe("step_therapy");
  });

  it("classifies not covered", () => {
    expect(
      classifyDenialReason("Service not covered under this plan")
    ).toBe("not_covered");
    expect(classifyDenialReason("This procedure is excluded")).toBe(
      "not_covered"
    );
  });

  it("classifies coding errors", () => {
    expect(classifyDenialReason("Incorrect code submitted")).toBe(
      "coding_error"
    );
    expect(classifyDenialReason("Invalid CPT modifier combination")).toBe(
      "coding_error"
    );
  });

  it("classifies timely filing", () => {
    expect(classifyDenialReason("Untimely filing of request")).toBe(
      "timely_filing"
    );
    expect(classifyDenialReason("Past deadline for submission")).toBe(
      "timely_filing"
    );
  });

  it("returns other for unrecognized reasons", () => {
    expect(classifyDenialReason("Some random reason")).toBe("other");
    expect(classifyDenialReason("")).toBe("other");
  });
});
