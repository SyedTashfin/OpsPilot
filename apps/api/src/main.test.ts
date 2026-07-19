import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { createHealthResponse, getServiceName } from "./main.js";
import { buildServer } from "./server.js";

class FakePool {
  query(sql: string): Promise<{ rows: unknown[]; rowCount: number }> {
    if (sql.includes("FROM beautycorp_services") && sql.includes("WHERE id::text")) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (sql.includes("FROM beautycorp_services") && sql.includes("ORDER BY name")) {
      return Promise.resolve({
        rows: [{ id: "svc_1", name: "recommendation-service" }],
        rowCount: 1,
      });
    }
    if (sql.includes("FROM log_entries")) return Promise.resolve({ rows: [], rowCount: 0 });
    if (sql.includes("FROM investigations inv") && sql.includes("ORDER BY inv.created_at DESC")) {
      return Promise.resolve({
        rows: [
          {
            investigationId: "22222222-2222-4222-8222-222222222222",
            incidentId: "bbbbbbbb-2222-4222-8222-222222222222",
            status: "running",
            createdAt: "2026-06-26T10:00:00.000Z",
            cursorCreatedAt: "2026-06-26T10:00:00.123456Z",
            completedAt: null,
            summary: "Investigation is still running.",
            probableRootCause: null,
            confidence: null,
          },
          {
            investigationId: "11111111-1111-4111-8111-111111111111",
            incidentId: "aaaaaaaa-1111-4111-8111-111111111111",
            status: "completed",
            createdAt: "2026-06-26T09:58:00.000Z",
            cursorCreatedAt: "2026-06-26T09:58:00.000001Z",
            completedAt: "2026-06-26T09:59:00.000Z",
            summary: "Latency spiked after deployment.",
            probableRootCause: "Feature-store timeout retry amplification.",
            confidence: 0.86,
          },
        ],
        rowCount: 2,
      });
    }
    if (sql.includes("FROM investigations inv") && sql.includes("WHERE inv.id")) {
      return Promise.resolve({
        rows: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            incidentId: "aaaaaaaa-1111-4111-8111-111111111111",
            incidentTitle: "Recommendation latency spike",
            serviceName: "recommendation-service",
            status: "completed",
            provider: "ollama",
            model: "test-model",
            promptVersion: "incident-investigation-v1",
            langfuseTraceId: "investigation-1",
            startedAt: "2026-06-26T09:58:00.000Z",
            completedAt: "2026-06-26T09:59:00.000Z",
            latencyMs: 1000,
            summary: "Latency spiked after deployment.",
            probableRootCause: "Feature-store timeout retry amplification.",
            confidence: 0.86,
            createdAt: "2026-06-26T09:58:00.000Z",
            cursorCreatedAt: "2026-06-26T09:58:00.000001Z",
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
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseEnabled: false,
  langfuseEnvironment: "test",
  autoMigrate: false,
  llmProvider: "ollama" as const,
  ollamaModel: "qwen2.5:7b-instruct",
  llmTimeoutMs: 90_000,
  llmCredential: undefined,
  geminiModel: "gemini-1.5-flash",
  portfolioAccessCode: "demo-code",
  sessionSecret: "test-session-secret-with-enough-length",
  allowedOrigins: ["http://localhost:3000"],
  authRequired: true,
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
      dependencies?: { database?: { state?: string } };
    };
    expect(body.status).toBe("degraded");
    expect(body.dependencies?.database?.state).toBe("healthy");
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

  it("serves paginated investigation history without hidden/internal fields", async () => {
    const response = await app.inject({ method: "GET", url: "/api/investigations?pageSize=1" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ nextCursor: unknown; pageSize: number; items: unknown[] }>();
    expect(typeof body.nextCursor).toBe("string");
    expect(body).toMatchObject({
      pageSize: 1,
      items: [
        {
          investigationId: "22222222-2222-4222-8222-222222222222",
          incidentId: "bbbbbbbb-2222-4222-8222-222222222222",
          status: "running",
          detailHref: "?investigationId=22222222-2222-4222-8222-222222222222#investigation",
        },
      ],
    });
    const serialized = response.payload;
    expect(serialized).not.toContain("suspectedRootCause");
    expect(serialized).not.toContain("toolCalls");
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("rawResponse");
  });

  it("rejects malformed investigation history cursors with the standard error envelope", async () => {
    const cursors = [
      "not-a-valid-cursor",
      Buffer.from(
        JSON.stringify({
          createdAt: "2026-06-26T10:00:00.123Z",
          investigationId: "11111111-1111-4111-8111-111111111111",
        }),
      ).toString("base64url"),
      Buffer.from(
        JSON.stringify({
          createdAt: "2026-06-26T10:00:00.123456Z",
          investigationId: "not-a-uuid",
        }),
      ).toString("base64url"),
      Buffer.from(
        JSON.stringify({
          createdAt: "2026-06-26T10:00:00.123456Z",
          investigationId: "11111111-1111-4111-8111-111111111111",
          extra: true,
        }),
      ).toString("base64url"),
    ];
    for (const cursor of cursors) {
      const response = await app.inject({
        method: "GET",
        url: `/api/investigations?cursor=${encodeURIComponent(cursor)}`,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: "invalid_investigation_history_cursor",
          message: "Invalid investigation history cursor.",
          details: {},
        },
      });
    }
  });

  it("rejects invalid investigation history filters before repository SQL", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/investigations?incidentId=not-a-uuid",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "invalid_investigation_history_query",
        message: "Invalid investigation history query.",
        details: {},
      },
    });
  });

  it("serves investigation details", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/investigations/11111111-1111-4111-8111-111111111111",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      langfuseTraceId: "investigation-1",
      probableRootCause: "Feature-store timeout retry amplification.",
      toolCalls: [expect.objectContaining({ toolName: "query_logs" })],
      evidence: [expect.objectContaining({ source: "log" })],
      citedRunbooks: [expect.objectContaining({ slug: "recommendation-service-latency" })],
    });
  });

  it("serves presentation investigation report", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/investigations/11111111-1111-4111-8111-111111111111/report",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      investigationId: "11111111-1111-4111-8111-111111111111",
      langfuseTraceId: "investigation-1",
      serviceName: "recommendation-service",
      probableRootCause: "Feature-store timeout retry amplification.",
      supportingToolCalls: [expect.objectContaining({ toolName: "query_logs" })],
    });
  });

  it("denies unauthenticated mutations and accepts authenticated JSON mutations", async () => {
    const denied = await app.inject({
      method: "POST",
      url: "/api/demo/telemetry/batch",
      payload: {},
      headers: { "content-type": "application/json" },
    });
    expect(denied.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { accessCode: "demo-code" },
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers["set-cookie"];
    const csrfToken = login.json<{ csrfToken: string }>().csrfToken;
    const accepted = await app.inject({
      method: "POST",
      url: "/api/logs/batch",
      payload: {
        logs: [
          {
            serviceName: "recommendation-service",
            timestamp: "2026-07-19T00:00:00.000Z",
            level: "info",
            message: "demo",
          },
        ],
      },
      headers: {
        "content-type": "application/json",
        cookie: String(cookie),
        "x-opspilot-csrf": csrfToken,
        origin: "http://localhost:3000",
      },
    });
    expect(accepted.statusCode).toBe(202);
  });

  it("rejects auth failures, disallowed origin, wrong content type, and unsafe production config", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { accessCode: "bad" },
          headers: { "content-type": "application/json" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/services",
          headers: { origin: "https://evil.example" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/demo/seed",
          payload: "{}",
          headers: { "content-type": "text/plain" },
        })
      ).statusCode,
    ).toBe(415);
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        OPSPILOT_PORTFOLIO_ACCESS_CODE: "strong-demo-code",
        OPSPILOT_SESSION_SECRET: "strong-session-secret-for-tests-123",
        API_ALLOWED_ORIGINS: "*",
      }),
    ).toThrow(/wildcard/);
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        OPSPILOT_PORTFOLIO_ACCESS_CODE: "short",
        OPSPILOT_SESSION_SECRET: "strong-session-secret-for-tests-123",
        API_ALLOWED_ORIGINS: "https://demo.example",
      }),
    ).toThrow(/access code/);
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        OPSPILOT_PORTFOLIO_ACCESS_CODE: "strong-demo-code",
        OPSPILOT_SESSION_SECRET: "short",
        API_ALLOWED_ORIGINS: "https://demo.example",
      }),
    ).toThrow(/session secret/);
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        OPSPILOT_PORTFOLIO_ACCESS_CODE: "strong-demo-code",
        OPSPILOT_SESSION_SECRET: "strong-session-secret-for-tests-123",
        API_ALLOWED_ORIGINS: "https://demo.example/path",
      }),
    ).toThrow(/bare origins/);
    expect(loadConfig({ NODE_ENV: "development" }).allowedOrigins).toEqual([
      "http://localhost:3000",
    ]);
    expect(
      loadConfig({ NODE_ENV: "development", WEB_PUBLIC_API_URL: "http://wrong.example" })
        .allowedOrigins,
    ).toEqual(["http://localhost:3000"]);
  });

  it("handles session tamper, logout, allowed origin, CSRF, and investigation rate limit", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { accessCode: "demo-code" },
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const cookie = String(login.headers["set-cookie"]);
    const csrfToken = login.json<{ csrfToken: string }>().csrfToken;

    const missingCsrf = await app.inject({
      method: "POST",
      url: "/api/demo/seed",
      payload: {},
      headers: { "content-type": "application/json", cookie },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const tampered = await app.inject({
      method: "POST",
      url: "/api/demo/seed",
      payload: {},
      headers: {
        "content-type": "application/json",
        cookie: "opspilot_session=tampered",
        "x-opspilot-csrf": csrfToken,
      },
    });
    expect(tampered.statusCode).toBe(401);

    const unauthenticatedLogout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      payload: {},
      headers: { "content-type": "application/json" },
    });
    expect(unauthenticatedLogout.statusCode).toBe(401);

    const logoutWithoutCsrf = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      payload: {},
      headers: { "content-type": "application/json", cookie },
    });
    expect(logoutWithoutCsrf.statusCode).toBe(403);

    const evilOriginMutation = await app.inject({
      method: "POST",
      url: "/api/demo/seed",
      payload: {},
      headers: {
        "content-type": "application/json",
        cookie,
        "x-opspilot-csrf": csrfToken,
        origin: "https://evil.example",
      },
    });
    expect(evilOriginMutation.statusCode).toBe(403);

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      payload: {},
      headers: {
        "content-type": "application/json",
        cookie,
        "x-opspilot-csrf": csrfToken,
        origin: "http://localhost:3000",
      },
    });
    expect(logout.statusCode).toBe(200);
    expect(String(logout.headers["set-cookie"])).toContain("HttpOnly");

    const requests = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.inject({
          method: "POST",
          url: "/api/incidents/missing/investigations",
          payload: {},
          headers: { "content-type": "application/json", cookie, "x-opspilot-csrf": csrfToken },
        }),
      ),
    );
    expect(requests.at(-1)?.statusCode).toBe(429);
  });

  it("returns preflight CORS headers only for allowed origins and fails closed for missing production auth", async () => {
    const allowedPreflight = await app.inject({
      method: "OPTIONS",
      url: "/api/demo/seed",
      headers: { origin: "http://localhost:3000" },
    });
    expect(allowedPreflight.statusCode).toBe(204);
    expect(allowedPreflight.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const deniedPreflight = await app.inject({
      method: "OPTIONS",
      url: "/api/demo/seed",
      headers: { origin: "https://evil.example" },
    });
    expect(deniedPreflight.statusCode).toBe(403);
    expect(() =>
      loadConfig({ NODE_ENV: "production", API_ALLOWED_ORIGINS: "https://demo.example" }),
    ).toThrow(/auth/);
  });

  it("uses the standard API error envelope for missing resources", async () => {
    const response = await app.inject({ method: "GET", url: "/api/services/missing-service" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "service_not_found",
        message: "Service not found.",
        details: {},
      },
    });
  });
});
