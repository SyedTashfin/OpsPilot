import { describe, expect, it } from "vitest";
import { describePackage, packageName } from "./index.js";

describe("@opspilot/contracts", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/contracts");
    expect(describePackage()).toContain("Shared");
  });
});
