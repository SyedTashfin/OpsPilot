import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
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

  it("rejects invalid telemetry", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/demo/telemetry/batch",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});
