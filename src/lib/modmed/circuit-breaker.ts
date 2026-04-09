/**
 * Circuit Breaker for ModMed API calls.
 *
 * States:
 * - CLOSED: normal operation, requests flow through
 * - OPEN: too many consecutive failures, requests blocked
 * - HALF_OPEN: testing recovery, one request allowed through
 *
 * State persistence is pluggable via CircuitBreakerStore interface.
 * PR 1 ships an InMemoryStore for testing; PR 2 adds a Supabase-backed
 * store so state survives Vercel serverless cold starts.
 *
 * Recovery: half-open test happens on the cron schedule (not a separate
 * cooldown timer). When the breaker is open, the next scheduled cron run
 * does the half-open test. If it succeeds, breaker closes. If it fails,
 * breaker stays open and waits for the next scheduled run.
 */

import type { CircuitBreakerState } from "./types";
import { DEFAULT_CIRCUIT_BREAKER_STATE } from "./types";

// ---------------------------------------------------------------------------
// Store interface (pluggable persistence)
// ---------------------------------------------------------------------------

export interface CircuitBreakerStore {
  getState(): Promise<CircuitBreakerState>;
  setState(state: CircuitBreakerState): Promise<void>;
}

/**
 * In-memory store for unit tests and local dev.
 * WARNING: State is lost on Vercel cold starts. Use the Supabase-backed
 * store (PR 2) for production.
 */
export class InMemoryCircuitBreakerStore implements CircuitBreakerStore {
  private state: CircuitBreakerState = { ...DEFAULT_CIRCUIT_BREAKER_STATE };

  async getState(): Promise<CircuitBreakerState> {
    return { ...this.state };
  }

  async setState(state: CircuitBreakerState): Promise<void> {
    this.state = { ...state };
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the breaker. Default: 5 */
  failureThreshold?: number;
}

export class CircuitBreaker {
  private readonly store: CircuitBreakerStore;
  private readonly failureThreshold: number;

  constructor(store?: CircuitBreakerStore, opts?: CircuitBreakerOptions) {
    this.store = store ?? new InMemoryCircuitBreakerStore();
    this.failureThreshold = opts?.failureThreshold ?? 5;
  }

  /**
   * Check if a request is allowed to proceed.
   *
   * - CLOSED → always allowed
   * - OPEN → blocked (returns false). Caller should transition to
   *   HALF_OPEN on the next cron run and allow one test request.
   * - HALF_OPEN → allowed (one test request)
   */
  async canExecute(): Promise<boolean> {
    const state = await this.store.getState();

    switch (state.status) {
      case "closed":
        return true;
      case "half_open":
        return true; // allow the test request
      case "open":
        return false;
      default:
        return true;
    }
  }

  /**
   * Transition from OPEN to HALF_OPEN for a recovery test.
   * Called by the sync orchestrator at the start of a cron run
   * when it detects the breaker is open.
   */
  async tryHalfOpen(): Promise<void> {
    const state = await this.store.getState();
    if (state.status === "open") {
      await this.store.setState({
        ...state,
        status: "half_open",
      });
    }
  }

  /**
   * Record a successful API call. Closes the breaker if it was half-open.
   */
  async recordSuccess(): Promise<void> {
    const state = await this.store.getState();

    await this.store.setState({
      status: "closed",
      failure_count: 0,
      last_failure_at: state.last_failure_at,
      last_failure_error: state.last_failure_error,
      opened_at: null,
    });
  }

  /**
   * Record a failed API call. Opens the breaker after failureThreshold
   * consecutive failures.
   */
  async recordFailure(error: string): Promise<void> {
    const state = await this.store.getState();
    const now = new Date().toISOString();
    const newCount = state.failure_count + 1;

    if (newCount >= this.failureThreshold) {
      // Open the breaker
      await this.store.setState({
        status: "open",
        failure_count: newCount,
        last_failure_at: now,
        last_failure_error: error,
        opened_at: state.opened_at ?? now,
      });
    } else if (state.status === "half_open") {
      // Half-open test failed → re-open
      await this.store.setState({
        status: "open",
        failure_count: newCount,
        last_failure_at: now,
        last_failure_error: error,
        opened_at: state.opened_at ?? now,
      });
    } else {
      // Still under threshold
      await this.store.setState({
        ...state,
        failure_count: newCount,
        last_failure_at: now,
        last_failure_error: error,
      });
    }
  }

  /**
   * Get the current breaker state (for dashboard display).
   */
  async getState(): Promise<CircuitBreakerState> {
    return this.store.getState();
  }
}
