import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModMedClient, ModMedApiError, CircuitOpenError } from "./client";
import { InMemoryCircuitBreakerStore } from "./circuit-breaker";
import type { ModMedClientConfig, ModMedTokenResponse } from "./types";

const TEST_CONFIG: ModMedClientConfig = {
  firmUrlPrefix: "testfirm",
  username: "testuser",
  password: "testpass",
  apiKey: "test-api-key",
  authBaseUrl: "https://stage.ema-api.com/ema-dev",
};

const TOKEN_RESPONSE: ModMedTokenResponse = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  token_type: "Bearer",
  expires_in: 3600,
};

function createMockFetch(
  responses: Array<{
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
  }>
) {
  let callIndex = 0;
  return vi.fn().mockImplementation(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;
    const status = resp!.status;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => resp!.body ?? {},
      headers: {
        get: (name: string) => resp!.headers?.[name] ?? null,
      },
    };
  });
}

describe("ModMedClient", () => {
  let store: InMemoryCircuitBreakerStore;

  beforeEach(() => {
    store = new InMemoryCircuitBreakerStore();
  });

  function createClient(
    fetchResponses: Parameters<typeof createMockFetch>[0]
  ) {
    const mockFetch = createMockFetch(fetchResponses);
    const client = new ModMedClient(TEST_CONFIG, {
      fetchImpl: mockFetch as unknown as typeof fetch,
      circuitBreakerStore: store,
      maxRequestsPerSecond: 10_000,
      baseBackoffMs: 0,
      maxBackoffMs: 0,
      circuitBreakerThreshold: 3,
    });
    return { client, mockFetch };
  }

  describe("authenticate()", () => {
    it("sends correct OAuth2 password grant request", async () => {
      const { client, mockFetch } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
      ]);

      await client.authenticate();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0]!;
      expect(url).toContain("/firm/testfirm/ema/ws/oauth2/grant");
      expect(opts.method).toBe("POST");
      expect(opts.headers["x-api-key"]).toBe("test-api-key");
      expect(opts.body).toContain("grant_type=password");
      expect(opts.body).toContain("username=testuser");
    });

    it("throws on auth failure", async () => {
      const { client } = createClient([{ status: 401 }]);

      await expect(client.authenticate()).rejects.toThrow(ModMedApiError);
    });

    it("sets isAuthenticated after success", async () => {
      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
      ]);

      expect(client.isAuthenticated).toBe(false);
      await client.authenticate();
      expect(client.isAuthenticated).toBe(true);
    });
  });

  describe("request()", () => {
    it("auto-authenticates on first request", async () => {
      const { client, mockFetch } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 200, body: { resourceType: "Bundle", entry: [] } },
      ]);

      const result = await client.request("ema/fhir/v2/Patient");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ resourceType: "Bundle", entry: [] });
    });

    it("includes Authorization and x-api-key headers", async () => {
      const { client, mockFetch } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 200, body: {} },
      ]);

      await client.request("ema/fhir/v2/Patient");

      const fhirCall = mockFetch.mock.calls[1]!;
      expect(fhirCall[1].headers.Authorization).toBe(
        "Bearer test-access-token"
      );
      expect(fhirCall[1].headers["x-api-key"]).toBe("test-api-key");
    });

    it("appends query params to URL", async () => {
      const { client, mockFetch } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 200, body: {} },
      ]);

      await client.request("ema/fhir/v2/Patient", { _count: "50" });

      const url = mockFetch.mock.calls[1]![0];
      expect(url).toContain("_count=50");
    });

    it("retries on 401 with token refresh", async () => {
      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE }, // initial auth
        { status: 401 }, // first request fails
        {
          status: 200,
          body: { ...TOKEN_RESPONSE, access_token: "refreshed-token" },
        }, // refresh
        { status: 200, body: { data: "success" } }, // retry succeeds
      ]);

      const result = await client.request<{ data: string }>(
        "ema/fhir/v2/Patient"
      );
      expect(result.data).toBe("success");
    });

    it("retries on 429 with backoff", async () => {
      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 429, headers: { "Retry-After": "0" } },
        { status: 200, body: { data: "ok" } },
      ]);

      const result = await client.request<{ data: string }>(
        "ema/fhir/v2/Patient"
      );
      expect(result.data).toBe("ok");
    });

    it("retries on 5xx with backoff", async () => {
      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 503 },
        { status: 200, body: { data: "recovered" } },
      ]);

      const result = await client.request<{ data: string }>(
        "ema/fhir/v2/Patient"
      );
      expect(result.data).toBe("recovered");
    });

    it("throws after exhausting retries on 5xx", async () => {
      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 503 },
        { status: 503 },
        { status: 503 },
        { status: 503 }, // 4th attempt = 3 retries + 1 original
      ]);

      await expect(
        client.request("ema/fhir/v2/Patient")
      ).rejects.toThrow(ModMedApiError);
    });

    it("throws on non-retryable 4xx error", async () => {
      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 403 },
      ]);

      await expect(
        client.request("ema/fhir/v2/Patient")
      ).rejects.toThrow(ModMedApiError);
    });
  });

  describe("circuit breaker integration", () => {
    it("throws CircuitOpenError when breaker is open", async () => {
      await store.setState({
        status: "open",
        failure_count: 5,
        last_failure_at: new Date().toISOString(),
        last_failure_error: "repeated failures",
        opened_at: new Date().toISOString(),
      });

      const { client } = createClient([]);
      await expect(
        client.request("ema/fhir/v2/Patient")
      ).rejects.toThrow(CircuitOpenError);
    });

    it("opens breaker after consecutive non-retryable failures", async () => {
      // One client, 3 calls that all fail with 400 (non-retryable)
      const mockFetch = vi.fn();
      // First call: auth + 400
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => TOKEN_RESPONSE,
        headers: { get: () => null },
      });

      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({}),
          headers: { get: () => null },
        });
      }

      const singleClient = new ModMedClient(TEST_CONFIG, {
        fetchImpl: mockFetch as unknown as typeof fetch,
        circuitBreakerStore: store,
        maxRequestsPerSecond: 10_000,
        baseBackoffMs: 0,
        maxBackoffMs: 0,
        circuitBreakerThreshold: 3,
      });

      for (let i = 0; i < 3; i++) {
        try {
          await singleClient.request("ema/fhir/v2/Patient");
        } catch {
          // expected
        }
      }

      const state = await singleClient.getCircuitBreakerState();
      expect(state.status).toBe("open");
    });

    it("exposes tryRecovery for half-open transition", async () => {
      await store.setState({
        status: "open",
        failure_count: 5,
        last_failure_at: new Date().toISOString(),
        last_failure_error: "err",
        opened_at: new Date().toISOString(),
      });

      const { client } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 200, body: { data: "recovered" } },
      ]);

      await client.tryRecovery();
      const result = await client.request<{ data: string }>(
        "ema/fhir/v2/Patient"
      );
      expect(result.data).toBe("recovered");
    });
  });

  describe("requestUrl()", () => {
    it("makes request to a full URL (pagination)", async () => {
      const { client, mockFetch } = createClient([
        { status: 200, body: TOKEN_RESPONSE },
        { status: 200, body: { resourceType: "Bundle", entry: [] } },
      ]);

      await client.authenticate();
      const result = await client.requestUrl(
        "https://full-url.com/next-page"
      );

      const call = mockFetch.mock.calls[1]!;
      expect(call[0]).toBe("https://full-url.com/next-page");
      expect(result).toEqual({ resourceType: "Bundle", entry: [] });
    });
  });
});
