import type pg from "pg";
import type { LLMChatRequest, LLMChatResponse, LLMClient, LLMProviderHealth } from "@opspilot/llm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, resetDatabase, runMigrations } from "@opspilot/database";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";
import { InvestigationRepository, InvestigationWorkflow } from "./index.js";

const describeWithDatabase =
  process.env.OPSPILOT_RUN_DB_TESTS === "true" ? describe : describe.skip;

class DeterministicIntegrationLLM implements LLMClient {
  readonly provider = "ollama" as const;
  readonly model = "integration-test-model";
  requests: LLMChatRequest[] = [];

  chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    this.requests.push(request);
    return Promise.resolve({
      provider: this.provider,
      model: this.model,
      content: JSON.stringify({
        summary:
          "Recommendation-service latency increased after rec-2026.06.1, with feature-store timeouts and retry amplification.",
        probableRootCause:
          "Deployment rec-2026.06.1 changed feature-store timeout or retry behavior, causing feature-store timeouts and elevated latency.",
        confidence: 0.88,
        evidence: [
          {
            source: "metric",
            reference: "p95_latency_ms",
            detail: "Metric summary shows elevated p95 latency during the incident window.",
          },
          {
            source: "deployment",
            reference: "rec-2026.06.1",
            detail: "Deployment rec-2026.06.1 occurred before the incident window.",
          },
          {
            source: "log",
            reference: "feature_store_timeout",
            detail: "Logs contain feature-store timeout and retry-count evidence.",
          },
        ],
        citedRunbooks: [
          {
            title: "Recommendation Service Latency Runbook",
            slug: "recommendation-service-latency",
            chunkId: "integration-test-chunk",
            quote: "feature-store timeout errors",
          },
        ],
        recommendedNextDiagnostics: [
          "Compare rec-2026.06.1 timeout and retry configuration with the previous release.",
        ],
      }),
      usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200, estimated: true },
    });
  }

  health(): Promise<LLMProviderHealth> {
    return Promise.resolve({
      provider: this.provider,
      configured: true,
      available: true,
      model: this.model,
    });
  }
}

async function seedScenario(pool: pg.Pool): Promise<string> {
  const service = await pool.query<{ id: string }>(
    `INSERT INTO beautycorp_services (name, display_name, description, owner_team, runtime, criticality)
     VALUES ('recommendation-service', 'Recommendation Service', 'BeautyCorp personalized product recommendations.', 'Personalization Platform', 'nodejs', 'critical')
     ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id;`,
  );
  const serviceId = service.rows[0]?.id;
  if (!serviceId) throw new Error("Failed to seed recommendation-service.");

  const deployment = await pool.query<{ id: string }>(
    `INSERT INTO deployments (service_id, version, commit_sha, deployed_by, status, deployed_at, metadata)
     VALUES ($1, 'rec-2026.06.1', '8f4c2a91', 'beautycorp-deploy-bot', 'succeeded', '2026-06-26T09:42:00.000Z', '{"change":"feature-store timeout tuning"}'::jsonb)
     ON CONFLICT (service_id, version, environment) DO UPDATE SET metadata = EXCLUDED.metadata
     RETURNING id;`,
    [serviceId],
  );
  const deploymentId = deployment.rows[0]?.id;
  if (!deploymentId) throw new Error("Failed to seed deployment.");

  await pool.query(
    `INSERT INTO runbooks (service_id, title, slug, body, source_path)
     VALUES ($1, 'Recommendation Service Latency Runbook', 'recommendation-service-latency',
       'Symptoms: p95 latency above 1200ms, feature-store timeout errors, elevated retry count. Common root cause: deployment changes timeout budget or retry behavior.',
       'test://recommendation-service-latency')
     ON CONFLICT (slug) DO UPDATE SET body = EXCLUDED.body, service_id = EXCLUDED.service_id;`,
    [serviceId],
  );

  await pool.query(
    `INSERT INTO log_entries (service_id, deployment_id, timestamp, level, message, attributes)
     VALUES ($1, $2, '2026-06-26T09:50:00.000Z', 'error', 'feature_store_timeout after 750ms; retry_count=3', '{"feature_store_timeout_ms":750,"retry_count":3}'::jsonb);`,
    [serviceId, deploymentId],
  );

  await pool.query(
    `INSERT INTO metric_points (service_id, timestamp, metric_name, metric_value, unit)
     VALUES
       ($1, '2026-06-26T09:44:00.000Z', 'p95_latency_ms', 220, 'ms'),
       ($1, '2026-06-26T09:50:00.000Z', 'p95_latency_ms', 1640, 'ms'),
       ($1, '2026-06-26T09:55:00.000Z', 'retry_count', 3, 'count');`,
    [serviceId],
  );

  const incident = await pool.query<{ id: string }>(
    `INSERT INTO incidents (service_id, title, severity, status, detected_at, started_at, detection_reason, metadata)
     VALUES ($1, 'Recommendation latency spike after feature-store timeout deployment', 'sev2', 'detected',
       '2026-06-26T09:58:00.000Z', '2026-06-26T09:47:00.000Z',
       'recommendation-service p95 latency exceeded 1200ms and feature-store timeout errors increased after deployment rec-2026.06.1.',
       '{"scenarioId":"beautycorp-rec-latency-2026-06-26"}'::jsonb)
     RETURNING id;`,
    [serviceId],
  );
  const incidentId = incident.rows[0]?.id;
  if (!incidentId) throw new Error("Failed to seed incident.");
  return incidentId;
}

describeWithDatabase("InvestigationWorkflow database integration", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    const connectionString =
      process.env.OPSPILOT_TEST_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgres://opspilot:opspilot@localhost:5432/opspilot";
    pool = createPool({ connectionString });
    await resetDatabase(pool);
    await runMigrations(pool);
    await seedScenario(pool);
    const rag = new RunbookRagService(
      pool,
      createEmbeddingClient(loadRagConfig({ RAG_EMBEDDING_PROVIDER: "deterministic" })),
    );
    await rag.ingest();
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("persists and reads a complete investigation using real repositories", async () => {
    const incidentIdResult = await pool.query<{ id: string }>(
      "SELECT id FROM incidents ORDER BY created_at DESC LIMIT 1;",
    );
    const incidentId = incidentIdResult.rows[0]?.id;
    if (!incidentId) throw new Error("Expected seeded incident.");
    const repository = new InvestigationRepository(pool);
    const rag = new RunbookRagService(
      pool,
      createEmbeddingClient(loadRagConfig({ RAG_EMBEDDING_PROVIDER: "deterministic" })),
    );
    const llm = new DeterministicIntegrationLLM();
    const workflow = new InvestigationWorkflow(repository, rag, llm);

    const result = await workflow.investigate(incidentId);

    expect(llm.requests).toHaveLength(1);
    expect(result.investigationId).toBeTruthy();
    expect(result.report.probableRootCause).toContain("feature-store timeout");

    const toolCalls = await pool.query<{ tool_name: string }>(
      "SELECT tool_name FROM tool_calls WHERE investigation_id = $1 ORDER BY created_at ASC, id ASC;",
      [result.investigationId],
    );
    expect(toolCalls.rows.map((row) => row.tool_name)).toEqual([
      "query_logs",
      "query_metrics",
      "get_deployments",
      "search_runbooks",
    ]);

    const steps = await pool.query<{ step_type: string; title: string }>(
      "SELECT step_type, title FROM investigation_steps WHERE investigation_id = $1 ORDER BY step_index ASC;",
      [result.investigationId],
    );
    expect(steps.rows.map((row) => row.title)).toEqual([
      "query_logs",
      "query_metrics",
      "get_deployments",
      "search_runbooks",
      "Build structured investigation prompt",
      "Investigation report",
    ]);

    const persisted = await pool.query<{
      status: string;
      summary: string | null;
      probable_root_cause: string | null;
      confidence_score: string | null;
    }>(
      "SELECT status, summary, probable_root_cause, confidence_score FROM investigations WHERE id = $1;",
      [result.investigationId],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: "completed",
      probable_root_cause:
        "Deployment rec-2026.06.1 changed feature-store timeout or retry behavior, causing feature-store timeouts and elevated latency.",
    });

    const detail = await repository.getInvestigationDetail(result.investigationId);
    expect(detail?.id).toBe(result.investigationId);
    expect(detail?.status).toBe("completed");
    const evidence = detail?.evidence;
    expect(Array.isArray(evidence)).toBe(true);
    expect(
      (evidence as readonly { readonly source?: string }[]).some((entry) => entry.source === "log"),
    ).toBe(true);
    const citedRunbooks = detail?.citedRunbooks;
    expect(Array.isArray(citedRunbooks)).toBe(true);
    expect(
      (citedRunbooks as readonly { readonly slug?: string }[]).some(
        (runbook) => runbook.slug === "recommendation-service-latency",
      ),
    ).toBe(true);

    const report = await repository.getInvestigationReport(result.investigationId);
    expect(report?.investigationId).toBe(result.investigationId);
    expect(report?.probableRootCause).toBe(
      "Deployment rec-2026.06.1 changed feature-store timeout or retry behavior, causing feature-store timeouts and elevated latency.",
    );
    const supportingToolCalls = report?.supportingToolCalls;
    expect(Array.isArray(supportingToolCalls)).toBe(true);
    expect(
      (
        supportingToolCalls as readonly { readonly toolName?: string; readonly status?: string }[]
      ).some((toolCall) => toolCall.toolName === "query_logs" && toolCall.status === "success"),
    ).toBe(true);
  }, 60_000);
});
