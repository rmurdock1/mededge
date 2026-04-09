import { describe, it, expect, vi } from "vitest";
import { runPADetection } from "./pa-detection";

vi.mock("@/lib/payer-rules/lookup", () => ({
  checkPARequired: vi.fn().mockResolvedValue([
    {
      kind: "procedure",
      code: "17311",
      payer_name: "UnitedHealthcare",
      plan_type: "Commercial",
      pa_required: true,
      confidence: 0.9,
      documentation_requirements: [
        { item: "Clinical notes", required: true },
      ],
      submission_method: "portal",
      typical_turnaround_days: 5,
      appeals_pathway: null,
      source_url: "https://example.com/policy",
      last_verified_date: "2026-04-01",
      rule_id: "rule-123",
      procedure_name: "Mohs surgery",
      cpt_code: "17311",
      site_of_service_restrictions: null,
      modifier_requirements: null,
      units_or_frequency_limits: null,
    },
  ]),
}));

vi.mock("@/lib/payer-rules/checklist", () => ({
  generateChecklist: vi.fn().mockReturnValue([
    { item: "Clinical notes", required: true, completed: false },
  ]),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockSupabase(appointments: unknown[] = []) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "appointments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: appointments,
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "patients") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              insurance_payer: "UnitedHealthcare",
              plan_type: "Commercial",
            },
            error: null,
          }),
        };
      }
      if (table === "prior_auths") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "pa_lookup_log") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };
}

describe("runPADetection", () => {
  it("returns zero counts when no appointments need checking", async () => {
    const supabase = createMockSupabase([]);

    const result = await runPADetection(supabase as never, "practice-1");

    expect(result.appointmentsChecked).toBe(0);
    expect(result.paRequired).toBe(0);
    expect(result.priorAuthsCreated).toBe(0);
  });

  it("detects PA requirement and creates prior_auth", async () => {
    const appointments = [
      {
        id: "appt-1",
        patient_id: "pat-1",
        cpt_codes: ["17311"],
        icd10_codes: ["C44.311"],
        appointment_date: "2026-05-01",
      },
    ];

    const supabase = createMockSupabase(appointments);

    const result = await runPADetection(supabase as never, "practice-1");

    expect(result.appointmentsChecked).toBe(1);
    expect(result.paRequired).toBe(1);
    expect(result.priorAuthsCreated).toBe(1);
  });

  it("logs lookup results to pa_lookup_log", async () => {
    const appointments = [
      {
        id: "appt-1",
        patient_id: "pat-1",
        cpt_codes: ["17311"],
        icd10_codes: [],
        appointment_date: "2026-05-01",
      },
    ];

    const supabase = createMockSupabase(appointments);
    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const originalFrom = supabase.from;
    supabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "pa_lookup_log") {
        return { insert: insertSpy };
      }
      return originalFrom(table);
    });

    await runPADetection(supabase as never, "practice-1");

    expect(insertSpy).toHaveBeenCalled();
    const logEntry = insertSpy.mock.calls[0]![0];
    expect(logEntry.code).toBe("17311");
    expect(logEntry.lookup_result).toBe("required");
  });

  it("handles missing patient insurance gracefully", async () => {
    const appointments = [
      {
        id: "appt-1",
        patient_id: "pat-1",
        cpt_codes: ["17311"],
        icd10_codes: [],
        appointment_date: "2026-05-01",
      },
    ];

    const supabase = createMockSupabase(appointments);
    // Override patients to return no insurance
    const originalFrom = supabase.from;
    supabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "patients") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { insurance_payer: null, plan_type: null },
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const result = await runPADetection(supabase as never, "practice-1");

    expect(result.appointmentsChecked).toBe(1);
    expect(result.unknown).toBe(1);
    expect(result.paRequired).toBe(0);
  });
});
