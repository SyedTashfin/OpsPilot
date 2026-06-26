import type pg from "pg";
import {
  InvestigationReportSchema,
  type DeploymentContext,
  type IncidentContext,
  type InvestigationLogEntry,
  type InvestigationReport,
  type MetricSummary,
} from "./investigation.types.js";

export class InvestigationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async getIncident(incidentId: string): Promise<IncidentContext | null> {
    const result = await this.pool.query<{
      id: string;
      serviceId: string;
      serviceName: string;
      title: string;
      severity: string;
      status: string;
      detectedAt: string;
      startedAt: string;
      detectionReason: string;
      suspectedRootCause: string | null;
      metadata: Record<string, unknown>;
    }>(
      `SELECT i.id,
              i.service_id AS "serviceId",
              s.name AS "serviceName",
              i.title,
              i.severity,
              i.status,
              i.detected_at AS "detectedAt",
              i.started_at AS "startedAt",
              i.detection_reason AS "detectionReason",
              i.suspected_root_cause AS "suspectedRootCause",
              i.metadata
       FROM incidents i
       JOIN beautycorp_services s ON s.id = i.service_id
       WHERE i.id = $1
       LIMIT 1;`,
      [incidentId],
    );
    return result.rows[0] ?? null;
  }

  async createInvestigation(input: {
    readonly incidentId: string;
    readonly provider: string;
    readonly model: string;
    readonly promptVersion: string;
  }): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO investigations (incident_id, status, provider, model, prompt_version, started_at)
       VALUES ($1, 'running', $2, $3, $4, now())
       RETURNING id;`,
      [input.incidentId, input.provider, input.model, input.promptVersion],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error("Failed to create investigation row.");
    return id;
  }

  async queryLogs(incident: IncidentContext): Promise<InvestigationLogEntry[]> {
    const result = await this.pool.query<InvestigationLogEntry>(
      `SELECT l.id,
              l.timestamp,
              l.level,
              l.message,
              l.attributes
       FROM log_entries l
       WHERE l.service_id = $1
         AND l.timestamp BETWEEN ($2::timestamptz - interval '30 minutes') AND ($3::timestamptz + interval '15 minutes')
       ORDER BY l.timestamp ASC
       LIMIT 80;`,
      [incident.serviceId, incident.startedAt, incident.detectedAt],
    );
    return result.rows;
  }

  async queryMetrics(incident: IncidentContext): Promise<MetricSummary[]> {
    const result = await this.pool.query<MetricSummary>(
      `SELECT metric_name AS "metricName",
              unit,
              MIN(metric_value)::float AS min,
              MAX(metric_value)::float AS max,
              AVG(metric_value)::float AS avg,
              COUNT(*)::int AS samples
       FROM metric_points
       WHERE service_id = $1
         AND timestamp BETWEEN ($2::timestamptz - interval '30 minutes') AND ($3::timestamptz + interval '15 minutes')
       GROUP BY metric_name, unit
       ORDER BY metric_name ASC;`,
      [incident.serviceId, incident.startedAt, incident.detectedAt],
    );
    return result.rows;
  }

  async getDeployments(incident: IncidentContext): Promise<DeploymentContext[]> {
    const result = await this.pool.query<DeploymentContext>(
      `SELECT id,
              version,
              commit_sha AS "commitSha",
              deployed_by AS "deployedBy",
              status,
              deployed_at AS "deployedAt",
              metadata
       FROM deployments
       WHERE service_id = $1
         AND deployed_at <= ($2::timestamptz + interval '15 minutes')
       ORDER BY deployed_at DESC
       LIMIT 5;`,
      [incident.serviceId, incident.detectedAt],
    );
    return result.rows;
  }

  async getInvestigationDetail(investigationId: string): Promise<Record<string, unknown> | null> {
    const investigation = await this.pool.query<Record<string, unknown>>(
      `SELECT inv.id,
              inv.incident_id AS "incidentId",
              i.title AS "incidentTitle",
              s.name AS "serviceName",
              inv.status,
              inv.provider,
              inv.model,
              inv.prompt_version AS "promptVersion",
              inv.started_at AS "startedAt",
              inv.completed_at AS "completedAt",
              inv.latency_ms AS "latencyMs",
              inv.summary,
              inv.probable_root_cause AS "probableRootCause",
              inv.confidence_score::float AS confidence,
              inv.created_at AS "createdAt"
       FROM investigations inv
       JOIN incidents i ON i.id = inv.incident_id
       JOIN beautycorp_services s ON s.id = i.service_id
       WHERE inv.id = $1
       LIMIT 1;`,
      [investigationId],
    );
    const row = investigation.rows[0];
    if (!row) return null;

    const toolCalls = await this.listToolCalls(investigationId);
    const steps = await this.listInvestigationSteps(investigationId);
    const finalReport = this.extractFinalReport(steps);

    return {
      ...row,
      toolCalls,
      steps,
      evidence: finalReport?.evidence ?? [],
      citedRunbooks: finalReport?.citedRunbooks ?? [],
      recommendedNextDiagnostics: finalReport?.recommendedNextDiagnostics ?? [],
    };
  }

  async getInvestigationReport(investigationId: string): Promise<Record<string, unknown> | null> {
    const detail = await this.getInvestigationDetail(investigationId);
    if (!detail) return null;
    return {
      investigationId: detail.id,
      incidentId: detail.incidentId,
      incidentTitle: detail.incidentTitle,
      serviceName: detail.serviceName,
      status: detail.status,
      generatedAt: detail.completedAt ?? detail.createdAt,
      summary: detail.summary,
      probableRootCause: detail.probableRootCause,
      confidence: detail.confidence,
      evidence: detail.evidence,
      citedRunbooks: detail.citedRunbooks,
      recommendedNextDiagnostics: detail.recommendedNextDiagnostics,
      supportingToolCalls: (detail.toolCalls as readonly Record<string, unknown>[]).map(
        (toolCall) => ({
          toolName: toolCall.toolName,
          status: toolCall.status,
          latencyMs: toolCall.latencyMs,
          createdAt: toolCall.createdAt,
        }),
      ),
    };
  }

  async recordToolCall(input: {
    readonly investigationId: string;
    readonly toolName: string;
    readonly toolInput: unknown;
    readonly output: unknown;
    readonly status: "success" | "error";
    readonly latencyMs: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO tool_calls (investigation_id, tool_name, input, output, status, latency_ms)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6);`,
      [
        input.investigationId,
        input.toolName,
        JSON.stringify(input.toolInput),
        JSON.stringify(input.output),
        input.status,
        input.latencyMs,
      ],
    );
  }

  async recordStep(input: {
    readonly investigationId: string;
    readonly stepIndex: number;
    readonly stepType: "prompt" | "tool_call" | "observation" | "reasoning" | "final";
    readonly title: string;
    readonly content: string;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO investigation_steps (investigation_id, step_index, step_type, title, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb);`,
      [
        input.investigationId,
        input.stepIndex,
        input.stepType,
        input.title,
        input.content,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }

  async recordInvalidModelResponse(input: {
    readonly investigationId: string;
    readonly rawResponse: string;
    readonly parserError: string;
  }): Promise<void> {
    await this.recordStep({
      investigationId: input.investigationId,
      stepIndex: 6,
      stepType: "observation",
      title: "Invalid model response",
      content: input.rawResponse,
      metadata: {
        parserError: input.parserError,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async completeInvestigation(input: {
    readonly investigationId: string;
    readonly report: InvestigationReport;
    readonly latencyMs: number;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE investigations
       SET status = 'completed',
           completed_at = now(),
           latency_ms = $2,
           summary = $3,
           probable_root_cause = $4,
           confidence_score = $5
       WHERE id = $1;`,
      [
        input.investigationId,
        input.latencyMs,
        input.report.summary,
        input.report.probableRootCause,
        input.report.confidence,
      ],
    );
  }

  async failInvestigation(input: {
    readonly investigationId: string;
    readonly error: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE investigations SET status = 'failed', completed_at = now(), summary = $2 WHERE id = $1;`,
      [input.investigationId, input.error],
    );
  }

  private async listToolCalls(investigationId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id,
              tool_name AS "toolName",
              input,
              output,
              status,
              latency_ms AS "latencyMs",
              created_at AS "createdAt"
       FROM tool_calls
       WHERE investigation_id = $1
       ORDER BY created_at ASC, id ASC;`,
      [investigationId],
    );
    return result.rows;
  }

  private async listInvestigationSteps(
    investigationId: string,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id,
              step_index AS "stepIndex",
              step_type AS "stepType",
              title,
              content,
              metadata,
              created_at AS "createdAt"
       FROM investigation_steps
       WHERE investigation_id = $1
       ORDER BY step_index ASC;`,
      [investigationId],
    );
    return result.rows;
  }

  private extractFinalReport(
    steps: readonly Record<string, unknown>[],
  ): InvestigationReport | null {
    const final = steps.find(
      (step) => step.stepType === "final" && step.title === "Investigation report",
    );
    if (typeof final?.content !== "string") return null;
    const parsed = InvestigationReportSchema.safeParse(JSON.parse(final.content));
    return parsed.success ? parsed.data : null;
  }
}
