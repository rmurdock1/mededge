import { describe, it, expect, beforeEach } from "vitest";
import {
  CircuitBreaker,
  InMemoryCircuitBreakerStore,
} from "./circuit-breaker";

describe("CircuitBreaker", () => {
  let store: InMemoryCircuitBreakerStore;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    store = new InMemoryCircuitBreakerStore();
    breaker = new CircuitBreaker(store, { failureThreshold: 3 });
  });

  it("starts in closed state and allows requests", async () => {
    expect(await breaker.canExecute()).toBe(true);

    const state = await breaker.getState();
    expect(state.status).toBe("closed");
    expect(state.failure_count).toBe(0);
  });

  it("stays closed after failures below threshold", async () => {
    await breaker.recordFailure("timeout");
    await breaker.recordFailure("timeout");

    expect(await breaker.canExecute()).toBe(true);

    const state = await breaker.getState();
    expect(state.status).toBe("closed");
    expect(state.failure_count).toBe(2);
    expect(state.last_failure_error).toBe("timeout");
  });

  it("opens after reaching failure threshold", async () => {
    await breaker.recordFailure("err1");
    await breaker.recordFailure("err2");
    await breaker.recordFailure("err3");

    expect(await breaker.canExecute()).toBe(false);

    const state = await breaker.getState();
    expect(state.status).toBe("open");
    expect(state.failure_count).toBe(3);
    expect(state.opened_at).not.toBeNull();
  });

  it("blocks requests when open", async () => {
    // Force open
    await breaker.recordFailure("e1");
    await breaker.recordFailure("e2");
    await breaker.recordFailure("e3");

    expect(await breaker.canExecute()).toBe(false);
  });

  it("transitions from open to half_open via tryHalfOpen()", async () => {
    // Force open
    await breaker.recordFailure("e1");
    await breaker.recordFailure("e2");
    await breaker.recordFailure("e3");

    await breaker.tryHalfOpen();

    const state = await breaker.getState();
    expect(state.status).toBe("half_open");
    expect(await breaker.canExecute()).toBe(true);
  });

  it("closes on success after half_open", async () => {
    // Open → half_open → success → closed
    await breaker.recordFailure("e1");
    await breaker.recordFailure("e2");
    await breaker.recordFailure("e3");

    await breaker.tryHalfOpen();
    await breaker.recordSuccess();

    const state = await breaker.getState();
    expect(state.status).toBe("closed");
    expect(state.failure_count).toBe(0);
    expect(state.opened_at).toBeNull();
  });

  it("re-opens on failure during half_open", async () => {
    // Open → half_open → fail → open
    await breaker.recordFailure("e1");
    await breaker.recordFailure("e2");
    await breaker.recordFailure("e3");

    await breaker.tryHalfOpen();
    await breaker.recordFailure("still broken");

    const state = await breaker.getState();
    expect(state.status).toBe("open");
    expect(state.last_failure_error).toBe("still broken");
  });

  it("resets failure count on success in closed state", async () => {
    await breaker.recordFailure("e1");
    await breaker.recordFailure("e2");

    await breaker.recordSuccess();

    const state = await breaker.getState();
    expect(state.failure_count).toBe(0);
    expect(state.status).toBe("closed");
  });

  it("tryHalfOpen is a no-op when already closed", async () => {
    await breaker.tryHalfOpen();

    const state = await breaker.getState();
    expect(state.status).toBe("closed"); // unchanged
  });

  it("preserves opened_at through re-open cycles", async () => {
    // Open the breaker
    await breaker.recordFailure("e1");
    await breaker.recordFailure("e2");
    await breaker.recordFailure("e3");

    const firstState = await breaker.getState();
    const firstOpenedAt = firstState.opened_at;

    // Half-open → fail → re-open
    await breaker.tryHalfOpen();
    await breaker.recordFailure("again");

    const secondState = await breaker.getState();
    // opened_at should be preserved from the first opening
    expect(secondState.opened_at).toBe(firstOpenedAt);
  });

  it("uses default in-memory store when none provided", async () => {
    const defaultBreaker = new CircuitBreaker();
    expect(await defaultBreaker.canExecute()).toBe(true);
    // Default threshold is 5
    for (let i = 0; i < 4; i++) {
      await defaultBreaker.recordFailure("err");
    }
    expect(await defaultBreaker.canExecute()).toBe(true);
    await defaultBreaker.recordFailure("err");
    expect(await defaultBreaker.canExecute()).toBe(false);
  });
});
