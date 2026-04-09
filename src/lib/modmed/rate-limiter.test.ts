import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces minimum interval between requests", async () => {
    const limiter = new RateLimiter({ maxPerSecond: 2 }); // 500ms interval

    // First request: no wait
    const p1 = limiter.waitForSlot();
    vi.advanceTimersByTime(0);
    await p1;

    // Second request: should wait ~500ms
    const start = Date.now();
    const p2 = limiter.waitForSlot();
    vi.advanceTimersByTime(500);
    await p2;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(500);
  });

  it("allows immediate request when enough time has passed", async () => {
    const limiter = new RateLimiter({ maxPerSecond: 1 });

    await limiter.waitForSlot();

    // Advance past the interval
    vi.advanceTimersByTime(1500);

    const start = Date.now();
    const p = limiter.waitForSlot();
    vi.advanceTimersByTime(0);
    await p;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it("calculates exponential backoff", async () => {
    const limiter = new RateLimiter({
      maxPerSecond: 1,
      baseBackoffMs: 1000,
    });

    // First backoff: ~1000ms (base * 2^0 + jitter)
    const p1 = limiter.backoff();
    vi.advanceTimersByTime(2000);
    const delay1 = await p1;
    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThan(1500);

    // Second backoff: ~2000ms (base * 2^1 + jitter)
    const p2 = limiter.backoff();
    vi.advanceTimersByTime(3000);
    const delay2 = await p2;
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThan(2500);
  });

  it("caps backoff at maxBackoffMs", async () => {
    const limiter = new RateLimiter({
      maxPerSecond: 1,
      baseBackoffMs: 1000,
      maxBackoffMs: 5000,
    });

    // Force many retries
    for (let i = 0; i < 10; i++) {
      const p = limiter.backoff();
      vi.advanceTimersByTime(10_000);
      const delay = await p;
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });

  it("respects Retry-After header", async () => {
    const limiter = new RateLimiter({ maxPerSecond: 1 });

    const p = limiter.backoff("3"); // 3 seconds
    vi.advanceTimersByTime(3000);
    const delay = await p;

    expect(delay).toBe(3000);
  });

  it("resets retry count on success", async () => {
    const limiter = new RateLimiter({ maxPerSecond: 1 });

    // Accumulate retries
    const p = limiter.backoff();
    vi.advanceTimersByTime(2000);
    await p;
    expect(limiter.retryCount).toBe(1);

    // Record success
    limiter.recordSuccess();
    expect(limiter.retryCount).toBe(0);
  });

  it("uses default options", () => {
    const limiter = new RateLimiter();
    expect(limiter.retryCount).toBe(0);
  });
});
