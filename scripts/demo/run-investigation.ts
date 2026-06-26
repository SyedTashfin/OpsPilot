import type pg from "pg";
import type { LLMChatRequest, LLMChatResponse, LLMClient, LLMProviderHealth } from "@opspilot/llm";
import { createPool, resetDatabase, runMigrations, runSeed } from "@opspilot/database";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";
import { loadConfig } from "../../apps/api/src/config.js";
import { buildServer } from "../../apps/api/src/server.js";
import { DemoRepository } from "../../apps/api/src/modules/demo/demo.repository.js";
import { IncidentRepository } from "../../apps/api/src/modules/incidents/incident.repository.js";
import { LogRepository } from "../../apps/api/src/modules/logs/log.repository.js";
import { generateDeployments } from "../../apps/demo-service/src/beautycorp/deployment-generator.js";
import { incidentScenarios } from "../../apps/demo-service/src/beautycorp/incident-scenarios.js";
import { generateLogBatch } from "../../apps/demo-service/src/beautycorp/log-generator.js";
import { generateMetricBatch } from "../../apps/demo-service/src/beautycorp/metrics-generator.js";
import { beautyCorpServices } from "../../apps/demo-service/src/beautycorp/services.js";

import { formatInvestigationSummary, type DemoReport } from "./format-investigation-summary.js";

type BeautyCorpTelemetrySnapshot = {
  readonly services: typeof beautyCorpServices;
  readonly deployments: ReturnType<typeof generateDeployments>;
  readonly logs: ReturnType<typeof generateLogBatch>;
  readonly metrics: ReturnType<typeof generateMetricBatch>;
  readonly incidents: typeof incidentScenarios;
};

function buildDemoTelemetrySnapshot(
  baseTime = new Date("2026-06-26T09:45:00.000Z"),
): BeautyCorpTelemetrySnapshot {
  return {
    services: beautyCorpServices,
    deployments: generateDeployments(),
    logs: generateLogBatch({ baseTime }),
    metrics: generateMetricBatch(baseTime),
    incidents: incidentScenarios,
  };
}

class DeterministicDemoLLM implements LLMClient {
  readonly provider = "ollama" as const;
  readonly model = "deterministic-demo";

  chat(_request: LLMChatRequest): Promise<LLMChatResponse> {
    return Promise.resolve({
      provider: this.provider,
      model: this.model,
      content: JSON.stringify({
        summary:
          "Recommendation-service p95 latency increased after deployment rec-2026.06.1, with matching feature-store timeout logs and runbook symptoms.",
        probableRootCause:
          "Deployment rec-2026.06.1 changed feature-store timeout or retry behavior, causing feature-store timeouts and retry amplification.",
        confidence: 0.88,
        evidence: [
          {
            source: "metric",
            reference: "p95_latency_ms",
            detail: "Metric summary shows a latency spike above the incident threshold.",
          },
          {
            source: "deployment",
            reference: "rec-2026.06.1",
            detail: "Deployment rec-2026.06.1 occurred before the incident window.",
          },
          {
            source: "log",
            reference: "feature_store_timeout",
            detail: "Logs include feature-store timeout and elevated retry-count evidence.",
          },
        ],
        citedRunbooks: [
          {
            title: "Recommendation Service Latency Runbook",
            slug: "recommendation-service-latency",
            chunkId: "demo-runbook-chunk",
            quote: "p95 latency above 1200ms, feature-store timeout errors, elevated retry count",
          },
        ],
        recommendedNextDiagnostics: [
          "Compare rec-2026.06.1 timeout and retry configuration against the previous release.",
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

function createDemoLLMOverride(): LLMClient | undefined {
  return process.env.OPSPILOT_DEMO_FAKE_LLM === "true" ? new DeterministicDemoLLM() : undefined;
}

async function seedTelemetry(pool: pg.Pool): Promise<string> {
  const demo = new DemoRepository(pool);
  const logs = new LogRepository(pool);
  const incidents = new IncidentRepository(pool);
  const snapshot = buildDemoTelemetrySnapshot(new Date("2026-06-26T09:45:00.000Z"));

  await demo.upsertServices(snapshot.services);
  await demo.upsertDeployments(snapshot.deployments);
  await logs.insertBatch(snapshot.logs);
  await demo.insertMetrics(snapshot.metrics);
  await demo.upsertIncidents(snapshot.incidents);

  const detected = await incidents.detectLatest();
  if (!detected.incidentId) throw new Error(`Demo incident was not detected: ${detected.reason}`);
  return detected.incidentId;
}

export async function runInvestigationDemo(): Promise<DemoReport> {
  const pool = createPool();

  try {
    await resetDatabase(pool);
    await runMigrations(pool);
    await runSeed(pool);
    const incidentId = await seedTelemetry(pool);

    const ragConfig = loadRagConfig({
      ...process.env,
      RAG_EMBEDDING_PROVIDER: process.env.RAG_EMBEDDING_PROVIDER ?? "deterministic",
    });
    const rag = new RunbookRagService(pool, createEmbeddingClient(ragConfig));
    await rag.ingest();

    const app = await buildServer(loadConfig({ ...process.env, API_AUTO_MIGRATE: "false" }), {
      pool,
      llm: createDemoLLMOverride(),
    });
    try {
      const investigationResponse = await app.inject({
        method: "POST",
        url: `/api/incidents/${incidentId}/investigations`,
      });
      if (investigationResponse.statusCode >= 400) {
        throw new Error(
          `Investigation request failed: ${investigationResponse.statusCode} ${investigationResponse.payload}`,
        );
      }
      const investigation = investigationResponse.json<{ investigationId: string }>();
      const reportResponse = await app.inject({
        method: "GET",
        url: `/api/investigations/${investigation.investigationId}/report`,
      });
      if (reportResponse.statusCode >= 400) {
        throw new Error(
          `Report request failed: ${reportResponse.statusCode} ${reportResponse.payload}`,
        );
      }
      return reportResponse.json<DemoReport>();
    } finally {
      await app.close();
    }
  } finally {
    await pool.end();
  }
}

if (process.env.NODE_ENV !== "test") {
  runInvestigationDemo()
    .then((report) => console.log(formatInvestigationSummary(report)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
