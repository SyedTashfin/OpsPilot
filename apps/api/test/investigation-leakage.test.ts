import type { LLMChatRequest, LLMChatResponse, LLMClient, LLMProviderHealth } from "@opspilot/llm";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  InvestigationWorkflow,
  type RunbookSearchService,
} from "../src/modules/investigations/investigation.workflow.js";
import type { InvestigationRepository } from "../src/modules/investigations/investigation.repository.js";
import type { IncidentContext } from "../src/modules/investigations/investigation.types.js";
import { evaluateInvestigationReport } from "./evaluation/harness.test-support.js";
import { recommendationLatencyGroundTruth } from "./evaluation/recommendation-latency-ground-truth.test-support.js";

const forbiddenRootCause = recommendationLatencyGroundTruth.expectedConclusion;
const e2eFixtureConclusion =
  "Feature-store timeout and retry amplification are the most supported E2E fixture conclusion.";

const incident: IncidentContext = {
  id: "incident-1",
  serviceId: "service-1",
  serviceName: "recommendation-service",
  title: "Recommendation latency spike after feature-store timeout deployment",
  severity: "sev2",
  status: "detected",
  detectedAt: "2026-06-26T09:58:00.000Z",
  startedAt: "2026-06-26T09:47:00.000Z",
  detectionReason:
    "recommendation-service p95 latency exceeded 1200ms and feature-store timeout errors increased after deployment rec-2026.06.1.",
  metadata: { scenarioId: "beautycorp-rec-latency-2026-06-26" },
};

class RecordingRepository {
  readonly toolOutputs: unknown[] = [];
  readonly steps: { title: string; content: string }[] = [];
  completedReport: unknown;

  getIncident(): Promise<IncidentContext> {
    return Promise.resolve(incident);
  }
  createInvestigation(): Promise<string> {
    return Promise.resolve("investigation-1");
  }
  queryLogs() {
    return Promise.resolve([
      {
        id: "log-1",
        timestamp: "2026-06-26T09:50:00.000Z",
        level: "error",
        message: "feature_store_timeout after 750ms; retry_count=3",
        attributes: { feature_store_timeout_ms: 750, retry_count: 3 },
      },
    ]);
  }
  queryMetrics() {
    return Promise.resolve([
      { metricName: "p95_latency_ms", unit: "ms", min: 220, max: 1640, avg: 980, samples: 12 },
    ]);
  }
  getDeployments() {
    return Promise.resolve([
      {
        id: "deploy-1",
        version: "rec-2026.06.1",
        commitSha: "8f4c2a91",
        deployedBy: "beautycorp-deploy-bot",
        status: "succeeded",
        deployedAt: "2026-06-26T09:42:00.000Z",
        metadata: { change: "feature-store timeout tuning" },
      },
    ]);
  }
  recordToolCall(input: { readonly output: unknown }): Promise<void> {
    this.toolOutputs.push(input.output);
    return Promise.resolve();
  }
  recordStep(input: { readonly title: string; readonly content: string }): Promise<void> {
    this.steps.push({ title: input.title, content: input.content });
    return Promise.resolve();
  }
  completeInvestigation(input: { readonly report: unknown }): Promise<void> {
    this.completedReport = input.report;
    return Promise.resolve();
  }
  failInvestigation(): Promise<void> {
    return Promise.resolve();
  }
}

class DiagnosticRunbooks implements RunbookSearchService {
  search() {
    return Promise.resolve([
      {
        chunkId: "chunk-1",
        runbookId: "runbook-1",
        serviceName: "recommendation-service",
        title: "Recommendation Service Latency Runbook",
        slug: "recommendation-service-latency",
        chunkIndex: 0,
        content:
          "Symptoms: p95 latency above 1200ms, feature-store timeout errors, elevated retry count. Diagnostic guidance: inspect timeout and retry configuration diffs, then correlate retry counts with feature-store timeout logs.",
        score: 0.91,
        metadata: {},
      },
    ]);
  }
}

class DeterministicLLM implements LLMClient {
  readonly provider = "ollama" as const;
  readonly model = "test-model";
  requests: LLMChatRequest[] = [];

  chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    this.requests.push(request);
    return Promise.resolve({
      provider: "ollama",
      model: "test-model",
      content: JSON.stringify({
        summary: "Recommendation-service latency spiked after deployment rec-2026.06.1.",
        probableRootCause:
          "The rec-2026.06.1 deployment changed feature-store timeout/retry behavior, causing feature-store timeouts and retry amplification.",
        confidence: 0.86,
        evidence: [
          { source: "metric", reference: "p95_latency_ms", detail: "p95 latency reached 1640ms." },
          {
            source: "deployment",
            reference: "rec-2026.06.1",
            detail: "Deployment occurred before the incident window.",
          },
          {
            source: "log",
            reference: "feature_store_timeout retry_count log-1",
            detail: "Log reports feature_store_timeout and retry_count=3.",
          },
        ],
        citedRunbooks: [],
        recommendedNextDiagnostics: [
          "Check feature store timeout configuration diff for rec-2026.06.1.",
        ],
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimated: true },
    });
  }

  health(): Promise<LLMProviderHealth> {
    return Promise.resolve({
      provider: "ollama",
      configured: true,
      available: true,
      model: this.model,
    });
  }
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

describe("investigation ground-truth boundary", () => {
  it("keeps hidden expected answers out of pre-LLM model-visible state and evaluates final output separately", async () => {
    const repository = new RecordingRepository();
    const llm = new DeterministicLLM();
    const workflow = new InvestigationWorkflow(
      repository as unknown as InvestigationRepository,
      new DiagnosticRunbooks(),
      llm,
    );

    const result = await workflow.investigate("incident-1");
    const preLlmModelVisible = JSON.stringify({
      messages: llm.requests.flatMap((request) => request.messages),
      toolOutputs: repository.toolOutputs,
      steps: repository.steps.filter((step) => step.title !== "Investigation report"),
      incident,
    });

    for (const forbidden of [
      "suspectedRootCause",
      "suspected_root_cause",
      "expectedConclusion",
      "expectedEvidence",
      "contributingFactors",
      forbiddenRootCause,
      "Common root cause",
    ]) {
      expect(preLlmModelVisible).not.toContain(forbidden);
    }
    expect(preLlmModelVisible).toContain("feature_store_timeout");
    expect(preLlmModelVisible).toContain("p95_latency_ms");
    expect(preLlmModelVisible).toContain("rec-2026.06.1");

    const evaluation = evaluateInvestigationReport(result.report, recommendationLatencyGroundTruth);
    expect(evaluation).toMatchObject({ passed: true, confidence: result.report.confidence });
    expect(evaluation.actualConclusion).toContain("rec-2026.06.1");
    expect(evaluation.unsupportedClaims).toEqual([]);
  });

  it("keeps hidden fixtures outside production source and build output content", async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const srcFiles = await walkFiles(path.resolve(__dirname, "../src"));
    const distFiles = await walkFiles(path.resolve(__dirname, "../dist")).catch(
      () => [] as string[],
    );
    const productionFiles = [...srcFiles, ...distFiles].filter((file) =>
      /\.(ts|js|d\.ts)$/.test(file),
    );

    for (const file of productionFiles) {
      const content = await readFile(file, "utf8");
      expect(content, file).not.toContain("recommendationLatencyGroundTruth");
      expect(content, file).not.toContain(forbiddenRootCause);
      expect(content, file).not.toContain("DeterministicE2ELLM");
      expect(content, file).not.toContain(e2eFixtureConclusion);
    }
  });
});
