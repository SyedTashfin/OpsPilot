import { describe, expect, it } from "vitest";
import { telemetryBatchSchema } from "./index.js";

describe("telemetryBatchSchema", () => {
  it("validates a minimal BeautyCorp telemetry batch", () => {
    const result = telemetryBatchSchema.safeParse({
      generatedAt: "2026-06-26T09:45:00.000Z",
      services: [
        {
          name: "recommendation-service",
          displayName: "Recommendation Service",
          description: "Synthetic service",
          ownerTeam: "personalization-platform",
          runtime: "nodejs",
          criticality: "critical",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
