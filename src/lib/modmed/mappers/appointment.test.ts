import { describe, it, expect } from "vitest";
import {
  mapAppointment,
  extractPatientId,
  extractProviderId,
  extractDate,
  extractCPTCodes,
  extractICD10Codes,
} from "./appointment";
import type { FHIRAppointment } from "../types";

const PRACTICE_ID = "practice-abc";

const FULL_APPOINTMENT: FHIRAppointment = {
  resourceType: "Appointment",
  id: "appt-456",
  status: "booked",
  start: "2026-04-15T09:00:00Z",
  end: "2026-04-15T09:30:00Z",
  participant: [
    {
      actor: { reference: "Patient/p-123", display: "John Smith" },
      status: "accepted",
    },
    {
      actor: { reference: "Practitioner/dr-789", display: "Dr. Johnson" },
      status: "accepted",
    },
  ],
  serviceType: [
    {
      coding: [
        {
          system: "http://www.ama-assn.org/go/cpt",
          code: "17311",
          display: "Mohs surgery",
        },
      ],
    },
    {
      coding: [
        {
          system: "http://www.ama-assn.org/go/cpt",
          code: "17312",
          display: "Mohs surgery add-on",
        },
      ],
    },
  ],
  reasonCode: [
    {
      coding: [
        {
          system: "http://hl7.org/fhir/sid/icd-10-cm",
          code: "C44.311",
          display: "Basal cell carcinoma of skin of nose",
        },
      ],
    },
  ],
};

describe("extractPatientId()", () => {
  it("extracts patient ID from participant", () => {
    expect(extractPatientId(FULL_APPOINTMENT)).toBe("p-123");
  });

  it("returns empty string when no patient participant", () => {
    const appt: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a1",
      participant: [
        { actor: { reference: "Practitioner/dr-1" }, status: "accepted" },
      ],
    };
    expect(extractPatientId(appt)).toBe("");
  });

  it("returns empty string when no participants", () => {
    const appt: FHIRAppointment = { resourceType: "Appointment", id: "a1" };
    expect(extractPatientId(appt)).toBe("");
  });
});

describe("extractProviderId()", () => {
  it("extracts practitioner ID from participant", () => {
    expect(extractProviderId(FULL_APPOINTMENT)).toBe("dr-789");
  });

  it("returns null when no practitioner participant", () => {
    const appt: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a1",
      participant: [
        { actor: { reference: "Patient/p-1" }, status: "accepted" },
      ],
    };
    expect(extractProviderId(appt)).toBeNull();
  });
});

describe("extractDate()", () => {
  it("extracts date from ISO start time", () => {
    expect(extractDate(FULL_APPOINTMENT)).toBe("2026-04-15");
  });

  it("falls back to today when no start time", () => {
    const appt: FHIRAppointment = { resourceType: "Appointment", id: "a1" };
    const today = new Date().toISOString().substring(0, 10);
    expect(extractDate(appt)).toBe(today);
  });
});

describe("extractCPTCodes()", () => {
  it("extracts CPT codes from serviceType", () => {
    const codes = extractCPTCodes(FULL_APPOINTMENT);
    expect(codes).toContain("17311");
    expect(codes).toContain("17312");
    expect(codes).toHaveLength(2);
  });

  it("deduplicates codes", () => {
    const appt: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a1",
      serviceType: [
        {
          coding: [
            { system: "http://www.ama-assn.org/go/cpt", code: "17311" },
            { system: "http://www.ama-assn.org/go/cpt", code: "17311" },
          ],
        },
      ],
    };
    expect(extractCPTCodes(appt)).toHaveLength(1);
  });

  it("extracts from extensions", () => {
    const appt: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a1",
      extension: [
        {
          url: "http://modmed.com/fhir/cpt",
          valueCoding: {
            system: "http://www.ama-assn.org/go/cpt",
            code: "96910",
          },
        },
      ],
    };
    expect(extractCPTCodes(appt)).toContain("96910");
  });

  it("returns empty array when no codes", () => {
    const appt: FHIRAppointment = { resourceType: "Appointment", id: "a1" };
    expect(extractCPTCodes(appt)).toHaveLength(0);
  });

  it("handles CPT OID system", () => {
    const appt: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a1",
      serviceType: [
        {
          coding: [
            { system: "urn:oid:2.16.840.1.113883.6.12", code: "99213" },
          ],
        },
      ],
    };
    expect(extractCPTCodes(appt)).toContain("99213");
  });
});

describe("extractICD10Codes()", () => {
  it("extracts ICD-10 codes from reasonCode", () => {
    const codes = extractICD10Codes(FULL_APPOINTMENT);
    expect(codes).toContain("C44.311");
    expect(codes).toHaveLength(1);
  });

  it("extracts from extensions", () => {
    const appt: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a1",
      extension: [
        {
          url: "http://modmed.com/fhir/icd10",
          valueCoding: {
            system: "http://hl7.org/fhir/sid/icd-10-cm",
            code: "L20.9",
          },
        },
      ],
    };
    expect(extractICD10Codes(appt)).toContain("L20.9");
  });

  it("returns empty array when no codes", () => {
    const appt: FHIRAppointment = { resourceType: "Appointment", id: "a1" };
    expect(extractICD10Codes(appt)).toHaveLength(0);
  });
});

describe("mapAppointment()", () => {
  it("maps full FHIR appointment to internal model", () => {
    const mapped = mapAppointment(FULL_APPOINTMENT, PRACTICE_ID);

    expect(mapped.practice_id).toBe(PRACTICE_ID);
    expect(mapped.modmed_appointment_id).toBe("appt-456");
    expect(mapped.modmed_patient_id).toBe("p-123");
    expect(mapped.provider_id).toBe("dr-789");
    expect(mapped.appointment_date).toBe("2026-04-15");
    expect(mapped.cpt_codes).toContain("17311");
    expect(mapped.cpt_codes).toContain("17312");
    expect(mapped.icd10_codes).toContain("C44.311");
  });

  it("handles minimal appointment", () => {
    const minimal: FHIRAppointment = {
      resourceType: "Appointment",
      id: "a-min",
      status: "booked",
      start: "2026-05-01T10:00:00Z",
    };

    const mapped = mapAppointment(minimal, PRACTICE_ID);

    expect(mapped.modmed_appointment_id).toBe("a-min");
    expect(mapped.modmed_patient_id).toBe("");
    expect(mapped.provider_id).toBeNull();
    expect(mapped.appointment_date).toBe("2026-05-01");
    expect(mapped.cpt_codes).toHaveLength(0);
    expect(mapped.icd10_codes).toHaveLength(0);
  });
});
