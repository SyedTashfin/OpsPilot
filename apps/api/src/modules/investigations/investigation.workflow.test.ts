import type { LLMChatRequest, LLMChatResponse, LLMClient, LLMProviderHealth } from "@opspilot/llm";
import { describe, expect, it } from "vitest";
import { InvestigationWorkflow, type RunbookSearchService } from "./investigation.workflow.js";
import type { InvestigationRepository } from "./investigation.repository.js";
import type { IncidentContext } from "./investigation.types.js";

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
  suspectedRootCause: null,
  metadata: { scenarioId: "beautycorp-rec-latency-2026-06-26" },
};

class FakeInvestigationRepository {
  readonly toolNames: string[] = [];
  readonly steps: string[] = [];
  completedReport: unknown;
  invalidModelResponse: { rawResponse: string; parserError: string } | undefined;

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

  recordToolCall(input: { readonly toolName: string }): Promise<void> {
    this.toolNames.push(input.toolName);
    return Promise.resolve();
  }

  recordStep(input: { readonly title: string }): Promise<void> {
    this.steps.push(input.title);
    return Promise.resolve();
  }

  completeInvestigation(input: { readonly report: unknown }): Promise<void> {
    this.completedReport = input.report;
    return Promise.resolve();
  }

  recordInvalidModelResponse(input: {
    readonly rawResponse: string;
    readonly parserError: string;
  }): Promise<void> {
    this.invalidModelResponse = { rawResponse: input.rawResponse, parserError: input.parserError };
    return Promise.resolve();
  }

  failInvestigation(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeRunbooks implements RunbookSearchService {
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
          "Symptoms: p95 latency above 1200ms, feature-store timeout errors, elevated retry count. Common root cause: deployment changes timeout budget or retry behavior.",
        score: 0.91,
        metadata: {},
      },
    ]);
  }
}

class InvalidJsonLLM implements LLMClient {
  readonly provider = "ollama" as const;
  readonly model = "test-model";

  chat(): Promise<LLMChatResponse> {
    return Promise.resolve({
      provider: "ollama",
      model: "test-model",
      content: "not-json",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimated: true },
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

class FakeLLM implements LLMClient {
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
            reference: "log-1",
            detail: "Log reports feature_store_timeout and retry_count=3.",
          },
        ],
        citedRunbooks: [
          {
            title: "Recommendation Service Latency Runbook",
            slug: "recommendation-service-latency",
            chunkId: "chunk-1",
            quote: "p95 latency above 1200ms, feature-store timeout errors, elevated retry count",
          },
        ],
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

describe("InvestigationWorkflow", () => {
  it("runs the deterministic BeautyCorp investigation sequence and persists the report", async () => {
    const repository = new FakeInvestigationRepository();
    const llm = new FakeLLM();
    const workflow = new InvestigationWorkflow(
      repository as unknown as InvestigationRepository,
      new FakeRunbooks(),
      llm,
    );

    const result = await workflow.investigate("incident-1");

    expect(repository.toolNames).toEqual([
      "query_logs",
      "query_metrics",
      "get_deployments",
      "search_runbooks",
    ]);
    expect(llm.requests).toHaveLength(1);
    expect(result.report.probableRootCause).toContain("feature-store timeout");
    expect(result.report.confidence).toBeGreaterThan(0.8);
    expect(
      result.report.evidence.some(
        (entry) => entry.source === "log" && entry.detail.includes("feature_store_timeout"),
      ),
    ).toBe(true);
    expect(
      result.report.evidence.some(
        (entry) => entry.source === "deployment" && entry.reference === "rec-2026.06.1",
      ),
    ).toBe(true);
    expect(
      result.report.evidence.some(
        (entry) => entry.source === "metric" && entry.reference === "p95_latency_ms",
      ),
    ).toBe(true);
    expect(
      result.report.citedRunbooks.some(
        (runbook) => runbook.slug === "recommendation-service-latency",
      ),
    ).toBe(true);
    expect(repository.completedReport).toEqual(result.report);
    expect(llm.requests[0]?.messages[1]?.content).toContain("requiredToolSequenceAlreadyCompleted");
    expect(llm.requests[0]?.messages[1]?.content).toContain("No remediation actions");
  });

  it("persists raw model response and parser error when JSON parsing fails", async () => {
    const repository = new FakeInvestigationRepository();
    const workflow = new InvestigationWorkflow(
      repository as unknown as InvestigationRepository,
      new FakeRunbooks(),
      new InvalidJsonLLM(),
    );

    await expect(workflow.investigate("incident-1")).rejects.toThrow();
    expect(repository.invalidModelResponse?.rawResponse).toBe("not-json");
    expect(repository.invalidModelResponse?.parserError).toContain("JSON");
  });
});
