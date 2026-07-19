import { z } from "zod";

export const serviceCriticalitySchema = z.enum(["low", "medium", "high", "critical"]);
export const logLevelSchema = z.enum(["debug", "info", "warn", "error", "fatal"]);
export const incidentSeveritySchema = z.enum(["sev1", "sev2", "sev3", "sev4"]);

export const beautyCorpServiceSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  ownerTeam: z.string().min(1),
  runtime: z.string().min(1),
  criticality: serviceCriticalitySchema,
});

export const deploymentSchema = z.object({
  serviceName: z.string().min(1),
  version: z.string().min(1),
  commitSha: z.string().min(1),
  deployedBy: z.string().min(1),
  environment: z.literal("production"),
  status: z.enum(["succeeded", "failed", "rolled_back"]),
  deployedAt: z.string().datetime(),
  metadata: z.record(z.string()).default({}),
});

export const jsonAttributeValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const logEntrySchema = z.object({
  serviceName: z.string().min(1),
  deploymentVersion: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
  level: logLevelSchema,
  message: z.string().min(1),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  attributes: z.record(jsonAttributeValueSchema).default({}),
});

export const metricPointSchema = z.object({
  serviceName: z.string().min(1),
  timestamp: z.string().datetime(),
  metricName: z.string().min(1),
  metricValue: z.number(),
  unit: z.string().min(1),
  attributes: z.record(jsonAttributeValueSchema).default({}),
});

export const incidentScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  serviceName: z.string().min(1),
  severity: incidentSeveritySchema,
  startedAt: z.string().datetime(),
  detectedAt: z.string().datetime(),
  detectionReason: z.string().min(1),
  affectedSignals: z.array(z.string()).default([]),
});

export const logsBatchSchema = z.object({
  logs: z.array(logEntrySchema).min(1),
});

export const telemetryBatchSchema = z.object({
  generatedAt: z.string().datetime(),
  services: z.array(beautyCorpServiceSchema).min(1),
  deployments: z.array(deploymentSchema).default([]),
  logs: z.array(logEntrySchema).default([]),
  metrics: z.array(metricPointSchema).default([]),
  incidents: z.array(incidentScenarioSchema).default([]),
});

export const healthStateSchema = z.enum(["healthy", "degraded", "unhealthy", "unknown"]);
export type HealthState = z.infer<typeof healthStateSchema>;

export const healthDiagnosticCategorySchema = z.enum([
  "ok",
  "dependency_unavailable",
  "dependency_degraded",
  "not_configured",
  "probe_failed",
  "unknown",
]);
export type HealthDiagnosticCategory = z.infer<typeof healthDiagnosticCategorySchema>;

export const healthDependencySchema = z.object({
  state: healthStateSchema,
  diagnosticCategory: healthDiagnosticCategorySchema,
  latencyMs: z.number().nonnegative().optional(),
  lastSuccessAt: z.string().datetime().optional(),
});
export type HealthDependency = z.infer<typeof healthDependencySchema>;

export const healthResponseSchema = z.object({
  status: healthStateSchema,
  timestamp: z.string().datetime(),
  version: z.string().min(1).optional(),
  build: z.string().min(1).optional(),
  dependencies: z.record(healthDependencySchema),
  diagnosticCategory: healthDiagnosticCategorySchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const investigationStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type InvestigationStatus = z.infer<typeof investigationStatusSchema>;

export const investigationHistoryItemSchema = z.object({
  investigationId: z.string().min(1),
  incidentId: z.string().min(1),
  status: investigationStatusSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  summary: z.string().min(1).nullable().optional(),
  probableRootCause: z.string().min(1).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  detailHref: z.string().min(1),
});
export type InvestigationHistoryItem = z.infer<typeof investigationHistoryItemSchema>;

export const investigationHistoryResponseSchema = z.object({
  items: z.array(investigationHistoryItemSchema),
  pageSize: z.number().int().positive(),
  nextCursor: z.string().min(1).nullable(),
});
export type InvestigationHistoryResponse = z.infer<typeof investigationHistoryResponseSchema>;

export const investigationHistoryQuerySchema = z.object({
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().min(1).optional(),
  incidentId: z.string().uuid().optional(),
  status: investigationStatusSchema.optional(),
});
export type InvestigationHistoryQuery = z.infer<typeof investigationHistoryQuerySchema>;

export function deriveOverallHealth(
  dependencies: Record<string, Pick<HealthDependency, "state">>,
): HealthState {
  const states = Object.values(dependencies).map((dependency) => dependency.state);
  if (states.length === 0) return "unknown";
  if (states.some((state) => state === "unhealthy")) return "unhealthy";
  if (states.some((state) => state === "degraded" || state === "unknown")) return "degraded";
  return "healthy";
}

export function deriveHealthDiagnosticCategory(
  status: HealthState,
  dependencies: Record<string, Pick<HealthDependency, "state" | "diagnosticCategory">>,
): HealthDiagnosticCategory {
  if (status === "healthy") return "ok";
  const first = Object.values(dependencies).find((dependency) => dependency.state !== "healthy");
  return first?.diagnosticCategory ?? "unknown";
}

export type BeautyCorpServiceContract = z.infer<typeof beautyCorpServiceSchema>;
export type DeploymentContract = z.infer<typeof deploymentSchema>;
export type LogEntryContract = z.infer<typeof logEntrySchema>;
export type MetricPointContract = z.infer<typeof metricPointSchema>;
export type IncidentScenarioContract = z.infer<typeof incidentScenarioSchema>;
export type TelemetryBatchContract = z.infer<typeof telemetryBatchSchema>;
