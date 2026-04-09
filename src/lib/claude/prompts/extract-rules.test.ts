import { describe, it, expect } from "vitest";
import { buildExtractionPrompt, MAX_DOCUMENT_LENGTH } from "./extract-rules";

describe("buildExtractionPrompt", () => {
  const base = {
    documentText: "This is a test policy document about Dupixent PA requirements.",
    sourceUrl: "https://example.com/policy.pdf",
  };

  it("includes document text and source URL", () => {
    const { user } = buildExtractionPrompt(base);
    expect(user).toContain(base.documentText);
    expect(user).toContain(base.sourceUrl);
  });

  it("includes system message about medical billing", () => {
    const { system } = buildExtractionPrompt(base);
    expect(system).toContain("medical billing policy analyst");
    expect(system).toContain("dermatology");
    expect(system).toContain("valid JSON");
  });

  it("includes payer name hint when provided", () => {
    const { user } = buildExtractionPrompt({
      ...base,
      payerNameHint: "UnitedHealthcare",
    });
    expect(user).toContain("UnitedHealthcare");
    expect(user).toContain("admin_hints");
  });

  it("includes plan type hint when provided", () => {
    const { user } = buildExtractionPrompt({
      ...base,
      planTypeHint: "Commercial",
    });
    expect(user).toContain("Commercial");
  });

  it("omits hints section when no hints provided", () => {
    const { user } = buildExtractionPrompt(base);
    expect(user).not.toContain("admin_hints");
  });

  it("includes JSON schema for both drug and procedure rules", () => {
    const { user } = buildExtractionPrompt(base);
    expect(user).toContain("drug_rules");
    expect(user).toContain("procedure_rules");
    expect(user).toContain("hcpcs_code");
    expect(user).toContain("cpt_code");
    expect(user).toContain("extraction_confidence");
    expect(user).toContain("source_document_excerpt");
  });

  it("exports a reasonable MAX_DOCUMENT_LENGTH", () => {
    expect(MAX_DOCUMENT_LENGTH).toBe(100_000);
  });
});
