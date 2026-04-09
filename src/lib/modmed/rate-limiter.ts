/**
 * Simple rate limiter for ModMed API calls.
 *
 * Uses a fixed-interval approach: ensures at least `minIntervalMs`
 * milliseconds between consecutive requests. Starts conservative
 * at 1 request/second and can be tuned based on sandbox testing.
 *
 * Also handles exponential backoff for 429 (rate limit) and 5xx
 * (server error) responses.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RateLimiterOptions {
  /** Maximum requests per second. Default: 1 */
  maxPerSecond?: number;
  /** Maximum backoff in milliseconds. Default: 30_000 (30s) */
  maxBackoffMs?: number;
  /** Base delay for exponential backoff in milliseconds. Default: 1000 */
  baseBackoffMs?: number;
}

export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minIntervalMs: number;
  private readonly maxBackoffMs: number;
  private readonly baseBackoffMs: number;
  private consecutiveRetries = 0;

  constructor(opts: RateLimiterOptions = {}) {
    const maxPerSecond = opts.maxPerSecond ?? 1;
    this.minIntervalMs = Math.ceil(1000 / maxPerSecond);
    this.maxBackoffMs = opts.maxBackoffMs ?? 30_000;
    this.baseBackoffMs = opts.baseBackoffMs ?? 1000;
  }

  /**
   * Wait until the next request slot is available.
   * Call this before every API request.
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Record a successful request. Resets the retry counter.
   */
  recordSuccess(): void {
    this.consecutiveRetries = 0;
  }

  /**
   * Calculate and wait for the exponential backoff delay.
   * Call this when a 429 or 5xx response is received.
   *
   * @param retryAfterHeader - Optional Retry-After header value (seconds)
   * @returns The delay that was waited, in milliseconds
   */
  async backoff(retryAfterHeader?: string): Promise<number> {
    this.consecutiveRetries++;

    let delayMs: number;

    if (retryAfterHeader) {
      const retryAfterSeconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(retryAfterSeconds)) {
        delayMs = retryAfterSeconds * 1000;
      } else {
        delayMs = this.calculateExponentialDelay();
      }
    } else {
      delayMs = this.calculateExponentialDelay();
    }

    // Cap at max backoff
    delayMs = Math.min(delayMs, this.maxBackoffMs);

    await sleep(delayMs);
    this.lastRequestTime = Date.now();

    return delayMs;
  }

  /**
   * Get the current retry count (for circuit breaker integration).
   */
  get retryCount(): number {
    return this.consecutiveRetries;
  }

  private calculateExponentialDelay(): number {
    // Exponential backoff with jitter: base * 2^(retries-1) + random jitter
    const exponentialDelay =
      this.baseBackoffMs * Math.pow(2, this.consecutiveRetries - 1);
    const jitter = Math.random() * this.baseBackoffMs * 0.5;
    return exponentialDelay + jitter;
  }
}
