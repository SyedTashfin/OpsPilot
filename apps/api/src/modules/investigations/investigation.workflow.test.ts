import type { LLMChatRequest, LLMChatResponse, LLMClient, LLMProviderHealth } from "@opspilot/llm";
import { describe, expect, it, vi } from "vitest";
import {
  SafeInvestigationObserver,
  type InvestigationObserver,
  type InvestigationTraceContext,
} from "@opspilot/telemetry";
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
  metadata: { scenarioId: "beautycorp-rec-latency-2026-06-26" },
};

class FakeInvestigationRepository {
  readonly toolNames: string[] = [];
  readonly toolOutputs: unknown[] = [];
  readonly steps: { title: string; content: string }[] = [];
  completedReport: unknown;
  langfuseTraceId: string | undefined;
  invalidModelResponse: { rawResponse: string; parserError: string } | undefined;

  getIncident(): Promise<IncidentContext> {
    return Promise.resolve(incident);
  }

  createInvestigation(): Promise<string> {
    return Promise.resolve("investigation-1");
  }

  setLangfuseTraceId(_investigationId: string, traceId: string): Promise<void> {
    this.langfuseTraceId = traceId;
    return Promise.resolve();
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

  recordToolCall(input: { readonly toolName: string; readonly output: unknown }): Promise<void> {
    this.toolNames.push(input.toolName);
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
          "Symptoms: p95 latency above 1200ms, feature-store timeout errors, elevated retry count. Diagnostic guidance: inspect timeout and retry configuration diffs, then correlate retry counts with feature-store timeout logs.",
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
            reference: "feature_store_timeout retry_count log-1",
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

class RecordingObserver implements InvestigationObserver {
  readonly starts: unknown[] = [];
  readonly tools: unknown[] = [];
  readonly generations: unknown[] = [];
  readonly completions: unknown[] = [];
  flushCount = 0;

  startInvestigation(event: unknown): Promise<InvestigationTraceContext> {
    this.starts.push(event);
    return Promise.resolve({ traceId: "investigation-1" });
  }

  recordTool(_context: InvestigationTraceContext, event: unknown): Promise<void> {
    this.tools.push(event);
    return Promise.resolve();
  }

  recordGeneration(_context: InvestigationTraceContext, event: unknown): Promise<void> {
    this.generations.push(event);
    return Promise.resolve();
  }

  completeInvestigation(_context: InvestigationTraceContext, event: unknown): Promise<void> {
    this.completions.push(event);
    return Promise.resolve();
  }

  flush(): Promise<void> {
    this.flushCount += 1;
    return Promise.resolve();
  }
}

class FailingObserver implements InvestigationObserver {
  startInvestigation(): Promise<InvestigationTraceContext> {
    return Promise.reject(new Error("Langfuse unavailable"));
  }

  recordTool(): Promise<void> {
    return Promise.reject(new Error("Langfuse unavailable"));
  }

  recordGeneration(): Promise<void> {
    return Promise.reject(new Error("Langfuse unavailable"));
  }

  completeInvestigation(): Promise<void> {
    return Promise.reject(new Error("Langfuse unavailable"));
  }

  flush(): Promise<void> {
    return Promise.reject(new Error("Langfuse unavailable"));
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

  it("records investigation trace, tool observations, generation, and completion when enabled", async () => {
    const repository = new FakeInvestigationRepository();
    const observer = new RecordingObserver();
    const workflow = new InvestigationWorkflow(
      repository as unknown as InvestigationRepository,
      new FakeRunbooks(),
      new FakeLLM(),
      observer,
    );

    await workflow.investigate("incident-1");

    expect(repository.langfuseTraceId).toBe("investigation-1");
    expect(observer.starts).toHaveLength(1);
    expect(observer.tools).toHaveLength(4);
    expect(observer.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: "query_logs", success: true }),
        expect.objectContaining({ toolName: "query_metrics", success: true }),
        expect.objectContaining({ toolName: "get_deployments", success: true }),
        expect.objectContaining({ toolName: "search_runbooks", success: true }),
      ]),
    );
    expect(observer.generations).toEqual([
      expect.objectContaining({
        provider: "ollama",
        model: "test-model",
        structuredOutputSuccess: true,
        temperature: 0.1,
      }),
    ]);
    expect(observer.completions).toEqual([
      expect.objectContaining({ status: "completed", confidenceScore: 0.86, evidenceCount: 3 }),
    ]);
    expect(observer.flushCount).toBe(1);
  });

  it("continues the investigation when Langfuse is unavailable", async () => {
    const warn = vi.fn();
    const repository = new FakeInvestigationRepository();
    const workflow = new InvestigationWorkflow(
      repository as unknown as InvestigationRepository,
      new FakeRunbooks(),
      new FakeLLM(),
      new SafeInvestigationObserver(new FailingObserver(), warn),
    );

    const result = await workflow.investigate("incident-1");

    expect(result.report.probableRootCause).toContain("feature-store timeout");
    expect(repository.completedReport).toEqual(result.report);
    expect(warn).toHaveBeenCalled();
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
