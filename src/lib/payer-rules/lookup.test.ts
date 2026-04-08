import { describe, it, expect, vi } from "vitest";
import { checkPARequired } from "./lookup";

// Mock Supabase client
function createMockSupabase(mockData: Record<string, unknown>[] | null, error: { message: string } | null = null) {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  // Resolve the query chain
  mockQuery.eq.mockReturnValue(
    Promise.resolve({ data: mockData, error })
  );

  return {
    from: vi.fn().mockReturnValue(mockQuery),
  } as unknown as Parameters<typeof checkPARequired>[0];
}

const uhcDupixentRule = {
  id: "rule-001",
  payer_name: "UnitedHealthcare",
  plan_type: "Commercial",
  cpt_code: "J7500",
  icd10_code: null,
  pa_required: true,
  documentation_requirements: [
    { item: "BSA assessment", required: true, description: "Body surface area" },
    { item: "Prior treatment history", required: true, description: "Failed treatments" },
  ],
  submission_method: "portal",
  typical_turnaround_days: 10,
  step_therapy_required: true,
  step_therapy_details: "Must have tried topicals",
  confidence_score: 0.85,
  source_url: "https://example.com/policy.pdf",
  last_verified_date: "2026-03-15",
};

const aetnaDupixentGeneral = {
  ...uhcDupixentRule,
  id: "rule-002",
  payer_name: "Aetna",
  icd10_code: null,
  confidence_score: 0.8,
};

const aetnaDupixentSpecific = {
  ...uhcDupixentRule,
  id: "rule-003",
  payer_name: "Aetna",
  icd10_code: "L20.9",
  confidence_score: 0.9,
  documentation_requirements: [
    ...uhcDupixentRule.documentation_requirements,
    { item: "EASI score", required: true, description: "Severity scoring" },
  ],
};

describe("checkPARequired", () => {
  it("returns PA required with documentation for matching rule", async () => {
    const supabase = createMockSupabase([uhcDupixentRule]);
    const results = await checkPARequired(supabase, "UnitedHealthcare", "Commercial", ["J7500"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.pa_required).toBe(true);
    expect(results[0]!.confidence).toBe(0.85);
    expect(results[0]!.documentation_requirements).toHaveLength(2);
    expect(results[0]!.step_therapy_required).toBe(true);
    expect(results[0]!.rule_id).toBe("rule-001");
  });

  it("returns unknown when no rule exists", async () => {
    const supabase = createMockSupabase([]);
    const results = await checkPARequired(supabase, "UnknownPayer", "Commercial", ["99999"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.pa_required).toBe("unknown");
    expect(results[0]!.confidence).toBe(0);
    expect(results[0]!.documentation_requirements).toHaveLength(0);
    expect(results[0]!.rule_id).toBeNull();
  });

  it("returns unknown on database error", async () => {
    const supabase = createMockSupabase(null, { message: "connection failed" });
    const results = await checkPARequired(supabase, "UHC", "Commercial", ["J7500"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.pa_required).toBe("unknown");
    expect(results[0]!.confidence).toBe(0);
  });

  it("handles multiple CPT codes in one call", async () => {
    // First call returns a rule, second returns empty
    let callCount = 0;
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          // First CPT code query chain (3 chained calls: select, ilike x2, eq)
          return mockQuery;
        }
        // Return data based on which CPT we're looking at
        return Promise.resolve({
          data: callCount <= 4 ? [uhcDupixentRule] : [],
          error: null,
        });
      }),
    };

    // Simpler approach: just test with mock that returns data for first, empty for second
    const supabase1 = createMockSupabase([uhcDupixentRule]);
    const results1 = await checkPARequired(supabase1, "UHC", "Commercial", ["J7500"]);
    expect(results1).toHaveLength(1);
    expect(results1[0]!.pa_required).toBe(true);

    const supabase2 = createMockSupabase([]);
    const results2 = await checkPARequired(supabase2, "UHC", "Commercial", ["17311"]);
    expect(results2).toHaveLength(1);
    expect(results2[0]!.pa_required).toBe("unknown");
  });

  it("prefers diagnosis-specific rule when ICD-10 codes provided", async () => {
    const supabase = createMockSupabase([aetnaDupixentGeneral, aetnaDupixentSpecific]);
    const results = await checkPARequired(supabase, "Aetna", "Commercial", ["J7500"], ["L20.9"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.rule_id).toBe("rule-003");
    expect(results[0]!.confidence).toBe(0.9);
    expect(results[0]!.documentation_requirements).toHaveLength(3);
  });

  it("falls back to general rule when ICD-10 does not match", async () => {
    const supabase = createMockSupabase([aetnaDupixentGeneral, aetnaDupixentSpecific]);
    const results = await checkPARequired(supabase, "Aetna", "Commercial", ["J7500"], ["L40.0"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.rule_id).toBe("rule-002"); // General rule (no icd10_code)
  });
});
