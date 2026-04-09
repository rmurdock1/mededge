import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runSync } from "./sync";
import type { ModMedClientConfig } from "./types";

// Mock the dependencies
vi.mock("./client", () => ({
  ModMedClient: vi.fn().mockImplementation(() => ({
    getCircuitBreakerState: vi.fn().mockResolvedValue({ status: "closed" }),
    tryRecovery: vi.fn(),
  })),
  CircuitOpenError: class CircuitOpenError extends Error {
    constructor() {
      super("Circuit open");
      this.name = "CircuitOpenError";
    }
  },
}));

vi.mock("./fetchers", () => ({
  FHIRFetcher: vi.fn().mockImplementation(() => ({
    fetchPractitioners: vi.fn().mockResolvedValue([]),
    fetchPatients: vi.fn().mockResolvedValue([]),
    fetchAllCoverage: vi.fn().mockResolvedValue([]),
    fetchAppointments: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("./circuit-breaker-db-store", () => ({
  SupabaseCircuitBreakerStore: vi.fn().mockImplementation(() => ({
    getState: vi.fn().mockResolvedValue({ status: "closed" }),
    setState: vi.fn(),
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const TEST_CONFIG: ModMedClientConfig = {
  firmUrlPrefix: "testfirm",
  username: "user",
  password: "pass",
  apiKey: "key",
  authBaseUrl: "https://stage.ema-api.com/ema-dev",
};

function createMockSupabase() {
  const insertData = { id: "sync-log-123" };

  const chainBuilder = (returnData: unknown = null) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: insertData, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({ data: [], error: null }),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data: [], error: null }),
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "practices") {
        return chainBuilder({
          modmed_url_prefix: "testfirm",
          modmed_credentials: {
            username: "user",
            password: "pass",
            api_key: "key",
            auth_base_url: "https://stage.ema-api.com/ema-dev",
          },
        });
      }
      if (table === "practice_sync_state") {
        return chainBuilder({ last_successful_sync_at: null });
      }
      return chainBuilder();
    }),
  };
}

describe("runSync", () => {
  beforeEach(() => {
    vi.stubEnv("PHI_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns failed when no ModMed config exists", async () => {
    const supabase = createMockSupabase();
    // Override practices to return no config
    supabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "practices") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { modmed_url_prefix: null, modmed_credentials: null },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "x" }, error: null }),
          }),
        }),
      };
    });

    const result = await runSync(
      supabase as never,
      "practice-1",
      "full",
      "manual"
    );

    expect(result.status).toBe("failed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.error).toContain("No ModMed credentials");
  });

  it("completes a full sync with explicit config", async () => {
    const supabase = createMockSupabase();

    const result = await runSync(
      supabase as never,
      "practice-1",
      "full",
      "manual",
      TEST_CONFIG
    );

    expect(result.status).toBe("completed");
    expect(result.syncLogId).toBe("sync-log-123");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("completes an incremental sync", async () => {
    const supabase = createMockSupabase();

    const result = await runSync(
      supabase as never,
      "practice-1",
      "incremental",
      "cron",
      TEST_CONFIG
    );

    expect(result.status).toBe("completed");
  });

  it("returns result with correct type for manual trigger", async () => {
    const supabase = createMockSupabase();

    const result = await runSync(
      supabase as never,
      "practice-1",
      "full",
      "initial_setup",
      TEST_CONFIG
    );

    expect(result.status).toBe("completed");
    expect(typeof result.recordsCreated).toBe("number");
    expect(typeof result.recordsUpdated).toBe("number");
  });
});
