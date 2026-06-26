import { describe, expect, it } from "vitest";
import { describePackage, packageName } from "./index.js";

describe("@opspilot/rag", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/rag");
    expect(describePackage()).toContain("Runbook");
  });
});
