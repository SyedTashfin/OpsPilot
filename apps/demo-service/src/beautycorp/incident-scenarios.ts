export type IncidentScenario = {
  readonly id: string;
  readonly title: string;
  readonly serviceName: string;
  readonly severity: "sev1" | "sev2" | "sev3" | "sev4";
  readonly startedAt: string;
  readonly detectedAt: string;
  readonly detectionReason: string;
  readonly affectedSignals: readonly string[];
};

export const recommendationLatencyScenario = {
  id: "beautycorp-rec-latency-2026-06-26",
  title: "Recommendation latency spike after feature-store timeout deployment",
  serviceName: "recommendation-service",
  severity: "sev2",
  startedAt: "2026-06-26T09:47:00.000Z",
  detectedAt: "2026-06-26T09:58:00.000Z",
  detectionReason:
    "recommendation-service p95 latency exceeded 1200ms and feature-store timeout errors increased after deployment rec-2026.06.1.",
  affectedSignals: ["p95_latency_ms", "http_error_rate", "feature_store_timeout", "retry_count"],
} as const satisfies IncidentScenario;

export const incidentScenarios = [
  recommendationLatencyScenario,
] as const satisfies readonly IncidentScenario[];
