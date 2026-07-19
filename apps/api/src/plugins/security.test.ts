import { describe, expect, it } from "vitest";
import { BoundedRateLimiter } from "./security.js";

describe("BoundedRateLimiter", () => {
  it("evicts expired keys during deterministic cleanup", () => {
    let now = 0;
    const limiter = new BoundedRateLimiter(3, () => now);
    expect(limiter.allow("a", 1, 10)).toBe(true);
    now = 11;
    expect(limiter.allow("b", 1, 10)).toBe(true);
    expect(limiter.has("a")).toBe(false);
    expect(limiter.size()).toBe(1);
  });

  it("evicts the oldest key when unique key capacity is exceeded", () => {
    let now = 0;
    const limiter = new BoundedRateLimiter(2, () => now++);
    expect(limiter.allow("a", 5, 100)).toBe(true);
    expect(limiter.allow("b", 5, 100)).toBe(true);
    expect(limiter.allow("c", 5, 100)).toBe(true);
    expect(limiter.has("a")).toBe(false);
    expect(limiter.has("b")).toBe(true);
    expect(limiter.has("c")).toBe(true);
  });
});
