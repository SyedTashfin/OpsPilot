import { describe, expect, it } from "vitest";
import { describePackage, packageName } from "./index.js";

describe("@opspilot/database", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/database");
    expect(describePackage()).toContain("Database");
  });
});
