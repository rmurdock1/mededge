import { describe, it, expect, vi } from "vitest";
import { checkPARequired, getStaleRules } from "./lookup";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Supabase client that routes `.from("payer_rules_drug")`
 * and `.from("payer_rules_procedure")` to separate data stores.
 */
function createMockSupabase(opts: {
  drugData?: Record<string, unknown>[] | null;
  procedureData?: Record<string, unknown>[] | null;
  drugError?: { message: string } | null;
  procedureError?: { message: string } | null;
}) {
  function buildChain(
    data: Record<string, unknown>[] | null | undefined,
    error: { message: string } | null | undefined
  ) {
    const resolved = Promise.resolve({ data: data ?? null, error: error ?? null });
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    // Every query-builder method returns the chain (for chaining),
    // but also acts as a thenable so `await` resolves the final value.
    const thenFn = vi.fn().mockImplementation(
      (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        resolved.then(resolve, reject)
    );
    chain.select = vi.fn().mockReturnValue(chain);
    chain.ilike = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.lt = vi.fn().mockReturnValue(chain);
    chain.then = thenFn;
    return chain;
  }

  const drugChain = buildChain(opts.drugData, opts.drugError);
  const procedureChain = buildChain(opts.procedureData, opts.procedureError);

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "payer_rules_drug") return drugChain;
      if (table === "payer_rules_procedure") return procedureChain;
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof checkPARequired>[0];
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const uhcDupixentDrugRule = {
  id: "drug-001",
  payer_name: "UnitedHealthcare",
  plan_type: "Commercial",
  hcpcs_code: "J0517",
  ndc_code: null,
  drug_name: "Dupixent (dupilumab)",
  icd10_codes: [],
  pa_required: true,
  documentation_requirements: [
    { item: "BSA assessment", required: true, description: "Body surface area" },
    { item: "Prior treatment history", required: true, description: "Failed treatments" },
  ],
  step_therapy_required: true,
  step_therapy_details: { required_drugs: ["topical corticosteroids"], duration_days: 90 },
  lab_requirements: null,
  appeals_pathway: null,
  submission_method: "portal",
  typical_turnaround_days: 10,
  source_url: "https://example.com/policy.pdf",
  last_verified_date: "2026-03-15",
  confidence_score: 0.85,
  deleted_at: null,
};

const aetnaDupixentGeneric = {
  ...uhcDupixentDrugRule,
  id: "drug-002",
  payer_name: "Aetna",
  icd10_codes: [],
  confidence_score: 0.8,
};

const aetnaDupixentSpecific = {
  ...uhcDupixentDrugRule,
  id: "drug-003",
  payer_name: "Aetna",
  icd10_codes: ["L20.9"],
  confidence_score: 0.9,
  documentation_requirements: [
    ...uhcDupixentDrugRule.documentation_requirements,
    { item: "EASI score", required: true, description: "Severity scoring" },
  ],
};

const uhcMohsProcedureRule = {
  id: "proc-001",
  payer_name: "UnitedHealthcare",
  plan_type: "Commercial",
  cpt_code: "17311",
  procedure_name: "Mohs surgery — first stage",
  icd10_codes: [],
  pa_required: true,
  documentation_requirements: [
    { item: "Biopsy pathology report", required: true, description: "Confirmed malignancy" },
  ],
  site_of_service_restrictions: null,
  modifier_requirements: null,
  units_or_frequency_limits: null,
  appeals_pathway: null,
  submission_method: "portal",
  typical_turnaround_days: 7,
  source_url: "https://example.com/mohs-policy.pdf",
  last_verified_date: "2026-02-01",
  confidence_score: 0.9,
  deleted_at: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkPARequired", () => {
  it("returns a drug result for a J-code match", async () => {
    const supabase = createMockSupabase({ drugData: [uhcDupixentDrugRule] });
    const results = await checkPARequired(supabase, "UnitedHealthcare", "Commercial", ["J0517"]);

    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("drug");
    expect(r.pa_required).toBe(true);
    expect(r.confidence).toBe(0.85);
    expect(r.code).toBe("J0517");
    expect(r.rule_id).toBe("drug-001");

    // Narrow to drug-specific fields
    if (r.kind === "drug") {
      expect(r.drug_name).toBe("Dupixent (dupilumab)");
      expect(r.step_therapy_required).toBe(true);
      expect(r.step_therapy_details).toEqual({
        required_drugs: ["topical corticosteroids"],
        duration_days: 90,
      });
      expect(r.documentation_requirements).toHaveLength(2);
    }
  });

  it("returns a procedure result for a CPT code match", async () => {
    const supabase = createMockSupabase({ procedureData: [uhcMohsProcedureRule] });
    const results = await checkPARequired(supabase, "UnitedHealthcare", "Commercial", ["17311"]);

    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("procedure");
    expect(r.pa_required).toBe(true);
    expect(r.code).toBe("17311");

    if (r.kind === "procedure") {
      expect(r.procedure_name).toBe("Mohs surgery — first stage");
      expect(r.cpt_code).toBe("17311");
    }
  });

  it("returns unknown when no rule exists", async () => {
    const supabase = createMockSupabase({ drugData: [], procedureData: [] });
    const results = await checkPARequired(supabase, "UnknownPayer", "Commercial", ["J9999"]);

    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("unknown");
    expect(r.pa_required).toBe("unknown");
    expect(r.confidence).toBe(0);
    expect(r.rule_id).toBeNull();
  });

  it("returns unknown on database error", async () => {
    const supabase = createMockSupabase({
      drugError: { message: "connection failed" },
    });
    const results = await checkPARequired(supabase, "UHC", "Commercial", ["J0517"]);

    expect(results).toHaveLength(1);
    expect(results[0]!.kind).toBe("unknown");
    expect(results[0]!.pa_required).toBe("unknown");
  });

  it("handles mixed drug and procedure codes in one call", async () => {
    const supabase = createMockSupabase({
      drugData: [uhcDupixentDrugRule],
      procedureData: [uhcMohsProcedureRule],
    });
    const results = await checkPARequired(
      supabase,
      "UnitedHealthcare",
      "Commercial",
      ["J0517", "17311"]
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.kind).toBe("drug");
    expect(results[1]!.kind).toBe("procedure");
  });

  it("prefers diagnosis-specific drug rule when ICD-10 codes match", async () => {
    const supabase = createMockSupabase({
      drugData: [aetnaDupixentGeneric, aetnaDupixentSpecific],
    });
    const results = await checkPARequired(
      supabase,
      "Aetna",
      "Commercial",
      ["J0517"],
      ["L20.9"]
    );

    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.rule_id).toBe("drug-003"); // specific rule
    expect(r.confidence).toBe(0.9);
    if (r.kind === "drug") {
      expect(r.documentation_requirements).toHaveLength(3); // includes EASI score
    }
  });

  it("falls back to generic rule when ICD-10 does not match", async () => {
    const supabase = createMockSupabase({
      drugData: [aetnaDupixentGeneric, aetnaDupixentSpecific],
    });
    const results = await checkPARequired(
      supabase,
      "Aetna",
      "Commercial",
      ["J0517"],
      ["L40.0"] // psoriasis — not in the specific rule
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.rule_id).toBe("drug-002"); // generic rule
  });

  it("respects codeKindHint to override classification", async () => {
    // Force a CPT-looking code to be treated as a drug
    const supabase = createMockSupabase({ drugData: [] });
    const results = await checkPARequired(
      supabase,
      "UHC",
      "Commercial",
      ["12345"],
      undefined,
      "drug"
    );

    // It should have queried payer_rules_drug, not procedure
    expect(supabase.from).toHaveBeenCalledWith("payer_rules_drug");
    expect(results[0]!.kind).toBe("unknown"); // no data, but queried drug table
  });

  it("filters out soft-deleted rules via deleted_at IS NULL", async () => {
    const supabase = createMockSupabase({ drugData: [] });
    await checkPARequired(supabase, "UHC", "Commercial", ["J0517"]);

    // Verify the chain includes .is("deleted_at", null)
    const fromCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0]!.value;
    expect(fromCall.is).toHaveBeenCalledWith("deleted_at", null);
  });
});

describe("getStaleRules", () => {
  it("returns stale rules from both tables", async () => {
    const staleDrug = {
      id: "d1",
      payer_name: "UHC",
      hcpcs_code: "J0517",
      last_verified_date: "2025-01-01",
    };
    const staleProcedure = {
      id: "p1",
      payer_name: "Aetna",
      cpt_code: "17311",
      last_verified_date: "2025-02-01",
    };

    const supabase = createMockSupabase({
      drugData: [staleDrug],
      procedureData: [staleProcedure],
    });

    const stale = await getStaleRules(supabase, 12);

    expect(stale).toHaveLength(2);
    expect(stale[0]!.table).toBe("drug");
    expect(stale[0]!.code).toBe("J0517");
    expect(stale[1]!.table).toBe("procedure");
    expect(stale[1]!.code).toBe("17311");
  });

  it("returns empty array when no rules are stale", async () => {
    const supabase = createMockSupabase({ drugData: [], procedureData: [] });
    const stale = await getStaleRules(supabase, 12);
    expect(stale).toHaveLength(0);
  });

  it("handles errors gracefully", async () => {
    const supabase = createMockSupabase({
      drugError: { message: "timeout" },
      procedureData: [],
    });
    const stale = await getStaleRules(supabase, 12);
    // Drug query failed, but procedure succeeded
    expect(stale).toHaveLength(0);
  });
});
