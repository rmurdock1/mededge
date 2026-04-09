/**
 * ModMed OAuth2 client.
 *
 * Handles:
 * - OAuth2 Password Grant authentication
 * - Token refresh on expiry
 * - Per-request rate limiting (1 req/sec default)
 * - Circuit breaker integration
 * - Exponential backoff on 429/5xx
 * - Retry with fresh token on 401
 *
 * Architecture:
 * - One client instance per practice (credentials as constructor args)
 * - Tokens held in memory (not persisted — re-auth on cold start is fine
 *   for 15-minute sync cadence)
 * - Circuit breaker store is pluggable (in-memory for tests, DB for prod)
 *
 * HIPAA:
 * - Never log response bodies (may contain PHI)
 * - Only log: resource type, status code, timing, error category
 */

import type {
  ModMedClientConfig,
  ModMedTokenResponse,
} from "./types";
import { RateLimiter } from "./rate-limiter";
import { CircuitBreaker } from "./circuit-breaker";
import type { CircuitBreakerStore } from "./circuit-breaker";

const MAX_RETRIES = 3;

export class ModMedApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ModMedApiError";
  }
}

export class CircuitOpenError extends Error {
  constructor() {
    super("Circuit breaker is open. ModMed API calls are suspended due to repeated failures.");
    this.name = "CircuitOpenError";
  }
}

export interface ModMedClientOptions {
  circuitBreakerStore?: CircuitBreakerStore;
  /** Failure threshold before opening circuit breaker. Default: 5 */
  circuitBreakerThreshold?: number;
  /** Max requests per second. Default: 1 */
  maxRequestsPerSecond?: number;
  /** Base delay for exponential backoff in ms. Default: 1000. Set to 0 in tests. */
  baseBackoffMs?: number;
  /** Max backoff delay in ms. Default: 30000. Set to 0 in tests. */
  maxBackoffMs?: number;
  /** Custom fetch implementation (for testing). Default: global fetch */
  fetchImpl?: typeof fetch;
}

export class ModMedClient {
  private readonly config: ModMedClientConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly fetchImpl: typeof fetch;

  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: ModMedClientConfig, opts: ModMedClientOptions = {}) {
    this.config = config;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.rateLimiter = new RateLimiter({
      maxPerSecond: opts.maxRequestsPerSecond ?? 1,
      baseBackoffMs: opts.baseBackoffMs ?? 1000,
      maxBackoffMs: opts.maxBackoffMs ?? 30_000,
    });
    this.circuitBreaker = new CircuitBreaker(opts.circuitBreakerStore, {
      failureThreshold: opts.circuitBreakerThreshold ?? 5,
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Authenticate with ModMed OAuth2 password grant.
   * Called automatically before the first request, or can be called
   * explicitly to pre-warm the token.
   */
  async authenticate(): Promise<void> {
    const url = `${this.config.authBaseUrl}/firm/${this.config.firmUrlPrefix}/ema/ws/oauth2/grant`;

    const body = new URLSearchParams({
      grant_type: "password",
      username: this.config.username,
      password: this.config.password,
    });

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new ModMedApiError(
        `Authentication failed: ${response.status} ${response.statusText}`,
        response.status,
        response.status >= 500
      );
    }

    const data = (await response.json()) as ModMedTokenResponse;
    this.setTokens(data);
  }

  /**
   * Make an authenticated FHIR API request.
   *
   * Handles:
   * - Auto-authentication if no token
   * - Token refresh on 401
   * - Rate limiting
   * - Circuit breaker check
   * - Exponential backoff on 429/5xx
   *
   * @param path - Relative FHIR path, e.g. "ema/fhir/v2/Patient"
   * @param params - Optional URL search params
   * @returns Parsed JSON response
   */
  async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    if (!(await this.circuitBreaker.canExecute())) {
      throw new CircuitOpenError();
    }

    // Ensure we have a valid token
    await this.ensureAuthenticated();

    const url = this.buildUrl(path, params);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimiter.waitForSlot();

      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "x-api-key": this.config.apiKey,
          Accept: "application/fhir+json",
        },
      });

      if (response.ok) {
        this.rateLimiter.recordSuccess();
        await this.circuitBreaker.recordSuccess();
        return (await response.json()) as T;
      }

      // 401: token expired — refresh and retry once
      if (response.status === 401 && attempt === 0) {
        await this.refreshOrReauthenticate();
        continue;
      }

      // 429: rate limited — backoff and retry
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get("Retry-After") ?? undefined;
        await this.rateLimiter.backoff(retryAfter);
        continue;
      }

      // 5xx: server error — backoff and retry
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.rateLimiter.backoff();
        continue;
      }

      // Non-retryable error or exhausted retries
      const errorMsg = `ModMed API error: ${response.status} ${response.statusText} on ${path}`;
      await this.circuitBreaker.recordFailure(errorMsg);
      throw new ModMedApiError(errorMsg, response.status, false);
    }

    // Should not reach here, but TypeScript needs a return
    throw new ModMedApiError("Exhausted retries", 0, false);
  }

  /**
   * Make a request to a full URL (for FHIR pagination "next" links).
   */
  async requestUrl<T>(fullUrl: string): Promise<T> {
    if (!(await this.circuitBreaker.canExecute())) {
      throw new CircuitOpenError();
    }

    await this.ensureAuthenticated();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimiter.waitForSlot();

      const response = await this.fetchImpl(fullUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "x-api-key": this.config.apiKey,
          Accept: "application/fhir+json",
        },
      });

      if (response.ok) {
        this.rateLimiter.recordSuccess();
        await this.circuitBreaker.recordSuccess();
        return (await response.json()) as T;
      }

      if (response.status === 401 && attempt === 0) {
        await this.refreshOrReauthenticate();
        continue;
      }

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get("Retry-After") ?? undefined;
        await this.rateLimiter.backoff(retryAfter);
        continue;
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.rateLimiter.backoff();
        continue;
      }

      const errorMsg = `ModMed API error: ${response.status} on paginated request`;
      await this.circuitBreaker.recordFailure(errorMsg);
      throw new ModMedApiError(errorMsg, response.status, false);
    }

    throw new ModMedApiError("Exhausted retries on paginated request", 0, false);
  }

  /**
   * Get the current circuit breaker state (for dashboard display).
   */
  async getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  /**
   * Transition circuit breaker to half-open for a recovery test.
   * Called by the sync orchestrator at the start of a cron run.
   */
  async tryRecovery() {
    return this.circuitBreaker.tryHalfOpen();
  }

  /**
   * Check if the client currently has a valid token.
   */
  get isAuthenticated(): boolean {
    return this.accessToken !== null && Date.now() < this.tokenExpiresAt;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async refreshOrReauthenticate(): Promise<void> {
    // Invalidate the current token to force re-auth
    this.tokenExpiresAt = 0;
    await this.ensureAuthenticated();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated) return;

    if (this.refreshTokenValue) {
      try {
        await this.refreshToken();
        return;
      } catch {
        // Refresh failed — fall through to full re-auth
      }
    }

    await this.authenticate();
  }

  private async refreshToken(): Promise<void> {
    const url = `${this.config.authBaseUrl}/firm/${this.config.firmUrlPrefix}/ema/ws/oauth2/grant`;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshTokenValue!,
    });

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      this.accessToken = null;
      this.refreshTokenValue = null;
      this.tokenExpiresAt = 0;
      throw new ModMedApiError(
        `Token refresh failed: ${response.status}`,
        response.status,
        false
      );
    }

    const data = (await response.json()) as ModMedTokenResponse;
    this.setTokens(data);
  }

  private setTokens(data: ModMedTokenResponse): void {
    this.accessToken = data.access_token;
    this.refreshTokenValue = data.refresh_token;
    // Expire 60 seconds early to avoid edge-case race conditions
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = `${this.config.authBaseUrl}/firm/${this.config.firmUrlPrefix}/${path}`;
    if (!params || Object.keys(params).length === 0) return base;

    const qs = new URLSearchParams(params);
    return `${base}?${qs.toString()}`;
  }
}
