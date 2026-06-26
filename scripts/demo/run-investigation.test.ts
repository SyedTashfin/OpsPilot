import { describe, expect, it } from "vitest";
import { formatInvestigationSummary } from "./format-investigation-summary.js";

describe("run-investigation demo script", () => {
  it("formats a readable investigation summary", () => {
    const output = formatInvestigationSummary({
      investigationId: "inv-1",
      incidentTitle: "Recommendation latency spike",
      serviceName: "recommendation-service",
      summary: "Latency spiked after deployment.",
      probableRootCause: "Feature-store timeout retry amplification.",
      confidence: 0.86,
      evidence: [{ source: "log", detail: "feature_store_timeout observed" }],
      citedRunbooks: [
        { title: "Recommendation Service Latency Runbook", slug: "recommendation-service-latency" },
      ],
      recommendedNextDiagnostics: ["Compare deployment diff."],
    });

    expect(output).toContain("OpsPilot Investigation Demo");
    expect(output).toContain("recommendation-service");
    expect(output).toContain("Feature-store timeout");
    expect(output).toContain("Recommendation Service Latency Runbook");
  });
});
