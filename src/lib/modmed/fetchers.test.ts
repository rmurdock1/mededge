import { describe, it, expect, vi, beforeEach } from "vitest";
import { FHIRFetcher } from "./fetchers";
import type { ModMedClient } from "./client";
import type { FHIRBundle, FHIRPatient, FHIRAppointment } from "./types";

function createMockClient() {
  return {
    request: vi.fn(),
    requestUrl: vi.fn(),
  } as unknown as ModMedClient;
}

function makeBundle<T>(
  resources: T[],
  nextUrl?: string
): FHIRBundle {
  const bundle: FHIRBundle = {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((r) => ({ resource: r as never })),
  };

  if (nextUrl) {
    bundle.link = [
      { relation: "self", url: "https://example.com/self" },
      { relation: "next", url: nextUrl },
    ];
  }

  return bundle;
}

const PATIENT_1: FHIRPatient = {
  resourceType: "Patient",
  id: "p1",
  name: [{ family: "Smith", given: ["John"] }],
  birthDate: "1990-01-15",
};

const PATIENT_2: FHIRPatient = {
  resourceType: "Patient",
  id: "p2",
  name: [{ family: "Doe", given: ["Jane"] }],
};

const APPOINTMENT_1: FHIRAppointment = {
  resourceType: "Appointment",
  id: "a1",
  status: "booked",
  start: "2026-04-15T09:00:00Z",
};

describe("FHIRFetcher", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let fetcher: FHIRFetcher;

  beforeEach(() => {
    mockClient = createMockClient();
    fetcher = new FHIRFetcher(mockClient, { maxPages: 5, pageSize: 10 });
  });

  describe("fetchPatients()", () => {
    it("returns patients from a single page", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([PATIENT_1, PATIENT_2])
      );

      const patients = await fetcher.fetchPatients();

      expect(patients).toHaveLength(2);
      expect(patients[0]!.id).toBe("p1");
      expect(patients[1]!.id).toBe("p2");
      expect(mockClient.request).toHaveBeenCalledWith("ema/fhir/v2/Patient", {
        _count: "10",
      });
    });

    it("follows pagination links", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([PATIENT_1], "https://modmed.com/next-page")
      );
      (mockClient.requestUrl as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([PATIENT_2])
      );

      const patients = await fetcher.fetchPatients();

      expect(patients).toHaveLength(2);
      expect(mockClient.requestUrl).toHaveBeenCalledWith("https://modmed.com/next-page");
    });

    it("stops at maxPages", async () => {
      // Return a "next" link on every page
      const infiniteBundle = makeBundle([PATIENT_1], "https://modmed.com/next");

      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(infiniteBundle);
      (mockClient.requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue(infiniteBundle);

      const patients = await fetcher.fetchPatients();

      // maxPages=5: 1 initial + 4 next pages = 5 patients total
      expect(patients).toHaveLength(5);
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(mockClient.requestUrl).toHaveBeenCalledTimes(4);
    });

    it("handles empty bundle", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([])
      );

      const patients = await fetcher.fetchPatients();
      expect(patients).toHaveLength(0);
    });

    it("handles bundle with no entry key", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        resourceType: "Bundle",
        type: "searchset",
      });

      const patients = await fetcher.fetchPatients();
      expect(patients).toHaveLength(0);
    });

    it("passes through extra params", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([])
      );

      await fetcher.fetchPatients({ _lastUpdated: "gt2026-04-01" });

      expect(mockClient.request).toHaveBeenCalledWith("ema/fhir/v2/Patient", {
        _count: "10",
        _lastUpdated: "gt2026-04-01",
      });
    });
  });

  describe("fetchAppointments()", () => {
    it("applies date range params", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([APPOINTMENT_1])
      );

      await fetcher.fetchAppointments("2026-04-01", "2026-04-30");

      const callArgs = (mockClient.request as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(callArgs[0]).toBe("ema/fhir/v2/Appointment");
      // Should include date range
      expect(callArgs[1]!.date).toContain("ge2026-04-01");
      expect(callArgs[1]!.date).toContain("le2026-04-30");
    });

    it("works without date params", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([APPOINTMENT_1])
      );

      const appointments = await fetcher.fetchAppointments();
      expect(appointments).toHaveLength(1);
    });
  });

  describe("fetchCoverageForPatient()", () => {
    it("queries coverage for a specific patient", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([])
      );

      await fetcher.fetchCoverageForPatient("p1");

      expect(mockClient.request).toHaveBeenCalledWith("ema/fhir/v2/Coverage", {
        _count: "10",
        beneficiary: "Patient/p1",
      });
    });
  });

  describe("fetchPractitioners()", () => {
    it("fetches all practitioners", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([{ resourceType: "Practitioner", id: "dr1" }])
      );

      const practitioners = await fetcher.fetchPractitioners();
      expect(practitioners).toHaveLength(1);
    });
  });

  describe("fetchAllCoverage()", () => {
    it("fetches all coverage records", async () => {
      (mockClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeBundle([])
      );

      await fetcher.fetchAllCoverage();
      expect(mockClient.request).toHaveBeenCalledWith("ema/fhir/v2/Coverage", {
        _count: "10",
      });
    });
  });
});
