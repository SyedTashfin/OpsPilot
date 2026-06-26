import { describe, expect, it } from "vitest";
import { describePackage, packageName } from "./index.js";

describe("@opspilot/domain", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/domain");
    expect(describePackage()).toContain("Shared");
  });
});
