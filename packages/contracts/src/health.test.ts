import { describe, expect, it } from "vitest";
import {
  deriveHealthDiagnosticCategory,
  deriveOverallHealth,
  healthResponseSchema,
} from "./index.js";

describe("health contract", () => {
  it("derives overall status from dependency states", () => {
    expect(deriveOverallHealth({ db: { state: "healthy" } })).toBe("healthy");
    expect(deriveOverallHealth({ db: { state: "degraded" } })).toBe("degraded");
    expect(deriveOverallHealth({ db: { state: "unknown" } })).toBe("degraded");
    expect(deriveOverallHealth({ db: { state: "unhealthy" } })).toBe("unhealthy");
    expect(deriveOverallHealth({})).toBe("unknown");
  });

  it("serializes safe health response shape", () => {
    const payload = healthResponseSchema.parse({
      status: "degraded",
      timestamp: "2026-07-19T00:00:00.000Z",
      version: "1.0.0",
      dependencies: { database: { state: "unknown", diagnosticCategory: "probe_failed" } },
      diagnosticCategory: deriveHealthDiagnosticCategory("degraded", {
        database: { state: "unknown", diagnosticCategory: "probe_failed" },
      }),
    });
    expect(JSON.stringify(payload)).not.toMatch(/postgres|password|localhost|127\.0\.0\.1/);
  });
});

describe("investigation history contract", () => {
  it("bounds page size and serializes safe list items", async () => {
    const { investigationHistoryQuerySchema, investigationHistoryResponseSchema } =
      await import("./index.js");
    expect(investigationHistoryQuerySchema.parse({ pageSize: "50" }).pageSize).toBe(50);
    expect(
      investigationHistoryQuerySchema.parse({ incidentId: "11111111-1111-4111-8111-111111111111" })
        .incidentId,
    ).toBe("11111111-1111-4111-8111-111111111111");
    expect(() => investigationHistoryQuerySchema.parse({ pageSize: "51" })).toThrow();
    expect(() => investigationHistoryQuerySchema.parse({ incidentId: "not-a-uuid" })).toThrow();
    const payload = investigationHistoryResponseSchema.parse({
      pageSize: 10,
      nextCursor: null,
      items: [
        {
          investigationId: "inv-1",
          incidentId: "incident-1",
          status: "completed",
          createdAt: "2026-07-19T00:00:00.000Z",
          completedAt: "2026-07-19T00:01:00.000Z",
          summary: "Safe persisted summary.",
          probableRootCause: "Runtime conclusion from persisted report.",
          confidence: 0.8,
          detailHref: "?investigationId=inv-1#investigation",
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toMatch(/suspectedRootCause|prompt|rawResponse|toolCalls/u);
  });
});
