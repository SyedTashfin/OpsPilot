import { describe, expect, it, vi } from "vitest";
import {
  LangfuseInvestigationObserver,
  NoopInvestigationObserver,
  SafeInvestigationObserver,
  createInvestigationObserver,
  describePackage,
  loadLangfuseTelemetryConfig,
  type LangfuseClientLike,
} from "./index.js";

function createFakeLangfuseClient() {
  return {
    trace: vi.fn((body: Record<string, unknown>) => {
      void body;
      return { update: vi.fn() };
    }),
    span: vi.fn((body: Record<string, unknown>) => {
      void body;
      return { end: vi.fn() };
    }),
    generation: vi.fn((body: Record<string, unknown>) => {
      void body;
      return { end: vi.fn() };
    }),
    flushAsync: vi.fn(() => Promise.resolve()),
  } satisfies LangfuseClientLike;
}

describe("telemetry package", () => {
  it("identifies itself", () => {
    expect(describePackage()).toContain("Langfuse");
  });

  it("disables Langfuse automatically when credentials are absent", async () => {
    const config = loadLangfuseTelemetryConfig({});
    expect(config.enabled).toBe(false);
    const observer = createInvestigationObserver(config);
    expect(observer).toBeInstanceOf(NoopInvestigationObserver);
    await expect(observer.flush()).resolves.toBeUndefined();
  });

  it("keeps Langfuse disabled when explicitly disabled even with credentials", () => {
    const config = loadLangfuseTelemetryConfig({
      LANGFUSE_ENABLED: "false",
      LANGFUSE_PUBLIC_KEY: "public",
      LANGFUSE_SECRET_KEY: "secret",
    });
    expect(config.enabled).toBe(false);
    expect(createInvestigationObserver(config)).toBeInstanceOf(NoopInvestigationObserver);
  });

  it("creates a trace and records tool, generation, completion observations", async () => {
    const client = createFakeLangfuseClient();
    const observer = new LangfuseInvestigationObserver({ client, environment: "test" });

    const context = await observer.startInvestigation({
      investigationId: "inv-1",
      incidentId: "incident-1",
      serviceName: "recommendation-service",
      provider: "ollama",
      model: "qwen2.5:7b-instruct",
      promptVersion: "incident-investigation-v1",
    });
    await observer.recordTool(context, {
      investigationId: "inv-1",
      toolName: "query_logs",
      latencyMs: 12,
      success: true,
      metadata: { resultCount: 2 },
    });
    await observer.recordGeneration(context, {
      investigationId: "inv-1",
      provider: "ollama",
      model: "qwen2.5:7b-instruct",
      prompt: [{ role: "user", content: "diagnose" }],
      completion: "{}",
      latencyMs: 42,
      temperature: 0.1,
      tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3, estimated: true },
      structuredOutputSuccess: true,
    });
    await observer.completeInvestigation(context, {
      investigationId: "inv-1",
      durationMs: 100,
      success: true,
      status: "completed",
      confidenceScore: 0.88,
      citedRunbooks: [{ title: "Runbook", slug: "runbook" }],
      evidenceCount: 3,
    });
    await observer.flush();

    expect(context.traceId).toBe("inv-1");
    const traceCall = client.trace.mock.calls[0]?.[0];
    expect(traceCall).toMatchObject({ id: "inv-1", name: "investigation.workflow" });
    expect(traceCall?.metadata).toMatchObject({
      incidentId: "incident-1",
      serviceName: "recommendation-service",
    });

    const spanCall = client.span.mock.calls[0]?.[0];
    expect(spanCall).toMatchObject({ traceId: "inv-1", name: "query_logs" });
    expect(spanCall?.metadata).toMatchObject({ latencyMs: 12, resultCount: 2 });

    const generationCall = client.generation.mock.calls[0]?.[0];
    expect(generationCall).toMatchObject({
      traceId: "inv-1",
      name: "investigation.llm_generation",
      model: "qwen2.5:7b-instruct",
      input: [{ role: "user", content: "diagnose" }],
      output: "{}",
      usageDetails: { input: 1, output: 2, total: 3 },
    });
    expect(generationCall?.metadata).toMatchObject({
      structuredOutputSuccess: true,
      temperature: 0.1,
    });
    expect(client.flushAsync).toHaveBeenCalledOnce();
  });

  it("swallows unavailable Langfuse failures through the safe observer", async () => {
    const warn = vi.fn();
    const failing = new LangfuseInvestigationObserver({
      client: {
        trace: vi.fn(() => {
          throw new Error("Langfuse unavailable");
        }),
        span: vi.fn(() => {
          throw new Error("Langfuse unavailable");
        }),
        generation: vi.fn(() => {
          throw new Error("Langfuse unavailable");
        }),
        flushAsync: vi.fn(() => Promise.reject(new Error("Langfuse unavailable"))),
      },
    });
    const observer = new SafeInvestigationObserver(failing, warn);

    const context = await observer.startInvestigation({
      investigationId: "inv-1",
      incidentId: "incident-1",
      serviceName: "recommendation-service",
      provider: "ollama",
      model: "model",
      promptVersion: "v1",
    });
    await observer.recordTool(context, {
      investigationId: "inv-1",
      toolName: "query_logs",
      latencyMs: 1,
      success: true,
      metadata: {},
    });
    await observer.flush();

    expect(context).toEqual({});
    expect(warn).toHaveBeenCalled();
  });
});
