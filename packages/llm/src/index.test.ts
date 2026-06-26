import { describe, expect, it } from "vitest";
import { describePackage, packageName } from "./index.js";

describe("@opspilot/llm", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/llm");
    expect(describePackage()).toContain("LLM");
  });
});
