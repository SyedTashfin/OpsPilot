import { describe, expect, it } from "vitest";
import { scanText } from "./secret-scan.js";

describe("secret scanner", () => {
  it("allows exact inert placeholders", () => {
    expect(scanText("fixture.txt", "LANGFUSE_PUBLIC_KEY=sk-lf-opspilot-dev\n")).toEqual([]);
  });

  it("flags a real forbidden value without printing it", () => {
    const findings = scanText("fixture.txt", "OPENAI_API_KEY=sk-" + "a".repeat(40));
    expect(findings).toEqual([{ file: "fixture.txt", kind: "openai api key", line: 1 }]);
    expect(JSON.stringify(findings)).not.toContain("sk-" + "a".repeat(40));
  });

  it("still flags a real forbidden value when the same file has an allowed placeholder", () => {
    const findings = scanText(
      "fixture.txt",
      "LANGFUSE_PUBLIC_KEY=sk-lf-opspilot-dev\nOPENAI_API_KEY=sk-" + "b".repeat(40),
    );
    expect(findings).toEqual([{ file: "fixture.txt", kind: "openai api key", line: 2 }]);
  });
});
