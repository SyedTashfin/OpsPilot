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
  suspectedRootCause: z.string().min(1),
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

export type BeautyCorpServiceContract = z.infer<typeof beautyCorpServiceSchema>;
export type DeploymentContract = z.infer<typeof deploymentSchema>;
export type LogEntryContract = z.infer<typeof logEntrySchema>;
export type MetricPointContract = z.infer<typeof metricPointSchema>;
export type IncidentScenarioContract = z.infer<typeof incidentScenarioSchema>;
export type TelemetryBatchContract = z.infer<typeof telemetryBatchSchema>;
