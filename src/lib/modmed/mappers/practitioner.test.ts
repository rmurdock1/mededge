import { describe, it, expect } from "vitest";
import {
  mapPractitioner,
  formatPractitionerName,
  extractNPI,
  extractSpecialty,
} from "./practitioner";
import type { FHIRPractitioner, FHIRHumanName, FHIRIdentifier } from "../types";

const FULL_PRACTITIONER: FHIRPractitioner = {
  resourceType: "Practitioner",
  id: "dr-789",
  active: true,
  name: [
    {
      use: "official",
      prefix: ["Dr."],
      given: ["Sarah", "M."],
      family: "Johnson",
      suffix: ["MD", "FAAD"],
    },
  ],
  identifier: [
    {
      system: "http://hl7.org/fhir/sid/us-npi",
      value: "1234567890",
    },
    {
      system: "http://modmed.com/practitioner-id",
      value: "MM-789",
    },
  ],
  qualification: [
    {
      code: {
        coding: [
          { code: "207N00000X", display: "Dermatology" },
        ],
        text: "Dermatology",
      },
    },
  ],
};

describe("formatPractitionerName()", () => {
  it("formats full name with prefix and suffix", () => {
    const result = formatPractitionerName(FULL_PRACTITIONER.name);
    expect(result).toBe("Dr. Sarah M. Johnson MD, FAAD");
  });

  it("handles simple name", () => {
    const names: FHIRHumanName[] = [
      { given: ["John"], family: "Doe" },
    ];
    expect(formatPractitionerName(names)).toBe("John Doe");
  });

  it("uses text field when available", () => {
    const names: FHIRHumanName[] = [
      { text: "Dr. Jane Doe, Board Certified" },
    ];
    expect(formatPractitionerName(names)).toBe("Dr. Jane Doe, Board Certified");
  });

  it("returns 'Unknown Provider' for empty array", () => {
    expect(formatPractitionerName([])).toBe("Unknown Provider");
  });

  it("returns 'Unknown Provider' for undefined", () => {
    expect(formatPractitionerName(undefined)).toBe("Unknown Provider");
  });

  it("prefers official name", () => {
    const names: FHIRHumanName[] = [
      { use: "usual", family: "Nick" },
      { use: "official", family: "Official" },
    ];
    expect(formatPractitionerName(names)).toBe("Official");
  });
});

describe("extractNPI()", () => {
  it("extracts NPI from identifiers", () => {
    expect(extractNPI(FULL_PRACTITIONER.identifier)).toBe("1234567890");
  });

  it("returns null when no NPI identifier", () => {
    const ids: FHIRIdentifier[] = [
      { system: "http://modmed.com/id", value: "123" },
    ];
    expect(extractNPI(ids)).toBeNull();
  });

  it("returns null for undefined identifiers", () => {
    expect(extractNPI(undefined)).toBeNull();
  });
});

describe("extractSpecialty()", () => {
  it("extracts specialty from qualification", () => {
    expect(extractSpecialty(FULL_PRACTITIONER)).toBe("Dermatology");
  });

  it("falls back to coding display", () => {
    const prac: FHIRPractitioner = {
      resourceType: "Practitioner",
      id: "dr-1",
      qualification: [
        {
          code: {
            coding: [{ code: "207N00000X", display: "Dermatology" }],
          },
        },
      ],
    };
    expect(extractSpecialty(prac)).toBe("Dermatology");
  });

  it("falls back to coding code", () => {
    const prac: FHIRPractitioner = {
      resourceType: "Practitioner",
      id: "dr-1",
      qualification: [
        {
          code: {
            coding: [{ code: "207N00000X" }],
          },
        },
      ],
    };
    expect(extractSpecialty(prac)).toBe("207N00000X");
  });

  it("returns null when no qualifications", () => {
    const prac: FHIRPractitioner = {
      resourceType: "Practitioner",
      id: "dr-1",
    };
    expect(extractSpecialty(prac)).toBeNull();
  });
});

describe("mapPractitioner()", () => {
  it("maps full practitioner to internal model", () => {
    const mapped = mapPractitioner(FULL_PRACTITIONER);

    expect(mapped.modmed_practitioner_id).toBe("dr-789");
    expect(mapped.display_name).toBe("Dr. Sarah M. Johnson MD, FAAD");
    expect(mapped.npi).toBe("1234567890");
    expect(mapped.specialty).toBe("Dermatology");
    expect(mapped.active).toBe(true);
  });

  it("handles minimal practitioner", () => {
    const minimal: FHIRPractitioner = {
      resourceType: "Practitioner",
      id: "dr-min",
    };

    const mapped = mapPractitioner(minimal);

    expect(mapped.modmed_practitioner_id).toBe("dr-min");
    expect(mapped.display_name).toBe("Unknown Provider");
    expect(mapped.npi).toBeNull();
    expect(mapped.specialty).toBeNull();
    expect(mapped.active).toBe(true); // defaults to true
  });

  it("detects inactive practitioner", () => {
    const inactive: FHIRPractitioner = {
      resourceType: "Practitioner",
      id: "dr-inactive",
      active: false,
      name: [{ family: "Retired" }],
    };

    const mapped = mapPractitioner(inactive);
    expect(mapped.active).toBe(false);
  });
});
