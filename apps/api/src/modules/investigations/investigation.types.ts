import { z } from "zod";

export const InvestigationEvidenceSchema = z.object({
  source: z.enum(["log", "metric", "deployment", "runbook"]),
  reference: z.string().min(1),
  detail: z.string().min(1),
});
export type InvestigationEvidence = z.infer<typeof InvestigationEvidenceSchema>;

export const CitedRunbookSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  chunkId: z.string().min(1).optional(),
  quote: z.string().min(1),
});
export type CitedRunbook = z.infer<typeof CitedRunbookSchema>;

export const InvestigationReportSchema = z.object({
  summary: z.string().min(1),
  probableRootCause: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(InvestigationEvidenceSchema).min(1),
  citedRunbooks: z.array(CitedRunbookSchema),
  recommendedNextDiagnostics: z.array(z.string().min(1)),
});
export type InvestigationReport = z.infer<typeof InvestigationReportSchema>;

export type IncidentContext = {
  readonly id: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly title: string;
  readonly severity: string;
  readonly status: string;
  readonly detectedAt: string;
  readonly startedAt: string;
  readonly detectionReason: string;
  readonly suspectedRootCause: string | null;
  readonly metadata: Record<string, unknown>;
};

export type InvestigationLogEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly level: string;
  readonly message: string;
  readonly attributes: Record<string, unknown>;
};

export type MetricSummary = {
  readonly metricName: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly avg: number;
  readonly samples: number;
};

export type DeploymentContext = {
  readonly id: string;
  readonly version: string;
  readonly commitSha: string;
  readonly deployedBy: string;
  readonly status: string;
  readonly deployedAt: string;
  readonly metadata: Record<string, unknown>;
};

export type InvestigationContext = {
  readonly incident: IncidentContext;
  readonly logs: readonly InvestigationLogEntry[];
  readonly metrics: readonly MetricSummary[];
  readonly deployments: readonly DeploymentContext[];
  readonly runbooks: readonly {
    readonly chunkId: string;
    readonly title: string;
    readonly slug: string;
    readonly content: string;
    readonly score: number;
  }[];
};

export type InvestigationResult = {
  readonly investigationId: string;
  readonly report: InvestigationReport;
};
