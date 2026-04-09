import { describe, it, expect } from "vitest";
import {
  mapCoverage,
  extractBeneficiaryId,
  extractPayerName,
  extractPlanType,
  pickPrimaryCoverage,
  normalizePayerName,
} from "./coverage";
import type { FHIRCoverage } from "../types";

const FULL_COVERAGE: FHIRCoverage = {
  resourceType: "Coverage",
  id: "cov-1",
  status: "active",
  beneficiary: { reference: "Patient/p-123" },
  payor: [{ display: "UnitedHealthcare", reference: "Organization/uhc" }],
  subscriberId: "UHC-MEMBER-456",
  class: [
    {
      type: { coding: [{ code: "plan" }] },
      value: "Commercial",
      name: "PPO Gold",
    },
    {
      type: { coding: [{ code: "group" }] },
      value: "GRP-789",
      name: "Employer Group",
    },
  ],
};

describe("extractBeneficiaryId()", () => {
  it("extracts patient ID from reference", () => {
    expect(extractBeneficiaryId(FULL_COVERAGE)).toBe("p-123");
  });

  it("returns empty string when no beneficiary", () => {
    const cov: FHIRCoverage = { resourceType: "Coverage", id: "c1" };
    expect(extractBeneficiaryId(cov)).toBe("");
  });
});

describe("extractPayerName()", () => {
  it("extracts payer display name", () => {
    expect(extractPayerName(FULL_COVERAGE)).toBe("UnitedHealthcare");
  });

  it("falls back to reference when no display", () => {
    const cov: FHIRCoverage = {
      resourceType: "Coverage",
      id: "c1",
      payor: [{ reference: "Organization/aetna" }],
    };
    expect(extractPayerName(cov)).toBe("Organization/aetna");
  });

  it("returns null when no payor", () => {
    const cov: FHIRCoverage = { resourceType: "Coverage", id: "c1" };
    expect(extractPayerName(cov)).toBeNull();
  });

  it("normalizes common payer name aliases", () => {
    const cov: FHIRCoverage = {
      resourceType: "Coverage",
      id: "c1",
      payor: [{ display: "United Healthcare" }],
    };
    expect(extractPayerName(cov)).toBe("UnitedHealthcare");
  });
});

describe("extractPlanType()", () => {
  it("extracts plan type from class array", () => {
    expect(extractPlanType(FULL_COVERAGE)).toBe("Commercial");
  });

  it("falls back to Coverage.type", () => {
    const cov: FHIRCoverage = {
      resourceType: "Coverage",
      id: "c1",
      type: {
        coding: [{ code: "HMO", display: "Health Maintenance Organization" }],
        text: "HMO",
      },
    };
    expect(extractPlanType(cov)).toBe("HMO");
  });

  it("returns null when no plan info", () => {
    const cov: FHIRCoverage = { resourceType: "Coverage", id: "c1" };
    expect(extractPlanType(cov)).toBeNull();
  });
});

describe("mapCoverage()", () => {
  it("maps full coverage to internal model", () => {
    const mapped = mapCoverage(FULL_COVERAGE);

    expect(mapped.modmed_patient_id).toBe("p-123");
    expect(mapped.insurance_payer).toBe("UnitedHealthcare");
    expect(mapped.plan_id).toBe("UHC-MEMBER-456");
    expect(mapped.plan_type).toBe("Commercial");
  });

  it("handles minimal coverage", () => {
    const minimal: FHIRCoverage = {
      resourceType: "Coverage",
      id: "c-min",
    };

    const mapped = mapCoverage(minimal);

    expect(mapped.modmed_patient_id).toBe("");
    expect(mapped.insurance_payer).toBeNull();
    expect(mapped.plan_id).toBeNull();
    expect(mapped.plan_type).toBeNull();
  });
});

describe("pickPrimaryCoverage()", () => {
  it("returns null for empty array", () => {
    expect(pickPrimaryCoverage([])).toBeNull();
  });

  it("returns the only coverage", () => {
    expect(pickPrimaryCoverage([FULL_COVERAGE])).toBe(FULL_COVERAGE);
  });

  it("prefers active coverage", () => {
    const inactive: FHIRCoverage = {
      resourceType: "Coverage",
      id: "c-old",
      status: "cancelled",
      payor: [{ display: "Old Payer" }],
    };

    const result = pickPrimaryCoverage([inactive, FULL_COVERAGE]);
    expect(result?.id).toBe("cov-1");
  });

  it("prefers primary (order=1) coverage", () => {
    const secondary: FHIRCoverage = {
      ...FULL_COVERAGE,
      id: "c-secondary",
      order: 2,
    };
    const primary: FHIRCoverage = {
      ...FULL_COVERAGE,
      id: "c-primary",
      order: 1,
    };

    const result = pickPrimaryCoverage([secondary, primary]);
    expect(result?.id).toBe("c-primary");
  });

  it("sorts by lastUpdated when no order", () => {
    const older: FHIRCoverage = {
      ...FULL_COVERAGE,
      id: "c-old",
      meta: { lastUpdated: "2026-01-01T00:00:00Z" },
    };
    const newer: FHIRCoverage = {
      ...FULL_COVERAGE,
      id: "c-new",
      meta: { lastUpdated: "2026-04-01T00:00:00Z" },
    };

    const result = pickPrimaryCoverage([older, newer]);
    expect(result?.id).toBe("c-new");
  });
});

describe("normalizePayerName()", () => {
  it("normalizes UHC variants", () => {
    expect(normalizePayerName("United Healthcare")).toBe("UnitedHealthcare");
    expect(normalizePayerName("UHC")).toBe("UnitedHealthcare");
    expect(normalizePayerName("United Health Care")).toBe("UnitedHealthcare");
  });

  it("normalizes BCBS variants", () => {
    expect(normalizePayerName("Blue Cross Blue Shield")).toBe("BCBS");
    expect(normalizePayerName("Anthem BCBS")).toBe("BCBS");
  });

  it("trims and collapses whitespace", () => {
    expect(normalizePayerName("  Aetna  ")).toBe("Aetna");
    expect(normalizePayerName("Cigna  Health")).toBe("Cigna Health");
  });

  it("preserves unknown payer names", () => {
    expect(normalizePayerName("Some Regional Payer")).toBe("Some Regional Payer");
  });
});
