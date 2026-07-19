import { describe, expect, it } from "vitest";
import type { HealthResponse, HealthState } from "@opspilot/contracts";
import { databaseStatusLabel, overallHealthLabel, statusClass } from "./health-rendering.js";

function health(status: HealthState, database: HealthState): HealthResponse {
  return {
    status,
    timestamp: "2026-07-19T00:00:00.000Z",
    dependencies: {
      database: {
        state: database,
        diagnosticCategory: database === "healthy" ? "ok" : "probe_failed",
      },
    },
    diagnosticCategory: status === "healthy" ? "ok" : "probe_failed",
  };
}

describe("dashboard health rendering", () => {
  for (const state of ["healthy", "degraded", "unhealthy", "unknown"] as const) {
    it(`renders ${state} status accurately`, () => {
      expect(overallHealthLabel(health(state, state))).toBe(state);
      expect(databaseStatusLabel(health(state, state))).toBe(state);
    });
  }

  it("does not display database connected for degraded/unhealthy/unknown", () => {
    expect(databaseStatusLabel(health("degraded", "degraded"))).not.toBe("connected");
    expect(databaseStatusLabel(health("unhealthy", "unhealthy"))).not.toBe("connected");
    expect(databaseStatusLabel(health("degraded", "unknown"))).not.toBe("connected");
  });

  it("maps states to visible classes", () => {
    expect(statusClass("healthy")).toBe("success");
    expect(statusClass("degraded")).toBe("warn");
    expect(statusClass("unhealthy")).toBe("error");
    expect(statusClass("unknown")).toBe("muted");
  });
});
