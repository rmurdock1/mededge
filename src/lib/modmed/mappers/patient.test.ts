import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapPatient, formatPatientName } from "./patient";
import { _resetKeyCache, decryptPHI } from "@/lib/crypto/phi";
import type { FHIRPatient, FHIRHumanName } from "../types";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("formatPatientName()", () => {
  it("formats family + given name", () => {
    const names: FHIRHumanName[] = [
      { family: "Smith", given: ["John", "Michael"] },
    ];
    expect(formatPatientName(names)).toBe("Smith, John Michael");
  });

  it("prefers official name", () => {
    const names: FHIRHumanName[] = [
      { use: "usual", family: "Nickname" },
      { use: "official", family: "Smith", given: ["John"] },
    ];
    expect(formatPatientName(names)).toBe("Smith, John");
  });

  it("falls back to usual name", () => {
    const names: FHIRHumanName[] = [
      { use: "usual", family: "Smith", given: ["Johnny"] },
      { use: "temp", family: "Temp" },
    ];
    expect(formatPatientName(names)).toBe("Smith, Johnny");
  });

  it("uses text field when available", () => {
    const names: FHIRHumanName[] = [{ text: "Dr. Jane Doe" }];
    expect(formatPatientName(names)).toBe("Dr. Jane Doe");
  });

  it("handles family-only name", () => {
    const names: FHIRHumanName[] = [{ family: "Smith" }];
    expect(formatPatientName(names)).toBe("Smith");
  });

  it("handles given-only name", () => {
    const names: FHIRHumanName[] = [{ given: ["Jane"] }];
    expect(formatPatientName(names)).toBe("Jane");
  });

  it("returns 'Unknown Patient' for empty array", () => {
    expect(formatPatientName([])).toBe("Unknown Patient");
  });

  it("returns 'Unknown Patient' for undefined", () => {
    expect(formatPatientName(undefined)).toBe("Unknown Patient");
  });
});

describe("mapPatient()", () => {
  beforeEach(() => {
    _resetKeyCache();
    vi.stubEnv("PHI_ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    _resetKeyCache();
    vi.unstubAllEnvs();
  });

  const PRACTICE_ID = "practice-abc";

  const FHIR_PATIENT: FHIRPatient = {
    resourceType: "Patient",
    id: "modmed-123",
    name: [
      { use: "official", family: "Garcia", given: ["Maria", "Elena"] },
    ],
    birthDate: "1985-03-22",
    gender: "female",
  };

  it("maps FHIR patient to internal model", () => {
    const mapped = mapPatient(FHIR_PATIENT, PRACTICE_ID);

    expect(mapped.practice_id).toBe(PRACTICE_ID);
    expect(mapped.modmed_patient_id).toBe("modmed-123");
    // Name should be encrypted (not readable)
    expect(mapped.name_encrypted).not.toContain("Garcia");
    expect(mapped.name_encrypted.length).toBeGreaterThan(0);
    // Insurance fields are null (populated via coverage mapper)
    expect(mapped.insurance_payer).toBeNull();
    expect(mapped.plan_id).toBeNull();
    expect(mapped.plan_type).toBeNull();
  });

  it("encrypted name can be decrypted back", () => {
    const mapped = mapPatient(FHIR_PATIENT, PRACTICE_ID);
    const decrypted = decryptPHI(mapped.name_encrypted);
    expect(decrypted).toBe("Garcia, Maria Elena");
  });

  it("handles patient with no name", () => {
    const noName: FHIRPatient = {
      resourceType: "Patient",
      id: "p-no-name",
    };
    const mapped = mapPatient(noName, PRACTICE_ID);
    const decrypted = decryptPHI(mapped.name_encrypted);
    expect(decrypted).toBe("Unknown Patient");
  });
});
