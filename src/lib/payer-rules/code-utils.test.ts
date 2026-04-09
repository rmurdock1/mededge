import { describe, it, expect } from "vitest";
import { classifyCode } from "./code-utils";

describe("classifyCode", () => {
  it("classifies J-codes as drug", () => {
    expect(classifyCode("J0517")).toBe("drug");
    expect(classifyCode("J0135")).toBe("drug");
    expect(classifyCode("J1438")).toBe("drug");
    expect(classifyCode("J7500")).toBe("drug");
  });

  it("classifies other HCPCS Level II codes as drug", () => {
    // Q-codes (biosimilars, temporary codes)
    expect(classifyCode("Q5103")).toBe("drug");
    // S-codes (commercial payer-specific)
    expect(classifyCode("S0189")).toBe("drug");
  });

  it("classifies CPT codes as procedure", () => {
    expect(classifyCode("17311")).toBe("procedure");
    expect(classifyCode("96910")).toBe("procedure");
    expect(classifyCode("95044")).toBe("procedure");
    expect(classifyCode("99213")).toBe("procedure");
  });

  it("is case-insensitive for HCPCS codes", () => {
    expect(classifyCode("j0517")).toBe("drug");
    expect(classifyCode("j7500")).toBe("drug");
  });

  it("respects explicit hint over heuristic", () => {
    // Even though J0517 looks like a drug code, hint wins
    expect(classifyCode("J0517", "procedure")).toBe("procedure");
    // Even though 17311 looks like a procedure code, hint wins
    expect(classifyCode("17311", "drug")).toBe("drug");
  });

  it("classifies edge cases as procedure (safe default)", () => {
    // Codes that don't match HCPCS pattern fall to procedure
    expect(classifyCode("ABC")).toBe("procedure");
    expect(classifyCode("12345")).toBe("procedure");
    expect(classifyCode("J12345")).toBe("procedure"); // too many digits
    expect(classifyCode("JJ123")).toBe("procedure"); // two letters
  });
});
