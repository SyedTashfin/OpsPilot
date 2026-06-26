import { describe, expect, it } from "vitest";
import { describePackage, packageName } from "./index.js";

describe("@opspilot/telemetry", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/telemetry");
    expect(describePackage()).toContain("Langfuse");
  });
});
