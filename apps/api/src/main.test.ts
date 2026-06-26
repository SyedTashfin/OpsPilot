import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { createHealthResponse, getServiceName } from "./main.js";
import { buildServer } from "./server.js";

class FakePool {
  query(sql: string): Promise<{ rows: unknown[]; rowCount: number }> {
    if (sql.includes("FROM beautycorp_services") && sql.includes("ORDER BY name")) {
      return Promise.resolve({
        rows: [{ id: "svc_1", name: "recommendation-service" }],
        rowCount: 1,
      });
    }
    if (sql.includes("FROM log_entries")) return Promise.resolve({ rows: [], rowCount: 0 });
    if (sql.includes("FROM investigations inv") && sql.includes("WHERE inv.id")) {
      return Promise.resolve({
        rows: [
          {
            id: "inv-1",
            incidentId: "incident-1",
            incidentTitle: "Recommendation latency spike",
            serviceName: "recommendation-service",
            status: "completed",
            provider: "ollama",
            model: "test-model",
            promptVersion: "incident-investigation-v1",
            startedAt: "2026-06-26T09:58:00.000Z",
            completedAt: "2026-06-26T09:59:00.000Z",
            latencyMs: 1000,
            summary: "Latency spiked after deployment.",
            probableRootCause: "Feature-store timeout retry amplification.",
            confidence: 0.86,
            createdAt: "2026-06-26T09:58:00.000Z",
          },
        ],
        rowCount: 1,
      });
    }
    if (sql.includes("FROM tool_calls")) {
      return Promise.resolve({
        rows: [
          {
            id: "tool-1",
            toolName: "query_logs",
            input: {},
            output: [],
            status: "success",
            latencyMs: 5,
            createdAt: "2026-06-26T09:58:01.000Z",
          },
        ],
        rowCount: 1,
      });
    }
    if (sql.includes("FROM investigation_steps")) {
      return Promise.resolve({
        rows: [
          {
            id: "step-1",
            stepIndex: 6,
            stepType: "final",
            title: "Investigation report",
            content: JSON.stringify({
              summary: "Latency spiked after deployment.",
              probableRootCause: "Feature-store timeout retry amplification.",
              confidence: 0.86,
              evidence: [
                { source: "log", reference: "log-1", detail: "feature_store_timeout observed" },
              ],
              citedRunbooks: [
                {
                  title: "Recommendation Service Latency Runbook",
                  slug: "recommendation-service-latency",
                  chunkId: "chunk-1",
                  quote: "feature-store timeout errors",
                },
              ],
              recommendedNextDiagnostics: ["Compare deployment diff."],
            }),
            metadata: {},
            createdAt: "2026-06-26T09:59:00.000Z",
          },
        ],
        rowCount: 1,
      });
    }
    if (sql.includes("FROM incidents")) return Promise.resolve({ rows: [], rowCount: 0 });
    return Promise.resolve({ rows: [{ ok: 1 }], rowCount: 1 });
  }

  end(): Promise<void> {
    return Promise.resolve();
  }
}

const config = {
  port: 0,
  databaseUrl: "postgres" + "://test",
  ollamaBaseUrl: "http" + "://127.0.0.1:9",
  langfuseBaseUrl: "http" + "://127.0.0.1:10",
  autoMigrate: false,
  llmProvider: "ollama" as const,
  ollamaModel: "qwen2.5:7b-instruct",
  llmCredential: undefined,
  geminiModel: "gemini-1.5-flash",
};

const app = await buildServer(config, { pool: new FakePool() as unknown as pg.Pool });

afterAll(async () => {
  await app.close();
});

describe("api server", () => {
  it("identifies itself", () => {
    expect(getServiceName()).toBe("@opspilot/api");
    expect(createHealthResponse()).toEqual({ service: "@opspilot/api", status: "ready" });
  });

  it("rejects invalid LLM provider config instead of silently falling back", () => {
    expect(() => loadConfig({ LLM_PROVIDER: "gemni" })).toThrow();
  });

  it("serves health", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as {
      status?: string;
      services?: { database?: string };
    };
    expect(body.status).toBe("ok");
    expect(body.services?.database).toBe("ok");
  });

  it("serves services", async () => {
    const response = await app.inject({ method: "GET", url: "/api/services" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [{ id: "svc_1", name: "recommendation-service" }] });
  });

  it("serves llm provider status", async () => {
    const response = await app.inject({ method: "GET", url: "/api/llm/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        provider: "ollama",
        model: "qwen2.5:7b-instruct",
      }),
    );
  });

  it("serves investigation details", async () => {
    const response = await app.inject({ method: "GET", url: "/api/investigations/inv-1" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "inv-1",
      probableRootCause: "Feature-store timeout retry amplification.",
      toolCalls: [expect.objectContaining({ toolName: "query_logs" })],
      evidence: [expect.objectContaining({ source: "log" })],
      citedRunbooks: [expect.objectContaining({ slug: "recommendation-service-latency" })],
    });
  });

  it("serves presentation investigation report", async () => {
    const response = await app.inject({ method: "GET", url: "/api/investigations/inv-1/report" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      investigationId: "inv-1",
      serviceName: "recommendation-service",
      probableRootCause: "Feature-store timeout retry amplification.",
      supportingToolCalls: [expect.objectContaining({ toolName: "query_logs" })],
    });
  });

  it("rejects invalid telemetry", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/demo/telemetry/batch",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});
