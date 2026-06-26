import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "./index.js";

describe("database config", () => {
  it("reads DATABASE_URL from the provided environment", () => {
    expect(getDatabaseUrl({ DATABASE_URL: "postgres://example" })).toBe("postgres://example");
  });

  it("fails fast when DATABASE_URL is absent", () => {
    expect(() => getDatabaseUrl({})).toThrow(/DATABASE_URL is required/);
  });
});
