import { deriveOverallHealth, type HealthResponse, type HealthState } from "@opspilot/contracts";

export function statusClass(state: HealthState): "success" | "warn" | "error" | "muted" {
  if (state === "healthy") return "success";
  if (state === "degraded") return "warn";
  if (state === "unhealthy") return "error";
  return "muted";
}

export function databaseStatusLabel(health: HealthResponse | null | undefined): string {
  const state = health?.dependencies.database?.state ?? "unknown";
  return state;
}

export function overallHealthLabel(health: HealthResponse | null | undefined): HealthState {
  if (!health) return "unknown";
  return health.status ?? deriveOverallHealth(health.dependencies ?? {});
}
