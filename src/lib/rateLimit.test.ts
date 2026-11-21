import { beforeEach, describe, expect, it } from "vitest";
import { isRateLimited, resetRateLimits } from "./rateLimit";

beforeEach(() => {
  resetRateLimits();
});

describe("rate limiter", () => {
  it("allows requests up to the limit, then blocks", () => {
    expect(isRateLimited("k", 3, 60_000)).toBe(false);
    expect(isRateLimited("k", 3, 60_000)).toBe(false);
    expect(isRateLimited("k", 3, 60_000)).toBe(false);
    expect(isRateLimited("k", 3, 60_000)).toBe(true);
    expect(isRateLimited("k", 3, 60_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(isRateLimited("a", 1, 60_000)).toBe(false);
    expect(isRateLimited("a", 1, 60_000)).toBe(true);
    expect(isRateLimited("b", 1, 60_000)).toBe(false);
  });

  it("resets after the window passes", () => {
    expect(isRateLimited("w", 1, 1)).toBe(false);
    expect(isRateLimited("w", 1, 1)).toBe(true);
    // A 1ms window has already expired by the next call after a tick.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(isRateLimited("w", 1, 60_000)).toBe(false);
        resolve();
      }, 5);
    });
  });

  it("resetRateLimits clears all counters", () => {
    expect(isRateLimited("r", 1, 60_000)).toBe(false);
    expect(isRateLimited("r", 1, 60_000)).toBe(true);
    resetRateLimits();
    expect(isRateLimited("r", 1, 60_000)).toBe(false);
  });
});
